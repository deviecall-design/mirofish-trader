"use client";

import React, { useEffect, useState, useCallback } from "react";
import { BiasIndicator } from "./components/BiasIndicator";
import { MacroSentimentSparklines } from "./components/MacroSentimentSparklines";
import { ArchetypeFilter, Archetype } from "./components/ArchetypeFilter";
import { SignalCard } from "./components/SignalCard";
import { ConvictionHeatmap } from "./components/ConvictionHeatmap";
import { Card, Stat } from "./components/Card";
import { ConvictionBarChart, ConvictionBarDatum } from "./components/charts/ConvictionBarChart";
import { supabase, SignalRow, TradeRow } from "./lib/supabase";
import { useVirtualizedSignals } from "./hooks/useVirtualizedSignals";

interface SparklineData {
  time: string;
  value: number;
}

interface DebugMacroResponse {
  degraded: boolean;
  macro_bias: number;
  social_bias: number;
  timestamp: string;
}

function formatPct(n: number) {
  const s = n >= 0 ? "+" : "";
  return `${s}${n.toFixed(2)}%`;
}

function formatUsd(n: number) {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD" });
}

export default function Dashboard() {
  // State: Data
  const [recentSignals, setRecentSignals] = useState<SignalRow[]>([]);
  const [tradeRows, setTradeRows] = useState<TradeRow[]>([]);
  const [chartSignals, setChartSignals] = useState<SignalRow[]>([]);
  const [loading, setLoading] = useState(true);

  // State: Bias
  const [macroBias, setMacroBias] = useState<number>(0);
  const [socialBias, setSocialBias] = useState<number>(0);
  const [biasLoading, setBiasLoading] = useState(false);

  // State: Sparklines
  const [t10y2yHistory, setT10y2yHistory] = useState<SparklineData[]>([]);
  const [vixHistory, setVixHistory] = useState<SparklineData[]>([]);
  const [sentimentHistory, setSentimentHistory] = useState<SparklineData[]>([]);

  // State: UI
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [selectedArchetypes, setSelectedArchetypes] = useState<Set<Archetype>>(
    new Set()
  );
  const [currentPage, setCurrentPage] = useState(0);
  const PAGE_SIZE = 20;

  // Hooks
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
      setRecentSignals((signals.data ?? []) as SignalRow[]);
      setChartSignals((signalsForChartData.data ?? []) as SignalRow[]);
      setLoading(false);

      // Subscribe to real-time signal updates
      const channel = supabase()
        .channel("signals_realtime")
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "signals",
          },
          (payload) => {
            const newSignal = payload.new as SignalRow;
            setRecentSignals((prev) => [newSignal, ...prev.slice(0, 7)]);
            setChartSignals((prev) => [newSignal, ...prev.slice(0, 199)]);
          }
        )
        .subscribe();

      return () => {
        channel.unsubscribe();
      };
    };

    loadInitialData().catch(console.error);
  }, []);

  // Fetch macro/social bias periodically
  useEffect(() => {
    const fetchBias = async () => {
      setBiasLoading(true);
      try {
        const res = await fetch("/api/debug/macro");
        const data: DebugMacroResponse = await res.json();
        setMacroBias(data.macro_bias);
        setSocialBias(data.social_bias);

        // Add to sparkline history (simplified: just add one data point)
        const now = new Date();
        const timeStr = now.toLocaleTimeString("en-US", {
          hour: "2-digit",
          minute: "2-digit",
        });

        setT10y2yHistory((prev) => [
          ...prev.slice(-23), // Keep last 24h
          { time: timeStr, value: data.macro_bias },
        ]);
        setVixHistory((prev) => [
          ...prev.slice(-23),
          { time: timeStr, value: data.social_bias * 0.5 }, // Mock VIX (not real)
        ]);
        setSentimentHistory((prev) => [
          ...prev.slice(-23),
          { time: timeStr, value: data.social_bias },
        ]);
      } catch (err) {
        console.error("Failed to fetch bias:", err);
      } finally {
        setBiasLoading(false);
      }
    };

    fetchBias();
    const interval = setInterval(fetchBias, 60000); // Update every minute
    return () => clearInterval(interval);
  }, []);

  // Handle archetype filter toggle
  const handleArchetypeToggle = useCallback((archetype: Archetype) => {
    setSelectedArchetypes((prev) => {
      const next = new Set(prev);
      if (next.has(archetype)) {
        next.delete(archetype);
      } else {
        next.add(archetype);
      }
      // TODO: Persist to URL query params / localStorage
      return next;
    });
    setCurrentPage(0); // Reset to first page when filter changes
  }, []);

  // Calculate chart data
  const bySymbol = new Map<string, { sum: number; count: number; dirCounts: Record<string, number> }>();
  for (const s of chartSignals) {
    const entry = bySymbol.get(s.symbol) ?? { sum: 0, count: 0, dirCounts: {} };
    entry.sum += s.conviction;
    entry.count += 1;
    entry.dirCounts[s.direction] = (entry.dirCounts[s.direction] ?? 0) + 1;
    bySymbol.set(s.symbol, entry);
  }
  const convictionBarData: ConvictionBarDatum[] = Array.from(bySymbol.entries())
    .map(([symbol, e]) => {
      const dominant = Object.entries(e.dirCounts).sort((a, b) => b[1] - a[1])[0]?.[0] || "neutral";
      return {
        symbol,
        conviction: Math.round(e.sum / e.count),
        direction: dominant,
      };
    })
    .sort((a, b) => b.conviction - a.conviction);

  // Calculate trade stats
  const open = tradeRows.filter((t) => t.status === "open");
  const closed = tradeRows.filter((t) => t.status === "closed");
  const wins = closed.filter((t) => (t.pnl ?? 0) > 0);
  const winRate = closed.length ? (wins.length / closed.length) * 100 : 0;
  const totalPnl = closed.reduce((sum, t) => sum + (t.pnl ?? 0), 0);

  const highConvictionCount = recentSignals.filter((s) => s.conviction >= 67).length;
  const pendingCount = recentSignals.filter((s) => s.status === "pending").length;

  if (loading) {
    return (
      <div className="space-y-8 p-6">
        <header>
          <h1 className="text-2xl font-semibold text-white">Dashboard</h1>
          <p className="text-sm text-[#64748B] mt-1">Loading...</p>
        </header>
      </div>
    );
  }

  return (
    <div className="bg-[#0F172A] min-h-screen">
      {/* Sticky Hero Section */}
      <BiasIndicator
        macroBias={macroBias}
        socialBias={socialBias}
        loading={biasLoading}
      />

      {/* Sparklines */}
      <div className="sticky top-[80px] z-30 bg-[#0F172A] px-6 py-4 border-b border-[#334155]/50">
        <div className="max-w-7xl mx-auto">
          <MacroSentimentSparklines
            t10y2yHistory={t10y2yHistory}
            vixHistory={vixHistory}
            sentimentHistory={sentimentHistory}
            height={40}
          />
        </div>
      </div>

      {/* Main Layout: Sidebar + Feed */}
      <div className="flex">
        {/* Sidebar */}
        <ArchetypeFilter
          selectedArchetypes={selectedArchetypes}
          onToggle={handleArchetypeToggle}
          signalStats={{
            total: recentSignals.length,
            highConviction: highConvictionCount,
            pending: pendingCount,
          }}
          isOpen={sidebarOpen}
          onToggleOpen={() => setSidebarOpen(!sidebarOpen)}
        />

        {/* Main Content Area */}
        <main className="flex-1 px-6 py-8 max-w-7xl mx-auto w-full space-y-8">
          {/* Stats Section */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <Stat
              label="Total P&amp;L"
              value={formatPct(totalPnl)}
              hint={`${closed.length} closed trades`}
              tone={totalPnl >= 0 ? "bullish" : "bearish"}
            />
            <Stat label="Open positions" value={String(open.length)} />
            <Stat
              label="Win rate"
              value={`${winRate.toFixed(0)}%`}
              hint={`${wins.length}/${closed.length} wins`}
              tone={winRate >= 50 ? "bullish" : closed.length ? "bearish" : undefined}
            />
            <Stat label="Total signals" value={String(recentSignals.length)} />
          </div>

          {/* Conviction Chart */}
          <Card title="Avg conviction by symbol">
            <ConvictionBarChart data={convictionBarData} />
          </Card>

          {/* Signal Feed */}
          <div className="space-y-4">
            <h2 className="text-xl font-bold text-white">
              Signals ({filteredSignals.length})
            </h2>

            {filteredSignals.length === 0 ? (
              <Card title="Signals">
                <p className="text-sm text-[#64748B]">
                  No signals yet — the cron job will populate this when prices move ±2%.
                </p>
              </Card>
            ) : (
              <>
                {/* Masonry Grid */}
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {currentPageSignals.map((signal) => (
                    <SignalCard
                      key={signal.id}
                      signal={signal}
                      compact={false}
                    />
                  ))}
                </div>

                {/* Pagination */}
                {pages.length > 1 && (
                  <div className="flex items-center justify-center gap-2 pt-4">
                    <button
                      onClick={() => setCurrentPage((p) => Math.max(0, p - 1))}
                      disabled={currentPage === 0}
                      className="px-4 py-2 rounded-lg bg-[#1E293B]/50 border border-[#334155]/50 text-[#CBD5E1] hover:bg-[#334155]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      ← Previous
                    </button>

                    <div className="flex gap-1">
                      {pages.map((_, i) => (
                        <button
                          key={i}
                          onClick={() => setCurrentPage(i)}
                          className={`w-8 h-8 rounded-lg font-semibold transition-colors ${
                            currentPage === i
                              ? "bg-[#3B82F6] text-white"
                              : "bg-[#1E293B]/50 border border-[#334155]/50 text-[#CBD5E1] hover:bg-[#334155]/50"
                          }`}
                        >
                          {i + 1}
                        </button>
                      ))}
                    </div>

                    <button
                      onClick={() => setCurrentPage((p) => Math.min(pages.length - 1, p + 1))}
                      disabled={currentPage === pages.length - 1}
                      className="px-4 py-2 rounded-lg bg-[#1E293B]/50 border border-[#334155]/50 text-[#CBD5E1] hover:bg-[#334155]/50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                    >
                      Next →
                    </button>
                  </div>
                )}
              </>
            )}
          </div>

          {/* Conviction Heatmap */}
          <ConvictionHeatmap signals={chartSignals} />

          {/* Open Trades Section */}
          <Card title="Open positions">
            {open.length === 0 ? (
              <p className="text-sm text-[#64748B]">No open positions yet.</p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="text-left text-[#64748B]">
                    <tr>
                      <th className="py-2">Symbol</th>
                      <th>Direction</th>
                      <th>Entry</th>
                      <th>Opened</th>
                    </tr>
                  </thead>
                  <tbody>
                    {open.map((t) => (
                      <tr key={t.id} className="border-t border-[#334155]/50">
                        <td className="py-2 font-mono text-white">{t.symbol}</td>
                        <td className="capitalize text-[#CBD5E1]">{t.direction}</td>
                        <td className="font-mono text-[#F59E0B]">{formatUsd(Number(t.entry_price))}</td>
                        <td className="text-[#64748B]">
                          {new Date(t.opened_at).toLocaleString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </Card>
        </main>
      </div>
    </div>
  );
}
