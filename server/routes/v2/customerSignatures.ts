import { Router } from "express";
import { customerSignaturesRepo } from "../../repositories/customerSignatures";
import { insertCustomerSignatureSchema } from "../../../shared/schema-v2";

const router = Router();

// GET /api/v2/customer-signatures?customerId=N
router.get("/", async (req, res) => {
  const { customerId, signedDocument } = req.query;
  try {
    if (customerId) {
      const id = parseInt(customerId as string);
      if (isNaN(id)) return res.status(400).json({ error: "Invalid customerId" });
      return res.json(await customerSignaturesRepo.listByCustomer(id));
    }
    if (signedDocument) {
      return res.json(await customerSignaturesRepo.listByDocument(signedDocument as string));
    }
    return res.status(400).json({ error: "Provide customerId or signedDocument query param" });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// GET /api/v2/customer-signatures/:id
router.get("/:id", async (req, res) => {
  const id = parseInt(req.params.id);
  if (isNaN(id)) return res.status(400).json({ error: "Invalid id" });
  try {
    const row = await customerSignaturesRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Signature not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// POST /api/v2/customer-signatures — append-only; no PUT/PATCH/DELETE
router.post("/", async (req, res) => {
  const parsed = insertCustomerSignatureSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: parsed.error.flatten() });
  try {
    return res.status(201).json(await customerSignaturesRepo.create(parsed.data));
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
