import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * OAuth `state` (CSRF) helpers — pure Node crypto, no Next.js imports, so they
 * are unit-testable and reusable. A state value binds a pending OAuth flow to
 * an owner and a platform, and is HMAC-signed to prevent tampering.
 */

function stateSecret(): string {
  return (
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    "gen-tyz-oauth-state-secret"
  );
}

export function createOAuthState(ownerId: string, platform: string): string {
  const nonce = randomBytes(16).toString("hex");
  const payload = `${ownerId}.${platform}.${nonce}`;
  const signature = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");
  return `${payload}.${signature}`;
}

/** Validates an OAuth state value. Returns the owner id or `null`. */
export function verifyOAuthState(
  state: string | null,
  platform: string
): string | null {
  if (!state) return null;
  const parts = state.split(".");
  if (parts.length !== 4) return null;
  const [ownerId, statePlatform, nonce, signature] = parts;
  if (statePlatform !== platform) return null;

  const payload = `${ownerId}.${statePlatform}.${nonce}`;
  const expected = createHmac("sha256", stateSecret())
    .update(payload)
    .digest("hex");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return null;
  return timingSafeEqual(a, b) ? ownerId : null;
}
