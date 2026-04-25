"use server";

import { revalidatePath } from "next/cache";
import { supabase } from "../lib/supabase";

export async function addSymbol(symbol: string, theme: string) {
  if (!symbol) return { ok: false, reason: "symbol required" };
  const sb = supabase();
  const { error } = await sb
    .from("watchlist")
    .insert({ symbol: symbol.toUpperCase(), theme, active: true });
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/watchlist");
  return { ok: true };
}
