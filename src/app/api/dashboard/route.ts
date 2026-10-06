import { NextResponse } from "next/server";
import { fetchYouTube } from "@/lib/platforms/youtube";
import {
  fetchFacebook,
  fetchInstagram,
  fetchThreads,
} from "@/lib/platforms/meta";
import { fetchTikTok } from "@/lib/platforms/tiktok";
import { resolvePlatform } from "@/lib/cache-route";
import { buildTotals } from "@/lib/dashboard-totals";
import type {
  DashboardResponse,
  PlatformKey,
  PlatformStats,
} from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const registry: Array<{
  key: PlatformKey;
  fetcher: () => Promise<PlatformStats>;
}> = [
  { key: "youtube", fetcher: fetchYouTube },
  { key: "instagram", fetcher: fetchInstagram },
  { key: "facebook", fetcher: fetchFacebook },
  { key: "threads", fetcher: fetchThreads },
  { key: "tiktok", fetcher: fetchTikTok },
];

/**
 * GET /api/dashboard
 *
 * Single round-trip used by the dashboard: resolves every platform (cache
 * first, per PLAN.md §5) and returns the aggregated totals.
 */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";

  const platforms = await Promise.all(
    registry.map(({ key, fetcher }) => resolvePlatform(key, fetcher, { force }))
  );

  const lastUpdated =
    platforms
      .map((p) => p.updatedAt)
      .filter(Boolean)
      .sort()
      .at(-1) ?? new Date().toISOString();

  const payload: DashboardResponse = {
    platforms,
    totals: buildTotals(platforms),
    cached: platforms.every((p) => p.cached === true),
    lastUpdated,
  };

  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
