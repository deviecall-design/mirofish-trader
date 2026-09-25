import { NextRequest } from "next/server";
import { fetchDisplayHistory } from "@/app/lib/prices";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const symbol = searchParams.get("symbol");
  const bars = parseInt(searchParams.get("bars") ?? "90");

  if (!symbol) return Response.json({ error: "symbol required" }, { status: 400 });

  const history = await fetchDisplayHistory(symbol.toUpperCase(), bars);
  if (!history) return Response.json({ error: "no data" }, { status: 404 });

  const ohlcv = history.bars;
  // Compute 20-period SMA
  const sma: { time: string; value: number }[] = [];
  for (let i = 19; i < ohlcv.length; i++) {
    const avg = ohlcv.slice(i - 19, i + 1).reduce((s, b) => s + b.close, 0) / 20;
    sma.push({ time: ohlcv[i].timestamp.split("T")[0], value: parseFloat(avg.toFixed(4)) });
  }

  const candles = ohlcv.map((b) => ({
    time: b.timestamp.split("T")[0],
    open: b.open,
    high: b.high,
    low: b.low,
    close: b.close,
    volume: b.volume,
  }));

  return Response.json({ symbol: symbol.toUpperCase(), currency: history.currency, candles, sma });
}
