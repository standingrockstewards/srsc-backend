/**
 * server/services/totpService.ts  (Brick 10f)
 *
 * TOTP secret management for Google Authenticator / RFC 6238 compatible apps.
 *
 * SECURITY RULES (hard):
 *   1. TOTP_ENCRYPTION_KEY must be set — fail closed if absent (setup throws).
 *   2. Secrets are AES-256-GCM encrypted at rest in SQLite. Never stored plaintext.
 *   3. Backup codes: bcrypt-hashed, constant-time compare, single-use (removed on match).
 *   4. Code attempts are rate-limited by the route layer (see twoFactor.ts).
 *   5. This file NEVER logs secrets, raw codes, or backup code plaintext.
 *
 * otplib v13+ API (functional, async):
 *   - generateSecret()       — returns base32 secret string
 *   - generateURI({...})     — returns otpauth:// URI
 *   - verifySync({secret, token, epochTolerance}) — synchronous verify
 *
 * Libraries:
 *   - otplib   — RFC 6238 TOTP (window ±30s via epochTolerance)
 *   - qrcode   — generates data-URI PNG for QR display in setup flow
 *   - bcryptjs — backup code hashing (already a project dep)
 *   - crypto   — Node.js built-in AES-256-GCM
 */

import { generateSecret, generateURI, verifySync } from "otplib";
import * as QRCode from "qrcode";
import bcrypt from "bcryptjs";
import * as crypto from "crypto";

// ── Encryption key bootstrap ──────────────────────────────────────────────────
// The key MUST be set as an env var on Render/locally. Never committed.
// Key must be exactly 32 bytes (hex: 64 chars, or base64: 44 chars).
// If unset, fail closed at runtime — never store an unencrypted secret.

function getEncryptionKey(): Buffer {
  const raw = process.env.TOTP_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error(
      "[totpService] TOTP_ENCRYPTION_KEY is not set. " +
      "Generate one with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
      "and set it as an environment variable on Render. Never commit it."
    );
  }
  // Accept 64-char hex or 44-char base64
  const buf = raw.length === 64
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("[totpService] TOTP_ENCRYPTION_KEY must be 32 bytes (64-char hex or 44-char base64).");
  }
  return buf;
}

// ── AES-256-GCM encrypt / decrypt ────────────────────────────────────────────

const ALGO      = "aes-256-gcm" as const;
const IV_BYTES  = 12; // 96-bit IV for GCM
const TAG_BYTES = 16;
void TAG_BYTES; // used implicitly by decipher.setAuthTag

/**
 * Encrypt a plaintext string. Returns `iv:authTag:ciphertext` (all hex).
 * Fails closed if TOTP_ENCRYPTION_KEY is unset.
 */
export function encryptSecret(plaintext: string): string {
  const key  = getEncryptionKey();
  const iv   = crypto.randomBytes(IV_BYTES);
  const ciph = crypto.createCipheriv(ALGO, key, iv);
  const enc  = Buffer.concat([ciph.update(plaintext, "utf8"), ciph.final()]);
  const tag  = ciph.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

/**
 * Decrypt a value produced by encryptSecret.
 * Returns plaintext or throws on tamper / wrong key.
 */
export function decryptSecret(stored: string): string {
  const key    = getEncryptionKey();
  const parts  = stored.split(":");
  if (parts.length !== 3) throw new Error("[totpService] Invalid encrypted secret format.");
  const [ivHex, tagHex, ctHex] = parts;
  const iv         = Buffer.from(ivHex,  "hex");
  const tag        = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ctHex,  "hex");
  const deciph     = crypto.createDecipheriv(ALGO, key, iv);
  deciph.setAuthTag(tag);
  return Buffer.concat([deciph.update(ciphertext), deciph.final()]).toString("utf8");
}

// ── TOTP configuration ────────────────────────────────────────────────────────

const ISSUER      = "Standing Rock Stewardship";
// Allow ±1 step (30 s each) for clock skew
const EPOCH_TOL   = 30; // seconds

// ── Setup: generate secret + otpauth URI + QR data URI ───────────────────────

export interface SetupPayload {
  /** Base32 secret — shown once for manual entry. Never store this form. */
  secretBase32:     string;
  /** otpauth:// URI for QR code */
  otpauthUri:       string;
  /** PNG data URI (base64) — embed in <img src="..."> */
  qrDataUri:        string;
  /** AES-encrypted form — persist this to users.totp_secret */
  encryptedSecret:  string;
}

