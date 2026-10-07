import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";
import { decrypt, encrypt, isEncryptionAvailable } from "@/lib/oauth/crypto";
import type {
  ConnectedAccount,
  ConnectedAccountPublic,
  OAuthPlatform,
  TokenSet,
} from "@/lib/oauth/types";

/**
 * Connected-account store (`connected_accounts` collection).
 *
 * Token documents live only server-side and are never returned to the client:
 * every read path here returns the {@link ConnectedAccountPublic} projection.
 * Token payloads are encrypted at rest when a key is configured.
 *
 * A deterministic document id (`{ownerId}__{platform}__{accountId}`) makes
 * reconnect operations idempotent.
 */

const COLLECTION = "connected_accounts";

interface StoredAccount extends Omit<ConnectedAccount, "tokenExpiresAt"> {
  tokenExpiresAt: number | null;
}

function docId(ownerId: string, platform: OAuthPlatform, accountId: string): string {
  return `${ownerId}__${platform}__${accountId}`;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

function toPublic(account: StoredAccount): ConnectedAccountPublic {
  return {
    id: account.id,
    platform: account.platform,
    platformAccountId: account.platformAccountId,
    accountName: account.accountName,
    username: account.username,
    avatarUrl: account.avatarUrl,
    profileUrl: account.profileUrl,
    accountType: account.accountType,
    scopes: account.scopes ?? [],
    tokenExpiresAt: account.tokenExpiresAt,
    status: account.status,
    lastSyncedAt: account.lastSyncedAt,
    lastError: account.lastError,
    createdAt: account.createdAt,
    updatedAt: account.updatedAt,
  };
}

/** All public connected accounts for an owner. */
export async function listAccounts(
  ownerId: string
): Promise<ConnectedAccountPublic[]> {
  const db = getDb();
  if (!db) return [];

  try {
    const snap = await db
      .collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .get();
    return snap.docs
      .map((d) => toPublic(d.data() as StoredAccount))
      .sort((a, b) => a.platform.localeCompare(b.platform));
  } catch {
    return [];
  }
}

/** A single public connected account, or `null`. */
export async function getAccount(
  ownerId: string,
  platform: OAuthPlatform
): Promise<ConnectedAccountPublic | null> {
  const full = await getAccountWithTokens(ownerId, platform);
  return full ? toPublic(full) : null;
}

/**
 * Server-only: full record including decrypted tokens.
 * NEVER return this to the client.
 */
export async function getAccountWithTokens(
  ownerId: string,
  platform: OAuthPlatform
): Promise<(StoredAccount & { tokens: TokenSet | null }) | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const snap = await db
      .collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .where("platform", "==", platform)
      .limit(1)
      .get();
    if (snap.empty) return null;

    const data = snap.docs[0].data() as StoredAccount;
    const tokens = data.encryptedTokens
      ? (JSON.parse(decrypt(data.encryptedTokens) || "null") as TokenSet | null)
      : null;
    return { ...data, tokens };
  } catch {
    return null;
  }
}

/** Creates or updates a connected account (idempotent on reconnect). */
export async function upsertAccount(params: {
  ownerId: string;
  platform: OAuthPlatform;
  platformAccountId: string;
  accountName: string;
  username?: string;
  avatarUrl?: string;
  profileUrl?: string;
  accountType?: string;
  extra?: Record<string, string>;
  tokens: TokenSet;
}): Promise<ConnectedAccountPublic | null> {
  const db = getDb();
  if (!db) return null;

  const encrypted = isEncryptionAvailable()
    ? encrypt(JSON.stringify(params.tokens))
    : // Refuse to store plaintext tokens if no key is configured.
      null;

  if (!encrypted) {
    throw new Error(
      "Token encryption is not configured (set TOKEN_ENCRYPTION_KEY)"
    );
  }

  const now = new Date().toISOString();
  const id = docId(params.ownerId, params.platform, params.platformAccountId);
  const ref = db.collection(COLLECTION).doc(id);

  const existing = await ref.get();
  const createdAt = existing.exists
    ? (existing.data()?.createdAt as string) || now
    : now;

  const record: StoredAccount = {
    id,
    ownerId: params.ownerId,
    platform: params.platform,
    platformAccountId: params.platformAccountId,
    accountName: params.accountName,
    username: params.username,
    avatarUrl: params.avatarUrl,
    profileUrl: params.profileUrl,
    accountType: params.accountType,
    extra: params.extra,
    encryptedTokens: encrypted,
    scopes: params.tokens.scopes,
    tokenExpiresAt: params.tokens.expiresAt,
    status: "connected",
    lastSyncedAt: existing.data()?.lastSyncedAt ?? null,
    lastError: undefined,
    createdAt,
    updatedAt: now,
  };

  await ref.set(record, { merge: true });
  return toPublic(record);
}

/** Updates token fields after a refresh. */
export async function updateTokens(
  ownerId: string,
  platform: OAuthPlatform,
  tokens: TokenSet
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const account = await getAccountWithTokens(ownerId, platform);
  if (!account) return;

  const encrypted = encrypt(JSON.stringify(tokens));
  if (!encrypted) return;

  await db
    .collection(COLLECTION)
    .doc(account.id)
    .set(
      {
        encryptedTokens: encrypted,
        tokenExpiresAt: tokens.expiresAt,
        scopes: tokens.scopes,
        status: "connected",
        lastError: undefined,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
}

/** Marks an account's sync status / error without touching tokens. */
export async function markAccountStatus(
  ownerId: string,
  platform: OAuthPlatform,
  status: ConnectedAccount["status"],
  options: { lastSyncedAt?: string; error?: string | null } = {}
): Promise<void> {
  const db = getDb();
  if (!db) return;
  const account = await getAccountWithTokens(ownerId, platform);
  if (!account) return;

  await db
    .collection(COLLECTION)
    .doc(account.id)
    .set(
      {
        status,
        lastSyncedAt: options.lastSyncedAt ?? account.lastSyncedAt ?? null,
        lastError: options.error ?? undefined,
        updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
}

/** Deletes a connected account (disconnect). */
export async function deleteAccount(
  ownerId: string,
  platform: OAuthPlatform
): Promise<boolean> {
  const db = getDb();
  if (!db) return false;

  try {
    const snap = await db
      .collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .where("platform", "==", platform)
      .get();
    if (snap.empty) return false;

    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
    return true;
  } catch {
    return false;
  }
}

export { toMillis };
