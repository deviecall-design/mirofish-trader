// Stock screener — curated sector lists + Yahoo Finance / Binance live data

export interface ScreenerStock {
  symbol: string;
  name: string;
  price: number | null;
  changePercent: number | null;
  marketCapB: number | null; // billions
  sparkline: number[]; // last 7 daily closes, oldest first
  sector: string;
}

export interface SectorMeta {
  id: string;
  label: string;
}

const CRYPTO_SYMBOLS = new Set(["BTC", "ETH"]);

// ─── Curated sector definitions ───────────────────────────────────────────────

export const SECTORS: Record<string, { label: string; stocks: { symbol: string; name: string }[] }> = {
  watchlist: {
    label: "My Watchlist",
    stocks: [
      { symbol: "DRO.AX", name: "DroneShield" },
      { symbol: "NVDA", name: "Nvidia" },
      { symbol: "TSM", name: "TSMC" },
      { symbol: "ASML", name: "ASML" },
      { symbol: "TSLA", name: "Tesla" },
      { symbol: "PLTR", name: "Palantir" },
      { symbol: "LIN", name: "Linde" },
      { symbol: "APD", name: "Air Products" },
      { symbol: "MLX.AX", name: "Metals X" },
      { symbol: "IMP.JO", name: "Impala Platinum" },
      { symbol: "BTC", name: "Bitcoin" },
      { symbol: "ETH", name: "Ethereum" },
    ],
  },
  "critical-minerals": {
    label: "Critical Minerals",
    stocks: [
      { symbol: "LYC.AX", name: "Lynas Rare Earths" },
      { symbol: "PLS.AX", name: "Pilbara Minerals" },
      { symbol: "IGO.AX", name: "IGO Limited" },
      { symbol: "MIN.AX", name: "Mineral Resources" },
      { symbol: "VUL.AX", name: "Vulcan Energy" },
      { symbol: "ARU.AX", name: "Arafura Resources" },
      { symbol: "ILU.AX", name: "Iluka Resources" },
      { symbol: "SYR.AX", name: "Syrah Resources" },
      { symbol: "NTU.AX", name: "Northern Minerals" },
      { symbol: "HAS.AX", name: "Hastings Technology Metals" },
    ],
  },
  "rare-earth": {
    label: "Rare Earth",
    stocks: [
      { symbol: "LYC.AX", name: "Lynas Rare Earths" },
      { symbol: "ARU.AX", name: "Arafura Resources" },
      { symbol: "NTU.AX", name: "Northern Minerals" },
      { symbol: "HAS.AX", name: "Hastings Technology Metals" },
      { symbol: "MP", name: "MP Materials" },
      { symbol: "MPVD", name: "Mountain Province Diamonds" },
    ],
  },
  helium: {
    label: "Helium / Gas",
    stocks: [
      { symbol: "LIN", name: "Linde" },
      { symbol: "APD", name: "Air Products" },
      { symbol: "ASPI", name: "ASP Isotopes" },
      { symbol: "BNL.AX", name: "Big Star Energy" },
    ],
  },
  tin: {
    label: "Tin",
    stocks: [
      { symbol: "MLX.AX", name: "Metals X" },
    ],
  },
  pgm: {
    label: "PGM / Ruthenium",
    stocks: [
      { symbol: "IMP.JO", name: "Impala Platinum" },
      { symbol: "SBSW", name: "Sibanye Stillwater" },
      { symbol: "SIR.AX", name: "Sirius Resources" },
    ],
  },
  defence: {
    label: "Defence",
    stocks: [
      { symbol: "DRO.AX", name: "DroneShield" },
      { symbol: "LMT", name: "Lockheed Martin" },
      { symbol: "RTX", name: "Raytheon" },
      { symbol: "NOC", name: "Northrop Grumman" },
      { symbol: "PLTR", name: "Palantir" },
      { symbol: "KTOS", name: "Kratos Defence" },
    ],
  },
  tech: {
    label: "Tech / AI",
    stocks: [
      { symbol: "NVDA", name: "Nvidia" },
      { symbol: "TSM", name: "TSMC" },
      { symbol: "ASML", name: "ASML" },
      { symbol: "AMD", name: "AMD" },
      { symbol: "AVGO", name: "Broadcom" },
      { symbol: "MSFT", name: "Microsoft" },
    ],
  },
  crypto: {
    label: "Crypto",
    stocks: [
      { symbol: "BTC", name: "Bitcoin" },
      { symbol: "ETH", name: "Ethereum" },
    ],
  },
};

