// Paper-account P&L.
//
// Each closed trade stores its own percent return (`pnl`) and a size
// (`entry_price * quantity`). Paper entries are stored with quantity 1, so a
// higher price counts for more than a lower price. Those prices are not
// converted between currencies.
//
// The account figure is not the sum of those percentages. Summing them is how
// the dashboard used to report a -53% "total" and a drawdown past -100%.
//
// Model:
// 1. Starting cash is the most capital the book ever had deployed at once
//    (the recorded notionals of trades open at the same time). That is the
//    cash needed to fund the book with no extra leverage.
// 2. When a trade opens it deploys min(its notional, cash on hand). It cannot
//    spend more than the account has left, so a run of losses compounds
//    instead of stacking full-size bets the account can no longer fund.
// 3. When it closes, cash receives deploy * (1 + pnl/100). Profit and loss
//    are then available for later trades.
// 4. Account return is the percent change from starting cash to ending equity.
//    Drawdown is the percent fall from the highest equity so far to the
//    equity after each close. A single trade can still lose more than its
//    stake (a short). A list of ordinary trade percentages cannot.

export interface PnlTradeInput {
  pnl: number | string | null;
  entry_price?: number | string | null;
  entryPrice?: number | string | null;
  quantity?: number | string | null;
  opened_at?: string | null;
  openedAt?: string | null;
  closed_at?: string | null;
  closedAt?: string | null;
  status?: string | null;
}

export interface EquityPoint {
  /** Close time of the trade that produced this point. */
  t: string;
  equity: number;
  /** Percent change from starting capital. */
  returnPct: number;
  /** Percent fall from the peak equity so far. Zero or negative. */
  drawdownPct: number;
}

export interface AccountPerformance {
  /** Percent change of the simulated account. */
  accountReturnPct: number;
  /** Worst percent fall from a peak. Zero or negative. */
  maxDrawdownPct: number;
  /** Mean of each trade's percent, weighted by recorded notional. */
  weightedAverageReturnPct: number;
  /** Unweighted mean of each trade's own percent. */
  equalWeightAverageReturnPct: number;
  winRatePct: number;
  wins: number;
  losses: number;
  closedCount: number;
  startingCapital: number;
  endingEquity: number;
  equityCurve: EquityPoint[];
}

interface SizedTrade {
  id: number;
  pnlPct: number;
  notional: number;
  openMs: number;
  closeMs: number;
  closedAt: string;
}

function num(value: number | string | null | undefined): number | null {
  if (value == null || value === "") return null;
  const n = typeof value === "number" ? value : Number(value);
  return Number.isFinite(n) ? n : null;
}

function notionalOf(entry: number | null, quantity: number | null): number {
  const qty = quantity == null ? 1 : quantity;
  if (entry == null || entry <= 0 || qty <= 0) return 0;
  return entry * qty;
}

export function performanceFromTrades(trades: PnlTradeInput[]): AccountPerformance {
  const empty: AccountPerformance = {
    accountReturnPct: 0,
    maxDrawdownPct: 0,
    weightedAverageReturnPct: 0,
    equalWeightAverageReturnPct: 0,
    winRatePct: 0,
    wins: 0,
    losses: 0,
    closedCount: 0,
    startingCapital: 0,
    endingEquity: 0,
    equityCurve: [],
  };

  const closed = trades.filter((t) => {
    if (t.status != null && t.status !== "closed") return false;
    const pnl = num(t.pnl);
    const closedAt = t.closedAt ?? t.closed_at;
    return pnl != null && !!closedAt;
  });
  if (closed.length === 0) return empty;

  let wins = 0;
  let losses = 0;
  let pnlSum = 0;
  let weightSum = 0;
  let weightedSum = 0;
  const sized: SizedTrade[] = [];

  closed.forEach((t, index) => {
    const pnlPct = num(t.pnl)!;
    pnlSum += pnlPct;
    if (pnlPct > 0) wins += 1;
    else if (pnlPct < 0) losses += 1;

    const entry = num(t.entryPrice ?? t.entry_price);
    const quantity = num(t.quantity);
    const notional = notionalOf(entry, quantity);
    if (notional > 0) {
      weightSum += notional;
      weightedSum += pnlPct * notional;
    }

    const closedAt = (t.closedAt ?? t.closed_at)!;
    const openedAt = t.openedAt ?? t.opened_at ?? closedAt;
    let openMs = new Date(openedAt).getTime();
    let closeMs = new Date(closedAt).getTime();
    if (!Number.isFinite(closeMs)) return;
    if (!Number.isFinite(openMs) || openMs >= closeMs) openMs = closeMs - 1;
    if (notional > 0) {
      sized.push({ id: index, pnlPct, notional, openMs, closeMs, closedAt });
    }
  });

  const closedCount = closed.length;
  const equalWeightAverageReturnPct = pnlSum / closedCount;
  const weightedAverageReturnPct = weightSum > 0 ? weightedSum / weightSum : 0;
  const winRatePct = (wins / closedCount) * 100;

  if (sized.length === 0) {
    return {
      ...empty,
      equalWeightAverageReturnPct,
      weightedAverageReturnPct,
      winRatePct,
      wins,
      losses,
      closedCount,
    };
  }

  type Ev = { t: number; order: number; kind: "open" | "close"; trade: SizedTrade };
  const events: Ev[] = [];
  for (const trade of sized) {
    events.push({ t: trade.openMs, order: 1, kind: "open", trade });
    events.push({ t: trade.closeMs, order: 0, kind: "close", trade });
  }
  events.sort((a, b) => a.t - b.t || a.order - b.order || a.trade.id - b.trade.id);

  let running = 0;
  let startingCapital = 0;
  for (const ev of events) {
    if (ev.kind === "close") running -= ev.trade.notional;
    else {
      running += ev.trade.notional;
      if (running > startingCapital) startingCapital = running;
    }
  }
  if (startingCapital <= 0) {
    return {
      ...empty,
      equalWeightAverageReturnPct,
      weightedAverageReturnPct,
      winRatePct,
      wins,
      losses,
      closedCount,
    };
  }

  let cash = startingCapital;
  const deployed = new Map<number, number>();
  let peakEquity = startingCapital;
  let maxDrawdownPct = 0;
  const equityCurve: EquityPoint[] = [];

  for (const ev of events) {
    if (ev.kind === "open") {
      const deploy = Math.min(ev.trade.notional, Math.max(cash, 0));
      cash -= deploy;
      deployed.set(ev.trade.id, deploy);
      continue;
    }
    const deploy = deployed.get(ev.trade.id) ?? 0;
    deployed.delete(ev.trade.id);
    cash += deploy * (1 + ev.trade.pnlPct / 100);
    let stillOut = 0;
    for (const amount of deployed.values()) stillOut += amount;
    const equity = cash + stillOut;
    if (equity > peakEquity) peakEquity = equity;
    const drawdownPct = peakEquity === 0 ? 0 : ((equity - peakEquity) / peakEquity) * 100;
    if (drawdownPct < maxDrawdownPct) maxDrawdownPct = drawdownPct;
    equityCurve.push({
      t: ev.trade.closedAt,
      equity,
      returnPct: (equity / startingCapital - 1) * 100,
      drawdownPct,
    });
  }

  const endingEquity = cash;
  return {
    accountReturnPct: (endingEquity / startingCapital - 1) * 100,
    maxDrawdownPct,
    weightedAverageReturnPct,
    equalWeightAverageReturnPct,
    winRatePct,
    wins,
    losses,
    closedCount,
    startingCapital,
    endingEquity,
    equityCurve,
  };
}
