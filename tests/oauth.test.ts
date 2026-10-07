import { test } from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";

// Set a deterministic key before importing modules that read process.env.
process.env.TOKEN_ENCRYPTION_KEY = "test-secret-key-for-unit-tests-32chars";

const { encrypt, decrypt, isEncryptionAvailable } = await import(
  "../src/lib/oauth/crypto.ts"
);
const { createOAuthState, verifyOAuthState } = await import(
  "../src/lib/oauth/state.ts"
);

test("crypto: encrypt/decrypt round-trips and never returns plaintext", () => {
  assert.equal(isEncryptionAvailable(), true);
  const plaintext = JSON.stringify({ accessToken: "abc123", n: 42 });
  const enc = encrypt(plaintext);
  assert.ok(enc, "encrypt should return a value");
  assert.notEqual(enc, plaintext);
  assert.ok(!enc!.includes("abc123"), "ciphertext must not contain plaintext");
  assert.equal(decrypt(enc!), plaintext);
});

test("crypto: tampered ciphertext fails to decrypt (GCM auth)", () => {
  const enc = encrypt("sensitive")!;
  const tampered = enc.slice(0, -4) + "AAAA";
  assert.equal(decrypt(tampered), null);
});

test("oauth state: round-trips for the matching platform", () => {
  const state = createOAuthState("owner", "youtube");
  assert.equal(verifyOAuthState(state, "youtube"), "owner");
});

test("oauth state: rejects a mismatched platform", () => {
  const state = createOAuthState("owner", "youtube");
  assert.equal(verifyOAuthState(state, "tiktok"), null);
});

test("oauth state: rejects tampering and malformed input", () => {
  const state = createOAuthState("owner", "facebook");
  const parts = state.split(".");
  const tampered = [...parts.slice(0, 3), "deadbeef"].join(".");
  assert.equal(verifyOAuthState(tampered, "facebook"), null);
  assert.equal(verifyOAuthState(null, "facebook"), null);
  assert.equal(verifyOAuthState("garbage", "facebook"), null);
  assert.equal(verifyOAuthState("a.b.c", "facebook"), null);
});

test("oauth state: signature uses HMAC (not a plain suffix)", () => {
  const state = createOAuthState("owner", "tiktok");
  const [, , nonce, sig] = state.split(".");
  const expected = createHmac("sha256", process.env.TOKEN_ENCRYPTION_KEY!)
    .update(`owner.tiktok.${nonce}`)
    .digest("hex");
  assert.equal(sig, expected);
});
