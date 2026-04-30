import { Card, Stat } from "./components/Card";
import { ConvictionBarChart, ConvictionBarDatum } from "./components/charts/ConvictionBarChart";
import { supabase, SignalRow, TradeRow } from "./lib/supabase";

export const dynamic = "force-dynamic";

function formatPct(n: number) {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function formatUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default async function Dashboard() {
  const sb = supabase();
  const [trades, signals, signalsForChart] = await Promise.all([
    sb.from("trades").select("*").order("opened_at", { ascending: false }),
    sb.from("signals").select("*").order("created_at", { ascending: false }).limit(8),
    sb.from("signals").select("*").order("created_at", { ascending: false }).limit(200),
  ]);

  const tradeRows: TradeRow[] = trades.data ?? [];
  const recentSignals: SignalRow[] = signals.data ?? [];
  const chartSignals: SignalRow[] = signalsForChart.data ?? [];

  const bySymbol = new Map<string, { sum: number; count: number; dirCounts: Record<string, number> }>();
  for (const s of chartSignals) {
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

  const open = tradeRows.filter((t) => t.status === "open");
  const closed = tradeRows.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Dashboard</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Paper trading driven by MiroFish swarm intelligence — single-user mode.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Total P&amp;L"
          value={formatPct(totalPnl)}
          hint={`${closed.length} closed trades`}
          tone={totalPnl >= 0 ? "bullish" : "bearish"}
        />
        <Stat label="Open positions" value={String(open.length)} />
        <Stat
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          hint={`${wins.length}/${closed.length} wins`}
          tone={winRate >= 50 ? "bullish" : closed.length ? "bearish" : undefined}
        />
        <Stat label="Recent signals" value={String(recentSignals.length)} />
      </div>

      <Card title="Avg conviction by symbol">
        <ConvictionBarChart data={convictionBarData} />
      </Card>

      <Card title="Open positions">
        {open.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No open positions yet.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="text-left text-[var(--muted)]">
              <tr>
                <th className="py-2">Symbol</th>
                <th>Direction</th>
                <th>Entry</th>
                <th>Opened</th>
              </tr>
            </thead>
            <tbody>
              {open.map((t) => (
                <tr key={t.id} className="border-t border-[var(--border)]">
                  <td className="py-2 font-mono">{t.symbol}</td>
                  <td className="capitalize">{t.direction}</td>
                  <td className="font-mono">{formatUsd(Number(t.entry_price))}</td>
                  <td className="text-[var(--muted)]">
                    {new Date(t.opened_at).toLocaleString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Card>

      <Card title="Recent signals">
        {recentSignals.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No signals yet — the cron job will populate this when prices move ±2%.
          </p>
        ) : (
          <ul className="space-y-3">
            {recentSignals.map((s) => (
              <li key={s.id} className="text-sm">
                <span className="font-mono">{s.symbol}</span>{" "}
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
                </span>{" "}
                <span className="text-[var(--muted)]">· conviction {s.conviction}/100 · {s.status}</span>
                <div className="text-[var(--muted)]">{s.summary}</div>
              </li>
            ))}
          </ul>
        )}
      </Card>
    </div>
  );
}
