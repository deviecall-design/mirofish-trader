// Price fetching: CoinGecko for crypto (BTC/ETH), Yahoo Finance v8 quote endpoint for equities.
// Both endpoints are public and unauthenticated.

const CRYPTO_IDS: Record<string, string> = {
  BTC: "bitcoin",
  ETH: "ethereum",
};

export interface PriceQuote {
  symbol: string;
  price: number;
  source: "coingecko" | "yahoo";
}

export function isCrypto(symbol: string): boolean {
  return symbol.toUpperCase() in CRYPTO_IDS;
}

async function fetchCrypto(symbol: string): Promise<PriceQuote | null> {
  const id = CRYPTO_IDS[symbol.toUpperCase()];
  if (!id) return null;
  const res = await fetch(
    `https://api.coingecko.com/api/v3/simple/price?ids=${id}&vs_currencies=usd`,
    { next: { revalidate: 60 } }
  );
  if (!res.ok) return null;
  const data = (await res.json()) as Record<string, { usd?: number }>;
  const price = data[id]?.usd;
  if (typeof price !== "number") return null;
  return { symbol: symbol.toUpperCase(), price, source: "coingecko" };
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
  return { symbol: symbol.toUpperCase(), price, source: "yahoo" };
}

export async function fetchPrice(symbol: string): Promise<PriceQuote | null> {
  if (isCrypto(symbol)) return fetchCrypto(symbol);
  return fetchEquity(symbol);
}
