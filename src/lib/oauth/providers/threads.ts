import type { AccountIdentity } from "@/lib/oauth/types";
import {
  expiryFromNow,
  formEncode,
  providerError,
  type OAuthProvider,
} from "@/lib/oauth/provider";

/**
 * Threads OAuth provider (Meta's Threads API, distinct from Facebook Login).
 *
 * Docs: https://developers.facebook.com/docs/threads
 * Auth: https://threads.net/oauth/authorize
 * Token: https://graph.threads.net/oauth/access_token
 *
 * Scopes: `threads_basic` (profile + own posts), `threads_manage_insights`
 * (insights). Threads insights require the account to be a professional
 * account and the app to have the Threads use case approved.
 */

const AUTH_URL = "https://threads.net/oauth/authorize";
const TOKEN_URL = "https://graph.threads.net/oauth/access_token";
const LONG_TOKEN_URL = "https://graph.threads.net/access_token";
const GRAPH = "https://graph.threads.net/v1.0";

const SCOPES = ["threads_basic", "threads_manage_insights"];

function clientId(): string | undefined {
  return process.env.THREADS_CLIENT_ID ?? process.env.META_CLIENT_ID;
}
function clientSecret(): string | undefined {
  return process.env.THREADS_CLIENT_SECRET ?? process.env.META_CLIENT_SECRET;
}

interface ThreadsTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error_message?: string;
  error?: { message?: string };
}

export const threadsProvider: OAuthProvider = {
  platform: "threads",
  label: "Threads",
  scopes: SCOPES,

  isConfigured() {
    return Boolean(clientId() && clientSecret());
  },

  notConfiguredReason() {
    return "Set THREADS_CLIENT_ID and THREADS_CLIENT_SECRET (Meta app with the Threads use case) to enable Threads OAuth.";
  },

  buildAuthUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: clientId() ?? "",
      redirect_uri: redirectUri,
      scope: SCOPES.join(","),
      response_type: "code",
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formEncode({
        client_id: clientId() ?? "",
        client_secret: clientSecret() ?? "",
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
        code,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as ThreadsTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(providerError(res.status, json));
    }

    // Exchange the short-lived token for a long-lived (60 day) token.
    let accessToken = json.access_token;
    let expiresAt = expiryFromNow(json.expires_in);
    try {
      const longRes = await fetch(
        `${LONG_TOKEN_URL}?${formEncode({
          grant_type: "th_exchange_token",
          client_secret: clientSecret() ?? "",
          access_token: json.access_token,
        })}`,
        { cache: "no-store" }
      );
      const longJson = (await longRes.json()) as ThreadsTokenResponse;
      if (longRes.ok && longJson.access_token) {
        accessToken = longJson.access_token;
        expiresAt = expiryFromNow(longJson.expires_in);
      }
    } catch {
      // Fall back to the short-lived token if the exchange fails.
    }

    return {
      accessToken,
      expiresAt,
      scopes: SCOPES,
      tokenType: json.token_type ?? "Bearer",
    };
  },

  async refreshToken(tokens) {
    const res = await fetch(
      `${LONG_TOKEN_URL}?${formEncode({
        grant_type: "th_refresh_token",
        access_token: tokens.accessToken,
      })}`,
      { cache: "no-store" }
    );
    const json = (await res.json()) as ThreadsTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(providerError(res.status, json));
    }
    return {
      ...tokens,
      accessToken: json.access_token,
      expiresAt: expiryFromNow(json.expires_in),
    };
  },

  async discoverAccounts(tokens): Promise<AccountIdentity[]> {
    const url = new URL(`${GRAPH}/me`);
    url.searchParams.set("fields", "id,username,threads_profile_picture_url");
    url.searchParams.set("access_token", tokens.accessToken);
    const res = await fetch(url.toString(), { cache: "no-store" });
    const json = (await res.json()) as {
      id?: string;
      username?: string;
      threads_profile_picture_url?: string;
      error?: { message?: string };
    };
    if (!res.ok || !json.id) {
      throw new Error(providerError(res.status, json));
    }
    return [
      {
        platformAccountId: json.id,
        accountName: json.username ? `@${json.username}` : json.id,
        username: json.username,
        avatarUrl: json.threads_profile_picture_url,
        profileUrl: json.username
          ? `https://www.threads.net/@${json.username}`
          : undefined,
        accountType: "threads",
      },
    ];
  },
};
