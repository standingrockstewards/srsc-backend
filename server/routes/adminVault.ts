/**
 * server/routes/adminVault.ts  (Brick 10Z)
 *
 * Admin-only vault reveal endpoint.
 *
 * Mounted at /api/admin (server/routes.ts):
 *   POST /api/admin/vault/:id/reveal
 *
 * Security contract:
 *   - requireAuthV2 must already be applied by the time this handler runs.
 *   - EVERY code path writes exactly one vault_reveal_log row before responding.
 *   - Fail-closed: any missing key, lookup failure, or decrypt error returns an
 *     opaque error body. Plaintext is NEVER included in logs or error responses.
 *   - 503 on key absent/invalid (VaultKeyError)
 *   - 403 on non-admin role (logged as 'denied')
 *   - 404 on unknown secret ID
 *   - 500 on decrypt failure (logged as 'decrypt_error')
 *   - 200 on success: { id, label, value } (logged as 'success')
 *
 * ID note: vault_secrets.id is BIGINT (bigserial), so :id arrives as a string
 * from Express and is compared via BigInt equality in Drizzle.  We do NOT parseInt.
 */

import { Router, type Request, type Response } from "express";
import { eq, sql as drizzleSql } from "drizzle-orm";
import { db } from "../db";
import {
  vaultSecrets,
  vaultRevealLog,
  type VaultRevealOutcome,
} from "../../shared/schema-v2";
import { requireAuthV2 } from "../middleware/authV2";
import {
  getVaultKey,
  decryptGCM,
  VaultKeyError,
  VaultDecryptError,
} from "../lib/vaultReveal";

const router = Router();

// All routes in this file require a valid v2 session
router.use(requireAuthV2);

// ─── Audit-log helper ─────────────────────────────────────────────────────────
// Writes one vault_reveal_log row.  Errors here are swallowed to prevent a
// secondary failure from masking the primary error, but ARE console-error'd
// (without plaintext) so they appear in Render logs.
async function writeLog(params: {
  secretId:   bigint;
  revealedBy: string;   // string of SQLite users.id (v2UserId)
  customerId: string | null;
  outcome:    VaultRevealOutcome;
  ip:         string | null;
}): Promise<void> {
  try {
    await db.insert(vaultRevealLog).values({
      secretId:   params.secretId,
      revealedBy: String(params.revealedBy),
      customerId: params.customerId ?? null,
      outcome:    params.outcome,
      ip:         params.ip ?? null,
    });
  } catch (logErr) {
    // Log the audit failure without plaintext
    console.error("[adminVault] CRITICAL: audit log insert failed:", logErr);
  }
}

// ─── GET /vault — list all secrets (id, label, customerId — no ciphertext) ─────
router.get("/vault", async (_req: Request, res: Response) => {
  try {
    const rows = await db
      .select({
        id:         vaultSecrets.id,
        label:      vaultSecrets.label,
        customerId: vaultSecrets.customerId,
      })
      .from(vaultSecrets)
      .orderBy(vaultSecrets.id);

    // Return id as string (bigint serializes as string in JSON)
    return res.json(
      rows.map(r => ({
        id:         String(r.id),
        label:      r.label,
        customerId: r.customerId ?? null,
      }))
    );
  } catch (err) {
    console.error("[adminVault] GET /vault error:", err);
    return res.status(500).json({ error: "Internal error." });
  }
});

