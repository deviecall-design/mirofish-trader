import { createClient, SupabaseClient } from "@supabase/supabase-js";

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

if (!url || !anonKey) {
  throw new Error(
    "Missing NEXT_PUBLIC_SUPABASE_URL or NEXT_PUBLIC_SUPABASE_ANON_KEY"
  );
}

let cached: SupabaseClient | null = null;

export function supabase(): SupabaseClient {
  if (!cached) {
    cached = createClient(url!, anonKey!, {
      auth: { persistSession: false },
    });
  }
  return cached;
}

export type Direction = "bullish" | "bearish" | "neutral";
export type SignalStatus = "pending" | "approved" | "ignored";
export type TradeStatus = "open" | "closed";

export interface WatchlistRow {
  id: string;
  symbol: string;
  theme: string;
  active: boolean;
  created_at: string;
}

export interface SignalRow {
  id: string;
  symbol: string;
  direction: Direction;
  conviction: number;
  summary: string;
  status: SignalStatus;
  price: number | null;
  created_at: string;
}

export interface TradeRow {
  id: string;
  symbol: string;
  direction: Direction;
  entry_price: number;
  exit_price: number | null;
  quantity: number;
  status: TradeStatus;
  pnl: number | null;
  opened_at: string;
  closed_at: string | null;
  signal_id: string | null;
}
