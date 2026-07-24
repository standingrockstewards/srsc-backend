/**
 * mailer.ts — Nodemailer transport + branded HTML email builder
 * Credentials come ONLY from env vars set in Render dashboard.
 * No credentials are ever stored in code.
 */

import nodemailer from "nodemailer";

// ─── TRANSPORT ───────────────────────────────────────────────────────────────

let _transport: nodemailer.Transporter | null = null;

function getTransport(): nodemailer.Transporter {
  if (_transport) return _transport;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT ?? "465", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (!host || !user || !pass) {
    throw new Error(
      "Email not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS in Render environment."
    );
  }

  _transport = nodemailer.createTransport({
    host,
    port,
    secure: port === 465,
    auth: { user, pass },
    tls: { rejectUnauthorized: false }, // Zoho sometimes needs this
  });

  return _transport;
}

export async function sendMail(opts: {
  to: string;
  subject: string;
  html: string;
}): Promise<void> {
  const from = process.env.MAIL_FROM ?? process.env.SMTP_USER ?? "noreply@standingrockstewards.com";
  const transport = getTransport();
  await transport.sendMail({ from, to: opts.to, subject: opts.subject, html: opts.html });
}

// ─── BRAND TOKENS ────────────────────────────────────────────────────────────

const CHARCOAL = "#1C1C1C";
const TERRACOTTA = "#C05A43";
const SAGE = "#7A8C6E";
const CREAM = "#F5F0EA";
const LIGHT_BORDER = "#2E2E2E";
const MUTED = "#888888";

// ─── STATUS HELPERS ──────────────────────────────────────────────────────────

function statusBadge(status: string): string {
  if (!status || status === "na") return "";
  const map: Record<string, { bg: string; color: string; label: string }> = {
    ok: { bg: "#1E3A2A", color: "#4ADE80", label: "OK" },
    attention: { bg: "#3A2A00", color: "#FBBF24", label: "Attention" },
    issue: { bg: "#3A1A1A", color: "#F87171", label: "Issue" },
  };
  const s = map[status];
  if (!s) return "";
  return `<span style="display:inline-block;padding:2px 10px;border-radius:12px;background:${s.bg};color:${s.color};font-size:11px;font-weight:700;letter-spacing:0.5px;">${s.label}</span>`;
}

function overallBadge(status: string): { bg: string; color: string; label: string } {
  if (status === "all_clear") return { bg: SAGE, color: "#fff", label: "All Clear" };
  if (status === "items_flagged" || status === "attention")
    return { bg: "#A07820", color: "#fff", label: "Items Flagged" };
  return { bg: TERRACOTTA, color: "#fff", label: "Action Required" };
}

// ─── CHECKLIST MODULE LABELS (server-side copy — no client import needed) ───

const MODULE_LABELS: Record<string, string> = {
  exterior: "Exterior Condition",
  security: "Security & Monitoring",
  dock: "Dock",
  watercraft: "Watercraft",
  boat_lift: "Boat Lift",
  interior: "Interior",
  generator: "Generator",
  propane: "Propane System",
  irrigation: "Irrigation",
  hvac: "HVAC / Mechanical",
  plumbing: "Plumbing / Water Intrusion",
  pest: "Pest & Wildlife",
  summary: "Site Summary",
};

function moduleLabel(key: string): string {
  return MODULE_LABELS[key] ?? key.charAt(0).toUpperCase() + key.slice(1).replace(/_/g, " ");
}

