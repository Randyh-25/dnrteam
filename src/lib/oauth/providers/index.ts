import type {
  OAuthPlatform,
  ProviderStatus,
} from "@/lib/oauth/types";
import type { OAuthProvider } from "@/lib/oauth/provider";
import { youtubeProvider } from "@/lib/oauth/providers/youtube";
import { metaProvider } from "@/lib/oauth/providers/meta";
import { threadsProvider } from "@/lib/oauth/providers/threads";
import { tiktokProvider } from "@/lib/oauth/providers/tiktok";

/**
 * Provider registry.
 *
 * Facebook and Instagram share the Meta OAuth flow (`metaProvider`): one
 * authorization yields a user token from which we discover Pages *and* their
 * linked Instagram Business accounts. The `instagramProvider` alias therefore
 * points at the same adapter but only surfaces Instagram identities.
 */

/** OAuth flow keys — Instagram reuses the Meta flow. */
export type OAuthFlowKey = OAuthPlatform;

export const oauthProviders: Record<OAuthPlatform, OAuthProvider> = {
  youtube: youtubeProvider,
  instagram: metaProvider, // same flow; identity filtered downstream
  facebook: metaProvider,
  threads: threadsProvider,
  tiktok: tiktokProvider,
};

export function getProvider(platform: OAuthPlatform): OAuthProvider {
  return oauthProviders[platform];
}

/** Providers that share one authorization flow. */
export const OAUTH_GROUPS: Record<OAuthPlatform, OAuthPlatform[]> = {
  youtube: ["youtube"],
  facebook: ["facebook", "instagram"],
  instagram: ["facebook", "instagram"],
  threads: ["threads"],
  tiktok: ["tiktok"],
};

/** Status list for the Connected Accounts UI. */
export function getProviderStatuses(): ProviderStatus[] {
  const platforms: OAuthPlatform[] = [
    "youtube",
    "instagram",
    "facebook",
    "threads",
    "tiktok",
  ];
  return platforms.map((platform) => {
    const provider = oauthProviders[platform];
    const configured = provider.isConfigured();
    return {
      platform,
      availability: configured ? "ready" : "not_configured",
      note: configured ? undefined : provider.notConfiguredReason(),
    };
  });
}

/**
 * Resolves the OAuth redirect URI for a platform. Prefers a platform-specific
 * env var, then falls back to the app origin + the generic callback path.
 */
export function resolveRedirectUri(
  platform: OAuthPlatform,
  origin: string
): string {
  const specific =
    platform === "youtube"
      ? process.env.GOOGLE_REDIRECT_URI
      : platform === "threads"
        ? process.env.THREADS_REDIRECT_URI
        : platform === "tiktok"
          ? process.env.TIKTOK_REDIRECT_URI
          : process.env.META_REDIRECT_URI;

  if (specific) return specific;
  return `${origin}/api/auth/${platform}/callback`;
}

export { youtubeProvider, metaProvider, threadsProvider, tiktokProvider };
