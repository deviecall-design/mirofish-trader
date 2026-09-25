// Stock screener — curated sector lists. Live quotes are fetched server-side
// in app/lib/prices.ts (the browser cannot call Yahoo because of CORS).

import { fetchMarketQuotes } from "./prices";

export interface ScreenerStock {
  symbol: string;
  name: string;
  price: number | null;
  /** Provider quote currency (USD, AUD, ZAc, GBp, …). Null price still carries a guess. */
  currency: string;
  changePercent: number | null;
  marketCapB: number | null; // billions of the listing currency
  sparkline: number[]; // last 7 daily closes, oldest first
  sector: string;
  /** YYYY-MM-DD when price is a daily close rather than a live quote. */
  asOf: string | null;
}

export interface SectorMeta {
  id: string;
  label: string;
}

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

export async function fetchScreenerData(sector: string): Promise<ScreenerStock[]> {
  const sectorData = SECTORS[sector];
  if (!sectorData) return [];
  const quotes = await fetchMarketQuotes(
    sectorData.stocks.map((stock) => stock.symbol),
    { sparkline: true }
  );
  return sectorData.stocks.map(({ symbol, name }, index) => {
    const detail = quotes[index];
    return {
      symbol,
      name,
      sector: sectorData.label,
      price: detail.price,
      currency: detail.currency,
      changePercent: detail.changePercent,
      marketCapB: detail.marketCapB,
      sparkline: detail.sparkline,
      asOf: detail.asOf,
    };
  });
}
