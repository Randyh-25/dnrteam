import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/oauth/providers";
import { resolveRedirectUri } from "@/lib/oauth/providers";
import { createOAuthState } from "@/lib/oauth/session";
import { getDefaultOwnerId } from "@/lib/oauth/session";
import type { OAuthPlatform } from "@/lib/oauth/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const SUPPORTED: OAuthPlatform[] = [
  "youtube",
  "instagram",
  "facebook",
  "threads",
  "tiktok",
];

/**
 * GET /api/auth/[platform]/connect
 *
 * Builds the provider authorization URL (with a signed `state`) and redirects
 * the browser to it. Client secrets never leave this server route.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/[platform]/connect">
) {
  const { platform: rawPlatform } = await ctx.params;
  const platform = rawPlatform as OAuthPlatform;

  if (!SUPPORTED.includes(platform)) {
    return NextResponse.json(
      { error: `Unsupported platform: ${rawPlatform}` },
      { status: 404 }
    );
  }

  const provider = getProvider(platform);
  if (!provider.isConfigured()) {
    // Redirect back to settings with a clear "not configured" signal rather
    // than a dead end.
    const url = new URL("/settings", request.nextUrl.origin);
    url.searchParams.set("connect_error", platform);
    url.searchParams.set("reason", "not_configured");
    return NextResponse.redirect(url);
  }

  const ownerId = getDefaultOwnerId();
  const state = createOAuthState(ownerId, platform);
  const redirectUri = resolveRedirectUri(platform, request.nextUrl.origin);

  const authUrl = provider.buildAuthUrl({ state, redirectUri });

  // Persist state briefly via an httpOnly cookie as defence-in-depth alongside
  // the signed state value (which is also validated on the callback).
  const response = NextResponse.redirect(authUrl);
  response.cookies.set(`oauth_state_${platform}`, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 600,
  });
  return response;
}