export function getAllSectors(): SectorMeta[] {
  return Object.entries(SECTORS).map(([id, { label }]) => ({ id, label }));
}

// ─── Data fetchers ─────────────────────────────────────────────────────────────

async function fetchYahooDetail(symbol: string): Promise<{
  price: number | null;
  changePercent: number | null;
  marketCapB: number | null;
  sparkline: number[];
}> {
  try {
    const url = `https://query1.finance.yahoo.com/v8/finance/chart/${encodeURIComponent(symbol)}?interval=1d&range=10d`;
    const res = await fetch(url, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36",
      },
      next: { revalidate: 60 },
    });
    if (!res.ok) return { price: null, changePercent: null, marketCapB: null, sparkline: [] };
    const data = await res.json();
    const result = data?.chart?.result?.[0];
    const meta = result?.meta;
    const closes: unknown[] = result?.indicators?.quote?.[0]?.close ?? [];
    const validCloses = closes.filter((c): c is number => typeof c === "number");
    return {
      price: typeof meta?.regularMarketPrice === "number" ? meta.regularMarketPrice : null,
      changePercent: typeof meta?.regularMarketChangePercent === "number" ? meta.regularMarketChangePercent : null,
      marketCapB: typeof meta?.marketCap === "number" ? meta.marketCap / 1e9 : null,
      sparkline: validCloses.slice(-7),
    };
  } catch {
    return { price: null, changePercent: null, marketCapB: null, sparkline: [] };
  }
}

async function fetchBinanceDetail(symbol: string): Promise<{
  price: number | null;
  changePercent: number | null;
  marketCapB: null;
  sparkline: number[];
}> {
  const pairs: Record<string, string> = { BTC: "BTCUSDT", ETH: "ETHUSDT" };
  const pair = pairs[symbol.toUpperCase()];
  if (!pair) return { price: null, changePercent: null, marketCapB: null, sparkline: [] };
  try {
    const [tickerRes, klinesRes] = await Promise.all([
      fetch(`https://api.binance.com/api/v3/ticker/24hr?symbol=${pair}`, { next: { revalidate: 60 } }),
      fetch(`https://api.binance.com/api/v3/klines?symbol=${pair}&interval=1d&limit=7`, { next: { revalidate: 60 } }),
    ]);
    if (!tickerRes.ok) return { price: null, changePercent: null, marketCapB: null, sparkline: [] };
    const ticker = await tickerRes.json() as { lastPrice: string; priceChangePercent: string };
    let sparkline: number[] = [];
    if (klinesRes.ok) {
      const klines = await klinesRes.json() as string[][];
      sparkline = klines.map((k) => parseFloat(k[4]));
    }
    return {
      price: parseFloat(ticker.lastPrice),
      changePercent: parseFloat(ticker.priceChangePercent),
      marketCapB: null,
      sparkline,
    };
  } catch {
    return { price: null, changePercent: null, marketCapB: null, sparkline: [] };
  }
}

export async function fetchScreenerData(sector: string): Promise<ScreenerStock[]> {
  const sectorData = SECTORS[sector];
  if (!sectorData) return [];
  const results = await Promise.all(
    sectorData.stocks.map(async ({ symbol, name }) => {
      const isCrypto = CRYPTO_SYMBOLS.has(symbol.toUpperCase());
      const detail = isCrypto
        ? await fetchBinanceDetail(symbol)
        : await fetchYahooDetail(symbol);
      return { symbol, name, sector: sectorData.label, ...detail };
    })
  );
  return results;
}
