"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ArrowLeft, ExternalLink, Plug, AlertTriangle } from "lucide-react";
import { Header } from "@/components/header";
import { PLATFORM_META } from "@/lib/platform-meta";
import { formatCompact, formatDateTime } from "@/lib/format";
import { ContentTable } from "@/components/platform-detail/content-table";
import { usePlatformDetail } from "@/components/platform-detail/use-platform-detail";
import { PlatformTrendChart } from "@/components/analytics/platform-trend-chart";
import { usePlatformAnalytics } from "@/components/analytics/use-platform-analytics";
import type { PlatformAnalytics, PlatformKey } from "@/lib/types";
import type {
  NormalizedMetrics,
  NormalizedPlatformDetail,
} from "@/lib/normalize/types";

const SUPPORTED: PlatformKey[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

type TimeRange = 7 | 30 | 90;

function MetricTile({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className="glass-card rounded-xl p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-2xl font-bold text-foreground mt-1">{value}</p>
    </div>
  );
}

export default function PlatformDetailPage() {
  const params = useParams<{ platform: string }>();
  const platform = params.platform as PlatformKey;
  const valid = SUPPORTED.includes(platform);
  const meta = valid ? PLATFORM_META[platform] : undefined;

  const { status, data, message, loading, limit, loadMore, reload } =
    usePlatformDetail(platform, 12);
  const [range, setRange] = useState<TimeRange>(30);
  const { data: analyticsData } = usePlatformAnalytics(range);

  const analytics: PlatformAnalytics | undefined = analyticsData.find(
    (a) => a.platform === platform
  );

  useEffect(() => {
    document.title = meta ? `${meta.label} — Gen Tyz` : "Platform — Gen Tyz";
  }, [meta]);

  if (!valid || !meta) {
    return (
      <main className="min-h-screen">
        <Header />
        <div className="p-6">
          <p className="text-sm text-muted-foreground">
            Unknown platform “{params.platform}”.
          </p>
          <Link href="/platforms" className="text-primary text-sm">
            Back to platforms
          </Link>
        </div>
      </main>
    );
  }

  const Icon = meta.icon;
  const metrics = data?.metrics;

  return (
    <main className="min-h-screen">
      <Header
        onRefresh={reload}
        isRefreshing={loading}
      />

      <div className="p-4 sm:p-6 space-y-6">
        <Link
          href="/platforms"
          className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="w-4 h-4" /> All platforms
        </Link>

        {/* Profile header */}
        <section className="glass-card rounded-xl p-5 flex items-center justify-between gap-4 flex-wrap">
          <div className="flex items-center gap-4 min-w-0">
            <div
              className="w-14 h-14 rounded-xl flex items-center justify-center shrink-0"
              style={{ backgroundColor: `${meta.color}15` }}
            >
              <Icon className="w-8 h-8" style={{ color: meta.color }} />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-semibold text-foreground truncate">
                {data?.account.accountName ?? meta.label}
              </h1>
              <div className="flex items-center gap-2 text-sm text-muted-foreground flex-wrap">
                {data?.account.username && <span>@{data.account.username}</span>}
                {data?.account.accountType && (
                  <span className="text-xs px-1.5 py-0.5 rounded bg-muted">
                    {data.account.accountType}
                  </span>
                )}
                {data?.account.profileUrl && (
                  <a
                    href={data.account.profileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    View profile <ExternalLink className="w-3 h-3" />
                  </a>
                )}
              </div>
            </div>
          </div>
          {data?.fetchedAt && (
            <p className="text-xs text-muted-foreground">
              Updated {formatDateTime(data.fetchedAt)}
            </p>
          )}
        </section>

        {/* States: not connected / reauth / error */}
        {status === "loading" ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <div key={i} className="skeleton h-24 rounded-xl" />
            ))}
          </div>
        ) : status !== "ok" ? (
          <section className="glass-card rounded-xl p-8 flex flex-col items-center text-center gap-3">
            {status === "not_connected" ? (
              <>
                <Plug className="w-8 h-8 text-muted-foreground" />
                <h2 className="text-lg font-semibold text-foreground">
                  {meta.label} is not connected
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  Connect this account to load live metrics and content.
                </p>
                <Link
                  href="/settings"
                  className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20"
                >
                  Go to Connected Accounts
                </Link>
              </>
            ) : (
              <>
                <AlertTriangle className="w-8 h-8 text-amber-500" />
                <h2 className="text-lg font-semibold text-foreground">
                  {status === "reauth_required"
                    ? "Reauthentication required"
                    : "Could not load data"}
                </h2>
                <p className="text-sm text-muted-foreground max-w-md">
                  {message}
                </p>
                <div className="flex gap-2">
                  <button
                    onClick={reload}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-primary/10 text-primary hover:bg-primary/20"
                  >
                    Retry
                  </button>
                  <Link
                    href="/settings"
                    className="px-4 py-2 rounded-lg text-sm font-medium border border-border hover:bg-accent"
                  >
                    Reconnect
                  </Link>
                </div>
              </>
            )}
          </section>
        ) : data ? (
          <DetailBody
            data={data}
            metrics={metrics ?? data.metrics}
            meta={meta}
            analytics={analytics}
            range={range}
            setRange={setRange}
            limit={limit}
            loading={loading}
            loadMore={loadMore}
          />
        ) : null}
      </div>
    </main>
  );
}

