// Price fetching: Binance public API for crypto (BTC/ETH), Yahoo Finance v8 quote endpoint for equities.
// Both endpoints are public and unauthenticated — no API keys required.

const CRYPTO_PAIRS: Record<string, string> = {
  BTC: "BTCUSDT",
  ETH: "ETHUSDT",
};

export interface PriceQuote {
  symbol: string;
  price: number;
  source: "binance" | "yahoo";
}

export function isCrypto(symbol: string): boolean {
  return symbol.toUpperCase() in CRYPTO_PAIRS;
}

async function fetchCrypto(symbol: string): Promise<PriceQuote | null> {
  const pair = CRYPTO_PAIRS[symbol.toUpperCase()];
  if (!pair) return null;
  const res = await fetch(
    `https://api.binance.com/api/v3/ticker/price?symbol=${pair}`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as { price?: string };
  const price = parseFloat(data.price ?? "");
  if (isNaN(price)) return null;
  return { symbol: symbol.toUpperCase(), price, source: "binance" };
}

async function fetchEquity(symbol: string): Promise<PriceQuote | null> {
  // Yahoo Finance v8 chart endpoint — returns last close.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=5d`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    next: { revalidate: 60 },
  });
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const price =
    result?.meta?.regularMarketPrice ??
    result?.indicators?.quote?.[0]?.close?.slice(-1)?.[0];
  if (typeof price !== "number") return null;
  return { symbol: symbol.toUpperCase(), price, source: "yahoo" as const };
}

export async function fetchPrice(symbol: string): Promise<PriceQuote | null> {
  if (isCrypto(symbol)) return fetchCrypto(symbol);
  return fetchEquity(symbol);
}

export interface OhlcvBar {
  timestamp: string;
  open: number;
  high: number;
  low: number;
  close: number;
  volume: number;
}

async function fetchCryptoHistory(symbol: string, bars: number): Promise<OhlcvBar[] | null> {
  const pair = CRYPTO_PAIRS[symbol.toUpperCase()];
  if (!pair) return null;
  const res = await fetch(
    `https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1h&limit=${Math.min(
      bars,
      1000
    )}`,
    { cache: "no-store" }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as [number, string, string, string, string, string][];
  return data.map(([openTime, open, high, low, close, volume]) => ({
    timestamp: new Date(openTime).toISOString(),
    open: parseFloat(open),
    high: parseFloat(high),
    low: parseFloat(low),
    close: parseFloat(close),
    volume: parseFloat(volume),
  }));
}

async function fetchEquityHistory(symbol: string, bars: number): Promise<OhlcvBar[] | null> {
  // Daily bars over 2y — plenty of headroom for Kronos's default 256-bar lookback.
  const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(
    symbol
  )}?interval=1d&range=2y`;
  const res = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const data = await res.json();
  const result = data?.chart?.result?.[0];
  const timestamps: number[] | undefined = result?.timestamp;
  const quote = result?.indicators?.quote?.[0];
  if (!timestamps?.length || !quote) return null;

  const out: OhlcvBar[] = [];
  for (let i = 0; i < timestamps.length; i++) {
    const [o, h, l, c, v] = [
      quote.open?.[i],
      quote.high?.[i],
      quote.low?.[i],
      quote.close?.[i],
      quote.volume?.[i],
    ];
    if ([o, h, l, c].some((x) => typeof x !== "number")) continue;
    out.push({
      timestamp: new Date(timestamps[i] * 1000).toISOString(),
      open: o,
      high: h,
      low: l,
      close: c,
      volume: typeof v === "number" ? v : 0,
    });
  }
  return out.slice(-bars);
}

export async function fetchOhlcvHistory(symbol: string, bars: number): Promise<OhlcvBar[] | null> {
  if (isCrypto(symbol)) return fetchCryptoHistory(symbol, bars);
  return fetchEquityHistory(symbol, bars);
}
