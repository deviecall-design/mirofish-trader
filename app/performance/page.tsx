import { Card, Stat } from "../components/Card";
import { PnLLineChart } from "../components/charts/PnLLineChart";
import { supabase, TradeRow } from "../lib/supabase";
import { performanceFromTrades } from "../lib/pnl";
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
  const perf = performanceFromTrades(closed);
  const equityCurve = perf.equityCurve.map((p) => ({
    t: p.t,
    cum: Number(p.returnPct.toFixed(2)),
    drawdown: Number(p.drawdownPct.toFixed(2)),
  }));

  const winRate = perf.winRatePct;
  const avgReturn = perf.equalWeightAverageReturnPct;
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
          Account P&amp;L weights each closed trade by price × quantity and reinvests the cash.
          It is not the sum of the percentages. Paper trades are stored as quantity 1, and prices
          are not converted between currencies, so a higher-priced symbol counts more.
        </p>
      </header>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          hint={`${perf.wins} W / ${perf.losses} L`}
          tone={winRate >= 50 ? "bullish" : closed.length ? "bearish" : undefined}
        />
        <Stat
          label="Account return"
          value={fmtPct(perf.accountReturnPct)}
          hint="size-weighted"
          tone={perf.accountReturnPct >= 0 ? "bullish" : "bearish"}
        />
        <Stat
          label="Avg trade"
          value={fmtPct(avgReturn)}
          hint="each trade, unweighted"
          tone={avgReturn >= 0 ? "bullish" : "bearish"}
        />
        <Stat
          label="Max drawdown"
          value={fmtPct(perf.maxDrawdownPct)}
          hint="from peak equity"
          tone={perf.maxDrawdownPct < 0 ? "bearish" : undefined}
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

      <Card title="Account return over time">
        <PnLLineChart
          data={equityCurve.map((p) => ({ date: p.t, pnl: p.cum }))}
        />
      </Card>

      <Card title="Account equity and drawdown">
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
