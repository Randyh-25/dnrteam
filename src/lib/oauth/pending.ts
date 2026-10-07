import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";
import { decrypt, encrypt } from "@/lib/oauth/crypto";
import type { AccountIdentity, OAuthPlatform, TokenSet } from "@/lib/oauth/types";

/**
 * Short-lived "pending connection" store.
 *
 * When one authorization yields several account identities (e.g. a Meta user
 * with multiple Pages + an Instagram Business account), the callback cannot
 * pick one automatically. We persist the encrypted candidate list **and the
 * token bundle** here with a short TTL and hand the user a random `pendingId`
 * (in the redirect URL) to choose from. Everything sensitive is encrypted at
 * rest and never leaves the server.
 */

const COLLECTION = "oauth_pending";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface PendingConnection {
  id: string;
  ownerId: string;
  platform: OAuthPlatform;
  identities: AccountIdentity[];
  tokens: TokenSet;
  expiresAt: number;
}

interface PendingDoc {
  id: string;
  ownerId: string;
  platform: OAuthPlatform;
  identities: string; // encrypted
  tokens: string; // encrypted
  expiresAt: Timestamp | number;
  createdAt: string;
}

export async function createPendingConnection(params: {
  ownerId: string;
  platform: OAuthPlatform;
  identities: AccountIdentity[];
  tokens: TokenSet;
}): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const id = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
  const identities = encrypt(JSON.stringify(params.identities));
  const tokens = encrypt(JSON.stringify(params.tokens));
  if (!identities || !tokens) return null;

  const doc: PendingDoc = {
    id,
    ownerId: params.ownerId,
    platform: params.platform,
    identities,
    tokens,
    expiresAt: Date.now() + TTL_MS,
    createdAt: new Date().toISOString(),
  };
  await db.collection(COLLECTION).doc(id).set(doc);
  return id;
}

/** Reads pending identities, enforcing owner match and TTL. */
export async function readPendingConnection(
  id: string,
  ownerId: string
): Promise<PendingConnection | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const snap = await db.collection(COLLECTION).doc(id).get();
    if (!snap.exists) return null;
    const doc = snap.data() as PendingDoc;
    if (doc.ownerId !== ownerId) return null;

    const expiresAt =
      doc.expiresAt instanceof Timestamp
        ? doc.expiresAt.toMillis()
        : Number(doc.expiresAt);
    if (!Number.isFinite(expiresAt) || expiresAt < Date.now()) {
      await db.collection(COLLECTION).doc(id).delete().catch(() => {});
      return null;
    }

    const identities = JSON.parse(decrypt(doc.identities) || "null") as
      | AccountIdentity[]
      | null;
    const tokens = JSON.parse(decrypt(doc.tokens) || "null") as TokenSet | null;
    if (!identities || !tokens) return null;

    return {
      id,
      ownerId: doc.ownerId,
      platform: doc.platform,
      identities,
      tokens,
      expiresAt,
    };
  } catch {
    return null;
  }
}

export async function deletePendingConnection(id: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.collection(COLLECTION).doc(id).delete().catch(() => {});
}
