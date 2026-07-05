import { describe, it, expect } from "vitest";
import { checkOrder, riskConfigFromEnv, type RiskConfig } from "./risk";

const cfg: RiskConfig = {
  killSwitch: false,
  maxPositionUsd: 100,
  maxOpenPositions: 3,
  dailyLossLimitUsd: 50,
};

const cleanState = { openPositions: 0, todayRealizedPnlUsd: 0 };
const order = { symbol: "BTC", side: "BUY" as const, notionalUsd: 50 };

describe("checkOrder", () => {
  it("allows a small order in a clean state", () => {
    expect(checkOrder(order, cleanState, cfg)).toEqual({ allowed: true });
  });

  it("blocks everything when the kill switch is on", () => {
    const res = checkOrder(order, cleanState, { ...cfg, killSwitch: true });
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/kill switch/i);
  });

  it("blocks orders over the per-order notional cap", () => {
    const res = checkOrder({ ...order, notionalUsd: 101 }, cleanState, cfg);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/position/i);
  });

  it("blocks when max open positions is reached", () => {
    const res = checkOrder(order, { ...cleanState, openPositions: 3 }, cfg);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/open positions/i);
  });

  it("blocks when the daily loss limit is hit", () => {
    const res = checkOrder(order, { openPositions: 0, todayRealizedPnlUsd: -50 }, cfg);
    expect(res.allowed).toBe(false);
    if (!res.allowed) expect(res.reason).toMatch(/daily loss/i);
  });

  it("rejects non-positive notionals", () => {
    expect(checkOrder({ ...order, notionalUsd: 0 }, cleanState, cfg).allowed).toBe(false);
  });
});

describe("riskConfigFromEnv", () => {
  it("uses safe defaults when env vars are unset", () => {
    delete process.env.KILL_SWITCH;
    delete process.env.MAX_POSITION_USD;
    delete process.env.MAX_OPEN_POSITIONS;
    delete process.env.DAILY_LOSS_LIMIT_USD;
    expect(riskConfigFromEnv()).toEqual({
      killSwitch: false,
      maxPositionUsd: 100,
      maxOpenPositions: 3,
      dailyLossLimitUsd: 50,
    });
  });

  it("reads overrides from env", () => {
    process.env.KILL_SWITCH = "true";
    process.env.MAX_POSITION_USD = "250";
    process.env.MAX_OPEN_POSITIONS = "5";
    process.env.DAILY_LOSS_LIMIT_USD = "75";
    expect(riskConfigFromEnv()).toEqual({
      killSwitch: true,
      maxPositionUsd: 250,
      maxOpenPositions: 5,
      dailyLossLimitUsd: 75,
    });
    delete process.env.KILL_SWITCH;
    delete process.env.MAX_POSITION_USD;
    delete process.env.MAX_OPEN_POSITIONS;
    delete process.env.DAILY_LOSS_LIMIT_USD;
  });
});
