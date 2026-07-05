// Pre-order risk guard. Every real (testnet or live) order must pass
// checkOrder before it is sent to a broker — no exceptions.

export interface OrderIntent {
  symbol: string;
  side: "BUY" | "SELL";
  notionalUsd: number;
}

export interface RiskState {
  openPositions: number; // open non-paper trades
  todayRealizedPnlUsd: number; // realized non-paper PnL since midnight UTC
}

export interface RiskConfig {
  killSwitch: boolean;
  maxPositionUsd: number;
  maxOpenPositions: number;
  dailyLossLimitUsd: number;
}

export type RiskVerdict = { allowed: true } | { allowed: false; reason: string };

export function riskConfigFromEnv(): RiskConfig {
  return {
    killSwitch: process.env.KILL_SWITCH === "true",
    maxPositionUsd: numeric(process.env.MAX_POSITION_USD, 100),
    maxOpenPositions: numeric(process.env.MAX_OPEN_POSITIONS, 3),
    dailyLossLimitUsd: numeric(process.env.DAILY_LOSS_LIMIT_USD, 50),
  };
}

export function checkOrder(
  intent: OrderIntent,
  state: RiskState,
  cfg: RiskConfig = riskConfigFromEnv()
): RiskVerdict {
  if (cfg.killSwitch) {
    return { allowed: false, reason: "kill switch is on (KILL_SWITCH=true)" };
  }
  if (!(intent.notionalUsd > 0)) {
    return { allowed: false, reason: "order notional must be positive" };
  }
  if (intent.notionalUsd > cfg.maxPositionUsd) {
    return {
      allowed: false,
      reason: `order $${intent.notionalUsd} exceeds max position size $${cfg.maxPositionUsd}`,
    };
  }
  if (state.openPositions >= cfg.maxOpenPositions) {
    return {
      allowed: false,
      reason: `max open positions reached (${state.openPositions}/${cfg.maxOpenPositions})`,
    };
  }
  if (state.todayRealizedPnlUsd <= -cfg.dailyLossLimitUsd) {
    return {
      allowed: false,
      reason: `daily loss limit hit ($${state.todayRealizedPnlUsd.toFixed(2)} today, limit $${cfg.dailyLossLimitUsd})`,
    };
  }
  return { allowed: true };
}

function numeric(value: string | undefined, fallback: number): number {
  const n = parseFloat(value ?? "");
  return Number.isFinite(n) && n > 0 ? n : fallback;
}
