"use client";

import { useEffect, useState } from "react";

// ReactorGauge — the arc-reactor centerpiece. An SVG radial gauge whose arc
// fills to the swarm-consensus share, with a slowly counter-rotating dashed
// ring. The % counts up once on mount (boot moment), then holds static.

export default function ReactorGauge({
  value, // 0-100 consensus share
  label,
  sublabel,
}: {
  value: number | null;
  label: string;
  sublabel: string;
}) {
  const [display, setDisplay] = useState(0);

  useEffect(() => {
    if (value == null) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setDisplay(value);
      return;
    }
    const start = performance.now();
    const dur = 900;
    let raf = 0;
    const tick = (t: number) => {
      const p = Math.min((t - start) / dur, 1);
      setDisplay(Math.round(value * (1 - Math.pow(1 - p, 3))));
      if (p < 1) raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(raf);
  }, [value]);

  const R = 84;
  const C = 2 * Math.PI * R;
  const share = value == null ? 0 : display / 100;

  return (
    <div className="relative grid place-items-center" style={{ width: 220, height: 220 }}>
      <svg width="220" height="220" viewBox="0 0 220 220" className="absolute inset-0">
        {/* track */}
        <circle cx="110" cy="110" r={R} fill="none" stroke="var(--border)" strokeWidth="6" />
        {/* consensus arc */}
        <circle
          cx="110"
          cy="110"
          r={R}
          fill="none"
          stroke="var(--hud)"
          strokeWidth="6"
          strokeLinecap="round"
          strokeDasharray={`${C * share} ${C}`}
          transform="rotate(-90 110 110)"
          style={{ transition: "stroke-dasharray 120ms linear", filter: "drop-shadow(0 0 6px color-mix(in srgb, var(--hud) 60%, transparent))" }}
        />
        {/* counter-rotating dashed ring */}
        <g style={{ transformOrigin: "110px 110px", animation: "reactor-spin 24s linear infinite reverse" }}>
          <circle
            cx="110"
            cy="110"
            r={R - 14}
            fill="none"
            stroke="color-mix(in srgb, var(--hud) 45%, transparent)"
            strokeWidth="1"
            strokeDasharray="2 6"
          />
        </g>
        <circle
          cx="110"
          cy="110"
          r={R - 26}
          fill="none"
          stroke="color-mix(in srgb, var(--hud) 20%, transparent)"
          strokeWidth="1"
        />
      </svg>
      <div className="text-center relative">
        <div className="num text-[52px] leading-none font-bold" style={{ color: "var(--hud)" }}>
          {value == null ? "—" : display}
          {value != null && <span className="text-xl text-[var(--muted)]">%</span>}
        </div>
        <div className="hud-label mt-2">{label}</div>
        <div className="num mt-1 text-[11px] text-[var(--muted)] max-w-[150px]">{sublabel}</div>
      </div>
    </div>
  );
}