/**
 * Generate a new TOTP setup payload for a user.
 * Fails closed if TOTP_ENCRYPTION_KEY is not set.
 */
export async function generateTotpSetup(username: string): Promise<SetupPayload> {
  // generateSecret() from otplib v13 — returns base32 string directly
  const secretBase32 = generateSecret();
  const otpauthUri   = generateURI({
    issuer:  ISSUER,
    label:   username,
    secret:  secretBase32,
  });
  const qrDataUri      = await QRCode.toDataURL(otpauthUri, { width: 200, margin: 1 });
  const encryptedSecret = encryptSecret(secretBase32); // throws if key unset

  return { secretBase32, otpauthUri, qrDataUri, encryptedSecret };
}

// ── Verify: validate a TOTP code against a stored encrypted secret ────────────

/**
 * Returns true if the 6-digit code is valid (±1 window).
 * encryptedSecret is what is stored in users.totp_secret.
 */
export function verifyTotpCode(code: string, encryptedSecret: string): boolean {
  const secret = decryptSecret(encryptedSecret);
  const result = verifySync({ token: code, secret, epochTolerance: EPOCH_TOL });
  return result.valid;
}

// ── Backup codes: generate, hash, compare, consume ───────────────────────────

const BACKUP_CODE_COUNT = 8;
const BACKUP_CODE_BYTES = 5;  // 5 bytes → 10 hex chars, easy to type
const BCRYPT_ROUNDS     = 10;

export interface BackupCodeBundle {
  /** Plaintext codes — shown ONCE at generation. Never store these. */
  plaintext: string[];
  /** JSON string of bcrypt hashes — persist to users.totp_backup_codes */
  hashed:    string;
}

/** Format: XXXXX-XXXXX (5+5 hex chars separated by dash) */
function formatCode(raw: Buffer): string {
  const hex = raw.toString("hex").toUpperCase();
  return `${hex.slice(0, 5)}-${hex.slice(5)}`;
}

/**
 * Generate 8 single-use backup codes.
 * Returns plaintext (show once) + hashed JSON string (persist to DB).
 */
export async function generateBackupCodes(): Promise<BackupCodeBundle> {
  const plaintext: string[] = [];
  const hashes:    string[] = [];

  for (let i = 0; i < BACKUP_CODE_COUNT; i++) {
    const raw  = crypto.randomBytes(BACKUP_CODE_BYTES);
    const code = formatCode(raw);
    plaintext.push(code);
    // eslint-disable-next-line no-await-in-loop
    hashes.push(await bcrypt.hash(code, BCRYPT_ROUNDS));
  }

  return { plaintext, hashed: JSON.stringify(hashes) };
}

/**
 * Attempt to consume a backup code.
 * Constant-time: always checks ALL hashes to prevent timing oracle.
 * Returns { matched: true, remainingHashed } on success, { matched: false } on fail.
 *
 * Caller MUST persist remainingHashed back to users.totp_backup_codes.
 */
export async function consumeBackupCode(
  inputCode: string,
  hashedJson: string,
): Promise<{ matched: true; remainingHashed: string } | { matched: false }> {
  let hashes: string[];
  try {
    hashes = JSON.parse(hashedJson) as string[];
  } catch {
    return { matched: false };
  }
  if (!Array.isArray(hashes) || hashes.length === 0) {
    return { matched: false };
  }

  // Normalise input (strip dashes, upper-case) for flexible entry
  const normalised = inputCode.replace(/-/g, "").toUpperCase();
  // Re-format to canonical XXXXX-XXXXX for comparison
  const canonical  = normalised.length === 10
    ? `${normalised.slice(0, 5)}-${normalised.slice(5)}`
    : inputCode;

  let matchIndex = -1;
  // Check all hashes in constant time — no short-circuit on match
  const results = await Promise.all(hashes.map((h) => bcrypt.compare(canonical, h)));
  for (let i = 0; i < results.length; i++) {
    if (results[i] && matchIndex === -1) matchIndex = i;
  }

  if (matchIndex === -1) return { matched: false };

  // Remove the consumed code — single-use
  const remaining = hashes.filter((_, idx) => idx !== matchIndex);
  return { matched: true, remainingHashed: JSON.stringify(remaining) };
}
