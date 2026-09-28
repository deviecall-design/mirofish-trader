import { afterEach, describe, expect, it, vi } from "vitest";
import {
  fetchEodhdRealtime,
  parseEodhdNumber,
  parseRealtimePayload,
  resolveEodhdQuote,
  toEodhdCode,
} from "./eodhd";
import { clearPriceCache, fetchMarketQuotes, fetchPrice } from "./prices";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

afterEach(() => {
  clearPriceCache();
  vi.unstubAllGlobals();
  delete process.env.EODHD_API_KEY;
});

describe("toEodhdCode", () => {
  it("keeps the exchange on every symbol", () => {
    expect(toEodhdCode("NVDA")).toBe("NVDA.US");
    expect(toEodhdCode("slx")).toBe("SLX.US");
    expect(toEodhdCode("SLX.AX")).toBe("SLX.AU");
    expect(toEodhdCode("AW1.AX")).toBe("AW1.AU");
    expect(toEodhdCode("IMP.JO")).toBe("IMP.JSE");
    expect(toEodhdCode("BP.L")).toBe("BP.LSE");
    expect(toEodhdCode("1SN.L")).toBe("1SN.LSE");
  });

  it("leaves crypto and unmapped suffixes on the other sources", () => {
    expect(toEodhdCode("BTC")).toBeNull();
    expect(toEodhdCode("ETH")).toBeNull();
    expect(toEodhdCode("BRK.B")).toBeNull();
    expect(toEodhdCode("")).toBeNull();
  });
});

describe("NA quotes", () => {
  it("treats the string NA as missing", () => {
    expect(parseEodhdNumber("NA")).toBeNull();
    expect(parseEodhdNumber("na")).toBeNull();
    expect(parseEodhdNumber("")).toBeNull();
    expect(parseEodhdNumber(12.5)).toBe(12.5);
    const [row] = parseRealtimePayload({
      code: "IMP.JSE",
      close: "NA",
      previousClose: "NA",
      change_p: "NA",
      timestamp: "NA",
    });
    expect(row).toEqual({
      code: "IMP.JSE",
      close: null,
      previousClose: null,
      changePercent: null,
      timestamp: null,
    });
  });

  it("uses the latest daily close when real-time is NA", () => {
    const resolved = resolveEodhdQuote(
      { code: "IMP.JSE", close: null, previousClose: null, changePercent: null, timestamp: null },
      [
        { date: "2026-09-16", open: 1, high: 1, low: 1, close: 20010, volume: 1 },
        { date: "2026-09-17", open: 1, high: 1, low: 1, close: 19874, volume: 1 },
      ]
    );
    expect(resolved).toMatchObject({ price: 19874, asOf: "2026-09-17" });
  });

  it("keeps a live close unmarked", () => {
    const resolved = resolveEodhdQuote(
      { code: "NVDA.US", close: 224.5, previousClose: 220, changePercent: 2, timestamp: 1 },
      []
    );
    expect(resolved).toMatchObject({ price: 224.5, asOf: null });
  });
});

describe("fetchMarketQuotes", () => {
  it("labels an NA real-time quote with the daily close", async () => {
    process.env.EODHD_API_KEY = "test-key";
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      if (url.includes("/api/real-time/IMP.JSE")) {
        return json({
          code: "IMP.JSE",
          timestamp: "NA",
          close: "NA",
          previousClose: "NA",
          change_p: "NA",
        });
      }
      if (url.includes("/api/eod/IMP.JSE")) {
        return json([
          { date: "2026-09-16", open: 20000, high: 20100, low: 19900, close: 20010, volume: 1 },
          { date: "2026-09-17", open: 20010, high: 20100, low: 19800, close: 19874, volume: 2 },
        ]);
      }
      return new Response("no", { status: 404 });
    });

    const [quote] = await fetchMarketQuotes(["IMP.JO"], { sparkline: false });
    expect(quote).toMatchObject({
      price: 19874,
      currency: "ZAc",
      source: "eodhd",
      asOf: "2026-09-17",
    });
    expect(urls.every((url) => url.includes("api_token=test-key"))).toBe(true);
    expect(urls.every((url) => !url.includes("NEXT_PUBLIC"))).toBe(true);
    expect(urls.every((url) => url.includes("eodhd.com"))).toBe(true);
  });

  it("batches extra tickers on the s parameter", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      return json([
        { code: "NVDA.US", close: 1, previousClose: 1, change_p: 0, timestamp: 1 },
        { code: "MSFT.US", close: 2, previousClose: 2, change_p: 0, timestamp: 1 },
      ]);
    });
    await fetchEodhdRealtime(["NVDA.US", "MSFT.US"], "test-key");
    expect(urls[0]).toContain("/api/real-time/NVDA.US");
    expect(urls[0]).toContain("s=MSFT.US");
    expect(urls[0]).toContain("api_token=test-key");
  });

  it("uses Yahoo when the key is unset", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      if (url.includes("query1") && url.includes("DRO.AX")) {
        return json({
          chart: {
            result: [
              {
                meta: { currency: "AUD", regularMarketPrice: 1.6, regularMarketChangePercent: 0.2 },
                timestamp: [1],
                indicators: { quote: [{ close: [1.6], open: [1.5], high: [1.7], low: [1.4], volume: [1] }] },
              },
            ],
          },
        });
      }
      return new Response("no", { status: 404 });
    });
    const quote = await fetchPrice("DRO.AX");
    expect(quote).toMatchObject({ source: "yahoo", price: 1.6, asOf: null });
    expect(urls.some((url) => url.includes("eodhd.com"))).toBe(false);
  });

  it("does not cache a failed quote", async () => {
    let calls = 0;
    vi.stubGlobal("fetch", async () => {
      calls += 1;
      return new Response("no", { status: 500 });
    });
    expect(await fetchPrice("NVDA")).toBeNull();
    expect(await fetchPrice("NVDA")).toBeNull();
    expect(calls).toBeGreaterThan(2);
  });
});

describe("demo token", () => {
  it("reads a live AAPL.US quote", async () => {
    const rows = await fetchEodhdRealtime(["AAPL.US"], "demo");
    expect(rows[0]?.code).toBe("AAPL.US");
    expect(rows[0]?.close).toBeGreaterThan(0);
  }, 15_000);
});
