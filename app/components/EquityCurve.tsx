"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { TradeRow } from "../lib/supabase";
import { performanceFromTrades } from "../lib/pnl";

// EquityCurve — custom SVG chart following DESIGN.md chart law: horizontal
// gridlines only, mono tick labels, 1.5px line, ≤12% area gradient, one
// glowing live dot, one-time draw-in reveal.

export default function EquityCurve({ trades, height = 200 }: { trades: TradeRow[]; height?: number }) {
  const ref = useRef<HTMLDivElement>(null);
  const [width, setWidth] = useState(600);
  const [revealed, setRevealed] = useState(false);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setWidth(el.clientWidth));
    ro.observe(el);
    setWidth(el.clientWidth);
    const t = setTimeout(() => setRevealed(true), 60);
    return () => {
      ro.disconnect();
      clearTimeout(t);
    };
  }, []);

  const points = useMemo(() => {
    const curve = performanceFromTrades(trades).equityCurve;
    return [{ x: 0, v: 0 }, ...curve.map((p, i) => ({ x: i + 1, v: p.returnPct }))];
  }, [trades]);

  if (points.length < 2) {
    return (
      <div ref={ref} className="grid place-items-center" style={{ height }}>
        <p className="hud-label">Awaiting closed trades</p>
      </div>
    );
  }

  const pad = { top: 12, bottom: 20, left: 8, right: 16 };
  const vals = points.map((p) => p.v);
  const min = Math.min(0, ...vals);
  const max = Math.max(...vals) * 1.1 || 1;
  const X = (i: number) => pad.left + (i / (points.length - 1)) * (width - pad.left - pad.right);
  const Y = (v: number) =>
    pad.top + (1 - (v - min) / (max - min)) * (height - pad.top - pad.bottom);

  const line = points.map((p, i) => `${i ? "L" : "M"}${X(p.x).toFixed(1)},${Y(p.v).toFixed(1)}`).join(" ");
  const last = points[points.length - 1];
  const positive = last.v >= 0;
  const fillColor = positive ? "var(--bullish)" : "var(--bearish)";
  const gridLines = 4;

  return (
    <div ref={ref} className="relative w-full" style={{ height }}>
      <svg width={width} height={height} className="absolute inset-0">
        <defs>
          <linearGradient id="eq-fill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor={fillColor} stopOpacity="0.12" />
            <stop offset="1" stopColor={fillColor} stopOpacity="0" />
          </linearGradient>
          <clipPath id="eq-reveal">
            <rect
              x="0"
              y="0"
              height={height}
              width={revealed ? width : 0}
              style={{ transition: "width 400ms cubic-bezier(.2,0,0,1)" }}
            />
          </clipPath>
        </defs>
        {Array.from({ length: gridLines + 1 }, (_, g) => {
          const v = min + ((max - min) * g) / gridLines;
          const y = Y(v);
          return (
            <g key={g}>
              <line x1="0" x2={width} y1={y} y2={y} stroke="var(--border)" strokeOpacity="0.5" />
              <text x="4" y={y - 4} className="num" fontSize="10" fill="var(--muted)">
                {v >= 0 ? "+" : ""}
                {v.toFixed(Math.abs(max - min) < 20 ? 1 : 0)}%
              </text>
            </g>
          );
        })}
        <g clipPath="url(#eq-reveal)">
          <path
            d={`${line} L${X(last.x)},${Y(min)} L${X(0)},${Y(min)} Z`}
            fill="url(#eq-fill)"
          />
          <path d={line} fill="none" stroke="var(--hud)" strokeWidth="1.5" />
        </g>
      </svg>
      {/* the one glowing element */}
      <span
        aria-hidden
        className="absolute w-2 h-2 rounded-full"
        style={{
          left: X(last.x) - 4,
          top: Y(last.v) - 4,
          background: "var(--hud)",
          boxShadow: "var(--glow)",
          animation: "pulse-dot 2s ease-in-out infinite",
        }}
      />
    </div>
  );
}
