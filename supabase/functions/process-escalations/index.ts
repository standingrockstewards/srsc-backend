/**
 * process-escalations
 * Triggered by pg_cron every 5 minutes via http_post.
 * Checks unresolved high-severity alerts, applies escalation logic,
 * and sends branded HTML emails via Resend.
 *
 * Standing Rock Stewardship Co.
 */

import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

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

interface NotificationPreferences {
  escalation_enabled?: boolean;
  /** Minutes before first escalation (overrides defaults) */
  emergency_threshold_minutes?: number;
  high_threshold_minutes?: number;
}

interface AlertWithProperty {
  id: string;
  property_id: string;
  event_type: string;
  severity: Severity;
  description: string | null;
  action_taken: string | null;
  resolved: boolean;
  event_timestamp: string;
  created_at: string;
  notification_sent: boolean;
  // joined from properties
  nickname: string;
  owner_name: string | null;
  owner_phone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  notification_preferences: NotificationPreferences | null;
  account_manager_id: string | null;
  // joined from auth.users
  manager_email: string | null;
  manager_name: string | null;
}

interface EscalationLogEntry {
  id: string;
  alert_event_id: string;
  escalation_level: "Initial" | "Second Escalation";
  created_at: string;
  resolved_before_escalation: boolean;
}

// ─── Default thresholds (minutes) ─────────────────────────────────────────────

const DEFAULT_THRESHOLDS: Record<Severity, number> = {
  Emergency: 15,
  High: 60,
  Medium: Infinity,
  Low: Infinity,
};

// ─── Email HTML builder ───────────────────────────────────────────────────────

interface EscalationEmailParams {
  escalationLevel: "Initial" | "Second Escalation";
  severity: Severity;
  propertyId: string;
  propertyNickname: string;
  ownerName: string | null;
  ownerPhone: string | null;
  address: string | null;
  city: string | null;
  state: string | null;
  alertType: string;
  description: string | null;
  minutesElapsed: number;
  managerName: string | null;
}

const SEVERITY_COLORS: Record<Severity, string> = {
  Emergency: "#DC2626",
  High: "#EA580C",
  Medium: "#D97706",
  Low: "#3B82F6",
};

