"use client";

import { useState } from "react";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PlatformAnalytics } from "@/lib/types";
import type { PlatformMeta } from "@/lib/platform-meta";
import { formatCompact } from "@/lib/format";
import { PlatformTrendChart } from "@/components/analytics/platform-trend-chart";

interface PlatformAnalyticsCardProps {
  meta: PlatformMeta;
  analytics: PlatformAnalytics;
}

type MetricKey = "followers" | "views" | "posts" | "engagementRate";

const METRICS: Array<{ key: MetricKey; label: string }> = [
  { key: "followers", label: "Followers" },
  { key: "views", label: "Views" },
  { key: "posts", label: "Posts" },
  { key: "engagementRate", label: "Engagement" },
];

function Delta({ value }: { value: number | null }) {
  if (value === null) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-muted-foreground">
        <Minus className="w-3 h-3" /> no baseline
      </span>
    );
  }
  const positive = value >= 0;
  const Icon = positive ? TrendingUp : TrendingDown;
  return (
    <span
      className={`inline-flex items-center gap-1 text-xs font-medium ${
        positive ? "text-emerald-500" : "text-red-500"
      }`}
    >
      <Icon className="w-3 h-3" />
      {positive ? "+" : ""}
      {value.toLocaleString()}
    </span>
  );
}

export function PlatformAnalyticsCard({
  meta,
  analytics,
}: PlatformAnalyticsCardProps) {
  const [metric, setMetric] = useState<MetricKey>("followers");
  const Icon = meta.icon;
  const { latest, change } = analytics;

  const metricValue = (key: MetricKey): string => {
    const value = latest[key];
    if (value === null) return "—";
    if (key === "engagementRate") return `${value}%`;
    return formatCompact(value);
  };

  const rangePct = analytics.followersChangePct;

  return (
    <section
      className="glass-card rounded-xl p-5 animate-fade-in"
      id={`analytics-${meta.key}`}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-10 h-10 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${meta.color}15` }}
          >
            <Icon className="w-5 h-5" style={{ color: meta.color }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{meta.label}</h3>
            <p className="text-xs text-muted-foreground">
              {analytics.series.length} day
              {analytics.series.length === 1 ? "" : "s"} of history
            </p>
          </div>
        </div>
        {rangePct !== null && (
          <span
            className={`text-sm font-medium ${
              rangePct >= 0 ? "text-emerald-500" : "text-red-500"
            }`}
          >
            {rangePct >= 0 ? "+" : ""}
            {rangePct}%
          </span>
        )}
      </div>

      {/* Metric tiles */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => setMetric(m.key)}
            className={`text-left rounded-lg p-2.5 border transition-colors ${
              metric === m.key
                ? "border-primary/50 bg-primary/5"
                : "border-border hover:bg-accent/50"
            }`}
            aria-pressed={metric === m.key}
          >
            <p className="text-[11px] text-muted-foreground">{m.label}</p>
            <p className="text-lg font-bold text-foreground">
              {metricValue(m.key)}
            </p>
            <Delta value={change[m.key]} />
          </button>
        ))}
      </div>

      {/* Trend chart */}
      <PlatformTrendChart
        analytics={analytics}
        color={meta.color}
        metric={metric}
      />
    </section>
  );
}

export function PlatformAnalyticsSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton w-10 h-10 rounded-lg" />
        <div className="skeleton w-28 h-5 rounded" />
      </div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="skeleton h-16 rounded-lg" />
        ))}
      </div>
      <div className="skeleton w-full h-[200px] rounded-lg" />
    </div>
  );
}
