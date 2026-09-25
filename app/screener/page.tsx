"use client";
import { useEffect, useState, useCallback } from "react";
import dynamic from "next/dynamic";
import Link from "next/link";
import { ResponsiveContainer, LineChart, Line } from "recharts";
import { formatMarketCap, formatMoney, PRICE_UNAVAILABLE } from "@/app/lib/currency";

const StockChart = dynamic(() => import("@/app/components/StockChart"), { ssr: false });

interface Stock {
  symbol: string; name: string; price: number | null; currency: string;
  changePercent: number | null; marketCapB: number | null; sparkline: number[];
}
interface Sector { id: string; label: string; }
interface ChartData { candles: object[]; sma: object[]; }
interface SwarmResult { direction: string; conviction: number; archetypes: Record<string, number>; reply?: string; }

function Sparkline({ data, pos }: { data: number[]; pos: boolean }) {
  if (!data.length) return <div className="w-16 h-8 bg-white/5 rounded" />;
  return (
    <ResponsiveContainer width={64} height={32}>
      <LineChart data={data.map((v, i) => ({ i, v }))}>
        <Line type="monotone" dataKey="v" stroke={pos ? "#22c55e" : "#ef4444"} strokeWidth={1.5} dot={false} isAnimationActive={false} />
      </LineChart>
    </ResponsiveContainer>
  );
}

function priceLabel(stock: { price: number | null; currency?: string }) {
  if (stock.price == null) return PRICE_UNAVAILABLE;
  return formatMoney(stock.price, stock.currency || "USD");
}

