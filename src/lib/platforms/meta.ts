import type { PlatformStats } from "@/lib/types";

/**
 * Meta Graph API integration for Facebook Pages, Instagram Business accounts,
 * and Threads (Threads uses its own `graph.threads.net` host).
 *
 * All calls use a long-lived access token and run server-side only.
 */

const GRAPH_BASE = "https://graph.facebook.com/v21.0";
const THREADS_BASE = "https://graph.threads.net/v1.0";

interface GraphError {
  error?: { message?: string; type?: string; code?: number };
}

async function graphGet<T extends object>(
  base: string,
  path: string,
  params: Record<string, string | undefined>
): Promise<T> {
  const url = new URL(`${base}/${path}`);
  for (const [key, value] of Object.entries(params)) {
    if (value) url.searchParams.set(key, value);
  }

  const res = await fetch(url.toString(), { cache: "no-store" });
  const json = (await res.json()) as T & GraphError;

  if (!res.ok || json.error) {
    throw new Error(
      json.error?.message || `Graph API error (${res.status})`
    );
  }
  return json;
}

const token = () => process.env.META_ACCESS_TOKEN;

export function isMetaConfigured(): boolean {
  return Boolean(token());
}

/* ------------------------------- Facebook ------------------------------- */

interface FbPage {
  followers_count?: number;
  fan_count?: number;
  name?: string;
}

export async function fetchFacebook(): Promise<PlatformStats> {
  const now = new Date().toISOString();
  const accessToken = token();
  const pageId = process.env.FB_PAGE_ID;

  if (!accessToken || !pageId) {
    return {
      platform: "facebook",
      followers: 0,
      status: "error",
      error: "Facebook is not configured (missing META_ACCESS_TOKEN / FB_PAGE_ID)",
      updatedAt: now,
    };
  }

  try {
    const page = await graphGet<FbPage>(GRAPH_BASE, pageId, {
      fields: "followers_count,fan_count,name",
      access_token: accessToken,
    });
    const followers = page.followers_count ?? page.fan_count ?? 0;
    return {
      platform: "facebook",
      followers,
      status: "online",
      updatedAt: now,
    };
  } catch (error) {
    return {
      platform: "facebook",
      followers: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown Facebook error",
      updatedAt: now,
    };
  }
}

/* ------------------------------ Instagram ------------------------------- */

interface IgUser {
  followers_count?: number;
  media_count?: number;
  username?: string;
}

export async function fetchInstagram(): Promise<PlatformStats> {
  const now = new Date().toISOString();
  const accessToken = token();
  const igUserId = process.env.IG_USER_ID;

  if (!accessToken || !igUserId) {
    return {
      platform: "instagram",
      followers: 0,
      status: "error",
      error: "Instagram is not configured (missing META_ACCESS_TOKEN / IG_USER_ID)",
      updatedAt: now,
    };
  }

  try {
    const user = await graphGet<IgUser>(GRAPH_BASE, igUserId, {
      fields: "followers_count,media_count,username",
      access_token: accessToken,
    });
    return {
      platform: "instagram",
      followers: user.followers_count ?? 0,
      posts: user.media_count,
      status: "online",
      updatedAt: now,
    };
  } catch (error) {
    return {
      platform: "instagram",
      followers: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown Instagram error",
      updatedAt: now,
    };
  }
}

/* -------------------------------- Threads ------------------------------- */

interface ThreadsUser {
  followers_count?: number;
  username?: string;
}

export async function fetchThreads(): Promise<PlatformStats> {
  const now = new Date().toISOString();
  const accessToken = token();
  const threadsUserId = process.env.THREADS_USER_ID;

  if (!accessToken || !threadsUserId) {
    return {
      platform: "threads",
      followers: 0,
      status: "error",
      error: "Threads is not configured (missing META_ACCESS_TOKEN / THREADS_USER_ID)",
      updatedAt: now,
    };
  }

  try {
    const user = await graphGet<ThreadsUser>(THREADS_BASE, threadsUserId, {
      fields: "followers_count,username",
      access_token: accessToken,
    });
    return {
      platform: "threads",
      followers: user.followers_count ?? 0,
      status: "online",
      updatedAt: now,
    };
  } catch (error) {
    return {
      platform: "threads",
      followers: 0,
      status: "error",
      error: error instanceof Error ? error.message : "Unknown Threads error",
      updatedAt: now,
    };
  }
}

export async function fetchMeta(): Promise<PlatformStats[]> {
  return Promise.all([fetchFacebook(), fetchInstagram(), fetchThreads()]);
}
