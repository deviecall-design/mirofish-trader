#!/usr/bin/env python3
"""Validation gate: walk-forward backtest SwarmAgent (Kronos + sentiment)
across one or more assets and fail (non-zero exit) if it doesn't clear
minimum performance thresholds.

Unlike mirofish/backtest/run_kronos_backtest.py (which backtests a single
--csv and just prints a comparison), this fetches real market data for
each --symbols entry itself and is meant to run in CI / before shipping a
SwarmAgent change live: pass/fail thresholds per asset, aggregate
PASS/FAIL summary, exit code reflects the result.

Usage
-----
Validate against real market data + the real pre-trained Kronos model::

    export KRONOS_REPO_PATH=~/projects/kronos
    python scripts/validate-kronos-backtest.py \\
        --symbols BTC,NVDA,ASML --days 90 \\
        --min-sharpe 2.0 --max-drawdown -15 --min-trades 10

Dry run against synthetic data with the torch-free mock predictor (no
network, no torch, no model weights) — useful for testing this script
itself::

    python scripts/validate-kronos-backtest.py --symbols BTC --mock --synthetic \\
        --min-sharpe 0 --max-drawdown -100 --min-trades 0

Crypto symbols (BTC, ETH) are pulled from Binance; anything else is
treated as an equity ticker and pulled from Yahoo Finance. Both are the
same public, unauthenticated endpoints app/lib/prices.ts uses.
"""

from __future__ import annotations

import argparse
import json
import os
import sys
import urllib.request
from dataclasses import dataclass, field
from typing import Any, Dict, List, Optional
from urllib.error import URLError

# Running this file directly (`python scripts/validate-kronos-backtest.py`)
# puts scripts/ on sys.path, not the repo root — add the root so `mirofish`
# is importable without installing the package.
sys.path.insert(0, os.path.abspath(os.path.join(os.path.dirname(__file__), "..")))

import pandas as pd  # noqa: E402

from mirofish.backtest.run_kronos_backtest import (  # noqa: E402
    BacktestResult,
    compare_results,
    run_backtest,
)
from mirofish.kronos_bridge import MiroFishKronosAdapter  # noqa: E402

CRYPTO_PAIRS = {"BTC": "BTCUSDT", "ETH": "ETHUSDT"}
YAHOO_USER_AGENT = (
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/120.0 Safari/537.36"
)


def is_crypto(symbol: str) -> bool:
    return symbol.upper() in CRYPTO_PAIRS


def _http_get_json(url: str, headers: Optional[Dict[str, str]] = None) -> Any:
    req = urllib.request.Request(url, headers=headers or {})
    with urllib.request.urlopen(req, timeout=20) as resp:
        return json.loads(resp.read().decode("utf-8"))


def _pick_crypto_interval(days: int) -> tuple[str, int]:
    """Coarsest Binance kline interval that keeps the request under the
    1000-bar API limit for the requested day range."""
    for interval, seconds in (("1h", 3_600), ("4h", 14_400), ("1d", 86_400)):
        bars_needed = int(days * 86_400 / seconds) + 1
        if bars_needed <= 1000:
            return interval, bars_needed
    return "1d", min(int(days) + 1, 1000)


def fetch_crypto_history(symbol: str, days: int) -> pd.DataFrame:
    pair = CRYPTO_PAIRS[symbol.upper()]
    interval, bars_needed = _pick_crypto_interval(days)
    limit = min(bars_needed, 1000)
    url = (
        f"https://api.binance.com/api/v3/klines?symbol={pair}"
        f"&interval={interval}&limit={limit}"
    )
    data = _http_get_json(url)
    rows = [
        {
            "timestamps": pd.Timestamp(k[0], unit="ms"),
            "open": float(k[1]),
            "high": float(k[2]),
            "low": float(k[3]),
            "close": float(k[4]),
            "volume": float(k[5]),
        }
        for k in data
    ]
    return pd.DataFrame(rows)


