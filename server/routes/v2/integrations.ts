/**
 * server/routes/v2/integrations.ts  (Brick 8)
 *
 * Mounted at /api/v2/integrations in v2/index.ts (BEFORE requireAuthV2 —
 * webhook endpoints are public-with-verification, not session-gated).
 *
 * POST /api/v2/integrations/:provider
 *   Inbound webhook from any external provider (alarm panel, weather, etc.).
 *   Signature verification is a marked seam — reads secretRef from
 *   integration_sources.config, never a hardcoded key.
 *
 * propertyId is passed in the request body (provider sends it) or derived
 * from the integration_sources lookup. If the provider sends a device/site
 * identifier, include it in the payload and let the service resolve it.
 */

import { Router } from "express";
import { integrationService } from "../../services/integrationService";
import { integrationSourcesRepo } from "../../repositories/integrationSources";

const router = Router();

// POST /api/v2/integrations/:provider
router.post("/:provider", async (req, res) => {
  const { provider } = req.params;

  // propertyId must be present in the body OR as a query param
  const propertyId: string | undefined =
    req.body?.propertyId ?? (req.query.propertyId as string | undefined);

  if (!propertyId) {
    return res.status(400).json({
      error: "propertyId required — include in request body or ?propertyId= query param",
    });
  }

  // ── SIGNATURE VERIFICATION SEAM ───────────────────────────────────────────
  // 1. Fetch the source to get config.secretRef
  // 2. Resolve the secret from process.env
  // 3. Verify HMAC (currently a no-op stub — returns true always)
  // At go-live: switch express.json() → express.raw() on this route so we
  // receive the raw body Buffer needed for HMAC verification.
  const source = await integrationSourcesRepo.getByProviderAndProperty(provider, propertyId);
  const signatureHeader = req.headers["x-hub-signature-256"] as string | undefined
    ?? req.headers["x-signature"]  as string | undefined;

  const verified = integrationService.verifySignature(
    JSON.stringify(req.body),   // raw body placeholder — swap for Buffer at go-live
    signatureHeader,
    (source?.config ?? {}) as any,
  );

  if (!verified) {
    return res.status(401).json({ error: "Webhook signature verification failed" });
  }
  // ── END SEAM ──────────────────────────────────────────────────────────────

  try {
    const result = await integrationService.ingestEvent(
      provider,
      propertyId,
      req.body,
      {
        severity: req.body?.severity,
        category: req.body?.category,
      },
    );

    const status = result.jobs.length > 0 ? 201 : 200;
    return res.status(status).json(result);
  } catch (err: any) {
    return res.status(err.status ?? 500).json({ error: err.message });
  }
});

export default router;
