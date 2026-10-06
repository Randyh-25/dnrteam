"use client";

import { Header } from "@/components/header";
import { KPICard } from "@/components/dashboard/kpi-card";
import {
  PlatformCard,
  PlatformCardSkeleton,
} from "@/components/dashboard/platform-card";
import {
  GrowthChart,
  GrowthChartSkeleton,
} from "@/components/dashboard/growth-chart";
import { useDashboard } from "@/components/dashboard/use-dashboard";
import { formatCompact, formatDateTime } from "@/lib/format";
import type { PlatformKey, PlatformStats } from "@/lib/types";
import {
  YoutubeIcon,
  InstagramIcon,
  FacebookIcon,
  ThreadsIcon,
  TikTokIcon,
  type BrandIconProps,
} from "@/components/dashboard/brand-icons";
import { type ComponentType } from "react";

const PLATFORM_META: Record<
  PlatformKey,
  { label: string; icon: ComponentType<BrandIconProps>; color: string }
> = {
  youtube: { label: "YouTube", icon: YoutubeIcon, color: "#FF0000" },
  instagram: { label: "Instagram", icon: InstagramIcon, color: "#E4405F" },
  facebook: { label: "Facebook", icon: FacebookIcon, color: "#1877F2" },
  threads: { label: "Threads", icon: ThreadsIcon, color: "#999999" },
  tiktok: { label: "TikTok", icon: TikTokIcon, color: "#00F2EA" },
};

const PLATFORM_ORDER: PlatformKey[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

function growthFor(stats: PlatformStats): { value: number; label: string } {
  if (typeof stats.change24h === "number") {
    return { value: stats.change24h, label: "24h growth" };
  }
  if (typeof stats.change7d === "number") {
    return { value: stats.change7d, label: "7d growth" };
  }
  return { value: 0, label: "no baseline yet" };
}

export default function DashboardPage() {
  const {
    platforms,
    totals,
    history,
    lastUpdated,
    loading,
    refreshing,
    error,
    refresh,
  } = useDashboard();

  const statsByKey = new Map(platforms.map((p) => [p.platform, p]));

  const kpis = totals
    ? [
        {
          title: "Total Audience",
          value: formatCompact(totals.followers),
          change: totals.change7d,
          changeLabel: "7d growth",
          icon: "users" as const,
        },
        {
          title: "Total Views",
          value: formatCompact(totals.views),
          change: totals.change24h,
          changeLabel: "24h growth",
          icon: "eye" as const,
        },
        {
          title: "Engagement Rate",
          value: `${totals.engagementRate}%`,
          changeLabel: "across platforms",
          icon: "heart" as const,
        },
        {
          title: "24h Growth",
          value: `${totals.change24h >= 0 ? "+" : ""}${totals.change24h}%`,
          change: totals.change24h,
          changeLabel: `${totals.onlinePlatforms}/${totals.totalPlatforms} online`,
          icon: "chart" as const,
        },
      ]
    : [];

  return (
    <main className="min-h-screen">
      <Header
        lastUpdated={formatDateTime(lastUpdated)}
        onRefresh={refresh}
        isRefreshing={refreshing}
      />

      <div className="p-4 sm:p-6 space-y-6">
        {error && (
          <div className="rounded-lg border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
            Failed to load dashboard data: {error}
          </div>
        )}

        {/* KPI Summary Cards */}
        <section id="kpi-section">
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
            {loading
              ? Array.from({ length: 4 }).map((_, i) => (
                  <KPICardSkeleton key={i} />
                ))
              : kpis.map((kpi, i) => (
                  <KPICard key={kpi.title} {...kpi} delay={i + 1} />
                ))}
          </div>
        </section>

        {/* Platform Cards */}
        <section id="platforms-section">
          <h2 className="text-lg font-semibold text-foreground mb-4">
            Platforms
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
            {loading
              ? PLATFORM_ORDER.map((key) => (
                  <PlatformCardSkeleton key={key} />
                ))
              : PLATFORM_ORDER.map((key, i) => {
                  const meta = PLATFORM_META[key];
                  const stats = statsByKey.get(key);
                  const growth = stats
                    ? growthFor(stats)
                    : { value: 0, label: "unavailable" };

                  return (
                    <PlatformCard
                      key={key}
                      platform={meta.label}
                      icon={meta.icon}
                      color={meta.color}
                      followers={
                        stats ? formatCompact(stats.followers) : "—"
                      }
                      change={growth.value}
                      changeLabel={growth.label}
                      status={stats?.status ?? "error"}
                      error={stats?.error}
                      delay={i + 1}
                    />
                  );
                })}
          </div>
        </section>

        {/* Growth Chart */}
        <section id="chart-section">
          {loading ? (
            <GrowthChartSkeleton />
          ) : (
            <GrowthChart data={history} />
          )}
        </section>
      </div>
    </main>
  );
}

/* Skeleton version of the KPI card (kept local to avoid touching the
   presentational KPI component). */
function KPICardSkeleton() {
  return (
    <div className="glass-card rounded-xl p-5">
      <div className="flex items-start justify-between">
        <div>
          <div className="skeleton w-24 h-4 rounded mb-2" />
          <div className="skeleton w-20 h-7 rounded" />
        </div>
        <div className="skeleton w-10 h-10 rounded-lg" />
      </div>
      <div className="skeleton w-28 h-4 rounded mt-3" />
    </div>
  );
}
