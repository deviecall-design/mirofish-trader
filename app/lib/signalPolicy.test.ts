import { describe, expect, it } from "vitest";
import { canOpenTrade } from "./signalPolicy";

describe("canOpenTrade", () => {
  it("allows a bullish or bearish signal to open a trade", () => {
    expect(canOpenTrade("bullish")).toBe(true);
    expect(canOpenTrade("bearish")).toBe(true);
  });

  it("does not open a trade for a neutral signal", () => {
    expect(canOpenTrade("neutral")).toBe(false);
    expect(canOpenTrade(null)).toBe(false);
    expect(canOpenTrade(undefined)).toBe(false);
  });
});
