"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "../lib/supabase";
import { fetchPrice } from "../lib/prices";
import { sendTelegram } from "../lib/telegram";

export async function approveSignal(signalId: string) {
  const sb = supabase();
  const { data: signal, error } = await sb
    .from("signals")
    .select("*")
    .eq("id", signalId)
    .single();
  if (error || !signal) throw new Error(error?.message ?? "signal not found");
  if (signal.status !== "pending") return { ok: false, reason: "not pending" };

  const quote = await fetchPrice(signal.symbol);
  const entryPrice = quote?.price ?? Number(signal.price ?? 0);
  if (!entryPrice) throw new Error(`could not get entry price for ${signal.symbol}`);

  const { error: updErr } = await sb
    .from("signals")
    .update({ status: "approved" })
    .eq("id", signalId);
  if (updErr) throw new Error(updErr.message);

  const { error: insErr } = await sb.from("trades").insert({
    symbol: signal.symbol,
    direction: signal.direction,
    entry_price: entryPrice,
    quantity: 1,
    status: "open",
    signal_id: signalId,
  });
  if (insErr) throw new Error(insErr.message);

  await sendTelegram(
    `✅ Approved <b>${signal.symbol}</b> ${signal.direction} @ $${entryPrice.toFixed(2)}`
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
