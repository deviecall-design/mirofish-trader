// Shared trading constants — used by the cron scan (paper closes) and the
// broker execution layer (exchange-side OCO exits). Keep in one place so
// paper and real exits can't drift apart.

export const MOVE_THRESHOLD_PCT = 2;
export const TAKE_PROFIT_PCT = 5;
export const STOP_LOSS_PCT = -3;
