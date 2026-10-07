/**
 * Shared domain types for the social media dashboard.
 *
 * These types are used by both the server-side API routes and the client
 * components, so they must stay free of server-only imports.
 */

export type PlatformKey =
  | "youtube"
  | "instagram"
  | "facebook"
  | "threads"
  | "tiktok";

export type PlatformStatus = "online" | "error" | "loading";

/** Normalised stats returned by every platform integration. */
export interface PlatformStats {
  platform: PlatformKey;
  /** Raw follower / subscriber count. */
  followers: number;
  /** Lifetime or period views, when the platform exposes it. */
  views?: number;
  /** Number of published posts / videos. */
  posts?: number;
  /** Engagement rate as a percentage (0-100), when available. */
  engagementRate?: number;
  /** Percent change vs. the previous daily snapshot. */
  change24h?: number;
  /** Percent change vs. the snapshot ~7 days ago. */
  change7d?: number;
  status: "online" | "error";
  /** Human readable error message when `status === "error"`. */
  error?: string;
  /** ISO timestamp of when these numbers were fetched. */
  updatedAt: string;
  /** True when the payload came from the Firestore cache. */
  cached?: boolean;
}

export interface PlatformApiResponse {
  data: PlatformStats[];
  cached: boolean;
  updatedAt: string | null;
}

export interface DashboardTotals {
  followers: number;
  views: number;
  engagementRate: number;
  /** Weighted 24h growth across all online platforms (percent). */
  change24h: number;
  /** Weighted 7d growth across all online platforms (percent). */
  change7d: number;
  onlinePlatforms: number;
  totalPlatforms: number;
}

export interface DashboardResponse {
  platforms: PlatformStats[];
  totals: DashboardTotals;
  cached: boolean;
  lastUpdated: string;
}

/** A single day of follower counts keyed by platform. */
export interface HistoryPoint {
  date: string;
  youtube?: number;
  instagram?: number;
  facebook?: number;
  threads?: number;
  tiktok?: number;
}

export interface HistoryResponse {
  data: HistoryPoint[];
  days: number;
}

/** Absolute day-over-day difference for a single platform's metrics. */
export interface PlatformGrowth {
  followers: number | null;
  views: number | null;
  posts: number | null;
  engagementRate: number | null;
}

/** Map of platform key → its day-over-day growth. */
export type StatsGrowth = Record<PlatformKey, PlatformGrowth>;

/** A persisted `social_stats/{YYYY-MM-DD}` daily snapshot. */
export interface DailyStats {
  date: string;
  platforms: PlatformStats[];
  updatedAt: string;
}

/**
 * Response shape for `GET /api/stats`:
 * today's stats, yesterday's stats (or null), and their differences.
 */
export interface StatsComparisonResponse {
  current: DailyStats;
  previous: DailyStats | null;
  growth: StatsGrowth;
  cached: boolean;
}

/** Subset of a Firestore snapshot document. */
export interface SnapshotDoc {
  platform: PlatformKey;
  date: string;
  followers: number;
  views?: number | null;
  posts?: number | null;
  engagementRate?: number | null;
  capturedAt?: unknown;
}
