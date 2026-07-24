/**
 * ops-map-routes.ts — Confidential Staff Operations Map
 *
 * All endpoints require view_ops_map permission.
 * Clients and Vendors receive 403 — server-enforced, not UI-only.
 * Payload NEVER includes alarm_code, access_notes, or other high-sensitivity fields.
 *
 * Endpoints:
 *   GET /api/ops-map/properties    — scoped pin data
 *   GET /api/ops-map/weather       — active NWS alert polygons (for storm overlay)
 *   POST /api/ops-map/geocode/:id  — trigger re-geocode for a property with missing coords
 */

import { Router, Request, Response } from "express";
import { sqlite } from "./storage";
import { requirePermission, PERMISSIONS, can } from "./permissions";

const router = Router();

function getUserId(req: Request): number { return Number(req.headers["x-user-id"]); }
function getUserRole(req: Request): string { return (req.headers["x-user-role"] as string) || ""; }

// ─── Hard block for client / vendor (belt + suspenders on top of requirePermission) ─────
function blockSensitiveRoles(req: Request, res: Response): boolean {
  const role = getUserRole(req);
  if (role === "client" || role === "vendor") {
    res.status(403).json({ error: "Access denied — confidential operations data" });
    return true;
  }
  return false;
}

// ─── Haversine distance (miles) ────────────────────────────────────────────────
function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 3958.8; // Earth radius miles
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// ─── Custom middleware: staff-only ops-map gate ─────────────────────────────
// Admin, Supervisor, and Field Tech always allowed — data scoped server-side.
// Client/vendor hardcoded 403 (blockSensitiveRoles handles it).
function requireOpsMapAccess(req: Request, res: Response, next: any) {
  if (blockSensitiveRoles(req, res)) return; // client + vendor blocked here
  const role = getUserRole(req);
  if (role === "admin" || role === "supervisor" || role === "field_tech") return next();
  // Any unrecognised role falls through to 403
  return res.status(403).json({ error: "Forbidden", message: "Staff only." });
}

// ═��═════════════════════════════════════════════════════════════════════════════
// GET /api/ops-map/properties
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Returns scoped property pin data.
 *
 * Admin/Supervisor (view_ops_map=true): all properties with valid coords.
 * Field Tech (view_ops_map granted): all properties.
 * Field Tech (view_ops_map NOT granted): only assigned properties.
 *
 * NEVER includes: alarm_code, access_notes, alarm_panel_location, interior_access details.
 * ALWAYS 403 for client/vendor.
 *
 * Optional query params:
 *   ?near_lat=&near_lng=&radius_miles=  → distance from a point added to each pin
 *   ?tech_id=                           → filter by assigned tech
 *   ?tier=                              → filter by service tier
 *   ?has_alert=1                        → only pins with active storm/flare
 *   ?has_upcoming=1                     → only pins with an upcoming visit today or later
 */
