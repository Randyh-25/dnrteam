"use client";

import {
  ResponsiveContainer,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
} from "recharts";
import type { HistoryPoint } from "@/lib/types";

interface GrowthChartProps {
  data: HistoryPoint[];
}

const platformConfig = [
  { key: "youtube", name: "YouTube", color: "#FF0000" },
  { key: "instagram", name: "Instagram", color: "#E4405F" },
  { key: "facebook", name: "Facebook", color: "#1877F2" },
  { key: "threads", name: "Threads", color: "#999999" },
  { key: "tiktok", name: "TikTok", color: "#00F2EA" },
];

function CustomTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ name: string; value: number; color: string }>; label?: string }) {
  if (!active || !payload) return null;

  return (
    <div className="glass-card rounded-lg p-3 shadow-xl border border-border !bg-card">
      <p className="text-sm font-medium text-foreground mb-2">{label}</p>
      <div className="space-y-1">
        {payload.map((entry) => (
          <div key={entry.name} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-muted-foreground">{entry.name}:</span>
            <span className="font-medium text-foreground">{entry.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function GrowthChart({ data }: GrowthChartProps) {
  const hasData = data.length > 0;

  return (
    <div
      className="glass-card rounded-xl p-5 opacity-0 animate-fade-in"
      style={{ animationDelay: "0.3s" }}
      id="growth-chart"
    >
      <div className="flex items-center justify-between mb-6">
        <div>
          <h3 className="text-lg font-semibold text-foreground">Audience Growth</h3>
          <p className="text-sm text-muted-foreground mt-0.5">Combined follower timeline across platforms</p>
        </div>
      </div>
      {!hasData ? (
        <div className="h-[320px] flex flex-col items-center justify-center text-center gap-2">
          <p className="text-sm font-medium text-foreground">No historical data yet</p>
          <p className="text-xs text-muted-foreground max-w-sm">
            Daily snapshots are stored in Firestore each time data is fetched.
            The growth chart will populate as snapshots accumulate.
          </p>
        </div>
      ) : (
        <div className="h-[320px]">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={data} margin={{ top: 5, right: 10, left: 0, bottom: 5 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.5} />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={{ stroke: "var(--border)" }}
              />
              <YAxis
                tick={{ fontSize: 12, fill: "var(--muted-foreground)" }}
                tickLine={false}
                axisLine={false}
                tickFormatter={(v: number) =>
                  v >= 1000000 ? `${(v / 1000000).toFixed(1)}M` : v >= 1000 ? `${(v / 1000).toFixed(0)}K` : String(v)
                }
              />
              <Tooltip content={<CustomTooltip />} />
              <Legend
                wrapperStyle={{ fontSize: "12px", paddingTop: "12px" }}
              />
              {platformConfig.map((p) => (
                <Line
                  key={p.key}
                  type="monotone"
                  dataKey={p.key}
                  name={p.name}
                  stroke={p.color}
                  strokeWidth={2}
                  dot={false}
                  connectNulls
                  activeDot={{ r: 4, strokeWidth: 2 }}
                />
              ))}
            </LineChart>
          </ResponsiveContainer>
        </div>
      )}
    </div>
  );
}

/* Skeleton version */
export function GrowthChartSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center justify-between mb-6">
        <div>
          <div className="skeleton w-40 h-6 rounded mb-1.5" />
          <div className="skeleton w-64 h-4 rounded" />
        </div>
      </div>
      <div className="skeleton w-full h-[320px] rounded-lg" />
    </div>
  );
}
