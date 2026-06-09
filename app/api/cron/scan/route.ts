import { NextRequest } from "next/server";
import { supabase, TradeRow, WatchlistRow } from "@/app/lib/supabase";
import { fetchPrice } from "@/app/lib/prices";
import { getLastPrice } from "@/app/lib/lastPrices";
import { runSwarm } from "@/app/lib/mirofish";
import { sendTelegram } from "@/app/lib/telegram";
import { getMacroBias } from "@/app/lib/macroBias";
import { getSocialBias } from "@/app/lib/socialBias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MOVE_THRESHOLD_PCT = 2;
const TAKE_PROFIT_PCT = 5;
const STOP_LOSS_PCT = -3;

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

async function runScan(): Promise<ScanResult> {
  const sb = supabase();
  const result: ScanResult = { scanned: [], newSignals: [], closedTrades: [] };

  // 1. Auto-close open trades that hit TP/SL.
  const { data: openTrades } = await sb
    .from("trades")
    .select("*")
    .eq("status", "open");

  for (const trade of (openTrades ?? []) as TradeRow[]) {
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
    await sendTelegram(
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
      await sb.from("signals").insert({
        symbol: row.symbol,
        direction: "neutral",
        conviction: 0,
        summary: `${row.symbol} baseline observed at $${quote.price.toFixed(2)}.`,
        status: "ignored",
        price: quote.price,
      });
      continue;
    }

    const move = pctMove(quote.price, previous);
    if (Math.abs(move) < MOVE_THRESHOLD_PCT) continue;

    // Fetch real biases (with error handling)
    let macroBias = 0;
    let socialBias = 0;

    try {
      macroBias = await getMacroBias();
    } catch (err) {
      console.error("Failed to fetch macro bias:", err);
      macroBias = 0;
    }

    try {
      socialBias = await getSocialBias(row.symbol);
    } catch (err) {
      console.error(`Failed to fetch social bias for ${row.symbol}:`, err);
      socialBias = 0;
    }

    const swarm = runSwarm({
      symbol: row.symbol,
      price: quote.price,
      pctChange: move,
      recentTrend: move / 5,
      macroBias,
      socialBias,
    });

    const { data: inserted } = await sb
      .from("signals")
      .insert({
        symbol: row.symbol,
        direction: swarm.direction,
        conviction: swarm.conviction,
        summary: swarm.summary,
        status: "pending",
        price: quote.price,
      })
      .select("*")
      .single();

    if (inserted) {
      result.newSignals.push({
        symbol: row.symbol,
        direction: swarm.direction,
        conviction: swarm.conviction,
      });
      await sendTelegram(
        `🐟 <b>MiroFish Signal</b>: ${row.symbol} ${swarm.direction} ` +
          `(conviction: ${swarm.conviction}/100)\n${swarm.summary}\n` +
          `Reply <code>/approve ${row.symbol}</code> or <code>/ignore ${row.symbol}</code>`
      );
    }
  }

  return result;
}
