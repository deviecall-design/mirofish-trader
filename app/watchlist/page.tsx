import { Card } from "../components/Card";
import { supabase, WatchlistRow } from "../lib/supabase";
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
                <li key={row.id} className="py-2 flex items-center justify-between">
                  <span className="font-mono">{row.symbol}</span>
                  <span
                    className={
                      row.active ? "text-[var(--bullish)] text-xs" : "text-[var(--muted)] text-xs"
                    }
                  >
                    {row.active ? "active" : "paused"}
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
