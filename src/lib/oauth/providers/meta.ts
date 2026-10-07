import type { AccountIdentity } from "@/lib/oauth/types";
import {
  expiryFromNow,
  formEncode,
  providerError,
  type OAuthProvider,
} from "@/lib/oauth/provider";
/**
 * Meta (Facebook + Instagram) OAuth provider.
 *
 * Docs:
 *  - Facebook Login: https://developers.facebook.com/docs/facebook-login/
 *  - Graph API: https://developers.facebook.com/docs/graph-api/
 *  - Instagram API with Facebook Login:
 *    https://developers.facebook.com/docs/instagram-platform/instagram-api-with-facebook-login
 *
 * Authorization yields a *user* access token; Pages (and their linked
 * Instagram Business accounts) are discovered via `/me/accounts`. Each Page has
 * its own access token which is what the Instagram Graph API requires, so we
 * persist the page token in `extra`.
 *
 * NOTE: Instagram analytics require a **professional/business** account and
 * `instagram_basic` + `pages_show_list` (plus `instagram_manage_insights` for
 * insights). Personal accounts cannot be queried.
 */

const GRAPH_VERSION = "v21.0";
const AUTH_URL = `https://www.facebook.com/${GRAPH_VERSION}/dialog/oauth`;
const TOKEN_URL = `https://graph.facebook.com/${GRAPH_VERSION}/oauth/access_token`;
const GRAPH = `https://graph.facebook.com/${GRAPH_VERSION}`;

const SCOPES = [
  "public_profile",
  "pages_show_list",
  "pages_read_engagement",
  "instagram_basic",
  "instagram_manage_insights",
];

function clientId(): string | undefined {
  return process.env.META_CLIENT_ID;
}
function clientSecret(): string | undefined {
  return process.env.META_CLIENT_SECRET;
}

interface FbTokenResponse {
  access_token?: string;
  token_type?: string;
  expires_in?: number;
  error?: { message?: string; type?: string; code?: number };
}

interface FbPage {
  id: string;
  name?: string;
  username?: string;
  access_token?: string;
  followers_count?: number;
  fan_count?: number;
  instagram_business_account?: { id: string };
  picture?: { data?: { url?: string } };
}

async function graphGet<T>(
  path: string,
  params: Record<string, string>
): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(providerError(res.status, json));
  }
  return json;
}

export const metaProvider: OAuthProvider = {
  platform: "facebook",
  label: "Meta (Facebook & Instagram)",
  scopes: SCOPES,

  isConfigured() {
    return Boolean(clientId() && clientSecret());
  },

  notConfiguredReason() {
    return "Set META_CLIENT_ID and META_CLIENT_SECRET to enable Meta OAuth.";
  },

  buildAuthUrl({ state, redirectUri }) {
    const params = new URLSearchParams({
      client_id: clientId() ?? "",
      redirect_uri: redirectUri,
      state,
      response_type: "code",
      scope: SCOPES.join(","),
    });
    return `${AUTH_URL}?${params.toString()}`;
  },

  async exchangeCode({ code, redirectUri }) {
    // 1. Exchange code for a short-lived user token.
    const shortRes = await fetch(
      `${TOKEN_URL}?${formEncode({
        client_id: clientId() ?? "",
        client_secret: clientSecret() ?? "",
        redirect_uri: redirectUri,
        code,
      })}`,
      { cache: "no-store" }
    );
    const shortJson = (await shortRes.json()) as FbTokenResponse;
    if (!shortRes.ok || !shortJson.access_token) {
      throw new Error(providerError(shortRes.status, shortJson));
    }

    // 2. Exchange for a long-lived (~60 day) user token.
    const longRes = await fetch(
      `${TOKEN_URL}?${formEncode({
        grant_type: "fb_exchange_token",
        client_id: clientId() ?? "",
        client_secret: clientSecret() ?? "",
        fb_exchange_token: shortJson.access_token,
      })}`,
      { cache: "no-store" }
    );
    const longJson = (await longRes.json()) as FbTokenResponse;
    const accessToken = longJson.access_token ?? shortJson.access_token;
    if (!longRes.ok && !accessToken) {
      throw new Error(providerError(longRes.status, longJson));
    }

    return {
      accessToken,
      expiresAt: expiryFromNow(longJson.expires_in ?? shortJson.expires_in),
      scopes: SCOPES,
      tokenType: longJson.token_type ?? "Bearer",
    };
  },

  async discoverAccounts(tokens): Promise<AccountIdentity[]> {
    const me = await graphGet<{ id: string; name?: string }>("me", {
      fields: "id,name",
      access_token: tokens.accessToken,
    });

    const accounts = await graphGet<{ data?: FbPage[] }>("me/accounts", {
      fields:
        "id,name,username,access_token,followers_count,fan_count,instagram_business_account,picture",
      access_token: tokens.accessToken,
    });

    const identities: AccountIdentity[] = [];

    // The personal Facebook profile itself (basic profile only).
    identities.push({
      platformAccountId: `user:${me.id}`,
      accountName: me.name ?? "Facebook User",
      accountType: "facebook_user",
      extra: { accountId: me.id },
    });

    for (const page of accounts.data ?? []) {
      const followers = page.followers_count ?? page.fan_count ?? 0;
      identities.push({
        platformAccountId: page.id,
        accountName: page.name ?? page.id,
        username: page.username,
        avatarUrl: page.picture?.data?.url,
        profileUrl: `https://www.facebook.com/${page.id}`,
        accountType: "facebook_page",
        extra: {
          pageId: page.id,
          pageAccessToken: page.access_token ?? "",
          followers: String(followers),
        },
      });

      if (page.instagram_business_account?.id) {
        const igId = page.instagram_business_account.id;
        // Best-effort IG profile fetch (requires instagram_basic).
        try {
          const ig = await graphGet<{
            username?: string;
            followers_count?: number;
            profile_picture_url?: string;
          }>(igId, {
            fields: "username,followers_count,profile_picture_url",
            access_token: page.access_token ?? tokens.accessToken,
          });
          identities.push({
            platformAccountId: igId,
            accountName: ig.username ? `@${ig.username}` : igId,
            username: ig.username,
            avatarUrl: ig.profile_picture_url,
            profileUrl: ig.username
              ? `https://www.instagram.com/${ig.username}`
              : undefined,
            accountType: "instagram_business",
            extra: {
              igUserId: igId,
              pageId: page.id,
              pageAccessToken: page.access_token ?? "",
            },
          });
        } catch {
          // Still surface the account even if profile fetch is blocked.
          identities.push({
            platformAccountId: igId,
            accountName: igId,
            accountType: "instagram_business",
            extra: {
              igUserId: igId,
              pageId: page.id,
              pageAccessToken: page.access_token ?? "",
            },
          });
        }
      }
    }

    return identities;
  },
};