router.get(
  "/ops-map/properties",
  requireOpsMapAccess,
  (req: Request, res: Response) => {
    if (blockSensitiveRoles(req, res)) return;

    const userId = getUserId(req);
    const role = getUserRole(req);

    // Determine scope: does this user have full ops-map access or just their assigned props?
    const userHasBroadAccess = role === "admin" || role === "supervisor";
    // field tech: check if view_ops_map was explicitly granted (override row in user_permissions)
    let techHasGrantedBroadAccess = false;
    if (role === "field_tech") {
      const grant: any = sqlite.prepare(
        "SELECT granted FROM user_permissions WHERE user_id=? AND permission_key='view_ops_map'"
      ).get(userId);
      techHasGrantedBroadAccess = grant?.granted === 1;
    }

    const broadAccess = userHasBroadAccess || techHasGrantedBroadAccess;

    // Build base query — NO alarm_code, NO access_notes, NO alarm_panel_location
    let rows: any[];
    if (broadAccess) {
      rows = sqlite.prepare(`
        SELECT
          p.id, p.nickname, p.address, p.city, p.state, p.zip,
          p.gps_lat, p.gps_lng,
          p.service_tier,
          p.has_dock, p.has_boat, p.has_generator, p.has_propane,
          p.has_alarm,
          p.assigned_tech_id,
          p.client_user_id,
          p.active,
          u.name AS tech_name,
          c.name AS client_name
        FROM properties p
        LEFT JOIN users u ON p.assigned_tech_id = u.id
        LEFT JOIN users c ON p.client_user_id = c.id
        WHERE p.active = 1 AND p.gps_lat IS NOT NULL AND p.gps_lng IS NOT NULL
        ORDER BY p.id
      `).all() as any[];
    } else {
      // Field tech default: only their assigned properties
      rows = sqlite.prepare(`
        SELECT
          p.id, p.nickname, p.address, p.city, p.state, p.zip,
          p.gps_lat, p.gps_lng,
          p.service_tier,
          p.has_dock, p.has_boat, p.has_generator, p.has_propane,
          p.has_alarm,
          p.assigned_tech_id,
          p.client_user_id,
          p.active,
          u.name AS tech_name,
          c.name AS client_name
        FROM properties p
        LEFT JOIN users u ON p.assigned_tech_id = u.id
        LEFT JOIN users c ON p.client_user_id = c.id
        WHERE p.active = 1
          AND p.gps_lat IS NOT NULL
          AND p.gps_lng IS NOT NULL
          AND (p.assigned_tech_id = ? OR p.id IN (
            SELECT DISTINCT property_id FROM scheduled_visits WHERE tech_id = ? AND completed = 0
          ))
        ORDER BY p.id
      `).all(userId, userId) as any[];
    }

    // Enrich each row with: next visit, open flares, open storm events, task rates
    const enriched = rows.map((p: any) => {
      // Next upcoming scheduled visit
      const nextVisit: any = sqlite.prepare(`
        SELECT sv.scheduled_date, sv.scheduled_time, sv.visit_type, u.name AS tech_name
        FROM scheduled_visits sv
        LEFT JOIN users u ON sv.tech_id = u.id
        WHERE sv.property_id = ? AND sv.completed = 0
        ORDER BY sv.scheduled_date ASC, sv.scheduled_time ASC
        LIMIT 1
      `).get(p.id);

      // Open Signal Flares (max severity)
      const openFlares: any[] = sqlite.prepare(`
        SELECT id, severity, category, description, created_at
        FROM signal_flares
        WHERE property_id = ? AND status = 'Open'
        ORDER BY CASE severity WHEN 'Critical' THEN 0 WHEN 'High' THEN 1 WHEN 'Medium' THEN 2 ELSE 3 END
        LIMIT 3
      `).all(p.id) as any[];

      // Active storm events
      const activeStorm: any = sqlite.prepare(`
        SELECT se.id, se.status, wa.event_type, wa.severity AS storm_severity, wa.headline
        FROM storm_events se
        LEFT JOIN weather_alerts wa ON se.weather_alert_id = wa.id
        WHERE se.property_id = ? AND se.status != 'closed'
        LIMIT 1
      `).get(p.id);

      // Task rates for this property (for worth-the-trip panel)
      const taskRates: any[] = sqlite.prepare(`
        SELECT task_type, rate, unit
        FROM property_task_rates
        WHERE property_id = ?
      `).all(p.id) as any[];

      // Derive pin status for color-coding
      let pinStatus: "critical" | "storm" | "flare" | "visit_today" | "scheduled" | "routine" = "routine";
      if (openFlares.some((f: any) => f.severity === "Critical") || activeStorm?.storm_severity === "Extreme") {
        pinStatus = "critical";
      } else if (activeStorm) {
        pinStatus = "storm";
      } else if (openFlares.length > 0) {
        pinStatus = "flare";
      } else if (nextVisit?.scheduled_date === new Date().toISOString().split("T")[0]) {
        pinStatus = "visit_today";
      } else if (nextVisit) {
        pinStatus = "scheduled";
      }

      return {
        id: p.id,
        nickname: p.nickname,
        address: p.address,
        city: p.city,
        state: p.state,
        zip: p.zip,
        lat: p.gps_lat,
        lng: p.gps_lng,
        service_tier: p.service_tier,
        // Feature flags (no sensitive details)
        has_dock: !!p.has_dock,
        has_boat: !!p.has_boat,
        has_generator: !!p.has_generator,
        has_propane: !!p.has_propane,
        has_alarm: !!p.has_alarm, // just presence, not code
        // Staff context
        assigned_tech_id: p.assigned_tech_id,
        tech_name: p.tech_name,
        // Client — name only (not email/phone)
        client_name: p.client_name ?? "Unassigned",
        // Status
        pin_status: pinStatus,
        next_visit: nextVisit ? {
          date: nextVisit.scheduled_date,
          time: nextVisit.scheduled_time,
          type: nextVisit.visit_type,
          tech: nextVisit.tech_name,
        } : null,
        open_flares: openFlares.map((f: any) => ({
          id: f.id,
          severity: f.severity,
          category: f.category,
          description: f.description?.substring(0, 120),
          created_at: f.created_at,
        })),
        active_storm: activeStorm ? {
          id: activeStorm.id,
          event_type: activeStorm.event_type,
          severity: activeStorm.storm_severity,
          headline: activeStorm.headline,
        } : null,
        task_rates: Object.fromEntries(taskRates.map((r: any) => [r.task_type, { rate: r.rate, unit: r.unit }])),
      };
    });

    // ─── Filters ────────────────────────────────────────────────────────────────
    let result = enriched;

    if (req.query.tech_id) {
      const tid = Number(req.query.tech_id);
      result = result.filter((p: any) => p.assigned_tech_id === tid);
    }
    if (req.query.tier) {
      result = result.filter((p: any) => p.service_tier === req.query.tier);
    }
    if (req.query.has_alert === "1") {
      result = result.filter((p: any) => p.open_flares.length > 0 || p.active_storm);
    }
    if (req.query.has_upcoming === "1") {
      result = result.filter((p: any) => p.next_visit);
    }

    // ─── Distance enrichment ─────────────────────────────────────────────────────
    if (req.query.near_lat && req.query.near_lng) {
      const nLat = parseFloat(req.query.near_lat as string);
      const nLng = parseFloat(req.query.near_lng as string);
      const radiusMiles = req.query.radius_miles ? parseFloat(req.query.radius_miles as string) : 25;
      result = result.map((p: any) => ({
        ...p,
        distance_miles: Math.round(haversine(nLat, nLng, p.lat, p.lng) * 10) / 10,
      })).sort((a: any, b: any) => (a.distance_miles ?? 999) - (b.distance_miles ?? 999));

      if (req.query.filter_by_radius === "1") {
        result = result.filter((p: any) => p.distance_miles <= radiusMiles);
      }
    }

    res.json({
      scope: broadAccess ? "all" : "assigned",
      count: result.length,
      properties: result,
    });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// GET /api/ops-map/weather
// ═══════════════════════════════════════════════════════════════════════════════
/**
 * Returns active NWS weather alert polygons for the storm overlay.
 * Fetches from weather_alerts table (geometry column) and also
 * live from NWS API for Lake Eufaula area (McIntosh + Pittsburg counties).
 */
router.get(
  "/ops-map/weather",
  requireOpsMapAccess,
  async (req: Request, res: Response) => {
    if (blockSensitiveRoles(req, res)) return;

    // Stored alerts from DB
    const dbAlerts: any[] = sqlite.prepare(`
      SELECT id, nws_id, event_type, severity, headline, effective, expires, geometry
      FROM weather_alerts
      ORDER BY created_at DESC
      LIMIT 20
    `).all() as any[];

    // Attempt live NWS fetch for Lake Eufaula area
    // NWS: Oklahoma — McIntosh County (OKC018) + Pittsburg County (OKC097)
    let liveAlerts: any[] = [];
    try {
      const nwsRes = await fetch(
        "https://api.weather.gov/alerts/active?area=OK&status=actual&message_type=alert,update",
        { headers: { "User-Agent": "StandingRockStewardship/1.0 fansler.cc@standingrockstewards.com" } }
      );
      if (nwsRes.ok) {
        const nwsData = await nwsRes.json();
        liveAlerts = (nwsData.features ?? [])
          .filter((f: any) => {
            const props = f.properties ?? {};
            const areas = (props.areaDesc ?? "").toLowerCase();
            return areas.includes("mcintosh") || areas.includes("pittsburg") || areas.includes("eufaula");
          })
          .map((f: any) => ({
            id: f.properties?.id,
            nws_id: f.properties?.id,
            event_type: f.properties?.event,
            severity: f.properties?.severity,
            headline: f.properties?.headline,
            effective: f.properties?.effective,
            expires: f.properties?.expires,
            geometry: f.geometry,
            area_desc: f.properties?.areaDesc,
            source: "live",
          }));
      }
    } catch (_) {
      // NWS API unavailable — use DB fallback only
    }

    res.json({
      db_alerts: dbAlerts.map((a: any) => ({
        ...a,
        geometry: a.geometry ? (() => { try { return JSON.parse(a.geometry); } catch { return null; } })() : null,
        source: "db",
      })),
      live_alerts: liveAlerts,
      total: dbAlerts.length + liveAlerts.length,
    });
  }
);

// ═══════════════════════════════════════════════════════════════════════════════
// POST /api/ops-map/geocode/:id — Re-geocode a property with missing coords
// ═══════════════════════════════════════════════════════════════════════════════
router.post(
  "/ops-map/geocode/:id",
  requirePermission(PERMISSIONS.EDIT_PROPERTIES),
  async (req: Request, res: Response) => {
    if (blockSensitiveRoles(req, res)) return;

    const propertyId = Number(req.params.id);
    const prop: any = sqlite.prepare(
      "SELECT id, address, city, state, zip FROM properties WHERE id=?"
    ).get(propertyId);
    if (!prop) return res.status(404).json({ error: "Property not found" });

    // Use Nominatim (OpenStreetMap) — free, no API key
    const query = encodeURIComponent(`${prop.address}, ${prop.city}, ${prop.state} ${prop.zip}`);
    try {
      const geoRes = await fetch(
        `https://nominatim.openstreetmap.org/search?q=${query}&format=json&limit=1`,
        { headers: { "User-Agent": "StandingRockStewardship/1.0 fansler.cc@standingrockstewards.com" } }
      );
      const geoData = await geoRes.json();
      if (!geoData?.[0]) return res.status(422).json({ error: "Could not geocode address" });

      const lat = parseFloat(geoData[0].lat);
      const lng = parseFloat(geoData[0].lon);
      sqlite.prepare("UPDATE properties SET gps_lat=?, gps_lng=? WHERE id=?").run(lat, lng, propertyId);
      res.json({ property_id: propertyId, lat, lng, display_name: geoData[0].display_name });
    } catch (e: any) {
      res.status(500).json({ error: "Geocoding failed", detail: e.message });
    }
  }
);

export default router;
