import { Card } from "../components/Card";
import { supabase, TradeRow } from "../lib/supabase";

export const dynamic = "force-dynamic";

function formatUsd(n: number | null | undefined) {
  if (n == null) return "—";
  return Number(n).toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function formatPct(n: number | null | undefined) {
  if (n == null) return "—";
  const s = n >= 0 ? "+" : "";
  return `${s}${Number(n).toFixed(2)}%`;
}

export default async function JournalPage() {
  const sb = supabase();
  const { data } = await sb
    .from("trades")
    .select("*")
    .order("opened_at", { ascending: false })
    .limit(200);

  const trades: TradeRow[] = data ?? [];

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Journal</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Every paper trade with entry, exit and P&amp;L. Newest first.
        </p>
      </header>

      <Card>
        {trades.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No trades yet — approve a signal on the Signals page to open one.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left text-[var(--muted)]">
                <tr>
                  <th className="py-2 pr-4">Symbol</th>
                  <th className="pr-4">Direction</th>
                  <th className="pr-4">Status</th>
                  <th className="pr-4">Entry</th>
                  <th className="pr-4">Exit</th>
                  <th className="pr-4">P&amp;L</th>
                  <th className="pr-4">Opened</th>
                  <th>Closed</th>
                </tr>
              </thead>
              <tbody>
                {trades.map((t) => {
                  const pnl = t.pnl == null ? null : Number(t.pnl);
                  const pnlClass =
                    pnl == null
                      ? ""
                      : pnl > 0
                      ? "text-[var(--bullish)]"
                      : pnl < 0
                      ? "text-[var(--bearish)]"
                      : "";
                  return (
                    <tr key={t.id} className="border-t border-[var(--border)]">
                      <td className="py-2 pr-4 font-mono">{t.symbol}</td>
                      <td className="pr-4 capitalize">{t.direction}</td>
                      <td className="pr-4 capitalize">{t.status}</td>
                      <td className="pr-4 font-mono">{formatUsd(t.entry_price)}</td>
                      <td className="pr-4 font-mono">{formatUsd(t.exit_price)}</td>
                      <td className={`pr-4 font-mono ${pnlClass}`}>{formatPct(pnl)}</td>
                      <td className="pr-4 text-[var(--muted)]">
                        {new Date(t.opened_at).toLocaleString()}
                      </td>
                      <td className="text-[var(--muted)]">
                        {t.closed_at ? new Date(t.closed_at).toLocaleString() : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
