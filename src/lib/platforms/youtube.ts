import type { PlatformStats } from "@/lib/types";

/**
 * YouTube Data API v3 integration (server-side only).
 *
 * Uses a plain API key. The channel may be supplied as a channel ID (`UC...`),
 * a legacy username, or an `@handle`.
 */

const API_BASE = "https://www.googleapis.com/youtube/v3";

interface YouTubeChannelItem {
  id: string;
  snippet?: { title?: string };
  statistics?: {
    subscriberCount?: string;
    viewCount?: string;
    videoCount?: string;
    hiddenSubscriberCount?: boolean;
  };
}

interface YouTubeListResponse {
  items?: YouTubeChannelItem[];
  error?: { message?: string; code?: number };
}

export function isYouTubeConfigured(): boolean {
  return Boolean(process.env.YOUTUBE_API_KEY && process.env.YOUTUBE_CHANNEL_ID);
}

/** Resolves channel identifiers (handle/username/ID) to a channel resource. */
async function resolveChannel(
  channelRef: string,
  apiKey: string
): Promise<YouTubeChannelItem | undefined> {
  const parts = "statistics,snippet";
  let url: string;

  if (channelRef.startsWith("@")) {
    url = `${API_BASE}/channels?part=${parts}&forHandle=${encodeURIComponent(channelRef)}&key=${apiKey}`;
  } else if (channelRef.startsWith("UC")) {
    url = `${API_BASE}/channels?part=${parts}&id=${encodeURIComponent(channelRef)}&key=${apiKey}`;
  } else {
    url = `${API_BASE}/channels?part=${parts}&forUsername=${encodeURIComponent(channelRef)}&key=${apiKey}`;
  }

  const res = await fetch(url, { cache: "no-store" });
  const json = (await res.json()) as YouTubeListResponse;

  if (!res.ok) {
    throw new Error(json.error?.message || `YouTube API error (${res.status})`);
  }
  return json.items?.[0];
}

export async function fetchYouTube(): Promise<PlatformStats> {
  const apiKey = process.env.YOUTUBE_API_KEY;
  const channelRef = process.env.YOUTUBE_CHANNEL_ID;
  const now = new Date().toISOString();

  if (!apiKey || !channelRef) {
    return {
      platform: "youtube",
      followers: 0,
      status: "error",
      error: "YouTube is not configured (missing YOUTUBE_API_KEY / YOUTUBE_CHANNEL_ID)",
      updatedAt: now,
    };
  }

  try {
    const channel = await resolveChannel(channelRef, apiKey);
    if (!channel) {
      throw new Error(`YouTube channel "${channelRef}" was not found`);
    }

    const stats = channel.statistics ?? {};
    const followers = Number(stats.subscriberCount ?? 0);

    return {
      platform: "youtube",
      followers,
      views: stats.viewCount ? Number(stats.viewCount) : undefined,
      posts: stats.videoCount ? Number(stats.videoCount) : undefined,
      status: "online",
      updatedAt: now,
    };
  } catch (error) {
    return {
      platform: "youtube",
      followers: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown YouTube error",
      updatedAt: now,
    };
  }
}
