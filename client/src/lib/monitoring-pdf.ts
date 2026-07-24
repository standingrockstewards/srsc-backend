import jsPDF from "jspdf";
import type { Property, MonitoringDevice, AlertEvent, MonthlyMonitoringReport } from "../../../../shared/schema";

type ReportOptions = {
  property: Property;
  devices: MonitoringDevice[];
  events: AlertEvent[];
  report: {
    periodStart: string;
    periodEnd: string;
    recommendations: string;
    billingHours: number;
    billingRate: number;
    generatedBy: string;
  };
};

export function generateMonitoringReport({ property, devices, events, report }: ReportOptions) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = 215.9;
  const MARGIN = 15;
  const CONTENT_W = W - MARGIN * 2;
  let y = 0;

  const CHARCOAL = [28, 28, 28] as [number, number, number];
  const RED_CLAY = [160, 67, 47] as [number, number, number];
  const CREAM_DK = [237, 231, 223] as [number, number, number];
  const DARK_GRAY = "#333333";
  const MED_GRAY = "#666666";

  const newPage = () => { pdf.addPage(); y = 0; drawPageHeader(); };
  const checkPageBreak = (h: number) => { if (y + h > 255) newPage(); };

  const drawPageHeader = () => {
    pdf.setFillColor(...CHARCOAL);
    pdf.rect(0, 0, W, 16, "F");
    pdf.setFillColor(...RED_CLAY);
    pdf.rect(0, 16, W, 1.5, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("STANDING ROCK STEWARDSHIP CO. — SIGNAL FLARE™", MARGIN, 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("Monthly Monitoring Report", W / 2, 10, { align: "center" });
    pdf.text(`${property.nickname}  ·  ${report.periodStart} – ${report.periodEnd}`, W - MARGIN, 10, { align: "right" });
    y = 24;
  };

  // ── COVER PAGE ──────────────────────────────────────────────────────────────
  pdf.setFillColor(...CHARCOAL);
  pdf.rect(0, 0, W, 80, "F");
  pdf.setFillColor(...RED_CLAY);
  pdf.rect(0, 80, W, 2, "F");

  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("Monthly Monitoring Report", MARGIN, 28);
  pdf.setFont("helvetica", "italic");
  pdf.setFontSize(11);
  pdf.setTextColor(...CREAM_DK);
  pdf.text("Signal Flare™ Remote Monitoring — Standing Rock Stewardship Co.", MARGIN, 38);

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text(property.nickname, MARGIN, 54);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(...CREAM_DK);
  pdf.text(`${property.address}, ${property.city}, ${property.state} ${property.zip}`, MARGIN, 61);
  pdf.text(`Owner: ${property.ownerName}  ·  ${property.ownerPhone}`, MARGIN, 67);
  pdf.text(`Reporting Period: ${report.periodStart} – ${report.periodEnd}`, MARGIN, 73);

  y = 90;

  // ── SUMMARY STATS TABLE ─────────────────────────────────────────────────────
  const periodEvents = events.filter(e =>
    e.eventTimestamp >= report.periodStart && e.eventTimestamp <= report.periodEnd + "T23:59:59"
  );
  const resolvedEvents = periodEvents.filter(e => e.resolved);
  const onlineDevices = devices.filter(d => d.status === "Online").length;
  const uptimePct = devices.length > 0 ? Math.round((onlineDevices / devices.length) * 100) : 100;

  // count by type
  const byType: Record<string, number> = {};
  periodEvents.forEach(e => { byType[e.eventType] = (byType[e.eventType] || 0) + 1; });

  const stats = [
    ["Total Events (Period)", String(periodEvents.length)],
    ["Alerts Resolved", `${resolvedEvents.length} / ${periodEvents.length}`],
    ["Device Online %", `${uptimePct}%  (${onlineDevices} of ${devices.length} devices)`],
    ["Devices Installed", String(devices.length)],
    ["Site Visits Triggered", String(periodEvents.filter(e => e.actionTaken === "Site Visit Initiated").length)],
    ["Emergency Escalations", String(periodEvents.filter(e => e.actionTaken === "Emergency Escalated").length)],
  ];

  // Section header
  pdf.setFillColor(...CREAM_DK);
  pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...CHARCOAL);
  pdf.text("SUMMARY STATISTICS", MARGIN + 3, y + 5.5);
  y += 10;

  stats.forEach(([label, value]) => {
    checkPageBreak(8);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(DARK_GRAY);
    pdf.text(label, MARGIN + 3, y + 4);
    pdf.setFont("helvetica", "bold");
    pdf.text(value, W - MARGIN, y + 4, { align: "right" });
    pdf.setDrawColor(220, 215, 208);
    pdf.line(MARGIN, y + 7, W - MARGIN, y + 7);
    y += 8;
  });

  y += 4;

  // Events by type breakdown
  if (Object.keys(byType).length > 0) {
    checkPageBreak(20);
    pdf.setFillColor(...CREAM_DK);
    pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...CHARCOAL);
    pdf.text("EVENTS BY TYPE", MARGIN + 3, y + 5.5);
    y += 10;

    Object.entries(byType).forEach(([type, count]) => {
      checkPageBreak(8);
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8.5);
      pdf.setTextColor(DARK_GRAY);
      pdf.text(type, MARGIN + 3, y + 4);
      pdf.setFont("helvetica", "bold");
      pdf.text(String(count), W - MARGIN, y + 4, { align: "right" });
      y += 7;
    });
    y += 4;
  }

  // ── DEVICE HEALTH TABLE ─────────────────────────────────────────────────────
  drawPageHeader();
  checkPageBreak(20);

  pdf.setFillColor(...CREAM_DK);
  pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...CHARCOAL);
  pdf.text("DEVICE HEALTH TABLE", MARGIN + 3, y + 5.5);
  y += 10;

  // Column headers
  const cols = [MARGIN, MARGIN + 40, MARGIN + 80, MARGIN + 120, MARGIN + 145, MARGIN + 160];
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(7);
  pdf.setTextColor(MED_GRAY);
  ["DEVICE", "TYPE", "LOCATION", "STATUS", "BATT%", "LAST PING"].forEach((h, i) => {
    pdf.text(h, cols[i], y + 4);
  });
  y += 7;

  devices.forEach(device => {
    checkPageBreak(9);
    const isOffline = device.status === "Offline" || device.status === "Alert";
    if (isOffline) { pdf.setFillColor(255, 240, 240); pdf.rect(MARGIN, y, CONTENT_W, 8, "F"); }

    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(DARK_GRAY);
    const name = pdf.splitTextToSize(device.nickname, 38)[0];
    const loc = pdf.splitTextToSize(device.locationDescription || "—", 38)[0];
    const ping = device.lastPing ? new Date(device.lastPing).toLocaleDateString() : "—";
    const batt = device.batteryLevel !== null ? `${device.batteryLevel}%` : "N/A";

    pdf.text(name, cols[0], y + 5.5);
    pdf.text(device.deviceType, cols[1], y + 5.5);
    pdf.text(loc, cols[2], y + 5.5);

    if (isOffline) { pdf.setTextColor(...RED_CLAY); }
    else { pdf.setTextColor(46, 125, 50); }
    pdf.text(device.status, cols[3], y + 5.5);

    pdf.setTextColor(device.batteryLevel !== null && device.batteryLevel < 20 ? 180 : 80, device.batteryLevel !== null && device.batteryLevel < 20 ? 40 : 80, 80);
    pdf.text(batt, cols[4], y + 5.5);

    pdf.setTextColor(DARK_GRAY);
    pdf.text(ping, cols[5], y + 5.5);
    y += 9;
  });
  y += 6;

  // ── ALERT LOG ───────────────────────────────────────────────────────────────
  checkPageBreak(20);
  pdf.setFillColor(...CREAM_DK);
  pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...CHARCOAL);
  pdf.text(`ALERT LOG — ${report.periodStart} TO ${report.periodEnd}`, MARGIN + 3, y + 5.5);
  y += 10;

  if (periodEvents.length === 0) {
    pdf.setFont("helvetica", "italic");
    pdf.setFontSize(8.5);
    pdf.setTextColor(MED_GRAY);
    pdf.text("No events recorded during this period.", MARGIN + 3, y + 4);
    y += 10;
  } else {
    periodEvents.forEach(event => {
      checkPageBreak(14);
      const device = devices.find(d => d.id === event.deviceId);
      const sevColor: Record<string, [number, number, number]> = {
        Low: [59, 130, 246],
        Medium: [202, 138, 4],
        High: [234, 88, 12],
        Emergency: [220, 38, 38],
      };
      const sc = sevColor[event.severity] || [100, 100, 100];

      pdf.setFillColor(sc[0], sc[1], sc[2]);
      pdf.circle(MARGIN + 2, y + 4, 1.5, "F");

      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(...CHARCOAL);
      pdf.text(`${new Date(event.eventTimestamp).toLocaleString()}`, MARGIN + 6, y + 3);

      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(DARK_GRAY);
      const evLine = `[${event.severity}] ${event.eventType}${device ? ` — ${device.nickname}` : ""} — ${event.description}`;
      const wrapped = pdf.splitTextToSize(evLine, CONTENT_W - 8);
      pdf.text(wrapped[0], MARGIN + 6, y + 8);

      pdf.setTextColor(event.resolved ? 46 : 180, event.resolved ? 125 : 50, event.resolved ? 50 : 50);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7);
      pdf.text(event.resolved ? `✓ ${event.actionTaken}` : "⏳ Pending", W - MARGIN, y + 5, { align: "right" });

      y += 13;
    });
  }

  // ── RECOMMENDATIONS ─────────────────────────────────────────────────────────
  if (report.recommendations) {
    checkPageBreak(24);
    pdf.setFillColor(...CREAM_DK);
    pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(...CHARCOAL);
    pdf.text("RECOMMENDATIONS", MARGIN + 3, y + 5.5);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8.5);
    pdf.setTextColor(DARK_GRAY);
    const recLines = pdf.splitTextToSize(report.recommendations, CONTENT_W - 4);
    recLines.forEach((line: string) => {
      checkPageBreak(6);
      pdf.text(line, MARGIN + 3, y);
      y += 5.5;
    });
    y += 4;
  }

  // ── BILLING ─────────────────────────────────────────────────────────────────
  checkPageBreak(36);
  pdf.setFillColor(...CREAM_DK);
  pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(...CHARCOAL);
  pdf.text("BILLING SUMMARY", MARGIN + 3, y + 5.5);
  y += 12;

  const total = report.billingHours * report.billingRate;
  const billLines = [
    [`Monitoring Service (${report.billingHours}h × $${report.billingRate}/hr)`, `$${(report.billingHours * report.billingRate).toFixed(2)}`],
    ["TOTAL DUE", `$${total.toFixed(2)}`],
  ];
  billLines.forEach(([label, value], i) => {
    const isTotal = i === billLines.length - 1;
    if (isTotal) { pdf.setFillColor(...RED_CLAY); pdf.rect(MARGIN, y - 2, CONTENT_W, 8, "F"); pdf.setTextColor(255, 255, 255); }
    else { pdf.setTextColor(DARK_GRAY); }
    pdf.setFont("helvetica", isTotal ? "bold" : "normal");
    pdf.setFontSize(8.5);
    pdf.text(label, MARGIN + 3, y + 3.5);
    pdf.text(value, W - MARGIN - 3, y + 3.5, { align: "right" });
    y += 8;
  });

  // ── FOOTER ──────────────────────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFillColor(...CHARCOAL);
    pdf.rect(0, 267, W, 10, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(...CREAM_DK);
    pdf.text("Standing Rock Stewardship Co. · Signal Flare™ · (918) 707-2228 · standingrockstewards.com", W / 2, 273, { align: "center" });
    pdf.setTextColor(...RED_CLAY);
    pdf.text(`Page ${p} of ${totalPages}`, W - MARGIN, 273, { align: "right" });
    pdf.setTextColor(...CREAM_DK);
    pdf.text(`Generated: ${new Date().toLocaleString()} · By: ${report.generatedBy}`, MARGIN, 273);
  }

  pdf.save(`MonitoringReport_${property.nickname.replace(/\s+/g, "_")}_${report.periodStart}.pdf`);
}
