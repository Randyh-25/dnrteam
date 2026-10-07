import type { TokenSet } from "@/lib/oauth/types";
import type {
  NormalizedContent,
  NormalizedMetrics,
  NormalizedPlatformDetail,
} from "@/lib/normalize/types";

/**
 * Facebook Page normalization adapter (Graph API, Page access token).
 *
 * Insights/reach require `pages_read_engagement` and are only available for
 * the Page, not personal profiles. Post fields: `message`, `created_time`,
 * `permalink_url`, `shares`, `comments.summary`, `reactions.summary`.
 */

const GRAPH = "https://graph.facebook.com/v21.0";

interface FbPageResp {
  name?: string;
  username?: string;
  followers_count?: number;
  fan_count?: number;
  picture?: { data?: { url?: string } };
  link?: string;
}

interface FbPostsResp {
  data?: Array<{
    id: string;
    message?: string;
    created_time?: string;
    permalink_url?: string;
    full_picture?: string;
    shares?: { count?: number };
    comments?: { summary?: { total_count?: number } };
    reactions?: { summary?: { total_count?: number } };
  }>;
}

async function graphGet<T>(
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
    throw new Error(json.error?.message || `Graph API error (${res.status})`);
  }
  return json;
}

function engagement(
  likes: number | null,
  comments: number | null,
  shares: number | null,
  views: number | null
): number | null {
  const interactions = (likes ?? 0) + (comments ?? 0) + (shares ?? 0);
  if (views !== null && views > 0) {
    return Number(((interactions / views) * 100).toFixed(2));
  }
  // Without reach/impressions we cannot compute a rate.
  return null;
}

export async function fetchFacebookDetail(params: {
  accountId: string;
  platformAccountId: string;
  accountName: string;
  tokens: TokenSet;
  pageAccessToken?: string;
  limit?: number;
}): Promise<NormalizedPlatformDetail> {
  const token = params.pageAccessToken || params.tokens.accessToken;
  const pageId = params.platformAccountId;
  const limit = params.limit ?? 12;

  const page = await graphGet<FbPageResp>(
    pageId,
    { fields: "name,username,followers_count,fan_count,picture,link" },
    token
  );

  const metrics: NormalizedMetrics = {
    followers: page.followers_count ?? page.fan_count ?? null,
    following: null,
    views: null, // Page reach/impressions require insights + are limited
    contentCount: null,
    likes: null,
    comments: null,
    shares: null,
    engagementRate: null,
  };

  const posts = await graphGet<FbPostsResp>(
    `${pageId}/posts`,
    {
      fields:
        "id,message,created_time,permalink_url,full_picture,shares,comments.summary(true),reactions.summary(true)",
      limit: String(limit),
    },
    token
  );

  const content: NormalizedContent[] = (posts.data ?? []).map((post) => {
    const likes = post.reactions?.summary?.total_count ?? null;
    const comments = post.comments?.summary?.total_count ?? null;
    const shares = post.shares?.count ?? null;
    return {
      id: post.id,
      platform: "facebook",
      accountId: params.accountId,
      contentType: "post",
      title: post.message?.slice(0, 80),
      caption: post.message,
      thumbnailUrl: post.full_picture,
      publishedAt: post.created_time ?? null,
      url: post.permalink_url,
      views: null,
      likes,
      comments,
      shares,
      engagementRate: engagement(likes, comments, shares, null),
    };
  });

  return {
    platform: "facebook",
    account: {
      accountId: params.accountId,
      platformAccountId: pageId,
      accountName: page.name ?? params.accountName,
      username: page.username,
      avatarUrl: page.picture?.data?.url,
      profileUrl: page.link ?? `https://www.facebook.com/${pageId}`,
      accountType: "facebook_page",
    },
    metrics,
    support: {
      following: false,
      views: false,
      likes: true,
      comments: true,
      shares: true,
      engagementRate: false,
    },
    content,
    unavailable: [
      "Reach / impressions (requires Page Insights with pages_read_engagement)",
      "Engagement rate (needs reach to be meaningful)",
    ],
    fetchedAt: new Date().toISOString(),
  };
}

/* ------------------------------- Instagram ------------------------------- */

interface IgProfileResp {
  username?: string;
  followers_count?: number;
  follows_count?: number;
  media_count?: number;
  profile_picture_url?: string;
}

interface IgMediaResp {
  data?: Array<{
    id: string;
    caption?: string;
    media_type?: string;
    media_url?: string;
    thumbnail_url?: string;
    permalink?: string;
    timestamp?: string;
    like_count?: number;
    comments_count?: number;
  }>;
}

export async function fetchInstagramDetail(params: {
  accountId: string;
  platformAccountId: string;
  accountName: string;
  tokens: TokenSet;
  pageAccessToken?: string;
  limit?: number;
}): Promise<NormalizedPlatformDetail> {
  const token = params.pageAccessToken || params.tokens.accessToken;
  const igId = params.platformAccountId;
  const limit = params.limit ?? 12;

  const profile = await graphGet<IgProfileResp>(
    igId,
    { fields: "username,followers_count,follows_count,media_count,profile_picture_url" },
    token
  );

  const metrics: NormalizedMetrics = {
    followers: profile.followers_count ?? null,
    following: profile.follows_count ?? null,
    views: null,
    contentCount: profile.media_count ?? null,
    likes: null,
    comments: null,
    shares: null,
    engagementRate: null,
  };

  const media = await graphGet<IgMediaResp>(
    `${igId}/media`,
    {
      fields:
        "id,caption,media_type,media_url,thumbnail_url,permalink,timestamp,like_count,comments_count",
      limit: String(limit),
    },
    token
  );

  const content: NormalizedContent[] = (media.data ?? []).map((m) => {
    const likes = m.like_count ?? null;
    const comments = m.comments_count ?? null;
    return {
      id: m.id,
      platform: "instagram",
      accountId: params.accountId,
      contentType: m.media_type ?? "media",
      title: m.caption?.slice(0, 80),
      caption: m.caption,
      thumbnailUrl: m.thumbnail_url ?? m.media_url,
      publishedAt: m.timestamp ?? null,
      url: m.permalink,
      views: null,
      likes,
      comments,
      shares: null,
      engagementRate:
        likes !== null && metrics.followers
          ? Number((((likes + (comments ?? 0)) / metrics.followers) * 100).toFixed(2))
          : null,
    };
  });

  return {
    platform: "instagram",
    account: {
      accountId: params.accountId,
      platformAccountId: igId,
      accountName: profile.username ? `@${profile.username}` : params.accountName,
      username: profile.username,
      avatarUrl: profile.profile_picture_url,
      profileUrl: profile.username
        ? `https://www.instagram.com/${profile.username}`
        : undefined,
      accountType: "instagram_business",
    },
    metrics,
    support: {
      following: true,
      views: false,
      likes: true,
      comments: true,
      shares: false,
      engagementRate: true,
    },
    content,
    unavailable: [
      "Views / plays (not exposed for non-Reel media without insights)",
      "Shares (not exposed by the Instagram Graph API)",
      "Requires an Instagram professional (Business/Creator) account",
    ],
    fetchedAt: new Date().toISOString(),
  };
}
