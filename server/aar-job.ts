/**
 * aar-job.ts — After-Action Report scheduler + per-report email dispatcher
 *
 * Schedules a daily job at EOD_REPORT_HOUR (UTC, default 22 = 5 PM CDT).
 * At run time, finds all visit reports submitted today and emails the property
 * owner for each one.
 *
 * Also exports sendAARForReport() so the admin can trigger a one-off re-send.
 */

import cron from "node-cron";
import { storage } from "./storage";
import { sendMail, buildAARHtml, type ReportEmailData } from "./mailer";
import { log } from "./index";

// ─── REPORT DATA BUILDER ─────────────────────────────────────────────────────

export function buildReportEmailData(
  report: any,
  property: any,
  tech: any,
  isPreview = false
): ReportEmailData {
  let checklistData: Record<string, { status: string; note?: string }> | null = null;
  if (report.checklist_data) {
    if (typeof report.checklist_data === "string") {
      try {
        checklistData = JSON.parse(report.checklist_data);
      } catch {
        checklistData = null;
      }
    } else {
      checklistData = report.checklist_data;
    }
  }

  // visitDate: prefer completed_at date, fallback to created_at
  const rawDate: string = report.completed_at ?? report.created_at ?? new Date().toISOString();
  const visitDate = rawDate.split("T")[0]; // "2026-07-22"

  return {
    propertyNickname: property.nickname ?? property.owner_name ?? "Your Property",
    ownerName: property.ownerName ?? property.owner_name ?? "",
    visitDate,
    overallStatus: report.overall_status ?? "all_clear",
    summaryNote: report.note ?? "",
    techName: tech?.name ?? "Standing Rock Field Tech",
    checklistData,
    photos: report.photos ?? [],
    isPreview,
  };
}

// ─── SEND ONE REPORT ─────────────────────────────────────────────────────────

export async function sendAARForReport(
  reportId: number,
  overrideTo?: string
): Promise<{ ok: boolean; to: string; error?: string }> {
  try {
    const report = storage.getVisitReportById(reportId);
    if (!report) throw new Error(`Report ${reportId} not found`);

    const property = storage.getPropertyById(report.property_id);
    if (!property) throw new Error(`Property ${report.property_id} not found`);

    const tech = storage.getUserById(report.tech_id);

    const to = overrideTo ?? property.ownerEmail ?? property.owner_email;
    if (!to) throw new Error("No owner email on property record");

    const emailData = buildReportEmailData(report, property, tech);
    const html = buildAARHtml(emailData);

    const subject = `After-Action Report — ${emailData.propertyNickname} — ${new Date(emailData.visitDate + "T12:00:00").toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" })}`;

    await sendMail({ to, subject, html });
    log(`AAR sent for report ${reportId} → ${to}`, "aar");
    return { ok: true, to };
  } catch (err: any) {
    log(`AAR send failed for report ${reportId}: ${err.message}`, "aar");
    return { ok: false, to: overrideTo ?? "", error: err.message };
  }
}

// ─── BUILD PREVIEW HTML (no send) ───────────────────────────────────────────

export function buildAARPreviewHtml(reportId: number): string {
  const report = storage.getVisitReportById(reportId);
  if (!report) throw new Error(`Report ${reportId} not found`);

  const property = storage.getPropertyById(report.property_id);
  if (!property) throw new Error(`Property ${report.property_id} not found`);

  const tech = storage.getUserById(report.tech_id);
  const emailData = buildReportEmailData(report, property, tech, true);
  return buildAARHtml(emailData);
}

// ─── EOD BATCH JOB ──────────────────────────────────────────────────────────

export function startAARScheduler(): void {
  const hour = parseInt(process.env.EOD_REPORT_HOUR ?? "22", 10); // UTC default = 5 PM CDT
  const cronExpr = `0 ${hour} * * *`; // every day at HH:00 UTC

  log(`AAR scheduler registered — daily at ${hour}:00 UTC (${(hour + 19) % 24}:00 CDT)`, "aar");

  cron.schedule(cronExpr, async () => {
    log("AAR batch job starting…", "aar");

    const today = new Date().toISOString().split("T")[0]; // "2026-07-22"
    const allReports = storage.getAllVisitReports();
    const todayReports = allReports.filter((r) => {
      const d = (r.completed_at ?? r.created_at ?? "").split("T")[0];
      return d === today;
    });

    if (todayReports.length === 0) {
      log("AAR batch: no visits completed today, nothing to send.", "aar");
      return;
    }

    log(`AAR batch: ${todayReports.length} report(s) to send.`, "aar");

    for (const report of todayReports) {
      const result = await sendAARForReport(report.id);
      if (!result.ok) {
        log(`AAR batch: FAILED for report ${report.id} — ${result.error}`, "aar");
      }
    }

    log("AAR batch job complete.", "aar");
  });
}
