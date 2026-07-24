// Shared trading constants — used by the cron scan (paper closes) and the
// broker execution layer (exchange-side OCO exits). Keep in one place so
// paper and real exits can't drift apart.

export const MOVE_THRESHOLD_PCT = 2;
export const TAKE_PROFIT_PCT = 5;
export const STOP_LOSS_PCT = -3;

// SwarmAgent / Kronos forecast config — combines a Kronos price forecast
// with MiroFish swarm sentiment into a BUY/SELL/HOLD trade thesis. Mirrors
// mirofish/agents/swarm_agent.py's SwarmAgent defaults so the live cron
// route and the Python backtest agree.
export const KRONOS_BUY_THRESHOLD_PCT = 2;
export const KRONOS_SELL_THRESHOLD_PCT = -2;
export const KRONOS_MIN_CONVICTION = 0.3;
export const KRONOS_PRED_LEN = 24;
export const KRONOS_LOOKBACK_BARS = 256;
export const KRONOS_FORECAST_TIMEOUT_MS = 30000;
