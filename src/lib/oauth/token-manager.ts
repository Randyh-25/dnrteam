import { getProvider } from "@/lib/oauth/providers";
import {
  getAccountWithTokens,
  updateTokens,
} from "@/lib/oauth/store";
import type { OAuthPlatform, TokenSet } from "@/lib/oauth/types";

/**
 * Resolves a *fresh* access token for a connected account, refreshing it when
 * it is expired or about to expire. Returns `null` when the account is not
 * connected or the refresh fails (caller then marks the account as needing
 * reauthentication).
 */

const EXPIRY_SKEW_MS = 60 * 1000; // refresh 1 minute before expiry

export interface ResolvedToken {
  accessToken: string;
  extra: Record<string, string>;
  expired: boolean;
}

export async function resolveAccessToken(
  ownerId: string,
  platform: OAuthPlatform
): Promise<ResolvedToken | null> {
  const account = await getAccountWithTokens(ownerId, platform);
  if (!account || !account.tokens) return null;

  let tokens: TokenSet = account.tokens;

  const isExpired =
    tokens.expiresAt !== null && tokens.expiresAt <= Date.now() + EXPIRY_SKEW_MS;

  if (isExpired) {
    const provider = getProvider(platform);
    if (provider.refreshToken && tokens.refreshToken) {
      try {
        tokens = await provider.refreshToken(tokens);
        await updateTokens(ownerId, platform, tokens);
      } catch {
        return {
          accessToken: tokens.accessToken,
          extra: account.extra ?? {},
          expired: true,
        };
      }
    } else if (tokens.expiresAt !== null && tokens.expiresAt <= Date.now()) {
      return {
        accessToken: tokens.accessToken,
        extra: account.extra ?? {},
        expired: true,
      };
    }
  }

  return {
    accessToken: tokens.accessToken,
    extra: account.extra ?? {},
    expired: false,
  };
}
