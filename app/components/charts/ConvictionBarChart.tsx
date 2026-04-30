"use client";

import { useEffect, useRef } from "react";
import * as Plottable from "plottable";
import "plottable/plottable.css";

export interface ConvictionBarDatum {
  symbol: string;
  conviction: number;
  direction: string;
}

const COLORS = {
  bullish: "#3ee0a1",
  bearish: "#ff6b6b",
  neutral: "#f1c40f",
} as const;

function colorFor(direction: string): string {
  if (direction === "bullish") return COLORS.bullish;
  if (direction === "bearish") return COLORS.bearish;
  return COLORS.neutral;
}

export function ConvictionBarChart({ data }: { data: ConvictionBarDatum[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    const xScale = new Plottable.Scales.Category();
    const yScale = new Plottable.Scales.Linear().domain([0, 100]);

    const xAxis = new Plottable.Axes.Category(xScale, "bottom");
    const yAxis = new Plottable.Axes.Numeric(yScale, "left");

    const plot = new Plottable.Plots.Bar<string, number>()
      .addDataset(new Plottable.Dataset(data))
      .x((d: ConvictionBarDatum) => d.symbol, xScale)
      .y((d: ConvictionBarDatum) => d.conviction, yScale)
      .attr("fill", (d: ConvictionBarDatum) => colorFor(d.direction));

    const chart = new Plottable.Components.Table([
      [yAxis, plot],
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
      <div className="w-full h-[200px] flex items-center justify-center text-sm text-[var(--muted)]">
        No conviction data yet.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height: 200 }} />;
}
