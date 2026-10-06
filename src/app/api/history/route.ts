import { NextResponse } from "next/server";
import { getSnapshots } from "@/lib/firestore-cache";
import { pivotHistory } from "@/lib/cache-logic";
import type { HistoryResponse, PlatformKey } from "@/lib/types";

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
 * GET /api/history?days=30
 *
 * Pivots the per-platform daily snapshots into one row per date so Recharts
 * can draw the combined growth timeline.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const days = Math.min(
    Math.max(Number(params.get("days")) || 30, 1),
    365
  );

  const snapshots = await Promise.all(
    PLATFORMS.map((platform) => getSnapshots(platform, days))
  );

  const data = pivotHistory(snapshots.flat());

  const payload: HistoryResponse = { data, days };
  return NextResponse.json(payload, {
    headers: { "Cache-Control": "no-store" },
  });
}
