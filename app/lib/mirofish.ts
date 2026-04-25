import type { Direction } from "./supabase";

export interface MarketContext {
  symbol: string;
  price: number;
  pctChange: number;
  recentTrend?: number;
  macroBias?: number;
  socialBias?: number;
}

export interface SwarmResult {
  direction: Direction;
  conviction: number;
  summary: string;
  votes: { bullish: number; bearish: number; neutral: number };
  archetypeBreakdown: Record<Archetype, { bullish: number; bearish: number; neutral: number }>;
}

type Archetype = "momentum" | "contrarian" | "macro" | "sentiment";

const ARCHETYPE_MIX: Record<Archetype, number> = {
  momentum: 0.30,
  contrarian: 0.20,
  macro: 0.25,
  sentiment: 0.25,
};

const TOTAL_AGENTS = 1000;

function clamp(value: number, min: number, max: number) {
  return Math.max(min, Math.min(max, value));
}

function sigmoid(x: number) {
  return 1 / (1 + Math.exp(-x));
}

function jitter() {
  return (Math.random() - 0.5) * 0.4;
}

function voteFor(probBullish: number, probBearish: number): Direction {
  const r = Math.random();
  if (r < probBullish) return "bullish";
  if (r < probBullish + probBearish) return "bearish";
  return "neutral";
}

function agentBias(archetype: Archetype, ctx: MarketContext): number {
  const trend = ctx.recentTrend ?? ctx.pctChange;
  const macro = ctx.macroBias ?? 0;
  const social = ctx.socialBias ?? 0;
  switch (archetype) {
    case "momentum":
      return trend * 0.8 + jitter();
    case "contrarian":
      return -trend * 0.7 + jitter();
    case "macro":
      return macro * 0.6 + trend * 0.2 + jitter();
    case "sentiment":
      return social * 0.6 + trend * 0.3 + jitter();
  }
}

export function runSwarm(ctx: MarketContext): SwarmResult {
  const votes = { bullish: 0, bearish: 0, neutral: 0 };
  const breakdown: Record<Archetype, { bullish: number; bearish: number; neutral: number }> = {
    momentum: { bullish: 0, bearish: 0, neutral: 0 },
    contrarian: { bullish: 0, bearish: 0, neutral: 0 },
    macro: { bullish: 0, bearish: 0, neutral: 0 },
    sentiment: { bullish: 0, bearish: 0, neutral: 0 },
  };

  (Object.keys(ARCHETYPE_MIX) as Archetype[]).forEach((archetype) => {
    const count = Math.round(TOTAL_AGENTS * ARCHETYPE_MIX[archetype]);
    for (let i = 0; i < count; i++) {
      const bias = agentBias(archetype, ctx);
      const bullishProb = sigmoid(bias) * 0.85;
      const bearishProb = sigmoid(-bias) * 0.85;
      const v = voteFor(bullishProb, bearishProb);
      votes[v]++;
      breakdown[archetype][v]++;
    }
  });

  const total = votes.bullish + votes.bearish + votes.neutral;
  const bullishShare = votes.bullish / total;
  const bearishShare = votes.bearish / total;

  let direction: Direction = "neutral";
  if (bullishShare > 0.55) direction = "bullish";
  else if (bearishShare > 0.55) direction = "bearish";

  const dominant = Math.max(bullishShare, bearishShare);
  const conviction = Math.round(clamp((dominant - 0.33) / 0.67, 0, 1) * 100);

  const summary = buildSummary(ctx, direction, conviction, breakdown);

  return { direction, conviction, summary, votes, archetypeBreakdown: breakdown };
}

function buildSummary(
  ctx: MarketContext,
  direction: Direction,
  conviction: number,
  breakdown: Record<Archetype, { bullish: number; bearish: number; neutral: number }>
): string {
  const move = ctx.pctChange >= 0 ? "up" : "down";
  const magnitude = Math.abs(ctx.pctChange).toFixed(2);
  const dominantArchetype = (Object.keys(breakdown) as Archetype[]).reduce<Archetype>(
    (best, key) => {
      const score =
        direction === "bullish"
          ? breakdown[key].bullish
          : direction === "bearish"
          ? breakdown[key].bearish
          : breakdown[key].neutral;
      const bestScore =
        direction === "bullish"
          ? breakdown[best].bullish
          : direction === "bearish"
          ? breakdown[best].bearish
          : breakdown[best].neutral;
      return score > bestScore ? key : best;
    },
    "momentum"
  );

  if (direction === "neutral") {
    return `${ctx.symbol} moved ${move} ${magnitude}% but the swarm is split — no clear edge (conviction ${conviction}/100).`;
  }
  const bias = direction === "bullish" ? "leans long" : "leans short";
  return `${ctx.symbol} ${move} ${magnitude}%; the swarm ${bias} with ${dominantArchetype} agents driving it (conviction ${conviction}/100).`;
}
