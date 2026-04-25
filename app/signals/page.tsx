import { Card } from "../components/Card";
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

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Signals</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Live MiroFish sentiment feed. Approve to open a paper position; ignore to dismiss.
        </p>
      </header>

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
