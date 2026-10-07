import { createHash } from "node:crypto";
import type { AccountIdentity } from "@/lib/oauth/types";
import {
  base64Url,
  expiryFromNow,
  formEncode,
  providerError,
  type OAuthProvider,
} from "@/lib/oauth/provider";

/**
 * YouTube (Google) OAuth 2.0 provider.
 *
 * Docs: https://developers.google.com/youtube/v3/guides/auth/server-side-web-apps
 * Scopes: `youtube.readonly` (channel + video stats) and
 *         `yt-analytics.readonly` (optional analytics reports).
 * `access_type=offline` + `prompt=consent` ensure a refresh token is issued.
 */

const AUTH_URL = "https://accounts.google.com/o/oauth2/v2/auth";
const TOKEN_URL = "https://oauth2.googleapis.com/token";
const CHANNELS_URL = "https://www.googleapis.com/youtube/v3/channels";

const SCOPES = [
  "https://www.googleapis.com/auth/youtube.readonly",
  "https://www.googleapis.com/auth/yt-analytics.readonly",
];

function clientId(): string | undefined {
  return process.env.GOOGLE_CLIENT_ID;
}
function clientSecret(): string | undefined {
  return process.env.GOOGLE_CLIENT_SECRET;
}

interface GoogleTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
}

interface YouTubeChannelList {
  items?: Array<{
    id: string;
    snippet?: { title?: string; thumbnails?: { default?: { url?: string } } };
  }>;
}

export const youtubeProvider: OAuthProvider = {
  platform: "youtube",
  label: "YouTube",
  scopes: SCOPES,

  isConfigured() {
    return Boolean(clientId() && clientSecret());
  },

  notConfiguredReason() {
    return "Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET to enable YouTube OAuth.";
  },

  buildAuthUrl({ state, redirectUri, codeChallenge }) {
    const params: Record<string, string> = {
      client_id: clientId() ?? "",
      redirect_uri: redirectUri,
      response_type: "code",
      scope: SCOPES.join(" "),
      access_type: "offline",
      include_granted_scopes: "true",
      prompt: "consent",
      state,
    };
    if (codeChallenge) {
      params.code_challenge = codeChallenge;
      params.code_challenge_method = "S256";
    }
    return `${AUTH_URL}?${new URLSearchParams(params).toString()}`;
  },

  async exchangeCode({ code, redirectUri, codeVerifier }) {
    const body: Record<string, string> = {
      client_id: clientId() ?? "",
      client_secret: clientSecret() ?? "",
      code,
      grant_type: "authorization_code",
      redirect_uri: redirectUri,
    };
    if (codeVerifier) body.code_verifier = codeVerifier;

    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formEncode(body),
    });
    const json = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(providerError(res.status, json));
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiryFromNow(json.expires_in),
      scopes: json.scope ? json.scope.split(" ") : SCOPES,
      tokenType: json.token_type ?? "Bearer",
    };
  },

  async refreshToken(tokens) {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available for YouTube");
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formEncode({
        client_id: clientId() ?? "",
        client_secret: clientSecret() ?? "",
        refresh_token: tokens.refreshToken,
        grant_type: "refresh_token",
      }),
    });
    const json = (await res.json()) as GoogleTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(providerError(res.status, json));
    }
    return {
      ...tokens,
      accessToken: json.access_token,
      expiresAt: expiryFromNow(json.expires_in),
      scopes: json.scope ? json.scope.split(" ") : tokens.scopes,
    };
  },

  async discoverAccounts(tokens): Promise<AccountIdentity[]> {
    // `mine=true` returns the channel(s) owned by the authenticated user.
    const url = `${CHANNELS_URL}?part=snippet&mine=true`;
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: "no-store",
    });
    const json = (await res.json()) as YouTubeChannelList & {
      error?: { message?: string };
    };
    if (!res.ok) {
      throw new Error(json.error?.message || providerError(res.status, json));
    }
    const items = json.items ?? [];
    return items.map((item) => ({
      platformAccountId: item.id,
      accountName: item.snippet?.title ?? item.id,
      avatarUrl: item.snippet?.thumbnails?.default?.url,
      profileUrl: `https://www.youtube.com/channel/${item.id}`,
      accountType: "channel",
    }));
  },
};

/** PKCE helpers for Google (optional but recommended). */
export function googleCodeChallenge(verifier: string): string {
  return base64Url(createHash("sha256").update(verifier).digest());
}
