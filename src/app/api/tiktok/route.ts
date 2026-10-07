import { NextResponse } from "next/server";
import { socialFetchers } from "@/lib/api/social";
import { resolvePlatform } from "@/lib/cache-route";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

/**
 * GET /api/tiktok
 *
 * Returns TikTok profile stats via the RapidAPI aggregator. Cache/fresh logic
 * follows PLAN.md §5. `?force=1` bypasses the cache.
 */
export async function GET(request: Request) {
  const force = new URL(request.url).searchParams.get("force") === "1";
  const data = await resolvePlatform("tiktok", socialFetchers.tiktok, { force });

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
