import { NextRequest } from "next/server";
import { supabase } from "@/app/lib/supabase";
import { fetchPrice } from "@/app/lib/prices";
import { sendTelegram } from "@/app/lib/telegram";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

interface TelegramUpdate {
  message?: {
    chat?: { id: number };
    text?: string;
    from?: { username?: string };
  };
}

export async function POST(req: NextRequest) {
  let update: TelegramUpdate;
  try {
    update = (await req.json()) as TelegramUpdate;
  } catch {
    return Response.json({ ok: false, error: "invalid json" }, { status: 400 });
  }

  const text = update.message?.text?.trim();
  const chatId = update.message?.chat?.id;
  if (!text || !chatId) return Response.json({ ok: true });

  const allowedChat = process.env.TELEGRAM_CHAT_ID;
  if (allowedChat && String(chatId) !== String(allowedChat)) {
    return Response.json({ ok: true });
  }

  const match = text.match(/^\/(approve|ignore)\s+([A-Za-z0-9.\-]+)/i);
  if (!match) {
    await sendTelegram(
      "Try <code>/approve SYMBOL</code> or <code>/ignore SYMBOL</code>.",
      chatId
    );
    return Response.json({ ok: true });
  }

  const command = match[1].toLowerCase() as "approve" | "ignore";
  const symbol = match[2].toUpperCase();
  const sb = supabase();

  const { data: signal, error } = await sb
    .from("signals")
    .select("*")
    .eq("symbol", symbol)
    .eq("status", "pending")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !signal) {
    await sendTelegram(`No pending signal found for <b>${symbol}</b>.`, chatId);
    return Response.json({ ok: true });
  }

  if (command === "ignore") {
    await sb.from("signals").update({ status: "ignored" }).eq("id", signal.id);
    await sendTelegram(`🙈 Ignored <b>${symbol}</b>.`, chatId);
    return Response.json({ ok: true });
  }

  // approve — open paper trade at current price.
  const quote = await fetchPrice(symbol);
  const entryPrice = quote?.price ?? Number(signal.price ?? 0);
  if (!entryPrice) {
    await sendTelegram(`Could not fetch a price for <b>${symbol}</b>; skipped.`, chatId);
    return Response.json({ ok: true });
  }

  await sb.from("signals").update({ status: "approved" }).eq("id", signal.id);
  await sb.from("trades").insert({
    symbol,
    direction: signal.direction,
    entry_price: entryPrice,
    quantity: 1,
    status: "open",
    signal_id: signal.id,
  });

  await sendTelegram(
    `✅ Opened paper position: <b>${symbol}</b> ${signal.direction} @ $${entryPrice.toFixed(
      2
    )}\nTP +5% / SL -3%`,
    chatId
  );

  return Response.json({ ok: true });
}

export async function GET() {
  return Response.json({
    ok: true,
    message: "Telegram webhook endpoint. POST updates from Telegram here.",
  });
}
