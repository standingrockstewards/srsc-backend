/**
 * server/routes/v2/integrationSources.ts  (Brick 8)
 *
 * Mounted at /api/v2/integration-sources — Admin/Supervisor only.
 * Provider registry management: create, read, update, delete sources.
 */

import { Router } from "express";
import { integrationSourcesRepo } from "../../repositories/integrationSources";
import { insertIntegrationSourceSchema } from "../../../shared/schema-v2";
import { requireAdminOrSupervisor } from "../../middleware/authV2";

const router = Router();

// GET /api/v2/integration-sources[?provider=&propertyId=]
router.get("/", requireAdminOrSupervisor, async (req, res) => {
  try {
    const { provider, propertyId } = req.query;
    if (provider)    return res.json(await integrationSourcesRepo.listByProvider(provider as string));
    if (propertyId)  return res.json(await integrationSourcesRepo.listByProperty(propertyId as string));
    return res.json(await integrationSourcesRepo.getAll());
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/integration-sources/:id
router.get("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    const row = await integrationSourcesRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Integration source not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/integration-sources
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertIntegrationSourceSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await integrationSourcesRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// PATCH /api/v2/integration-sources/:id
router.patch("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  const parsed = insertIntegrationSourceSchema.partial().safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    const row = await integrationSourcesRepo.update(id, parsed.data);
    if (!row) return res.status(404).json({ error: "Integration source not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// DELETE /api/v2/integration-sources/:id
router.delete("/:id", requireAdminOrSupervisor, async (req, res) => {
  const { id } = req.params;
  try {
    await integrationSourcesRepo.delete(id);
    return res.status(204).send();
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
