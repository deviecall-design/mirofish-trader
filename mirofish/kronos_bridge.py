"""Bridge between MiroFish and the Kronos K-line foundation model.

Kronos (https://github.com/shiyu-coder/Kronos) is used strictly as a
library: pre-trained weights are pulled from HuggingFace and wrapped by
``KronosPredictor``. This module adapts MiroFish's per-asset OHLCV frames
to the shapes Kronos expects and returns forecast frames keyed by asset.

The heavy dependencies (torch, the Kronos repo itself) are imported
lazily, so this module — and everything that depends on it — can be
imported, unit-tested and backtested with a stand-in predictor on
machines that don't have torch or the model weights installed.
"""

from __future__ import annotations

import os
import sys
from typing import Dict, Mapping, Optional, Tuple

import numpy as np
import pandas as pd

DEFAULT_TOKENIZER_ID = "NeoQuasar/Kronos-Tokenizer-base"
DEFAULT_MODEL_ID = "NeoQuasar/Kronos-base"

PRICE_COLS = ["open", "high", "low", "close"]


class KronosNotAvailableError(ImportError):
    """Raised when the Kronos library cannot be imported."""


def _load_kronos_classes(kronos_repo_path: Optional[str] = None):
    """Import Kronos classes, optionally from a local clone of the repo."""
    search_path = kronos_repo_path or os.environ.get("KRONOS_REPO_PATH")
    if search_path and search_path not in sys.path:
        sys.path.insert(0, search_path)
    try:
        from model import Kronos, KronosPredictor, KronosTokenizer  # type: ignore
    except ImportError as exc:
        raise KronosNotAvailableError(
            "Could not import the Kronos library. Clone "
            "https://github.com/shiyu-coder/Kronos and either pass "
            "kronos_repo_path=... to MiroFishKronosAdapter or set the "
            "KRONOS_REPO_PATH environment variable to the clone's root. "
            "Kronos also requires torch>=2.0 (see its requirements.txt)."
        ) from exc
    return Kronos, KronosTokenizer, KronosPredictor