def fetch_equity_history(symbol: str, days: int) -> pd.DataFrame:
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        f"?interval=1d&range={max(int(days), 1)}d"
    )
    data = _http_get_json(url, headers={"User-Agent": YAHOO_USER_AGENT})
    result = (data.get("chart") or {}).get("result") or [None]
    result = result[0]
    if not result:
        raise ValueError(f"Yahoo Finance returned no chart data for {symbol}")
    timestamps = result.get("timestamp") or []
    quote = ((result.get("indicators") or {}).get("quote") or [None])[0]
    if not timestamps or not quote:
        raise ValueError(f"Yahoo Finance chart response missing OHLCV for {symbol}")

    rows = []
    for i, ts in enumerate(timestamps):
        o, h, l, c, v = (quote.get(k, [None] * len(timestamps))[i] for k in ("open", "high", "low", "close", "volume"))
        if o is None or h is None or l is None or c is None:
            continue
        rows.append(
            {
                "timestamps": pd.Timestamp(ts, unit="s"),
                "open": o,
                "high": h,
                "low": l,
                "close": c,
                "volume": v or 0.0,
            }
        )
    return pd.DataFrame(rows)


def fetch_history(symbol: str, days: int) -> pd.DataFrame:
    return fetch_crypto_history(symbol, days) if is_crypto(symbol) else fetch_equity_history(symbol, days)


@dataclass
class Thresholds:
    min_sharpe: float
    max_drawdown_pct: float  # e.g. -15.0 means "no worse than -15%"
    min_trades: int


@dataclass
class ValidationOutcome:
    symbol: str
    passed: bool
    checks: List[str] = field(default_factory=list)
    kronos: Dict[str, float] = field(default_factory=dict)
    baseline: Dict[str, float] = field(default_factory=dict)


def _check(checks: List[str], label: str, ok: bool, detail: str) -> bool:
    checks.append(f"[{'PASS' if ok else 'FAIL'}] {label}: {detail}")
    return ok


