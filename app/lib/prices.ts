// Server-side quotes. The browser must not call Yahoo: the chart response has
// no Access-Control-Allow-Origin header, so those fetches fail with a CORS
// error and the screener stays blank. Yahoo also answers 429 when the
// User-Agent is missing, and api.binance.com refuses US/datacenter regions.
// Callers (route handlers, cron) use this module. `cache: "no-store"` keeps a
// 429 out of the Next.js data cache; successes are remembered in memory.
//
// `price` stays in the provider's raw quote unit. Percent P&L compares that
// number with older signal rows, so do not rescale it here. Display code in
// currency.ts converts cents/pence for labels only.

import { displayCurrency, quoteCurrencyForSymbol, toDisplay } from "./currency";

const CRYPTO_PAIRS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

const YAHOO_HOSTS = [
  "https://query1.finance.yahoo.com",
  "https://query2.finance.yahoo.com",
];

// Public market-data host. api.binance.com returns "restricted location"
// from the US, which is where this app's server runs.
const BINANCE_HOSTS = [
  "https://data-api.binance.vision",
  "https://api.binance.com",
];

const BROWSER_UA =
  "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36";

const QUOTE_TTL_MS = 60_000;
const HISTORY_TTL_MS = 5 * 60_000;
const FAILURE_TTL_MS = 15_000;
const QUOTE_TIMEOUT_MS = 8_000;

export interface PriceQuote {
  symbol: string;
  price: number;
  /** Provider quote currency, including minor units such as ZAc or GBp. */
  currency: string;
  source: "binance" | "yahoo";
}

export interface MarketQuote {
  price: number | null;
  currency: string;
  changePercent: number | null;
  marketCapB: number | null;
  sparkline: number[];
  source: "binance" | "yahoo" | null;
}

export interface OhlcvBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

export interface ParsedYahoo {
  currency: string | null;
  price: number | null;
  changePercent: number | null;
  marketCap: number | null;
  closes: number[];
  bars: OhlcvBar[];
}

interface CacheEntry<T> {
  expires: number;
  value: T;
}

const quoteCache = new Map<string, CacheEntry<MarketQuote>>();
const historyCache = new Map<string, CacheEntry<HistoryPayload | null>>();

interface HistoryPayload {
  currency: string;
  bars: OhlcvBar[];
}

export function clearPriceCache() {
  quoteCache.clear();
  historyCache.clear();
}

export function isCrypto(symbol: string): boolean {
  return symbol.toUpperCase() in CRYPTO_PAIRS;
}

export function readYahooChart(data: unknown): ParsedYahoo | null {
  const result = (data as { chart?: { result?: unknown[] } } | null)?.chart?.result?.[0] as
    | {
        meta?: {
          currency?: string;
          regularMarketPrice?: number;
          regularMarketChangePercent?: number;
          marketCap?: number;
        };
        timestamp?: number[];
        indicators?: { quote?: Array<Record<string, Array<number | null>>> };
      }
    | undefined;
  if (!result) return null;

  const quote = result.indicators?.quote?.[0];
  const timestamps = result.timestamp ?? [];
  const bars: OhlcvBar[] = [];
  const closes: number[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const close = quote?.close?.[i];
    if (typeof close === "number") closes.push(close);
    const open = quote?.open?.[i];
    const high = quote?.high?.[i];
    const low = quote?.low?.[i];
    if ([open, high, low, close].some((n) => typeof n !== "number")) continue;
    const volume = quote?.volume?.[i];
    bars.push({
      timestamp: new Date(timestamps[i] * 1000).toISOString(),
      open: open as number,
      high: high as number,
      low: low as number,
      close: close as number,
      volume: typeof volume === "number" ? volume : 0,
    });
  }

  const metaPrice = result.meta?.regularMarketPrice;
  const price =
    typeof metaPrice === "number"
      ? metaPrice
      : closes.length
        ? closes[closes.length - 1]
        : null;
  if (price == null && bars.length === 0) return null;

  let changePercent =
    typeof result.meta?.regularMarketChangePercent === "number"
      ? result.meta.regularMarketChangePercent
      : null;
  if (changePercent == null && closes.length >= 2) {
    const prev = closes[closes.length - 2];
    const last = closes[closes.length - 1];
    if (prev) changePercent = ((last - prev) / prev) * 100;
  }

  return {
    currency: result.meta?.currency ?? null,
    price,
    changePercent,
    marketCap: typeof result.meta?.marketCap === "number" ? result.meta.marketCap : null,
    closes,
    bars,
  };
}

