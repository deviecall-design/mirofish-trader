// Entry execution: decides paper vs real (Binance testnet/live), enforces the
// risk guard, and places market entry + OCO exit at the exchange.

import { supabase, type Direction, type TradeMode } from "./supabase";
import { fetchPrice } from "./prices";
import { binanceBroker } from "./brokers/binance";
import type { PlacedOrder } from "./brokers/types";
import { checkOrder, riskConfigFromEnv } from "./risk";
import { TAKE_PROFIT_PCT, STOP_LOSS_PCT } from "./constants";

export class RiskRejectionError extends Error {}

export interface ExecutionResult {
  executed: boolean;
  mode: TradeMode;
  entryPrice: number;
  qty: number;
  reason?: string;
  entryOrder?: PlacedOrder;
  exitOrder?: PlacedOrder;
}

export function executionMode(): TradeMode {
  if (process.env.EXECUTION_ENABLED !== "true") return "paper";
  return process.env.BINANCE_TESTNET === "false" ? "live" : "testnet";
}

// Realized non-paper PnL today, in USD. trades.pnl is a percentage; each real
// entry is sized at maxPositionUsd notional, so USD ≈ pnl% × notional. This
// slightly overestimates losses on partially-filled entries — conservative in
// the right direction for a loss limit.
async function todayRealizedPnlUsd(maxPositionUsd: number): Promise<number> {
  const sb = supabase();
  const midnightUtc = new Date();
  midnightUtc.setUTCHours(0, 0, 0, 0);
  const { data } = await sb
    .from("trades")
    .select("pnl")
    .eq("status", "closed")
    .neq("mode", "paper")
    .gte("closed_at", midnightUtc.toISOString());
  return (data ?? []).reduce(
    (sum, t) => sum + (Number(t.pnl) / 100) * maxPositionUsd,
    0
  );
}

async function openRealPositions(): Promise<number> {
  const sb = supabase();
  const { count } = await sb
    .from("trades")
    .select("id", { count: "exact", head: true })
    .eq("status", "open")
    .neq("mode", "paper");
  return count ?? 0;
}

export async function executeEntry(
  symbol: string,
  direction: Direction,
  fallbackPrice: number | null
): Promise<ExecutionResult> {
  const quote = await fetchPrice(symbol);
  const marketPrice = quote?.price ?? fallbackPrice ?? 0;
  if (!marketPrice) throw new Error(`could not get entry price for ${symbol}`);

  const paper = (reason?: string): ExecutionResult => ({
    executed: false,
    mode: "paper",
    entryPrice: marketPrice,
    qty: 1,
    reason,
  });

  const broker = binanceBroker();
  if (executionMode() === "paper" || !broker.isEnabled()) {
    return paper("execution disabled — paper trade");
  }
  if (!broker.supports(symbol)) {
    return paper(`${symbol} not tradable on ${broker.name} — paper trade`);
  }
  if (direction !== "bullish") {
    // Spot Binance can't short; bearish/neutral signals stay paper this round.
    return paper(`${direction} signals stay paper on spot — no short support`);
  }

  const cfg = riskConfigFromEnv();
  const verdict = checkOrder(
    { symbol, side: "BUY", notionalUsd: cfg.maxPositionUsd },
    {
      openPositions: await openRealPositions(),
      todayRealizedPnlUsd: await todayRealizedPnlUsd(cfg.maxPositionUsd),
    },
    cfg
  );
  if (!verdict.allowed) {
    // A blocked real order must fail loudly — falling back to paper would
    // mask the refusal behind a fake fill.
    throw new RiskRejectionError(`order refused: ${verdict.reason}`);
  }

  const entryOrder = await broker.placeMarketOrder(symbol, "BUY", cfg.maxPositionUsd);
  const entryPrice = entryOrder.fillPrice ?? marketPrice;
  const qty = entryOrder.executedQty ?? cfg.maxPositionUsd / entryPrice;

  const exitOrder = await broker.placeOcoExit(
    symbol,
    "SELL",
    qty,
    entryPrice * (1 + TAKE_PROFIT_PCT / 100),
    entryPrice * (1 + STOP_LOSS_PCT / 100)
  );

  return {
    executed: true,
    mode: executionMode(),
    entryPrice,
    qty,
    entryOrder,
    exitOrder,
  };
}
