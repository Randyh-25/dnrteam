"use client";

import {
  ResponsiveContainer,
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
} from "recharts";
import type { PlatformAnalytics } from "@/lib/types";
import { formatCompact } from "@/lib/format";

interface PlatformTrendChartProps {
  analytics: PlatformAnalytics;
  color: string;
  metric: "followers" | "views" | "posts" | "engagementRate";
}

const METRIC_LABEL: Record<PlatformTrendChartProps["metric"], string> = {
  followers: "Followers",
  views: "Views",
  posts: "Posts",
  engagementRate: "Engagement Rate",
};

function TrendTooltip({
  active,
  payload,
  label,
  metric,
  color,
}: {
  active?: boolean;
  payload?: Array<{ value: number }>;
  label?: string;
  metric: string;
  color: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="glass-card rounded-lg p-3 shadow-xl border border-border !bg-card">
      <p className="text-xs text-muted-foreground mb-1">{label}</p>
      <p className="text-sm font-medium" style={{ color }}>
        {metric}: {payload[0].value?.toLocaleString() ?? "—"}
      </p>
    </div>
  );
}

/** Single-metric area timeline for one platform. */
export function PlatformTrendChart({
  analytics,
  color,
  metric,
}: PlatformTrendChartProps) {
  const data = analytics.series
    .filter((point) => point[metric] !== null)
    .map((point) => ({ date: point.date, value: point[metric] as number }));

  if (data.length < 2) {
    return (
      <div className="h-[200px] flex items-center justify-center text-center">
        <p className="text-xs text-muted-foreground max-w-xs">
          Not enough history for the {METRIC_LABEL[metric].toLowerCase()} trend
          yet. Snapshots accumulate daily.
        </p>
      </div>
    );
  }

  return (
    <div className="h-[200px]">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 5, right: 8, left: 0, bottom: 0 }}>
          <defs>
            <linearGradient id={`grad-${analytics.platform}-${metric}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={color} stopOpacity={0.35} />
              <stop offset="95%" stopColor={color} stopOpacity={0} />
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" opacity={0.4} />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={{ stroke: "var(--border)" }}
          />
          <YAxis
            tick={{ fontSize: 11, fill: "var(--muted-foreground)" }}
            tickLine={false}
            axisLine={false}
            width={44}
            tickFormatter={(v: number) => formatCompact(v)}
          />
          <Tooltip
            content={
              <TrendTooltip metric={METRIC_LABEL[metric]} color={color} />
            }
          />
          <Area
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            fill={`url(#grad-${analytics.platform}-${metric})`}
            connectNulls
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
