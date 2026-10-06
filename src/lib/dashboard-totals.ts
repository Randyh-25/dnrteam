import type { DashboardTotals, PlatformStats } from "@/lib/types";

/**
 * Aggregates platform stats into the top-row KPI totals.
 * Audience-weighted growth so larger platforms dominate the average.
 */
export function buildTotals(platforms: PlatformStats[]): DashboardTotals {
  const online = platforms.filter((p) => p.status === "online");

  const followers = online.reduce((sum, p) => sum + p.followers, 0);
  const views = online.reduce((sum, p) => sum + (p.views ?? 0), 0);

  const engagementValues = online
    .map((p) => p.engagementRate)
    .filter((v): v is number => typeof v === "number");
  const engagementRate =
    engagementValues.length > 0
      ? Number(
          (
            engagementValues.reduce((a, b) => a + b, 0) /
            engagementValues.length
          ).toFixed(2)
        )
      : 0;

  const weighted = (pick: (p: PlatformStats) => number | undefined): number => {
    const base = online.reduce(
      (sum, p) => sum + (typeof pick(p) === "number" ? p.followers : 0),
      0
    );
    if (base === 0) return 0;
    const total = online.reduce(
      (sum, p) => sum + (pick(p) ?? 0) * p.followers,
      0
    );
    return Number((total / base).toFixed(2));
  };

  return {
    followers,
    views,
    engagementRate,
    change24h: weighted((p) => p.change24h),
    change7d: weighted((p) => p.change7d),
    onlinePlatforms: online.length,
    totalPlatforms: platforms.length,
  };
}
