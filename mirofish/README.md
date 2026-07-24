# MiroFish × Kronos — forecast-driven trade theses

Bridges the [Kronos](https://github.com/shiyu-coder/Kronos) K-line
foundation model (price forecasting) with the MiroFish swarm engine
(sentiment simulation):

```
Kronos                        MiroFish                    Decision
(price forecast)              (sentiment sim)             (thesis)
   |                              |                          |
"BTC +8% in 24h"     ->    simulate how retail    ->   price target +
 (via OHLCV model)          reacts to forecast          sentiment conviction
                                                        = trade thesis
```

Kronos is used **as a library** — pre-trained weights come straight from
HuggingFace (`NeoQuasar/Kronos-Tokenizer-base` + `NeoQuasar/Kronos-base`);
nothing is reimplemented.

## Layout

| Module | Purpose |
|---|---|
| `kronos_bridge.py` | `MiroFishKronosAdapter` — wraps `KronosPredictor`, handles timestamp extrapolation, batch alignment, portfolio forecasting |
| `agents/swarm_agent.py` | `SwarmAgent.decide_trade()` — combines the Kronos forecast with swarm sentiment into a `TradeThesis` (BUY/SELL/HOLD + confidence + rationale) |
| `backtest/run_kronos_backtest.py` | Walk-forward backtest, Kronos agent vs momentum baseline (Sharpe / return / drawdown / win-rate comparison) |
| `testing.py` | `MockKronosPredictor` (torch-free stand-in) + synthetic OHLCV generator |

## Quick start (no GPU / torch needed)

```bash
pip install -r mirofish/requirements.txt
python -m pytest mirofish/tests -q
python -m mirofish.backtest.run_kronos_backtest --mock
```

## Using the real Kronos model

```bash
git clone https://github.com/shiyu-coder/Kronos ~/projects/kronos
pip install -r ~/projects/kronos/requirements.txt
export KRONOS_REPO_PATH=~/projects/kronos
```

```python
from mirofish.kronos_bridge import MiroFishKronosAdapter
from mirofish.agents.swarm_agent import SwarmAgent, MiroFishSwarmSentimentSimulator

adapter = MiroFishKronosAdapter()          # loads HF weights lazily on first call

# Portfolio forecasting: {asset: OHLCV df} -> {asset: forecast df}
forecasts = adapter.forecast_portfolio({"BTC": btc_df, "ETH": eth_df}, pred_len=24)

# Single-asset trade thesis
agent = SwarmAgent("BTC", adapter)
thesis = agent.decide_trade(btc_df)
print(thesis.action, thesis.price_target, thesis.confidence, thesis.rationale)
```

Input frames need `open/high/low/close` (+ optional `volume`) and either a
`timestamps` column or a `DatetimeIndex`. Future bar timestamps for the
forecast horizon are extrapolated from the median bar interval.

## Wiring in the real swarm

`MiroFishSwarmSentimentSimulator` renders the forecast as MiroFish **seed
material** (`build_seed_material`) — a market-signal bulletin the simulated
agents react to — and delegates the actual run to an injected callable
(e.g. a client for the MiroFish backend simulation API). Because a full
swarm run spins up an OASIS LLM-agent world, backtests default to a cheap
deterministic `HeuristicSentimentSimulator`; swap in the real swarm for
live, low-frequency decisions.

## Backtest

```bash
# synthetic data + mock forecaster (fast sanity check)
python -m mirofish.backtest.run_kronos_backtest --mock

# your data + real Kronos weights
KRONOS_REPO_PATH=~/projects/kronos \
python -m mirofish.backtest.run_kronos_backtest --csv data/BTCUSDT_1h.csv --asset BTC
```

Walk-forward: at each step the agent sees only past bars, holds the chosen
position (+1/0/−1) for `--step` bars, and pays `--cost-bps` on position
changes. Output compares total return, annualised Sharpe, max drawdown,
win rate and trade count against the momentum baseline, ending with the
headline `Sharpe improvement`.
