"use client";

import { useEffect, useState } from "react";
import { supabase, type SignalRow } from "../lib/supabase";
import { formatSignalAge, isStaleSignal } from "../lib/freshness";

// Header tape. These lines are stored signals, not agents dispatching orders.

interface WireLine {
  msg: string;
  action: string;
  tone: "bull" | "bear" | "flat";
}

function linesFromSignals(signals: SignalRow[], now: number): WireLine[] {
  return signals.slice(0, 8).map((s) => ({
    msg: `${s.symbol} ${s.direction}`,
    action: `${formatSignalAge(s.created_at, now)} · score ${s.conviction}/100${
      isStaleSignal(s.created_at, now) ? " · stale" : ""
    }`,
    tone: s.direction === "bullish" ? "bull" : s.direction === "bearish" ? "bear" : "flat",
  }));
}

const FALLBACK: WireLine[] = [
  { msg: "no stored signals", action: "scanner has not written a row", tone: "flat" },
];

export default function AgentWire() {
  const [lines, setLines] = useState<WireLine[]>(FALLBACK);
  const [idx, setIdx] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const now = Date.now();
    supabase()
      .from("signals")
      .select("symbol,direction,conviction,created_at")
      .order("created_at", { ascending: false })
      .limit(8)
      .then(({ data }) => {
        if (data?.length) setLines(linesFromSignals(data as SignalRow[], now));
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
      <span style={{ color: "var(--hud)" }}>Stored signal</span>
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
