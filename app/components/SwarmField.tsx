"use client";

import { useEffect, useRef } from "react";

// Swarm Field — 1,000 particles, one per agent, drifting behind the data
// plane. Leaning-long agents drift upper-right, leaning-short lower-left,
// abstainers orbit. 30fps cap, paused when the tab is hidden, disabled
// entirely under prefers-reduced-motion. See DESIGN.md → Signature Elements.

const AGENTS = 1000;
const BULL = "#2FE6A0";
const BEAR = "#FF5C7A";

export default function SwarmField({
  bullShare = 0.45,
  bearShare = 0.25,
}: {
  bullShare?: number;
  bearShare?: number;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let w = 0;
    let h = 0;
    const resize = () => {
      w = canvas.width = window.innerWidth;
      h = canvas.height = window.innerHeight;
    };
    resize();
    window.addEventListener("resize", resize);

    const bullCount = Math.round(AGENTS * bullShare);
    const bearCount = Math.round(AGENTS * bearShare);
    const agents = Array.from({ length: AGENTS }, (_, i) => ({
      x: Math.random() * 1.2 - 0.1,
      y: Math.random() * 1.2 - 0.1,
      vx: 0,
      vy: 0,
      phase: Math.random() * Math.PI * 2,
      stance: i < bullCount ? 1 : i < bullCount + bearCount ? -1 : 0,
    }));

    const hudColor = () =>
      getComputedStyle(document.body).getPropertyValue("--hud").trim() || "#FFAE33";

    let raf = 0;
    let last = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (t - last < 33) return; // 30fps cap
      last = t;
      ctx.clearRect(0, 0, w, h);
      const hud = hudColor();
      for (const a of agents) {
        a.phase += 0.004;
        const drift = 0.00022;
        a.vx += Math.cos(a.phase * 1.7 + a.y * 4) * drift + a.stance * 0.00003;
        a.vy += Math.sin(a.phase * 1.3 + a.x * 4) * drift - a.stance * 0.00002;
        a.vx *= 0.985;
        a.vy *= 0.985;
        a.x = (a.x + a.vx + 1.2) % 1.2;
        a.y = (a.y + a.vy + 1.2) % 1.2;
        ctx.globalAlpha = a.stance === 0 ? 0.12 : 0.22;
        ctx.fillStyle = a.stance === 1 ? BULL : a.stance === -1 ? BEAR : hud;
        ctx.fillRect(a.x * w - 0.75, a.y * h - 0.75, 1.5, 1.5);
      }
    };
    raf = requestAnimationFrame(frame);

    const onVisibility = () => {
      cancelAnimationFrame(raf);
      if (!document.hidden) raf = requestAnimationFrame(frame);
    };
    document.addEventListener("visibilitychange", onVisibility);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", resize);
      document.removeEventListener("visibilitychange", onVisibility);
    };
  }, [bullShare, bearShare]);

  return (
    <canvas
      ref={canvasRef}
      aria-hidden
      className="fixed inset-0 z-0 pointer-events-none"
    />
  );
}
