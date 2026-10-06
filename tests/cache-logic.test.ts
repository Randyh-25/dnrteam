import { test } from "node:test";
import assert from "node:assert/strict";
import {
  computeGrowth,
  dateKey,
  isFresh,
  percentChange,
  pivotHistory,
} from "../src/lib/cache-logic.ts";

test("dateKey returns UTC YYYY-MM-DD", () => {
  assert.equal(dateKey(new Date("2026-10-06T23:30:00Z")), "2026-10-06");
  assert.equal(dateKey(new Date("2026-01-01T00:00:00Z")), "2026-01-01");
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
