/**
 * Legal Documents routes — mounted at /api/v2/legal
 *
 * GET  /api/v2/legal/:docType/active       — active version for a docType (all authenticated)
 * GET  /api/v2/legal/:docType/versions     — all versions for a docType (admin only)
 * POST /api/v2/legal                       — create new version (admin only)
 *                                            setting active:true atomically deactivates prior
 */

import { Router } from "express";
import { z } from "zod";
import { requireAdminOrSupervisor } from "../../middleware/authV2";
import { legalDocumentsService } from "../../services/legalDocumentsService";

const router = Router();

const createSchema = z.object({
  docType:       z.string().min(1).max(50),
  version:       z.string().min(1).max(20),
  bodyMd:        z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
  active:        z.boolean().optional().default(false),
});

// GET /api/v2/legal/:docType/active — public to all authenticated users
router.get("/:docType/active", async (req, res) => {
  try {
    const doc = await legalDocumentsService.getActive(req.params.docType);
    if (!doc) {
      return res.status(404).json({ error: `No active document for type '${req.params.docType}'` });
    }
    return res.json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/legal/:docType/versions — admin/supervisor only
router.get("/:docType/versions", requireAdminOrSupervisor, async (req, res) => {
  try {
    const docs = await legalDocumentsService.listVersions(req.params.docType);
    return res.json(docs);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/legal — admin/supervisor only
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const doc = await legalDocumentsService.create(parsed.data);
    return res.status(201).json(doc);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
