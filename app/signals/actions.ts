"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "../lib/supabase";
import { sendTelegram } from "../lib/telegram";
import { executeEntry, RiskRejectionError } from "../lib/execution";
import { canOpenTrade } from "../lib/signalPolicy";

export async function approveSignal(signalId: string) {
  const sb = supabase();
  const { data: signal, error } = await sb
    .from("signals")
    .select("*")
    .eq("id", signalId)
    .single();
  if (error || !signal) throw new Error(error?.message ?? "signal not found");
  if (signal.status !== "pending") return { ok: false, reason: "not pending" };
  if (!canOpenTrade(signal.direction)) {
    return { ok: false, reason: "neutral signals do not open a trade" };
  }

  // Execute first (real order or paper decision) — the signal only flips to
  // approved once we have a confirmed entry, so a broker/risk failure leaves
  // it pending instead of stranding an approved signal with no trade.
  let execution;
  try {
    execution = await executeEntry(
      signal.symbol,
      signal.direction,
      signal.price != null ? Number(signal.price) : null
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    await sendTelegram(
      err instanceof RiskRejectionError
        ? `🛑 <b>${signal.symbol}</b> order blocked by risk guard: ${message}`
        : `⚠️ <b>${signal.symbol}</b> execution failed, signal still pending: ${message}`
    );
    throw err;
  }

  const { error: updErr } = await sb
    .from("signals")
    .update({ status: "approved" })
    .eq("id", signalId);
  if (updErr) throw new Error(updErr.message);

  let { data: trade, error: insErr } = await sb
    .from("trades")
    .insert({
      symbol: signal.symbol,
      direction: signal.direction,
      entry_price: execution.entryPrice,
      quantity: execution.qty,
      status: "open",
      signal_id: signalId,
      mode: execution.mode,
    })
    .select("id")
    .single();
  if (insErr && !execution.executed && /mode/.test(insErr.message)) {
    // Pre-migration database (no trades.mode column yet): paper trades can
    // still proceed without the mode tag. Real executions never take this
    // path — they require the migrated schema for the orders audit trail.
    ({ data: trade, error: insErr } = await sb
      .from("trades")
      .insert({
        symbol: signal.symbol,
        direction: signal.direction,
        entry_price: execution.entryPrice,
        quantity: execution.qty,
        status: "open",
        signal_id: signalId,
      })
      .select("id")
      .single());
  }
  if (insErr) {
    // Don't strand the signal as approved with no trade — revert so it can
    // be re-approved once the underlying problem (e.g. missing migration)
    // is fixed.
    await sb.from("signals").update({ status: "pending" }).eq("id", signalId);
    await sendTelegram(
      `⚠️ <b>${signal.symbol}</b> trade insert failed, signal reverted to pending: ${insErr.message}`
    );
    throw new Error(insErr.message);
  }

  if (execution.executed && trade) {
    // Audit trail: one row for the market entry, one for the OCO exit.
    await sb.from("orders").insert([
      {
        trade_id: trade.id,
        symbol: signal.symbol,
        side: "BUY",
        type: "market",
        qty: execution.qty,
        status: execution.entryOrder?.status ?? "requested",
        broker: "binance",
        broker_order_id: execution.entryOrder?.brokerOrderId,
        fill_price: execution.entryOrder?.fillPrice,
        raw: execution.entryOrder?.raw ?? null,
        filled_at:
          execution.entryOrder?.status === "filled" ? new Date().toISOString() : null,
      },
      {
        trade_id: trade.id,
        symbol: signal.symbol,
        side: "SELL",
        type: "oco",
        qty: execution.qty,
        status: "requested",
        broker: "binance",
        broker_order_id: execution.exitOrder?.brokerOrderId,
        raw: execution.exitOrder?.raw ?? null,
      },
    ]);
  }

  const modeTag = execution.mode === "paper" ? "" : ` [${execution.mode}]`;
  await sendTelegram(
    `✅ Approved <b>${signal.symbol}</b> ${signal.direction} @ $${execution.entryPrice.toFixed(2)}${modeTag}`
  );

  revalidatePath("/signals");
  revalidatePath("/journal");
  revalidatePath("/");
  return { ok: true };
}

export async function ignoreSignal(signalId: string) {
  const sb = supabase();
  const { data: signal } = await sb
    .from("signals")
    .select("symbol,status")
    .eq("id", signalId)
    .single();

  const { error } = await sb
    .from("signals")
    .update({ status: "ignored" })
    .eq("id", signalId);
  if (error) throw new Error(error.message);

  if (signal?.symbol) {
    await sendTelegram(`🙈 Ignored <b>${signal.symbol}</b>`);
  }

  revalidatePath("/signals");
  revalidatePath("/");
  return { ok: true };
}