function DetailBody({
  data,
  metrics,
  meta,
  analytics,
  range,
  setRange,
  limit,
  loading,
  loadMore,
}: {
  data: NormalizedPlatformDetail;
  metrics: NormalizedMetrics;
  meta: (typeof PLATFORM_META)[PlatformKey];
  analytics: PlatformAnalytics | undefined;
  range: TimeRange;
  setRange: (r: TimeRange) => void;
  limit: number;
  loading: boolean;
  loadMore: () => void;
}) {
  return (
    <>
      {/* KPI tiles */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <MetricTile
          label="Followers"
          value={
            metrics?.followers == null
              ? "N/A"
              : formatCompact(metrics.followers)
          }
        />
        <MetricTile
          label="Views"
          value={metrics?.views == null ? "N/A" : formatCompact(metrics.views)}
        />
        <MetricTile
          label="Content"
          value={
            metrics?.contentCount == null
              ? "N/A"
              : formatCompact(metrics.contentCount)
          }
        />
        <MetricTile
          label="Engagement"
          value={
            metrics?.engagementRate == null
              ? "N/A"
              : `${metrics.engagementRate}%`
          }
        />
      </section>

      {/* Unavailable metrics note */}
      {data.unavailable.length > 0 && (
        <div className="rounded-lg border border-border bg-muted/30 px-4 py-3 text-xs text-muted-foreground">
          <p className="font-medium text-foreground mb-1">
            Not available from this API
          </p>
          <ul className="list-disc list-inside space-y-0.5">
            {data.unavailable.map((note) => (
              <li key={note}>{note}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Historical chart (reuses the analytics API) */}
      <section className="glass-card rounded-xl p-5">
        <div className="flex items-center justify-between mb-4 flex-wrap gap-2">
          <h2 className="font-semibold text-foreground">Historical trend</h2>
          <div className="inline-flex rounded-lg border border-border p-0.5">
            {([7, 30, 90] as TimeRange[]).map((d) => (
              <button
                key={d}
                onClick={() => setRange(d)}
                aria-pressed={range === d}
                className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
                  range === d
                    ? "bg-primary/10 text-primary"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                {d}D
              </button>
            ))}
          </div>
        </div>
        {analytics ? (
          <PlatformTrendChart
            analytics={analytics}
            color={meta.color}
            metric="followers"
          />
        ) : (
          <p className="text-sm text-muted-foreground py-10 text-center">
            Historical snapshots accumulate daily.
          </p>
        )}
      </section>

      {/* Content */}
      <section className="glass-card rounded-xl p-5">
        <h2 className="font-semibold text-foreground mb-4">Recent content</h2>
        <ContentTable
          content={data.content}
          support={data.support}
          onLoadMore={data.content.length >= limit ? loadMore : undefined}
          loadingMore={loading}
        />
      </section>
    </>
  );
}
