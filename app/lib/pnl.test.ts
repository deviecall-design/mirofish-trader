import { describe, expect, it } from "vitest";
import { performanceFromTrades, type PnlTradeInput } from "./pnl";

function trade(
  pnl: number,
  entry: number,
  open: string,
  close: string,
  quantity = 1
): PnlTradeInput {
  return {
    pnl,
    entry_price: entry,
    quantity,
    opened_at: open,
    closed_at: close,
    status: "closed",
  };
}

describe("performanceFromTrades", () => {
  it("compounds a run of losses instead of summing percentages past -100", () => {
    // Four full-size -40% losses. Adding the percentages gives -160%, which
    // cannot be the account. The account can only redeploy the cash it has left.
    const rows = [1, 2, 3, 4].map((n) =>
      trade(-40, 100, `2026-01-0${n}T00:00:00Z`, `2026-01-0${n}T12:00:00Z`)
    );
    const result = performanceFromTrades(rows);
    const summed = rows.reduce((s, r) => s + Number(r.pnl), 0);

    expect(summed).toBe(-160);
    expect(result.accountReturnPct).toBeCloseTo(-87.04, 2);
    expect(result.maxDrawdownPct).toBeCloseTo(-87.04, 2);
    expect(result.maxDrawdownPct).toBeGreaterThan(-100);
    expect(result.accountReturnPct).not.toBeCloseTo(summed, 0);
  });

  it("weights a large position more than a small one and reinvests the cash", () => {
    // Notional 300 at -10%, then notional 100 at +50%. They do not overlap.
    // Dollar P&L is -30 + 50 = +20 on starting capital 300 → +6.666...%.
    // The size-weighted average of the two trade percentages is +5%.
    // The old sum of percentages is +40%.
    const result = performanceFromTrades([
      trade(-10, 300, "2026-02-01T00:00:00Z", "2026-02-01T12:00:00Z"),
      trade(50, 100, "2026-02-02T00:00:00Z", "2026-02-02T12:00:00Z"),
    ]);

    expect(result.startingCapital).toBe(300);
    expect(result.accountReturnPct).toBeCloseTo(20 / 3, 5);
    expect(result.weightedAverageReturnPct).toBeCloseTo(5, 5);
    expect(result.maxDrawdownPct).toBeCloseTo(-10, 5);
    expect(result.equalWeightAverageReturnPct).toBeCloseTo(20, 5);
  });

  it("draws down from peak equity, not from a running sum of percentages", () => {
    // +10% then -20% on the same notional.
    // Equity 100 → 110 → 90. Drawdown from 110 to 90 is -18.181...%.
    // A summed curve would call the drop from +10 to -10 a -20 point move.
    const result = performanceFromTrades([
      trade(10, 100, "2026-03-01T00:00:00Z", "2026-03-01T12:00:00Z"),
      trade(-20, 100, "2026-03-02T00:00:00Z", "2026-03-02T12:00:00Z"),
    ]);

    expect(result.accountReturnPct).toBeCloseTo(-10, 5);
    expect(result.maxDrawdownPct).toBeCloseTo((-20 / 110) * 100, 5);
    expect(result.equityCurve.map((p) => Number(p.returnPct.toFixed(2)))).toEqual([10, -10]);
  });

  it("marks overlapping trades at cost until each one closes", () => {
    const result = performanceFromTrades([
      trade(-10, 100, "2026-04-01T00:00:00Z", "2026-04-02T00:00:00Z"),
      trade(10, 100, "2026-04-01T00:00:00Z", "2026-04-03T00:00:00Z"),
    ]);

    expect(result.startingCapital).toBe(200);
    expect(result.accountReturnPct).toBeCloseTo(0, 5);
    expect(result.maxDrawdownPct).toBeCloseTo(-5, 5);
    expect(result.equityCurve[0].drawdownPct).toBeCloseTo(-5, 5);
    expect(result.equityCurve[1].returnPct).toBeCloseTo(0, 5);
  });

  it("allows one trade to lose more than its stake", () => {
    // A short (or a bad print) can lose more than 100% of the notional.
    // That is a real loss. The bug was many small trade percentages adding
    // up to a drawdown no single account produced.
    const result = performanceFromTrades([
      trade(-150, 100, "2026-05-01T00:00:00Z", "2026-05-01T12:00:00Z"),
    ]);
    expect(result.accountReturnPct).toBeCloseTo(-150, 5);
    expect(result.maxDrawdownPct).toBeCloseTo(-150, 5);
  });

  it("counts wins without letting an unsized trade move the account", () => {
    const result = performanceFromTrades([
      {
        pnl: 10,
        entry_price: 0,
        quantity: 1,
        opened_at: "2026-06-01T00:00:00Z",
        closed_at: "2026-06-01T12:00:00Z",
        status: "closed",
      },
    ]);
    expect(result.wins).toBe(1);
    expect(result.closedCount).toBe(1);
    expect(result.accountReturnPct).toBe(0);
    expect(result.startingCapital).toBe(0);
    expect(result.equityCurve).toEqual([]);
  });

  it("ignores open trades and returns zeros when nothing has closed", () => {
    const result = performanceFromTrades([
      {
        pnl: null,
        entry_price: 100,
        quantity: 1,
        opened_at: "2026-07-01T00:00:00Z",
        closed_at: null,
        status: "open",
      },
    ]);
    expect(result.closedCount).toBe(0);
    expect(result.accountReturnPct).toBe(0);
    expect(result.maxDrawdownPct).toBe(0);
  });

  it("reads numeric strings the way Supabase returns them", () => {
    const result = performanceFromTrades([
      {
        pnl: "5.5",
        entry_price: "20",
        quantity: "2",
        opened_at: "2026-08-01T00:00:00Z",
        closed_at: "2026-08-01T06:00:00Z",
        status: "closed",
      },
    ]);
    expect(result.startingCapital).toBe(40);
    expect(result.accountReturnPct).toBeCloseTo(5.5, 5);
    expect(result.wins).toBe(1);
    expect(result.losses).toBe(0);
  });
});
