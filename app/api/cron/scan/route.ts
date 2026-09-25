import { NextRequest } from "next/server";
import { supabase, TradeRow, WatchlistRow } from "@/app/lib/supabase";
import { fetchPrice } from "@/app/lib/prices";
import { getLastPrice } from "@/app/lib/lastPrices";
import { runSwarm } from "@/app/lib/mirofish";
import { sendTelegram } from "@/app/lib/telegram";
import { getMacroBiasReport } from "@/app/lib/macroBias";
import { getSocialBiasReport } from "@/app/lib/socialBias";
import { formatInputLine } from "@/app/lib/inputAvailability";
import { binanceBroker } from "@/app/lib/brokers/binance";
import {
  MOVE_THRESHOLD_PCT,
  TAKE_PROFIT_PCT,
  STOP_LOSS_PCT,
} from "@/app/lib/constants";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

function checkAuth(req: NextRequest) {
  const secret = process.env.CRON_SECRET;
  if (!secret) return true; // no secret configured — allow (local dev)
  const header = req.headers.get("authorization");
  const queryParam = req.nextUrl.searchParams.get("secret");
  return header === `Bearer ${secret}` || queryParam === secret;
}

function pctMove(current: number, previous: number) {
  if (!previous) return 0;
  return ((current - previous) / previous) * 100;
}

function tradePnl(direction: TradeRow["direction"], entry: number, exit: number) {
  const raw = ((exit - entry) / entry) * 100;
  return direction === "bearish" ? -raw : raw;
}

interface ScanResult {
  scanned: string[];
  newSignals: { symbol: string; direction: string; conviction: number }[];
  closedTrades: { symbol: string; pnl: number; reason: string }[];
  errors: { symbol: string; error: string }[];
}

// A failed Telegram send must not abort the rest of the scan. Notification
// is not required to record a close or a signal, and it never places an order.
async function notify(message: string) {
  try {
    await sendTelegram(message);
  } catch (err) {
    console.error("Telegram notify failed:", err);
  }
}

export async function GET(req: NextRequest) {
  if (!checkAuth(req)) {
    return Response.json({ error: "unauthorized" }, { status: 401 });
  }
  const result = await runScan();
  return Response.json(result);
}

export async function POST(req: NextRequest) {
  return GET(req);
}

// Sync a testnet/live trade against its exchange-side OCO exit. Closes the
// trade with the real fill price when either leg has executed.
async function syncRealTrade(trade: TradeRow, result: ScanResult) {
  const sb = supabase();
  const broker = binanceBroker();
  if (!broker.isEnabled()) return;

  const { data: ocoOrder } = await sb
    .from("orders")
    .select("*")
    .eq("trade_id", trade.id)
    .eq("type", "oco")
    .eq("status", "requested")
    .maybeSingle();
  if (!ocoOrder?.broker_order_id) return;

  let status;
  try {
    status = await broker.getOcoStatus(trade.symbol, ocoOrder.broker_order_id);
  } catch (err) {
    console.error(`OCO sync failed for ${trade.symbol}:`, err);
    return;
  }
  if (!status.done) return;

  const fallback = await fetchPrice(trade.symbol);
  const exitPrice = status.exitPrice ?? fallback?.price;
  if (!exitPrice) return;

  const entry = Number(trade.entry_price);
  const pnl = tradePnl(trade.direction, entry, exitPrice);
  const reason = pnl >= 0 ? "take-profit" : "stop-loss";

  await sb
    .from("trades")
    .update({
      status: "closed",
      exit_price: exitPrice,
      pnl: Number(pnl.toFixed(4)),
      closed_at: new Date().toISOString(),
    })
    .eq("id", trade.id);

  await sb
    .from("orders")
    .update({
      status: "filled",
      fill_price: exitPrice,
      filled_at: new Date().toISOString(),
      raw: status.raw ?? null,
    })
    .eq("id", ocoOrder.id);

  result.closedTrades.push({
    symbol: trade.symbol,
    pnl: Number(pnl.toFixed(2)),
    reason: `${reason} (${trade.mode})`,
  });

  const emoji = pnl >= 0 ? "🟢" : "🔴";
  await notify(
    `${emoji} <b>${trade.symbol}</b> closed on exchange (${reason}) ` +
      `at $${exitPrice.toFixed(2)} — P&amp;L ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}% [${trade.mode}]`
  );
}

