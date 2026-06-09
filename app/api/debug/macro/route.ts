import { NextRequest } from "next/server";
import { getMacroBias } from "@/app/lib/macroBias";
import { getSocialBias } from "@/app/lib/socialBias";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  try {
    const [macroBias, socialBiasTSLA, socialBiasNVDA] = await Promise.all([
      getMacroBias(),
      getSocialBias("TSLA"), // Sample symbols
      getSocialBias("NVDA"),
    ]);

    // Average social bias across sampled symbols
    const socialBias = (socialBiasTSLA + socialBiasNVDA) / 2;

    return Response.json(
      {
        degraded: false,
        macro_bias: macroBias,
        social_bias: socialBias,
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  } catch (err) {
    console.error("Debug macro endpoint error:", err);
    return Response.json(
      {
        degraded: true,
        macro_bias: 0,
        social_bias: 0,
        error: err instanceof Error ? err.message : "Unknown error",
        timestamp: new Date().toISOString(),
      },
      { status: 200 }
    );
  }
}
