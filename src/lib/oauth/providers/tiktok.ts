import type { AccountIdentity } from "@/lib/oauth/types";
import {
  expiryFromNow,
  formEncode,
  providerError,
  type OAuthProvider,
} from "@/lib/oauth/provider";

/**
 * TikTok OAuth provider (Login Kit, OAuth v2).
 *
 * Docs: https://developers.tiktok.com/doc/login-kit-web
 * Auth:  https://www.tiktok.com/v2/auth/authorize/
 * Token: https://open.tiktokapis.com/v2/oauth/token/
 *
 * Scopes: `user.info.basic` (default), `user.info.stats` (follower/like
 * counts) and `video.list` (public videos). `user.info.stats` and `video.list`
 * require pre-approval in the TikTok developer app.
 */

const AUTH_URL = "https://www.tiktok.com/v2/auth/authorize/";
const TOKEN_URL = "https://open.tiktokapis.com/v2/oauth/token/";
const USERINFO_URL = "https://open.tiktokapis.com/v2/user/info/";

const SCOPES = ["user.info.basic", "user.info.stats", "video.list"];

function clientKey(): string | undefined {
  return process.env.TIKTOK_CLIENT_KEY;
}
function clientSecret(): string | undefined {
  return process.env.TIKTOK_CLIENT_SECRET;
}

interface TikTokTokenResponse {
  access_token?: string;
  refresh_token?: string;
  expires_in?: number;
  refresh_expires_in?: number;
  scope?: string;
  token_type?: string;
  error?: string;
  error_description?: string;
  log_id?: string;
}

export const tiktokProvider: OAuthProvider = {
  platform: "tiktok",
  label: "TikTok",
  scopes: SCOPES,

  isConfigured() {
    return Boolean(clientKey() && clientSecret());
  },

  notConfiguredReason() {
    return "Set TIKTOK_CLIENT_KEY and TIKTOK_CLIENT_SECRET to enable TikTok OAuth.";
  },

  buildAuthUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_key: clientKey() ?? "",
      scope: SCOPES.join(","),
      response_type: "code",
      redirect_uri: redirectUri,
      state,
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formEncode({
        client_key: clientKey() ?? "",
        client_secret: clientSecret() ?? "",
        code,
        grant_type: "authorization_code",
        redirect_uri: redirectUri,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as TikTokTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(providerError(res.status, json));
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token,
      expiresAt: expiryFromNow(json.expires_in),
      scopes: json.scope ? json.scope.split(",") : SCOPES,
      tokenType: json.token_type ?? "Bearer",
    };
  },

  async refreshToken(tokens) {
    if (!tokens.refreshToken) {
      throw new Error("No refresh token available for TikTok");
    }
    const res = await fetch(TOKEN_URL, {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: formEncode({
        client_key: clientKey() ?? "",
        client_secret: clientSecret() ?? "",
        grant_type: "refresh_token",
        refresh_token: tokens.refreshToken,
      }),
      cache: "no-store",
    });
    const json = (await res.json()) as TikTokTokenResponse;
    if (!res.ok || !json.access_token) {
      throw new Error(providerError(res.status, json));
    }
    return {
      accessToken: json.access_token,
      refreshToken: json.refresh_token ?? tokens.refreshToken,
      expiresAt: expiryFromNow(json.expires_in),
      scopes: json.scope ? json.scope.split(",") : tokens.scopes,
      tokenType: json.token_type ?? "Bearer",
    };
  },

  async discoverAccounts(tokens): Promise<AccountIdentity[]> {
    const url = new URL(USERINFO_URL);
    url.searchParams.set(
      "fields",
      "open_id,union_id,avatar_url,display_name,username,follower_count,likes_count,video_count"
    );
    const res = await fetch(url.toString(), {
      headers: { Authorization: `Bearer ${tokens.accessToken}` },
      cache: "no-store",
    });
    const json = (await res.json()) as {
      data?: {
        user?: {
          open_id?: string;
          display_name?: string;
          username?: string;
          avatar_url?: string;
          follower_count?: number;
          likes_count?: number;
          video_count?: number;
        };
      };
      error?: { code?: string; message?: string };
    };
    if (!res.ok || json.error?.code === "access_token_invalid") {
      throw new Error(
        json.error?.message || providerError(res.status, json)
      );
    }
    const user = json.data?.user;
    if (!user?.open_id) {
      throw new Error(json.error?.message || "TikTok user info unavailable");
    }
    return [
      {
        platformAccountId: user.open_id,
        accountName: user.display_name ?? user.open_id,
        username: user.username,
        avatarUrl: user.avatar_url,
        accountType: "user",
        extra: {
          followerCount: String(user.follower_count ?? ""),
          likesCount: String(user.likes_count ?? ""),
          videoCount: String(user.video_count ?? ""),
        },
      },
    ];
  },
};
