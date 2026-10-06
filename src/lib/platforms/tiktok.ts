import type { PlatformStats } from "@/lib/types";

/**
 * TikTok integration via a RapidAPI aggregator.
 *
 * Aggregators vary in both host and response shape, so the host is
 * configurable (`RAPIDAPI_TIKTOK_HOST`) and the parser checks the common
 * `data.stats` / `user` shapes before giving up.
 */

const DEFAULT_HOST = "tiktok-scraper7.p.rapidapi.com";

interface TikTokResponse {
  code?: number;
  msg?: string;
  message?: string;
  data?: {
    stats?: {
      followerCount?: number;
      followingCount?: number;
      heartCount?: number;
      videoCount?: number;
      follower_count?: number;
      video_count?: number;
      heart_count?: number;
    };
    user?: {
      followerCount?: number;
      videoCount?: number;
      heartCount?: number;
      follower_count?: number;
      video_count?: number;
      heart?: number;
    };
  };
}

export function isTikTokConfigured(): boolean {
  return Boolean(process.env.RAPIDAPI_KEY && process.env.TIKTOK_USERNAME);
}

function pickNumber(...values: Array<number | undefined>): number | undefined {
  for (const value of values) {
    if (typeof value === "number" && Number.isFinite(value)) return value;
  }
  return undefined;
}

export async function fetchTikTok(): Promise<PlatformStats> {
  const now = new Date().toISOString();
  const apiKey = process.env.RAPIDAPI_KEY;
  const username = process.env.TIKTOK_USERNAME;
  const host = process.env.RAPIDAPI_TIKTOK_HOST || DEFAULT_HOST;

  if (!apiKey || !username) {
    return {
      platform: "tiktok",
      followers: 0,
      status: "error",
      error: "TikTok is not configured (missing RAPIDAPI_KEY / TIKTOK_USERNAME)",
      updatedAt: now,
    };
  }

  try {
    const cleanUsername = username.replace(/^@/, "");
    const url = `https://${host}/user/info?unique_id=${encodeURIComponent(cleanUsername)}`;
    const res = await fetch(url, {
      headers: {
        "x-rapidapi-key": apiKey,
        "x-rapidapi-host": host,
      },
      cache: "no-store",
    });

    const json = (await res.json()) as TikTokResponse;

    if (!res.ok) {
      throw new Error(json.message || json.msg || `RapidAPI error (${res.status})`);
    }

    const stats = json.data?.stats;
    const user = json.data?.user;

    const followers = pickNumber(
      stats?.followerCount,
      stats?.follower_count,
      user?.followerCount,
      user?.follower_count
    );

    if (followers === undefined) {
      throw new Error(
        json.msg || json.message || "TikTok aggregator returned no follower count"
      );
    }

    return {
      platform: "tiktok",
      followers,
      posts: pickNumber(stats?.videoCount, stats?.video_count, user?.videoCount, user?.video_count),
      views: pickNumber(stats?.heartCount, stats?.heart_count, user?.heartCount, user?.heart),
      status: "online",
      updatedAt: now,
    };
  } catch (error) {
    return {
      platform: "tiktok",
      followers: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown TikTok error",
      updatedAt: now,
    };
  }
}
