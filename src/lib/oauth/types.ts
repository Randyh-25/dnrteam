import type { PlatformKey } from "@/lib/types";

/**
 * OAuth / Connected Account domain types.
 *
 * These types are shared between server and client. The *full* connected
 * account record (which contains tokens) is only ever read server-side; the
 * client only receives the `ConnectedAccountPublic` projection.
 */

export type OAuthPlatform = PlatformKey;

/** Normalised token bundle returned by every provider's exchange/refresh. */
export interface TokenSet {
  accessToken: string;
  refreshToken?: string;
  /** Absolute expiry (epoch ms) or `null` when the token does not expire. */
  expiresAt: number | null;
  scopes: string[];
  tokenType?: string;
}

/**
 * Identity of the platform account discovered after authorization. For Meta a
 * single authorization can yield several accounts, so discovery returns an
 * array and the user selects one.
 */
export interface AccountIdentity {
  platformAccountId: string;
  accountName: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
  /** e.g. "channel" | "page" | "instagram_business" | "threads" | "user". */
  accountType?: string;
  /** Provider-specific extras (page access token, ig id, etc.). */
  extra?: Record<string, string>;
}

export type ConnectionStatus = "connected" | "expired" | "error" | "revoked";

/** Full server-side record, including the encrypted token bundle. */
export interface ConnectedAccount {
  id: string;
  ownerId: string;
  platform: OAuthPlatform;
  platformAccountId: string;
  accountName: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
  accountType?: string;
  /** Provider-specific extras (e.g. Meta page access token/id). */
  extra?: Record<string, string>;
  /** AES-256-GCM encrypted JSON of {@link TokenSet}. Never sent to client. */
  encryptedTokens: string;
  scopes: string[];
  tokenExpiresAt: number | null;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

/** Client-safe projection — token fields are deliberately omitted. */
export interface ConnectedAccountPublic {
  id: string;
  platform: OAuthPlatform;
  platformAccountId: string;
  accountName: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
  accountType?: string;
  scopes: string[];
  tokenExpiresAt: number | null;
  status: ConnectionStatus;
  lastSyncedAt: string | null;
  lastError?: string;
  createdAt: string;
  updatedAt: string;
}

export type ProviderAvailability =
  | "ready"
  | "not_configured"
  | "requires_approval";

/** Whether a provider can run, surfaced to the UI so nothing is faked. */
export interface ProviderStatus {
  platform: OAuthPlatform;
  availability: ProviderAvailability;
  /** Human-readable explanation shown in the UI when not "ready". */
  note?: string;
}

export interface DisconnectResponse {
  ok: boolean;
  platform: OAuthPlatform;
}
