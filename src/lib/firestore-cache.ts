import { Timestamp } from "firebase-admin/firestore";
import { getDb } from "@/lib/firebase";
import {
  computeGrowth,
  dateKey,
  isFresh,
  percentChange,
} from "@/lib/cache-logic";
import type { PlatformKey, SnapshotDoc, PlatformStats } from "@/lib/types";

/**
 * Firestore cache + historical snapshot layer.
 *
 * Cache logic (see PLAN.md §5):
 *  1. Look up `cache/{platform}`.
 *  2. If it exists and `updatedAt` is < TTL old, return it immediately.
 *  3. Otherwise fetch fresh data upstream, then persist.
 *  4. Every fresh fetch is also merged into a daily `snapshots/*` document so
 *     the growth chart can be built over time.
 *
 * TTL defaults to 3 hours, overridable via `REVALIDATE_TIME` (seconds).
 */

export const CACHE_TTL_SECONDS = (() => {
  const parsed = Number(process.env.REVALIDATE_TIME);
  // Fall back to PLAN.md's 3-hour TTL when unset or invalid.
  return Number.isFinite(parsed) && parsed > 0 ? parsed : 3 * 60 * 60;
})();

const CACHE_COLLECTION = "cache";
const SNAPSHOT_COLLECTION = "snapshots";

interface CacheDocument {
  platform: PlatformKey;
  payload: PlatformStats;
  updatedAt: Timestamp | null;
  date: string;
}

function toMillis(value: unknown): number | null {
  if (value instanceof Timestamp) return value.toMillis();
  if (value instanceof Date) return value.getTime();
  if (typeof value === "number") return value;
  if (typeof value === "string") {
    const ms = Date.parse(value);
    return Number.isNaN(ms) ? null : ms;
  }
  return null;
}

export interface CachedResult {
  data: PlatformStats;
  updatedAt: string;
  ageMs: number;
}

/**
 * Reads a cached platform payload if it exists and is still fresh.
 * Returns `null` when the cache is missing, stale, or Firestore is disabled.
 */
export async function getCachedPlatform(
  platform: PlatformKey,
  ttlSeconds: number = CACHE_TTL_SECONDS
): Promise<CachedResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const snap = await db.collection(CACHE_COLLECTION).doc(platform).get();
    if (!snap.exists) return null;

    const doc = snap.data() as CacheDocument | undefined;
    const updatedMs = toMillis(doc?.updatedAt);
    if (!doc?.payload || updatedMs === null) return null;

    if (!isFresh(updatedMs, ttlSeconds)) return null;

    return {
      data: { ...doc.payload, cached: true },
      updatedAt: new Date(updatedMs).toISOString(),
      ageMs: Date.now() - updatedMs,
    };
  } catch {
    // A read failure should never break the dashboard; treat as a cache miss.
    return null;
  }
}

/** Returns the most recent cache entry regardless of age (for stale fallback). */
export async function getStalePlatform(
  platform: PlatformKey
): Promise<CachedResult | null> {
  const db = getDb();
  if (!db) return null;

  try {
    const snap = await db.collection(CACHE_COLLECTION).doc(platform).get();
    if (!snap.exists) return null;
    const doc = snap.data() as CacheDocument | undefined;
    const updatedMs = toMillis(doc?.updatedAt);
    if (!doc?.payload || updatedMs === null) return null;
    return {
      data: { ...doc.payload, cached: true },
      updatedAt: new Date(updatedMs).toISOString(),
      ageMs: Date.now() - updatedMs,
    };
  } catch {
    return null;
  }
}

/**
 * Persists a fresh platform payload to the cache and records/updates the
 * daily snapshot for historical charts.
 */
export async function setPlatform(
  platform: PlatformKey,
  payload: PlatformStats
): Promise<void> {
  const db = getDb();
  if (!db) return;

  const now = new Date();
  const cacheDoc: CacheDocument = {
    platform,
    payload: { ...payload, cached: false },
    updatedAt: Timestamp.fromDate(now),
    date: dateKey(now),
  };

  const snapshot: SnapshotDoc = {
    platform,
    date: dateKey(now),
    followers: payload.followers,
    views: payload.views ?? null,
    posts: payload.posts ?? null,
    engagementRate: payload.engagementRate ?? null,
    capturedAt: now.toISOString(),
  };

  try {
    const batch = db.batch();
    batch.set(db.collection(CACHE_COLLECTION).doc(platform), cacheDoc);
    // Merge so multiple refreshes in a day keep one row per day.
    batch.set(
      db.collection(SNAPSHOT_COLLECTION).doc(`${platform}_${snapshot.date}`),
      snapshot,
      { merge: true }
    );
    await batch.commit();
  } catch {
    // Persistence failures are non-fatal for the request.
  }
}

/** Deletes the cache doc so the next request forces a fresh upstream fetch. */
export async function invalidateCache(platform: PlatformKey): Promise<void> {
  const db = getDb();
  if (!db) return;
  try {
    await db.collection(CACHE_COLLECTION).doc(platform).delete();
  } catch {
    // ignore
  }
}

export async function invalidateAllCaches(
  platforms: PlatformKey[]
): Promise<void> {
  await Promise.allSettled(platforms.map((p) => invalidateCache(p)));
}

export interface RawSnapshot {
  platform: PlatformKey;
  date: string;
  followers: number;
}

/** Reads all snapshots for a platform within the last `days` days, newest last. */
export async function getSnapshots(
  platform: PlatformKey,
  days = 30
): Promise<RawSnapshot[]> {
  const db = getDb();
  if (!db) return [];

  const since = new Date();
  since.setUTCDate(since.getUTCDate() - days);

  try {
    const snap = await db
      .collection(SNAPSHOT_COLLECTION)
      .where("platform", "==", platform)
      .where("date", ">=", dateKey(since))
      .orderBy("date", "asc")
      .get();

    return snap.docs.map((d) => {
      const data = d.data() as SnapshotDoc;
      return {
        platform: data.platform,
        date: data.date,
        followers: data.followers ?? 0,
      };
    });
  } catch {
    return [];
  }
}

/** Computes a percent change between a value and a baseline. */
export { percentChange };

/**
 * Enriches a fresh payload with 24h / 7d growth derived from historical
 * snapshots. Safe to call even when Firestore is unavailable.
 */
export async function attachGrowth(
  payload: PlatformStats
): Promise<PlatformStats> {
  try {
    const history = await getSnapshots(payload.platform, 8);
    if (history.length === 0) return payload;

    const growth = computeGrowth(history, payload.followers);
    return { ...payload, ...growth };
  } catch {
    return payload;
  }
}
