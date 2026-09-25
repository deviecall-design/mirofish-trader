"use server";

import { revalidatePath } from "next/cache";
import { fetchPrice } from "../lib/prices";
import { supabase } from "../lib/supabase";
import { resolveWatchlistSymbol, searchYahooSymbols } from "../lib/tickers";

export async function addSymbol(symbol: string, theme: string) {
  const resolved = await resolveWatchlistSymbol(symbol, {
    hasQuote: async (ticker) => (await fetchPrice(ticker)) != null,
    search: searchYahooSymbols,
  });
  if (!resolved.ok) return resolved;

  const sb = supabase();
  const { error } = await sb
    .from("watchlist")
    .insert({ symbol: resolved.symbol, theme, active: true });
  if (error) return { ok: false, reason: error.message };
  revalidatePath("/watchlist");
  return {
    ok: true as const,
    symbol: resolved.symbol,
    resolvedFrom: resolved.resolvedFrom,
  };
}
