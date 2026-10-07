import { resolveAccessToken } from "@/lib/oauth/token-manager";
import { getAccount } from "@/lib/oauth/store";
import {
  getCachedContent,
  setCachedContent,
} from "@/lib/normalize/content-cache";
import { fetchYouTubeDetail } from "@/lib/normalize/adapters/youtube";
import {
  fetchFacebookDetail,
  fetchInstagramDetail,
} from "@/lib/normalize/adapters/meta";
import { fetchThreadsDetail } from "@/lib/normalize/adapters/threads";
import { fetchTikTokDetail } from "@/lib/normalize/adapters/tiktok";
import type { NormalizedPlatformDetail } from "@/lib/normalize/types";
import type { PlatformKey } from "@/lib/types";

/**
 * Unified platform-detail service: connected account → fresh token → platform
 * adapter → normalized detail (cached briefly).
 *
 * Returns a discriminated result so the UI can render precise states:
 *  - `ok`               → normalized detail
 *  - `not_connected`    → no connected account for this platform
 *  - `reauth_required`  → token expired and could not be refreshed
 *  - `error`            → provider/API failure
 */

export type DetailResult =
  | { status: "ok"; data: NormalizedPlatformDetail; cached: boolean }
  | { status: "not_connected"; platform: PlatformKey }
  | { status: "reauth_required"; platform: PlatformKey; message: string }
  | { status: "error"; platform: PlatformKey; message: string };

export async function getPlatformDetail(params: {
  ownerId: string;
  platform: PlatformKey;
  limit?: number;
  force?: boolean;
}): Promise<DetailResult> {
  const { ownerId, platform } = params;

  const account = await getAccount(ownerId, platform);
  if (!account) {
    return { status: "not_connected", platform };
  }

  if (!params.force) {
    const cached = await getCachedContent(
      ownerId,
      platform,
      account.platformAccountId
    );
    if (cached) return { status: "ok", data: cached, cached: true };
  }

  const resolved = await resolveAccessToken(ownerId, platform);
  if (!resolved) {
    return { status: "not_connected", platform };
  }
  if (resolved.expired) {
    return {
      status: "reauth_required",
      platform,
      message: "Access token expired. Please reconnect this account.",
    };
  }

  const tokens = {
    accessToken: resolved.accessToken,
    expiresAt: account.tokenExpiresAt,
    scopes: account.scopes,
  };

  const common = {
    accountId: account.id,
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    tokens,
    limit: params.limit,
  };

  try {
    let detail: NormalizedPlatformDetail;
    switch (platform) {
      case "youtube":
        detail = await fetchYouTubeDetail(common);
        break;
      case "facebook":
        detail = await fetchFacebookDetail({
          ...common,
          pageAccessToken: resolved.extra.pageAccessToken,
        });
        break;
      case "instagram":
        detail = await fetchInstagramDetail({
          ...common,
          pageAccessToken: resolved.extra.pageAccessToken,
        });
        break;
      case "threads":
        detail = await fetchThreadsDetail(common);
        break;
      case "tiktok":
        detail = await fetchTikTokDetail(common);
        break;
      default:
        return { status: "error", platform, message: "Unsupported platform" };
    }

    await setCachedContent(ownerId, platform, account.platformAccountId, detail);
    return { status: "ok", data: detail, cached: false };
  } catch (error) {
    return {
      status: "error",
      platform,
      message: error instanceof Error ? error.message : "Failed to load data",
    };
  }
}