function itemLabel(itemKey: string): string {
  // itemKey format: "module.item_key"
  const [, item] = itemKey.split(".");
  if (!item) return itemKey;
  return item
    .split("_")
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

// ─── HTML EMAIL BUILDER ──────────────────────────────────────────────────────

export interface ReportEmailData {
  propertyNickname: string;
  ownerName: string;
  visitDate: string; // "2026-07-22"
  overallStatus: string; // "all_clear" | "items_flagged" | "action_required"
  summaryNote: string;
  techName: string;
  checklistData: Record<string, { status: string; note?: string }> | null;
  photos: { data_url: string; caption?: string; item_key?: string | null; filename: string }[];
  /** Admin preview flag — adds a banner and hides the footer unsubscribe copy */
  isPreview?: boolean;
}

export function buildAARHtml(data: ReportEmailData): string {
  const {
    propertyNickname,
    ownerName,
    visitDate,
    overallStatus,
    summaryNote,
    techName,
    checklistData,
    photos,
    isPreview = false,
  } = data;

  const badge = overallBadge(overallStatus);
  const formattedDate = new Date(visitDate + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  // ── Group checklist results by module ──
  type ItemResult = { itemKey: string; status: string; note?: string; photos: typeof photos };
  const modules: Record<string, ItemResult[]> = {};

  if (checklistData) {
    for (const [itemKey, val] of Object.entries(checklistData)) {
      if (!val || !val.status || val.status === "na") continue;
      const [mod] = itemKey.split(".");
      if (!modules[mod]) modules[mod] = [];
      const itemPhotos = photos.filter((p) => p.item_key === itemKey);
      modules[mod].push({ itemKey, status: val.status, note: val.note, photos: itemPhotos });
    }
  }

  // ── Attention / Issue items callout ──
  const flaggedItems: ItemResult[] = Object.values(modules)
    .flat()
    .filter((i) => i.status === "attention" || i.status === "issue");

  // ── Checklist modules HTML ──
  function buildModuleRows(items: ItemResult[]): string {
    return items
      .map((item) => {
        const photoRow =
          item.photos.length > 0
            ? `<tr><td colspan="2" style="padding:4px 0 8px 0;">
                ${item.photos
                  .map(
                    (p) =>
                      `<img src="${p.data_url}" alt="${p.caption ?? "Photo"}" style="width:80px;height:60px;object-fit:cover;border-radius:4px;margin-right:4px;border:1px solid ${LIGHT_BORDER};" />`
                  )
                  .join("")}
               </td></tr>`
            : "";
        const noteRow = item.note
          ? `<tr><td colspan="2" style="padding:2px 0 6px 0;color:${MUTED};font-size:13px;font-style:italic;">${item.note}</td></tr>`
          : "";
        return `
          <tr>
            <td style="padding:8px 0 2px 0;color:${CREAM};font-size:14px;">${itemLabel(item.itemKey)}</td>
            <td style="padding:8px 0 2px 0;text-align:right;">${statusBadge(item.status)}</td>
          </tr>
          ${noteRow}
          ${photoRow}
        `;
      })
      .join("");
  }

  const moduleSections = Object.entries(modules)
    .filter(([mod]) => mod !== "summary")
    .map(([mod, items]) => {
      if (items.length === 0) return "";
      const hasFlags = items.some((i) => i.status === "attention" || i.status === "issue");
      const dotColor = hasFlags ? "#FBBF24" : SAGE;
      return `
        <tr>
          <td style="padding:24px 0 0 0;">
            <table width="100%" cellpadding="0" cellspacing="0" border="0">
              <tr>
                <td style="padding:0 0 8px 0;border-bottom:1px solid ${LIGHT_BORDER};">
                  <span style="display:inline-block;width:8px;height:8px;border-radius:50%;background:${dotColor};margin-right:8px;vertical-align:middle;"></span>
                  <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:${MUTED};text-transform:uppercase;">${moduleLabel(mod)}</span>
                </td>
              </tr>
              ${buildModuleRows(items)}
            </table>
          </td>
        </tr>
      `;
    })
    .join("");

  const flaggedSection =
    flaggedItems.length > 0
      ? `
      <tr>
        <td style="padding:0 0 24px 0;">
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#2A1A00;border-radius:8px;border:1px solid #5A3A00;">
            <tr>
              <td style="padding:16px 20px 4px 20px;">
                <span style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:#FBBF24;text-transform:uppercase;">⚠ Needs Attention</span>
              </td>
            </tr>
            ${flaggedItems
              .map(
                (item) => `
              <tr>
                <td style="padding:6px 20px;">
                  <table width="100%" cellpadding="0" cellspacing="0" border="0">
                    <tr>
                      <td style="color:${CREAM};font-size:14px;">${itemLabel(item.itemKey)}</td>
                      <td style="text-align:right;">${statusBadge(item.status)}</td>
                    </tr>
                    ${item.note ? `<tr><td colspan="2" style="color:${MUTED};font-size:13px;font-style:italic;padding-top:2px;">${item.note}</td></tr>` : ""}
                  </table>
                </td>
              </tr>`
              )
              .join("")}
            <tr><td style="height:12px;"></td></tr>
          </table>
        </td>
      </tr>`
      : "";

  const previewBanner = isPreview
    ? `<tr>
        <td style="background:${TERRACOTTA};padding:10px 32px;text-align:center;font-size:12px;font-weight:700;letter-spacing:1px;color:#fff;text-transform:uppercase;">
          Admin Preview — This is a preview only. No email was sent.
        </td>
       </tr>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width,initial-scale=1.0" />
  <title>After-Action Report — ${propertyNickname}</title>
</head>
<body style="margin:0;padding:0;background:#111111;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;">
    <tr>
      <td align="center" style="padding:32px 16px;">

        <!-- Card -->
        <table width="100%" cellpadding="0" cellspacing="0" border="0"
               style="max-width:600px;background:${CHARCOAL};border-radius:12px;overflow:hidden;border:1px solid ${LIGHT_BORDER};">

          ${previewBanner}

          <!-- Header -->
          <tr>
            <td style="background:#161616;padding:32px 32px 24px 32px;border-bottom:1px solid ${LIGHT_BORDER};">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td>
                    <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:${TERRACOTTA};text-transform:uppercase;margin-bottom:6px;">Standing Rock Stewardship Co.</div>
                    <div style="font-size:26px;font-weight:700;color:${CREAM};line-height:1.2;font-family:Georgia,serif;">Property After-Action Report</div>
                    <div style="font-size:14px;color:${MUTED};margin-top:6px;">${formattedDate}</div>
                  </td>
                  <td style="text-align:right;vertical-align:top;padding-left:16px;">
                    <span style="display:inline-block;padding:6px 16px;border-radius:20px;background:${badge.bg};color:${badge.color};font-size:12px;font-weight:700;letter-spacing:0.5px;">${badge.label}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Property + Tech -->
          <tr>
            <td style="padding:24px 32px 0 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0"
                     style="background:#202020;border-radius:8px;border:1px solid ${LIGHT_BORDER};">
                <tr>
                  <td style="padding:16px 20px;">
                    <table width="100%" cellpadding="0" cellspacing="0" border="0">
                      <tr>
                        <td style="width:50%;padding-right:12px;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:4px;">Property</div>
                          <div style="font-size:15px;font-weight:700;color:${CREAM};">${propertyNickname}</div>
                          <div style="font-size:13px;color:${MUTED};">Owner: ${ownerName}</div>
                        </td>
                        <td style="width:50%;border-left:1px solid ${LIGHT_BORDER};padding-left:20px;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:4px;">Field Technician</div>
                          <div style="font-size:15px;font-weight:700;color:${CREAM};">${techName}</div>
                          <div style="font-size:13px;color:${MUTED};">Standing Rock Stewardship Co.</div>
                        </td>
                      </tr>
                    </table>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Body -->
          <tr>
            <td style="padding:24px 32px 32px 32px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">

                <!-- Summary note -->
                ${
                  summaryNote
                    ? `<tr>
                        <td style="padding:0 0 24px 0;">
                          <div style="font-size:11px;font-weight:700;letter-spacing:1.5px;color:${MUTED};text-transform:uppercase;margin-bottom:8px;">Summary</div>
                          <div style="font-size:15px;color:${CREAM};line-height:1.6;">${summaryNote}</div>
                        </td>
                       </tr>`
                    : ""
                }

                <!-- Flagged items callout -->
                ${flaggedSection}

                <!-- Checklist modules -->
                ${moduleSections}

                <!-- Divider -->
                <tr><td style="height:32px;border-top:1px solid ${LIGHT_BORDER};padding-top:24px;"></td></tr>

                <!-- Footer note (not a timing disclosure) -->
                <tr>
                  <td style="padding-top:8px;font-size:12px;color:${MUTED};line-height:1.6;">
                    This report covers the routine property inspection completed on ${formattedDate}. 
                    For questions or concerns, contact us at 
                    <a href="tel:9187072228" style="color:${TERRACOTTA};text-decoration:none;">(918) 707-2228</a> or 
                    <a href="mailto:info@standingrockstewards.com" style="color:${TERRACOTTA};text-decoration:none;">info@standingrockstewards.com</a>.
                  </td>
                </tr>

              </table>
            </td>
          </tr>

          <!-- Card footer -->
          <tr>
            <td style="background:#161616;padding:16px 32px;border-top:1px solid ${LIGHT_BORDER};text-align:center;">
              <span style="font-size:11px;color:${MUTED};">
                Standing Rock Stewardship Co. · Lake Eufaula, Oklahoma · 
                <a href="https://standingrockstewards.com" style="color:${TERRACOTTA};text-decoration:none;">standingrockstewards.com</a>
              </span>
            </td>
          </tr>

        </table>
        <!-- /Card -->

      </td>
    </tr>
  </table>
</body>
</html>`;
}

// ─── SIGNAL FLARE EMAIL ──────────────────────────────────────────────────────

export interface SignalFlareEmailData {
  propertyName: string;
  raisedByName: string;
  severity: "Low" | "Medium" | "High" | "Critical";
  category: string;
  description: string;
  flareId: number;
  isEscalation?: boolean;
  escalationMinutes?: number;
}

const SEVERITY_COLOR: Record<string, string> = {
  Critical: "#C0392B",
  High:     "#E67E22",
  Medium:   "#D9902B",
  Low:      "#7A8C6E",
};

export function buildSignalFlareHtml(data: SignalFlareEmailData): string {
  const { propertyName, raisedByName, severity, category, description, flareId, isEscalation, escalationMinutes } = data;
  const sev = SEVERITY_COLOR[severity] ?? TERRACOTTA;
  const badge = `<span style="display:inline-block;padding:4px 14px;border-radius:20px;background:${sev};color:#fff;font-size:12px;font-weight:700;letter-spacing:0.5px;">${severity}</span>`;
  const subjectTag = isEscalation ? "⚠️ ESCALATION — Signal Flare Unacknowledged" : "🚨 Signal Flare Raised";
  const headerNote = isEscalation
    ? `<div style="background:#3A1A1A;border:1px solid ${TERRACOTTA};border-radius:8px;padding:12px 16px;margin-bottom:20px;color:#F87171;font-weight:700;font-size:14px;">⚠️ ESCALATION: This flare has not been acknowledged in ${escalationMinutes ?? 15} minutes. Immediate response required.</div>`
    : "";

  return `<!DOCTYPE html>
<html lang="en">
<head><meta charset="UTF-8"/><meta name="viewport" content="width=device-width,initial-scale=1.0"/><title>${subjectTag}</title></head>
<body style="margin:0;padding:0;background:#111111;font-family:'Helvetica Neue',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0" border="0" style="background:#111111;">
    <tr><td align="center" style="padding:32px 16px;">
      <table width="100%" cellpadding="0" cellspacing="0" border="0"
             style="max-width:560px;background:${CHARCOAL};border-radius:12px;overflow:hidden;border:1px solid ${LIGHT_BORDER};">
        <!-- Header -->
        <tr><td style="background:${sev};padding:20px 28px;">
          <div style="font-size:11px;font-weight:700;letter-spacing:2px;color:rgba(255,255,255,0.7);text-transform:uppercase;margin-bottom:4px;">Standing Rock Stewardship Co.</div>
          <div style="font-size:22px;font-weight:700;color:#fff;font-family:Georgia,serif;">${isEscalation ? "⚠️ Escalation Alert" : "🚨 Signal Flare Raised"}</div>
        </td></tr>
        <!-- Body -->
        <tr><td style="padding:24px 28px;">
          ${headerNote}
          <table width="100%" cellpadding="0" cellspacing="0" border="0"
                 style="background:#1e1e1e;border-radius:8px;border:1px solid ${LIGHT_BORDER};margin-bottom:20px;">
            <tr><td style="padding:16px 18px;">
              <table width="100%" cellpadding="0" cellspacing="0" border="0">
                <tr>
                  <td style="padding-bottom:12px;">
                    <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:4px;">Property</div>
                    <div style="font-size:16px;font-weight:700;color:${CREAM};">${propertyName}</div>
                  </td>
                  <td style="text-align:right;vertical-align:top;padding-bottom:12px;">${badge}</td>
                </tr>
                <tr><td colspan="2" style="border-top:1px solid ${LIGHT_BORDER};padding-top:12px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:4px;">Raised By</div>
                  <div style="font-size:14px;color:${CREAM};">${raisedByName}</div>
                </td></tr>
                <tr><td colspan="2" style="padding-top:12px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:4px;">Category</div>
                  <div style="font-size:14px;color:${CREAM};">${category}</div>
                </td></tr>
                <tr><td colspan="2" style="padding-top:12px;">
                  <div style="font-size:11px;font-weight:700;letter-spacing:1px;color:${MUTED};text-transform:uppercase;margin-bottom:4px;">Description</div>
                  <div style="font-size:14px;color:${CREAM};line-height:1.5;">${description}</div>
                </td></tr>
              </table>
            </td></tr>
          </table>
          <div style="text-align:center;padding:8px 0 4px 0;">
            <a href="https://standingrockstewards.com/#/signal-flares/${flareId}"
               style="display:inline-block;background:${TERRACOTTA};color:#fff;font-weight:700;font-size:14px;padding:12px 28px;border-radius:8px;text-decoration:none;letter-spacing:0.3px;">
              View & Respond to Flare
            </a>
          </div>
        </td></tr>
        <!-- Footer -->
        <tr><td style="background:#161616;padding:14px 28px;border-top:1px solid ${LIGHT_BORDER};text-align:center;">
          <span style="font-size:11px;color:${MUTED};">Standing Rock Stewardship Co. · (918) 707-2228 · <a href="https://standingrockstewards.com" style="color:${TERRACOTTA};text-decoration:none;">standingrockstewards.com</a></span>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body>
</html>`;
}
