/**
 * server/routes/v2/markers.ts  (Brick 10e-prereq)
 *
 * Shoreline marker endpoints.
 *
 * Authorization:
 *   GET /        requireNotVendor — admin, supervisor, field_tech, client may read; vendor 403.
 *                Matches confidential-location access pattern from monitoringEvents/jobs.
 *   GET /nearest requireNotVendor — haversine nearest marker, authoritative on backend.
 *   GET /:id     requireNotVendor
 *   POST /       requireAdminOrSupervisor — create a new marker (admin/supervisor only).
 *
 * All IDs are text. lat/lng are numeric strings from Postgres — never parseInt.
 *
 * Nearest-marker endpoint:
 *   GET /api/v2/markers/nearest?lat=<float>&lng=<float>&lake=<optional>
 *   Returns { marker, distanceMiles } for the closest marker by haversine.
 *   Keeps the emergency-response "nearest marker" authoritative on the server.
 *   Client-side haversine (Brick 10b) may also compute this from the full list,
 *   but the backend endpoint is the canonical source.
 */

import { Router } from "express";
import { shorelineMarkersRepo } from "../../repositories/shorelineMarkers";
import { insertShorelineMarkerSchema } from "../../../shared/schema-v2";
import {
  requireNotVendor,
  requireAdminOrSupervisor,
} from "../../middleware/authV2";

const router = Router();

// ── Haversine helper (server-side) ────────────────────────────────────────────
const R_MILES = 3_958.8;

function haversineMiles(
  lat1: number, lng1: number,
  lat2: number, lng2: number,
): number {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R_MILES * 2 * Math.asin(Math.sqrt(a));
}

// ── GET /api/v2/markers ───────────────────────────────────────────────────────
// ?lake=  optional filter by lake name (default: all lakes)
router.get("/", requireNotVendor, async (req, res) => {
  const { lake } = req.query;
  try {
    const rows = await shorelineMarkersRepo.getAll(lake as string | undefined);
    return res.json(rows);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v2/markers/nearest ───────────────────────────────────────────────
// ?lat=<float>&lng=<float>&lake=<optional>
// Must be declared BEFORE /:id to avoid "nearest" being matched as an id param.
router.get("/nearest", requireNotVendor, async (req, res) => {
  const { lat, lng, lake } = req.query;

  if (!lat || !lng) {
    return res.status(400).json({ error: "lat and lng query params required" });
  }

  const userLat = parseFloat(lat as string);
  const userLng = parseFloat(lng as string);

  if (isNaN(userLat) || isNaN(userLng)) {
    return res.status(400).json({ error: "lat and lng must be valid numbers" });
  }

  try {
    const markers = await shorelineMarkersRepo.getAll(lake as string | undefined);

    if (markers.length === 0) {
      return res.status(404).json({ error: "No markers found" });
    }

    let closest: { marker: typeof markers[0]; distanceMiles: number } | null = null;

    for (const m of markers) {
      const mLat = parseFloat(m.latitude as string);
      const mLng = parseFloat(m.longitude as string);
      if (isNaN(mLat) || isNaN(mLng)) continue;

      const dist = haversineMiles(userLat, userLng, mLat, mLng);
      if (closest === null || dist < closest.distanceMiles) {
        closest = { marker: m, distanceMiles: dist };
      }
    }

    if (!closest) {
      return res.status(404).json({ error: "No markers with valid coordinates" });
    }

    return res.json({
      marker: closest.marker,
      distanceMiles: parseFloat(closest.distanceMiles.toFixed(2)),
    });
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── GET /api/v2/markers/:id ───────────────────────────────────────────────────
router.get("/:id", requireNotVendor, async (req, res) => {
  const id = req.params.id as string;
  try {
    const row = await shorelineMarkersRepo.getById(id);
    if (!row) return res.status(404).json({ error: "Marker not found" });
    return res.json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

// ── POST /api/v2/markers ──────────────────────────────────────────────────────
router.post("/", requireAdminOrSupervisor, async (req, res) => {
  const parsed = insertShorelineMarkerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.flatten() });
  }
  try {
    const row = await shorelineMarkersRepo.create(parsed.data);
    return res.status(201).json(row);
  } catch (err: any) {
    return res.status(500).json({ error: err.message });
  }
});

export default router;
