import numpy as np
import pandas as pd
import pytest

from mirofish.kronos_bridge import KronosNotAvailableError, MiroFishKronosAdapter
from mirofish.testing import MockKronosPredictor, make_synthetic_ohlcv


@pytest.fixture
def adapter():
    return MiroFishKronosAdapter(
        predictor=MockKronosPredictor(), lookback=200, pred_len=12
    )


def test_forecast_single_shape_and_columns(adapter):
    df = make_synthetic_ohlcv(n_bars=300)
    forecast = adapter.forecast_single("BTC", df)
    assert len(forecast) == 12
    for col in ("open", "high", "low", "close", "volume", "amount"):
        assert col in forecast.columns
    assert forecast.attrs["asset"] == "BTC"


def test_forecast_single_future_timestamps_extend_history(adapter):
    df = make_synthetic_ohlcv(n_bars=300, freq="1h")
    forecast = adapter.forecast_single("BTC", df)
    last_hist = pd.to_datetime(df["timestamps"].iloc[-1])
    assert forecast.index[0] == last_hist + pd.Timedelta(hours=1)
    assert forecast.index[-1] == last_hist + pd.Timedelta(hours=12)


def test_forecast_portfolio_returns_all_assets(adapter):
    assets = {
        "BTC": make_synthetic_ohlcv(n_bars=300, seed=1),
        "ETH": make_synthetic_ohlcv(n_bars=280, seed=2),
        "SOL": make_synthetic_ohlcv(n_bars=260, seed=3),
    }
    forecasts = adapter.forecast_portfolio(assets)
    assert set(forecasts) == {"BTC", "ETH", "SOL"}
    for asset, forecast in forecasts.items():
        assert len(forecast) == 12
        assert forecast.attrs["asset"] == asset


def test_forecast_portfolio_aligns_uneven_histories(adapter):
    # predict_batch requires equal lengths; the adapter must truncate.
    assets = {
        "LONG": make_synthetic_ohlcv(n_bars=500, seed=1),
        "SHORT": make_synthetic_ohlcv(n_bars=60, seed=2),
    }
    forecasts = adapter.forecast_portfolio(assets)
    assert set(forecasts) == {"LONG", "SHORT"}


def test_forecast_portfolio_empty_dict(adapter):
    assert adapter.forecast_portfolio({}) == {}


def test_datetime_index_accepted(adapter):
    df = make_synthetic_ohlcv(n_bars=100).set_index("timestamps")
    forecast = adapter.forecast_single("BTC", df)
    assert len(forecast) == 12


def test_missing_price_columns_rejected(adapter):
    df = pd.DataFrame(
        {"timestamps": pd.date_range("2025-01-01", periods=50, freq="1h"),
         "close": np.linspace(100, 110, 50)}
    )
    with pytest.raises(ValueError, match="missing price columns"):
        adapter.forecast_single("BTC", df)


def test_nan_rejected(adapter):
    df = make_synthetic_ohlcv(n_bars=100)
    df.loc[10, "close"] = np.nan
    with pytest.raises(ValueError, match="NaN"):
        adapter.forecast_single("BTC", df)


def test_too_short_history_rejected(adapter):
    df = make_synthetic_ohlcv(n_bars=8)
    with pytest.raises(ValueError, match="at least 16 bars"):
        adapter.forecast_single("BTC", df)


def test_expected_return():
    history = make_synthetic_ohlcv(n_bars=50)
    forecast = pd.DataFrame({"close": [history["close"].iloc[-1] * 1.05]})
    er = MiroFishKronosAdapter.expected_return(history, forecast)
    assert er == pytest.approx(0.05)


def test_lazy_load_error_message_without_kronos():
    adapter = MiroFishKronosAdapter(kronos_repo_path="/nonexistent/kronos")
    df = make_synthetic_ohlcv(n_bars=100)
    with pytest.raises(KronosNotAvailableError, match="KRONOS_REPO_PATH"):
        adapter.forecast_single("BTC", df)
