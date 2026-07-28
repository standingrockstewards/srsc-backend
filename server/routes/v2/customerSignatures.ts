/**
 * Signatures routes — mounted at /api/v2/signatures
 *
 * POST /api/v2/signatures                      — capture signature (owner or admin)
 * GET  /api/v2/signatures?customerId=N         — list customer's signatures (owner or admin)
 *
 * Ownership rules:
 *   - Client: may only POST/GET for their own customerId (req.v2CustomerId).
 *   - Admin/Supervisor: may POST/GET for any customerId.
 *   - Vendor: blocked (403).
 *   - Field Tech: blocked (no signature access).
 *
 * Server always injects ipAddress + userAgent — client must NOT send them.
 * Append-only: no PUT / PATCH / DELETE routes exist.
 */

import { Router } from "express";
import { z } from "zod";
import { requireNotVendor } from "../../middleware/authV2";
import { signaturesService } from "../../services/signaturesService";

const router = Router();

// Block vendors from all signature routes
router.use(requireNotVendor);

const captureSchema = z.object({
  customerId:      z.number().int().positive(),
  legalDocumentId: z.string().min(1),
  signatureSvg:    z.string().min(1),
  signedDocument:  z.string().min(1).max(100),
});

// ── Ownership helper ──────────────────────────────────────────────────────────
function canAccessCustomer(req: any, customerId: number): boolean {
  if (req.v2Role === "admin" || req.v2Role === "supervisor") return true;
  return req.v2CustomerId === customerId;
}

// POST /api/v2/signatures
router.post("/", async (req, res) => {
  const parsed = captureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });

  if (!canAccessCustomer(req, parsed.data.customerId)) {
    return res.status(403).json({ error: "Forbidden — you may only sign on behalf of yourself" });
  }

  try {
    const sig = await signaturesService.capture(parsed.data, req);
    return res.status(201).json(sig);
  } catch (err: any) {
    const status = err.status ?? 500;
    return res.status(status).json({ error: err.message });
  }
});

// GET /api/v2/signatures?customerId=N
router.get("/", async (req, res) => {
  const rawId = req.query.customerId;
  if (!rawId) return res.status(400).json({ error: "customerId query param required" });

  const customerId = parseInt(rawId as string);
  if (isNaN(customerId)) return res.status(400).json({ error: "Invalid customerId" });

  if (!canAccessCustomer(req, customerId)) {
    return res.status(403).json({ error: "Forbidden — you may only view your own signatures" });
  }

  try {
    const sigs = await signaturesService.listByCustomer(customerId);
    return res.json(sigs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
