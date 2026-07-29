/**
 * server/routes/v2/vault.ts  (Brick 10h)
 *
 * Sensitive field vault endpoints for properties.
 * Mounted under /api/v2/properties/:propertyId/vault
 *
 * Write:
 *   PUT /api/v2/properties/:propertyId/vault
 *     — admin/supervisor only
 *     — encrypts provided fields; sensitive_updated_at bumped
 *     — DATA_VAULT_KEY unset → 503, nothing stored
 *
 * Read (reveal):
 *   GET /api/v2/properties/:propertyId/vault
 *     — admin/supervisor: any property
 *     — field_tech: only properties where they have an assigned scheduled_visit
 *     — client: only their own property (customerId match)
 *     — vendor: 403
 *
 *   AUDIT-FIRST: vault_access_log insert MUST succeed before decrypted
 *   values are returned. If audit write fails → 503, no data returned.
 *   fields_read records exactly which fields were decrypted on the call.
 *
 * Sensitive fields are NEVER returned from list endpoints.
 * This is the ONLY route that returns decrypted values.
 *
 * DATA_VAULT_KEY fail-closed on BOTH read and write: 503 if unset.
 * Key never in render.yaml or committed files.
 */

import { Router, type Request, type Response } from "express";
import { eq, and } from "drizzle-orm";
import { db } from "../../db";
import { propertiesV2, scheduledVisits } from "../../../shared/schema-v2";
import { requireAuthV2 } from "../../middleware/authV2";
import {
  encryptFields,
  decryptFields,
  ALL_VAULT_FIELDS,
  type VaultFieldName,
} from "../../services/vaultService";
import { vaultAuditLogRepo } from "../../repositories/vaultAuditLog";

const router = Router({ mergeParams: true });
router.use(requireAuthV2);

// ── Internal: resolve property and check it exists ────────────────────────────
async function resolveProperty(propertyId: string) {
  const [row] = await db
    .select()
    .from(propertiesV2)
    .where(eq(propertiesV2.id, propertyId))
    .limit(1);
  return row ?? null;
}

// ── Internal: check tech has an assignment for this property ──────────────────
async function techHasAssignment(propertyId: string, techUserId: string): Promise<boolean> {
  const rows = await db
    .select({ id: scheduledVisits.id })
    .from(scheduledVisits)
    .where(
      and(
        eq(scheduledVisits.propertyId, propertyId),
        eq(scheduledVisits.assignedTechId, techUserId),
      ),
    )
    .limit(1);
  return rows.length > 0;
}

// ── Determine which _enc fields have data ────────────────────────────────────
const FIELD_TO_PROP: Record<VaultFieldName, keyof typeof propertiesV2.$inferSelect> = {
  alarmCode:   "alarmCodeEnc",
  gateCode:    "gateCodeEnc",
  accessNotes: "accessNotesEnc",
  keyLocation: "keyLocationEnc",
  address:     "addressEnc",
};

