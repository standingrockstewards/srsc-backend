/**
 * server/services/monitoringService.ts  (Brick 6)
 *
 * Business logic for stewardship visit logging and system event ingestion.
 *
 * Responsibilities:
 *   - Validate + sanitize incoming visit data (lat/lng ranges, note length, payload safety)
 *   - Good Samaritan location capture: lat/lng are optional per-event (flag goodSamaritan=true
 *     to record a precise GPS fix; omit to log visit without coordinates)
 *   - Enforce allowed visit_type values
 *   - Map incoming request shape to the monitoringEvents row shape
 *
 * All IDs are text (nanoid/cuid2) — no parseInt, no integer cast.
 */

import { monitoringEventsRepo, type ListEventsOptions, type ListAllEventsOptions } from "../repositories/monitoringEvents";
import { propertiesRepo } from "../repositories/properties";

// ── Constants ─────────────────────────────────────────────────────────────────

export const VISIT_TYPES = [
  "routine_check",
  "storm_assessment",
  "maintenance",
  "emergency_response",
  "dock_inspection",
  "shoreline_walk",
  "water_sample",
  "neighbor_contact",
  "other",
] as const;
export type VisitType = typeof VISIT_TYPES[number];

export const SEVERITIES  = ["info", "warning", "critical"] as const;
export type Severity = typeof SEVERITIES[number];

const MAX_NOTE_LENGTH    = 2000;
const MAX_PAYLOAD_LENGTH = 8000;

// ── Validation helpers ────────────────────────────────────────────────────────

function validateLatLng(lat?: number | null, lng?: number | null): void {
  if (lat !== undefined && lat !== null) {
    if (lat < -90 || lat > 90) {
      throw Object.assign(new Error(`latitude must be in [-90, 90], got ${lat}`), { status: 400 });
    }
  }
  if (lng !== undefined && lng !== null) {
    if (lng < -180 || lng > 180) {
      throw Object.assign(new Error(`longitude must be in [-180, 180], got ${lng}`), { status: 400 });
    }
  }
  // lat and lng must be provided together
  const hasLat = lat !== undefined && lat !== null;
  const hasLng = lng !== undefined && lng !== null;
  if (hasLat !== hasLng) {
    throw Object.assign(new Error("latitude and longitude must be provided together"), { status: 400 });
  }
}

function sanitizeNote(note?: string | null): string | null {
  if (!note) return null;
  const trimmed = note.trim().slice(0, MAX_NOTE_LENGTH);
  return trimmed || null;
}

function sanitizePayload(payload?: string | null): string | null {
  if (!payload) return null;
  if (payload.length > MAX_PAYLOAD_LENGTH) {
    throw Object.assign(new Error(`payload exceeds max length of ${MAX_PAYLOAD_LENGTH} chars`), { status: 400 });
  }
  if (!monitoringEventsRepo.payloadIsSafe(payload)) {
    throw Object.assign(new Error("payload contains blocked keys (alarm_code, access_notes, etc.)"), { status: 400 });
  }
  return payload;
}

// ── Input shapes ──────────────────────────────────────────────────────────────

export interface LogVisitInput {
  propertyId:      string;      // text FK
  visitType:       VisitType;
  severity?:       Severity;    // default "info"
  note?:           string | null;
  latitude?:       number | null;
  longitude?:      number | null;
  visitAt?:        string | null; // ISO datetime; defaults to now()
  payload?:        string | null; // arbitrary JSON string (sanitized)
  goodSamaritan?:  boolean;       // if true, coordinates are recorded; if false/omitted, they are stripped
}

export interface IngestSystemEventInput {
  propertyId:  string;
  source:      string;
  severity:    Severity;
  category:    string;
  payload?:    string | null;
}

// ── Service ───────────────────────────────────────────────────────────────────

