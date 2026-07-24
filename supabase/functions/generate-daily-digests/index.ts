/**
 * generate-daily-digests
 * Runs daily at 04:59 UTC (11:59 PM CST).
 * Compiles a daily activity digest for every active Signal Flare property
 * and upserts records into the daily_digests table.
 *
 * Standing Rock Stewardship Co.
 */

import { createClient } from "@supabase/supabase-js";

// ─── CORS helpers ─────────────────────────────────────────────────────────────

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization",
};

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json" },
  });
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Severity = "Emergency" | "High" | "Medium" | "Low";
type DeviceStatus = "Online" | "Offline" | "Alert" | "Unknown";
type SystemStatus = "Alert Active" | "Items Flagged" | "All Clear";

interface Property {
  id: string;
  nickname: string;
  service_tier: string;
  status: string;
}

interface AlertEvent {
  id: string;
  property_id: string;
  event_type: string;
  severity: Severity;
  resolved: boolean;
  event_timestamp: string;
}

interface MonitoringDevice {
  id: string;
  property_id: string;
  status: DeviceStatus;
}

interface EventsSummary {
  [eventType: string]: number;
}

interface DigestRecord {
  property_id: string;
  digest_date: string; // ISO date string "YYYY-MM-DD"
  total_events: number;
  events_summary: EventsSummary;
  devices_online: number;
  devices_offline: number;
  active_alerts: number;
  resolved_alerts: number;
  system_status: SystemStatus;
  created_at: string;
  updated_at: string;
}

// ─── Utility: UTC day boundaries ─────────────────────────────────────────────

/**
 * Returns the start and end of a UTC calendar day as ISO strings,
 * and the date key "YYYY-MM-DD".
 */
function getUtcDayBoundaries(date: Date = new Date()): {
  dayStart: string;
  dayEnd: string;
  digestDate: string;
} {
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, "0");
  const day = String(date.getUTCDate()).padStart(2, "0");

  const digestDate = `${year}-${month}-${day}`;
  const dayStart = `${digestDate}T00:00:00.000Z`;
  const dayEnd = `${digestDate}T23:59:59.999Z`;

  return { dayStart, dayEnd, digestDate };
}

// ─── Determine system status ──────────────────────────────────────────────────

