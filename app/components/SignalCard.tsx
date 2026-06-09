"use client";

import React, { useMemo } from "react";
import { SignalRow } from "@/app/lib/supabase";

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

/**
 * SignalCard — Refactored with archetype breakdown + conviction gradient
 *
 * Desktop: Full detail (symbol, conviction, archetype bars, sentiment, price)
 * Mobile: Compact (symbol, conviction number, sentiment emoji)
 *
 * Conviction color gradient:
 * - 0–33: Gray (#64748B)
 * - 34–66: Amber (#F59E0B)
 * - 67–100: Green (#10B981)
 */
export const SignalCard: React.FC<SignalCardProps> = React.memo(
  ({
    signal,
    onApprove,
    onIgnore,
    compact = false,
  }) => {
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

    // Conviction color logic
    const getConvictionColor = (conviction: number) => {
      if (conviction <= 33) return "text-[#64748B] bg-[#64748B]/10";
      if (conviction <= 66) return "text-[#F59E0B] bg-[#F59E0B]/10";
      return "text-[#10B981] bg-[#10B981]/10";
    };

    // Direction color
    const getDirectionColor = (direction: string) => {
      if (direction === "bullish") return "text-[#10B981]";
      if (direction === "bearish") return "text-[#EF4444]";
      return "text-[#64748B]";
    };

    // Direction emoji
    const getDirectionEmoji = (direction: string) => {
      if (direction === "bullish") return "🟢";
      if (direction === "bearish") return "🔴";
      return "⚪";
    };

    if (compact) {
      // Mobile: Super compact
      return (
        <div className="p-3 bg-[#1E293B]/50 rounded-lg border border-[#334155]/50 hover:border-[#475569] transition-colors">
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 flex-1">
              <span className="text-lg">{getDirectionEmoji(signal.direction)}</span>
              <div>
                <p className="text-sm font-bold text-white font-mono">
                  {signal.symbol}
                </p>
                <p className={`text-xs font-semibold capitalize`}>
                  {signal.direction}
                </p>
              </div>
            </div>
            <div className={`px-2 py-1 rounded ${getConvictionColor(signal.conviction)}`}>
              <p className="text-sm font-bold font-mono">
                {signal.conviction}
              </p>
            </div>
          </div>
        </div>
      );
    }

    // Desktop: Full detail
    return (
      <div className="p-4 bg-[#1E293B]/50 rounded-lg border border-[#334155]/50 hover:border-[#475569]/80 transition-colors space-y-3">
        {/* Header: Symbol + Conviction */}
        <div className="flex items-center justify-between gap-3">
          <div>
            <p className="text-base font-bold text-white font-mono">
              {getDirectionEmoji(signal.direction)} {signal.symbol}
            </p>
            <p className={`text-xs font-semibold capitalize ${getDirectionColor(signal.direction)}`}>
              {signal.direction}
            </p>
          </div>
          <div className={`px-3 py-2 rounded-lg ${getConvictionColor(signal.conviction)}`}>
            <p className="text-lg font-bold font-mono">{signal.conviction}/100</p>
          </div>
        </div>

        {/* Archetype Breakdown Bars */}
        {(archetypeBreakdown.momentum > 0 ||
          archetypeBreakdown.contrarian > 0 ||
          archetypeBreakdown.macro > 0 ||
          archetypeBreakdown.sentiment > 0) && (
          <div className="space-y-2">
            <p className="text-xs font-semibold text-[#64748B]">Attribution</p>
            <div className="space-y-1.5">
              {/* Momentum */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-[#CBD5E1]">📈 Momentum</span>
                  <span className="text-[#F59E0B] font-mono">
                    {archetypeBreakdown.momentum}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#3B82F6] rounded-full"
                    style={{ width: `${archetypeBreakdown.momentum}%` }}
                  />
                </div>
              </div>

              {/* Contrarian */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-[#CBD5E1]">🔄 Contrarian</span>
                  <span className="text-[#F59E0B] font-mono">
                    {archetypeBreakdown.contrarian}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#EC4899] rounded-full"
                    style={{ width: `${archetypeBreakdown.contrarian}%` }}
                  />
                </div>
              </div>

              {/* Macro */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-[#CBD5E1]">🌍 Macro</span>
                  <span className="text-[#F59E0B] font-mono">
                    {archetypeBreakdown.macro}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#F59E0B] rounded-full"
                    style={{ width: `${archetypeBreakdown.macro}%` }}
                  />
                </div>
              </div>

              {/* Sentiment */}
              <div>
                <div className="flex justify-between text-xs mb-0.5">
                  <span className="text-[#CBD5E1]">📱 Sentiment</span>
                  <span className="text-[#F59E0B] font-mono">
                    {archetypeBreakdown.sentiment}%
                  </span>
                </div>
                <div className="h-1.5 bg-[#0F172A] rounded-full overflow-hidden">
                  <div
                    className="h-full bg-[#10B981] rounded-full"
                    style={{ width: `${archetypeBreakdown.sentiment}%` }}
                  />
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Summary */}
        {signal.summary && (
          <p className="text-xs text-[#CBD5E1] leading-relaxed">
            {signal.summary}
          </p>
        )}

        {/* Price */}
        {signal.price !== null && signal.price !== undefined && (
          <p className="text-xs text-[#64748B] font-mono">
            Price: ${signal.price.toFixed(2)}
          </p>
        )}

        {/* Status badge */}
        <div className="pt-2 border-t border-[#334155]/50 flex items-center gap-2">
          <span className={`text-xs px-2 py-1 rounded capitalize font-semibold ${
            signal.status === "approved"
              ? "bg-[#10B981]/20 text-[#10B981]"
              : signal.status === "ignored"
              ? "bg-[#EF4444]/20 text-[#EF4444]"
              : "bg-[#F59E0B]/20 text-[#F59E0B]"
          }`}>
            {signal.status}
          </span>

          {/* Action buttons */}
          {signal.status === "pending" && (
            <div className="ml-auto flex gap-2">
              {onApprove && (
                <button
                  onClick={onApprove}
                  className="text-xs px-2 py-1 rounded bg-[#10B981]/20 text-[#10B981] hover:bg-[#10B981]/40 transition-colors font-semibold"
                >
                  Approve
                </button>
              )}
              {onIgnore && (
                <button
                  onClick={onIgnore}
                  className="text-xs px-2 py-1 rounded bg-[#EF4444]/20 text-[#EF4444] hover:bg-[#EF4444]/40 transition-colors font-semibold"
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