async function fetchJson(url: string, timeoutMs = QUOTE_TIMEOUT_MS): Promise<{
  ok: boolean;
  status: number;
  data: unknown;
}> {
  try {
    const res = await fetch(url, {
      headers: {
        "User-Agent": BROWSER_UA,
        Accept: "application/json,text/plain,*/*",
        "Accept-Language": "en-US,en;q=0.9",
      },
      cache: "no-store",
      signal: AbortSignal.timeout(timeoutMs),
    });
    if (!res.ok) return { ok: false, status: res.status, data: null };
    return { ok: true, status: res.status, data: await res.json() };
  } catch {
    return { ok: false, status: 0, data: null };
  }
}

async function fetchYahooChart(
  symbol: string,
  range: string,
  interval: string
): Promise<ParsedYahoo | null> {
  for (const host of YAHOO_HOSTS) {
    const url = `${host}/v8/finance/chart/${encodeURIComponent(symbol)}?interval=${interval}&range=${range}`;
    const res = await fetchJson(url);
    if (!res.ok || res.data == null) continue;
    const parsed = readYahooChart(res.data);
    if (parsed) return parsed;
  }
  return null;
}

function emptyQuote(symbol: string): MarketQuote {
  return {
    price: null,
    currency: quoteCurrencyForSymbol(symbol),
    changePercent: null,
    marketCapB: null,
    sparkline: [],
    source: null,
  };
}

async function fetchBinanceTicker(pair: string): Promise<{
  price: number;
  changePercent: number | null;
} | null> {
  for (const host of BINANCE_HOSTS) {
    const res = await fetchJson(`${host}/api/v3/ticker/24hr?symbol=${pair}`, 6_000);
    if (!res.ok || !res.data || typeof res.data !== "object") continue;
    const body = res.data as { lastPrice?: string; priceChangePercent?: string; price?: string };
    const price = parseFloat(body.lastPrice ?? body.price ?? "");
    if (!Number.isFinite(price)) continue;
    const change = parseFloat(body.priceChangePercent ?? "");
    return { price, changePercent: Number.isFinite(change) ? change : null };
  }
  return null;
}

async function fetchBinanceSparkline(pair: string): Promise<number[]> {
  for (const host of BINANCE_HOSTS) {
    const res = await fetchJson(
      `${host}/api/v3/klines?symbol=${pair}&interval=1d&limit=7`,
      6_000
    );
    if (!res.ok || !Array.isArray(res.data)) continue;
    const closes = (res.data as unknown[][])
      .map((row) => parseFloat(String(row[4])))
      .filter((n) => Number.isFinite(n));
    if (closes.length) return closes;
  }
  return [];
}

async function loadMarketQuote(symbol: string): Promise<MarketQuote> {
  if (isCrypto(symbol)) {
    const pair = CRYPTO_PAIRS[symbol];
    const [ticker, sparkline] = await Promise.all([
      fetchBinanceTicker(pair),
      fetchBinanceSparkline(pair),
    ]);
    if (ticker) {
      return {
        price: ticker.price,
        currency: "USD",
        changePercent: ticker.changePercent,
        marketCapB: null,
        sparkline,
        source: "binance",
      };
    }
    const yahoo = await fetchYahooChart(`${symbol}-USD`, "10d", "1d");
    if (yahoo?.price != null) {
      return {
        price: yahoo.price,
        currency: yahoo.currency ?? "USD",
        changePercent: yahoo.changePercent,
        marketCapB: null,
        sparkline: yahoo.closes.slice(-7),
        source: "yahoo",
      };
    }
    return emptyQuote(symbol);
  }

  const yahoo = await fetchYahooChart(symbol, "10d", "1d");
  if (!yahoo || yahoo.price == null) return emptyQuote(symbol);
  return {
    price: yahoo.price,
    currency: yahoo.currency ?? quoteCurrencyForSymbol(symbol),
    changePercent: yahoo.changePercent,
    marketCapB: yahoo.marketCap != null ? yahoo.marketCap / 1e9 : null,
    sparkline: yahoo.closes.slice(-7),
    source: "yahoo",
  };
}

