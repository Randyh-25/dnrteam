import { cookies } from "next/headers";
import { createHmac, timingSafeEqual } from "node:crypto";
import { createOAuthState, verifyOAuthState } from "@/lib/oauth/state";

/**
 * Owner / session identity and OAuth-state re-exports.
 *
 * The current project has no end-user authentication. Rather than invent a
 * heavyweight multi-user auth system, we use a clearly-defined, signed owner
 * cookie. Connected accounts are scoped by `ownerId`, so the data model already
 * supports multiple users: swapping this helper for a real auth provider later
 * requires no schema change.
 */

const OWNER_COOKIE = "gt_owner";

function ownerSecret(): string {
  return (
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    "gen-tyz-dev-secret"
  );
}

/** Signs a stable owner id with the server secret (HMAC-SHA256). */
function sign(ownerId: string): string {
  return createHmac("sha256", ownerSecret()).update(ownerId).digest("hex");
}

function isValid(ownerId: string, signature: string): boolean {
  const expected = sign(ownerId);
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Owner id used when a route must not depend on request cookies. */
export function getDefaultOwnerId(): string {
  return process.env.OWNER_ID || "owner";
}

/** Returns the current owner id from the signed cookie, or the default. */
export async function getOwnerId(): Promise<string> {
  const store = await cookies();
  const raw = store.get(OWNER_COOKIE)?.value;
  if (raw) {
    const [ownerId, signature] = raw.split(".");
    if (ownerId && signature && isValid(ownerId, signature)) return ownerId;
  }
  return getDefaultOwnerId();
}

/** Issues (or refreshes) the signed owner cookie from a route handler. */
export async function ensureOwnerCookie(): Promise<string> {
  const store = await cookies();
  const raw = store.get(OWNER_COOKIE)?.value;
  if (raw) {
    const [ownerId, signature] = raw.split(".");
    if (ownerId && signature && isValid(ownerId, signature)) return ownerId;
  }

  const ownerId = getDefaultOwnerId();
  store.set(OWNER_COOKIE, `${ownerId}.${sign(ownerId)}`, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 24 * 365,
  });
  return ownerId;
}

export { createOAuthState, verifyOAuthState };
