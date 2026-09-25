"use client";

import React, { useState, useMemo } from "react";
import { SignalRow } from "@/app/lib/supabase";

interface ConvictionHeatmapProps {
  signals: SignalRow[];
}

/**
 * ConvictionHeatmap — Optional component
 * Matrix: Symbols (Y-axis) vs Conviction % (X-axis)
 * Color intensity = conviction strength
 *
 * Desktop: full heatmap
 * Mobile: hidden (too crowded)
 */
export const ConvictionHeatmap: React.FC<ConvictionHeatmapProps> = ({
  signals,
}) => {
  const [hoveredSymbol, setHoveredSymbol] = useState<string | null>(null);

  // Group signals by symbol and take max conviction per symbol
  const heatmapData = useMemo(() => {
    const bySymbol = new Map<
      string,
      { conviction: number; direction: string; summary: string }
    >();

    for (const signal of signals) {
      const existing = bySymbol.get(signal.symbol);
      if (!existing || signal.conviction > existing.conviction) {
        bySymbol.set(signal.symbol, {
          conviction: signal.conviction,
          direction: signal.direction,
          summary: signal.summary,
        });
      }
    }

    return Array.from(bySymbol.entries())
      .map(([symbol, data]) => ({
        symbol,
        ...data,
      }))
      .sort((a, b) => b.conviction - a.conviction)
      .slice(0, 12); // Top 12 symbols
  }, [signals]);

  if (heatmapData.length === 0) {
    return null;
  }

  // Helper to get conviction color intensity
  const getIntensityColor = (conviction: number) => {
    const intensity = conviction / 100;
    if (conviction <= 33) {
      const opacity = (intensity / 0.33) * 0.5;
      return `rgba(100, 116, 139, ${opacity})`; // Slate
    }
    if (conviction <= 66) {
      const opacity = ((intensity - 0.33) / 0.33) * 0.7 + 0.3;
      return `rgba(245, 158, 11, ${opacity})`; // Amber
    }
    const opacity = ((intensity - 0.66) / 0.34) * 0.9 + 0.2;
    return `rgba(16, 185, 129, ${opacity})`; // Green
  };

  return (
    <div className="hidden lg:block p-6 bg-[#0F172A] rounded-lg border border-[#334155]/50">
      <h3 className="text-lg font-bold text-white mb-4">Conviction Heatmap</h3>

      <div className="overflow-x-auto">
        <div className="space-y-2 min-w-max">
          {heatmapData.map(({ symbol, conviction, direction, summary }) => (
            <div
              key={symbol}
              className="flex items-center gap-4 group"
              onMouseEnter={() => setHoveredSymbol(symbol)}
              onMouseLeave={() => setHoveredSymbol(null)}
            >
              {/* Symbol label */}
              <div className="w-20 text-sm font-bold text-[#CBD5E1] font-mono">
                {symbol}
              </div>

              {/* Conviction bar */}
              <div className="flex-1 h-8 relative rounded-lg overflow-hidden bg-[#1E293B]/50 border border-[#334155]/50 group-hover:border-[#475569] transition-colors">
                <div
                  className="h-full transition-all duration-300"
                  style={{
                    width: `${conviction}%`,
                    backgroundColor: getIntensityColor(conviction),
                  }}
                />
                {/* Conviction number */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <span className="text-xs font-bold text-white font-mono">
                    {conviction}/100
                  </span>
                </div>
              </div>

              {/* Direction indicator */}
              <div className="w-12 text-center">
                <span
                  className={`text-xs font-semibold px-2 py-1 rounded capitalize ${
                    direction === "bullish"
                      ? "bg-[#10B981]/20 text-[#10B981]"
                      : direction === "bearish"
                      ? "bg-[#EF4444]/20 text-[#EF4444]"
                      : "bg-[#64748B]/20 text-[#64748B]"
                  }`}
                >
                  {direction === "bullish" ? "🟢" : direction === "bearish" ? "🔴" : "⚪"}
                </span>
              </div>

              {/* Tooltip (hover) */}
              {hoveredSymbol === symbol && (
                <div className="absolute left-0 bottom-full mb-2 w-64 p-2 bg-[#0F172A] border border-[#334155]/50 rounded-lg shadow-lg text-xs text-[#CBD5E1] z-10 pointer-events-none">
                  <p className="font-bold mb-1">{summary}</p>
                  <p className="text-[#64748B]">
                    Direction: <span className="capitalize">{direction}</span>
                  </p>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Legend */}
      <div className="mt-6 pt-4 border-t border-[#334155]/50 flex justify-between text-xs text-[#64748B]">
        <span>Low conviction (0)</span>
        <span>Medium (50)</span>
        <span>High conviction (100)</span>
      </div>
    </div>
  );
};
