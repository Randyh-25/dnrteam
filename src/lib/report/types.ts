import type { PlatformKey } from "@/lib/types";
import type { NormalizedContent } from "@/lib/normalize/types";

/**
 * Report domain types.
 *
 * A report is assembled entirely from the same normalized data the dashboard
 * uses (platform detail + historical analytics) — there is no separate
 * calculation path, so the numbers always agree.
 */

export type ReportRange = "7" | "30" | "90" | "custom";

export interface ReportRequest {
  range: ReportRange;
  from?: string; // YYYY-MM-DD (custom)
  to?: string; // YYYY-MM-DD (custom)
  platforms: PlatformKey[];
  metrics: ReportMetric[];
}

export type ReportMetric =
  | "followers"
  | "views"
  | "content"
  | "likes"
  | "comments"
  | "shares"
  | "engagement"
  | "growth";

export interface ReportPlatformSummary {
  platform: PlatformKey;
  accountName: string;
  metrics: {
    followers: number | null;
    views: number | null;
    content: number | null;
    likes: number | null;
    comments: number | null;
    shares: number | null;
    engagementRate: number | null;
  };
  growth: {
    followers: number | null;
    followersPct: number | null;
    views: number | null;
    content: number | null;
  };
  /** Metrics requested but unavailable for this platform. */
  unavailable: string[];
}

export interface ReportTopContent {
  byViews: NormalizedContent | null;
  byLikes: NormalizedContent | null;
  byComments: NormalizedContent | null;
  byEngagement: NormalizedContent | null;
}

export interface ReportSeriesPoint {
  date: string;
  followers: number | null;
  views: number | null;
  content: number | null;
  engagementRate: number | null;
}

export interface GeneratedReport {
  title: string;
  periodLabel: string;
  generatedAt: string;
  platforms: PlatformKey[];
  metrics: ReportMetric[];
  executiveSummary: {
    totalAudience: number;
    totalViews: number;
    totalContent: number;
    totalEngagement: number;
    overallGrowth: number | null;
  };
  summaries: ReportPlatformSummary[];
  series: ReportSeriesPoint[];
  topContent: Record<string, ReportTopContent>;
  unavailableNotes: string[];
}
