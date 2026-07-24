/**
 * weather-engine.ts
 * Weather Auto-Response Engine for Standing Rock Stewardship Co.
 *
 * 1. Geocoding   — Census Geocoder (primary) + Nominatim (fallback)
 * 2. NWS polling — every 10 minutes, store active severe warnings
 * 3. PiP match   — point-in-polygon per property; triggers storm_events + response visits
 * 4. Notify      — in-app + Zoho email to Admin/Supervisor roles
 */

import cron from "node-cron";
import { log } from "./index";
import { sendMail } from "./mailer";

// ─────────────────────────────────────────────────────────────────────────────
// Types
// ──────────────────────────��──────────────────────────────────────────────────

interface NWSFeature {
  id: string;
  properties: {
    id: string;
    event: string;
    severity: string;
    headline: string;
    description: string;
    effective: string;
    expires: string;
    status: string;
    messageType: string;
    areaDesc: string;
  };
  geometry: GeoJSON.Geometry | null;
}

interface StoredAlert {
  id: number;
  nws_id: string;
  event_type: string;
  severity: string;
  headline: string | null;
  expires: string;
  geometry: string | null;
}

interface StoredProperty {
  id: number;
  nickname: string;
  address: string;
  city: string;
  state: string;
  zip: string;
  gps_lat: number | null;
  gps_lng: number | null;
  owner_name: string;
  owner_email: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Warning types we care about (NWS event strings)
// ─────────────────────────────────────────────────────────────────────────────

const WATCHED_EVENTS = new Set([
  "Severe Thunderstorm Warning",
  "Tornado Warning",
  "High Wind Warning",
  "Winter Storm Warning",
  "Blizzard Warning",
  "Hard Freeze Warning",
  "Flash Flood Warning",
  "Extreme Wind Warning",
]);

// ─────────────────────────────────────────────────────────────────────────────
// Point-in-Polygon (Ray-Casting — no external deps)
// ─────────────────────────────────────────────────────────────────────────────

function pointInRing(lat: number, lng: number, ring: number[][]): boolean {
  let inside = false;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const intersect =
      yi > lat !== yj > lat &&
      lng < ((xj - xi) * (lat - yi)) / (yj - yi) + xi;
    if (intersect) inside = !inside;
  }
  return inside;
}

function pointInPolygon(lat: number, lng: number, geometry: GeoJSON.Geometry): boolean {
  if (geometry.type === "Polygon") {
    const outer = geometry.coordinates[0] as number[][];
    if (!pointInRing(lat, lng, outer)) return false;
    for (let i = 1; i < geometry.coordinates.length; i++) {
      if (pointInRing(lat, lng, geometry.coordinates[i] as number[][])) return false;
    }
    return true;
  }
  if (geometry.type === "MultiPolygon") {
    return (geometry.coordinates as number[][][][]).some((poly) => {
      const outer = poly[0];
      if (!pointInRing(lat, lng, outer)) return false;
      for (let i = 1; i < poly.length; i++) {
        if (pointInRing(lat, lng, poly[i])) return false;
      }
      return true;
    });
  }
  return false;
}

// ─────────────────────────────────────────────────────────────────────────────
// Geocoding
// ─────────────────────────────────────────────────────────────────────────────

export async function geocodeAddress(
  address: string,
  city: string,
  state: string,
  zip: string
): Promise<{ lat: number; lng: number } | null> {
  const oneLineAddr = encodeURIComponent(`${address}, ${city}, ${state} ${zip}`);

  // Primary: US Census Geocoder
  try {
    const url = `https://geocoding.geo.census.gov/geocoder/locations/onelineaddress?address=${oneLineAddr}&benchmark=Public_AR_Current&format=json`;
    const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
    if (res.ok) {
      const data = await res.json();
      const match = data?.result?.addressMatches?.[0];
      if (match?.coordinates) {
        return { lat: match.coordinates.y, lng: match.coordinates.x };
      }
    }
  } catch (e: any) {
    log(`Census geocode failed: ${e.message}`, "geo");
  }

  // Fallback: Nominatim (OpenStreetMap)
  try {
    const url = `https://nominatim.openstreetmap.org/search?q=${oneLineAddr}&format=json&limit=1&countrycodes=us`;
    const res = await fetch(url, {
      signal: AbortSignal.timeout(8000),
      headers: { "User-Agent": "StandingRockStewardshipCo/1.0 (info@standingrockstewards.com)" },
    });
    if (res.ok) {
      const data = await res.json();
      if (data?.[0]) {
        return { lat: parseFloat(data[0].lat), lng: parseFloat(data[0].lon) };
      }
    }
  } catch (e: any) {
    log(`Nominatim geocode failed: ${e.message}`, "geo");
  }

  return null;
}

// ─────────────────────────────────────────────────────────────────────────────
// Lazy-load storage to avoid circular deps
// ─────────────────────────────────────────────────────────────────────────────

