// Jarvis tool definitions + server-side executors. Mutating tools go through
// the existing server-action code paths (which enforce the risk guard) and
// require an explicit confirm flag that only the UI sets after the user
// clicks Confirm.

import type Anthropic from "@anthropic-ai/sdk";
import { supabase, type SignalRow, type TradeRow } from "@/app/lib/supabase";
import { fetchPrice } from "@/app/lib/prices";
import { runSwarm } from "@/app/lib/mirofish";
import { getMacroBiasReport } from "@/app/lib/macroBias";
import { getSocialBiasReport } from "@/app/lib/socialBias";
import { performanceFromTrades } from "@/app/lib/pnl";
import { approveSignal, ignoreSignal } from "@/app/signals/actions";
import { executionMode } from "@/app/lib/execution";

export const JARVIS_TOOLS: Anthropic.Tool[] = [
  {
    name: "get_positions",
    description:
      "Get open trades and the 10 most recently closed trades, with entry/exit prices, P&L and mode (paper/testnet/live). Call this when the user asks about positions, trades, or P&L.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_pending_signals",
    description:
      "List pending MiroFish signals awaiting approval, with direction, conviction and summary. Call this when the user asks what's pending or what to approve.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "get_price",
    description:
      "Get the current market price for a watchlist symbol (e.g. BTC, ETH, NVDA, DRO.AX).",
    input_schema: {
      type: "object",
      properties: { symbol: { type: "string", description: "Ticker symbol" } },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "run_swarm",
    description:
      "Run the Monte Carlo model (1,000 virtual votes with random jitter, not live agents) on a symbol and return direction, conviction and archetype votes. Call this when the user asks for sentiment or 'what does the swarm think'. Say that it is a simulation.",
    input_schema: {
      type: "object",
      properties: { symbol: { type: "string", description: "Ticker symbol" } },
      required: ["symbol"],
      additionalProperties: false,
    },
  },
  {
    name: "get_performance",
    description:
      "Get paper-account performance: win rate, average trade, size-weighted compounded account return, and max drawdown. The account return is not the sum of trade percentages.",
    input_schema: { type: "object", properties: {}, additionalProperties: false },
  },
  {
    name: "approve_signal",
    description:
      "Approve a pending signal, opening a trade (a REAL exchange order when execution is enabled). ALWAYS call first with confirm=false to get an order preview for the user; only call with confirm=true after the user has explicitly confirmed in this conversation.",
    input_schema: {
      type: "object",
      properties: {
        signal_id: { type: "string", description: "UUID of the pending signal" },
        confirm: {
          type: "boolean",
          description:
            "false = return a preview for user confirmation; true = place the trade (only after explicit user confirmation)",
        },
      },
      required: ["signal_id", "confirm"],
      additionalProperties: false,
    },
  },
  {
    name: "ignore_signal",
    description: "Ignore (dismiss) a pending signal by id.",
    input_schema: {
      type: "object",
      properties: {
        signal_id: { type: "string", description: "UUID of the pending signal" },
      },
      required: ["signal_id"],
      additionalProperties: false,
    },
  },
];

export async function runJarvisTool(
  name: string,
  input: Record<string, unknown>
): Promise<unknown> {
  const sb = supabase();

  switch (name) {
    case "get_positions": {
      const { data: open } = await sb
        .from("trades")
        .select("*")
        .eq("status", "open")
        .order("opened_at", { ascending: false });
      const { data: closed } = await sb
        .from("trades")
        .select("*")
        .eq("status", "closed")
        .order("closed_at", { ascending: false })
        .limit(10);
      return { open: open ?? [], recentlyClosed: closed ?? [] };
    }

    case "get_pending_signals": {
      const { data } = await sb
        .from("signals")
        .select("id,symbol,direction,conviction,summary,price,created_at")
        .eq("status", "pending")
        .order("created_at", { ascending: false });
      return { pending: data ?? [] };
    }

    case "get_price": {
      const quote = await fetchPrice(String(input.symbol ?? ""));
      return quote ?? { error: `no price available for ${input.symbol}` };
    }

    case "run_swarm": {
      const symbol = String(input.symbol ?? "").toUpperCase();
      const quote = await fetchPrice(symbol);
      if (!quote) return { error: `no price available for ${symbol}` };
      const [macro, social] = await Promise.all([
        getMacroBiasReport().catch(() => ({
          value: 0,
          available: false,
          detail: "macro feed failed",
        })),
        getSocialBiasReport(symbol).catch(() => ({
          value: 0,
          available: false,
          detail: "social feed failed",
        })),
      ]);
      const swarm = runSwarm({
        symbol,
        price: quote.price,
        pctChange: 0,
        macroBias: macro.value,
        socialBias: social.value,
      });
      return {
        price: quote.price,
        simulated: true,
        runs: 1000,
        inputs: { macro, social },
        ...swarm,
      };
    }

    case "get_performance": {
      const { data: closed } = await sb
        .from("trades")
        .select("pnl,entry_price,quantity,opened_at,closed_at,status")
        .eq("status", "closed");
      const { count: openCount } = await sb
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      const perf = performanceFromTrades((closed ?? []) as TradeRow[]);
      return {
        closedTrades: perf.closedCount,
        openTrades: openCount ?? 0,
        winRate: perf.closedCount ? Number(perf.winRatePct.toFixed(1)) : null,
        avgReturnPct: perf.closedCount
          ? Number(perf.equalWeightAverageReturnPct.toFixed(2))
          : null,
        accountReturnPct: Number(perf.accountReturnPct.toFixed(2)),
        maxDrawdownPct: Number(perf.maxDrawdownPct.toFixed(2)),
        note: "accountReturnPct is size-weighted and compounded. It is not the sum of each trade's percent. avgReturnPct is the unweighted average of those percents.",
      };
    }

    case "approve_signal": {
      const signalId = String(input.signal_id ?? "");
      const { data: signal } = await sb
        .from("signals")
        .select("*")
        .eq("id", signalId)
        .single();
      if (!signal) return { error: "signal not found" };
      if ((signal as SignalRow).status !== "pending")
        return { error: "signal is no longer pending" };

      if (input.confirm !== true) {
        const quote = await fetchPrice(signal.symbol);
        return {
          needs_confirmation: true,
          signal_id: signalId,
          symbol: signal.symbol,
          direction: signal.direction,
          conviction: signal.conviction,
          currentPrice: quote?.price ?? signal.price,
          executionMode: executionMode(),
          note:
            executionMode() === "paper"
              ? "Paper trade — no real order."
              : `This will place a REAL ${executionMode()} order on Binance with exchange-side TP/SL. The request must send Authorization: Bearer TRADING_API_SECRET or the order is refused.`,
        };
      }

      const approved = await approveSignal(signalId);
      if (!approved.ok) return { approved: false, reason: approved.reason ?? "not approved" };
      return { approved: true, signal_id: signalId, mode: executionMode() };
    }

    case "ignore_signal": {
      await ignoreSignal(String(input.signal_id ?? ""));
      return { ignored: true };
    }

    default:
      return { error: `unknown tool: ${name}` };
  }
}
