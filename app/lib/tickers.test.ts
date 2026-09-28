import { describe, expect, it } from "vitest";
import {
  hitsFromYahooSearch,
  looksLikeTicker,
  resolveWatchlistSymbol,
} from "./tickers";

describe("looksLikeTicker", () => {
  it("accepts exchange symbols and rejects company names", () => {
    expect(looksLikeTicker("NVDA")).toBe(true);
    expect(looksLikeTicker("DRO.AX")).toBe(true);
    expect(looksLikeTicker("1SN.L")).toBe(true);
    expect(looksLikeTicker("IMP.JO")).toBe(true);
    expect(looksLikeTicker("CENTRUS")).toBe(false);
    expect(looksLikeTicker("LIGHTBRIDGE")).toBe(false);
    expect(looksLikeTicker("NUSCALE")).toBe(false);
    expect(looksLikeTicker("Centrus Energy")).toBe(false);
  });
});

describe("resolveWatchlistSymbol", () => {
  it("keeps a ticker that has a quote", async () => {
    const result = await resolveWatchlistSymbol(" dro.ax ", {
      hasQuote: async (symbol) => symbol === "DRO.AX",
      search: async () => [],
    });
    expect(result).toEqual({ ok: true, symbol: "DRO.AX" });
  });

  it("does not save a company name, and resolves an unambiguous listing", async () => {
    const result = await resolveWatchlistSymbol("Centrus", {
      hasQuote: async () => false,
      search: async () => [
        { symbol: "LEU", name: "Centrus Energy Corp." },
        { symbol: "4CU.MU", name: "Centrus Energy Corp." },
      ],
    });
    expect(result).toEqual({ ok: true, symbol: "LEU", resolvedFrom: "CENTRUS" });
  });

  it("refuses a name when several primary listings match", async () => {
    const result = await resolveWatchlistSymbol("LIGHTBRIDGE", {
      hasQuote: async () => false,
      search: async () => [
        { symbol: "LTBR", name: "Lightbridge" },
        { symbol: "LBTR", name: "Something else" },
      ],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/LTBR/);
  });

  it("refuses a ticker-shaped symbol that has no price", async () => {
    const result = await resolveWatchlistSymbol("ZZZZ", {
      hasQuote: async () => false,
      search: async () => [{ symbol: "ZZZ", name: "Nope" }],
    });
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.reason).toMatch(/No price for ZZZZ/);
  });
});

describe("hitsFromYahooSearch", () => {
  it("drops non-equity hits and names that are not tickers", () => {
    const hits = hitsFromYahooSearch({
      quotes: [
        { symbol: "LEU", shortname: "Centrus Energy", quoteType: "EQUITY" },
        { symbol: "CENTRUS", shortname: "not a ticker", quoteType: "EQUITY" },
        { symbol: "LEU", shortname: "news", quoteType: "INDEX" },
      ],
    });
    expect(hits).toEqual([{ symbol: "LEU", name: "Centrus Energy" }]);
  });
});
