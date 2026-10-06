import { NextResponse } from "next/server";
import {
  fetchFacebook,
  fetchInstagram,
  fetchThreads,
} from "@/lib/platforms/meta";
import { resolvePlatform } from "@/lib/cache-route";
import type { PlatformKey, PlatformStats } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const fetchers: Record<
  Extract<PlatformKey, "facebook" | "instagram" | "threads">,
  () => Promise<PlatformStats>
> = {
  facebook: fetchFacebook,
  instagram: fetchInstagram,
  threads: fetchThreads,
};

/**
 * GET /api/meta
 *
 * Returns Facebook, Instagram, and Threads stats. An optional `?platform=`
 * query filters to a single one. Cache/fresh logic follows PLAN.md §5.
 */
export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const force = params.get("force") === "1";
  const requested = params.get("platform");

  const keys =
    requested && requested in fetchers
      ? [requested as keyof typeof fetchers]
      : (Object.keys(fetchers) as Array<keyof typeof fetchers>);

  const data = await Promise.all(
    keys.map((key) => resolvePlatform(key, fetchers[key], { force }))
  );

  return NextResponse.json(
    { data },
    { headers: { "Cache-Control": "no-store" } }
  );
}
