"use client";

import React, { useEffect, useState, useMemo } from "react";
import ConsensusStrip from "./components/ConsensusStrip";
import ReactorGauge from "./components/ReactorGauge";
import EquityCurve from "./components/EquityCurve";
import JarvisChat from "./components/JarvisChat";
import { supabase, SignalRow, TradeRow } from "./lib/supabase";
import { SignalActions } from "./signals/SignalActions";

// The cockpit. Not a document — an instrument panel. Left rail: watchlist
// telemetry. Center stage: reactor gauge, P&L, equity curve, the machine's
// ask. Right rail: Jarvis console. See DESIGN.md.

interface DebugMacroResponse {
  degraded: boolean;
  macro_bias: number;
  social_bias: number;
  timestamp: string;
}

function formatPct(n: number) {
  return `${n >= 0 ? "+" : ""}${n.toFixed(2)}%`;
}

function Clock() {
  const [now, setNow] = useState<string>("");
  useEffect(() => {
    const tick = () => setNow(new Date().toLocaleTimeString("en-AU", { hour12: false }));
    tick();
    const t = setInterval(tick, 1000);
    return () => clearInterval(t);
  }, []);
  return <span className="num text-xs text-[var(--muted)]">{now}</span>;
}

function BiasChip({ label, value }: { label: string; value: number }) {
  const tone =
    value > 0.05 ? "var(--bullish)" : value < -0.05 ? "var(--bearish)" : "var(--muted)";
  return (
    <span className="hud-label flex items-center gap-1.5 rounded border border-[var(--border)] bg-[var(--panel-2)] px-2.5 py-1">
      {label}
      <span className="num" style={{ color: tone }}>
        {value >= 0 ? "+" : ""}
        {Math.round(value * 100)}%
      </span>
    </span>
  );
}

function Panel({
  title,
  children,
  className = "",
  delay = 0,
  right,
}: {
  title?: string;
  children: React.ReactNode;
  className?: string;
  delay?: number;
  right?: React.ReactNode;
}) {
  return (
    <section
      className={`rounded-lg border border-[var(--border)] bg-[var(--panel)]/90 backdrop-blur-[2px] p-4 boot-panel ${className}`}
      style={{ animationDelay: `${delay}ms` }}
    >
      {(title || right) && (
        <div className="mb-3 flex items-center justify-between gap-2">
          {title && <h3 className="hud-label">{title}</h3>}
          {right}
        </div>
      )}
      {children}
    </section>
  );
}

