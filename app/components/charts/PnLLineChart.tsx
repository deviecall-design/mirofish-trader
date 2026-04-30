"use client";

import { useEffect, useRef } from "react";
import * as Plottable from "plottable";
import "plottable/plottable.css";

export interface PnLDatum {
  date: string;
  pnl: number;
}

export function PnLLineChart({ data }: { data: PnLDatum[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const parsed = data.map((d) => ({
      date: new Date(d.date),
      pnl: d.pnl,
    }));

    const positive = parsed.map((d) => ({
      date: d.date,
      pnl: d.pnl >= 0 ? d.pnl : 0,
    }));
    const negative = parsed.map((d) => ({
      date: d.date,
      pnl: d.pnl < 0 ? d.pnl : 0,
    }));

    const xScale = new Plottable.Scales.Time();
    const yScale = new Plottable.Scales.Linear();

    const xAxis = new Plottable.Axes.Time(xScale, "bottom");
    const yAxis = new Plottable.Axes.Numeric(yScale, "left");

    const positiveLine = new Plottable.Plots.Line<Date>()
      .addDataset(new Plottable.Dataset(positive))
      .x((d: { date: Date; pnl: number }) => d.date, xScale)
      .y((d: { date: Date; pnl: number }) => d.pnl, yScale)
      .attr("stroke", "#3ee0a1");

    const negativeLine = new Plottable.Plots.Line<Date>()
      .addDataset(new Plottable.Dataset(negative))
      .x((d: { date: Date; pnl: number }) => d.date, xScale)
      .y((d: { date: Date; pnl: number }) => d.pnl, yScale)
      .attr("stroke", "#ff6b6b");

    const plotGroup = new Plottable.Components.Group([positiveLine, negativeLine]);

    const chart = new Plottable.Components.Table([
      [yAxis, plotGroup],
      [null, xAxis],
    ]);

    chart.renderTo(containerRef.current);

    const handleResize = () => chart.redraw();
    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      chart.destroy();
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
