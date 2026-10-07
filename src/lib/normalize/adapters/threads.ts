import type { TokenSet } from "@/lib/oauth/types";
import type {
  NormalizedContent,
  NormalizedMetrics,
  NormalizedPlatformDetail,
} from "@/lib/normalize/types";

/**
 * Threads normalization adapter (Threads Graph API v1.0).
 *
 * Profile: id, username, threads_biography, threads_profile_picture_url.
 * Posts: `/me/threads` with text, media, permalink, timestamp. Insights
 * (views/likes/replies) require `threads_manage_insights` + a professional
 * account; where unavailable the metric is `null`.
 */

const GRAPH = "https://graph.threads.net/v1.0";

interface ThreadsProfileResp {
  id?: string;
  username?: string;
  threads_biography?: string;
  threads_profile_picture_url?: string;
}

interface ThreadsPostsResp {
  data?: Array<{
    id: string;
    text?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
  }>;
}

async function threadsGet<T>(
  path: string,
  params: Record<string, string>,
  token: string
): Promise<T> {
  const url = new URL(`${GRAPH}/${path}`);
  for (const [k, v] of Object.entries(params)) url.searchParams.set(k, v);
  url.searchParams.set("access_token", token);
  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as T & { error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message || `Threads API error (${res.status})`);
  }
  return json;
}

export async function fetchThreadsDetail(params: {
  accountId: string;
  platformAccountId: string;
  accountName: string;
  tokens: TokenSet;
  limit?: number;
}): Promise<NormalizedPlatformDetail> {
  const token = params.tokens.accessToken;
  const limit = params.limit ?? 12;

  const profile = await threadsGet<ThreadsProfileResp>(
    "me",
    { fields: "id,username,threads_biography,threads_profile_picture_url" },
    token
  );

  const metrics: NormalizedMetrics = {
    followers: null,
    following: null,
    views: null,
    contentCount: null,
    likes: null,
    comments: null,
    shares: null,
    engagementRate: null,
  };

  // Profile insights (follower_count) require threads_manage_insights.
  try {
    const insights = await threadsGet<{
      data?: Array<{ name?: string; total_value?: { value?: number } }>;
    }>(
      "me/threads_insights",
      { metric: "followers_count" },
      token
    );
    const follower = insights.data?.find((d) => d.name === "followers_count");
    metrics.followers = follower?.total_value?.value ?? null;
  } catch {
    // Insights unavailable — leave followers null (never fabricated).
  }

  const posts = await threadsGet<ThreadsPostsResp>(
    "me/threads",
    {
      fields: "id,text,media_type,media_url,thumbnail_url,permalink,timestamp",
      limit: String(limit),
    },
    token
  );

  const content: NormalizedContent[] = (posts.data ?? []).map((p) => ({
    id: p.id,
    platform: "threads",
    accountId: params.accountId,
    contentType: p.media_type ?? "text",
    title: p.text?.slice(0, 80),
    caption: p.text,
    thumbnailUrl: p.thumbnail_url ?? p.media_url,
    publishedAt: p.timestamp ?? null,
    url: p.permalink,
    views: null,
    likes: null,
    comments: null,
    shares: null,
    engagementRate: null,
  }));

  return {
    platform: "threads",
    account: {
      accountId: params.accountId,
      platformAccountId: params.platformAccountId,
      accountName: profile.username
        ? `@${profile.username}`
        : params.accountName,
      username: profile.username,
      avatarUrl: profile.threads_profile_picture_url,
      profileUrl: profile.username
        ? `https://www.threads.net/@${profile.username}`
        : undefined,
      accountType: "threads",
    },
    metrics,
    support: {
      following: false,
      views: false,
      likes: false,
      comments: false,
      shares: false,
      engagementRate: false,
    },
    content,
    unavailable: [
      "Follower count requires the threads_manage_insights scope + a professional account",
      "Per-post likes/replies/views require the threads_manage_insights scope",
    ],
    fetchedAt: new Date().toISOString(),
  };
}