export default function Cockpit() {
  const [signals, setSignals] = useState<SignalRow[]>([]);
  const [trades, setTrades] = useState<TradeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [macroBias, setMacroBias] = useState(0);
  const [socialBias, setSocialBias] = useState(0);
  const [bootMsg, setBootMsg] = useState("INITIALISING SWARM");

  // Boot line
  useEffect(() => {
    const steps = [
      [200, "LINKING 1000 AGENTS"],
      [550, "SYNCING MARKET FEEDS"],
      [900, "SWARM ONLINE"],
    ] as const;
    const timers = steps.map(([ms, msg]) => setTimeout(() => setBootMsg(msg), ms));
    return () => timers.forEach(clearTimeout);
  }, []);

  // Data
  useEffect(() => {
    const load = async () => {
      const sb = supabase();
      const [t, s] = await Promise.all([
        sb.from("trades").select("*").order("opened_at", { ascending: false }),
        sb.from("signals").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      setTrades((t.data ?? []) as TradeRow[]);
      setSignals((s.data ?? []) as SignalRow[]);
      setLoading(false);
    };
    load().catch(console.error);
  }, []);

  // Realtime signals
  useEffect(() => {
    const sb = supabase();
    const channel = sb
      .channel("signals_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => setSignals((prev) => [payload.new as SignalRow, ...prev.slice(0, 199)])
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  // Bias
  useEffect(() => {
    const fetchBias = async () => {
      try {
        const res = await fetch("/api/debug/macro");
        const data: DebugMacroResponse = await res.json();
        setMacroBias(data.macro_bias);
        setSocialBias(data.social_bias);
      } catch (err) {
        console.error("Failed to fetch bias:", err);
      }
    };
    fetchBias();
    const interval = setInterval(fetchBias, 60000);
    return () => clearInterval(interval);
  }, []);

  const open = trades.filter((t) => t.status === "open");
  const closed = trades.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const topSignal = useMemo(
    () =>
      [...signals]
        .filter((s) => s.status === "pending")
        .sort((a, b) => b.conviction - a.conviction)[0],
    [signals]
  );
  const consensusShare = topSignal
    ? Math.round((0.33 + 0.67 * (topSignal.conviction / 100)) * 100)
    : null;

  // Watchlist telemetry: latest signal per symbol
  const telemetry = useMemo(() => {
    const seen = new Map<string, SignalRow>();
    for (const s of signals) if (!seen.has(s.symbol)) seen.set(s.symbol, s);
    return Array.from(seen.values()).slice(0, 12);
  }, [signals]);

  const pendingSignals = useMemo(
    () => signals.filter((s) => s.status === "pending").slice(0, 12),
    [signals]
  );

  if (loading) {
    return (
      <div className="grid place-items-center py-32">
        <div className="text-center space-y-3">
          <div
            className="mx-auto w-14 h-14 rounded-full"
            style={{
              border: "1px dashed color-mix(in srgb, var(--hud) 60%, transparent)",
              animation: "reactor-spin 3s linear infinite",
            }}
          />
          <p className="hud-label animate-pulse">{bootMsg}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <style>{`
        @keyframes boot-in { from { opacity: 0; transform: translateY(6px); } to { opacity: 1; transform: none; } }
        .boot-panel { opacity: 0; animation: boot-in 320ms cubic-bezier(.2,0,0,1) forwards; }
        @media (prefers-reduced-motion: reduce) { .boot-panel { opacity: 1; animation: none; } }
      `}</style>

      {/* Cockpit grid */}
      <div className="grid gap-4 lg:grid-cols-[230px_minmax(0,1fr)_360px]">
        {/* ── Left rail: watchlist telemetry ── */}
        <div className="space-y-4 lg:max-h-[calc(100vh-190px)] lg:overflow-y-auto">
          <Panel title="Telemetry" delay={80} right={<Clock />}>
            <ul className="space-y-1">
              {telemetry.map((s) => (
                <li
                  key={s.symbol}
                  className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-[var(--panel-2)] transition-colors duration-120"
                >
                  <span className="flex items-center gap-2 min-w-0">
                    <span
                      aria-hidden
                      className="inline-block w-1.5 h-1.5 rounded-full shrink-0"
                      style={{
                        background:
                          s.direction === "bullish"
                            ? "var(--bullish)"
                            : s.direction === "bearish"
                            ? "var(--bearish)"
                            : "var(--muted)",
                      }}
                    />
                    <span className="num text-sm font-bold truncate">{s.symbol}</span>
                  </span>
                  <span className="num text-xs text-[var(--muted)]">
                    {s.price != null ? `$${Number(s.price).toFixed(2)}` : "—"}
                  </span>
                </li>
              ))}
            </ul>
          </Panel>
          <Panel title="Session" delay={160}>
            <dl className="space-y-2 text-sm">
              {[
                ["Win rate", `${winRate.toFixed(0)}%`, winRate >= 50 ? "var(--bullish)" : "var(--bearish)"],
                ["Open", String(open.length), "var(--foreground)"],
                ["Closed", String(closed.length), "var(--foreground)"],
                ["Pending", String(pendingSignals.length), "var(--hud)"],
              ].map(([k, v, c]) => (
                <div key={k as string} className="flex items-center justify-between">
                  <dt className="hud-label">{k}</dt>
                  <dd className="num font-bold" style={{ color: c as string }}>
                    {v}
                  </dd>
                </div>
              ))}
            </dl>
          </Panel>
        </div>

        {/* ── Center stage ── */}
        <div className="space-y-4 min-w-0">
          <Panel delay={0} className="hud-corners">
            <div className="flex items-center justify-around gap-6 flex-wrap">
              <ReactorGauge
                value={consensusShare}
                label="Swarm consensus"
                sublabel={
                  topSignal
                    ? `${Math.round(((consensusShare ?? 0) / 100) * 1000)} of 1000 agents · ${topSignal.symbol}`
                    : "1000 agents watching"
                }
              />
              <div className="text-center">
                <div className="hud-label">Total P&amp;L</div>
                <div
                  className={`num text-6xl font-bold leading-tight ${
                    totalPnl >= 0 ? "text-[var(--bullish)]" : "text-[var(--bearish)]"
                  }`}
                >
                  {formatPct(totalPnl)}
                </div>
                <div className="num mt-1 text-xs text-[var(--muted)]">
                  {closed.length} closed · {open.length} open
                </div>
                <div className="mt-3 flex justify-center gap-2">
                  <BiasChip label="Macro" value={macroBias} />
                  <BiasChip label="Social" value={socialBias} />
                </div>
              </div>
            </div>
          </Panel>

          <Panel title="Equity curve" delay={120}>
            <EquityCurve trades={trades} height={190} />
          </Panel>

          <Panel
            title="The swarm's ask"
            delay={200}
            right={
              topSignal && (
                <span className="num text-sm font-bold">
                  {topSignal.conviction}
                  <span className="text-[var(--muted)]">/100</span>
                </span>
              )
            }
          >
            {topSignal ? (
              <div className="space-y-3">
                <div className="flex items-baseline justify-between gap-3 flex-wrap">
                  <div className="flex items-baseline gap-3">
                    <span className="num text-2xl font-bold">{topSignal.symbol}</span>
                    <span
                      className="hud-label rounded border px-2 py-0.5"
                      style={{
                        color:
                          topSignal.direction === "bullish"
                            ? "var(--bullish)"
                            : topSignal.direction === "bearish"
                            ? "var(--bearish)"
                            : "var(--neutral)",
                        borderColor: "color-mix(in srgb, currentColor 35%, transparent)",
                      }}
                    >
                      {topSignal.direction}
                    </span>
                    {topSignal.price != null && (
                      <span className="num text-sm text-[var(--muted)]">
                        ${Number(topSignal.price).toFixed(2)}
                      </span>
                    )}
                  </div>
                  <SignalActions signal={topSignal} />
                </div>
                <ConsensusStrip direction={topSignal.direction} conviction={topSignal.conviction} />
                {topSignal.summary && (
                  <p className="text-sm text-[var(--muted)] leading-relaxed">{topSignal.summary}</p>
                )}
              </div>
            ) : (
              <p className="text-sm text-[var(--muted)]">
                Nothing awaiting approval — the swarm raises its hand on the next ±2% move.
              </p>
            )}
          </Panel>

          {pendingSignals.length > 1 && (
            <Panel title={`Queue (${pendingSignals.length - 1})`} delay={280}>
              <div className="flex gap-3 overflow-x-auto pb-1">
                {pendingSignals
                  .filter((s) => s.id !== topSignal?.id)
                  .map((s) => (
                    <div
                      key={s.id}
                      className="min-w-[190px] rounded-lg border border-[var(--border)] bg-[var(--panel-2)] p-3 space-y-2"
                    >
                      <div className="flex items-baseline justify-between">
                        <span className="num text-sm font-bold">{s.symbol}</span>
                        <span className="num text-sm">
                          {s.conviction}
                          <span className="text-xs text-[var(--muted)]">/100</span>
                        </span>
                      </div>
                      <ConsensusStrip direction={s.direction} conviction={s.conviction} />
                      <SignalActions signal={s} />
                    </div>
                  ))}
              </div>
            </Panel>
          )}
        </div>

        {/* ── Right rail: Jarvis console ── */}
        <Panel
          delay={360}
          className="flex flex-col p-0 lg:max-h-[calc(100vh-190px)] lg:min-h-[520px]"
        >
          <div className="flex items-center gap-2 px-4 py-3 border-b border-[var(--border)]">
            <span
              aria-hidden
              className="relative grid place-items-center w-8 h-8 rounded-full text-sm"
              style={{
                background:
                  "radial-gradient(circle, color-mix(in srgb, var(--hud) 50%, transparent) 0%, transparent 65%), var(--panel-2)",
                border: "1px solid color-mix(in srgb, var(--hud) 40%, transparent)",
                boxShadow: "var(--glow)",
                color: "var(--hud)",
                animation: "breathe 3s ease-in-out infinite",
              }}
            >
              ⚡
            </span>
            <span className="hud-title text-sm" style={{ color: "var(--hud)" }}>
              Jarvis
            </span>
            <span className="hud-label ml-auto">console</span>
          </div>
          <div className="flex-1 min-h-0 flex flex-col">
            <JarvisChat heightClass="min-h-[300px]" />
          </div>
        </Panel>
      </div>
    </div>
  );
}
