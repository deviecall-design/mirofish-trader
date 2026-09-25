"use client";

import React, { useEffect, useState } from "react";

interface BiasIndicatorProps {
  macroBias?: number;
  socialBias?: number;
  t10y2y?: number;
  nfci?: number;
  vix?: number;
  dxy?: number;
  loading?: boolean;
}

/**
 * BiasIndicator — Dual macro/social bias gauges
 * Renders [-1, +1] spectrum with color coding:
 * -1 = Risk-off (Red), 0 = Neutral (Slate), +1 = Risk-on (Green)
 *
 * Also displays FRED data pills: T10Y2Y, NFCI, VIX, DXY
 */
export const BiasIndicator: React.FC<BiasIndicatorProps> = ({
  macroBias = 0,
  socialBias = 0,
  t10y2y,
  nfci,
  vix,
  dxy,
  loading = false,
}) => {
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  if (!clientMounted) return null;

  // Clamp bias to [-1, 1]
  const clampedMacro = Math.max(-1, Math.min(1, macroBias));
  const clampedSocial = Math.max(-1, Math.min(1, socialBias));

  // Bias to label
  const biasLabel = (bias: number) => {
    if (bias < -0.5) return "Risk-Off";
    if (bias < -0.2) return "Caution";
    if (bias < 0.2) return "Neutral";
    if (bias < 0.5) return "Cautious";
    return "Risk-On";
  };

  // Bias to color (Tailwind)
  const biasColor = (bias: number): string => {
    if (bias < -0.5) return "text-[#EF4444]"; // Red
    if (bias < -0.2) return "text-[#F97316]"; // Orange
    if (bias < 0.2) return "text-[#64748B]"; // Slate
    if (bias < 0.5) return "text-[#F59E0B]"; // Amber
    return "text-[#10B981]"; // Green
  };

  // Background gauge color
  const gaugeBg = (bias: number): string => {
    if (bias < -0.5) return "from-[#EF4444]/30 to-[#EF4444]/10";
    if (bias < -0.2) return "from-[#F97316]/30 to-[#F97316]/10";
    if (bias < 0.2) return "from-[#64748B]/30 to-[#64748B]/10";
    if (bias < 0.5) return "from-[#F59E0B]/30 to-[#F59E0B]/10";
    return "from-[#10B981]/30 to-[#10B981]/10";
  };

  return (
    <div className="sticky top-0 z-40 bg-gradient-to-b from-[#0F172A] to-[#1E293B] border-b border-[#334155]/50 px-6 py-4 backdrop-blur-sm">
      {/* Hero Section */}
      <div className="max-w-7xl mx-auto">
        {/* Title + Live Badge */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <h2 className="text-lg font-bold text-white">Market Bias</h2>
            {loading ? (
              <span className="text-xs px-2 py-1 bg-[#475569]/50 rounded text-[#94A3B8]">
                Updating...
              </span>
            ) : (
              <span className="text-xs px-2 py-1 bg-[#10B981]/20 rounded text-[#10B981]">
                🔴 Live
              </span>
            )}
          </div>
          <span className="text-xs text-[#64748B]">
            {new Date().toLocaleTimeString("en-US", {
              hour: "2-digit",
              minute: "2-digit",
              second: "2-digit",
            })}
          </span>
        </div>

        {/* Dual Gauges */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
          {/* Macro Bias */}
          <div className={`p-4 rounded-lg bg-gradient-to-r ${gaugeBg(clampedMacro)} border border-[#334155]/50`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#CBD5E1]">🌍 Macro Bias</span>
              <span className={`text-xl font-bold ${biasColor(clampedMacro)}`}>
                {clampedMacro > 0 ? "+" : ""}{(clampedMacro * 100).toFixed(0)}%
              </span>
            </div>
            <p className={`text-xs font-semibold ${biasColor(clampedMacro)}`}>
              {biasLabel(clampedMacro)}
            </p>
            {/* Mini gauge bar */}
            <div className="mt-2 h-1 bg-[#1E293B]/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  clampedMacro < 0 ? "bg-[#EF4444]" : "bg-[#10B981]"
                }`}
                style={{
                  width: `${((clampedMacro + 1) / 2) * 100}%`,
                }}
              />
            </div>
          </div>

          {/* Social Bias */}
          <div className={`p-4 rounded-lg bg-gradient-to-r ${gaugeBg(clampedSocial)} border border-[#334155]/50`}>
            <div className="flex items-center justify-between mb-2">
              <span className="text-sm font-medium text-[#CBD5E1]">📱 Sentiment Bias</span>
              <span className={`text-xl font-bold ${biasColor(clampedSocial)}`}>
                {clampedSocial > 0 ? "+" : ""}{(clampedSocial * 100).toFixed(0)}%
              </span>
            </div>
            <p className={`text-xs font-semibold ${biasColor(clampedSocial)}`}>
              {biasLabel(clampedSocial)}
            </p>
            {/* Mini gauge bar */}
            <div className="mt-2 h-1 bg-[#1E293B]/50 rounded-full overflow-hidden">
              <div
                className={`h-full rounded-full transition-all duration-300 ${
                  clampedSocial < 0 ? "bg-[#EF4444]" : "bg-[#10B981]"
                }`}
                style={{
                  width: `${((clampedSocial + 1) / 2) * 100}%`,
                }}
              />
            </div>
          </div>
        </div>

        {/* FRED Data Pills */}
        <div className="flex flex-wrap gap-2 text-xs font-mono text-[#CBD5E1]">
          {t10y2y !== undefined && (
            <div className="px-3 py-1 bg-[#1E293B]/50 rounded border border-[#334155]/50">
              T10Y2Y: <span className="text-[#F59E0B]">{t10y2y.toFixed(2)}</span>
            </div>
          )}
          {nfci !== undefined && (
            <div className="px-3 py-1 bg-[#1E293B]/50 rounded border border-[#334155]/50">
              NFCI: <span className="text-[#F59E0B]">{nfci.toFixed(2)}</span>
            </div>
          )}
          {vix !== undefined && (
            <div className="px-3 py-1 bg-[#1E293B]/50 rounded border border-[#334155]/50">
              VIX: <span className="text-[#F59E0B]">{vix.toFixed(1)}</span>
            </div>
          )}
          {dxy !== undefined && (
            <div className="px-3 py-1 bg-[#1E293B]/50 rounded border border-[#334155]/50">
              DXY: <span className="text-[#F59E0B]">{dxy.toFixed(2)}</span>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
