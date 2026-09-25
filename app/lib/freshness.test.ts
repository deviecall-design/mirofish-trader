import { describe, expect, it } from "vitest";
import {
  STALE_SIGNAL_AFTER_MS,
  formatSignalAge,
  isStaleSignal,
  signalAgeMs,
} from "./freshness";

const NOW = Date.parse("2026-09-25T00:00:00Z");

describe("signal freshness", () => {
  it("treats a signal from exactly 7 days ago as still fresh", () => {
    const created = new Date(NOW - STALE_SIGNAL_AFTER_MS).toISOString();
    expect(isStaleSignal(created, NOW)).toBe(false);
  });

  it("treats a signal older than 7 days as stale", () => {
    const created = new Date(NOW - STALE_SIGNAL_AFTER_MS - 1).toISOString();
    expect(isStaleSignal(created, NOW)).toBe(true);
  });

  it("keeps a 6-day-old signal in the headline", () => {
    const created = new Date(NOW - 6 * 24 * 60 * 60 * 1000).toISOString();
    expect(isStaleSignal(created, NOW)).toBe(false);
    expect(signalAgeMs(created, NOW)).toBe(6 * 24 * 60 * 60 * 1000);
  });

  it("formats age in days once it is past two days", () => {
    const created = new Date(NOW - 3 * 24 * 60 * 60 * 1000).toISOString();
    expect(formatSignalAge(created, NOW)).toBe("3d ago");
  });

  it("treats an unreadable timestamp as stale", () => {
    expect(isStaleSignal("not-a-date", NOW)).toBe(true);
    expect(formatSignalAge("not-a-date", NOW)).toBe("unknown age");
  });
});
