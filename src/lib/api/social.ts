import type { PlatformStats } from "@/lib/types";
import { rapidGet, toNumber } from "@/lib/platforms/rapidapi";
import { fetchYouTube } from "@/lib/platforms/youtube";

/**
 * Unified social data-fetching service.
 *
 * YouTube uses the official Data API v3 (API key). Instagram, Facebook,
 * Threads, and TikTok are fetched through their respective RapidAPI vendors
 * using a shared key plus a per-platform host.
 *
 * Each function never throws — failures are returned as a `PlatformStats`
 * object with `status: "error"` so a single failing platform cannot break the
 * dashboard.
 */

const ok = (platform: PlatformStats["platform"], fields: Partial<PlatformStats>): PlatformStats => ({
  platform,
  followers: 0,
  status: "online",
  updatedAt: new Date().toISOString(),
  ...fields,
});

const fail = (platform: PlatformStats["platform"], error: string): PlatformStats => ({
  platform,
  followers: 0,
  status: "error",
  error,
  updatedAt: new Date().toISOString(),
});

/* ---------------------------- Instagram (RapidAPI) ---------------------------- */

interface CommunityResponse {
  meta?: { code?: number; message?: string };
  data?: {
    name?: string;
    screenName?: string;
    usersCount?: number;
    postsCount?: number;
    avgER?: number;
    avgViews?: number;
  };
}

export async function fetchInstagram(): Promise<PlatformStats> {
  const username = process.env.INSTAGRAM_USERNAME;
  if (!username) return fail("instagram", "INSTAGRAM_USERNAME is not configured");

  const url = `https://www.instagram.com/${username.replace(/^@/, "")}/`;
  const result = await rapidGet<CommunityResponse>(
    process.env.RAPIDAPI_HOST_INSTAGRAM,
    "/community",
    { url }
  );

  if (!result.ok || !result.data?.data) {
    return fail("instagram", result.error || "Instagram profile not found");
  }

  const d = result.data.data;
  return ok("instagram", {
    followers: toNumber(d.usersCount) ?? 0,
    posts: toNumber(d.postsCount),
    // The vendor returns avgER already as a percentage (e.g. 2.24 = 2.24%).
    engagementRate:
      typeof d.avgER === "number" ? Number(d.avgER.toFixed(2)) : undefined,
  });
}

/* ---------------------------- Facebook (RapidAPI) ----------------------------- */

/**
 * Facebook is resolved via the same vendor's `/community` endpoint, which
 * accepts a public Page URL. Personal profiles (`profile.php?id=`) are not
 * readable by the scraper and will surface as an error badge.
 */
export async function fetchFacebook(): Promise<PlatformStats> {
  const pageUrl = process.env.FACEBOOK_PAGE_URL;
  if (!pageUrl) return fail("facebook", "FACEBOOK_PAGE_URL is not configured");

  const result = await rapidGet<CommunityResponse>(
    process.env.RAPIDAPI_HOST_FACEBOOK,
    "/community",
    { url: pageUrl }
  );

  if (!result.ok || !result.data?.data) {
    return fail(
      "facebook",
      result.error ||
        "Facebook page not readable (personal profiles are unsupported)"
    );
  }

  const d = result.data.data;
  return ok("facebook", {
    followers: toNumber(d.usersCount) ?? 0,
    posts: toNumber(d.postsCount),
    // The vendor returns avgER already as a percentage (e.g. 2.24 = 2.24%).
    engagementRate:
      typeof d.avgER === "number" ? Number(d.avgER.toFixed(2)) : undefined,
  });
}

/* ---------------------------- Threads (RapidAPI) ------------------------------ */

interface ThreadsResponse {
  data?: {
    user?: {
      username?: string;
      follower_count?: number;
    };
  };
}

export async function fetchThreads(): Promise<PlatformStats> {
  const username = process.env.THREADS_USERNAME;
  if (!username) return fail("threads", "THREADS_USERNAME is not configured");

  const result = await rapidGet<ThreadsResponse>(
    process.env.RAPIDAPI_HOST_THREADS,
    "/api/user/info",
    { username: username.replace(/^@/, "") }
  );

  const user = result.data?.data?.user;
  if (!result.ok || !user) {
    return fail("threads", result.error || "Threads profile not found");
  }

  return ok("threads", {
    followers: toNumber(user.follower_count) ?? 0,
  });
}

/* ----------------------------- TikTok (RapidAPI) ------------------------------ */

interface TikTokResponse {
  statusCode?: number;
  status_msg?: string;
  userInfo?: {
    stats?: {
      followerCount?: number;
      heartCount?: number;
      videoCount?: number;
      heart_count?: number;
      video_count?: number;
      follower_count?: number;
    };
  };
}

export async function fetchTikTok(): Promise<PlatformStats> {
  const username = process.env.TIKTOK_USERNAME;
  if (!username) return fail("tiktok", "TIKTOK_USERNAME is not configured");

  const result = await rapidGet<TikTokResponse>(
    process.env.RAPIDAPI_HOST_TIKTOK,
    "/api/user/info",
    { uniqueId: username.replace(/^@/, "") }
  );

  const stats = result.data?.userInfo?.stats;
  if (!result.ok || !stats) {
    return fail("tiktok", result.error || result.data?.status_msg || "TikTok profile not found");
  }

  const followers = toNumber(stats.followerCount) ?? toNumber(stats.follower_count);
  if (followers === undefined) {
    return fail("tiktok", "TikTok response did not include a follower count");
  }

  return ok("tiktok", {
    followers,
    posts: toNumber(stats.videoCount) ?? toNumber(stats.video_count),
    views: toNumber(stats.heartCount) ?? toNumber(stats.heart_count),
  });
}

/* --------------------------------- Registry ----------------------------------- */

export const socialFetchers = {
  youtube: fetchYouTube,
  instagram: fetchInstagram,
  facebook: fetchFacebook,
  threads: fetchThreads,
  tiktok: fetchTikTok,
} as const;

export type SocialFetcher = keyof typeof socialFetchers;

export { fetchYouTube };
