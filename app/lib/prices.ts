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
