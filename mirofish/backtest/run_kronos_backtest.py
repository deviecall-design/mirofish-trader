"""Walk-forward backtest: MiroFish with Kronos vs baseline.

Runs the same walk-forward loop twice — once with the SwarmAgent driven
by Kronos forecasts (``use_kronos=True``) and once with a simple
momentum baseline — and compares Sharpe, total return, max drawdown and
win rate.

Usage
-----
Run against synthetic data with the torch-free mock predictor::

    python -m mirofish.backtest.run_kronos_backtest --mock

Run against your own OHLCV CSV (columns: timestamps,open,high,low,close,
volume) with the real pre-trained Kronos model::

    KRONOS_REPO_PATH=~/projects/kronos \\
    python -m mirofish.backtest.run_kronos_backtest --csv data/BTCUSDT_1h.csv
"""

from __future__ import annotations

import argparse
import math
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional

import numpy as np
import pandas as pd

from mirofish.agents.swarm_agent import (
    BUY,
    HOLD,
    SELL,
    HeuristicSentimentSimulator,
    SwarmAgent,
)
from mirofish.kronos_bridge import MiroFishKronosAdapter


@dataclass
class BacktestResult:
    label: str
    equity_curve: pd.Series
    period_returns: pd.Series
    positions: pd.Series
    n_trades: int
    periods_per_year: float
    theses: List[Dict[str, Any]] = field(default_factory=list)

    @property
    def total_return(self) -> float:
        return float(self.equity_curve.iloc[-1] / self.equity_curve.iloc[0] - 1.0)

    @property
    def sharpe(self) -> float:
        r = self.period_returns
        if len(r) < 2 or r.std(ddof=1) == 0:
            return 0.0
        return float(r.mean() / r.std(ddof=1) * math.sqrt(self.periods_per_year))

    @property
    def max_drawdown(self) -> float:
        curve = self.equity_curve
        peak = curve.cummax()
        return float((curve / peak - 1.0).min())

    @property
    def win_rate(self) -> float:
        active = self.period_returns[self.positions.shift(0) != 0]
        traded = active[active != 0]
        if len(traded) == 0:
            return 0.0
        return float((traded > 0).mean())

    def summary(self) -> Dict[str, float]:
        return {
            "total_return": self.total_return,
            "sharpe": self.sharpe,
            "max_drawdown": self.max_drawdown,
            "win_rate": self.win_rate,
            "n_trades": self.n_trades,
        }


def _momentum_signal(window_df: pd.DataFrame, lookback: int = 20) -> str:
    """Baseline: fast/slow moving-average crossover."""
    closes = window_df["close"]
    fast = closes.iloc[-lookback:].mean()
    slow = closes.iloc[-4 * lookback:].mean()
    if fast > slow * 1.001:
        return BUY
    if fast < slow * 0.999:
        return SELL
    return HOLD


def _periods_per_year(timestamps: pd.Series) -> float:
    step = pd.to_datetime(timestamps).diff().dropna().median()
    seconds = step.total_seconds()
    if seconds <= 0:
        return 252.0
    return 365.0 * 24 * 3600 / seconds


