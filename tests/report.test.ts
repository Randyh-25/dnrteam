import { test } from "node:test";
import assert from "node:assert/strict";
import { buildReport } from "../src/lib/report/build.ts";
import type { NormalizedPlatformDetail } from "../src/lib/normalize/types.ts";

function detail(
  overrides: Partial<NormalizedPlatformDetail> = {}
): NormalizedPlatformDetail {
  return {
    platform: "youtube",
    account: {
      accountId: "yt-1",
      platformAccountId: "UC123",
      accountName: "SeinKari",
    },
    metrics: {
      followers: 100,
      following: null,
      views: 1000,
      contentCount: 2,
      likes: null,
      comments: null,
      shares: null,
      engagementRate: null,
    },
    support: {
      following: false,
      views: true,
      likes: true,
      comments: true,
      shares: false,
      engagementRate: true,
    },
    content: [
      {
        id: "v1",
        platform: "youtube",
        accountId: "yt-1",
        contentType: "video",
        title: "A",
        publishedAt: "2026-10-01T00:00:00.000Z",
        url: "https://youtu.be/v1",
        views: 500,
        likes: 50,
        comments: 10,
        shares: null,
        engagementRate: 12,
      },
      {
        id: "v2",
        platform: "youtube",
        accountId: "yt-1",
        contentType: "video",
        title: "B",
        publishedAt: "2026-10-02T00:00:00.000Z",
        url: "https://youtu.be/v2",
        views: 800,
        likes: 20,
        comments: 30,
        shares: null,
        engagementRate: 6.25,
      },
    ],
    unavailable: ["Shares"],
    fetchedAt: "2026-10-07T00:00:00.000Z",
    ...overrides,
  };
}

test("buildReport aggregates the executive summary from real detail data", () => {
  const report = buildReport({
    title: "T",
    periodLabel: "Last 30 days",
    platforms: ["youtube"],
    metrics: ["followers", "views", "content", "likes", "comments"],
    details: [detail()],
    snapshotsByPlatform: {
      youtube: [
        { platform: "youtube", date: "2026-10-01", followers: 90, views: 900, posts: 2 },
        { platform: "youtube", date: "2026-10-07", followers: 100, views: 1000, posts: 2 },
      ],
    },
  });

  assert.equal(report.executiveSummary.totalAudience, 100);
  assert.equal(report.executiveSummary.totalViews, 1000);
  assert.equal(report.executiveSummary.totalContent, 2);
  // likes 50+20 = 70, comments 10+30 = 40 → 110
  assert.equal(report.executiveSummary.totalEngagement, 110);
  // growth pct over the window: (100-90)/90 = 11.11
  assert.equal(report.summaries[0].growth.followersPct, 11.11);
});

test("buildReport picks top content by each metric", () => {
  const report = buildReport({
    title: "T",
    periodLabel: "Last 30 days",
    platforms: ["youtube"],
    metrics: ["views", "likes", "comments", "engagement"],
    details: [detail()],
    snapshotsByPlatform: { youtube: [] },
  });
  const top = report.topContent.youtube;
  assert.equal(top.byViews?.id, "v2"); // 800
  assert.equal(top.byLikes?.id, "v1"); // 50
  assert.equal(top.byComments?.id, "v2"); // 30
  assert.equal(top.byEngagement?.id, "v1"); // 12%
});

test("buildReport cannot fabricate R/A: null metrics stay null", () => {
  const report = buildReport({
    title: "T",
    periodLabel: "Last 30 days",
    platforms: ["youtube"],
    metrics: ["shares"],
    details: [detail()],
    snapshotsByPlatform: { youtube: [] },
  });
  // shares is unsupported → recorded as unavailable, never invented.
  assert.ok(report.unavailableNotes.some((n) => n.includes("Shares")));
  assert.equal(report.summaries[0].metrics.shares, null);
});

test("buildReport merges growth series across platforms by date", () => {
  const youtube = detail();
  const tiktok = detail({
    platform: "tiktok",
    account: { accountId: "tt-1", platformAccountId: "tt", accountName: "tk" },
    metrics: {
      followers: 50,
      following: null,
      views: 200,
      contentCount: 1,
      likes: null,
      comments: null,
      shares: null,
      engagementRate: null,
    },
    content: [],
  });
  const report = buildReport({
    title: "T",
    periodLabel: "Last 30 days",
    platforms: ["youtube", "tiktok"],
    metrics: ["followers", "views"],
    details: [youtube, tiktok],
    snapshotsByPlatform: {
      youtube: [
        { platform: "youtube", date: "2026-10-01", followers: 90 },
        { platform: "youtube", date: "2026-10-07", followers: 100 },
      ],
      tiktok: [
        { platform: "tiktok", date: "2026-10-01", followers: 40 },
        { platform: "tiktok", date: "2026-10-07", followers: 50 },
      ],
    },
  });
  const last = report.series[report.series.length - 1];
  assert.equal(last.date, "2026-10-07");
  assert.equal(last.followers, 150); // 100 + 50
});

test("buildReport with no details yields empty, non-crashing report", () => {
  const report = buildReport({
    title: "T",
    periodLabel: "Last 30 days",
    platforms: [],
    metrics: ["followers"],
    details: [],
    snapshotsByPlatform: {},
  });
  assert.equal(report.summaries.length, 0);
  assert.equal(report.executiveSummary.totalAudience, 0);
  assert.equal(report.executiveSummary.overallGrowth, null);
});
