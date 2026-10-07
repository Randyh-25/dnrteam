import { NextResponse, type NextRequest } from "next/server";
import { getDefaultOwnerId } from "@/lib/oauth/session";
import { getPlatformDetail } from "@/lib/normalize/platform-detail";
import type { PlatformKey } from "@/lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";
export const maxDuration = 30;

const SUPPORTED: PlatformKey[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

const STATUS_CODE = {
  ok: 200,
  not_connected: 409,
  reauth_required: 401,
  error: 502,
} as const;

/**
 * GET /api/platform/[platform]?limit=12&force=1
 *
 * Returns normalized profile + metrics + content for the connected account of
 * the given platform. Never returns tokens.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/platform/[platform]">
) {
  const { platform: rawPlatform } = await ctx.params;
  const platform = rawPlatform as PlatformKey;

  if (!SUPPORTED.includes(platform)) {
    return NextResponse.json(
      { status: "error", platform: rawPlatform, message: "Unsupported platform" },
      { status: 404 }
    );
  }

  const params = request.nextUrl.searchParams;
  const limit = Math.min(Math.max(Number(params.get("limit")) || 12, 1), 50);
  const force = params.get("force") === "1";
  const ownerId = getDefaultOwnerId();

  const result = await getPlatformDetail({ ownerId, platform, limit, force });

  return NextResponse.json(result, {
    status: STATUS_CODE[result.status],
    headers: { "Cache-Control": "no-store" },
  });
}
