// Jarvis tool definitions + server-side executors. Mutating tools go through
// the existing server-action code paths (which enforce the risk guard) and
// require an explicit confirm flag that only the UI sets after the user
// clicks Confirm.

import type Anthropic from "@anthropic-ai/sdk";
import { supabase, type SignalRow, type TradeRow } from "@/app/lib/supabase";
import { fetchPrice } from "@/app/lib/prices";
import { runSwarm } from "@/app/lib/mirofish";
import { getMacroBias } from "@/app/lib/macroBias";
import { getSocialBias } from "@/app/lib/socialBias";
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
      "Run a 1000-agent MiroFish swarm simulation on a symbol right now and return direction, conviction and archetype votes. Call this when the user asks for sentiment or 'what does the swarm think'.",
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
      "Get overall performance: win rate, average return, total closed trades, open count.",
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
      const [macroBias, socialBias] = await Promise.all([
        getMacroBias().catch(() => 0),
        getSocialBias(symbol).catch(() => 0),
      ]);
      const swarm = runSwarm({
        symbol,
        price: quote.price,
        pctChange: 0,
        macroBias,
        socialBias,
      });
      return { price: quote.price, ...swarm };
    }

    case "get_performance": {
      const { data: closed } = await sb
        .from("trades")
        .select("pnl")
        .eq("status", "closed");
      const { count: openCount } = await sb
        .from("trades")
        .select("id", { count: "exact", head: true })
        .eq("status", "open");
      const trades = (closed ?? []) as Pick<TradeRow, "pnl">[];
      const wins = trades.filter((t) => Number(t.pnl) > 0).length;
      const totalPnl = trades.reduce((s, t) => s + Number(t.pnl ?? 0), 0);
      return {
        closedTrades: trades.length,
        openTrades: openCount ?? 0,
        winRate: trades.length ? Number(((wins / trades.length) * 100).toFixed(1)) : null,
        avgReturnPct: trades.length ? Number((totalPnl / trades.length).toFixed(2)) : null,
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
              : `This will place a REAL ${executionMode()} order on Binance with exchange-side TP/SL.`,
        };
      }

      await approveSignal(signalId);
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
