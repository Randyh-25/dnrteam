import type {
  AccountIdentity,
  OAuthPlatform,
  TokenSet,
} from "@/lib/oauth/types";

/**
 * Provider adapter contract.
 *
 * Each social platform implements this interface so the generic OAuth routes
 * (`/api/auth/[platform]/*`) stay platform-agnostic. Adapters are server-only
 * and never expose secrets.
 */
export interface OAuthProvider {
  platform: OAuthPlatform;
  /** Human label used in error/status messages. */
  label: string;
  /** OAuth scopes requested from the provider. */
  scopes: string[];
  /** True when all required env vars are present. */
  isConfigured(): boolean;
  /** Reason the provider is unavailable (when not configured). */
  notConfiguredReason(): string;
  /** Builds the provider authorization URL (with state + PKCE if needed). */
  buildAuthUrl(params: {
    state: string;
    redirectUri: string;
    codeChallenge?: string;
  }): string;
  /** Exchanges an authorization code for tokens. */
  exchangeCode(params: {
    code: string;
    redirectUri: string;
    codeVerifier?: string;
  }): Promise<TokenSet>;
  /** Refreshes an access token using a stored refresh token. */
  refreshToken?(tokens: TokenSet): Promise<TokenSet>;
  /** Discovers the account(s) accessible with the given token. */
  discoverAccounts(tokens: TokenSet): Promise<AccountIdentity[]>;
}

/** URL-encodes form data the way OAuth token endpoints expect. */
export function formEncode(data: Record<string, string>): string {
  return new URLSearchParams(data).toString();
}

/** Normalises a provider error body into a readable message. */
export function providerError(status: number, body: unknown): string {
  if (body && typeof body === "object") {
    const obj = body as Record<string, unknown>;
    for (const key of ["error_description", "error_message", "message", "error"]) {
      const value = obj[key];
      if (typeof value === "string" && value) return value;
      if (value && typeof value === "object") {
        const nested = value as Record<string, unknown>;
        if (typeof nested.message === "string") return nested.message;
        if (typeof nested.error_user_msg === "string")
          return nested.error_user_msg as string;
      }
    }
  }
  return `Provider request failed (${status})`;
}

/** Creates an expiry epoch (ms) from an `expires_in` seconds value. */
export function expiryFromNow(expiresIn: number | undefined): number | null {
  if (!expiresIn || !Number.isFinite(expiresIn)) return null;
  return Date.now() + expiresIn * 1000;
}

/** Base64url encoding for PKCE verifiers/challenges. */
export function base64Url(input: Buffer): string {
  return input
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/, "");
}
