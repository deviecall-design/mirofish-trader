import pandas as pd
import pytest

from mirofish.agents.swarm_agent import (
    BUY,
    HOLD,
    SELL,
    HeuristicSentimentSimulator,
    MiroFishSwarmSentimentSimulator,
    NeutralSentimentSimulator,
    SentimentReading,
    SwarmAgent,
    build_seed_material,
)
from mirofish.kronos_bridge import MiroFishKronosAdapter
from mirofish.testing import make_synthetic_ohlcv


class FixedForecastPredictor:
    """Predictor whose forecast ends at last_close * (1 + move)."""

    def __init__(self, move: float):
        self.move = move

    def predict(self, df, x_timestamp, y_timestamp, pred_len, **kwargs):
        last = float(df["close"].iloc[-1])
        target = last * (1 + self.move)
        closes = [last + (target - last) * (i + 1) / pred_len for i in range(pred_len)]
        return pd.DataFrame(
            {
                "open": closes,
                "high": [c * 1.001 for c in closes],
                "low": [c * 0.999 for c in closes],
                "close": closes,
                "volume": [0.0] * pred_len,
                "amount": [0.0] * pred_len,
            },
            index=pd.Index(pd.to_datetime(pd.Series(y_timestamp))),
        )


def make_agent(move: float, sentiment=None, **kwargs) -> SwarmAgent:
    adapter = MiroFishKronosAdapter(
        predictor=FixedForecastPredictor(move), lookback=100, pred_len=8
    )
    return SwarmAgent("BTC", adapter, sentiment_simulator=sentiment, **kwargs)


@pytest.fixture
def market_df():
    return make_synthetic_ohlcv(n_bars=150)


def test_buy_when_forecast_above_threshold(market_df):
    thesis = make_agent(move=0.05).decide_trade(market_df)
    assert thesis.action == BUY
    assert thesis.expected_return == pytest.approx(0.05, rel=1e-3)
    assert thesis.price_target > thesis.current_price


def test_sell_when_forecast_below_threshold(market_df):
    thesis = make_agent(move=-0.05).decide_trade(market_df)
    assert thesis.action == SELL


def test_hold_inside_threshold_band(market_df):
    thesis = make_agent(move=0.005).decide_trade(market_df)
    assert thesis.action == HOLD
    assert thesis.confidence <= 0.5


def test_confident_contrarian_crowd_vetoes_trade(market_df):
    class BearishCrowd:
        def simulate(self, asset, summary):
            return SentimentReading(conviction=0.95, bias=-0.9, source="test")

    thesis = make_agent(move=0.05, sentiment=BearishCrowd()).decide_trade(market_df)
    assert thesis.action == HOLD
    assert "vetoed" in thesis.rationale.lower()


def test_aligned_crowd_boosts_confidence(market_df):
    class BullishCrowd:
        def simulate(self, asset, summary):
            return SentimentReading(conviction=0.9, bias=0.9, source="test")

    neutral = make_agent(move=0.05, sentiment=NeutralSentimentSimulator()).decide_trade(market_df)
    aligned = make_agent(move=0.05, sentiment=BullishCrowd()).decide_trade(market_df)
    assert aligned.action == BUY
    assert aligned.confidence > neutral.confidence


def test_supplied_forecast_skips_bridge_call(market_df):
    agent = make_agent(move=0.05)
    forecast = agent.kronos_bridge.forecast_single("BTC", market_df)
    thesis = agent.decide_trade(market_df, forecast=forecast)
    assert thesis.action == BUY


def test_heuristic_sentiment_follows_forecast_direction():
    sim = HeuristicSentimentSimulator()
    bull = sim.simulate("BTC", {"expected_return": 0.08})
    bear = sim.simulate("BTC", {"expected_return": -0.08})
    assert bull.bias > 0.5
    assert bear.bias < -0.5
    assert 0 <= bull.conviction <= 1


def test_seed_material_mentions_forecast():
    summary = {
        "expected_return": 0.08,
        "current_price": 50_000.0,
        "predicted_close": 54_000.0,
        "predicted_low": 49_500.0,
        "predicted_high": 54_500.0,
        "horizon_bars": 24,
        "horizon": "1 day",
    }
    seed = build_seed_material("BTC", summary)
    assert "BTC" in seed
    assert "rise 8.00%" in seed
    assert "54000.0000" in seed


def test_swarm_simulator_uses_injected_runner():
    captured = {}

    def fake_run(asset, seed):
        captured["asset"] = asset
        captured["seed"] = seed
        return {"conviction": 0.8, "bias": 0.6}

    sim = MiroFishSwarmSentimentSimulator(run_simulation=fake_run)
    reading = sim.simulate("ETH", {"expected_return": 0.03, "current_price": 1.0,
                                   "predicted_close": 1.03, "predicted_low": 1.0,
                                   "predicted_high": 1.04, "horizon_bars": 24,
                                   "horizon": "1 day"})
    assert reading.source == "mirofish-swarm"
    assert reading.conviction == pytest.approx(0.8)
    assert captured["asset"] == "ETH"
    assert "Kronos" in captured["seed"]


def test_swarm_simulator_falls_back_without_runner():
    sim = MiroFishSwarmSentimentSimulator()
    reading = sim.simulate("ETH", {"expected_return": 0.03})
    assert reading.source == "heuristic"


def test_thesis_serialisable(market_df):
    thesis = make_agent(move=0.05).decide_trade(market_df)
    d = thesis.to_dict()
    assert d["action"] == BUY
    assert set(d) >= {"asset", "action", "expected_return", "confidence", "rationale"}