export const monitoringService = {
  /**
   * Log a stewardship visit event.
   *
   * Good Samaritan flag:
   *   goodSamaritan=true  → lat/lng are stored as provided (must pass range validation)
   *   goodSamaritan=false (default) → lat/lng are stripped before storage even if provided
   *   This lets callers opt-in to GPS precision while defaulting to no location tracking.
   */
  async logVisit(input: LogVisitInput) {
    if (!VISIT_TYPES.includes(input.visitType)) {
      throw Object.assign(
        new Error(`visitType must be one of: ${VISIT_TYPES.join(", ")}`),
        { status: 400 },
      );
    }

    const severity = input.severity ?? "info";
    if (!SEVERITIES.includes(severity)) {
      throw Object.assign(new Error(`severity must be one of: ${SEVERITIES.join(", ")}`), { status: 400 });
    }

    // Verify property exists before inserting
    const property = await propertiesRepo.getById(input.propertyId);
    if (!property) {
      throw Object.assign(new Error("Property not found"), { status: 404 });
    }

    // Good Samaritan location capture — strip coords unless explicitly opted in
    let latitude:  string | null = null;
    let longitude: string | null = null;
    if (input.goodSamaritan === true) {
      validateLatLng(input.latitude, input.longitude);
      latitude  = input.latitude  != null ? String(input.latitude)  : null;
      longitude = input.longitude != null ? String(input.longitude) : null;
    }

    const note    = sanitizeNote(input.note);
    const payload = sanitizePayload(input.payload);
    const visitAt = input.visitAt ? new Date(input.visitAt) : new Date();

    if (isNaN(visitAt.getTime())) {
      throw Object.assign(new Error("visitAt is not a valid ISO datetime"), { status: 400 });
    }

    return monitoringEventsRepo.create({
      propertyId:  input.propertyId,
      source:      "steward",
      severity,
      category:    "visit",
      visitType:   input.visitType,
      note,
      latitude,
      longitude,
      visitAt,
      payload,
    });
  },

  /**
   * Ingest a system-generated event (sensor, alert, third-party integration).
   * Does not set visitType / note / lat / lng — those are visit-only fields.
   */
  async ingestSystemEvent(input: IngestSystemEventInput) {
    if (!SEVERITIES.includes(input.severity)) {
      throw Object.assign(new Error(`severity must be one of: ${SEVERITIES.join(", ")}`), { status: 400 });
    }

    const property = await propertiesRepo.getById(input.propertyId);
    if (!property) {
      throw Object.assign(new Error("Property not found"), { status: 404 });
    }

    const payload = sanitizePayload(input.payload);

    return monitoringEventsRepo.create({
      propertyId: input.propertyId,
      source:     input.source,
      severity:   input.severity,
      category:   input.category,
      payload,
    });
  },

  /** List events for a property with optional date + type filters */
  async listForProperty(propertyId: string, opts: ListEventsOptions = {}) {
    return monitoringEventsRepo.listByProperty(propertyId, opts);
  },

  /** Fetch a single event by id */
  async getEvent(id: string) {
    return monitoringEventsRepo.getById(id);
  },

  /**
   * List events across all properties the caller is authorized to see.
   * Brick 10U — account-level events feed.
   *
   * Auth scoping rules (mirrors requirePropertyOwnerOrAdmin):
   *   admin / supervisor  → all properties (no ownership restriction)
   *   client              → only properties where property.customerId = customerId
   *   field_tech          → all properties (same as admin; field_tech passes
   *                          requireNotVendor but has no customerId constraint)
   *   vendor              → caller must be blocked BEFORE reaching this method
   *
   * Filters (severity, propertyId, limit, offset) are pushed into SQL via the repo.
   */
  async listForCaller(
    role:       string,
    customerId: string | null,
    opts: Omit<ListAllEventsOptions, "propertyIds">,
  ) {
    let propertyIds: string[];

    if (role === "admin" || role === "supervisor" || role === "field_tech") {
      // Staff + field_tech see all properties
      const allProps = await propertiesRepo.getAll();
      propertyIds = allProps.map((p) => p.id);
    } else if (role === "client" && customerId) {
      // Client: only their own properties
      const ownProps = await propertiesRepo.listByCustomer(customerId);
      propertyIds = ownProps.map((p) => p.id);
    } else {
      // No authorized properties (vendor or unknown role)
      propertyIds = [];
    }

    return monitoringEventsRepo.listAll({ propertyIds, ...opts });
  },

  /** Acknowledge an event (admin action) */
  async acknowledge(id: string) {
    const row = await monitoringEventsRepo.acknowledge(id);
    if (!row) throw Object.assign(new Error("Event not found"), { status: 404 });
    return row;
  },
};