function buildEscalationEmail(params: EscalationEmailParams): string {
  const {
    escalationLevel,
    severity,
    propertyId,
    propertyNickname,
    ownerName,
    ownerPhone,
    address,
    city,
    state,
    alertType,
    description,
    minutesElapsed,
    managerName,
  } = params;

  const appUrl = Deno.env.get("APP_URL") ?? "https://app.standingrockstewards.com";
  const dashboardUrl = `${appUrl}/properties/${propertyId}`;
  const severityColor = SEVERITY_COLORS[severity];

  const fullAddress = [address, city, state].filter(Boolean).join(", ");
  const hoursElapsed = minutesElapsed >= 60
    ? `${Math.floor(minutesElapsed / 60)}h ${minutesElapsed % 60}m`
    : `${minutesElapsed} min`;

  const greetingName = managerName ? `, ${managerName}` : "";
  const escalationTag = escalationLevel === "Second Escalation"
    ? "SECOND ESCALATION — IMMEDIATE ATTENTION REQUIRED"
    : "ESCALATION — ACTION REQUIRED";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escalationTag}</title>
  <style>
    body { margin: 0; padding: 0; background-color: #F5F0EA; font-family: Arial, sans-serif; }
    a { color: #A0432F; }
    table { border-collapse: collapse; }
  </style>
</head>
<body style="margin:0;padding:0;background-color:#F5F0EA;">
  <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
         style="background-color:#F5F0EA;padding:32px 16px;">
    <tr>
      <td align="center">
        <table width="600" cellpadding="0" cellspacing="0" role="presentation"
               style="max-width:600px;width:100%;">

          <!-- Header bar -->
          <tr>
            <td style="background-color:#1C1C1C;padding:20px 24px;border-radius:8px 8px 0 0;">
              <span style="font-family:Arial,sans-serif;font-size:16px;font-weight:bold;
                           letter-spacing:2px;color:#A0432F;text-transform:uppercase;">
                Standing Rock Stewardship Co.
              </span>
            </td>
          </tr>

          <!-- Severity banner -->
          <tr>
            <td style="background-color:${severityColor};padding:10px 24px;">
              <span style="font-family:Arial,sans-serif;font-size:13px;font-weight:bold;
                           color:#fff;text-transform:uppercase;letter-spacing:1px;">
                ${escalationTag}
              </span>
            </td>
          </tr>

          <!-- Content card -->
          <tr>
            <td style="background-color:#fff;padding:24px;border:1px solid #E2DDD8;
                       border-top:none;">

              <p style="font-size:15px;color:#1C1C1C;margin:0 0 16px;">
                Hello${greetingName},
              </p>
              <p style="font-size:15px;color:#1C1C1C;margin:0 0 20px;">
                ${escalationLevel === "Second Escalation"
                  ? "This alert remains <strong>unresolved</strong> and requires <strong>immediate attention</strong>. This is a second and final automated escalation."
                  : "The following alert has not been resolved within the required timeframe and requires your attention."}
              </p>

              <!-- Severity badge -->
              <div style="margin-bottom:20px;">
                <span style="display:inline-block;background-color:${severityColor};
                             color:#fff;font-size:12px;font-weight:bold;padding:4px 12px;
                             border-radius:4px;text-transform:uppercase;letter-spacing:1px;">
                  ${severity}
                </span>
              </div>

              <!-- Alert details table -->
              <table width="100%" cellpadding="0" cellspacing="0" role="presentation"
                     style="border:1px solid #E2DDD8;border-radius:6px;overflow:hidden;
                            margin-bottom:24px;">
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;width:40%;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Property
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    ${propertyNickname}
                  </td>
                </tr>
                ${ownerName ? `
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Owner
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    ${ownerName}
                  </td>
                </tr>` : ""}
                ${ownerPhone ? `
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Owner Phone
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    <a href="tel:${ownerPhone}" style="color:#A0432F;">${ownerPhone}</a>
                  </td>
                </tr>` : ""}
                ${fullAddress ? `
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Address
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    ${fullAddress}
                  </td>
                </tr>` : ""}
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Alert Type
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    ${alertType}
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Severity
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    <span style="background-color:${severityColor};color:#fff;
                                 padding:2px 8px;border-radius:3px;font-size:12px;
                                 font-weight:bold;">
                      ${severity}
                    </span>
                  </td>
                </tr>
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    Time Elapsed
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;
                             border-bottom:1px solid #E2DDD8;">
                    ${hoursElapsed}
                  </td>
                </tr>
                ${description ? `
                <tr>
                  <td style="background-color:#F5F0EA;padding:8px 16px;
                             font-size:13px;font-weight:bold;color:#1C1C1C;">
                    Description
                  </td>
                  <td style="padding:8px 16px;font-size:14px;color:#1C1C1C;">
                    ${description}
                  </td>
                </tr>` : ""}
              </table>

              <!-- CTA button -->
              <div style="text-align:center;margin-bottom:24px;">
                <a href="${dashboardUrl}"
                   style="display:inline-block;background-color:#A0432F;color:#fff;
                          font-family:Arial,sans-serif;font-size:15px;font-weight:bold;
                          text-decoration:none;padding:14px 32px;border-radius:6px;">
                  View Monitoring Dashboard
                </a>
              </div>

              <p style="font-size:13px;color:#6B6B6B;margin:0;">
                This is an automated message from the Standing Rock Stewardship Co.
                monitoring system. If you believe this alert is an error, please
                resolve it in the dashboard.
              </p>
            </td>
          </tr>

          <!-- Footer -->
          <tr>
            <td style="background-color:#1C1C1C;padding:16px 24px;
                       border-radius:0 0 8px 8px;text-align:center;">
              <span style="font-family:Arial,sans-serif;font-size:12px;color:#F5F0EA;">
                Standing Rock Stewardship Co. | (918) 707-2228 | standingrockstewards.com
              </span>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── Main handler ─────────────────────────────────────────────────────────────

Deno.serve(async (req: Request): Promise<Response> => {
  // Handle CORS preflight
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: CORS_HEADERS });
  }

  try {
    // ── Initialize clients ─────────────────────────────────────────────────────
    const supabaseUrl = Deno.env.get("SUPABASE_URL");
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
    const resendApiKey = Deno.env.get("RESEND_API_KEY");

    if (!supabaseUrl || !serviceRoleKey) {
      return jsonResponse({ error: "Missing Supabase env vars" }, 500);
    }
    if (!resendApiKey) {
      return jsonResponse({ error: "Missing RESEND_API_KEY env var" }, 500);
    }

    const supabase = createClient(supabaseUrl, serviceRoleKey, {
      auth: { persistSession: false },
    });
    const resend = new Resend(resendApiKey);

    // ── Query unresolved high-severity alerts with property + manager info ─────
    const { data: alerts, error: alertsError } = await supabase
      .from("alert_events")
      .select(`
        *,
        properties!inner (
          nickname,
          owner_name,
          owner_phone,
          address,
          city,
          state,
          notification_preferences,
          account_manager_id
        )
      `)
      .eq("resolved", false)
      .in("severity", ["Emergency", "High"]);

    if (alertsError) {
      console.error("Failed to query alert_events:", alertsError);
      return jsonResponse({ error: "Database query failed" }, 500);
    }

    if (!alerts || alerts.length === 0) {
      console.log("No unresolved high-severity alerts found");
      return jsonResponse({ success: true, escalations_processed: 0 });
    }

    // ── Fetch manager emails separately (auth.users join via RPC or view) ──────
    // Build a lookup of account_manager_id -> { email, name }
    // We query auth.users through the service role admin API
    const managerIds = [
      ...new Set(
        alerts
          .map((a) => (a as Record<string, unknown>).properties?.account_manager_id as string | null)
          .filter((id): id is string => !!id)
      ),
    ];

    const managerMap: Record<string, { email: string; name: string }> = {};
    for (const managerId of managerIds) {
      const { data: userData, error: userError } =
        await supabase.auth.admin.getUserById(managerId);
      if (userError || !userData?.user) continue;
      managerMap[managerId] = {
        email: userData.user.email ?? "",
        name: (userData.user.user_metadata?.name as string) ?? "",
      };
    }

    // ── Process each alert ─────────────────────────────────────────────────────
    let escalationsProcessed = 0;

    for (const rawAlert of alerts) {
      try {
        const alert = rawAlert as Record<string, unknown>;
        const property = alert.properties as Record<string, unknown>;

        // Hydrate typed alert object
        const alertId = alert.id as string;
        const propertyId = alert.property_id as string;
        const severity = alert.severity as Severity;
        const eventTimestamp = alert.event_timestamp as string;
        const description = (alert.description as string) ?? null;
        const alertType = (alert.event_type as string) ?? "Unknown";
        const resolved = alert.resolved as boolean;

        const prefs: NotificationPreferences =
          (property?.notification_preferences as NotificationPreferences) ?? {};
        const escalationEnabled = prefs.escalation_enabled !== false;

        if (!escalationEnabled) continue;

        // Get threshold (minutes)
        const defaultThreshold = DEFAULT_THRESHOLDS[severity] ?? Infinity;
        const threshold =
          severity === "Emergency"
            ? (prefs.emergency_threshold_minutes ?? defaultThreshold)
            : severity === "High"
            ? (prefs.high_threshold_minutes ?? defaultThreshold)
            : defaultThreshold;

        if (!isFinite(threshold)) continue;

        // Minutes elapsed since event
        const elapsedMs = Date.now() - new Date(eventTimestamp).getTime();
        const minutesElapsed = Math.floor(elapsedMs / 60_000);

        // Manager info
        const accountManagerId = (property?.account_manager_id as string) ?? null;
        const manager = accountManagerId ? managerMap[accountManagerId] : null;
        const managerEmail = manager?.email ?? null;
        const managerName = manager?.name ?? null;

        // Fetch existing escalation_log entries for this alert
        const { data: escalationLogs, error: logError } = await supabase
          .from("escalation_log")
          .select("*")
          .eq("alert_event_id", alertId)
          .order("created_at", { ascending: true });

        if (logError) {
          console.error(`Failed to fetch escalation_log for alert ${alertId}:`, logError);
          continue;
        }

        const logs = (escalationLogs ?? []) as EscalationLogEntry[];

        // Mark resolved_before_escalation for any log entries if alert is now resolved
        // (handles the case where the cron fires just after resolution)
        if (resolved) {
          const pendingLogs = logs.filter((l) => !l.resolved_before_escalation);
          for (const log of pendingLogs) {
            await supabase
              .from("escalation_log")
              .update({ resolved_before_escalation: true })
              .eq("id", log.id);
          }
          continue;
        }

        // Build shared email params
        const emailParams: EscalationEmailParams = {
          escalationLevel: "Initial",
          severity,
          propertyId,
          propertyNickname: (property?.nickname as string) ?? "Unknown Property",
          ownerName: (property?.owner_name as string) ?? null,
          ownerPhone: (property?.owner_phone as string) ?? null,
          address: (property?.address as string) ?? null,
          city: (property?.city as string) ?? null,
          state: (property?.state as string) ?? null,
          alertType,
          description,
          minutesElapsed,
          managerName,
        };

        const hasInitial = logs.some((l) => l.escalation_level === "Initial");
        const hasSecond = logs.some((l) => l.escalation_level === "Second Escalation");

        // ── First escalation ──────────────────────────────────────────────────
        if (!hasInitial && minutesElapsed >= threshold) {
          console.log(`First escalation for alert ${alertId} (${minutesElapsed}min elapsed)`);

          // Insert escalation_log
          await supabase.from("escalation_log").insert({
            alert_event_id: alertId,
            escalation_level: "Initial",
            resolved_before_escalation: false,
            created_at: new Date().toISOString(),
          });

          // Send email
          if (managerEmail) {
            const html = buildEscalationEmail({ ...emailParams, escalationLevel: "Initial" });
            await resend.emails.send({
              from: "reports@standingrockstewards.com",
              to: managerEmail,
              cc: "alerts@standingrockstewards.com",
              subject: `[ESCALATION] ${severity} Alert — ${emailParams.propertyNickname} — Action Required`,
              html,
            });
          }

          // Mark notification_sent on alert
          await supabase
            .from("alert_events")
            .update({ notification_sent: true })
            .eq("id", alertId);

          escalationsProcessed++;
        }

        // ── Second escalation ─────────────────────────────────────────────────
        else if (hasInitial && !hasSecond && minutesElapsed >= threshold * 2) {
          console.log(`Second escalation for alert ${alertId} (${minutesElapsed}min elapsed)`);

          await supabase.from("escalation_log").insert({
            alert_event_id: alertId,
            escalation_level: "Second Escalation",
            resolved_before_escalation: false,
            created_at: new Date().toISOString(),
          });

          if (managerEmail) {
            const html = buildEscalationEmail({
              ...emailParams,
              escalationLevel: "Second Escalation",
            });
            await resend.emails.send({
              from: "reports@standingrockstewards.com",
              to: managerEmail,
              cc: "alerts@standingrockstewards.com",
              subject: `[SECOND ESCALATION] — ${emailParams.propertyNickname} — Immediate Attention Required`,
              html,
            });
          }

          escalationsProcessed++;
        }
      } catch (alertErr) {
        console.error("Error processing alert escalation:", alertErr);
        // Continue processing other alerts
      }
    }

    console.log(`process-escalations complete: ${escalationsProcessed} escalations sent`);
    return jsonResponse({ success: true, escalations_processed: escalationsProcessed });
  } catch (err) {
    console.error("Unhandled error in process-escalations:", err);
    return jsonResponse({ error: "Internal server error", detail: String(err) }, 500);
  }
});
