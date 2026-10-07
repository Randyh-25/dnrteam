import type {
  HistoryPoint,
  PlatformGrowth,
  PlatformKey,
  PlatformStats,
  StatsGrowth,
} from "@/lib/types";

/**
 * Pure cache/aggregation logic, kept free of Firebase and Next.js imports so
 * it can be unit tested directly.
 */

/** UTC `YYYY-MM-DD` key used for daily snapshots. */
export function dateKey(date: Date = new Date()): string {
  return date.toISOString().slice(0, 10);
}

/** UTC `YYYY-MM-DD` key for the day before `from` (defaults to today). */
export function yesterdayKey(from: Date = new Date()): string {
  const d = new Date(from);
  d.setUTCDate(d.getUTCDate() - 1);
  return dateKey(d);
}

/** Numeric metrics used for day-over-day growth. */
export interface MetricSet {
  followers?: number;
  views?: number;
  posts?: number;
  engagementRate?: number;
}

/** Absolute difference between two optional metrics (`null` when either is missing). */
function diff(current?: number, previous?: number): number | null {
  if (typeof current !== "number" || typeof previous !== "number") return null;
  return Number((current - previous).toFixed(4));
}

/** Difference for a single platform between today and a baseline. */
export function computePlatformGrowth(
  current: MetricSet,
  previous: MetricSet | undefined
): PlatformGrowth {
  return {
    followers: diff(current.followers, previous?.followers),
    views: diff(current.views, previous?.views),
    posts: diff(current.posts, previous?.posts),
    engagementRate: diff(current.engagementRate, previous?.engagementRate),
  };
}

/**
 * Difference for every platform between two days. Platforms absent from
 * `previous` get `null` metrics (handled gracefully).
 */
export function computeStatsGrowth(
  current: PlatformStats[],
  previous: PlatformStats[]
): StatsGrowth {
  const previousByPlatform = new Map(previous.map((p) => [p.platform, p]));
  const growth = {} as StatsGrowth;

  for (const platform of current) {
    growth[platform.platform] = computePlatformGrowth(
      platform,
      previousByPlatform.get(platform.platform)
    );
  }

  return growth;
}

/** True when `updatedMs` is within `ttlSeconds` of `nowMs`. */
export function isFresh(
  updatedMs: number,
  ttlSeconds: number,
  nowMs: number = Date.now()
): boolean {
  if (!Number.isFinite(updatedMs)) return false;
  return nowMs - updatedMs <= ttlSeconds * 1000;
}

/** Percent change between a current value and a baseline. */
export function percentChange(
  current: number,
  baseline: number | undefined
): number | undefined {
  if (!baseline || baseline <= 0) return undefined;
  return Number((((current - baseline) / baseline) * 100).toFixed(2));
}

export interface GrowthBaseline {
  date: string;
  followers: number;
}

export interface Growth {
  change24h?: number;
  change7d?: number;
}

/**
 * Derives 24h / 7d growth from ascending daily snapshots. Today's snapshot is
 * excluded from the baselines so growth always compares against a prior day.
 */
export function computeGrowth(
  history: GrowthBaseline[],
  currentFollowers: number,
  today: string = dateKey()
): Growth {
  const past = history.filter((h) => h.date !== today).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
  if (past.length === 0) return {};

  const previous = past[past.length - 1];
  const weekAgo = past[Math.max(0, past.length - 7)];

  return {
    change24h: percentChange(currentFollowers, previous?.followers),
    change7d: percentChange(currentFollowers, weekAgo?.followers),
  };
}

/** Pivots per-platform snapshots into one point per date for the chart. */
export function pivotHistory(
  snapshots: Array<{ platform: PlatformKey; date: string; followers: number }>
): HistoryPoint[] {
  const byDate = new Map<string, HistoryPoint>();
  for (const snap of snapshots) {
    const point = byDate.get(snap.date) ?? { date: snap.date };
    point[snap.platform] = snap.followers;
    byDate.set(snap.date, point);
  }
  return Array.from(byDate.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  );
}