def validate_symbol(
    symbol: str,
    prices: pd.DataFrame,
    backtest_kwargs: Dict[str, Any],
    thresholds: Thresholds,
    mock: bool,
    kronos_repo: Optional[str],
) -> ValidationOutcome:
    min_bars = backtest_kwargs["lookback"] + backtest_kwargs["horizon"] + backtest_kwargs["step"]
    if len(prices) <= min_bars:
        return ValidationOutcome(
            symbol,
            passed=False,
            checks=[
                f"[FAIL] data: fetched {len(prices)} bars, need > {min_bars} "
                f"(lookback {backtest_kwargs['lookback']} + horizon {backtest_kwargs['horizon']} "
                f"+ step {backtest_kwargs['step']}) — increase --days or lower --lookback/--horizon/--step"
            ],
        )

    if mock:
        from mirofish.testing import MockKronosPredictor

        adapter = MiroFishKronosAdapter(
            predictor=MockKronosPredictor(),
            lookback=backtest_kwargs["lookback"],
            pred_len=backtest_kwargs["horizon"],
        )
    else:
        adapter = MiroFishKronosAdapter(
            lookback=backtest_kwargs["lookback"],
            pred_len=backtest_kwargs["horizon"],
            kronos_repo_path=kronos_repo,
        )

    kronos_result = run_backtest(prices, use_kronos=True, adapter=adapter, asset=symbol, **backtest_kwargs)
    baseline_result = run_backtest(prices, use_kronos=False, asset=symbol, **backtest_kwargs)

    print(f"\n=== {symbol} ({len(prices)} bars) ===")
    print(compare_results(kronos_result, baseline_result))

    checks: List[str] = []
    passed = True
    passed &= _check(
        checks,
        "sharpe",
        kronos_result.sharpe >= thresholds.min_sharpe,
        f"{kronos_result.sharpe:.4f} >= {thresholds.min_sharpe:.4f}",
    )
    max_dd_pct = kronos_result.max_drawdown * 100
    passed &= _check(
        checks,
        "max_drawdown",
        max_dd_pct >= thresholds.max_drawdown_pct,
        f"{max_dd_pct:.2f}% >= {thresholds.max_drawdown_pct:.2f}%",
    )
    passed &= _check(
        checks,
        "min_trades",
        kronos_result.n_trades >= thresholds.min_trades,
        f"{kronos_result.n_trades} >= {thresholds.min_trades}",
    )

    for line in checks:
        print(line)

    return ValidationOutcome(
        symbol, bool(passed), checks, kronos_result.summary(), baseline_result.summary()
    )


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(
        description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter
    )
    parser.add_argument("--symbols", required=True, help="comma-separated, e.g. BTC,NVDA,ASML")
    parser.add_argument(
        "--days", type=int, default=90, help="calendar days of history to fetch per symbol"
    )
    parser.add_argument("--min-sharpe", type=float, default=0.0)
    parser.add_argument(
        "--max-drawdown",
        type=float,
        default=-100.0,
        help="percent; e.g. -15 means the backtest must not draw down worse than -15%%",
    )
    parser.add_argument("--min-trades", type=int, default=0)
    parser.add_argument("--lookback", type=int, default=256)
    parser.add_argument("--horizon", type=int, default=24)
    parser.add_argument("--step", type=int, default=24)
    parser.add_argument("--cost-bps", type=float, default=5.0)
    parser.add_argument(
        "--kronos-repo", help="path to a local clone of the Kronos repo (or set KRONOS_REPO_PATH)"
    )
    parser.add_argument(
        "--mock", action="store_true", help="use the torch-free mock predictor instead of real Kronos weights"
    )
    parser.add_argument(
        "--synthetic",
        action="store_true",
        help="use synthetic OHLCV instead of fetching real market data (offline dry run)",
    )
    args = parser.parse_args(argv)

    symbols = [s.strip().upper() for s in args.symbols.split(",") if s.strip()]
    if not symbols:
        print("error: --symbols produced no valid tickers", file=sys.stderr)
        return 2

    thresholds = Thresholds(args.min_sharpe, args.max_drawdown, args.min_trades)
    backtest_kwargs = dict(
        lookback=args.lookback, horizon=args.horizon, step=args.step, cost_bps=args.cost_bps
    )

    outcomes: List[ValidationOutcome] = []
    for symbol in symbols:
        try:
            if args.synthetic:
                from mirofish.testing import make_synthetic_ohlcv

                prices = make_synthetic_ohlcv(
                    n_bars=max(args.days, args.lookback + args.horizon + args.step + 50)
                )
            else:
                prices = fetch_history(symbol, args.days)
        except (URLError, ValueError, KeyError, TimeoutError) as exc:
            print(f"[{symbol}] failed to fetch history: {exc}", file=sys.stderr)
            outcomes.append(ValidationOutcome(symbol, False, [f"[FAIL] data: {exc}"]))
            continue

        try:
            outcome = validate_symbol(
                symbol, prices, backtest_kwargs, thresholds, args.mock, args.kronos_repo
            )
        except Exception as exc:  # noqa: BLE001 - surface any backtest failure as a validation failure
            print(f"[{symbol}] backtest failed: {exc}", file=sys.stderr)
            outcome = ValidationOutcome(symbol, False, [f"[FAIL] backtest: {exc}"])
        outcomes.append(outcome)

    print("\n=== Summary ===")
    for o in outcomes:
        print(f"{o.symbol}: {'PASS' if o.passed else 'FAIL'}")

    overall_pass = all(o.passed for o in outcomes)
    n_passed = sum(o.passed for o in outcomes)
    print(f"\nResult: {'PASS' if overall_pass else 'FAIL'} ({n_passed}/{len(outcomes)} symbols passed)")
    return 0 if overall_pass else 1


if __name__ == "__main__":
    raise SystemExit(main())