export async function fetchMarketQuote(symbol: string): Promise<MarketQuote> {
  const key = symbol.toUpperCase();
  const hit = quoteCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loadMarketQuote(key);
  quoteCache.set(key, {
    expires: Date.now() + (value.price == null ? FAILURE_TTL_MS : QUOTE_TTL_MS),
    value,
  });
  return value;
}

export async function fetchPrice(symbol: string): Promise<PriceQuote | null> {
  const quote = await fetchMarketQuote(symbol);
  if (quote.price == null || quote.source == null) return null;
  return {
    symbol: symbol.toUpperCase(),
    price: quote.price,
    currency: quote.currency,
    source: quote.source,
  };
}

async function fetchBinanceKlines(pair: string, bars: number): Promise<OhlcvBar[] | null> {
  const limit = Math.min(bars, 1000);
  for (const host of BINANCE_HOSTS) {
    const res = await fetchJson(
      `${host}/api/v3/klines?symbol=${pair}&interval=1h&limit=${limit}`,
      8_000
    );
    if (!res.ok || !Array.isArray(res.data)) continue;
    const barsOut: OhlcvBar[] = [];
    for (const row of res.data as unknown[][]) {
      const openTime = Number(row[0]);
      const [open, high, low, close, volume] = [1, 2, 3, 4, 5].map((i) => parseFloat(String(row[i])));
      if (![open, high, low, close].every((n) => Number.isFinite(n))) continue;
      barsOut.push({
        timestamp: new Date(openTime).toISOString(),
        open,
        high,
        low,
        close,
        volume: Number.isFinite(volume) ? volume : 0,
      });
    }
    if (barsOut.length) return barsOut;
  }
  return null;
}

async function loadHistory(symbol: string, bars: number): Promise<HistoryPayload | null> {
  if (isCrypto(symbol)) {
    const cryptoBars = await fetchBinanceKlines(CRYPTO_PAIRS[symbol], bars);
    if (cryptoBars) return { currency: "USD", bars: cryptoBars };
    const yahoo = await fetchYahooChart(`${symbol}-USD`, "2y", "1d");
    if (!yahoo?.bars.length) return null;
    return { currency: yahoo.currency ?? "USD", bars: yahoo.bars.slice(-bars) };
  }

  const yahoo = await fetchYahooChart(symbol, "2y", "1d");
  if (!yahoo?.bars.length) return null;
  return {
    currency: yahoo.currency ?? quoteCurrencyForSymbol(symbol),
    bars: yahoo.bars.slice(-bars),
  };
}

async function historyFor(symbol: string, bars: number): Promise<HistoryPayload | null> {
  const key = `${symbol.toUpperCase()}:${bars}`;
  const hit = historyCache.get(key);
  if (hit && hit.expires > Date.now()) return hit.value;
  const value = await loadHistory(symbol.toUpperCase(), bars);
  historyCache.set(key, {
    expires: Date.now() + (value ? HISTORY_TTL_MS : FAILURE_TTL_MS),
    value,
  });
  return value;
}

export async function fetchOhlcvHistory(symbol: string, bars: number): Promise<OhlcvBar[] | null> {
  const history = await historyFor(symbol, bars);
  return history?.bars ?? null;
}

/** Chart display series. Prices are converted out of minor units; volume is not. */
export async function fetchDisplayHistory(
  symbol: string,
  bars: number
): Promise<{ currency: string; bars: OhlcvBar[] } | null> {
  const history = await historyFor(symbol, bars);
  if (!history) return null;
  const scale = (n: number) => toDisplay(n, history.currency).amount;
  return {
    currency: displayCurrency(history.currency),
    bars: history.bars.map((bar) => ({
      ...bar,
      open: scale(bar.open),
      high: scale(bar.high),
      low: scale(bar.low),
      close: scale(bar.close),
    })),
  };
}

export async function mapPool<T, R>(
  items: T[],
  limit: number,
  fn: (item: T) => Promise<R>
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  const workers = Array.from({ length: Math.min(limit, items.length) }, async () => {
    while (next < items.length) {
      const index = next++;
      out[index] = await fn(items[index]);
    }
  });
  await Promise.all(workers);
  return out;
}
