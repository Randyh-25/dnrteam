import {
  createCipheriv,
  createDecipheriv,
  createHash,
  randomBytes,
} from "node:crypto";

/**
 * Symmetric encryption for OAuth tokens at rest (AES-256-GCM).
 *
 * The key is derived from `TOKEN_ENCRYPTION_KEY`. If that is not set we fall
 * back to a key derived from the Firebase private key so that a deployed
 * environment with Firebase configured still encrypts at rest. The ciphertext
 * format is `iv:authTag:ciphertext` (all base64).
 *
 * Tokens never leave the server, but encrypting at rest limits the blast
 * radius if Firestore documents are ever exposed.
 */

const ALGORITHM = "aes-256-gcm";
const IV_BYTES = 12;

let cachedKey: Buffer | null = null;

function deriveKey(): Buffer | null {
  if (cachedKey) return cachedKey;

  const secret =
    process.env.TOKEN_ENCRYPTION_KEY ||
    process.env.FIREBASE_PRIVATE_KEY ||
    process.env.FIREBASE_CLIENT_EMAIL;

  if (!secret) return null;
  // SHA-256 → exactly 32 bytes for AES-256.
  cachedKey = createHash("sha256").update(secret).digest();
  return cachedKey;
}

/** True when a key is available for encryption/decryption. */
export function isEncryptionAvailable(): boolean {
  return deriveKey() !== null;
}

/** Encrypts a UTF-8 string. Returns `null` when no key is configured. */
export function encrypt(plaintext: string): string | null {
  const key = deriveKey();
  if (!key) return null;

  const iv = randomBytes(IV_BYTES);
  const cipher = createCipheriv(ALGORITHM, key, iv);
  const encrypted = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ]);
  const authTag = cipher.getAuthTag();
  return `${iv.toString("base64")}:${authTag.toString("base64")}:${encrypted.toString("base64")}`;
}

/** Decrypts a value produced by {@link encrypt}. Returns `null` on failure. */
export function decrypt(payload: string): string | null {
  const key = deriveKey();
  if (!key) return null;

  try {
    const [ivB64, tagB64, dataB64] = payload.split(":");
    if (!ivB64 || !tagB64 || !dataB64) return null;

    const decipher = createDecipheriv(
      ALGORITHM,
      key,
      Buffer.from(ivB64, "base64")
    );
    decipher.setAuthTag(Buffer.from(tagB64, "base64"));
    const decrypted = Buffer.concat([
      decipher.update(Buffer.from(dataB64, "base64")),
      decipher.final(),
    ]);
    return decrypted.toString("utf8");
  } catch {
    return null;
  }
}