async function runScan(): Promise<ScanResult> {
  const sb = supabase();
  const result: ScanResult = { scanned: [], newSignals: [], closedTrades: [], errors: [] };

  // 1. Auto-close open trades that hit TP/SL.
  const { data: openTrades } = await sb
    .from("trades")
    .select("*")
    .eq("status", "open");

  for (const trade of (openTrades ?? []) as TradeRow[]) {
    // Real trades exit via the exchange-side OCO — sync its status instead
    // of simulating TP/SL.
    if (trade.mode && trade.mode !== "paper") {
      await syncRealTrade(trade, result);
      continue;
    }

    const quote = await fetchPrice(trade.symbol);
    if (!quote) continue;
    const entry = Number(trade.entry_price);
    const pnl = tradePnl(trade.direction, entry, quote.price);

    let close: "tp" | "sl" | null = null;
    if (pnl >= TAKE_PROFIT_PCT) close = "tp";
    else if (pnl <= STOP_LOSS_PCT) close = "sl";
    if (!close) continue;

    await sb
      .from("trades")
      .update({
        status: "closed",
        exit_price: quote.price,
        pnl: Number(pnl.toFixed(4)),
        closed_at: new Date().toISOString(),
      })
      .eq("id", trade.id);

    result.closedTrades.push({
      symbol: trade.symbol,
      pnl: Number(pnl.toFixed(2)),
      reason: close === "tp" ? "take-profit" : "stop-loss",
    });

    const emoji = close === "tp" ? "🟢" : "🔴";
    await notify(
      `${emoji} <b>${trade.symbol}</b> closed (${close === "tp" ? "TP" : "SL"}) ` +
        `at $${quote.price.toFixed(2)} — P&amp;L ${pnl >= 0 ? "+" : ""}${pnl.toFixed(2)}%`
    );
  }

  // 2. Scan watchlist for ±2% moves and emit signals.
  const { data: watchlist } = await sb
    .from("watchlist")
    .select("*")
    .eq("active", true);

  for (const row of (watchlist ?? []) as WatchlistRow[]) {
    result.scanned.push(row.symbol);
    const quote = await fetchPrice(row.symbol);
    if (!quote) continue;
    const previous = await getLastPrice(row.symbol);

    if (previous == null) {
      // First observation — store baseline as a neutral, ignored signal.
      // Ignored so it cannot be approved into a trade.
      const { error: baseErr } = await sb.from("signals").insert({
        symbol: row.symbol,
        direction: "neutral",
        conviction: 0,
        summary: `${row.symbol} baseline observed at $${quote.price.toFixed(2)}.`,
        status: "ignored",
        price: quote.price,
      });
      if (baseErr) result.errors.push({ symbol: row.symbol, error: baseErr.message });
      continue;
    }

    const move = pctMove(quote.price, previous);
    if (Math.abs(move) < MOVE_THRESHOLD_PCT) continue;

    // A failed feed is a 0 with available:false, which is written into the
    // summary. The signals table has no extra column for this (meta does
    // not exist — inserting it used to reject every new signal).
    const macro = await getMacroBiasReport().catch((err: unknown) => {
      console.error("Failed to fetch macro bias:", err);
      return {
        value: 0,
        available: false,
        detail: err instanceof Error ? err.message : "macro feed failed",
      };
    });
    const social = await getSocialBiasReport(row.symbol).catch((err: unknown) => {
      console.error(`Failed to fetch social bias for ${row.symbol}:`, err);
      return {
        value: 0,
        available: false,
        detail: err instanceof Error ? err.message : "social feed failed",
      };
    });

    const swarm = runSwarm({
      symbol: row.symbol,
      price: quote.price,
      pctChange: move,
      recentTrend: move / 5,
      macroBias: macro.value,
      socialBias: social.value,
    });

    const { data: inserted, error: insertError } = await sb
      .from("signals")
      .insert({
        symbol: row.symbol,
        direction: swarm.direction,
        conviction: swarm.conviction,
        summary: `${swarm.summary} ${formatInputLine(macro, social)}`,
        status: "pending",
        price: quote.price,
      })
      .select("*")
      .single();

    if (insertError) {
      result.errors.push({ symbol: row.symbol, error: insertError.message });
      continue;
    }

    if (inserted) {
      result.newSignals.push({
        symbol: row.symbol,
        direction: swarm.direction,
        conviction: swarm.conviction,
      });
      await notify(
        `🐟 <b>MiroFish Signal</b>: ${row.symbol} ${swarm.direction} ` +
          `(model score: ${swarm.conviction}/100)\n${swarm.summary}\n` +
          `Reply <code>/approve ${row.symbol}</code> or <code>/ignore ${row.symbol}</code>`
      );
    }
  }

  return result;
}
