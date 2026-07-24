/**
 * minut-webhook
 * Receives POST webhook events from the Minut sensor platform,
 * validates HMAC-SHA256 signatures, maps event types / severities,
 * writes alert_events and updates monitoring_devices in Supabase.
 *
 * Standing Rock Stewardship Co.
 */

import { createClient } from "@supabase/supabase-js";

// ─── CORS helpers ────────────────────────────────────────────────────────────

const CORS_HEADERS: HeadersInit = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-minut-signature",
};

function corsResponse(body: string, status: number, extra?: HeadersInit): Response {
  return new Response(body, {
    status,
    headers: { ...CORS_HEADERS, "Content-Type": "application/json", ...extra },
  });
}

// ─── Type helpers ─────────────────────────────────────────────────────────────

type MinutSeverity = "Critical" | "High" | "Medium" | "Low" | "Info" | string;

interface MinutPayload {
  device_id: string;
  event_type: string;
  timestamp?: string;
  severity?: MinutSeverity;
  temperature?: number;
  humidity?: number;
  sound_level?: number;
  [key: string]: unknown;
}

// ─── Event-type mapping ───────────────────────────────────────────────────────

type AppEventType =
  | "Sound"
  | "Temperature"
  | "Humidity"
  | "Motion"
  | "Smoke-CO"
  | "Device Offline"
  | "Other";

function mapEventType(minutType: string): AppEventType {
  switch (minutType) {
    case "sound_level":
      return "Sound";
    case "temperature_high":
    case "temperature_low":
      return "Temperature";
    case "humidity_high":
    case "humidity_low":
      return "Humidity";
    case "motion":
      return "Motion";
    case "smoke":
    case "co":
      return "Smoke-CO";
    case "device_offline":
      return "Device Offline";
    default:
      return "Other";
  }
}

// ─── Severity mapping ─────────────────────────────────────────────────────────

type AppSeverity = "Emergency" | "High" | "Medium" | "Low";

function mapSeverity(minutSeverity?: MinutSeverity): AppSeverity {
  switch (minutSeverity) {
    case "Critical":
      return "Emergency";
    case "High":
      return "High";
    case "Medium":
      return "Medium";
    default:
      return "Low";
  }
}

// ─── HMAC-SHA256 signature validation ─────────────────────────────────────────

