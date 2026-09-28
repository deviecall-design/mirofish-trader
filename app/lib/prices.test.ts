import { afterEach, describe, expect, it, vi } from "vitest";
import { clearPriceCache, fetchPrice, readYahooChart } from "./prices";

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function chart(symbol: string, currency: string, price: number) {
  return {
    chart: {
      result: [
        {
          meta: {
            currency,
            symbol,
            regularMarketPrice: price,
            regularMarketChangePercent: -0.4,
            marketCap: 2_500_000_000_000,
          },
          timestamp: [1_700_000_000, 1_700_086_400],
          indicators: {
            quote: [
              {
                open: [price - 1, price],
                high: [price, price + 1],
                low: [price - 2, price - 1],
                close: [price - 1, price],
                volume: [10, 12],
              },
            ],
          },
        },
      ],
    },
  };
}

afterEach(() => {
  clearPriceCache();
  vi.unstubAllGlobals();
});

describe("readYahooChart", () => {
  it("keeps the raw JSE quote in cents", () => {
    const parsed = readYahooChart(chart("IMP.JO", "ZAc", 19874));
    expect(parsed?.price).toBe(19874);
    expect(parsed?.currency).toBe("ZAc");
    expect(parsed?.bars).toHaveLength(2);
  });

  it("returns null when Yahoo has no result", () => {
    expect(readYahooChart({ chart: { result: null, error: { code: "Not Found" } } })).toBeNull();
  });
});

describe("fetchPrice", () => {
  it("sends a browser User-Agent and falls back to the second Yahoo host", async () => {
    const calls: { url: string; ua: string | null; cache: RequestCache | undefined }[] = [];
    vi.stubGlobal("fetch", async (url: string, init?: RequestInit) => {
      const headers = new Headers(init?.headers);
      calls.push({ url, ua: headers.get("user-agent"), cache: init?.cache });
      if (url.includes("query1")) return new Response("slow down", { status: 429 });
      if (url.includes("query2") && url.includes("DRO.AX")) return json(chart("DRO.AX", "AUD", 1.602));
      return new Response("no", { status: 404 });
    });

    const quote = await fetchPrice("DRO.AX");
    expect(quote).toMatchObject({ symbol: "DRO.AX", price: 1.602, currency: "AUD", source: "yahoo" });
    expect(calls.some((call) => call.url.includes("query1"))).toBe(true);
    expect(calls.some((call) => call.url.includes("query2") && call.url.includes("DRO.AX"))).toBe(true);
    expect(calls.every((call) => call.ua?.includes("Mozilla"))).toBe(true);
    expect(calls.every((call) => call.cache === "no-store")).toBe(true);
  });

  it("uses Binance public market data for BTC, not the geo-blocked host first", async () => {
    const urls: string[] = [];
    vi.stubGlobal("fetch", async (url: string) => {
      urls.push(url);
      if (url.includes("data-api.binance.vision") && url.includes("ticker/24hr")) {
        return json({ lastPrice: "84000.5", priceChangePercent: "1.2" });
      }
      if (url.includes("data-api.binance.vision") && url.includes("klines")) {
        return json([[0, "1", "2", "0.5", "84000", "3"]]);
      }
      return new Response("no", { status: 500 });
    });

    const quote = await fetchPrice("BTC");
    expect(quote).toMatchObject({ symbol: "BTC", price: 84000.5, currency: "USD", source: "binance" });
    expect(urls.some((url) => url.startsWith("https://data-api.binance.vision"))).toBe(true);
    expect(urls.some((url) => url.includes("api.binance.com"))).toBe(false);
  });

  it("returns null when every host fails, instead of a blank number", async () => {
    vi.stubGlobal("fetch", async () => {
      throw new DOMException("The operation was aborted due to timeout", "TimeoutError");
    });
    expect(await fetchPrice("NVDA")).toBeNull();
  });
});
