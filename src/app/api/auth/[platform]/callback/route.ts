import { NextResponse, type NextRequest } from "next/server";
import { getProvider } from "@/lib/oauth/providers";
import { resolveRedirectUri } from "@/lib/oauth/providers";
import { verifyOAuthState } from "@/lib/oauth/session";
import { upsertAccount } from "@/lib/oauth/store";
import { createPendingConnection } from "@/lib/oauth/pending";
import type { AccountIdentity, OAuthPlatform } from "@/lib/oauth/types";

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
 * GET /api/auth/[platform]/callback
 *
 * 1. Validates `state` (CSRF) and the `error`/`code` params.
 * 2. Exchanges the code for tokens (server-side).
 * 3. Discovers the account identity/identities.
 * 4. Stores the connection, or defers to the account-selection UI when a
 *    single authorization yields multiple accounts (Meta).
 *
 * Tokens are never placed in a redirect URL and never returned to the client.
 */
export async function GET(
  request: NextRequest,
  ctx: RouteContext<"/api/auth/[platform]/callback">
) {
  const { platform: rawPlatform } = await ctx.params;
  const platform = rawPlatform as OAuthPlatform;
  const params = request.nextUrl.searchParams;

  const settings = new URL("/settings", request.nextUrl.origin);

  if (!SUPPORTED.includes(platform)) {
    settings.searchParams.set("connect_error", rawPlatform);
    settings.searchParams.set("reason", "unsupported");
    return NextResponse.redirect(settings);
  }

  // Provider-reported denial / error.
  const providerError =
    params.get("error") ?? params.get("error_description") ?? null;
  if (providerError) {
    settings.searchParams.set("connect_error", platform);
    settings.searchParams.set("reason", "denied");
    return NextResponse.redirect(settings);
  }

  const code = params.get("code");
  const state = params.get("state");
  const ownerId = verifyOAuthState(state, platform);

  // Invalid/absent state → reject before touching the code.
  if (!ownerId) {
    settings.searchParams.set("connect_error", platform);
    settings.searchParams.set("reason", "invalid_state");
    return NextResponse.redirect(settings);
  }
  if (!code) {
    settings.searchParams.set("connect_error", platform);
    settings.searchParams.set("reason", "missing_code");
    return NextResponse.redirect(settings);
  }

  const provider = getProvider(platform);
  if (!provider.isConfigured()) {
    settings.searchParams.set("connect_error", platform);
    settings.searchParams.set("reason", "not_configured");
    return NextResponse.redirect(settings);
  }

  try {
    const redirectUri = resolveRedirectUri(platform, request.nextUrl.origin);
    const tokens = await provider.exchangeCode({ code, redirectUri });
    const identities = await provider.discoverAccounts(tokens);

    if (identities.length === 0) {
      settings.searchParams.set("connect_error", platform);
      settings.searchParams.set("reason", "no_accounts");
      return NextResponse.redirect(settings);
    }

    // Filter to the platform the user actually connected (Meta discovery
    // returns both Facebook and Instagram identities).
    const relevant = identities.filter((identity) =>
      isIdentityForPlatform(identity, platform)
    );
    const candidates = relevant.length > 0 ? relevant : identities;

    if (candidates.length === 1) {
      const identity = candidates[0];
      await upsertAccount({
        ownerId,
        platform,
        platformAccountId: identity.platformAccountId,
        accountName: identity.accountName,
        username: identity.username,
        avatarUrl: identity.avatarUrl,
        profileUrl: identity.profileUrl,
        accountType: identity.accountType,
        extra: identity.extra,
        tokens,
      });
      settings.searchParams.set("connected", platform);
      return NextResponse.redirect(settings);
    }

    // Multiple accounts → defer to the selection UI. The pending id is random
    // and carries no secret; tokens stay encrypted in Firestore.
    const pendingId = await createPendingConnection({
      ownerId,
      platform,
      identities: candidates,
      tokens,
    });
    if (!pendingId) {
      settings.searchParams.set("connect_error", platform);
      settings.searchParams.set("reason", "pending_failed");
      return NextResponse.redirect(settings);
    }
    const select = new URL("/settings/select-account", request.nextUrl.origin);
    select.searchParams.set("pending", pendingId);
    select.searchParams.set("platform", platform);
    return NextResponse.redirect(select);
  } catch (error) {
    settings.searchParams.set("connect_error", platform);
    settings.searchParams.set(
      "reason",
      error instanceof Error ? "provider_error" : "unknown"
    );
    return NextResponse.redirect(settings);
  }
}

/** Maps a discovered identity to the platform the user is connecting. */
function isIdentityForPlatform(
  identity: AccountIdentity,
  platform: OAuthPlatform
): boolean {
  switch (platform) {
    case "instagram":
      return identity.accountType === "instagram_business";
    case "facebook":
      return identity.accountType === "facebook_page";
    case "youtube":
      return identity.accountType === "channel";
    case "threads":
      return identity.accountType === "threads";
    case "tiktok":
      return identity.accountType === "user";
    default:
      return true;
  }
}