// ── PUT /api/v2/properties/:propertyId/vault ──────────────────────────────────
// Admin/supervisor write encrypted sensitive fields.
// DATA_VAULT_KEY unset → 503, nothing stored.
router.put("/", async (req: Request, res: Response) => {
  const role = req.v2Role ?? "";
  if (role !== "admin" && role !== "supervisor") {
    return res.status(403).json({ error: "Admin or supervisor role required." });
  }

  const propertyId = String(req.params["propertyId"]);
  const property   = await resolveProperty(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found." });

  // Pick only known vault field names from body
  const incoming: Partial<Record<VaultFieldName, string>> = {};
  for (const field of ALL_VAULT_FIELDS) {
    const val = (req.body as Record<string, unknown>)[field];
    if (typeof val === "string" && val.trim().length > 0) {
      incoming[field] = val.trim();
    }
  }

  if (Object.keys(incoming).length === 0) {
    return res.status(400).json({
      error: `At least one vault field required: ${ALL_VAULT_FIELDS.join(", ")}`,
    });
  }

  // Encrypt — fail closed if DATA_VAULT_KEY unset
  let encrypted: Partial<Record<VaultFieldName, string>>;
  try {
    encrypted = encryptFields(incoming);
  } catch (err: any) {
    if (err.message?.includes("DATA_VAULT_KEY")) {
      console.error("[vault/write] DATA_VAULT_KEY not configured.");
      return res.status(503).json({
        error: "Vault service unavailable — server configuration incomplete.",
      });
    }
    return res.status(500).json({ error: "Encryption failed." });
  }

  // Build DB update patch — map VaultFieldName → Drizzle column name
  const dbPatch: Record<string, string | Date> = {
    sensitiveUpdatedAt: new Date(),
  };
  if (encrypted.alarmCode   !== undefined) dbPatch["alarmCodeEnc"]   = encrypted.alarmCode;
  if (encrypted.gateCode    !== undefined) dbPatch["gateCodeEnc"]    = encrypted.gateCode;
  if (encrypted.accessNotes !== undefined) dbPatch["accessNotesEnc"] = encrypted.accessNotes;
  if (encrypted.keyLocation !== undefined) dbPatch["keyLocationEnc"] = encrypted.keyLocation;
  if (encrypted.address     !== undefined) dbPatch["addressEnc"]     = encrypted.address;

  await db
    .update(propertiesV2)
    .set(dbPatch as any)
    .where(eq(propertiesV2.id, propertyId));

  return res.json({
    ok: true,
    propertyId,
    fieldsUpdated: Object.keys(encrypted),
    sensitiveUpdatedAt: dbPatch["sensitiveUpdatedAt"],
  });
});

// ── GET /api/v2/properties/:propertyId/vault ──────────────────────────────────
// Reveal decrypted sensitive fields — strict gate + audit-first.
router.get("/", async (req: Request, res: Response) => {
  const role   = req.v2Role ?? "";
  const userId = req.v2UserId;

  // Vendor always blocked
  if (role === "vendor") {
    return res.status(403).json({ error: "Access denied." });
  }

  const propertyId = String(req.params["propertyId"]);
  const property   = await resolveProperty(propertyId);
  if (!property) return res.status(404).json({ error: "Property not found." });

  // ── Role gate ──────────────────────────────────────────────────────────────
  if (role === "client") {
    // Client may only see their own property
    if (property.customerId !== String(userId)) {
      // Exact customerId match — but note: customerId is Postgres text (cuid2),
      // userId is SQLite integer. We check the session customerId instead.
      // The client's customerId is stored in session via AuthContext.
      // Here we compare property.customerId against what the session owns.
      // We need the customerId from the session — stored as req.v2CustomerId (if set).
      // If not available via session, deny (safe default).
      if (!(req as any).v2CustomerId || property.customerId !== String((req as any).v2CustomerId)) {
        return res.status(403).json({ error: "Access denied — not your property." });
      }
    }
  } else if (role === "field_tech") {
    // Tech may only read vault for properties they have an assignment on
    const hasAssignment = await techHasAssignment(propertyId, String(userId));
    if (!hasAssignment) {
      return res.status(403).json({ error: "Access denied — no assignment for this property." });
    }
  }
  // admin / supervisor: no additional gate

  // ── Determine which fields have ciphertext ────────────────────────────────
  const toDecrypt: Partial<Record<VaultFieldName, string | null>> = {};
  const fieldsPresent: VaultFieldName[] = [];
  for (const field of ALL_VAULT_FIELDS) {
    const propKey = FIELD_TO_PROP[field];
    const stored  = (property as any)[propKey] as string | null | undefined;
    toDecrypt[field] = stored ?? null;
    if (stored) fieldsPresent.push(field);
  }

  // If no encrypted fields exist yet, return empty (still audit-log the access attempt)
  // We still log — the user revealed that no data exists.
  const ip = req.headers["x-forwarded-for"]?.toString().split(",")[0]?.trim()
    ?? req.socket?.remoteAddress
    ?? null;

  // ── AUDIT-FIRST: insert log entry BEFORE decrypting ──────────────────────
  // If audit insert fails → 503, no data returned. No unlogged reads ever.
  try {
    await vaultAuditLogRepo.append({
      propertyId,
      userId:    String(userId),
      userRole:  role,
      fieldsRead: fieldsPresent,
      ipAddress: ip,
    });
  } catch (auditErr) {
    console.error("[vault/read] Audit log insert failed:", auditErr);
    return res.status(503).json({
      error: "Vault audit log unavailable — decrypted values not returned. Try again.",
    });
  }

  // ── Decrypt — fail closed ─────────────────────────────────────────────────
  let decrypted: Partial<Record<VaultFieldName, string | null>>;
  try {
    decrypted = decryptFields(toDecrypt);
  } catch (err: any) {
    if (err.message?.includes("DATA_VAULT_KEY")) {
      console.error("[vault/read] DATA_VAULT_KEY not configured.");
      return res.status(503).json({
        error: "Vault service unavailable — server configuration incomplete.",
      });
    }
    // Auth tag mismatch or corrupt ciphertext
    console.error("[vault/read] Decryption failed (may indicate tampered data).");
    return res.status(500).json({ error: "Decryption failed." });
  }

  return res.json({
    propertyId,
    sensitiveUpdatedAt: property.sensitiveUpdatedAt ?? null,
    fields: decrypted,
  });
});

// ── GET /api/v2/properties/:propertyId/vault/audit ────────────────────────────
// Admin/supervisor only — view audit log for a property.
router.get("/audit", async (req: Request, res: Response) => {
  const role = req.v2Role ?? "";
  if (role !== "admin" && role !== "supervisor") {
    return res.status(403).json({ error: "Admin or supervisor role required." });
  }

  const propertyId = String(req.params["propertyId"]);
  const entries    = await vaultAuditLogRepo.getByProperty(propertyId);
  return res.json(entries);
});

export default router;
