"use client";

import { useState } from "react";
import { TrendingUp } from "lucide-react";
import { Header } from "@/components/header";
import {
  PlatformAnalyticsCard,
  PlatformAnalyticsSkeleton,
} from "@/components/analytics/platform-analytics-card";
import { usePlatformAnalytics } from "@/components/analytics/use-platform-analytics";
import { PLATFORM_META } from "@/lib/platform-meta";

const RANGES = [
  { days: 7, label: "7D" },
  { days: 30, label: "30D" },
  { days: 90, label: "90D" },
];

export default function AnalyticsPage() {
  const [days, setDays] = useState(30);
  const { data, loading, error, reload } = usePlatformAnalytics(days);

  const byPlatform = new Map(data.map((a) => [a.platform, a]));

  return (
    <main className="min-h-screen">
      <Header onRefresh={reload} isRefreshing={loading} />

      <div className="p-4 sm:p-6 space-y-6">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-lg font-semibold text-foreground">
              Per-Platform Analytics
            </h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Follower, views, post, and engagement trends from daily snapshots.
            </p>
          </div>

          {/* Range selector */}
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {RANGES.map((range) => (
              <button
                key={range.days}
                onClick={() => setDays(range.days)}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  days === range.days
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
                aria-pressed={days === range.days}
              >
                {range.label}
              </button>
            ))}
          </div>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load analytics: {error}
          </div>
        )}

        {loading && data.length === 0 ? (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {Array.from({ length: 4 }).map((_, i) => (
              <PlatformAnalyticsSkeleton key={i} />
            ))}
          </div>
        ) : data.length === 0 ? (
          <div className="glass-card rounded-xl p-10 flex flex-col items-center text-center gap-3">
            <div className="w-12 h-12 rounded-lg bg-primary/10 flex items-center justify-center">
              <TrendingUp className="w-6 h-6 text-primary" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">
              No snapshot history yet
            </h3>
            <p className="text-sm text-muted-foreground max-w-md">
              Per-platform analytics build up from the daily Firestore
              snapshots. Open the Overview and refresh to start recording data.
            </p>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
            {data.map((analytics) => {
              const meta = PLATFORM_META[analytics.platform];
              if (!meta) return null;
              return (
                <PlatformAnalyticsCard
                  key={analytics.platform}
                  meta={meta}
                  analytics={analytics}
                />
              );
            })}
          </div>
        )}

        {/* Platforms present in metadata but missing from the payload are shown
            as empty states for completeness. */}
        {!loading &&
          data.length > 0 &&
          Object.values(PLATFORM_META)
            .filter((meta) => !byPlatform.has(meta.key))
            .map((meta) => (
              <div
                key={meta.key}
                className="glass-card rounded-xl p-5 text-sm text-muted-foreground"
              >
                {meta.label}: awaiting first snapshot.
              </div>
            ))}
      </div>
    </main>
  );
}