function computeSystemStatus(events: AlertEvent[]): SystemStatus {
  const unresolvedEvents = events.filter((e) => !e.resolved);
  if (unresolvedEvents.length === 0) return "All Clear";

  const hasHighSeverity = unresolvedEvents.some(
    (e) => e.severity === "High" || e.severity === "Emergency"
  );
  if (hasHighSeverity) return "Alert Active";

  return "Items Flagged";
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // ── Initialize Supabase client (service role) ─────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── Calculate today's UTC day window ─────────────────────────────────────
    const { dayStart, dayEnd, digestDate } = getUtcDayBoundaries(new Date());
    console.log(`Generating daily digests for ${digestDate} (${dayStart} → ${dayEnd})`);

    // ── Query all active Signal Flare properties ──────────────────────────────
    const { data: properties, error: propError } = await supabase
      .from("properties")
      .select("id, nickname, service_tier, status")
      .eq("service_tier", "signal_flare")
      .eq("status", "active");

    if (propError) {
      console.error("Failed to query properties:", propError);
      return jsonResponse({ error: "Failed to query properties" }, 500);
    }

    if (!properties || properties.length === 0) {
      console.log("No active Signal Flare properties found");
      return jsonResponse({ success: true, properties_processed: 0, digest_date: digestDate });
    }

    console.log(`Found ${properties.length} active Signal Flare properties`);

    // ── Process each property ─────────────────────────────────────────────────
    let propertiesProcessed = 0;
    let propertiesSkipped = 0;
    const errors: string[] = [];

    for (const property of properties as Property[]) {
      try {
        // ── Check for existing digest (idempotency guard) ─────────────────────
        const { data: existingDigest, error: existingError } = await supabase
          .from("daily_digests")
          .select("id")
          .eq("property_id", property.id)
          .eq("digest_date", digestDate)
          .maybeSingle();

        if (existingError) {
          console.warn(`Error checking existing digest for ${property.id}:`, existingError.message);
          // Continue to upsert anyway — upsert handles conflicts gracefully
        }

        if (existingDigest) {
          // Digest already exists for this property + date — skip
          console.log(`Digest already exists for property ${property.nickname} on ${digestDate}, skipping`);
          propertiesSkipped++;
          continue;
        }

        // ── Fetch alert_events for this property during the day window ─────────
        const { data: alertEvents, error: alertError } = await supabase
          .from("alert_events")
          .select("id, property_id, event_type, severity, resolved, event_timestamp")
          .eq("property_id", property.id)
          .gte("event_timestamp", dayStart)
          .lte("event_timestamp", dayEnd);

        if (alertError) {
          console.error(`Failed to fetch alert_events for ${property.id}:`, alertError);
          errors.push(`property ${property.nickname}: alert_events query failed`);
          continue;
        }

        const events = (alertEvents ?? []) as AlertEvent[];

        // ── Fetch monitoring_devices for this property ────────────────────────
        const { data: devicesData, error: devicesError } = await supabase
          .from("monitoring_devices")
          .select("id, property_id, status")
          .eq("property_id", property.id);

        if (devicesError) {
          console.error(`Failed to fetch monitoring_devices for ${property.id}:`, devicesError);
          errors.push(`property ${property.nickname}: monitoring_devices query failed`);
          continue;
        }

        const devices = (devicesData ?? []) as MonitoringDevice[];

        // ── Compute metrics ───────────────────────────────────────────────────

        // Event counts
        const totalEvents = events.length;

        // Group events by type
        const eventsSummary: EventsSummary = {};
        for (const evt of events) {
          const key = evt.event_type ?? "Unknown";
          eventsSummary[key] = (eventsSummary[key] ?? 0) + 1;
        }

        // Device counts
        const devicesOnline = devices.filter((d) => d.status === "Online").length;
        const devicesOffline = devices.filter(
          (d) => d.status === "Offline" || d.status === "Alert" || d.status === "Unknown"
        ).length;

        // Alert resolution counts
        const activeAlerts = events.filter((e) => !e.resolved).length;
        const resolvedAlerts = events.filter((e) => e.resolved).length;

        // System status
        const systemStatus = computeSystemStatus(events);

        // ── Build digest record ───────────────────────────────────────────────
        const now = new Date().toISOString();
        const digestRecord: DigestRecord = {
          property_id: property.id,
          digest_date: digestDate,
          total_events: totalEvents,
          events_summary: eventsSummary,
          devices_online: devicesOnline,
          devices_offline: devicesOffline,
          active_alerts: activeAlerts,
          resolved_alerts: resolvedAlerts,
          system_status: systemStatus,
          created_at: now,
          updated_at: now,
        };

        // ── Upsert into daily_digests ─────────────────────────────────────────
        const { error: upsertError } = await supabase
          .from("daily_digests")
          .upsert(digestRecord, {
            onConflict: "property_id,digest_date",
            ignoreDuplicates: false,
          });

        if (upsertError) {
          console.error(`Failed to upsert digest for ${property.nickname}:`, upsertError);
          errors.push(`property ${property.nickname}: upsert failed`);
          continue;
        }

        console.log(
          `Digest created for ${property.nickname} | date=${digestDate} | ` +
          `events=${totalEvents}, activeAlerts=${activeAlerts}, status=${systemStatus}`
        );

        propertiesProcessed++;
      } catch (propErr) {
        console.error(`Unhandled error for property ${property.id}:`, propErr);
        errors.push(`property ${property.nickname}: ${String(propErr)}`);
      }
    }

    const summary = {
      success: true,
      digest_date: digestDate,
      properties_found: properties.length,
      properties_processed: propertiesProcessed,
      properties_skipped: propertiesSkipped,
      errors: errors.length > 0 ? errors : undefined,
    };

    console.log("generate-daily-digests complete:", summary);
    return jsonResponse(summary, 200);
  } catch (err) {
    console.error("Unhandled error in generate-daily-digests:", err);
    return jsonResponse({ error: "Internal server error", detail: String(err) }, 500);
  }
});
