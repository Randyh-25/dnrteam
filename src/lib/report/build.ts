import { buildPlatformAnalytics } from "@/lib/cache-logic";
import type { PlatformAnalytics, PlatformKey } from "@/lib/types";
import type { NormalizedContent, NormalizedPlatformDetail } from "@/lib/normalize/types";
import type { RawSnapshot } from "@/lib/firestore-cache";
import type {
  GeneratedReport,
  ReportMetric,
  ReportPlatformSummary,
  ReportSeriesPoint,
  ReportTopContent,
} from "@/lib/report/types";

/**
 * Pure report assembly. Given normalized platform details, historical
 * snapshots, and the requested metrics/range, it produces a
 * {@link GeneratedReport}. Kept free of I/O so it is unit-testable and so the
 * numbers are guaranteed to match the dashboard (both derive from the same
 * snapshot + normalized-detail inputs).
 */

function sumOrNull(values: Array<number | null>): number | null {
  const present = values.filter((v): v is number => typeof v === "number");
  if (present.length === 0) return null;
  return present.reduce((a, b) => a + b, 0);
}

function topBy(
  content: NormalizedContent[],
  pick: (c: NormalizedContent) => number | null
): NormalizedContent | null {
  let best: NormalizedContent | null = null;
  let bestVal = -Infinity;
  for (const c of content) {
    const v = pick(c);
    if (v !== null && v > bestVal) {
      bestVal = v;
      best = c;
    }
  }
  return best;
}

/** Which report metrics a normalized detail actually supports. */
function unavailableFor(
  detail: NormalizedPlatformDetail,
  metrics: ReportMetric[]
): string[] {
  const support = detail.support;
  const notes: string[] = [];
  const wants = (m: ReportMetric) => metrics.includes(m);
  if (wants("views") && !support.views) notes.push("Views");
  if (wants("likes") && !support.likes) notes.push("Likes");
  if (wants("comments") && !support.comments) notes.push("Comments");
  if (wants("shares") && !support.shares) notes.push("Shares");
  if (wants("engagement") && !support.engagementRate) notes.push("Engagement rate");
  return notes;
}

function buildSummary(
  detail: NormalizedPlatformDetail,
  analytics: PlatformAnalytics | undefined,
  metrics: ReportMetric[]
): ReportPlatformSummary {
  const m = detail.metrics;
  const contentLikes = sumOrNull(detail.content.map((c) => c.likes));
  const contentComments = sumOrNull(detail.content.map((c) => c.comments));
  const contentShares = sumOrNull(detail.content.map((c) => c.shares));

  return {
    platform: detail.platform,
    accountName: detail.account.accountName,
    metrics: {
      followers: m.followers,
      views: m.views,
      content: m.contentCount ?? detail.content.length,
      likes: contentLikes,
      comments: contentComments,
      shares: contentShares,
      engagementRate: m.engagementRate,
    },
    growth: {
      followers: analytics?.change.followers ?? null,
      followersPct: analytics?.followersChangePct ?? null,
      views: analytics?.change.views ?? null,
      content: analytics?.change.posts ?? null,
    },
    unavailable: unavailableFor(detail, metrics),
  };
}

/** Merges per-platform analytics series into a single date-keyed series. */
function buildSeries(perPlatform: PlatformAnalytics[]): ReportSeriesPoint[] {
  const byDate = new Map<string, ReportSeriesPoint>();
  for (const analytics of perPlatform) {
    for (const point of analytics.series) {
      const row =
        byDate.get(point.date) ??
        ({ date: point.date, followers: null, views: null, content: null, engagementRate: null } as ReportSeriesPoint);
      row.followers = (row.followers ?? 0) + point.followers;
      if (point.views !== null) row.views = (row.views ?? 0) + point.views;
      if (point.posts !== null) row.content = (row.content ?? 0) + point.posts;
      if (point.engagementRate !== null) {
        row.engagementRate = point.engagementRate;
      }
      byDate.set(point.date, row);
    }
  }
  return Array.from(byDate.values()).sort((a, b) => a.date.localeCompare(b.date));
}

export interface ReportInput {
  title: string;
  periodLabel: string;
  platforms: PlatformKey[];
  metrics: ReportMetric[];
  details: NormalizedPlatformDetail[];
  snapshotsByPlatform: Record<string, RawSnapshot[]>;
}

export function buildReport(input: ReportInput): GeneratedReport {
  const details = input.details;
  const perPlatformAnalytics = details.map((detail) => {
    const snapshots = input.snapshotsByPlatform[detail.platform] ?? [];
    return buildPlatformAnalytics(detail.platform, snapshots);
  });

  const analyticsByPlatform = new Map(
    perPlatformAnalytics.map((a) => [a.platform, a])
  );

  const summaries = details.map((detail) =>
    buildSummary(detail, analyticsByPlatform.get(detail.platform), input.metrics)
  );

  const totalAudience =
    sumOrNull(summaries.map((s) => s.metrics.followers)) ?? 0;
  const totalViews = sumOrNull(summaries.map((s) => s.metrics.views)) ?? 0;
  const totalContent = sumOrNull(summaries.map((s) => s.metrics.content)) ?? 0;
  const totalEngagement =
    sumOrNull(
      summaries.map((s) => {
        if (
          s.metrics.likes === null &&
          s.metrics.comments === null &&
          s.metrics.shares === null
        ) {
          return null;
        }
        return (
          (s.metrics.likes ?? 0) +
          (s.metrics.comments ?? 0) +
          (s.metrics.shares ?? 0)
        );
      })
    ) ?? 0;

  const growthPcts = summaries
    .map((s) => s.growth.followersPct)
    .filter((v): v is number => typeof v === "number");
  const overallGrowth =
    growthPcts.length > 0
      ? Number(
          (growthPcts.reduce((a, b) => a + b, 0) / growthPcts.length).toFixed(2)
        )
      : null;

  const topContent: Record<string, ReportTopContent> = {};
  for (const detail of details) {
    topContent[detail.platform] = {
      byViews: topBy(detail.content, (c) => c.views),
      byLikes: topBy(detail.content, (c) => c.likes),
      byComments: topBy(detail.content, (c) => c.comments),
      byEngagement: topBy(detail.content, (c) => c.engagementRate),
    };
  }

  const unavailableNotes = Array.from(
    new Set(summaries.flatMap((s) => s.unavailable.map((u) => `${s.platform}: ${u}`)))
  );

  return {
    title: input.title,
    periodLabel: input.periodLabel,
    generatedAt: new Date().toISOString(),
    platforms: input.platforms,
    metrics: input.metrics,
    executiveSummary: {
      totalAudience,
      totalViews,
      totalContent,
      totalEngagement,
      overallGrowth,
    },
    summaries,
    series: buildSeries(perPlatformAnalytics),
    topContent,
    unavailableNotes,
  };
}
