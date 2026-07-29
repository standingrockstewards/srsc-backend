/**
 * server/lib/vaultReveal.ts  (Brick 10Z)
 *
 * Crypto helpers for vault_secrets reveal flow.
 *
 * SECURITY RULES (hard — must not be changed without Chris's approval):
 *   1. DATA_VAULT_KEY must be present and exactly 32 bytes — fail closed if absent/malformed.
 *      VaultKeyError is thrown; callers return 503 and log outcome='key_missing'.
 *   2. decryptGCM uses AES-256-GCM with setAuthTag — any tamper to ciphertext/iv/authTag
 *      causes a thrown Error; callers return 500 and log outcome='decrypt_error'.
 *   3. Plaintext is NEVER passed to console.log, console.error, or any logger.
 *      Error messages must not contain the decrypted value.
 *   4. The key buffer is not exposed outside this module.
 *
 * Key encoding: DATA_VAULT_KEY is base64-encoded 32 bytes (44 chars).
 * Also accepts 64-char hex for operator convenience — same discipline as vaultService.ts.
 *
 * Column format in vault_secrets:
 *   ciphertext — hex-encoded AES-GCM ciphertext
 *   iv         — hex-encoded 12-byte IV
 *   auth_tag   — hex-encoded 16-byte GCM authentication tag
 *
 * These are stored as three separate columns (unlike the iv:tag:ct format in
 * vaultService.ts which uses a combined string).  decryptGCM accepts them
 * individually so the caller never has to construct the combined format.
 */

import * as crypto from "crypto";

// ── Typed errors ──────────────────────────────────────────────────────────────

/**
 * Thrown when DATA_VAULT_KEY is absent or the decoded value is not 32 bytes.
 * Callers catch this specifically to return 503 + log 'key_missing'.
 */
export class VaultKeyError extends Error {
  constructor(reason: string) {
    // Never include key material in the message
    super(`[vaultReveal] Key error: ${reason}`);
    this.name = "VaultKeyError";
  }
}

/**
 * Thrown when AES-GCM decryption fails (auth tag mismatch, corrupt ciphertext,
 * wrong IV length, etc.).  Callers catch this to return 500 + log 'decrypt_error'.
 */
export class VaultDecryptError extends Error {
  constructor() {
    // Deliberately opaque — no ciphertext or key material in message
    super("[vaultReveal] Decryption failed — auth tag mismatch or corrupt data.");
    this.name = "VaultDecryptError";
  }
}

// ── Key bootstrap ─────────────────────────────────────────────────────────────

const ALGO     = "aes-256-gcm" as const;
const IV_BYTES = 12;  // 96-bit IV for GCM

/**
 * Read DATA_VAULT_KEY from environment, decode to Buffer, assert 32 bytes.
 * Throws VaultKeyError (fail-closed) if:
 *   - env var is absent or empty
 *   - decoded buffer is not exactly 32 bytes
 *
 * Never logs the key or any portion of it.
 * Accepts 64-char hex OR base64 (44-char padded) — same as vaultService.ts.
 */
export function getVaultKey(): Buffer {
  const raw = process.env.DATA_VAULT_KEY;

  if (!raw || raw.trim().length === 0) {
    throw new VaultKeyError("DATA_VAULT_KEY is not set in the environment.");
  }

  let buf: Buffer;
  try {
    buf = raw.trim().length === 64
      ? Buffer.from(raw.trim(), "hex")
      : Buffer.from(raw.trim(), "base64");
  } catch {
    throw new VaultKeyError("DATA_VAULT_KEY could not be decoded (invalid hex/base64).");
  }

  if (buf.length !== 32) {
    throw new VaultKeyError(
      `DATA_VAULT_KEY decoded to ${buf.length} bytes; expected exactly 32.`,
    );
  }

  return buf;
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt an AES-256-GCM ciphertext stored in vault_secrets.
 *
 * @param ciphertext  hex-encoded ciphertext (from vault_secrets.ciphertext)
 * @param iv          hex-encoded 12-byte IV (from vault_secrets.iv)
 * @param authTag     hex-encoded 16-byte GCM auth tag (from vault_secrets.auth_tag)
 * @param key         Buffer returned by getVaultKey()
 * @returns           plaintext string
 *
 * Throws VaultDecryptError on any failure:
 *   - Invalid hex encoding
 *   - IV not 12 bytes
 *   - Auth tag mismatch (tamper detected by GCM)
 *   - Any other crypto error
 *
 * Plaintext is NEVER included in a thrown error message.
 */
export function decryptGCM(
  ciphertext: string,
  iv: string,
  authTag: string,
  key: Buffer,
): string {
  let ivBuf: Buffer;
  let tagBuf: Buffer;
  let ctBuf: Buffer;

  try {
    ivBuf  = Buffer.from(iv,         "hex");
    tagBuf = Buffer.from(authTag,    "hex");
    ctBuf  = Buffer.from(ciphertext, "hex");
  } catch {
    throw new VaultDecryptError();
  }

  if (ivBuf.length !== IV_BYTES) {
    // IV length mismatch — likely corrupted or wrong format; treat as decrypt error
    throw new VaultDecryptError();
  }

  try {
    const deciph = crypto.createDecipheriv(ALGO, key, ivBuf);
    deciph.setAuthTag(tagBuf);
    // GCM auth tag is verified on decipher.final() — mismatch throws here
    const plaintext = Buffer.concat([
      deciph.update(ctBuf),
      deciph.final(),
    ]).toString("utf8");
    // plaintext is returned to caller; NEVER logged here
    return plaintext;
  } catch {
    // Catches GCM auth tag failure and all other crypto errors.
    // Deliberately opaque — the caught error is not re-thrown or logged.
    throw new VaultDecryptError();
  }
}
