/**
 * server/services/vaultService.ts  (Brick 10h)
 *
 * AES-256-GCM encryption/decryption for sensitive property data at rest.
 *
 * SECURITY RULES (hard):
 *   1. DATA_VAULT_KEY must be set — fail closed on BOTH encrypt AND decrypt.
 *      If unset or invalid: throw, caller returns 503, nothing is stored or returned.
 *   2. Ciphertext format: `iv:authTag:ciphertext` (all hex) — same as totpService.
 *   3. Key never in render.yaml or committed files.
 *      .env.example has a placeholder comment only.
 *   4. This service never logs key material, plaintext, or ciphertext.
 *
 * Named fields that can be encrypted/decrypted:
 *   alarmCode | gateCode | accessNotes | keyLocation | address
 *
 * These correspond 1-to-1 with the _enc columns in the properties table.
 */

import * as crypto from "crypto";

const ALGO      = "aes-256-gcm" as const;
const IV_BYTES  = 12;  // 96-bit IV for GCM

// ── Key bootstrap ─────────────────────────────────────────────────────────────
// Fail closed on both encrypt and decrypt — identical discipline to totpService.

function getVaultKey(): Buffer {
  const raw = process.env.DATA_VAULT_KEY;
  if (!raw) {
    throw new Error(
      "[vaultService] DATA_VAULT_KEY is not set. " +
      "Generate with: node -e \"console.log(require('crypto').randomBytes(32).toString('hex'))\" " +
      "Set as an environment variable on Render. Never commit it."
    );
  }
  const buf = raw.length === 64
    ? Buffer.from(raw, "hex")
    : Buffer.from(raw, "base64");
  if (buf.length !== 32) {
    throw new Error("[vaultService] DATA_VAULT_KEY must be 32 bytes (64-char hex or 44-char base64).");
  }
  return buf;
}

// ── Encrypt ───────────────────────────────────────────────────────────────────

/**
 * Encrypt a plaintext field value.
 * Returns `iv:authTag:ciphertext` (hex) for storage in _enc column.
 * Throws (fail-closed) if DATA_VAULT_KEY is unset or malformed.
 */
export function encryptField(plaintext: string): string {
  const key  = getVaultKey();
  const iv   = crypto.randomBytes(IV_BYTES);
  const ciph = crypto.createCipheriv(ALGO, key, iv);
  const enc  = Buffer.concat([ciph.update(plaintext, "utf8"), ciph.final()]);
  const tag  = ciph.getAuthTag();
  return `${iv.toString("hex")}:${tag.toString("hex")}:${enc.toString("hex")}`;
}

// ── Decrypt ───────────────────────────────────────────────────────────────────

/**
 * Decrypt a value produced by encryptField.
 * Throws (fail-closed) if DATA_VAULT_KEY is unset/malformed, or if the
 * ciphertext is corrupt / tampered (auth tag mismatch).
 * Never leaks ciphertext or plaintext in error messages.
 */
export function decryptField(stored: string): string {
  const key   = getVaultKey();
  const parts = stored.split(":");
  if (parts.length !== 3) {
    throw new Error("[vaultService] Malformed ciphertext — not in iv:tag:ct format.");
  }
  const [ivHex, tagHex, ctHex] = parts;
  const iv         = Buffer.from(ivHex,  "hex");
  const tag        = Buffer.from(tagHex, "hex");
  const ciphertext = Buffer.from(ctHex,  "hex");
  const deciph     = crypto.createDecipheriv(ALGO, key, iv);
  deciph.setAuthTag(tag);
  return Buffer.concat([deciph.update(ciphertext), deciph.final()]).toString("utf8");
}

// ── Named field helpers ───────────────────────────────────────────────────────

export type VaultFieldName = "alarmCode" | "gateCode" | "accessNotes" | "keyLocation" | "address";

/** Map from logical field name → properties table column name */
export const VAULT_FIELD_TO_COLUMN: Record<VaultFieldName, string> = {
  alarmCode:    "alarm_code_enc",
  gateCode:     "gate_code_enc",
  accessNotes:  "access_notes_enc",
  keyLocation:  "key_location_enc",
  address:      "address_enc",
};

/** All vault field names — used for input validation */
export const ALL_VAULT_FIELDS: VaultFieldName[] = [
  "alarmCode", "gateCode", "accessNotes", "keyLocation", "address",
];

/**
 * Encrypt a map of { fieldName → plaintext } and return { fieldName → ciphertext }.
 * Throws fail-closed if key is missing (caller returns 503).
 */
export function encryptFields(
  fields: Partial<Record<VaultFieldName, string>>,
): Partial<Record<VaultFieldName, string>> {
  const result: Partial<Record<VaultFieldName, string>> = {};
  for (const [field, value] of Object.entries(fields) as [VaultFieldName, string][]) {
    if (value !== undefined && value !== null) {
      result[field] = encryptField(value);
    }
  }
  return result;
}

/**
 * Decrypt a map of { fieldName → ciphertext | null } and return { fieldName → plaintext | null }.
 * Throws fail-closed if key is missing (caller returns 503).
 * Returns null for fields with no ciphertext stored.
 */
export function decryptFields(
  fields: Partial<Record<VaultFieldName, string | null>>,
): Partial<Record<VaultFieldName, string | null>> {
  const result: Partial<Record<VaultFieldName, string | null>> = {};
  for (const [field, value] of Object.entries(fields) as [VaultFieldName, string | null][]) {
    if (value === null || value === undefined) {
      result[field] = null;
    } else {
      result[field] = decryptField(value);
    }
  }
  return result;
}
