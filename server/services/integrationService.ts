/**
 * server/services/integrationService.ts  (Brick 8)
 *
 * Core integration pipeline: ingest a raw provider event, write a
 * monitoring_events row, then use the matching integration_sources row
 * to decide whether to spawn a stewardship_jobs row.
 *
 * Design principles:
 *   - FLEXIBLE, not prescriptive. Providers are data-driven rows; no
 *     hardcoded `if (provider === "x")` branching anywhere.
 *   - Rule engine reads thresholds / job config from integration_sources.config.
 *   - Adding a new provider = inserting a row in integration_sources (no redeploy).
 *   - ingestEvent returns an array of spawned jobs so the contract already
 *     supports "one event → many jobs" when that need arises.
 *
 * Signature verification:
 *   ── SEAM ──────────────────────────────────────────────────────────────────
 *   The integration_sources.config object may carry a "secretRef" key whose
 *   value names an env var (e.g. "ALARM_COM_WEBHOOK_SECRET"). At go-live,
 *   look up process.env[config.secretRef] and verify the request HMAC/token
 *   against it. For now verifySignature() is a no-op stub that always returns
 *   true, so wiring is in place without live keys.
 *   ── END SEAM ──────────────────────────────────────────────────────────────
 *
 * All IDs are text. No parseInt anywhere.
 */

import crypto from "crypto";
import { monitoringEventsRepo } from "../repositories/monitoringEvents";
import { integrationSourcesRepo } from "../repositories/integrationSources";
import { stewardshipJobsRepo } from "../repositories/stewardshipJobs";
import type { StewardshipJob, IntegrationSource } from "../../shared/schema-v2";

// ── Config shape (read from integration_sources.config jsonb) ─────────────────
interface SourceConfig {
  secretRef?:    string;           // name of the env var holding the webhook secret
  severity?:     string;           // override default severity for events from this source
  category?:     string;           // override default category
  jobType?:      string;           // override default job type (default "response")
  triggerType?:  string;           // override trigger_type written on the job
  scheduledFor?: string;           // ISO offset like "+PT1H" — not yet evaluated; placeholder
  [key: string]: unknown;          // open-ended: thresholds, custom fields, etc.
}

// ── Signature verification seam ───────────────────────────────────────────────

/**
 * Verify the inbound webhook signature against the secret named in config.secretRef.
 *
 * ── STRIPE-STYLE HMAC SEAM ────────────────────────────────────────────────────
 * When ready to wire up real verification:
 *   1. Read the raw request body as a Buffer (requires express.raw() on the webhook route).
 *   2. Resolve the secret: const secret = process.env[config.secretRef ?? ""] ?? "";
 *   3. Compute: crypto.createHmac("sha256", secret).update(rawBody).digest("hex")
 *   4. Compare with the signature header the provider sends (e.g. X-Hub-Signature-256).
 *   5. Return false if mismatch → route handler returns 401.
 * ── END SEAM ─────────────────────────────────────────────────────────────────
 */
export function verifySignature(
  _rawBody: string | Buffer,
  _signatureHeader: string | undefined,
  config: SourceConfig,
): boolean {
  // TODO: implement per-provider HMAC verification when secretRef env vars are provisioned.
  // For now, always passes so the pipeline can be tested end-to-end without live keys.
  void config;
  return true;
}

// ── Payload sanitization ─────────────────────────────────────────────────────

const MAX_PAYLOAD = 8_000;

function sanitizeRawPayload(raw: unknown): string | null {
  if (raw == null) return null;
  const str = typeof raw === "string" ? raw : JSON.stringify(raw);
  if (str.length > MAX_PAYLOAD) return str.slice(0, MAX_PAYLOAD);
  if (!monitoringEventsRepo.payloadIsSafe(str)) return null;
  return str;
}

// ── Job spawning ──────────────────────────────────────────────────────────────

async function spawnJob(
  propertyId:    string,
  sourceEventId: string,
  source:        IntegrationSource,
): Promise<StewardshipJob> {
  const config = (source.config ?? {}) as SourceConfig;

  return stewardshipJobsRepo.create({
    propertyId,
    sourceEventId,
    triggerType:  config.triggerType  ?? source.provider,
    jobType:      config.jobType      ?? "response",
    priority:     source.defaultPriority ?? "normal",
    status:       "pending",
    metadata:     { sourceId: source.id, provider: source.provider },
  });
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface IngestEventResult {
  event:    Awaited<ReturnType<typeof monitoringEventsRepo.create>>;
  jobs:     StewardshipJob[];    // array — future-proofed for one-to-many
  skipped:  boolean;             // true if source not found or disabled
  reason?:  string;
}

export const integrationService = {
  /**
   * ingestEvent(provider, propertyId, rawPayload)
   *
   * 1. Sanitize rawPayload
   * 2. Write monitoring_events row (always — even if no job is spawned)
   * 3. Look up integration_sources for (provider, propertyId)
   * 4. If source exists, enabled=true, auto_create_job=true → spawn a job
   * 5. Return { event, jobs[], skipped, reason? }
   */
  async ingestEvent(
    provider:    string,
    propertyId:  string,
    rawPayload:  unknown,
    extra: {
      severity?: string;
      category?: string;
    } = {},
  ): Promise<IngestEventResult> {
    const payload = sanitizeRawPayload(rawPayload);

    // Always write the monitoring event — even if we skip job creation
    const event = await monitoringEventsRepo.create({
      propertyId,
      source:   provider,
      severity: extra.severity ?? "info",
      category: extra.category ?? "integration",
      payload,
    });

    // Look up the integration source (property-specific, then global fallback)
    const source = await integrationSourcesRepo.getByProviderAndProperty(
      provider,
      propertyId,
    );

    if (!source) {
      return { event, jobs: [], skipped: true, reason: "No integration source configured for this provider/property" };
    }
    if (!source.enabled) {
      return { event, jobs: [], skipped: true, reason: "Integration source is disabled" };
    }
    if (!source.autoCreateJob) {
      return { event, jobs: [], skipped: false, reason: "auto_create_job=false — event logged, no job spawned" };
    }

    // Spawn job — returns array for future one-to-many expansion
    const job = await spawnJob(propertyId, event.id, source);
    return { event, jobs: [job], skipped: false };
  },

  verifySignature,
};
