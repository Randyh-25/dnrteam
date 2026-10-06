import { NextResponse } from "next/server";
import { fetchYouTube } from "@/lib/platforms/youtube";
import { resolvePlatform } from "@/lib/cache-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/youtube
 *
 * Returns normalised YouTube channel stats. Served from Firestore when the
 * cache is fresh (< 3h); otherwise a fresh YouTube Data API call is made.
 *
 * `?force=1` bypasses the cache (used by the global refresh button).
 */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const data = await resolvePlatform("youtube", fetchYouTube, { force });

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
