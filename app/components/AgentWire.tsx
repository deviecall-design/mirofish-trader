"use client";

import { useEffect, useState } from "react";
import { supabase, type SignalRow } from "../lib/supabase";

// Agent Wire — header ticker cycling agent dispatches every ~4s, derived from
// real recent signals so it never feels fabricated. See DESIGN.md.

interface WireLine {
  agent: string;
  msg: string;
  action: string;
  tone: "bull" | "bear" | "flat";
}

const VERBS: Record<string, string[]> = {
  bullish: ["momentum divergence", "breakout confirmation", "accumulation pattern"],
  bearish: ["distribution signal", "funding rate anomaly", "momentum exhaustion"],
  neutral: ["mixed archetype votes", "consensus split", "range compression"],
};

function linesFromSignals(signals: SignalRow[]): WireLine[] {
  return signals.slice(0, 8).map((s, i) => {
    const verbs = VERBS[s.direction] ?? VERBS.neutral;
    const agentId = String(((s.conviction + 7) * 137 + i * 61) % 1000).padStart(4, "0");
    return {
      agent: `AGENT-${agentId}`,
      msg: `${verbs[i % verbs.length]} ${s.symbol}`,
      action:
        s.direction === "bullish"
          ? "flipped LONG"
          : s.direction === "bearish"
          ? "flipped SHORT"
          : `conf 0.${String(Math.max(s.conviction, 10)).padStart(2, "0")}`,
      tone: s.direction === "bullish" ? "bull" : s.direction === "bearish" ? "bear" : "flat",
    };
  });
}

const FALLBACK: WireLine[] = [
  { agent: "AGENT-0447", msg: "swarm initialising", action: "1000 agents online", tone: "flat" },
];

export default function AgentWire() {
  const [lines, setLines] = useState<WireLine[]>(FALLBACK);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    supabase()
      .from("signals")
      .select("symbol,direction,conviction,created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data?.length) setLines(linesFromSignals(data as SignalRow[]));
      });
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      setVisible(false);
      setTimeout(() => {
        setIdx((i) => i + 1);
        setVisible(true);
      }, 150);
    }, 4000);
    return () => clearInterval(t);
  }, []);

  const line = lines[idx % lines.length];
  return (
    <div
      className="hud-label h-[18px] overflow-hidden transition-opacity duration-150"
      style={{ opacity: visible ? 1 : 0 }}
      aria-live="off"
    >
      <span style={{ color: "var(--hud)" }}>{line.agent}</span>
      {" → "}
      {line.msg}
      {" → "}
      <span
        style={{
          color:
            line.tone === "bull"
              ? "var(--bullish)"
              : line.tone === "bear"
              ? "var(--bearish)"
              : "var(--foreground)",
        }}
      >
        {line.action}
      </span>
    </div>
  );
}
