import { NextRequest } from "next/server";
import { fetchScreenerData, getAllSectors } from "@/app/lib/screener";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const sector = searchParams.get("sector") ?? "watchlist";
  const sortBy = searchParams.get("sort") ?? "change_pct";

  if (sector === "__sectors") {
    return Response.json({ sectors: getAllSectors() });
  }

  const stocks = await fetchScreenerData(sector);

  const sorted = [...stocks].sort((a, b) => {
    if (sortBy === "price") return (b.price ?? 0) - (a.price ?? 0);
    if (sortBy === "market_cap") return (b.marketCapB ?? 0) - (a.marketCapB ?? 0);
    return (b.changePercent ?? -999) - (a.changePercent ?? -999);
  });

  return Response.json({ sector, stocks: sorted });
}
