import { Card, Stat } from "../components/Card";
import { supabase, TradeRow } from "../lib/supabase";
import { DrawdownChart } from "./DrawdownChart";

export const dynamic = "force-dynamic";

export default async function PerformancePage() {
  const sb = supabase();
  const { data } = await sb
    .from("trades")
    .select("*")
    .eq("status", "closed")
    .order("closed_at", { ascending: true })
    .limit(500);

  const closed: TradeRow[] = data ?? [];

  let cum = 0;
  let peak = 0;
  let maxDrawdown = 0;
  const equityCurve = closed.map((t) => {
    cum += Number(t.pnl ?? 0);
    peak = Math.max(peak, cum);
    const drawdown = cum - peak;
    if (drawdown < maxDrawdown) maxDrawdown = drawdown;
    return {
      t: t.closed_at ?? t.opened_at,
      cum: Number(cum.toFixed(2)),
      drawdown: Number(drawdown.toFixed(2)),
    };
  });

  const wins = closed.filter((t) => Number(t.pnl ?? 0) > 0);
  const losses = closed.filter((t) => Number(t.pnl ?? 0) < 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const avgReturn =
    closed.length ? closed.reduce((s, t) => s + Number(t.pnl ?? 0), 0) / closed.length : 0;
  const bestTrade = closed.reduce(
    (best, t) => Math.max(best, Number(t.pnl ?? -Infinity)),
    -Infinity
  );
  const worstTrade = closed.reduce(
    (worst, t) => Math.min(worst, Number(t.pnl ?? Infinity)),
    Infinity
  );

  const fmtPct = (n: number) => `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-semibold">Performance</h1>
        <p className="text-sm text-[var(--muted)] mt-1">
          Closed-trade analytics. Equity curve and drawdown are based on cumulative percentage P&amp;L.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          hint={`${wins.length} W / ${losses.length} L`}
          tone={winRate >= 50 ? "bullish" : closed.length ? "bearish" : undefined}
        />
        <Stat
          label="Avg return"
          value={fmtPct(avgReturn)}
          tone={avgReturn >= 0 ? "bullish" : "bearish"}
        />
        <Stat
          label="Max drawdown"
          value={fmtPct(maxDrawdown)}
          tone={maxDrawdown < 0 ? "bearish" : undefined}
        />
        <Stat
          label="Best / worst"
          value={
            closed.length
              ? `${fmtPct(bestTrade)} / ${fmtPct(worstTrade)}`
              : "—"
          }
        />
      </div>

      <Card title="Equity & drawdown">
        {equityCurve.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">
            No closed trades yet — chart appears after the first trade closes.
          </p>
        ) : (
          <DrawdownChart data={equityCurve} />
        )}
      </Card>
    </div>
  );
}
