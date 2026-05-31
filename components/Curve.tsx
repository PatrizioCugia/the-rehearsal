"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { Take } from "@/lib/session";
import { totalHesitationSeconds } from "@/lib/session";

export default function Curve({ takes }: { takes: Take[] }) {
  if (takes.length < 2) return null;

  const data = takes.map((t) => ({
    take: t.takeNumber,
    cqi:
      typeof t.cqiOverall === "number"
        ? Math.round(t.cqiOverall * 10) / 10
        : null,
    hesitation: Math.round(totalHesitationSeconds(t) * 10) / 10,
  }));

  return (
    <div className="rounded-lg border border-neutral-800 bg-neutral-950 p-5">
      <div className="flex items-baseline justify-between mb-3">
        <p className="text-xs uppercase tracking-widest text-neutral-500">
          Improvement curve
        </p>
        <div className="flex items-center gap-4 text-[11px] text-neutral-500 font-mono">
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-neutral-200" /> CQI
          </span>
          <span className="flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 bg-amber-400/70" /> Hesitation (s)
          </span>
        </div>
      </div>
      <div className="h-56">
        <ResponsiveContainer width="100%" height="100%">
          <LineChart data={data} margin={{ top: 10, right: 16, left: 0, bottom: 8 }}>
            <CartesianGrid strokeDasharray="2 4" stroke="#262626" />
            <XAxis
              dataKey="take"
              stroke="#525252"
              tick={{ fill: "#a3a3a3", fontFamily: "ui-monospace, monospace", fontSize: 11 }}
              tickLine={false}
              label={{
                value: "take",
                position: "insideBottom",
                offset: -2,
                fill: "#525252",
                style: { fontFamily: "ui-monospace, monospace", fontSize: 11 },
              }}
            />
            <YAxis
              yAxisId="left"
              domain={[0, 100]}
              stroke="#525252"
              tick={{ fill: "#a3a3a3", fontFamily: "ui-monospace, monospace", fontSize: 11 }}
              tickLine={false}
              width={36}
            />
            <YAxis
              yAxisId="right"
              orientation="right"
              stroke="#525252"
              tick={{ fill: "#a3a3a3", fontFamily: "ui-monospace, monospace", fontSize: 11 }}
              tickLine={false}
              width={36}
            />
            <Tooltip
              contentStyle={{
                background: "#0a0a0a",
                border: "1px solid #262626",
                fontFamily: "ui-monospace, monospace",
                fontSize: 11,
              }}
              labelStyle={{ color: "#a3a3a3" }}
              itemStyle={{ color: "#e5e5e5" }}
            />
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cqi"
              stroke="#e5e5e5"
              strokeWidth={1.5}
              dot={{ r: 3, fill: "#e5e5e5" }}
              activeDot={{ r: 4 }}
              connectNulls
              isAnimationActive={false}
            />
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="hesitation"
              stroke="rgba(251, 191, 36, 0.7)"
              strokeWidth={1.5}
              dot={{ r: 3, fill: "rgba(251, 191, 36, 0.7)" }}
              activeDot={{ r: 4 }}
              isAnimationActive={false}
            />
          </LineChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}
