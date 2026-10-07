import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/firestore-cache";
import { buildPlatformAnalytics } from "@/lib/cache-logic";
import type { AnalyticsResponse, PlatformKey } from "@/lib/types";

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

/**
 * GET /api/analytics?days=30[&platform=youtube]
 *
 * Per-platform analytics built from the daily `snapshots/{platform}/days/*`
 * series: the full metric timeline plus latest values and windowed change.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const days = Math.min(Math.max(Number(params.get("days")) || 30, 1), 365);
  const requested = params.get("platform");

  const keys =
    requested && (PLATFORMS as string[]).includes(requested)
      ? [requested as PlatformKey]
      : PLATFORMS;

  const snapshotsByPlatform = await Promise.all(
    keys.map((platform) => getSnapshots(platform, days))
  );

  const data = keys.map((platform, index) =>
    buildPlatformAnalytics(platform, snapshotsByPlatform[index])
  );

  const payload: AnalyticsResponse = { data, days };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
