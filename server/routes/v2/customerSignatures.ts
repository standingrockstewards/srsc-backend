import { Router } from "express";
import { signaturesService } from "../../services/signaturesService";
import { requireNotVendor, requireSelfOrAdmin } from "../../middleware/authV2";

const router = Router();

// POST /api/v2/signatures  — log a signature (any authenticated user)
router.post("/", requireNotVendor, async (req, res) => {
  const { customerId, signatureSvg, signedDocument, legalDocumentId } = req.body;
  if (!customerId || !signatureSvg || !signedDocument) {
    return res.status(400).json({ error: "customerId, signatureSvg, signedDocument required" });
  }
  const ip  = req.ip ?? req.socket.remoteAddress ?? "unknown";
  const ua  = req.headers["user-agent"] ?? "";
  try {
    const row = await signaturesService.capture({
      customerId,
      signatureSvg,
      signedDocument,
      legalDocumentId: legalDocumentId ?? null,
      ipAddress: ip,
      userAgent: ua,
    });
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

// GET /api/v2/signatures?customerId=<text-id>
router.get("/", requireNotVendor, async (req, res) => {
  const rawId = req.query.customerId as string | undefined;
  if (!rawId) return res.status(400).json({ error: "customerId query param required" });
  try {
    const rows = await signaturesService.listForCustomer(rawId);
    return res.json(rows);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