// We access the SQLite instance directly for weather tables
// (not yet in Drizzle schema) via the raw sqlite handle exposed below.
// storage.ts exports `sqlite` as a named export.

let _sqlite: any = null;
function db(): any {
  if (!_sqlite) {
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    _sqlite = require("./storage").sqlite;
  }
  return _sqlite;
}

// ─────────────────────────────────────────────────────────────────────────────
// NWS Alert Ingestion
// ─────────────────────────────────────────────────────────────────────────────

async function fetchAndStoreNWSAlerts(): Promise<StoredAlert[]> {
  const url = "https://api.weather.gov/alerts/active?area=OK&status=actual&message_type=alert";
  let features: NWSFeature[] = [];

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(15000),
      headers: { "User-Agent": "StandingRockStewardshipCo/1.0 (info@standingrockstewards.com)", Accept: "application/geo+json" },
    });
    if (!res.ok) throw new Error(`NWS HTTP ${res.status}`);
    const json = await res.json();
    features = (json.features ?? []) as NWSFeature[];
  } catch (e: any) {
    log(`NWS fetch failed: ${e.message}`, "weather");
    return [];
  }

  const now = new Date().toISOString();
  const newAlerts: StoredAlert[] = [];

  for (const f of features) {
    const p = f.properties;
    if (!WATCHED_EVENTS.has(p.event)) continue;
    if (p.status !== "Actual") continue;
    if (p.messageType === "Cancel") continue;

    // Skip expired
    if (p.expires && new Date(p.expires) < new Date()) continue;

    const nwsId = p.id || f.id;
    const geometryJson = f.geometry ? JSON.stringify(f.geometry) : null;

    try {
      const existing = db().prepare("SELECT id FROM weather_alerts WHERE nws_id = ?").get(nwsId);
      if (existing) continue; // already stored

      const result = db()
        .prepare(
          "INSERT INTO weather_alerts (nws_id, event_type, severity, headline, description, effective, expires, geometry, raw_payload, created_at) VALUES (?,?,?,?,?,?,?,?,?,?) RETURNING *"
        )
        .get(
          nwsId,
          p.event,
          p.severity ?? "Unknown",
          p.headline ?? null,
          p.description ?? null,
          p.effective,
          p.expires,
          geometryJson,
          JSON.stringify(p),
          now
        );
      if (result) {
        newAlerts.push(result);
        log(`New NWS alert stored: ${p.event} (${nwsId})`, "weather");
      }
    } catch (e: any) {
      log(`Error storing alert ${nwsId}: ${e.message}`, "weather");
    }
  }

  return newAlerts;
}

// ─────────────────────────────────────────────────────────────────────────────
// Notification helpers
// ─────────────────────────────────────────────────────────────────────────────

function createInAppNotification(userId: number, title: string, body: string, link?: string) {
  try {
    db()
      .prepare("INSERT INTO in_app_notifications (user_id, title, body, type, link, created_at) VALUES (?,?,?,?,?,?)")
      .run(userId, title, body, "storm", link ?? null, new Date().toISOString());
  } catch (e: any) {
    log(`In-app notification failed: ${e.message}`, "weather");
  }
}

