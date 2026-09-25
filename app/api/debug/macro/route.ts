import { getMacroBiasReport } from "@/app/lib/macroBias";
import { getSocialBiasReport } from "@/app/lib/socialBias";
import type { InputReading } from "@/app/lib/inputAvailability";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

// The chips on the dashboard are a sample, not a vote across the watchlist.
const SOCIAL_SAMPLE = ["TSLA", "NVDA"] as const;

function sampleDetail(readings: { symbol: string; reading: InputReading }[]): string | null {
  const notes = readings.map(({ symbol, reading }) => {
    if (!reading.available) return `${symbol} unavailable${reading.detail ? `: ${reading.detail}` : ""}`;
    return null;
  }).filter((n): n is string => !!n);
  const base = `Sample of ${SOCIAL_SAMPLE.join(" and ")}, not the whole watchlist`;
  return notes.length ? `${base}. ${notes.join("; ")}` : base;
}

export async function GET() {
  try {
    const [macro, ...socialReadings] = await Promise.all([
      getMacroBiasReport(),
      ...SOCIAL_SAMPLE.map(async (symbol) => ({
        symbol,
        reading: await getSocialBiasReport(symbol),
      })),
    ]);

    const availableSocial = socialReadings.filter((s) => s.reading.available);
    const socialBias = availableSocial.length
      ? availableSocial.reduce((sum, s) => sum + s.reading.value, 0) / availableSocial.length
      : 0;

    return Response.json(
      {
        degraded: !macro.available || availableSocial.length === 0,
        macro_bias: macro.value,
        macro_available: macro.available,
        macro_detail: macro.detail,
        social_bias: socialBias,
        social_available: availableSocial.length > 0,
        social_detail: sampleDetail(socialReadings),
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Debug macro endpoint error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return Response.json(
      {
        degraded: true,
        macro_bias: 0,
        macro_available: false,
        macro_detail: message,
        social_bias: 0,
        social_available: false,
        social_detail: message,
        error: message,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
