import { Card } from "../components/Card";
import { ConvictionBarChart, ConvictionBarDatum } from "../components/charts/ConvictionBarChart";
import { SignalConvictionTimeline } from "../components/charts/SignalConvictionTimeline";
import { supabase, SignalRow } from "../lib/supabase";
import { SignalActions } from "./SignalActions";

export const dynamic = "force-dynamic";

export default async function SignalsPage() {
  const sb = supabase();
  const { data } = await sb
    .from("signals")
    .select("*")
    .order("created_at", { ascending: false })
    .limit(100);

  const signals: SignalRow[] = data ?? [];

  const bySymbol = new Map<string, { sum: number; count: number; dirCounts: Record<string, number> }>();
  for (const s of signals) {
    const entry = bySymbol.get(s.symbol) ?? { sum: 0, count: 0, dirCounts: {} };
    entry.sum += s.conviction;
    entry.count += 1;
    entry.dirCounts[s.direction] = (entry.dirCounts[s.direction] ?? 0) + 1;
    bySymbol.set(s.symbol, entry);
  }
  const convictionBarData: ConvictionBarDatum[] = Array.from(bySymbol.entries())
    .map(([symbol, e]) => {
      const dominant = Object.entries(e.dirCounts).sort((a, b) => b[1] - a[1])[0][0];
      return {
        symbol,
        conviction: Math.round(e.sum / e.count),
        direction: dominant,
      };
    })
    .sort((a, b) => b.conviction - a.conviction);

  const timelineData = signals.map((s) => ({
    created_at: s.created_at,
    symbol: s.symbol,
    conviction: s.conviction,
    direction: s.direction,
  }));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Signals</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Live MiroFish sentiment feed. Approve to open a paper position; ignore to dismiss.
        </p>
      </header>

      <Card title="Avg conviction by symbol">
        <ConvictionBarChart data={convictionBarData} />
      </Card>

      {signals.length === 0 ? (
        <Card>
          <p className="text-sm text-[var(--muted)]">
            No signals yet. The cron worker emits a signal whenever a watchlist symbol moves ±2%.
          </p>
        </Card>
      ) : (
        <div className="space-y-3">
          {signals.map((s) => (
            <Card key={s.id}>
              <div className="flex items-start justify-between gap-4 flex-wrap">
                <div className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg">{s.symbol}</span>
                    <span
                      className={
                        s.direction === "bullish"
                          ? "text-[var(--bullish)]"
                          : s.direction === "bearish"
                          ? "text-[var(--bearish)]"
                          : "text-[var(--neutral)]"
                      }
                    >
                      {s.direction}
                    </span>
                    <span className="text-sm text-[var(--muted)]">
                      conviction {s.conviction}/100
                    </span>
                    <StatusBadge status={s.status} />
                  </div>
                  <p className="mt-2 text-sm text-[var(--muted)]">{s.summary}</p>
                  <p className="mt-1 text-xs text-[var(--muted)]">
                    {new Date(s.created_at).toLocaleString()}
                    {s.price ? ` · price $${Number(s.price).toFixed(2)}` : ""}
                  </p>
                </div>
                {s.status === "pending" && <SignalActions signal={s} />}
              </div>
            </Card>
          ))}
        </div>
      )}

      <Card title="Conviction timeline">
        <SignalConvictionTimeline data={timelineData} />
      </Card>
    </div>
  );
}

function StatusBadge({ status }: { status: SignalRow["status"] }) {
  const styles =
    status === "approved"
      ? "bg-[var(--bullish)]/15 text-[var(--bullish)]"
      : status === "ignored"
      ? "bg-[var(--bearish)]/15 text-[var(--bearish)]"
      : "bg-[var(--panel-2)] text-[var(--muted)]";
  return (
    <span className={`px-2 py-0.5 rounded text-xs uppercase tracking-wider ${styles}`}>
      {status}
    </span>
  );
}
