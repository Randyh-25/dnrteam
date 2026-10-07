"use client";

import { Header } from "@/components/header";
import { useStats } from "@/components/platforms/use-stats";
import { PLATFORM_META, PLATFORM_ORDER } from "@/lib/platform-meta";
import { formatCompact, formatDateTime } from "@/lib/format";
import { TrendingUp, TrendingDown, Minus } from "lucide-react";
import type { PlatformGrowth, PlatformStats } from "@/lib/types";

const IDENTIFIER: Record<string, string> = {
  youtube: "Channel",
  instagram: "Profile",
  facebook: "Profile",
  threads: "Profile",
  tiktok: "Profile",
};

function deltaClass(value: number | null): string {
  if (value === null) return "text-muted-foreground";
  return value >= 0 ? "text-emerald-500" : "text-red-500";
}

function DeltaIcon({ value }: { value: number | null }) {
  if (value === null) return <Minus className="w-3.5 h-3.5" />;
  return value >= 0 ? (
    <TrendingUp className="w-3.5 h-3.5" />
  ) : (
    <TrendingDown className="w-3.5 h-3.5" />
  );
}

function formatDelta(value: number | null, suffix = ""): string {
  if (value === null) return "—";
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toLocaleString()}${suffix}`;
}

export default function PlatformsPage() {
  const { data, loading, error, refresh } = useStats();

  const currentByKey = new Map(
    (data?.current.platforms ?? []).map((p) => [p.platform, p])
  );

  return (
    <main className="min-h-screen">
      <Header
        lastUpdated={formatDateTime(data?.current.updatedAt)}
        onRefresh={refresh}
        isRefreshing={loading}
      />

      <div className="p-4 sm:p-6 space-y-6">
        <div>
          <h2 className="text-lg font-semibold text-foreground">Platforms</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Current audience and day-over-day change for every connected
            account.
          </p>
        </div>

        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load platform data: {error}
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {loading && !data
            ? PLATFORM_ORDER.map((key) => <PlatformDetailSkeleton key={key} />)
            : PLATFORM_ORDER.map((key, i) => {
                const meta = PLATFORM_META[key];
                const stats = currentByKey.get(key);
                const growth: PlatformGrowth | undefined =
                  data?.growth?.[key];
                return (
                  <PlatformDetailCard
                    key={key}
                    platformKey={key}
                    label={meta.label}
                    color={meta.color}
                    icon={meta.icon}
                    stats={stats}
                    growth={growth}
                    delay={i + 1}
                  />
                );
              })}
        </div>
      </div>
    </main>
  );
}

function MetricRow({
  label,
  value,
  delta,
  suffix = "",
}: {
  label: string;
  value: string;
  delta: number | null;
  suffix?: string;
}) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-border/60 last:border-0">
      <span className="text-sm text-muted-foreground">{label}</span>
      <div className="flex items-center gap-3">
        <span className="text-sm font-semibold text-foreground">{value}</span>
        <span
          className={`inline-flex items-center gap-1 text-xs font-medium w-20 justify-end ${deltaClass(delta)}`}
        >
          <DeltaIcon value={delta} />
          {formatDelta(delta, suffix)}
        </span>
      </div>
    </div>
  );
}

function PlatformDetailCard({
  platformKey,
  label,
  color,
  icon: Icon,
  stats,
  growth,
  delay,
}: {
  platformKey: string;
  label: string;
  color: string;
  icon: React.ComponentType<{ className?: string; style?: React.CSSProperties }>;
  stats: PlatformStats | undefined;
  growth: PlatformGrowth | undefined;
  delay: number;
}) {
  const online = stats?.status === "online";

  return (
    <section
      className={`glass-card rounded-xl p-5 animate-fade-in stagger-${delay}`}
      id={`platform-detail-${platformKey}`}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          <div
            className="w-11 h-11 rounded-lg flex items-center justify-center"
            style={{ backgroundColor: `${color}15` }}
          >
            <Icon className="w-6 h-6" style={{ color }} />
          </div>
          <div>
            <h3 className="font-semibold text-foreground">{label}</h3>
            <p className="text-xs text-muted-foreground">
              {IDENTIFIER[platformKey]}
            </p>
          </div>
        </div>
        <span
          className={`px-2.5 py-1 rounded-full text-xs font-medium ${
            online ? "badge-online" : "badge-error"
          }`}
        >
          {online ? "● Live" : "● Error"}
        </span>
      </div>

      {!online ? (
        <p className="text-sm text-muted-foreground min-h-[120px]">
          {stats?.error ?? "No data available for this platform."}
        </p>
      ) : (
        <>
          <div className="mb-4">
            <p className="text-3xl font-bold text-foreground">
              {formatCompact(stats?.followers ?? 0)}
            </p>
            <div className="flex items-center gap-2 mt-1">
              <p className="text-xs text-muted-foreground">Followers</p>
              <span
                className={`inline-flex items-center gap-1 text-xs font-medium ${deltaClass(
                  growth?.followers ?? null
                )}`}
              >
                <DeltaIcon value={growth?.followers ?? null} />
                {formatDelta(growth?.followers ?? null)}
              </span>
            </div>
          </div>

          <div className="mb-1">
            <MetricRow
              label="Views"
              value={stats?.views != null ? formatCompact(stats.views) : "—"}
              delta={growth?.views ?? null}
            />
            <MetricRow
              label="Posts"
              value={stats?.posts != null ? formatCompact(stats.posts) : "—"}
              delta={growth?.posts ?? null}
            />
            <MetricRow
              label="Engagement"
              value={
                stats?.engagementRate != null
                  ? `${stats.engagementRate}%`
                  : "—"
              }
              delta={growth?.engagementRate ?? null}
              suffix="%"
            />
          </div>

          <p className="text-[11px] text-muted-foreground mt-3">
            Change vs. yesterday
          </p>
        </>
      )}
    </section>
  );
}

function PlatformDetailSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-center gap-3 mb-4">
        <div className="skeleton w-11 h-11 rounded-lg" />
        <div className="skeleton w-24 h-5 rounded" />
      </div>
      <div className="skeleton w-28 h-9 rounded mb-4" />
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="skeleton h-6 rounded mb-2" />
      ))}
    </div>
  );
}
