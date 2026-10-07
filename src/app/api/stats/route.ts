import { NextResponse } from "next/server";
import { socialFetchers } from "@/lib/api/social";
import {
  CACHE_TTL_SECONDS,
  getDailyStats,
  setDailyStats,
} from "@/lib/firestore-cache";
import { computeStatsGrowth, dateKey, isFresh, yesterdayKey } from "@/lib/cache-logic";
import type {
  DailyStats,
  PlatformKey,
  PlatformStats,
  StatsComparisonResponse,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const PLATFORMS: PlatformKey[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

/** Runs every fetcher in parallel, never throwing for a single platform. */
async function fetchFreshStats(): Promise<PlatformStats[]> {
  const results = await Promise.allSettled(
    PLATFORMS.map((platform) => socialFetchers[platform]())
  );

  return results.map((result, index) => {
    const platform = PLATFORMS[index];
    if (result.status === "fulfilled") return result.value;
    return {
      platform,
      followers: 0,
      status: "error" as const,
      error:
        result.reason instanceof Error
          ? result.reason.message
          : "Unknown fetch error",
      updatedAt: new Date().toISOString(),
    };
  });
}

/**
 * GET /api/stats
 *
 * Historical analytics endpoint with day-over-day comparison:
 *   1. Date-based doc IDs: `social_stats/{YYYY-MM-DD}`.
 *   2. Cache: if today's doc exists and `updatedAt` is within
 *      `REVALIDATE_TIME`, reuse it; else fetch fresh and `set(..., {merge:true})`.
 *   3. Compare against yesterday's document to build a per-metric `growth`.
 *   4. Respond with `{ current, previous, growth }`.
 *
 * `?force=1` skips the cache read (used by the Refresh button).
 */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";

  const today = dateKey();
  const yesterday = yesterdayKey();

  // 1. Check today's document.
  let current: DailyStats | null = null;
  let cached = false;
  const stored = await getDailyStats(today);

  if (!force && stored && isFresh(Date.parse(stored.updatedAt), CACHE_TTL_SECONDS)) {
    current = stored;
    cached = true;
  }

  // 2. Cache miss / expired / forced → fetch fresh and upsert.
  if (!current) {
    const platforms = await fetchFreshStats();
    current = { date: today, platforms, updatedAt: new Date().toISOString() };
    await setDailyStats(today, platforms);
  }

  // 3. Yesterday's document (may be null on the first day).
  const previous = await getDailyStats(yesterday);

  // 4. Per-metric growth vs. yesterday (null-safe when yesterday is missing).
  const growth = computeStatsGrowth(current.platforms, previous?.platforms ?? []);

  const payload: StatsComparisonResponse = {
    current,
    previous,
    growth,
    cached,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
