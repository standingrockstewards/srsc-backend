import jsPDF from "jspdf";
import type { Visit, Property, VisitPhoto, VendorDispatch, Recommendation } from "../../../../shared/schema";
import { CHECKLIST_MODULES, getResultLabel } from "./checklist";

const CHARCOAL = "#1C1C1C";   // Deep charcoal — primary dark
const RED_CLAY = "#A0432F";   // Oklahoma red clay — brand accent
const SAGE = "#7A8C6E";       // Sage green — secondary
const CREAM = "#F5F0EA";      // Cream — page/light bg
const CREAM_DK = "#EDE7DF";   // Cream dark — section backgrounds
const DARK_GRAY = "#333333";
const MED_GRAY = "#666666";
const PASS_GREEN = "#2E7D32";
const FLAG_AMBER = "#E65100";
const FAIL_RED = "#C62828";

type AAROptions = {
  visit: Visit;
  property: Property;
  photos: VisitPhoto[];
  vendors: VendorDispatch[];
  recommendations: Recommendation[];
};

export function generateAAR({ visit, property, photos, vendors, recommendations }: AAROptions) {
  const pdf = new jsPDF({ orientation: "portrait", unit: "mm", format: "letter" });
  const W = 215.9; // letter width mm
  const MARGIN = 15;
  const CONTENT_W = W - MARGIN * 2;
  let y = 0;

  // ─── HELPERS ─────────────────────────────────────────────────────────────
  const newPage = () => {
    pdf.addPage();
    y = 0;
    drawPageHeader();
  };

  const checkPageBreak = (neededHeight: number) => {
    if (y + neededHeight > 255) newPage();
  };

  const drawPageHeader = () => {
    // Charcoal header bar
    pdf.setFillColor(28, 28, 28);
    pdf.rect(0, 0, W, 16, "F");
    // Red clay accent line
    pdf.setFillColor(160, 67, 47);
    pdf.rect(0, 16, W, 1.5, "F");
    pdf.setTextColor(255, 255, 255);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.text("STANDING ROCK STEWARDSHIP CO.", MARGIN, 10);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.text("After Action Report", W / 2, 10, { align: "center" });
    pdf.text(`${property.nickname}  ·  ${visit.visitDate}`, W - MARGIN, 10, { align: "right" });
    y = 24;
  };

  // ─── COVER PAGE ───────────────────────────────────────────────────────────
  // Full charcoal header
  pdf.setFillColor(28, 28, 28);
  pdf.rect(0, 0, W, 80, "F");
  pdf.setFillColor(160, 67, 47);
  pdf.rect(0, 80, W, 2, "F");

  // Title
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(22);
  pdf.text("After Action Report", MARGIN, 30);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(11);
  pdf.setTextColor(237, 231, 223); // cream-dk
  pdf.text("We stand watch. Your investment stands firm.", MARGIN, 40);

  // Property info box
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(14);
  pdf.setTextColor(255, 255, 255);
  pdf.text(property.nickname, MARGIN, 55);
  pdf.setFont("helvetica", "normal");
  pdf.setFontSize(9);
  pdf.setTextColor(237, 231, 223); // cream-dk
  pdf.text(`${property.address}, ${property.city}, ${property.state} ${property.zip}`, MARGIN, 62);
  pdf.text(`Owner: ${property.ownerName}  ·  ${property.ownerPhone}`, MARGIN, 68);

  y = 88;

  // Visit details grid
  const col1 = MARGIN, col2 = MARGIN + CONTENT_W / 2;
  const infoItems = [
    ["Visit Date", visit.visitDate ?? "—"],
    ["Visit Type", visit.visitType?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "—"],
    ["Duration", visit.durationMinutes ? `${visit.durationMinutes} min` : "—"],
    ["Weather", `${visit.weatherTemp ? visit.weatherTemp + "°F" : ""} ${visit.weatherConditions ?? "—"}`.trim()],
    ["Field Technician", visit.techSignature ?? "—"],
    ["Service Tier", property.serviceTier?.replace(/_/g, " ").replace(/\b\w/g, c => c.toUpperCase()) ?? "—"],
  ];

  pdf.setTextColor(DARK_GRAY);
  infoItems.forEach(([label, value], i) => {
    const col = i % 2 === 0 ? col1 : col2;
    const row = y + Math.floor(i / 2) * 12;
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(7);
    pdf.setTextColor(MED_GRAY);
    pdf.text(label.toUpperCase(), col, row);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(10);
    pdf.setTextColor(DARK_GRAY);
    pdf.text(value, col, row + 5);
  });

  y += 40;

  // Overall Status badge
  const statusColor = visit.overallStatus === "all_clear" ? [46, 125, 50] :
    visit.overallStatus === "items_flagged" ? [230, 81, 0] : [198, 40, 40];
  const statusLabel = visit.overallStatus === "all_clear" ? "ALL CLEAR" :
    visit.overallStatus === "items_flagged" ? "ITEMS FLAGGED" : "ACTION REQUIRED";

  pdf.setFillColor(statusColor[0], statusColor[1], statusColor[2]);
  pdf.roundedRect(MARGIN, y, 70, 12, 3, 3, "F");
  pdf.setTextColor(255, 255, 255);
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.text(statusLabel, MARGIN + 35, y + 8, { align: "center" });

  y += 24;

  // ─── CHECKLIST RESULTS ───────────────────────────────────────────────────
  const checklistData = visit.checklistData ? JSON.parse(visit.checklistData) : {};

  drawPageHeader();

  for (const module of CHECKLIST_MODULES) {
    const modData = checklistData[module.key] ?? {};
    const items = module.items.filter(item => modData[item.key]?.result);
    if (!items.length) continue;

    checkPageBreak(20);

    // Module header
    pdf.setFillColor(237, 231, 223); // cream-dk
    pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(28, 28, 28); // charcoal
    pdf.text(module.label.toUpperCase(), MARGIN + 3, y + 5.5);
    y += 10;

    for (const item of items) {
      const result = modData[item.key];
      const resultVal = result?.result;
      if (!resultVal) continue;

      checkPageBreak(10);

      // Row background for flagged/failed
      if (resultVal === "fail") { pdf.setFillColor(255, 235, 235); pdf.rect(MARGIN, y, CONTENT_W, 8, "F"); }
      if (resultVal === "flag") { pdf.setFillColor(255, 248, 225); pdf.rect(MARGIN, y, CONTENT_W, 8, "F"); }

      // Bullet
      const bulletColor = resultVal === "pass" ? PASS_GREEN : resultVal === "flag" ? FLAG_AMBER : FAIL_RED;
      pdf.setFillColor(bulletColor);
      pdf.circle(MARGIN + 2.5, y + 4, 1.5, "F");

      // Label
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(8);
      pdf.setTextColor(DARK_GRAY);
      const labelLines = pdf.splitTextToSize(item.label, CONTENT_W - 30);
      pdf.text(labelLines[0], MARGIN + 6, y + 5);

      // Result
      const rColor = resultVal === "pass" ? PASS_GREEN : resultVal === "flag" ? FLAG_AMBER : FAIL_RED;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(rColor);
      pdf.text(getResultLabel(resultVal), W - MARGIN, y + 5, { align: "right" });

      y += 8;

      // Notes
      if (result.notes) {
        checkPageBreak(8);
        pdf.setFont("helvetica", "italic");
        pdf.setFontSize(7);
        pdf.setTextColor(MED_GRAY);
        const noteLines = pdf.splitTextToSize(`Note: ${result.notes}`, CONTENT_W - 10);
        noteLines.forEach((line: string) => {
          pdf.text(line, MARGIN + 8, y + 4);
          y += 5;
        });
      }

      // Photos for this item
      const itemPhotos = photos.filter(p => p.checklistItemKey === `${module.key}.${item.key}`);
      for (const photo of itemPhotos) {
        checkPageBreak(50);
        try {
          pdf.addImage(photo.dataUrl, "JPEG", MARGIN + 8, y, 60, 45);
          y += 48;
        } catch {}
      }
    }

    y += 4;
  }

  // ─── ACTIONS TAKEN ────────────────────────────────────────────────────────
  if (visit.actionsTaken) {
    checkPageBreak(24);
    pdf.setFillColor(237, 231, 223);
    pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(28, 28, 28);
    pdf.text("ACTIONS TAKEN", MARGIN + 3, y + 5.5);
    y += 12;
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(8);
    pdf.setTextColor(DARK_GRAY);
    const actionLines = pdf.splitTextToSize(visit.actionsTaken, CONTENT_W - 4);
    actionLines.forEach((line: string) => {
      checkPageBreak(6);
      pdf.text(line, MARGIN + 3, y);
      y += 5;
    });
    y += 4;
  }

  // ─── VENDOR DISPATCHES ────────────────────────────────────────────────────
  if (vendors.length > 0) {
    checkPageBreak(20);
    pdf.setFillColor(237, 231, 223);
    pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(28, 28, 28);
    pdf.text("VENDOR DISPATCHES", MARGIN + 3, y + 5.5);
    y += 12;
    vendors.forEach(v => {
      checkPageBreak(16);
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(8);
      pdf.setTextColor(DARK_GRAY);
      pdf.text(`${v.vendorName}  —  ${v.dateDispatched}`, MARGIN + 3, y);
      y += 5;
      pdf.setFont("helvetica", "normal");
      pdf.setFontSize(7.5);
      pdf.setTextColor(MED_GRAY);
      pdf.text(`${v.reason}  ·  Approval: ${v.approvalObtained ? "Yes" : "No"}${v.estimatedCost ? `  ·  Est. $${v.estimatedCost.toFixed(2)}` : ""}`, MARGIN + 6, y);
      y += 8;
    });
    y += 2;
  }

  // ─── RECOMMENDATIONS ─────────────────────────────────────────────────────
  if (recommendations.length > 0) {
    checkPageBreak(20);
    pdf.setFillColor(237, 231, 223);
    pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(9);
    pdf.setTextColor(28, 28, 28);
    pdf.text("RECOMMENDATIONS", MARGIN + 3, y + 5.5);
    y += 12;
    recommendations.forEach(rec => {
      checkPageBreak(14);
      const priorityColor = rec.priority === "Urgent" ? FAIL_RED : rec.priority === "High" ? FLAG_AMBER : DARK_GRAY;
      pdf.setFont("helvetica", "bold");
      pdf.setFontSize(7.5);
      pdf.setTextColor(priorityColor);
      pdf.text(`[${rec.priority?.toUpperCase()}]`, MARGIN + 3, y);
      pdf.setFont("helvetica", "normal");
      pdf.setTextColor(DARK_GRAY);
      const recLines = pdf.splitTextToSize(rec.description, CONTENT_W - 20);
      pdf.text(recLines[0], MARGIN + 18, y);
      y += 6;
    });
    y += 2;
  }

  // ─── BILLING SUMMARY ─────────────────────────────────────────────────────
  checkPageBreak(36);
  pdf.setFillColor(237, 231, 223);
  pdf.rect(MARGIN, y, CONTENT_W, 8, "F");
  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(9);
  pdf.setTextColor(28, 28, 28);
  pdf.text("BILLING SUMMARY", MARGIN + 3, y + 5.5);
  y += 12;

  const hours = visit.hoursWorked ?? 0;
  const rate = visit.hourlyRate ?? 85;
  const materials = visit.materialsAmount ?? 0;
  const mileageMiles = visit.mileage ?? 0;
  const mileageAmt = mileageMiles * 0.67;
  const total = hours * rate + materials + mileageAmt;

  const billLines = [
    [`Labor (${hours}h × $${rate}/hr)`, `$${(hours * rate).toFixed(2)}`],
    ...(materials > 0 ? [["Materials", `$${materials.toFixed(2)}`]] : []),
    ...(mileageMiles > 0 ? [[`Mileage (${mileageMiles} mi × $0.67)`, `$${mileageAmt.toFixed(2)}`]] : []),
    ["TOTAL DUE", `$${total.toFixed(2)}`],
  ];

  billLines.forEach(([label, value], i) => {
    const isTotal = i === billLines.length - 1;
    if (isTotal) {
      pdf.setFillColor(160, 67, 47); // red clay for total row
      pdf.rect(MARGIN, y - 2, CONTENT_W, 8, "F");
      pdf.setTextColor(255, 255, 255);
    } else {
      pdf.setTextColor(DARK_GRAY);
    }
    pdf.setFont("helvetica", isTotal ? "bold" : "normal");
    pdf.setFontSize(8);
    pdf.text(label, MARGIN + 3, y + 3.5);
    pdf.text(value, W - MARGIN - 3, y + 3.5, { align: "right" });
    y += 8;
  });

  // ─── SIGNATURE ────────────────────────────────────────────────────────────
  y += 6;
  checkPageBreak(22);
  if (visit.techSignature) {
    pdf.setDrawColor(180, 180, 180);
    pdf.line(MARGIN, y + 10, MARGIN + 80, y + 10);
    pdf.setFont("helvetica", "bold");
    pdf.setFontSize(8);
    pdf.setTextColor(DARK_GRAY);
    pdf.text(visit.techSignature, MARGIN, y + 15);
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(7);
    pdf.setTextColor(MED_GRAY);
    pdf.text(`Field Technician  ·  ${visit.techSignatureDate ?? visit.visitDate}`, MARGIN, y + 19);
    y += 22;
  }

  // ─── FOOTER ON EVERY PAGE ────────────────────────────────────────────────
  const totalPages = pdf.getNumberOfPages();
  for (let p = 1; p <= totalPages; p++) {
    pdf.setPage(p);
    pdf.setFillColor(28, 28, 28); // charcoal footer
    pdf.rect(0, 267, W, 10, "F");
    pdf.setFont("helvetica", "normal");
    pdf.setFontSize(6.5);
    pdf.setTextColor(237, 231, 223); // cream-dk text
    pdf.text(
      "Standing Rock Stewardship Co.  ·  (918) 707-2228  ·  standingrockstewards.com",
      W / 2, 273, { align: "center" }
    );
    pdf.setTextColor(160, 67, 47); // red clay page number
    pdf.text(`Page ${p} of ${totalPages}`, W - MARGIN, 273, { align: "right" });
    pdf.setTextColor(237, 231, 223);
    pdf.text(`Generated: ${new Date().toLocaleString()}`, MARGIN, 273);
  }

  // Save
  pdf.save(`AAR_${property.nickname.replace(/\s+/g, "_")}_${visit.visitDate}.pdf`);
}