def run_backtest(
    prices: pd.DataFrame,
    use_kronos: bool,
    adapter: Optional[MiroFishKronosAdapter] = None,
    asset: str = "ASSET",
    lookback: int = 256,
    horizon: int = 24,
    step: int = 24,
    cost_bps: float = 5.0,
    buy_threshold: float = 0.02,
    sell_threshold: float = -0.02,
    allow_short: bool = True,
) -> BacktestResult:
    """Walk the price series forward, deciding a position every ``step`` bars.

    At each decision point the agent sees only history up to that bar.
    The position (+1 / 0 / -1) is held for the next ``step`` bars and
    transaction costs are charged on position changes.
    """
    prices = prices.copy()
    prices.columns = [str(c).lower() for c in prices.columns]
    ts_col = "timestamps" if "timestamps" in prices.columns else None
    timestamps = prices[ts_col] if ts_col else pd.Series(prices.index)

    if use_kronos:
        if adapter is None:
            raise ValueError("use_kronos=True requires an adapter")
        agent = SwarmAgent(
            asset=asset,
            kronos_bridge=adapter,
            sentiment_simulator=HeuristicSentimentSimulator(),
            buy_threshold=buy_threshold,
            sell_threshold=sell_threshold,
            pred_len=horizon,
        )

    decision_idx = list(range(lookback, len(prices) - step, step))
    if not decision_idx:
        raise ValueError("price series too short for the chosen lookback/step")

    positions, period_rets, index_out = [], [], []
    theses: List[Dict[str, Any]] = []
    position = 0.0
    n_trades = 0

    for i in decision_idx:
        window = prices.iloc[:i]
        if use_kronos:
            thesis = agent.decide_trade(window)
            action = thesis.action
            theses.append(thesis.to_dict())
        else:
            action = _momentum_signal(window)

        target = {BUY: 1.0, SELL: -1.0 if allow_short else 0.0, HOLD: 0.0}[action]
        cost = abs(target - position) * cost_bps / 10_000.0
        if target != position:
            n_trades += 1
        position = target

        entry = float(prices["close"].iloc[i - 1])
        exit_ = float(prices["close"].iloc[i + step - 1])
        period_rets.append(position * (exit_ / entry - 1.0) - cost)
        positions.append(position)
        index_out.append(timestamps.iloc[i - 1])

    period_returns = pd.Series(period_rets, index=index_out)
    equity = (1.0 + period_returns).cumprod()
    equity = pd.concat([pd.Series([1.0], index=[timestamps.iloc[lookback - 1]]), equity])

    # Sharpe is annualised from decision-period returns.
    ppy = _periods_per_year(timestamps) / step

    return BacktestResult(
        label="kronos" if use_kronos else "baseline",
        equity_curve=equity,
        period_returns=period_returns,
        positions=pd.Series(positions, index=index_out),
        n_trades=n_trades,
        periods_per_year=ppy,
        theses=theses,
    )


def compare_results(with_kronos: BacktestResult, baseline: BacktestResult) -> str:
    lines = [
        f"{'metric':<16}{'baseline':>12}{'kronos':>12}{'delta':>12}",
        "-" * 52,
    ]
    for key in ("total_return", "sharpe", "max_drawdown", "win_rate", "n_trades"):
        b = baseline.summary()[key]
        k = with_kronos.summary()[key]
        lines.append(f"{key:<16}{b:>12.4f}{k:>12.4f}{k - b:>12.4f}")
    return "\n".join(lines)


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--csv", help="OHLCV csv with a 'timestamps' column")
    parser.add_argument("--asset", default="ASSET")
    parser.add_argument("--lookback", type=int, default=256)
    parser.add_argument("--horizon", type=int, default=24)
    parser.add_argument("--step", type=int, default=24)
    parser.add_argument("--cost-bps", type=float, default=5.0)
    parser.add_argument(
        "--mock",
        action="store_true",
        help="use the torch-free mock predictor instead of real Kronos weights",
    )
    parser.add_argument("--kronos-repo", help="path to a local clone of the Kronos repo")
    args = parser.parse_args(argv)

    if args.csv:
        prices = pd.read_csv(args.csv)
    else:
        from mirofish.testing import make_synthetic_ohlcv

        print("No --csv supplied; using synthetic OHLCV data.")
        prices = make_synthetic_ohlcv(n_bars=1500)

    if args.mock:
        from mirofish.testing import MockKronosPredictor

        adapter = MiroFishKronosAdapter(
            predictor=MockKronosPredictor(), lookback=args.lookback, pred_len=args.horizon
        )
    else:
        adapter = MiroFishKronosAdapter(
            lookback=args.lookback,
            pred_len=args.horizon,
            kronos_repo_path=args.kronos_repo,
        )

    common = dict(
        asset=args.asset,
        lookback=args.lookback,
        horizon=args.horizon,
        step=args.step,
        cost_bps=args.cost_bps,
    )
    results_with_kronos = run_backtest(prices, use_kronos=True, adapter=adapter, **common)
    results_baseline = run_backtest(prices, use_kronos=False, **common)

    print(compare_results(results_with_kronos, results_baseline))
    print(
        f"\nSharpe improvement: "
        f"{results_with_kronos.sharpe - results_baseline.sharpe:+.4f}"
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
