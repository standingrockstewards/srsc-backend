import { Router } from "express";
import { z } from "zod";
import { legalDocumentsRepo } from "../../repositories/legalDocuments";

const router = Router();

const createSchema = z.object({
  docType:       z.string().min(1),
  version:       z.string().min(1),
  bodyMd:        z.string().min(1),
  effectiveDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "effectiveDate must be YYYY-MM-DD"),
  active:        z.boolean().optional(),
});

// GET /api/v2/legal-documents — all documents
router.get("/", async (_req, res) => {
  try {
    return res.json(await legalDocumentsRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/legal-documents/active/:docType — currently active doc for a type
router.get("/active/:docType", async (req, res) => {
  try {
    const row = await legalDocumentsRepo.getActiveByType(req.params.docType);
    if (!row) return res.status(404).json({ error: `No active document for type '${req.params.docType}'` });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/legal-documents/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await legalDocumentsRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Document not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/legal-documents — create new version (admin)
router.post("/", async (req, res) => {
  const parsed = createSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await legalDocumentsRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/legal-documents/:id/active — toggle active flag only
router.patch("/:id/active", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  const parsed = z.object({ active: z.boolean() }).safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await legalDocumentsRepo.setActive(id, parsed.data.active);
    if (!row) return res.status(404).json({ error: "Document not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
