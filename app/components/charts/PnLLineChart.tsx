"use client";

import { useEffect, useRef } from "react";

export interface PnLDatum {
  date: string;
  pnl: number;
}

export function PnLLineChart({ data }: { data: PnLDatum[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    let chart: { destroy(): void; redraw(): void } | null = null;
    let handleResize: (() => void) | null = null;
    let cancelled = false;

    const parsed = data.map((d) => ({ date: new Date(d.date), pnl: d.pnl }));
    const positive = parsed.map((d) => ({ date: d.date, pnl: d.pnl >= 0 ? d.pnl : 0 }));
    const negative = parsed.map((d) => ({ date: d.date, pnl: d.pnl < 0 ? d.pnl : 0 }));

    import("plottable").then((P) => {
      if (cancelled || !containerRef.current) return;

      const xScale = new P.Scales.Time();
      const yScale = new P.Scales.Linear();
      const xAxis = new P.Axes.Time(xScale, "bottom");
      const yAxis = new P.Axes.Numeric(yScale, "left");

      const positiveLine = new P.Plots.Line<Date>()
        .addDataset(new P.Dataset(positive))
        .x((d: { date: Date; pnl: number }) => d.date, xScale)
        .y((d: { date: Date; pnl: number }) => d.pnl, yScale)
        .attr("stroke", "#3ee0a1");

      const negativeLine = new P.Plots.Line<Date>()
        .addDataset(new P.Dataset(negative))
        .x((d: { date: Date; pnl: number }) => d.date, xScale)
        .y((d: { date: Date; pnl: number }) => d.pnl, yScale)
        .attr("stroke", "#ff6b6b");

      const plotGroup = new P.Components.Group([positiveLine, negativeLine]);

      chart = new P.Components.Table([
        [yAxis, plotGroup],
        [null, xAxis],
      ]);

      chart.renderTo(containerRef.current);

      handleResize = () => chart?.redraw();
      window.addEventListener("resize", handleResize);
    });

    return () => {
      cancelled = true;
      if (handleResize) window.removeEventListener("resize", handleResize);
      chart?.destroy();
    };
  }, [data]);

  if (data.length === 0) {
    return (
      <div className="w-full h-[250px] flex items-center justify-center text-sm text-[var(--muted)]">
        No P&amp;L data yet.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height: 250 }} />;
}
