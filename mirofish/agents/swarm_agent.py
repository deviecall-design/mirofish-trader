"""Forecast-driven trading agent for MiroFish.

The decision flow mirrors the intended product architecture:

    Kronos                     MiroFish                   Decision
    (price forecast)           (sentiment sim)            (thesis)
       |                          |                          |
    "BTC +8% in 24h"   ->   simulate how retail   ->   price target +
                            reacts to forecast         sentiment conviction
                                                       = trade thesis

``SwarmAgent.decide_trade`` asks the Kronos bridge for a price forecast,
hands a summary of that forecast to a sentiment simulator (the MiroFish
swarm, or a cheap stand-in during backtests), and combines both signals
into a :class:`TradeThesis`.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from typing import Any, Callable, Dict, Optional, Protocol

import pandas as pd

from mirofish.kronos_bridge import MiroFishKronosAdapter

BUY = "BUY"
SELL = "SELL"
HOLD = "HOLD"


@dataclass
class SentimentReading:
    """Result of a sentiment simulation.

    conviction: 0..1 — how strongly the simulated crowd agrees with itself.
    bias:      -1..1 — net direction of the crowd (-1 bearish, +1 bullish).
    """

    conviction: float
    bias: float
    source: str = "unknown"
    detail: Dict[str, Any] = field(default_factory=dict)

    def __post_init__(self):
        self.conviction = min(1.0, max(0.0, float(self.conviction)))
        self.bias = min(1.0, max(-1.0, float(self.bias)))


class SentimentSimulator(Protocol):
    def simulate(self, asset: str, forecast_summary: Dict[str, Any]) -> SentimentReading: ...


class NeutralSentimentSimulator:
    """No sentiment information: neutral bias, middling conviction."""

    def simulate(self, asset: str, forecast_summary: Dict[str, Any]) -> SentimentReading:
        return SentimentReading(conviction=0.5, bias=0.0, source="neutral")


class HeuristicSentimentSimulator:
    """Cheap deterministic stand-in for the MiroFish swarm.

    Models a momentum-chasing retail crowd: the crowd leans in the
    direction of the published forecast, more strongly for larger moves.
    Useful for backtests, where running thousands of LLM-agent
    simulations per bar is not practical.
    """

    def __init__(self, sensitivity: float = 25.0):
        self.sensitivity = sensitivity

    def simulate(self, asset: str, forecast_summary: Dict[str, Any]) -> SentimentReading:
        expected_return = float(forecast_summary.get("expected_return", 0.0))
        bias = math.tanh(self.sensitivity * expected_return)
        conviction = min(1.0, 0.4 + 0.6 * abs(bias))
        return SentimentReading(conviction=conviction, bias=bias, source="heuristic")


def build_seed_material(asset: str, forecast_summary: Dict[str, Any]) -> str:
    """Render a Kronos forecast as MiroFish seed material.

    MiroFish builds its parallel world from seed text, so the forecast is
    written up as a market-signal bulletin the simulated agents can react
    to. This is the hand-off point between the two systems.
    """
    direction = "rise" if forecast_summary["expected_return"] >= 0 else "fall"
    pct = abs(forecast_summary["expected_return"]) * 100
    return (
        f"Market signal bulletin — {asset}\n"
        f"A quantitative K-line foundation model (Kronos) forecasts {asset} "
        f"will {direction} {pct:.2f}% over the next {forecast_summary['horizon_bars']} "
        f"bars (~{forecast_summary['horizon']}), from "
        f"{forecast_summary['current_price']:.4f} to a price target of "
        f"{forecast_summary['predicted_close']:.4f}.\n"
        f"Forecast range: low {forecast_summary['predicted_low']:.4f} / "
        f"high {forecast_summary['predicted_high']:.4f}.\n"
        f"Question for the simulation: how do retail traders, swing traders "
        f"and skeptics react to this forecast becoming public? Do they front-run "
        f"it, fade it, or ignore it?"
    )


class MiroFishSwarmSentimentSimulator:
    """Runs the forecast through a real MiroFish swarm simulation.

    A full MiroFish run spins up an OASIS multi-agent world (LLM calls,
    minutes of wall time), so this class delegates the actual run to an
    injected ``run_simulation`` callable — typically a thin client for the
    MiroFish backend API (`POST /api/simulation/...`). The callable
    receives the seed material and must return a
    :class:`SentimentReading` (or a dict with ``conviction``/``bias``).

    If no callable is supplied, it degrades to
    :class:`HeuristicSentimentSimulator` so pipelines keep working
    offline.
    """

    def __init__(
        self,
        run_simulation: Optional[
            Callable[[str, str], SentimentReading | Dict[str, Any]]
        ] = None,
        fallback: Optional[SentimentSimulator] = None,
    ):
        self.run_simulation = run_simulation
        self.fallback = fallback or HeuristicSentimentSimulator()

    def simulate(self, asset: str, forecast_summary: Dict[str, Any]) -> SentimentReading:
        if self.run_simulation is None:
            return self.fallback.simulate(asset, forecast_summary)
        seed = build_seed_material(asset, forecast_summary)
        result = self.run_simulation(asset, seed)
        if isinstance(result, SentimentReading):
            reading = result
        else:
            reading = SentimentReading(
                conviction=result.get("conviction", 0.5),
                bias=result.get("bias", 0.0),
                detail=dict(result),
            )
        reading.source = "mirofish-swarm"
        return reading


@dataclass
class TradeThesis:
    """Combined output: price target + sentiment conviction."""

    asset: str
    action: str
    current_price: float
    predicted_close: float
    expected_return: float
    price_target: float
    sentiment_conviction: float
    sentiment_bias: float
    confidence: float
    rationale: str

    def to_dict(self) -> Dict[str, Any]:
        return {
            "asset": self.asset,
            "action": self.action,
            "current_price": self.current_price,
            "predicted_close": self.predicted_close,
            "expected_return": self.expected_return,
            "price_target": self.price_target,
            "sentiment_conviction": self.sentiment_conviction,
            "sentiment_bias": self.sentiment_bias,
            "confidence": self.confidence,
            "rationale": self.rationale,
        }


class SwarmAgent:
    """Trades one asset using Kronos forecasts plus swarm sentiment.

    Parameters
    ----------
    buy_threshold / sell_threshold:
        Fractional expected-return thresholds. The defaults (+2% / -2%)
        match the integration spec: predicted close more than 2% above
        the current price is a BUY candidate, more than 2% below a SELL
        candidate, anything in between is HOLD.
    min_conviction:
        A candidate trade is vetoed to HOLD when the simulated crowd's
        conviction is below this level while it also leans against the
        forecast direction.
    """

    def __init__(
        self,
        asset: str,
        kronos_bridge: MiroFishKronosAdapter,
        sentiment_simulator: Optional[SentimentSimulator] = None,
        buy_threshold: float = 0.02,
        sell_threshold: float = -0.02,
        min_conviction: float = 0.3,
        pred_len: Optional[int] = None,
    ):
        if sell_threshold >= buy_threshold:
            raise ValueError("sell_threshold must be below buy_threshold")
        self.asset = asset
        self.kronos_bridge = kronos_bridge
        self.sentiment_simulator = sentiment_simulator or NeutralSentimentSimulator()
        self.buy_threshold = buy_threshold
        self.sell_threshold = sell_threshold
        self.min_conviction = min_conviction
        self.pred_len = pred_len

    # ------------------------------------------------------------------
    def summarise_forecast(
        self, market_df: pd.DataFrame, forecast: pd.DataFrame
    ) -> Dict[str, Any]:
        market_df = market_df.copy()
        market_df.columns = [str(c).lower() for c in market_df.columns]
        current_price = float(market_df["close"].iloc[-1])
        predicted_close = float(forecast["close"].iloc[-1])
        horizon_bars = len(forecast)
        if isinstance(forecast.index, pd.DatetimeIndex) and horizon_bars >= 2:
            horizon = str(forecast.index[-1] - forecast.index[0] + (forecast.index[1] - forecast.index[0]))
        else:
            horizon = f"{horizon_bars} bars"
        return {
            "current_price": current_price,
            "predicted_close": predicted_close,
            "predicted_low": float(forecast["low"].min()),
            "predicted_high": float(forecast["high"].max()),
            "expected_return": (predicted_close - current_price) / current_price,
            "horizon_bars": horizon_bars,
            "horizon": horizon,
        }

    def decide_trade(
        self, market_df: pd.DataFrame, forecast: Optional[pd.DataFrame] = None
    ) -> TradeThesis:
        """Produce a trade thesis for the current market state.

        ``forecast`` may be supplied directly (e.g. from a batched
        ``forecast_portfolio`` call); otherwise the bridge is asked for a
        fresh single-asset forecast.
        """
        if forecast is None:
            forecast = self.kronos_bridge.forecast_single(
                self.asset, market_df, pred_len=self.pred_len
            )
        summary = self.summarise_forecast(market_df, forecast)
        expected_return = summary["expected_return"]

        sentiment = self.sentiment_simulator.simulate(self.asset, summary)

        # Directional agreement between forecast and simulated crowd:
        # +1 fully aligned, -1 fully opposed, ~0 when either is flat.
        forecast_direction = math.tanh(25.0 * expected_return)
        agreement = forecast_direction * sentiment.bias

        if expected_return >= self.buy_threshold:
            action = BUY
        elif expected_return <= self.sell_threshold:
            action = SELL
        else:
            action = HOLD

        vetoed = False
        if action != HOLD and agreement < 0 and sentiment.conviction >= (1 - self.min_conviction):
            # The crowd strongly and confidently leans against the
            # forecast — stand aside rather than fight both signals.
            vetoed = True
            action = HOLD

        edge = abs(expected_return) / max(self.buy_threshold, 1e-9)
        confidence = min(1.0, 0.5 * min(edge, 2.0)) * (0.5 + 0.5 * sentiment.conviction)
        if agreement > 0:
            confidence = min(1.0, confidence * (1.0 + 0.25 * agreement))
        elif agreement < 0:
            confidence *= 1.0 + 0.5 * agreement  # shrink when crowd disagrees
        if action == HOLD:
            confidence = min(confidence, 0.5)

        rationale = (
            f"Kronos projects {expected_return * +100:.2f}% over "
            f"{summary['horizon_bars']} bars (target {summary['predicted_close']:.4f} "
            f"vs current {summary['current_price']:.4f}); swarm sentiment bias "
            f"{sentiment.bias:+.2f} with conviction {sentiment.conviction:.2f} "
            f"({sentiment.source})."
        )
        if vetoed:
            rationale += " Trade vetoed: confident crowd disagreement with the forecast."

        return TradeThesis(
            asset=self.asset,
            action=action,
            current_price=summary["current_price"],
            predicted_close=summary["predicted_close"],
            expected_return=expected_return,
            price_target=summary["predicted_close"],
            sentiment_conviction=sentiment.conviction,
            sentiment_bias=sentiment.bias,
            confidence=max(0.0, confidence),
            rationale=rationale,
        )
