"use client";

import React, { useMemo } from "react";
import { formatMoney, quoteCurrencyForSymbol } from "@/app/lib/currency";
import { SignalRow } from "@/app/lib/supabase";
import ConsensusStrip from "./ConsensusStrip";

interface ArchetypeBreakdown {
  momentum: number;
  contrarian: number;
  macro: number;
  sentiment: number;
}

interface SignalCardProps {
  signal: SignalRow & { archetypeBreakdown?: ArchetypeBreakdown };
  onApprove?: () => void;
  onIgnore?: () => void;
  compact?: boolean;
}

// SignalCard — Quiet Swarm treatment (see DESIGN.md): hairline panel, HUD
// labels, mono numerals, and the 1000-tick consensus strip as the centerpiece.

const ARCHETYPES: { key: keyof ArchetypeBreakdown; label: string }[] = [
  { key: "momentum", label: "Momentum" },
  { key: "contrarian", label: "Contrarian" },
  { key: "macro", label: "Macro" },
  { key: "sentiment", label: "Sentiment" },
];

function directionColor(direction: string) {
  if (direction === "bullish") return "var(--bullish)";
  if (direction === "bearish") return "var(--bearish)";
  return "var(--neutral)";
}

export const SignalCard: React.FC<SignalCardProps> = React.memo(
  ({ signal, onApprove, onIgnore, compact = false }) => {
    const archetypeBreakdown: ArchetypeBreakdown = useMemo(
      () =>
        signal.archetypeBreakdown || {
          momentum: 0,
          contrarian: 0,
          macro: 0,
          sentiment: 0,
        },
      [signal.archetypeBreakdown]
    );
    const hasBreakdown = ARCHETYPES.some((a) => archetypeBreakdown[a.key] > 0);

    if (compact) {
      return (
        <div className="p-3 bg-[var(--panel)] rounded-lg border border-[var(--border)] hover:bg-[var(--panel-2)] transition-colors duration-120">
          <div className="flex items-center justify-between gap-2">
            <div>
              <p className="num text-sm font-bold">{signal.symbol}</p>
              <p className="hud-label" style={{ color: directionColor(signal.direction) }}>
                {signal.direction}
              </p>
            </div>
            <p className="num text-sm font-bold">
              {signal.conviction}
              <span className="text-[var(--muted)]">/100</span>
            </p>
          </div>
          <div className="mt-2">
            <ConsensusStrip direction={signal.direction} conviction={signal.conviction} />
          </div>
        </div>
      );
    }

    return (
      <div className="p-4 bg-[var(--panel)] rounded-lg border border-[var(--border)] hover:border-[var(--border)] space-y-3">
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-baseline gap-3">
            <p className="num text-lg font-bold">{signal.symbol}</p>
            <span
              className="hud-label rounded border px-2 py-0.5"
              style={{
                color: directionColor(signal.direction),
                borderColor: "color-mix(in srgb, currentColor 35%, transparent)",
              }}
            >
              {signal.direction}
            </span>
          </div>
          <p className="num text-lg font-bold">
            {signal.conviction}
            <span className="text-sm text-[var(--muted)]">/100</span>
          </p>
        </div>

        <ConsensusStrip direction={signal.direction} conviction={signal.conviction} />

        {hasBreakdown && (
          <div className="space-y-1.5">
            <p className="hud-label">Attribution</p>
            {ARCHETYPES.map(({ key, label }) => (
              <div key={key}>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-[var(--muted)]">{label}</span>
                  <span className="num text-[var(--muted)]">{archetypeBreakdown[key]}%</span>
                </div>
                <div className="h-1 bg-[var(--panel-2)] rounded-full overflow-hidden">
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${archetypeBreakdown[key]}%`,
                      background: "var(--hud)",
                      opacity: 0.7,
                    }}
                  />
                </div>
              </div>
            ))}
          </div>
        )}

        {signal.summary && (
          <p className="text-xs text-[var(--muted)] leading-relaxed">{signal.summary}</p>
        )}

        {signal.price !== null && signal.price !== undefined && (
          <p className="num text-xs text-[var(--muted)]">
            {formatMoney(Number(signal.price), quoteCurrencyForSymbol(signal.symbol))}
          </p>
        )}

        <div className="pt-2 border-t border-[var(--border)] flex items-center gap-2">
          <span
            className="hud-label rounded px-2 py-0.5"
            style={{
              color:
                signal.status === "approved"
                  ? "var(--bullish)"
                  : signal.status === "ignored"
                  ? "var(--bearish)"
                  : "var(--armed)",
            }}
          >
            {signal.status}
          </span>

          {signal.status === "pending" && (
            <div className="ml-auto flex gap-2">
              {onApprove && (
                <button
                  onClick={onApprove}
                  className="text-xs px-3 py-1 rounded font-semibold bg-[var(--bullish)] text-[#04120C] hover:opacity-90 transition-opacity duration-120"
                >
                  Approve
                </button>
              )}
              {onIgnore && (
                <button
                  onClick={onIgnore}
                  className="text-xs px-3 py-1 rounded border border-[var(--border)] hover:bg-[var(--panel-2)] transition-colors duration-120"
                >
                  Ignore
                </button>
              )}
            </div>
          )}
        </div>
      </div>
    );
  }
);

SignalCard.displayName = "SignalCard";
