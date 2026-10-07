import { NextResponse, type NextRequest } from "next/server";
import { getDefaultOwnerId, verifyOAuthState } from "@/lib/oauth/session";
import { deleteAccount, getAccountWithTokens } from "@/lib/oauth/store";
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
 * POST /api/auth/[platform]/disconnect
 *
 * Deletes the stored connection (and best-effort revokes the token). Called
 * from the Settings UI; requires a same-origin JSON body with `state` to keep
 * the CSRF posture consistent with the connect flow.
 */
export async function POST(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/[platform]/disconnect">
) {
  const { platform: rawPlatform } = await ctx.params;
  const platform = rawPlatform as OAuthPlatform;

  if (!SUPPORTED.includes(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 404 });
  }

  // Accept the signed state either in the JSON body or an `x-oauth-state`
  // header; reject without it so a cross-site form post cannot disconnect.
  let state: string | null = null;
  try {
    const body = (await request.json()) as { state?: string };
    state = body?.state ?? null;
  } catch {
    state = request.headers.get("x-oauth-state");
  }
  if (!state) state = request.headers.get("x-oauth-state");

  const ownerId = verifyOAuthState(state, platform);
  if (!ownerId) {
    return NextResponse.json({ error: "Invalid state" }, { status: 403 });
  }

  const account = await getAccountWithTokens(ownerId, platform);
  if (account?.tokens) {
    // Best-effort token revocation — never block disconnect on failure.
    await revokeToken(platform, account.tokens.accessToken).catch(() => {});
  }

  const ok = await deleteAccount(ownerId, platform);
  return NextResponse.json({ ok, platform });
}

/** Best-effort provider-side token revocation. */
async function revokeToken(
  platform: OAuthPlatform,
  accessToken: string
): Promise<void> {
  if (platform === "threads") {
    await fetch(
      `https://graph.threads.net/v1.0/me?access_token=${encodeURIComponent(accessToken)}`,
      { method: "DELETE" }
    );
    return;
  }
  if (platform === "tiktok") {
    await fetch("https://open.tiktokapis.com/v2/oauth/revoke/", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_key: process.env.TIKTOK_CLIENT_KEY ?? "",
        client_secret: process.env.TIKTOK_CLIENT_SECRET ?? "",
        token: accessToken,
      }).toString(),
    });
    return;
  }
  // Google / Meta: attempt provider revoke; ignore if unsupported.
  if (platform === "youtube") {
    await fetch(
      `https://oauth2.googleapis.com/revoke?token=${encodeURIComponent(accessToken)}`,
      { method: "POST" }
    );
  }
}

/** Exposes the current owner's signed state so the UI can call disconnect. */
export async function GET(
  _request: NextRequest,
  ctx: RouteContext<"/api/auth/[platform]/disconnect">
) {
  const { platform: rawPlatform } = await ctx.params;
  const platform = rawPlatform as OAuthPlatform;
  if (!SUPPORTED.includes(platform)) {
    return NextResponse.json({ error: "Unsupported platform" }, { status: 404 });
  }
  const ownerId = getDefaultOwnerId();
  const { createOAuthState } = await import("@/lib/oauth/session");
  return NextResponse.json({ state: createOAuthState(ownerId, platform) });
}
