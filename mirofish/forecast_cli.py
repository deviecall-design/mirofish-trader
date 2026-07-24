"""CLI entry point: forecast one asset's OHLCV history with Kronos.

Exists so a Node process (app/api/cron/swarm/route.ts) can get a Kronos
forecast without a long-lived Python service — one subprocess call per
symbol per cron run.

Stdin
-----
JSON: {"bars": [{"timestamp": "...", "open": .., "high": .., "low": ..,
                 "close": .., "volume": ..}, ...]}

Stdout
------
JSON forecast summary on success::

    {"current_price": .., "predicted_close": .., "predicted_low": ..,
     "predicted_high": .., "expected_return": .., "horizon_bars": ..,
     "horizon": ".."}

or ``{"error": "..."}`` with a non-zero exit code on failure.

Usage
-----
    python -m mirofish.forecast_cli --asset BTC < bars.json
    python -m mirofish.forecast_cli --asset BTC --mock < bars.json
"""

from __future__ import annotations

import argparse
import json
import sys
from typing import List, Optional

import pandas as pd

from mirofish.agents.swarm_agent import SwarmAgent
from mirofish.kronos_bridge import MiroFishKronosAdapter


def main(argv: Optional[List[str]] = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--asset", required=True)
    parser.add_argument("--pred-len", type=int, default=24)
    parser.add_argument("--lookback", type=int, default=256)
    parser.add_argument("--kronos-repo", help="path to a local clone of the Kronos repo")
    parser.add_argument(
        "--mock",
        action="store_true",
        help="use the torch-free mock predictor instead of real Kronos weights",
    )
    args = parser.parse_args(argv)

    try:
        payload = json.load(sys.stdin)
        bars = payload["bars"]
        if len(bars) < 16:
            raise ValueError(f"need at least 16 bars of history, got {len(bars)}")
        df = pd.DataFrame(bars)

        if args.mock:
            from mirofish.testing import MockKronosPredictor

            adapter = MiroFishKronosAdapter(
                predictor=MockKronosPredictor(), lookback=args.lookback, pred_len=args.pred_len
            )
        else:
            adapter = MiroFishKronosAdapter(
                lookback=args.lookback,
                pred_len=args.pred_len,
                kronos_repo_path=args.kronos_repo,
            )

        agent = SwarmAgent(args.asset, adapter, pred_len=args.pred_len)
        forecast = adapter.forecast_single(args.asset, df, pred_len=args.pred_len)
        summary = agent.summarise_forecast(df, forecast)
    except Exception as exc:  # noqa: BLE001 - surface any failure to the caller as JSON
        json.dump({"error": str(exc)}, sys.stdout)
        return 1

    json.dump(summary, sys.stdout)
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
