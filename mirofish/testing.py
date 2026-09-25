"""Test doubles for the Kronos integration.

``MockKronosPredictor`` mirrors the exact call signatures of
``model.kronos.KronosPredictor.predict`` / ``predict_batch`` so the
adapter, agents and backtests can run without torch or model weights.
It forecasts a continuation of recent momentum plus deterministic noise,
which is enough to exercise every code path end-to-end.
"""

from __future__ import annotations

from typing import List, Optional

import numpy as np
import pandas as pd

OUTPUT_COLS = ["open", "high", "low", "close", "volume", "amount"]


class MockKronosPredictor:
    """Drop-in stand-in for KronosPredictor (no torch required)."""

    def __init__(self, momentum_window: int = 20, noise: float = 0.0, seed: int = 7):
        self.momentum_window = momentum_window
        self.noise = noise
        self.seed = seed

    def _forecast_one(
        self, df: pd.DataFrame, y_timestamp, pred_len: int
    ) -> pd.DataFrame:
        closes = df["close"].to_numpy(dtype=float)
        window = min(self.momentum_window, len(closes) - 1)
        drift = (closes[-1] / closes[-1 - window]) ** (1.0 / window) - 1.0

        rng = np.random.default_rng(self.seed + len(closes))
        last_close = closes[-1]
        vol = float(df["volume"].iloc[-1]) if "volume" in df.columns else 0.0

        rows = []
        price = last_close
        for _ in range(pred_len):
            step = drift + (rng.normal(0.0, self.noise) if self.noise else 0.0)
            new_price = price * (1.0 + step)
            high = max(price, new_price) * 1.001
            low = min(price, new_price) * 0.999
            rows.append([price, high, low, new_price, vol, vol * new_price])
            price = new_price

        index = pd.Index(pd.to_datetime(pd.Series(y_timestamp)))
        return pd.DataFrame(rows, columns=OUTPUT_COLS, index=index)

    # --- KronosPredictor-compatible surface -------------------------------
    def predict(
        self,
        df: pd.DataFrame,
        x_timestamp,
        y_timestamp,
        pred_len: int,
        T: float = 1.0,
        top_k: int = 0,
        top_p: float = 0.9,
        sample_count: int = 1,
        verbose: bool = True,
    ) -> pd.DataFrame:
        return self._forecast_one(df, y_timestamp, pred_len)

    def predict_batch(
        self,
        df_list: List[pd.DataFrame],
        x_timestamp_list,
        y_timestamp_list,
        pred_len: int,
        T: float = 1.0,
        top_k: int = 0,
        top_p: float = 0.9,
        sample_count: int = 1,
        verbose: bool = True,
    ) -> List[pd.DataFrame]:
        # Enforce the same batching contract as the real predictor.
        lengths = {len(df) for df in df_list}
        if len(lengths) != 1:
            raise ValueError(
                f"Parallel prediction requires consistent historical lengths, got {sorted(lengths)}"
            )
        return [
            self._forecast_one(df, y_ts, pred_len)
            for df, y_ts in zip(df_list, y_timestamp_list)
        ]


def make_synthetic_ohlcv(
    n_bars: int = 800,
    freq: str = "1h",
    start_price: float = 100.0,
    seed: int = 42,
    start: str = "2025-01-01",
    regime_period: Optional[int] = 200,
) -> pd.DataFrame:
    """Synthetic OHLCV with alternating drift regimes (trend + chop)."""
    rng = np.random.default_rng(seed)
    t = np.arange(n_bars)
    drift = 0.0008 * np.sin(2 * np.pi * t / regime_period) if regime_period else 0.0
    rets = drift + rng.normal(0.0, 0.004, size=n_bars)
    closes = start_price * np.exp(np.cumsum(rets))
    opens = np.concatenate([[start_price], closes[:-1]])
    highs = np.maximum(opens, closes) * (1 + np.abs(rng.normal(0, 0.001, n_bars)))
    lows = np.minimum(opens, closes) * (1 - np.abs(rng.normal(0, 0.001, n_bars)))
    volume = rng.uniform(1_000, 5_000, size=n_bars)
    return pd.DataFrame(
        {
            "timestamps": pd.date_range(start, periods=n_bars, freq=freq),
            "open": opens,
            "high": highs,
            "low": lows,
            "close": closes,
            "volume": volume,
            "amount": volume * closes,
        }
    )
