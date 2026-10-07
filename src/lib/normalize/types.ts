import type { PlatformKey } from "@/lib/types";

/**
 * Normalized content model.
 *
 * Every platform adapter maps its raw API response into this shape so the UI
 * (content tables, report, top-performing lists) never has to understand
 * provider-specific formats. Metrics that a provider does not expose are
 * `null` — the UI renders "N/A" rather than fabricating a value.
 */
export interface NormalizedContent {
  id: string;
  platform: PlatformKey;
  accountId: string;
  contentType: string;
  title?: string;
  caption?: string;
  thumbnailUrl?: string;
  publishedAt: string | null;
  url?: string;
  views: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  /** Engagement rate (%) computed when the provider gives enough data. */
  engagementRate: number | null;
}

/** Metrics the platform exposes at the account level for the detail KPIs. */
export interface NormalizedMetrics {
  followers: number | null;
  following: number | null;
  views: number | null;
  contentCount: number | null;
  likes: number | null;
  comments: number | null;
  shares: number | null;
  engagementRate: number | null;
}

/** Which keys are genuinely supported per platform (drives "N/A" vs hidden). */
export interface MetricSupport {
  following: boolean;
  views: boolean;
  likes: boolean;
  comments: boolean;
  shares: boolean;
  engagementRate: boolean;
}

export interface NormalizedAccount {
  accountId: string;
  platformAccountId: string;
  accountName: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
  accountType?: string;
}

/** Full normalized payload for the platform detail page. */
export interface NormalizedPlatformDetail {
  platform: PlatformKey;
  account: NormalizedAccount;
  metrics: NormalizedMetrics;
  support: MetricSupport;
  content: NormalizedContent[];
  /** Provider metrics that are unavailable and why (surfaced in the UI). */
  unavailable: string[];
  fetchedAt: string;
}
