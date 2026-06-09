/**
 * Archetype utilities — convert breakdown to percentages
 */

export interface ArchetypeBreakdown {
  momentum: number;
  contrarian: number;
  macro: number;
  sentiment: number;
}

export interface ArchetypeVotes {
  momentum: { bullish: number; bearish: number; neutral: number };
  contrarian: { bullish: number; bearish: number; neutral: number };
  macro: { bullish: number; bearish: number; neutral: number };
  sentiment: { bullish: number; bearish: number; neutral: number };
}

/**
 * Convert archetype vote breakdown to conviction percentages per archetype
 * Returns the % contribution of each archetype to the final direction
 */
export function breakdownToPercentages(
  breakdown: ArchetypeVotes,
  direction: "bullish" | "bearish" | "neutral"
): ArchetypeBreakdown {
  let totalVotes = 0;

  // Sum votes for the dominant direction across archetypes
  for (const arch of Object.values(breakdown)) {
    if (direction === "bullish") {
      totalVotes += arch.bullish;
    } else if (direction === "bearish") {
      totalVotes += arch.bearish;
    } else {
      totalVotes += arch.neutral;
    }
  }

  if (totalVotes === 0) {
    return {
      momentum: 0,
      contrarian: 0,
      macro: 0,
      sentiment: 0,
    };
  }

  const votes = breakdown[direction === "bullish" ? "momentum" : "contrarian"] ||
    breakdown.macro ||
    breakdown.sentiment;
  const directionKey = direction;

  return {
    momentum:
      Math.round(
        (breakdown.momentum[directionKey as keyof typeof breakdown.momentum] / totalVotes) * 100
      ) || 0,
    contrarian:
      Math.round(
        (breakdown.contrarian[directionKey as keyof typeof breakdown.contrarian] / totalVotes) *
          100
      ) || 0,
    macro:
      Math.round(
        (breakdown.macro[directionKey as keyof typeof breakdown.macro] / totalVotes) * 100
      ) || 0,
    sentiment:
      Math.round(
        (breakdown.sentiment[directionKey as keyof typeof breakdown.sentiment] / totalVotes) *
          100
      ) || 0,
  };
}
