"use client";

import { useEffect, useRef } from "react";

export interface SignalTimelineDatum {
  created_at: string;
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

interface ParsedDatum {
  date: Date;
  symbol: string;
  conviction: number;
  direction: string;
}

export function SignalConvictionTimeline({ data }: { data: SignalTimelineDatum[] }) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    if (!containerRef.current || data.length === 0) return;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let chart: any = null;
    let handleResize: (() => void) | null = null;
    let cancelled = false;

    const parsed: ParsedDatum[] = data.map((d) => ({
      date: new Date(d.created_at),
      symbol: d.symbol,
      conviction: d.conviction,
      direction: d.direction,
    }));

    import("plottable").then((P) => {
      if (cancelled || !containerRef.current) return;

      const xScale = new P.Scales.Time();
      const yScale = new P.Scales.Linear().domain([0, 100]);
      const xAxis = new P.Axes.Time(xScale, "bottom");
      const yAxis = new P.Axes.Numeric(yScale, "left");

      const plot = new P.Plots.Scatter<Date, number>()
        .addDataset(new P.Dataset(parsed))
        .x((d: ParsedDatum) => d.date, xScale)
        .y((d: ParsedDatum) => d.conviction, yScale)
        .attr("fill", (d: ParsedDatum) => colorFor(d.direction))
        .attr("opacity", 0.75)
        .size((d: ParsedDatum) => 4 + (d.conviction / 100) * 16);

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
      <div className="w-full h-[220px] flex items-center justify-center text-sm text-[var(--muted)]">
        No signal timeline data yet.
      </div>
    );
  }

  return <div ref={containerRef} className="w-full" style={{ height: 220 }} />;
}
