import pytest

from mirofish.backtest.run_kronos_backtest import (
    compare_results,
    main,
    run_backtest,
)
from mirofish.kronos_bridge import MiroFishKronosAdapter
from mirofish.testing import MockKronosPredictor, make_synthetic_ohlcv


@pytest.fixture(scope="module")
def prices():
    return make_synthetic_ohlcv(n_bars=900)


@pytest.fixture(scope="module")
def adapter():
    return MiroFishKronosAdapter(
        predictor=MockKronosPredictor(), lookback=256, pred_len=24
    )


def test_baseline_backtest_runs(prices):
    result = run_backtest(prices, use_kronos=False, lookback=256, horizon=24, step=24)
    s = result.summary()
    assert result.label == "baseline"
    assert len(result.equity_curve) == len(result.period_returns) + 1
    assert -1.0 <= s["max_drawdown"] <= 0.0
    assert 0.0 <= s["win_rate"] <= 1.0


def test_kronos_backtest_runs_and_records_theses(prices, adapter):
    result = run_backtest(
        prices, use_kronos=True, adapter=adapter, lookback=256, horizon=24, step=24
    )
    assert result.label == "kronos"
    assert len(result.theses) == len(result.period_returns)
    assert all("action" in t and "rationale" in t for t in result.theses)


def test_kronos_requires_adapter(prices):
    with pytest.raises(ValueError, match="requires an adapter"):
        run_backtest(prices, use_kronos=True, adapter=None)


def test_too_short_series_rejected(adapter):
    prices = make_synthetic_ohlcv(n_bars=100)
    with pytest.raises(ValueError, match="too short"):
        run_backtest(prices, use_kronos=True, adapter=adapter, lookback=256)


def test_costs_reduce_returns(prices, adapter):
    cheap = run_backtest(prices, use_kronos=True, adapter=adapter, cost_bps=0.0)
    pricey = run_backtest(prices, use_kronos=True, adapter=adapter, cost_bps=50.0)
    assert pricey.total_return <= cheap.total_return


def test_compare_results_output(prices, adapter):
    with_k = run_backtest(prices, use_kronos=True, adapter=adapter)
    base = run_backtest(prices, use_kronos=False)
    table = compare_results(with_k, base)
    assert "sharpe" in table
    assert "total_return" in table


def test_cli_mock_run(capsys):
    assert main(["--mock", "--lookback", "128", "--step", "48"]) == 0
    out = capsys.readouterr().out
    assert "Sharpe improvement:" in out
