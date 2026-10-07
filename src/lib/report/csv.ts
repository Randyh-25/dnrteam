import type { GeneratedReport } from "@/lib/report/types";

/** Builds a CSV string from the report's per-platform summary table. */
export function reportToCsv(report: GeneratedReport): string {
  const header = [
    "platform",
    "account",
    "followers",
    "views",
    "content",
    "likes",
    "comments",
    "shares",
    "engagement_rate",
    "followers_growth",
    "followers_growth_pct",
  ];

  const rows = report.summaries.map((s) => [
    s.platform,
    s.accountName,
    csvCell(s.metrics.followers),
    csvCell(s.metrics.views),
    csvCell(s.metrics.content),
    csvCell(s.metrics.likes),
    csvCell(s.metrics.comments),
    csvCell(s.metrics.shares),
    csvCell(s.metrics.engagementRate),
    csvCell(s.growth.followers),
    csvCell(s.growth.followersPct),
  ]);

  const summary = [
    ["TOTAL", "audience", csvCell(report.executiveSummary.totalAudience)],
    ["TOTAL", "views", csvCell(report.executiveSummary.totalViews)],
    ["TOTAL", "content", csvCell(report.executiveSummary.totalContent)],
    ["TOTAL", "engagement", csvCell(report.executiveSummary.totalEngagement)],
  ];

  return [
    header.join(","),
    ...rows.map((r) => r.join(",")),
    "",
    ...summary.map((r) => r.join(",")),
  ].join("\n");
}

function csvCell(value: number | null): string {
  return value === null ? "N/A" : String(value);
}
