import type { TokenSet } from "@/lib/oauth/types";
import type {
  NormalizedContent,
  NormalizedMetrics,
  NormalizedPlatformDetail,
} from "@/lib/normalize/types";

/**
 * YouTube normalization adapter (official Data API v3, OAuth token).
 *
 * Content = the channel's uploads playlist; per-video statistics come from the
 * `videos` endpoint. Views/likes/comments are real; "shares" is not exposed by
 * the Data API, so it stays `null` (rendered N/A).
 */

const API = "https://www.googleapis.com/youtube/v3";

interface ChannelResp {
  items?: Array<{
    id: string;
    snippet?: { title?: string; customUrl?: string; thumbnails?: { default?: { url?: string } } };
    statistics?: {
      subscriberCount?: string;
      videoCount?: string;
      viewCount?: string;
    };
    contentDetails?: { relatedPlaylists?: { uploads?: string } };
  }>;
}

interface PlaylistItemsResp {
  items?: Array<{
    contentDetails?: { videoId?: string; videoPublishedAt?: string };
    snippet?: {
      title?: string;
      description?: string;
      publishedAt?: string;
      thumbnails?: { medium?: { url?: string }; default?: { url?: string } };
      resourceId?: { videoId?: string };
    };
  }>;
}

interface VideosResp {
  items?: Array<{
    id: string;
    statistics?: { viewCount?: string; likeCount?: string; commentCount?: string };
  }>;
}

type VideoStats = { viewCount?: string; likeCount?: string; commentCount?: string };

function toNum(v: string | undefined): number | null {
  if (v === undefined) return null;
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

function engagement(
  likes: number | null,
  comments: number | null,
  views: number | null
): number | null {
  if (views === null || views <= 0) return null;
  const interactions = (likes ?? 0) + (comments ?? 0);
  return Number(((interactions / views) * 100).toFixed(2));
}

async function apiGet<T>(path: string, params: Record<string, string>, token: string): Promise<T> {
  const url = new URL(`${API}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  const res = await fetch(url.toString(), {
    headers: { Authorization: `Bearer ${token}` },
    cache: "no-store",
  });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok) {
    throw new Error(json.error?.message || `YouTube API error (${res.status})`);
  }
  return json;
}

export async function fetchYouTubeDetail(params: {
  accountId: string;
  platformAccountId: string;
  accountName: string;
  tokens: TokenSet;
  limit?: number;
}): Promise<NormalizedPlatformDetail> {
  const channelId = params.platformAccountId;
  const limit = params.limit ?? 12;

  const channel = await apiGet<ChannelResp>(
    "channels",
    { part: "snippet,statistics,contentDetails", id: channelId },
    params.tokens.accessToken
  );
  const ch = channel.items?.[0];
  if (!ch) throw new Error("YouTube channel not found");

  const metrics: NormalizedMetrics = {
    followers: toNum(ch.statistics?.subscriberCount),
    following: null,
    views: toNum(ch.statistics?.viewCount),
    contentCount: toNum(ch.statistics?.videoCount),
    likes: null,
    comments: null,
    shares: null,
    engagementRate: null,
  };

  const content: NormalizedContent[] = [];
  const uploads = ch.contentDetails?.relatedPlaylists?.uploads;
  if (uploads) {
    const playlist = await apiGet<PlaylistItemsResp>(
      "playlistItems",
      { part: "snippet,contentDetails", playlistId: uploads, maxResults: String(limit) },
      params.tokens.accessToken
    );
    const items = playlist.items ?? [];
    const ids = items
      .map((i) => i.contentDetails?.videoId ?? i.snippet?.resourceId?.videoId)
      .filter((id): id is string => Boolean(id));

    let statsById = new Map<string, VideoStats | undefined>();
    if (ids.length > 0) {
      const videos = await apiGet<VideosResp>(
        "videos",
        { part: "statistics", id: ids.join(",") },
        params.tokens.accessToken
      );
      statsById = new Map<string, VideoStats | undefined>(
        (videos.items ?? []).map((v) => [v.id, v.statistics])
      );
    }

    for (const item of items) {
      const videoId = item.contentDetails?.videoId ?? item.snippet?.resourceId?.videoId;
      if (!videoId) continue;
      const stats = statsById.get(videoId);
      const views = toNum(stats?.viewCount);
      const likes = toNum(stats?.likeCount);
      const comments = toNum(stats?.commentCount);
      content.push({
        id: videoId,
        platform: "youtube",
        accountId: params.accountId,
        contentType: "video",
        title: item.snippet?.title,
        caption: item.snippet?.description,
        thumbnailUrl:
          item.snippet?.thumbnails?.medium?.url ??
          item.snippet?.thumbnails?.default?.url,
        publishedAt:
          item.contentDetails?.videoPublishedAt ?? item.snippet?.publishedAt ?? null,
        url: `https://www.youtube.com/watch?v=${videoId}`,
        views,
        likes,
        comments,
        shares: null,
        engagementRate: engagement(likes, comments, views),
      });
    }
  }

  return {
    platform: "youtube",
    account: {
      accountId: params.accountId,
      platformAccountId: channelId,
      accountName: ch.snippet?.title ?? params.accountName,
      username: ch.snippet?.customUrl,
      avatarUrl: ch.snippet?.thumbnails?.default?.url,
      profileUrl: `https://www.youtube.com/channel/${channelId}`,
      accountType: "channel",
    },
    metrics,
    support: {
      following: false,
      views: true,
      likes: true,
      comments: true,
      shares: false,
      engagementRate: true,
    },
    content,
    unavailable: ["Shares (not exposed by the YouTube Data API)"],
    fetchedAt: new Date().toISOString(),
  };
}
