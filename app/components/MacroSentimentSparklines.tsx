"use client";

import React, { useEffect, useState } from "react";
import { LineChart, Line, ResponsiveContainer, XAxis, YAxis } from "recharts";

interface SparklineData {
  time: string;
  value: number;
}

interface MacroSentimentSparklinesProps {
  t10y2yHistory?: SparklineData[];
  vixHistory?: SparklineData[];
  sentimentHistory?: SparklineData[];
  height?: number;
}

/**
 * MacroSentimentSparklines — 24h mini-charts
 * Renders 3 sparklines in a row: T10Y2Y, VIX, Sentiment
 * Each normalized to [-1, 1] for consistency
 *
 * Desktop: 3 columns, 48px height
 * Mobile: 1 column, stacked
 */
export const MacroSentimentSparklines: React.FC<MacroSentimentSparklinesProps> = ({
  t10y2yHistory = [],
  vixHistory = [],
  sentimentHistory = [],
  height = 48,
}) => {
  const [clientMounted, setClientMounted] = useState(false);

  useEffect(() => {
    setClientMounted(true);
  }, []);

  if (!clientMounted) return null;

  const renderSparkline = (
    data: SparklineData[],
    label: string,
    color: string
  ) => {
    if (data.length === 0) {
      return (
        <div
          key={label}
          className="flex-1 flex items-center justify-center bg-[#1E293B]/30 rounded border border-[#334155]/50 p-2"
        >
          <span className="text-xs text-[#64748B]">No data</span>
        </div>
      );
    }

    return (
      <div
        key={label}
        className="flex-1 flex flex-col items-start justify-between bg-[#1E293B]/30 rounded border border-[#334155]/50 p-2"
      >
        <span className="text-xs font-semibold text-[#CBD5E1] mb-1">{label}</span>
        <ResponsiveContainer width="100%" height={height}>
          <LineChart data={data} margin={{ top: 0, right: 0, left: 0, bottom: 0 }}>
            <XAxis dataKey="time" hide={true} />
            <YAxis domain={[-1, 1]} hide={true} />
            <Line
              type="monotone"
              dataKey="value"
              stroke={color}
              dot={false}
              isAnimationActive={false}
              strokeWidth={2}
            />
          </LineChart>
        </ResponsiveContainer>
        {/* Current value */}
        {data.length > 0 && (
          <span className="text-xs font-mono text-[#F59E0B] mt-1">
            {(data[data.length - 1].value * 100).toFixed(0)}%
          </span>
        )}
      </div>
    );
  };

  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-2">
      {renderSparkline(t10y2yHistory, "T10Y2Y ▔▁▁", "#3B82F6")}
      {renderSparkline(vixHistory, "VIX ▂▃▄", "#EF4444")}
      {renderSparkline(sentimentHistory, "Sentiment ▅▆", "#10B981")}
    </div>
  );
};
