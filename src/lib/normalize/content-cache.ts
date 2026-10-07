import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";
import { dateKey } from "@/lib/cache-logic";
import type { PlatformKey } from "@/lib/types";
import type { NormalizedPlatformDetail } from "@/lib/normalize/types";

/**
 * Content-level cache.
 *
 * Account detail payloads (profile + normalized content) change more often
 * than the aggregate stats, so they use a shorter TTL than the 3-hour stats
 * cache. Keyed by `ownerId + platform + accountId + day` so it never collides
 * across connected accounts and naturally rolls over daily.
 *
 * Stored in `content_cache/{ownerId}__{platform}__{accountId}__{date}`. The
 * normalized payload is compact (bounded to the requested content limit), so
 * we do not persist raw, oversized API responses.
 */

export const CONTENT_CACHE_TTL_SECONDS = (() => {
  const parsed = Number(process.env.CONTENT_REVALIDATE_TIME);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 60 * 60; // 1 hour
})();

const COLLECTION = "content_cache";

interface ContentCacheDoc {
  ownerId: string;
  platform: PlatformKey;
  platformAccountId: string;
  date: string;
  payload: NormalizedPlatformDetail;
  updatedAt: Timestamp | null;
}

function docId(
  ownerId: string,
  platform: PlatformKey,
  accountId: string,
  date: string
): string {
  return `${ownerId}__${platform}__${accountId}__${date}`;
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

/** Reads a fresh normalized detail payload, or `null`. */
export async function getCachedContent(
  ownerId: string,
  platform: PlatformKey,
  accountId: string
): Promise<NormalizedPlatformDetail | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const snap = await db
      .collection(COLLECTION)
      .doc(docId(ownerId, platform, accountId, dateKey()))
      .get();
    if (!snap.exists) return null;

    const doc = snap.data() as ContentCacheDoc | undefined;
    const updatedMs = toMillis(doc?.updatedAt);
    if (!doc?.payload || updatedMs === null) return null;
    if (Date.now() - updatedMs > CONTENT_CACHE_TTL_SECONDS * 1000) return null;

    return doc.payload;
  } catch {
    return null;
  }
}

/** Upserts a normalized detail payload for the current day. */
export async function setCachedContent(
  ownerId: string,
  platform: PlatformKey,
  accountId: string,
  payload: NormalizedPlatformDetail
): Promise<void> {
  const db = getDb();
  if (!db) return;

  try {
    const doc: ContentCacheDoc = {
      ownerId,
      platform,
      platformAccountId: accountId,
      date: dateKey(),
      payload,
      updatedAt: Timestamp.now(),
    };
    await db
      .collection(COLLECTION)
      .doc(docId(ownerId, platform, accountId, dateKey()))
      .set(doc, { merge: true });
  } catch {
    // Non-fatal — the response is still returned uncached.
  }
}

/** Clears all content-cache entries for one connected account. */
export async function invalidateContentCache(
  ownerId: string,
  platform: PlatformKey
): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    const snap = await db
      .collection(COLLECTION)
      .where("ownerId", "==", ownerId)
      .where("platform", "==", platform)
      .get();
    const batch = db.batch();
    snap.docs.forEach((d) => batch.delete(d.ref));
    await batch.commit();
  } catch {
    // ignore
  }
}
