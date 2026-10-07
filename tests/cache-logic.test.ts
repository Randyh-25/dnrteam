import { test } from "node:test";
import assert from "node:assert/strict";
import {
  buildPlatformAnalytics,
  computeGrowth,
  computePlatformGrowth,
  computeStatsGrowth,
  dateKey,
  isFresh,
  percentChange,
  pivotHistory,
  yesterdayKey,
} from "../src/lib/cache-logic.ts";
import type { PlatformStats } from "../src/lib/types.ts";

test("dateKey returns UTC YYYY-MM-DD", () => {
  assert.equal(dateKey(new Date("2026-10-06T23:30:00Z")), "2026-10-06");
  assert.equal(dateKey(new Date("2026-01-01T00:00:00Z")), "2026-01-01");
});

test("yesterdayKey subtracts one UTC day (month/year boundaries)", () => {
  assert.equal(yesterdayKey(new Date("2026-10-06T12:00:00Z")), "2026-10-05");
  assert.equal(yesterdayKey(new Date("2026-10-01T00:00:00Z")), "2026-09-30");
  assert.equal(yesterdayKey(new Date("2026-01-01T00:00:00Z")), "2025-12-31");
});

test("isFresh: cached data within the 3h TTL is fresh", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  const twoHoursAgo = now - 2 * 60 * 60 * 1000;
  assert.equal(isFresh(twoHoursAgo, 3 * 60 * 60, now), true);
});

test("isFresh: cached data older than the 3h TTL is stale", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  const fourHoursAgo = now - 4 * 60 * 60 * 1000;
  assert.equal(isFresh(fourHoursAgo, 3 * 60 * 60, now), false);
});

test("isFresh: exactly at the TTL boundary is still fresh", () => {
  const now = Date.parse("2026-10-06T12:00:00Z");
  const exactlyThreeHours = now - 3 * 60 * 60 * 1000;
  assert.equal(isFresh(exactlyThreeHours, 3 * 60 * 60, now), true);
});

test("isFresh: invalid timestamps are never fresh", () => {
  assert.equal(isFresh(NaN, 10800), false);
});

test("percentChange computes growth against a baseline", () => {
  assert.equal(percentChange(110, 100), 10);
  assert.equal(percentChange(90, 100), -10);
  assert.equal(percentChange(100, 0), undefined);
  assert.equal(percentChange(100, undefined), undefined);
});

test("computeGrowth derives 24h and 7d changes, excluding today", () => {
  const history = [
    { date: "2026-09-29", followers: 1000 },
    { date: "2026-09-30", followers: 1010 },
    { date: "2026-10-01", followers: 1020 },
    { date: "2026-10-02", followers: 1030 },
    { date: "2026-10-03", followers: 1040 },
    { date: "2026-10-04", followers: 1050 },
    { date: "2026-10-05", followers: 1100 },
    { date: "2026-10-06", followers: 1200 }, // today, must be ignored
  ];
  const growth = computeGrowth(history, 1212, "2026-10-06");
  // vs previous day (Oct 5: 1100)
  assert.equal(growth.change24h, 10.18);
  // vs 7 entries back within the "past" set -> Sep 29 (1000)
  assert.equal(growth.change7d, 21.2);
});

test("computeGrowth returns nothing when only today's snapshot exists", () => {
  const growth = computeGrowth([{ date: "2026-10-06", followers: 500 }], 500, "2026-10-06");
  assert.deepEqual(growth, {});
});

test("pivotHistory merges platforms into one sorted row per date", () => {
  const points = pivotHistory([
    { platform: "youtube", date: "2026-10-06", followers: 100 },
    { platform: "youtube", date: "2026-10-05", followers: 90 },
    { platform: "tiktok", date: "2026-10-06", followers: 50 },
  ]);
  assert.deepEqual(points, [
    { date: "2026-10-05", youtube: 90 },
    { date: "2026-10-06", youtube: 100, tiktok: 50 },
  ]);
});

test("computePlatformGrowth diffs every metric", () => {
  const growth = computePlatformGrowth(
    { followers: 120, views: 500, posts: 12, engagementRate: 3.5 },
    { followers: 100, views: 450, posts: 10, engagementRate: 3.1 }
  );
  assert.deepEqual(growth, {
    followers: 20,
    views: 50,
    posts: 2,
    engagementRate: 0.4,
  });
});

test("computePlatformGrowth returns null metrics when values are missing", () => {
  const growth = computePlatformGrowth(
    { followers: 120 },
    { followers: 100 }
  );
  assert.deepEqual(growth, {
    followers: 20,
    views: null,
    posts: null,
    engagementRate: null,
  });
});

test("computePlatformGrowth handles a missing previous day", () => {
  const growth = computePlatformGrowth({ followers: 120 }, undefined);
  assert.deepEqual(growth, {
    followers: null,
    views: null,
    posts: null,
    engagementRate: null,
  });
});

test("computeStatsGrowth builds per-platform growth and nulls absent platforms", () => {
  const make = (
    platform: PlatformStats["platform"],
    followers: number
  ): PlatformStats => ({
    platform,
    followers,
    status: "online",
    updatedAt: "2026-10-06T00:00:00.000Z",
  });

  const current = [make("youtube", 120), make("tiktok", 60)];
  const previous = [make("youtube", 100)];

  const growth = computeStatsGrowth(current, previous);
  assert.equal(growth.youtube.followers, 20);
  // tiktok had no baseline yesterday → null, not an error.
  assert.equal(growth.tiktok.followers, null);
  assert.equal(growth.tiktok.views, null);
});

test("buildPlatformAnalytics builds series, latest, change and percent", () => {
  const result = buildPlatformAnalytics("youtube", [
    { date: "2026-10-04", followers: 100, views: 1000, posts: 10, engagementRate: 2 },
    { date: "2026-10-05", followers: 110, views: 1200, posts: 11, engagementRate: 2.5 },
    { date: "2026-10-06", followers: 120, views: 1500, posts: 12, engagementRate: 3 },
  ]);

  assert.deepEqual(result.latest, {
    followers: 120,
    views: 1500,
    posts: 12,
    engagementRate: 3,
  });
  assert.deepEqual(result.change, {
    followers: 20,
    views: 500,
    posts: 2,
    engagementRate: 1,
  });
  assert.equal(result.followersChangePct, 20);
  assert.equal(result.series.length, 3);
});

test("buildPlatformAnalytics nulls change with a single data point", () => {
  const result = buildPlatformAnalytics("tiktok", [
    { date: "2026-10-06", followers: 6, posts: 6, views: 119 },
  ]);
  assert.equal(result.followersChangePct, null);
  assert.deepEqual(result.change, {
    followers: null,
    views: null,
    posts: null,
    engagementRate: null,
  });
  // Missing views/posts/engagement on the input become null.
  assert.equal(result.latest.engagementRate, null);
});

test("buildPlatformAnalytics handles an empty series", () => {
  const result = buildPlatformAnalytics("facebook", []);
  assert.deepEqual(result.series, []);
  assert.equal(result.latest.followers, 0);
  assert.equal(result.followersChangePct, null);
});
