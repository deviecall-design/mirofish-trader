// Last-seen price cache. We store the most recent observed price per symbol
// in a tiny key/value table inside Supabase via signals (we use the latest
// signal's `price` if present) — no extra schema needed.

import { supabase } from "./supabase";

export async function getLastPrice(symbol: string): Promise<number | null> {
  const sb = supabase();
  const { data } = await sb
    .from("signals")
    .select("price")
    .eq("symbol", symbol)
    .not("price", "is", null)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data?.price != null ? Number(data.price) : null;
}
