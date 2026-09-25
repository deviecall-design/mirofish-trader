import { Card } from "../components/Card";
import { formatMoney, PRICE_UNAVAILABLE, quoteCurrencyForSymbol } from "../lib/currency";
import { fetchPrice, mapPool } from "../lib/prices";
import { supabase, WatchlistRow } from "../lib/supabase";
import { looksLikeTicker } from "../lib/tickers";
import { WatchlistEditor } from "./WatchlistEditor";

export const dynamic = "force-dynamic";

export default async function WatchlistPage() {
  const sb = supabase();
  const { data } = await sb
    .from("watchlist")
    .select("*")
    .order("theme", { ascending: true })
    .order("symbol", { ascending: true });

  const rows: WatchlistRow[] = data ?? [];
  const quotes = await mapPool(rows, 4, async (row) => {
    const quote = await Promise.race([
      fetchPrice(row.symbol),
      new Promise<null>((resolve) => setTimeout(() => resolve(null), 4_000)),
    ]);
    const currency = quote?.currency ?? quoteCurrencyForSymbol(row.symbol);
    return [
      row.id,
      quote ? formatMoney(quote.price, currency) : PRICE_UNAVAILABLE,
    ] as const;
  });
  const priceById = new Map(quotes);

  const groups = rows.reduce<Record<string, WatchlistRow[]>>((acc, row) => {
    (acc[row.theme] ||= []).push(row);
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Watchlist</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Symbols the cron worker scans every 15 minutes. Toggle active or add new symbols.
        </p>
      </header>

      <WatchlistEditor />

      {Object.keys(groups).length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            Watchlist is empty. Run <code>supabase/schema.sql</code> to seed defaults.
          </p>
        </Card>
      ) : (
        Object.entries(groups).map(([theme, items]) => (
          <Card key={theme} title={theme}>
            <ul className="divide-y divide-[var(--border)]">
              {items.map((row) => (
                <li key={row.id} className="py-2 flex items-center justify-between gap-3">
                  <span className="min-w-0">
                    <span className="font-mono">{row.symbol}</span>
                    {!looksLikeTicker(row.symbol) && (
                      <span className="block text-xs text-[var(--bearish)]">
                        Company name stored as a ticker. Replace it with the exchange symbol.
                      </span>
                    )}
                  </span>
                  <span className="flex items-center gap-4 shrink-0">
                    <span
                      className={
                        priceById.get(row.id) === PRICE_UNAVAILABLE
                          ? "font-mono text-xs text-[var(--muted)]"
                          : "font-mono text-sm"
                      }
                    >
                      {priceById.get(row.id)}
                    </span>
                    <span
                      className={
                        row.active ? "text-[var(--bullish)] text-xs" : "text-[var(--muted)] text-xs"
                      }
                    >
                      {row.active ? "active" : "paused"}
                    </span>
                  </span>
                </li>
              ))}
            </ul>
          </Card>
        ))
      )}
    </div>
  );
}
