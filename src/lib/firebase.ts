import {
  initializeApp,
  getApps,
  cert,
  type ServiceAccount,
} from "firebase-admin/app";
import { getFirestore, type Firestore } from "firebase-admin/firestore";

/**
 * Firebase Admin initialization.
 *
 * The dashboard must still render (with clear per-platform error badges) when
 * Firebase credentials are missing or invalid, so initialization is lazy and
 * failure-tolerant: callers get `null` and fall back to a no-cache mode.
 */

let db: Firestore | null = null;
let initialized = false;
let lastError: string | null = null;

function buildServiceAccount(): ServiceAccount | null {
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  // Vercel / .env stores newlines escaped as literal "\n".
  const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n");

  if (!projectId || !clientEmail || !privateKey) return null;
  return { projectId, clientEmail, privateKey };
}

/** Returns the Firestore instance, or `null` when unavailable. */
export function getDb(): Firestore | null {
  if (initialized) return db;
  initialized = true;

  const serviceAccount = buildServiceAccount();
  if (!serviceAccount) {
    lastError = "Firebase credentials are not configured";
    return null;
  }

  try {
    if (!getApps().length) {
      initializeApp({ credential: cert(serviceAccount) });
    }
    db = getFirestore();
    // Platform payloads contain optional fields (e.g. change24h, views) that
    // may be undefined. Firestore rejects undefined by default, which would
    // silently drop cache writes — so ignore them. This must run before the
    // first query; guard it so a re-used instance (HMR) doesn't throw.
    try {
      db.settings({ ignoreUndefinedProperties: true });
    } catch {
      // Settings already applied to this instance — safe to ignore.
    }
    return db;
  } catch (error) {
    lastError =
      error instanceof Error ? error.message : "Failed to initialize Firebase";
    db = null;
    return null;
  }
}

/** True when Firebase credentials are present and initialization succeeded. */
export function isFirestoreEnabled(): boolean {
  return getDb() !== null;
}

/** Last initialization error, for diagnostics in API responses. */
export function getFirestoreError(): string | null {
  getDb();
  return lastError;
}

export { db };