async function validateSignature(
  secret: string,
  rawBody: string,
  signature: string
): Promise<boolean> {
  const encoder = new TextEncoder();
  const keyData = encoder.encode(secret);
  const bodyData = encoder.encode(rawBody);

  const cryptoKey = await crypto.subtle.importKey(
    "raw",
    keyData,
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const signatureBuffer = await crypto.subtle.sign("HMAC", cryptoKey, bodyData);
  const computedHex = Array.from(new Uint8Array(signatureBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison to prevent timing attacks
  if (computedHex.length !== signature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < computedHex.length; i++) {
    mismatch |= computedHex.charCodeAt(i) ^ signature.charCodeAt(i);
  }
  return mismatch === 0;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  // Only accept POST
  if (req.method !== "POST") {
    return corsResponse(JSON.stringify({ error: "Method not allowed" }), 405);
  }

  try {
    // ── Read raw body ──────────────────────────────────────────────────────────
    const rawBody = await req.text();

    // ── Validate HMAC-SHA256 signature ────────────────────────────────────────
    const webhookSecret = Deno.env.get("MINUT_WEBHOOK_SECRET");
    if (!webhookSecret) {
      console.error("MINUT_WEBHOOK_SECRET env var not set");
      return corsResponse(JSON.stringify({ error: "Server configuration error" }), 500);
    }

    const incomingSignature = req.headers.get("x-minut-signature") ?? "";
    const isValid = await validateSignature(webhookSecret, rawBody, incomingSignature);
    if (!isValid) {
      console.warn("Invalid Minut webhook signature");
      return corsResponse(JSON.stringify({ error: "Unauthorized" }), 401);
    }

    // ── Parse JSON body ────────────────────────────────────────────────────────
    let payload: MinutPayload;
    try {
      payload = JSON.parse(rawBody);
    } catch {
      return corsResponse(JSON.stringify({ error: "Invalid JSON body" }), 400);
    }

    const {
      device_id,
      event_type: minutEventType,
      timestamp,
      severity: minutSeverity,
      temperature,
      humidity,
      sound_level,
      ...rest
    } = payload;

    if (!device_id || !minutEventType) {
      return corsResponse(JSON.stringify({ error: "Missing required fields: device_id, event_type" }), 400);
    }

    // Collect sensor values for description
    const sensorValues: Record<string, unknown> = {};
    if (temperature !== undefined) sensorValues.temperature = temperature;
    if (humidity !== undefined) sensorValues.humidity = humidity;
    if (sound_level !== undefined) sensorValues.sound_level = sound_level;
    // Include any other fields that look like sensor data
    for (const [k, v] of Object.entries(rest)) {
      if (typeof v === "number") sensorValues[k] = v;
    }

    const eventTimestamp = timestamp ?? new Date().toISOString();

    // ── Initialize Supabase client (service role) ─────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    if (!supabaseUrl || !serviceRoleKey) {
      console.error("Supabase env vars not set");
      return corsResponse(JSON.stringify({ error: "Server configuration error" }), 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });

    // ── Look up device ────────────────────────────────────────────────────────
    const { data: deviceRows, error: deviceError } = await supabase
      .from("monitoring_devices")
      .select("*")
      .eq("minut_device_id", device_id)
      .limit(1);

    if (deviceError) {
      console.error("Device lookup error:", deviceError);
      return corsResponse(JSON.stringify({ error: "Database error" }), 500);
    }

    const device = deviceRows?.[0] ?? null;

    // ── Device not found: log unmatched event and return 200 ──────────────────
    if (!device) {
      console.warn(`Unmatched Minut device ID: ${device_id}`);

      // Only insert if property_id can be null (handle gracefully otherwise)
      const { error: insertError } = await supabase.from("alert_events").insert({
        device_id: null,
        event_type: "Other",
        severity: "Low",
        description: `Unmatched Minut device ID: ${device_id}`,
        action_taken: "Pending",
        resolved: false,
        property_id: null,
        created_at: new Date().toISOString(),
        event_timestamp: new Date().toISOString(),
      });

      if (insertError) {
        // property_id may be NOT NULL — log and continue, don't fail the webhook
        console.warn("Could not insert unmatched device alert (may be schema constraint):", insertError.message);
      }

      return corsResponse(JSON.stringify({ success: true, note: "Device not found" }), 200);
    }

    // ── Device found: map types, build description, insert alert, update device ──

    const mappedEventType = mapEventType(minutEventType);
    const mappedSeverity = mapSeverity(minutSeverity);

    const locationLabel: string =
      device.location_description ?? device.nickname ?? device.id ?? "unknown location";
    const description = `Minut detected ${mappedEventType} at ${locationLabel}. Sensor values: ${JSON.stringify(sensorValues)}`;

    // Insert alert_event
    const { data: newEventRows, error: insertEventError } = await supabase
      .from("alert_events")
      .insert({
        device_id: device.id,
        property_id: device.property_id ?? null,
        event_type: mappedEventType,
        severity: mappedSeverity,
        description,
        action_taken: "Pending",
        resolved: false,
        created_at: new Date().toISOString(),
        event_timestamp: eventTimestamp,
        notification_sent: false,
      })
      .select("id")
      .single();

    if (insertEventError) {
      console.error("Failed to insert alert_event:", insertEventError);
      return corsResponse(JSON.stringify({ error: "Failed to record alert event" }), 500);
    }

    // Update monitoring_device status and last_ping
    const newDeviceStatus = minutEventType === "device_offline" ? "Offline" : "Alert";
    const { error: updateDeviceError } = await supabase
      .from("monitoring_devices")
      .update({
        status: newDeviceStatus,
        last_ping: new Date().toISOString(),
      })
      .eq("id", device.id);

    if (updateDeviceError) {
      // Non-fatal — alert was already recorded
      console.warn("Failed to update monitoring_device:", updateDeviceError.message);
    }

    console.log(
      `Minut webhook processed: device=${device_id}, event=${mappedEventType}, severity=${mappedSeverity}, alert_event_id=${newEventRows?.id}`
    );

    return corsResponse(
      JSON.stringify({ success: true, alert_event_id: newEventRows?.id }),
      200
    );
  } catch (err) {
    console.error("Unhandled error in minut-webhook:", err);
    return corsResponse(
      JSON.stringify({ error: "Internal server error", detail: String(err) }),
      500
    );
  }
});
