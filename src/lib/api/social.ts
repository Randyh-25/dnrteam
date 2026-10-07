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

/**
 * Instagram via `instagram-looter2` (`GET /profile?username=`).
 * Follower count lives at `edge_followed_by.count`.
 */
interface IgProfileResponse {
  username?: string;
  full_name?: string;
  is_private?: boolean;
  edge_followed_by?: { count?: number };
  edge_follow?: { count?: number };
  edge_owner_to_timeline_media?: { count?: number };
}

export async function fetchInstagram(): Promise<PlatformStats> {
  const username = process.env.INSTAGRAM_USERNAME;
  if (!username) return fail("instagram", "INSTAGRAM_USERNAME is not configured");

  const result = await rapidGet<IgProfileResponse>(
    process.env.RAPIDAPI_HOST_INSTAGRAM,
    "/profile",
    { username: username.replace(/^@/, "") }
  );

  const data = result.data;
  if (!result.ok || !data || data.edge_followed_by?.count === undefined) {
    return fail("instagram", result.error || "Instagram profile not found");
  }

  return ok("instagram", {
    followers: toNumber(data.edge_followed_by?.count) ?? 0,
    posts: toNumber(data.edge_owner_to_timeline_media?.count),
  });
}

/* ---------------------------- Facebook (RapidAPI) ----------------------------- */

/**
 * Facebook via `facebook-scraper3` (`GET /page/details?url=`).
 *
 * Despite the route name, this endpoint resolves a public **profile or page**
 * URL and returns its social counts (`followers`, `following`). The dedicated
 * `/profile/*` endpoints expose profile metadata only — no follower count — so
 * we use `/page/details` with the configured URL.
 */
interface FbPageDetailsResponse {
  results?: {
    name?: string;
    type?: string;
    followers?: number | null;
    likes?: number | null;
    following?: number | null;
  };
}

export async function fetchFacebook(): Promise<PlatformStats> {
  const profileUrl =
    process.env.FACEBOOK_PROFILE_URL ?? process.env.FACEBOOK_PAGE_URL;
  if (!profileUrl) {
    return fail("facebook", "FACEBOOK_PROFILE_URL is not configured");
  }

  const result = await rapidGet<FbPageDetailsResponse>(
    process.env.RAPIDAPI_HOST_FACEBOOK,
    "/page/details",
    { url: profileUrl }
  );

  const details = result.data?.results;
  if (!result.ok || !details) {
    return fail(
      "facebook",
      result.error ||
        "Facebook profile not readable (must be a public profile/page)"
    );
  }

  const followers = toNumber(details.followers) ?? toNumber(details.likes) ?? 0;

  return ok("facebook", {
    followers,
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
