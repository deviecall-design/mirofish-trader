"use client";

import { useMemo } from "react";
import type { Direction } from "../lib/supabase";

// Consensus Strip — 1,000 one-pixel ticks, one per agent vote. "712 entities
// agree" reads stronger than "71%". Rendered as CSS gradient stops batched
// into ~100 segments so the DOM stays tiny. See DESIGN.md.

const AGENTS = 1000;

function votesFrom(direction: Direction, conviction: number) {
  // Reconstruct approximate vote counts from direction + conviction, matching
  // the swarm's conviction formula in app/lib/mirofish.ts (dominant share).
  const dominant = Math.round(((conviction / 100) * 0.67 + 0.33) * AGENTS);
  const abstain = Math.round(AGENTS * 0.09);
  const minority = AGENTS - dominant - abstain;
  if (direction === "bullish") return { long: dominant, short: minority, abstain };
  if (direction === "bearish") return { long: minority, short: dominant, abstain };
  const half = Math.floor((AGENTS - abstain) / 2);
  return { long: half, short: AGENTS - abstain - half, abstain };
}

export default function ConsensusStrip({
  direction,
  conviction,
}: {
  direction: Direction;
  conviction: number;
}) {
  const { long, short, abstain } = useMemo(
    () => votesFrom(direction, conviction),
    [direction, conviction]
  );

  // Deterministic shuffle of 100 segments (10 agents each) so the strip reads
  // as individuals, not three blocks — same signal always renders the same.
  const segments = useMemo(() => {
    const segs: ("l" | "s" | "a")[] = [
      ...Array<"l">(Math.round(long / 10)).fill("l"),
      ...Array<"s">(Math.round(short / 10)).fill("s"),
      ...Array<"a">(Math.round(abstain / 10)).fill("a"),
    ];
    let seed = conviction * 7 + direction.length * 13 + 1;
    const rand = () => (seed = (seed * 9301 + 49297) % 233280) / 233280;
    for (let i = segs.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [segs[i], segs[j]] = [segs[j], segs[i]];
    }
    return segs;
  }, [long, short, abstain, conviction, direction]);

  return (
    <div>
      <div className="flex h-[4px] rounded-[2px] overflow-hidden" aria-hidden>
        {segments.map((s, i) => (
          <span
            key={i}
            className="flex-1"
            style={{
              background:
                s === "l" ? "var(--bullish)" : s === "s" ? "var(--bearish)" : "var(--neutral)",
              opacity: s === "a" ? 0.5 : 0.85,
            }}
          />
        ))}
      </div>
      <div className="num mt-1 text-[11px] text-[var(--muted)]">
        L {long} · S {short} · A {abstain}
      </div>
    </div>
  );
}
