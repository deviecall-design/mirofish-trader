"use client";

import React, { useEffect, useState, useCallback, useMemo } from "react";
import { SignalCard } from "./components/SignalCard";
import ConsensusStrip from "./components/ConsensusStrip";
import { ConvictionHeatmap } from "./components/ConvictionHeatmap";
import { Card, Stat } from "./components/Card";
import { ConvictionBarChart, ConvictionBarDatum } from "./components/charts/ConvictionBarChart";
import { supabase, SignalRow, TradeRow } from "./lib/supabase";
import { useVirtualizedSignals } from "./hooks/useVirtualizedSignals";
import { Archetype } from "./components/ArchetypeFilter";
import { SignalActions } from "./signals/SignalActions";

interface DebugMacroResponse {
  degraded: boolean;
  macro_bias: number;
  social_bias: number;
  timestamp: string;
}

interface ArchetypeBreakdown {
  momentum: number;
  contrarian: number;
  macro: number;
  sentiment: number;
}

interface SignalWithMeta extends SignalRow {
  archetypeBreakdown?: ArchetypeBreakdown;
}

const ARCHETYPES: Archetype[] = ["momentum", "contrarian", "macro", "sentiment"];

function formatPct(n: number) {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function formatUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

function parseSignalsWithMeta(signalRows: any[]): SignalWithMeta[] {
  return signalRows.map((s: any) => {
    try {
      const meta = s.meta ? JSON.parse(s.meta) : {};
      return { ...s, archetypeBreakdown: meta.archetypeBreakdown };
    } catch {
      return s as SignalWithMeta;
    }
  });
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

export default function Dashboard() {
  const [recentSignals, setRecentSignals] = useState<SignalWithMeta[]>([]);
  const [tradeRows, setTradeRows] = useState<TradeRow[]>([]);
  const [chartSignals, setChartSignals] = useState<SignalWithMeta[]>([]);
  const [loading, setLoading] = useState(true);
  const [macroBias, setMacroBias] = useState<number>(0);
  const [socialBias, setSocialBias] = useState<number>(0);
  const [selectedArchetypes, setSelectedArchetypes] = useState<Set<Archetype>>(new Set());
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  const { filtered: filteredSignals, pages } = useVirtualizedSignals(
    recentSignals,
    selectedArchetypes,
    PAGE_SIZE
  );
  const currentPageSignals = pages[currentPage] || [];

  // Load initial data
  useEffect(() => {
    const loadInitialData = async () => {
      const sb = supabase();
      const [trades, signals, signalsForChartData] = await Promise.all([
        sb.from("trades").select("*").order("opened_at", { ascending: false }),
        sb.from("signals").select("*").order("created_at", { ascending: false }).limit(8),
        sb.from("signals").select("*").order("created_at", { ascending: false }).limit(200),
      ]);
      setTradeRows((trades.data ?? []) as TradeRow[]);
      setRecentSignals(parseSignalsWithMeta(signals.data ?? []));
      setChartSignals(parseSignalsWithMeta(signalsForChartData.data ?? []));
      setLoading(false);
    };
    loadInitialData().catch(console.error);
  }, []);

  // Subscribe to real-time signal updates
  useEffect(() => {
    const sb = supabase();
    const channel = sb
      .channel("signals_realtime")
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "signals" },
        (payload) => {
          const newSignal = payload.new as any;
          const parsedSignal: SignalWithMeta = {
            ...newSignal,
            archetypeBreakdown: newSignal.meta
              ? JSON.parse(newSignal.meta).archetypeBreakdown
              : undefined,
          };
          setRecentSignals((prev) => [parsedSignal, ...prev.slice(0, 7)]);
          setChartSignals((prev) => [parsedSignal, ...prev.slice(0, 199)]);
        }
      )
      .subscribe();
    return () => {
      sb.removeChannel(channel);
    };
  }, []);

  // Macro/social bias, refreshed each minute
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

  const handleArchetypeToggle = useCallback((archetype: Archetype) => {
    setSelectedArchetypes((prev) => {
      const next = new Set(prev);
      if (next.has(archetype)) next.delete(archetype);
      else next.add(archetype);
      return next;
    });
    setCurrentPage(0);
  }, []);

  // Chart data
  const convictionBarData: ConvictionBarDatum[] = useMemo(() => {
    const bySymbol = new Map<string, { sum: number; count: number; dirCounts: Record<string, number> }>();
    for (const s of chartSignals) {
      const entry = bySymbol.get(s.symbol) ?? { sum: 0, count: 0, dirCounts: {} };
      entry.sum += s.conviction;
      entry.count += 1;
      entry.dirCounts[s.direction] = (entry.dirCounts[s.direction] ?? 0) + 1;
      bySymbol.set(s.symbol, entry);
    }
    return Array.from(bySymbol.entries())
      .map(([symbol, e]) => ({
        symbol,
        conviction: Math.round(e.sum / e.count),
        direction:
          Object.entries(e.dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral",
      }))
      .sort((a, b) => b.conviction - a.conviction);
  }, [chartSignals]);

  // Trade stats
  const open = tradeRows.filter((t) => t.status === "open");
  const closed = tradeRows.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  // Swarm hero: the highest-conviction pending signal is the machine's ask.
  const topSignal = useMemo(
    () =>
      [...recentSignals]
        .filter((s) => s.status === "pending")
        .sort((a, b) => b.conviction - a.conviction)[0],
    [recentSignals]
  );
  const consensusShare = topSignal
    ? Math.round((0.33 + 0.67 * (topSignal.conviction / 100)) * 100)
    : null;

  if (loading) {
    return (
      <div className="py-24 text-center">
        <p className="hud-label animate-pulse">Bringing swarm online…</p>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* ── Swarm hero: state of the machine, not state of the market ── */}
      <section className="grid gap-4 lg:grid-cols-[1fr_1.2fr]">
        <Card className="hud-corners flex flex-col justify-between gap-6">
          <div>
            <div className="hud-label">Swarm Consensus</div>
            <div className="mt-2 flex items-baseline gap-3">
              <span className="num text-5xl font-bold" style={{ color: "var(--hud)" }}>
                {consensusShare ?? "—"}
                {consensusShare !== null && (
                  <span className="text-2xl text-[var(--muted)]">%</span>
                )}
              </span>
              {topSignal && (
                <span className="num text-sm text-[var(--muted)]">
                  on {topSignal.symbol} · {topSignal.direction}
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-[var(--muted)]">
              {topSignal
                ? `${Math.round((consensusShare! / 100) * 1000)} of 1,000 agents aligned on the top signal`
                : "1,000 agents watching — no pending signals"}
            </p>
          </div>
          <div className="flex items-end justify-between gap-4 flex-wrap">
            <div>
              <div className="hud-label">Total P&amp;L</div>
              <div
                className={`num text-4xl font-bold ${
                  totalPnl >= 0 ? "text-[var(--bullish)]" : "text-[var(--bearish)]"
                }`}
              >
                {formatPct(totalPnl)}
              </div>
              <div className="num mt-1 text-xs text-[var(--muted)]">
                {closed.length} closed · {open.length} open
              </div>
            </div>
            <div className="flex gap-2">
              <BiasChip label="Macro" value={macroBias} />
              <BiasChip label="Social" value={socialBias} />
            </div>
          </div>
        </Card>

        <Card className="hud-corners" title="Top conviction signal">
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
                </div>
                <span className="num text-2xl font-bold">
                  {topSignal.conviction}
                  <span className="text-sm text-[var(--muted)]">/100</span>
                </span>
              </div>
              <ConsensusStrip
                direction={topSignal.direction}
                conviction={topSignal.conviction}
              />
              {topSignal.summary && (
                <p className="text-sm text-[var(--muted)] leading-relaxed">
                  {topSignal.summary}
                </p>
              )}
              <div className="flex items-center justify-between gap-3 pt-1">
                {topSignal.price != null && (
                  <span className="num text-sm text-[var(--muted)]">
                    ${Number(topSignal.price).toFixed(2)}
                  </span>
                )}
                <SignalActions signal={topSignal} />
              </div>
            </div>
          ) : (
            <p className="text-sm text-[var(--muted)]">
              Nothing awaiting approval. The swarm scans every 15 minutes and will
              raise a signal on the next ±2% move.
            </p>
          )}
        </Card>
      </section>

      {/* ── Stats ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Stat
          label="Win rate"
          value={`${winRate.toFixed(0)}%`}
          hint={`${wins.length}/${closed.length} wins`}
          tone={winRate >= 50 ? "bullish" : closed.length ? "bearish" : undefined}
        />
        <Stat label="Open positions" value={String(open.length)} />
        <Stat
          label="High conviction"
          value={String(recentSignals.filter((s) => s.conviction >= 67).length)}
        />
        <Stat
          label="Pending approval"
          value={String(recentSignals.filter((s) => s.status === "pending").length)}
          tone="neutral"
        />
      </div>

      {/* ── Conviction chart ── */}
      <Card title="Avg conviction by symbol">
        <ConvictionBarChart data={convictionBarData} />
      </Card>

      {/* ── Signal feed ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between gap-4 flex-wrap">
          <h2 className="hud-title text-lg">
            <span style={{ color: "var(--hud)" }}>//</span> Signals ({filteredSignals.length})
          </h2>
          <div className="flex gap-2">
            {ARCHETYPES.map((a) => {
              const active = selectedArchetypes.has(a);
              return (
                <button
                  key={a}
                  onClick={() => handleArchetypeToggle(a)}
                  className="hud-label rounded border px-2.5 py-1 transition-colors duration-120"
                  style={{
                    borderColor: active
                      ? "color-mix(in srgb, var(--hud) 50%, transparent)"
                      : "var(--border)",
                    color: active ? "var(--hud)" : "var(--muted)",
                    background: active ? "var(--panel-2)" : "transparent",
                  }}
                >
                  {a}
                </button>
              );
            })}
          </div>
        </div>

        {filteredSignals.length === 0 ? (
          <Card>
            <p className="text-sm text-[var(--muted)]">
              No signals yet — the cron job will populate this when prices move ±2%.
            </p>
          </Card>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {currentPageSignals.map((signal: SignalWithMeta) => (
                <SignalCard key={signal.id} signal={signal} compact={false} />
              ))}
            </div>

            {pages.length > 1 && (
              <div className="flex items-center justify-center gap-2 pt-4">
                <button
                  onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                  disabled={currentPage === 0}
                  className="hud-label rounded border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)] disabled:opacity-40 transition-colors duration-120"
                >
                  ← Prev
                </button>
                <span className="num text-xs text-[var(--muted)]">
                  {currentPage + 1}/{pages.length}
                </span>
                <button
                  onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                  disabled={currentPage === pages.length - 1}
                  className="hud-label rounded border border-[var(--border)] px-3 py-1.5 hover:bg-[var(--panel-2)] disabled:opacity-40 transition-colors duration-120"
                >
                  Next →
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* ── Conviction heatmap ── */}
      <ConvictionHeatmap signals={chartSignals} />

      {/* ── Open positions ── */}
      <Card title="Open positions">
        {open.length === 0 ? (
          <p className="text-sm text-[var(--muted)]">No open positions yet.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-left">
                <tr>
                  <th className="hud-label py-2 font-semibold">Symbol</th>
                  <th className="hud-label font-semibold">Direction</th>
                  <th className="hud-label font-semibold">Mode</th>
                  <th className="hud-label font-semibold">Entry</th>
                  <th className="hud-label font-semibold">Opened</th>
                </tr>
              </thead>
              <tbody>
                {open.map((t) => (
                  <tr
                    key={t.id}
                    className="border-t border-[var(--border)] hover:bg-[var(--panel-2)] transition-colors duration-120"
                  >
                    <td className="num py-2 font-bold">{t.symbol}</td>
                    <td
                      className="capitalize"
                      style={{
                        color:
                          t.direction === "bullish"
                            ? "var(--bullish)"
                            : t.direction === "bearish"
                            ? "var(--bearish)"
                            : "var(--muted)",
                      }}
                    >
                      {t.direction}
                    </td>
                    <td>
                      <span
                        className="hud-label"
                        style={{ color: t.mode && t.mode !== "paper" ? "var(--hud)" : "var(--muted)" }}
                      >
                        {t.mode ?? "paper"}
                      </span>
                    </td>
                    <td className="num" style={{ color: "var(--hud)" }}>
                      {formatUsd(Number(t.entry_price))}
                    </td>
                    <td className="num text-[var(--muted)]">
                      {new Date(t.opened_at).toLocaleString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </div>
  );
}