export default function ScreenerPage() {
  const [sectors, setSectors] = useState<Sector[]>([]);
  const [active, setActive] = useState("watchlist");
  const [sort, setSort] = useState("change_pct");
  const [stocks, setStocks] = useState<Stock[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<Stock | null>(null);
  const [chart, setChart] = useState<ChartData | null>(null);
  const [chartLoading, setChartLoading] = useState(false);
  const [swarm, setSwarm] = useState<SwarmResult | null>(null);
  const [swarmLoading, setSwarmLoading] = useState(false);

  useEffect(() => {
    fetch("/api/screener?sector=__sectors").then(r => r.json()).then(d => setSectors(d.sectors ?? []));
  }, []);

  const load = useCallback((sector: string, s: string) => {
    setLoading(true);
    fetch(`/api/screener?sector=${sector}&sort=${s}`).then(r => r.json()).then(d => { setStocks(d.stocks ?? []); setLoading(false); });
  }, []);

  useEffect(() => { load(active, sort); const t = setInterval(() => load(active, sort), 30000); return () => clearInterval(t); }, [active, sort, load]);

  const openDetail = async (stock: Stock) => {
    setSelected(stock); setChart(null); setSwarm(null);
    setChartLoading(true);
    const r = await fetch(`/api/chart?symbol=${stock.symbol}&bars=90`);
    if (r.ok) setChart(await r.json());
    setChartLoading(false);
  };

  const runSwarm = async (symbol: string) => {
    setSwarmLoading(true); setSwarm(null);
    const r = await fetch("/api/jarvis", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ messages: [{ role: "user", content: `Run a swarm simulation on ${symbol} and give me the direction, conviction score, and archetype breakdown.` }] }),
    });
    if (r.ok) { const d = await r.json(); setSwarm({ direction: "—", conviction: 0, archetypes: {}, ...d }); }
    setSwarmLoading(false);
  };

  return (
    <div className="min-h-screen bg-[#0a0d14] text-white font-mono">
      {/* Nav */}
      <nav className="border-b border-white/10 px-6 py-3 flex items-center gap-6 sticky top-0 bg-[#0a0d14] z-10">
        <Link href="/" className="text-[#f0b429] font-bold text-sm tracking-wider">⚡ MIROFISH</Link>
        <span className="text-white/30 text-xs">/ SCREENER</span>
        <div className="ml-auto flex gap-2">
          {[["change_pct","24h %"],["market_cap","Mkt Cap"],["price","Price"]].map(([v,l]) => (
            <button key={v} onClick={() => setSort(v)} className={`text-xs px-3 py-1 rounded border ${sort===v?"border-[#f0b429] text-[#f0b429]":"border-white/20 text-white/40 hover:border-white/40"}`}>{l}</button>
          ))}
        </div>
      </nav>

      {/* Sector pills */}
      <div className="px-6 py-3 flex gap-2 flex-wrap border-b border-white/5 bg-[#0a0d14]">
        {sectors.map(s => (
          <button key={s.id} onClick={() => setActive(s.id)}
            className={`text-xs px-3 py-1.5 rounded-full border transition-all ${active===s.id?"bg-[#f0b429]/10 border-[#f0b429] text-[#f0b429]":"border-white/15 text-white/40 hover:text-white/70 hover:border-white/30"}`}>
            {s.label}
          </button>
        ))}
      </div>

      <div className="flex h-[calc(100vh-120px)]">
        {/* Table */}
        <div className={`overflow-y-auto ${selected ? "w-1/2 border-r border-white/10" : "w-full"}`}>
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-[#0a0d14] border-b border-white/5">
              <tr className="text-white/30 text-xs">
                <th className="text-left px-6 py-3 font-normal">Symbol</th>
                <th className="text-left py-3 font-normal hidden md:table-cell">Name</th>
                <th className="text-right py-3 font-normal">Price</th>
                <th className="text-right py-3 font-normal">24h %</th>
                <th className="text-right py-3 font-normal hidden lg:table-cell">Mkt Cap</th>
                <th className="text-center py-3 font-normal">7D</th>
                <th className="py-3" />
              </tr>
            </thead>
            <tbody>
              {loading ? Array.from({length:8}).map((_,i) => (
                <tr key={i} className="border-b border-white/5 animate-pulse">
                  <td colSpan={7} className="px-6 py-4"><div className="h-4 bg-white/5 rounded" /></td>
                </tr>
              )) : stocks.map(s => {
                const pos = (s.changePercent ?? 0) >= 0;
                const isSel = selected?.symbol === s.symbol;
                return (
                  <tr key={s.symbol} onClick={() => openDetail(s)}
                    className={`border-b border-white/5 cursor-pointer transition-colors ${isSel?"bg-[#f0b429]/5 border-l-2 border-l-[#f0b429]":"hover:bg-white/3"}`}>
                    <td className="px-6 py-3 font-bold text-white">{s.symbol}</td>
                    <td className="py-3 text-white/40 hidden md:table-cell text-xs">{s.name}</td>
                    <td className={`py-3 text-right ${s.price == null ? "text-white/40 text-xs" : "text-white"}`}>{priceLabel(s)}</td>
                    <td className={`py-3 text-right font-bold ${s.changePercent == null ? "text-white/30" : pos ? "text-green-400" : "text-red-400"}`}>
                      {s.changePercent != null ? `${pos?"+":""}${s.changePercent.toFixed(2)}%` : "—"}
                    </td>
                    <td className="py-3 text-right text-white/40 text-xs hidden lg:table-cell">{formatMarketCap(s.marketCapB, s.currency || "USD")}</td>
                    <td className="py-3 flex justify-center"><Sparkline data={s.sparkline} pos={pos} /></td>
                    <td className="py-3 pr-4 text-center">
                      <button onClick={e=>{e.stopPropagation();openDetail(s);}} className="text-xs px-2 py-1 border border-white/20 text-white/40 rounded hover:border-[#f0b429]/50 hover:text-[#f0b429]">Chart</button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>

        {/* Detail panel */}
        {selected && (
          <div className="w-1/2 overflow-y-auto px-6 py-4">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-white font-bold text-lg">{selected.symbol}</h2>
                <p className="text-white/40 text-xs">{selected.name}</p>
              </div>
              <button onClick={()=>{setSelected(null);setChart(null);setSwarm(null);}} className="text-white/30 hover:text-white text-xl">✕</button>
            </div>

            {/* Price header */}
            <div className="flex items-end gap-3 mb-4">
              <span className={`text-3xl font-bold ${selected.price == null ? "text-white/40 text-lg" : "text-white"}`}>{priceLabel(selected)}</span>
              <span className={`text-sm font-bold mb-1 ${(selected.changePercent??0)>=0?"text-green-400":"text-red-400"}`}>
                {selected.changePercent != null ? `${(selected.changePercent>=0)?"+":""}${selected.changePercent.toFixed(2)}%` : ""}
              </span>
            </div>

            {/* Chart */}
            <div className="border border-white/10 rounded-lg overflow-hidden mb-4 bg-[#0a0d14]">
              {chartLoading ? (
                <div className="h-[340px] flex items-center justify-center text-white/20 text-sm">Loading chart…</div>
              ) : chart ? (
                <StockChart symbol={selected.symbol} candles={chart.candles as never} sma={chart.sma as never} />
              ) : (
                <div className="h-[340px] flex items-center justify-center text-white/20 text-sm">No chart data</div>
              )}
            </div>

            {/* Swarm */}
            <div className="border border-white/10 rounded-lg p-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-xs text-white/50 uppercase tracking-wider">MiroFish Swarm Prediction</span>
                <button onClick={()=>runSwarm(selected.symbol)}
                  disabled={swarmLoading}
                  className="text-xs px-3 py-1.5 bg-[#f0b429]/10 border border-[#f0b429]/40 text-[#f0b429] rounded hover:bg-[#f0b429]/20 disabled:opacity-40">
                  {swarmLoading ? "Running…" : "⚡ Run Swarm"}
                </button>
              </div>
              {swarm ? (
                <div className="text-sm text-white/70 whitespace-pre-wrap leading-relaxed">
                  {typeof swarm.reply === "string" ? swarm.reply : JSON.stringify(swarm, null, 2)}
                </div>
              ) : (
                <p className="text-white/20 text-xs">Click Run Swarm to simulate 1000 agents on {selected.symbol}</p>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
