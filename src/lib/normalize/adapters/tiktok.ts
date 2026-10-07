import type { TokenSet } from "@/lib/oauth/types";
import type {
  NormalizedContent,
  NormalizedMetrics,
  NormalizedPlatformDetail,
} from "@/lib/normalize/types";

/**
 * TikTok normalization adapter (official Display API, OAuth token).
 *
 * User info: `/v2/user/info/`. Videos: `/v2/video/list/` (requires the
 * `video.list` scope). Fields per video: title, video_description, cover_image_url,
 * share_url, create_time, like_count, comment_count, share_count, view_count.
 *
 * `user.info.stats` (follower/likes/video counts) and `video.list` require
 * pre-approval in the TikTok developer app; when not granted the fields come
 * back empty and we surface `null` + a "requires approval" note.
 */

const API = "https://open.tiktokapis.com/v2";

interface TikTokUserResp {
  data?: {
    user?: {
      open_id?: string;
      display_name?: string;
      username?: string;
      avatar_url?: string;
      follower_count?: number;
      following_count?: number;
      likes_count?: number;
      video_count?: number;
    };
  };
  error?: { code?: string; message?: string };
}

interface TikTokVideoResp {
  data?: {
    videos?: Array<{
      id: string;
      title?: string;
      video_description?: string;
      cover_image_url?: string;
      share_url?: string;
      create_time?: number;
      like_count?: number;
      comment_count?: number;
      share_count?: number;
      view_count?: number;
    }>;
  };
  error?: { code?: string; message?: string };
}

async function tiktokGet<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as T;
  const err = (json as { error?: { code?: string; message?: string } }).error;
  if (!res.ok || (err && err.code && err.code !== "ok")) {
    throw new Error(err?.message || `TikTok API error (${res.status})`);
  }
  return json;
}

function engagement(
  likes: number | null,
  comments: number | null,
  shares: number | null,
  views: number | null
): number | null {
  if (views === null || views <= 0) return null;
  const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
  return Number(((interactions / views) * 100).toFixed(2));
}

export async function fetchTikTokDetail(params: {
  accountId: string;
  platformAccountId: string;
  accountName: string;
  tokens: TokenSet;
  limit?: number;
}): Promise<NormalizedPlatformDetail> {
  const token = params.tokens.accessToken;
  const limit = Math.min(params.limit ?? 12, 20);

  const userResp = await tiktokGet<TikTokUserResp>(
    "user/info/",
    {
      fields:
        "open_id,display_name,username,avatar_url,follower_count,following_count,likes_count,video_count",
    },
    token
  );
  const user = userResp.data?.user;

  const metrics: NormalizedMetrics = {
    followers: user?.follower_count ?? null,
    following: user?.following_count ?? null,
    views: null,
    contentCount: user?.video_count ?? null,
    likes: user?.likes_count ?? null,
    comments: null,
    shares: null,
    engagementRate: null,
  };

  const content: NormalizedContent[] = [];
  const unavailable: string[] = [];
  try {
    const videos = await tiktokGet<TikTokVideoResp>(
      "video/list/",
      {
        fields:
          "id,title,video_description,cover_image_url,share_url,create_time,like_count,comment_count,share_count,view_count",
        max_count: String(limit),
      },
      token
    );
    for (const v of videos.data?.videos ?? []) {
      const likes = v.like_count ?? null;
      const comments = v.comment_count ?? null;
      const shares = v.share_count ?? null;
      const views = v.view_count ?? null;
      content.push({
        id: v.id,
        platform: "tiktok",
        accountId: params.accountId,
        contentType: "video",
        title: v.title,
        caption: v.video_description,
        thumbnailUrl: v.cover_image_url,
        publishedAt: v.create_time
          ? new Date(v.create_time * 1000).toISOString()
          : null,
        url: v.share_url,
        views,
        likes,
        comments,
        shares,
        engagementRate: engagement(likes, comments, shares, views),
      });
    }
  } catch (error) {
    unavailable.push(
      `Video list unavailable: ${
        error instanceof Error ? error.message : "requires video.list approval"
      }`
    );
  }

  if (user?.follower_count === undefined) {
    unavailable.push(
      "Follower/like counts require the user.info.stats scope (pre-approval)"
    );
  }

  return {
    platform: "tiktok",
    account: {
      accountId: params.accountId,
      platformAccountId: params.platformAccountId,
      accountName: user?.display_name ?? params.accountName,
      username: user?.username,
      avatarUrl: user?.avatar_url,
      profileUrl: user?.username
        ? `https://www.tiktok.com/@${user.username}`
        : undefined,
      accountType: "user",
    },
    metrics,
    support: {
      following: true,
      views: true,
      likes: true,
      comments: true,
      shares: true,
      engagementRate: true,
    },
    content,
    unavailable,
    fetchedAt: new Date().toISOString(),
  };
}
