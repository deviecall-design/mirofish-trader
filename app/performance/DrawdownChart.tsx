"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";

interface Point {
  t: string;
  cum: number;
  drawdown: number;
}

export function DrawdownChart({ data }: { data: Point[] }) {
  const formatted = data.map((p) => ({
    ...p,
    label: new Date(p.t).toLocaleDateString(),
  }));
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={formatted}>
          <defs>
            <linearGradient id="cum" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3ee0a1" stopOpacity={0.6} />
              <stop offset="100%" stopColor="#3ee0a1" stopOpacity={0} />
            </linearGradient>
            <linearGradient id="dd" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#ff6b6b" stopOpacity={0.5} />
              <stop offset="100%" stopColor="#ff6b6b" stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid stroke="#26262c" strokeDasharray="3 3" />
          <XAxis dataKey="label" stroke="#8a8a93" fontSize={11} />
          <YAxis stroke="#8a8a93" fontSize={11} unit="%" />
          <Tooltip
            contentStyle={{
              background: "#111114",
              border: "1px solid #26262c",
              borderRadius: 6,
              color: "#ededed",
            }}
            formatter={(v) => `${Number(v).toFixed(2)}%`}
          />
          <Area
            type="monotone"
            dataKey="cum"
            name="Cumulative P&L"
            stroke="#3ee0a1"
            fill="url(#cum)"
          />
          <Area
            type="monotone"
            dataKey="drawdown"
            name="Drawdown"
            stroke="#ff6b6b"
            fill="url(#dd)"
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