class MiroFishKronosAdapter:
    """Wraps ``KronosPredictor`` for MiroFish portfolio forecasting.

    Parameters
    ----------
    predictor:
        An object exposing Kronos's ``predict`` / ``predict_batch``
        signatures. When omitted, the real pre-trained Kronos model is
        loaded lazily from HuggingFace on first use.
    lookback:
        Maximum number of trailing bars fed to the model as context.
        Kronos-base was trained with a 512-token context, so the default
        of 400 leaves headroom, matching the upstream examples.
    pred_len:
        Default forecast horizon in bars.
    """

    def __init__(
        self,
        predictor=None,
        tokenizer_id: str = DEFAULT_TOKENIZER_ID,
        model_id: str = DEFAULT_MODEL_ID,
        device: Optional[str] = None,
        max_context: int = 512,
        lookback: int = 400,
        pred_len: int = 24,
        temperature: float = 1.0,
        top_k: int = 0,
        top_p: float = 0.9,
        sample_count: int = 1,
        kronos_repo_path: Optional[str] = None,
        verbose: bool = False,
    ):
        if lookback < 16:
            raise ValueError("lookback must be at least 16 bars")
        if pred_len < 1:
            raise ValueError("pred_len must be at least 1 bar")
        self._predictor = predictor
        self.tokenizer_id = tokenizer_id
        self.model_id = model_id
        self.device = device
        self.max_context = max_context
        self.lookback = lookback
        self.pred_len = pred_len
        self.temperature = temperature
        self.top_k = top_k
        self.top_p = top_p
        self.sample_count = sample_count
        self.kronos_repo_path = kronos_repo_path
        self.verbose = verbose

    # ------------------------------------------------------------------
    # Model loading
    # ------------------------------------------------------------------
    @property
    def predictor(self):
        if self._predictor is None:
            Kronos, KronosTokenizer, KronosPredictor = _load_kronos_classes(
                self.kronos_repo_path
            )
            tokenizer = KronosTokenizer.from_pretrained(self.tokenizer_id)
            model = Kronos.from_pretrained(self.model_id)
            self._predictor = KronosPredictor(
                model, tokenizer, device=self.device, max_context=self.max_context
            )
        return self._predictor

    # ------------------------------------------------------------------
    # Data preparation
    # ------------------------------------------------------------------
    @staticmethod
    def _normalise_frame(df: pd.DataFrame) -> Tuple[pd.DataFrame, pd.Series]:
        """Return (ohlcv frame, timestamp series) with canonical columns.

        Accepts timestamps either as a ``timestamps``/``timestamp``/``date``
        column or as a DatetimeIndex.
        """
        if not isinstance(df, pd.DataFrame):
            raise ValueError("expected a pandas DataFrame of OHLCV bars")
        frame = df.copy()
        frame.columns = [str(c).lower() for c in frame.columns]

        ts = None
        for col in ("timestamps", "timestamp", "date", "datetime", "time"):
            if col in frame.columns:
                ts = pd.to_datetime(frame[col])
                frame = frame.drop(columns=[col])
                break
        if ts is None:
            if isinstance(frame.index, pd.DatetimeIndex):
                ts = pd.Series(frame.index)
            else:
                raise ValueError(
                    "OHLCV frame needs a 'timestamps' column or a DatetimeIndex"
                )

        missing = [c for c in PRICE_COLS if c not in frame.columns]
        if missing:
            raise ValueError(f"OHLCV frame is missing price columns: {missing}")

        keep = [c for c in PRICE_COLS + ["volume", "amount"] if c in frame.columns]
        frame = frame[keep].reset_index(drop=True).astype(float)
        ts = ts.reset_index(drop=True)

        if frame[keep].isnull().values.any():
            raise ValueError("OHLCV frame contains NaN values")
        return frame, ts

    @staticmethod
    def _future_timestamps(x_ts: pd.Series, pred_len: int) -> pd.Series:
        """Extrapolate pred_len future bar timestamps from the history."""
        if len(x_ts) < 2:
            raise ValueError("need at least 2 timestamps to infer bar interval")
        step = x_ts.diff().dropna().median()
        if pd.isna(step) or step <= pd.Timedelta(0):
            raise ValueError("could not infer a positive bar interval")
        last = x_ts.iloc[-1]
        return pd.Series([last + step * (i + 1) for i in range(pred_len)])

    def _prepare(
        self, df: pd.DataFrame, lookback: int, pred_len: int
    ) -> Tuple[pd.DataFrame, pd.Series, pd.Series]:
        frame, ts = self._normalise_frame(df)
        if len(frame) < 16:
            raise ValueError(f"need at least 16 bars of history, got {len(frame)}")
        frame = frame.iloc[-lookback:].reset_index(drop=True)
        ts = ts.iloc[-lookback:].reset_index(drop=True)
        y_ts = self._future_timestamps(ts, pred_len)
        return frame, ts, y_ts

    # ------------------------------------------------------------------
    # Forecasting
    # ------------------------------------------------------------------
    def forecast_single(
        self, asset: str, df: pd.DataFrame, pred_len: Optional[int] = None
    ) -> pd.DataFrame:
        """Forecast one asset. Returns a frame of OHLCV(+amount) bars
        indexed by future timestamps."""
        pred_len = pred_len or self.pred_len
        frame, x_ts, y_ts = self._prepare(df, self.lookback, pred_len)
        forecast = self.predictor.predict(
            df=frame,
            x_timestamp=x_ts,
            y_timestamp=y_ts,
            pred_len=pred_len,
            T=self.temperature,
            top_k=self.top_k,
            top_p=self.top_p,
            sample_count=self.sample_count,
            verbose=self.verbose,
        )
        forecast.attrs["asset"] = asset
        return forecast

    def forecast_portfolio(
        self,
        assets_dict: Mapping[str, pd.DataFrame],
        pred_len: Optional[int] = None,
    ) -> Dict[str, pd.DataFrame]:
        """Forecast a whole portfolio in one batched Kronos call.

        Takes ``{"BTC": df1, "ETH": df2, ...}`` and returns
        ``{"BTC": forecast_df1, ...}``.

        Kronos's ``predict_batch`` requires every series in the batch to
        share the same history length, so all series are truncated to the
        shortest available history (capped at ``self.lookback``).
        """
        if not assets_dict:
            return {}
        pred_len = pred_len or self.pred_len

        normalised = {
            asset: self._normalise_frame(df) for asset, df in assets_dict.items()
        }
        shortest = min(len(frame) for frame, _ in normalised.values())
        effective_lookback = min(self.lookback, shortest)
        if effective_lookback < 16:
            raise ValueError(
                f"shortest series has only {shortest} bars; need at least 16"
            )

        assets, df_list, x_ts_list, y_ts_list = [], [], [], []
        for asset, (frame, ts) in normalised.items():
            frame = frame.iloc[-effective_lookback:].reset_index(drop=True)
            ts = ts.iloc[-effective_lookback:].reset_index(drop=True)
            assets.append(asset)
            df_list.append(frame)
            x_ts_list.append(ts)
            y_ts_list.append(self._future_timestamps(ts, pred_len))

        forecasts = self.predictor.predict_batch(
            df_list=df_list,
            x_timestamp_list=x_ts_list,
            y_timestamp_list=y_ts_list,
            pred_len=pred_len,
            T=self.temperature,
            top_k=self.top_k,
            top_p=self.top_p,
            sample_count=self.sample_count,
            verbose=self.verbose,
        )

        result: Dict[str, pd.DataFrame] = {}
        for asset, forecast in zip(assets, forecasts):
            forecast.attrs["asset"] = asset
            result[asset] = forecast
        return result

    # ------------------------------------------------------------------
    # Signal helpers
    # ------------------------------------------------------------------
    @staticmethod
    def expected_return(history_df: pd.DataFrame, forecast_df: pd.DataFrame) -> float:
        """Fractional expected return: forecast end close vs last known close."""
        history_df = history_df.copy()
        history_df.columns = [str(c).lower() for c in history_df.columns]
        current = float(history_df["close"].iloc[-1])
        predicted = float(forecast_df["close"].iloc[-1])
        if current <= 0:
            raise ValueError("last close must be positive")
        return (predicted - current) / current