async function notifyAdminsAndSupervisors(
  eventType: string,
  propertyNickname: string,
  stormEventId: number
): Promise<void> {
  const admins = db()
    .prepare("SELECT * FROM users WHERE role IN ('admin','supervisor') AND active = 1")
    .all() as any[];

  const title = `⚡ Storm Response Triggered — ${propertyNickname}`;
  const body = `A ${eventType} warning is active over ${propertyNickname}. A storm-response visit has been queued.`;
  const link = `/storm-events`;

  for (const u of admins) {
    createInAppNotification(u.id, title, body, link);

    if (u.email) {
      try {
        await sendMail({
          to: u.email,
          subject: title,
          html: `
            <div style="font-family:Arial,sans-serif;max-width:600px;margin:auto;background:#1C1C1C;color:#F5F0EA;padding:32px;border-radius:8px;">
              <div style="color:#C05A43;font-size:11px;font-weight:700;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px;">Standing Rock Stewardship Co.</div>
              <h2 style="color:#F5F0EA;font-family:Georgia,serif;margin:0 0 16px 0;">⚡ Storm Response Triggered</h2>
              <p style="color:#ccc;"><strong style="color:#F5F0EA;">${propertyNickname}</strong> is inside an active <strong style="color:#C05A43;">${eventType}</strong> warning zone.</p>
              <p style="color:#ccc;">A storm-response visit has been automatically queued. Log in to assign a technician.</p>
              <a href="https://standingrockstewards.com/#/storm-events" 
                 style="display:inline-block;margin-top:16px;padding:10px 20px;background:#C05A43;color:#fff;text-decoration:none;border-radius:6px;font-weight:bold;">
                View Storm Events
              </a>
              <p style="margin-top:24px;font-size:12px;color:#666;">Standing Rock Stewardship Co. · (918) 707-2228 · standingrockstewards.com</p>
            </div>`,
        });
      } catch (e: any) {
        log(`Email notify failed for ${u.email}: ${e.message}`, "weather");
      }
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Point-in-Polygon Matching → Storm Events + Response Visits
// ─────────────────────────────────────────────────────────────────────────────

async function matchAlertsToProperties(newAlerts: StoredAlert[]): Promise<void> {
  if (newAlerts.length === 0) return;

  const properties = db()
    .prepare("SELECT id, nickname, address, city, state, zip, gps_lat, gps_lng, owner_name, owner_email FROM properties WHERE active = 1")
    .all() as StoredProperty[];

  const geocodedProps = properties.filter((p) => p.gps_lat != null && p.gps_lng != null);

  for (const alert of newAlerts) {
    if (!alert.geometry) {
      log(`Alert ${alert.nws_id} has no geometry — skipping PiP`, "weather");
      continue;
    }

    let geometry: GeoJSON.Geometry;
    try {
      geometry = JSON.parse(alert.geometry);
    } catch {
      log(`Alert ${alert.nws_id} geometry parse error — skipping`, "weather");
      continue;
    }

    for (const prop of geocodedProps) {
      const inside = pointInPolygon(prop.gps_lat!, prop.gps_lng!, geometry);
      if (!inside) continue;

      // Deduplicate: skip if storm_event already exists for this pair
      const existing = db()
        .prepare("SELECT id FROM storm_events WHERE property_id = ? AND weather_alert_id = ?")
        .get(prop.id, alert.id);
      if (existing) continue;

      log(`MATCH: ${prop.nickname} inside ${alert.event_type} (alert ${alert.id})`, "weather");

      const now = new Date().toISOString();

      // Create storm_event
      const stormEvent = db()
        .prepare(
          "INSERT INTO storm_events (property_id, weather_alert_id, triggered_at, status, created_at) VALUES (?,?,?,?,?) RETURNING *"
        )
        .get(prop.id, alert.id, now, "new", now) as any;

      // Create storm-response scheduled visit (date = today)
      const today = now.split("T")[0];
      const visit = db()
        .prepare(
          "INSERT INTO scheduled_visits (property_id, scheduled_date, scheduled_time, visit_type, notes, completed, weather_alert_id, storm_event_id) VALUES (?,?,?,?,?,?,?,?) RETURNING *"
        )
        .get(
          prop.id,
          today,
          null,
          "storm_response",
          `Auto-triggered by NWS ${alert.event_type} warning. Assign tech for storm response visit.`,
          0,
          alert.id,
          stormEvent.id
        ) as any;

      // Link visit back to storm_event
      db()
        .prepare("UPDATE storm_events SET scheduled_visit_id = ? WHERE id = ?")
        .run(visit.id, stormEvent.id);

      // Notify
      await notifyAdminsAndSupervisors(alert.event_type, prop.nickname, stormEvent.id);
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Geocode all properties missing coords (run once at startup)
// ─────────────────────────────────────────────────────────────────────────────

async function geocodeMissingProperties(): Promise<void> {
  const props = db()
    .prepare("SELECT id, address, city, state, zip FROM properties WHERE (gps_lat IS NULL OR gps_lng IS NULL) AND active = 1")
    .all() as any[];

  for (const p of props) {
    const coords = await geocodeAddress(p.address, p.city, p.state, p.zip);
    if (coords) {
      db()
        .prepare("UPDATE properties SET gps_lat = ?, gps_lng = ? WHERE id = ?")
        .run(coords.lat, coords.lng, p.id);
      log(`Geocoded property ${p.id}: (${coords.lat}, ${coords.lng})`, "geo");
    } else {
      log(`Could not geocode property ${p.id}`, "geo");
    }
    // Be polite to free APIs — 1 second between requests
    await new Promise((r) => setTimeout(r, 1000));
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Main Poll Cycle
// ─────────────────────────────────────────────────────────────────────────────

async function runWeatherCycle(): Promise<void> {
  log("Weather poll cycle starting…", "weather");
  try {
    const newAlerts = await fetchAndStoreNWSAlerts();
    await matchAlertsToProperties(newAlerts);
    log(`Weather poll complete — ${newAlerts.length} new alert(s) processed.`, "weather");
  } catch (e: any) {
    log(`Weather cycle error: ${e.message}`, "weather");
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Startup
// ─────────────────────────────────────────────────────────────────────────────

export function startWeatherEngine(): void {
  log("Weather Auto-Response Engine starting…", "weather");

  // Geocode any properties missing coords
  geocodeMissingProperties().catch((e) => log(`Startup geocode error: ${e.message}`, "geo"));

  // Initial poll immediately
  runWeatherCycle().catch(() => {});

  // Poll every 10 minutes
  cron.schedule("*/10 * * * *", () => {
    runWeatherCycle().catch(() => {});
  });

  log("Weather engine scheduled: polling NWS every 10 minutes.", "weather");
}
