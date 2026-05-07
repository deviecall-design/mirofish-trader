"use client";

import { useEffect, useRef } from "react";

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

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let handleResize: (() => void) | null = null;
    let cancelled = false;

    import("plottable").then((P) => {
      if (cancelled || !containerRef.current) return;

      const xScale = new P.Scales.Category();
      const yScale = new P.Scales.Linear().domain([0, 100]);
      const xAxis = new P.Axes.Category(xScale, "bottom");
      const yAxis = new P.Axes.Numeric(yScale, "left");

      const plot = new P.Plots.Bar<string, number>()
        .addDataset(new P.Dataset(data))
        .x((d: ConvictionBarDatum) => d.symbol, xScale)
        .y((d: ConvictionBarDatum) => d.conviction, yScale)
        .attr("fill", (d: ConvictionBarDatum) => colorFor(d.direction));

      chart = new P.Components.Table([
        [yAxis, plot],
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
        No signal data yet.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height: 250 }} />;
}