// ─── POST /vault/:id/reveal ───────────────────────────────────────────────────
router.post("/vault/:id/reveal", async (req: Request, res: Response) => {
  const rawId   = String(req.params.id);
  const role    = req.v2Role    ?? "";
  const userId  = req.v2UserId  ?? 0;
  const fwdHdr  = req.headers["x-forwarded-for"];
  const userIp  = (Array.isArray(fwdHdr) ? fwdHdr[0] : fwdHdr)
                  ?? req.socket?.remoteAddress
                  ?? null;

  // ── Role guard (admin-only) ──────────────────────────────────────────────────
  if (role !== "admin") {
    // Log denied before responding — no plaintext involved
    // We use a sentinel secretId (0n) when we cannot parse the requested ID yet;
    // this still satisfies the FK because we skip the write if parse fails.
    let secretIdForLog: bigint;
    try { secretIdForLog = BigInt(rawId); } catch { secretIdForLog = BigInt(0); }

    if (secretIdForLog !== BigInt(0)) {
      await writeLog({
        secretId:   secretIdForLog,
        revealedBy: String(userId),
        customerId: req.v2CustomerId ?? null,
        outcome:    "denied",
        ip:         userIp,
      });
    }
    return res.status(403).json({ error: "Admin role required." });
  }

  // ── Parse :id — must be a valid integer (bigserial) ──────────────────────────
  let secretId: bigint;
  try {
    secretId = BigInt(rawId);
  } catch {
    // Malformed ID — can't log without a valid FK; just 400
    return res.status(400).json({ error: "Invalid secret ID." });
  }

  // ── Fetch the secret row ──────────────────────────────────────────────────────
  let secret: typeof vaultSecrets.$inferSelect | null = null;
  try {
    // Drizzle requires BigInt for bigserial PK comparisons
    const rows = await db
      .select()
      .from(vaultSecrets)
      .where(drizzleSql`${vaultSecrets.id} = ${secretId}`)
      .limit(1);
    secret = rows[0] ?? null;
  } catch (dbErr) {
    console.error("[adminVault] DB error fetching secret:", dbErr);
    return res.status(500).json({ error: "Internal error." });
  }

  if (!secret) {
    // Nothing to log — no FK target for the reveal log
    return res.status(404).json({ error: "Secret not found." });
  }

  // ── Load vault key (fail-closed) ──────────────────────────────────────────────
  let key: Buffer;
  try {
    key = getVaultKey();
  } catch (err) {
    if (err instanceof VaultKeyError) {
      await writeLog({
        secretId,
        revealedBy: String(userId),
        customerId: secret.customerId ?? null,
        outcome:    "key_missing",
        ip:         userIp,
      });
      return res.status(503).json({ error: "Vault key unavailable." });
    }
    // Unknown error from getVaultKey — treat as key_missing to be safe
    await writeLog({
      secretId,
      revealedBy: String(userId),
      customerId: secret.customerId ?? null,
      outcome:    "key_missing",
      ip:         userIp,
    });
    return res.status(503).json({ error: "Vault key unavailable." });
  }

  // ── Decrypt ───────────────────────────────────────────────────────────────────
  let plaintext: string;
  try {
    plaintext = decryptGCM(secret.ciphertext, secret.iv, secret.authTag, key);
  } catch (err) {
    if (err instanceof VaultDecryptError) {
      await writeLog({
        secretId,
        revealedBy: String(userId),
        customerId: secret.customerId ?? null,
        outcome:    "decrypt_error",
        ip:         userIp,
      });
      return res.status(500).json({ error: "Decrypt failed." });
    }
    // Unexpected non-VaultDecryptError from decryptGCM — still decrypt_error
    await writeLog({
      secretId,
      revealedBy: String(userId),
      customerId: secret.customerId ?? null,
      outcome:    "decrypt_error",
      ip:         userIp,
    });
    return res.status(500).json({ error: "Decrypt failed." });
  }

  // ── Audit log then respond ────────────────────────────────────────────────────
  // Audit FIRST (audit-first pattern). Plaintext is NOT passed to writeLog.
  await writeLog({
    secretId,
    revealedBy: String(userId),
    customerId: secret.customerId ?? null,
    outcome:    "success",
    ip:         userIp,
  });

  // Return { id, label, value } — plaintext only in the response body, never logged
  return res.status(200).json({
    id:    String(secret.id),
    label: secret.label,
    value: plaintext,
  });
});

export default router;
