import { describe, expect, it } from "vitest";
import { formatInputLine, type InputReading } from "./inputAvailability";

const live = (value: number): InputReading => ({ value, available: true, detail: null });

describe("formatInputLine", () => {
  it("records a live reading", () => {
    expect(formatInputLine(live(0.12), live(-0.4))).toBe(
      "Inputs: macro +0.12; social -0.40."
    );
  });

  it("says when an input fell back to 0", () => {
    const line = formatInputLine(
      { value: 0, available: false, detail: "FRED_API_KEY is not set" },
      { value: 0, available: false, detail: "StockTwits returned no messages" }
    );
    expect(line).toContain("macro unavailable, treated as 0");
    expect(line).toContain("FRED_API_KEY is not set");
    expect(line).toContain("social unavailable, treated as 0");
    expect(line).not.toMatch(/macro \+0\.00/);
  });

  it("keeps a partial macro reading visible", () => {
    const line = formatInputLine(
      { value: -0.2, available: true, detail: "Missing VIX" },
      live(0)
    );
    expect(line).toContain("macro -0.20 (Missing VIX)");
    expect(line).toContain("social +0.00");
  });
});
