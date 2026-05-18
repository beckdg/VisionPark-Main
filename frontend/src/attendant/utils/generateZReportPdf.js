import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const PAGE_W = 420;
const PAGE_H = 640;
const MARGIN = 36;

const formatEtb = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0.00";
  return n.toFixed(2);
};

function wrapText(font, text, maxWidth, fontSize) {
  const words = String(text || "—").split(/\s+/).filter(Boolean);
  if (words.length === 0) return ["—"];
  const lines = [];
  let line = "";
  for (const w of words) {
    const next = line ? `${line} ${w}` : w;
    if (font.widthOfTextAtSize(next, fontSize) <= maxWidth) line = next;
    else {
      if (line) lines.push(line);
      line = w;
    }
  }
  if (line) lines.push(line);
  return lines;
}

function drawDashedRule(page, y) {
  const dashLen = 6;
  const gap = 4;
  let x = MARGIN;
  while (x < PAGE_W - MARGIN) {
    const end = Math.min(x + dashLen, PAGE_W - MARGIN);
    page.drawLine({
      start: { x, y },
      end: { x: end, y },
      thickness: 0.8,
      color: rgb(0.75, 0.75, 0.78),
    });
    x += dashLen + gap;
  }
}

function drawRow(page, font, fontBold, label, value, y, valueSize = 10) {
  page.drawText(label, {
    x: MARGIN,
    y,
    size: 8.5,
    font: fontBold,
    color: rgb(0.45, 0.45, 0.5),
  });
  const val = String(value ?? "—");
  const valW = font.widthOfTextAtSize(val, valueSize);
  page.drawText(val, {
    x: PAGE_W - MARGIN - valW,
    y,
    size: valueSize,
    font: fontBold,
    color: rgb(0.09, 0.09, 0.11),
  });
  return y - 16;
}

/**
 * Builds a downloadable PDF for an end-of-shift Z-Report.
 * @param {object} report — Z-report summary from close-shift response / UI state
 */
export async function generateZReportPdf(report) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([PAGE_W, PAGE_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const emerald = rgb(0.06, 0.73, 0.51);
  const emeraldDark = rgb(0.05, 0.46, 0.33);
  const zinc900 = rgb(0.09, 0.09, 0.11);

  const headerH = 118;
  page.drawRectangle({
    x: 0,
    y: PAGE_H - headerH,
    width: PAGE_W,
    height: headerH,
    color: emerald,
  });

  let y = PAGE_H - MARGIN - 8;
  const title = "VisionPark";
  const titleW = fontBold.widthOfTextAtSize(title, 20);
  page.drawText(title, {
    x: (PAGE_W - titleW) / 2,
    y,
    size: 20,
    font: fontBold,
    color: zinc900,
  });
  y -= 18;

  const branch = String(report?.branchName || "Branch").toUpperCase();
  const branchW = font.widthOfTextAtSize(branch, 8);
  page.drawText(branch, {
    x: (PAGE_W - branchW) / 2,
    y,
    size: 8,
    font,
    color: emeraldDark,
  });
  y -= 22;

  const badge = "END OF SHIFT Z-REPORT";
  const badgeW = fontBold.widthOfTextAtSize(badge, 9);
  const badgePadX = 10;
  const badgeWTotal = badgeW + badgePadX * 2;
  const badgeX = (PAGE_W - badgeWTotal) / 2;
  page.drawRectangle({
    x: badgeX,
    y: y - 4,
    width: badgeWTotal,
    height: 18,
    color: rgb(1, 1, 1),
    opacity: 0.25,
  });
  page.drawText(badge, {
    x: badgeX + badgePadX,
    y,
    size: 9,
    font: fontBold,
    color: zinc900,
  });

  y = PAGE_H - headerH - 24;

  const metaRows = [
    ["REPORT ID", report?.id ?? "—"],
    ["DATE", report?.date ?? "—"],
    ["OPENED", report?.startTime ?? "—"],
    ["CLOSED", report?.endTime ?? "—"],
    ["OPERATOR", report?.operatorName ?? "—"],
  ];

  for (const [label, value] of metaRows) {
    y = drawRow(page, font, fontBold, label, value, y, 9);
  }

  y -= 8;
  drawDashedRule(page, y);
  y -= 20;

  y = drawRow(
    page,
    font,
    fontBold,
    "CASH TRANSACTIONS",
    String(report?.transactions ?? 0),
    y,
    10
  );
  y -= 4;

  y = drawRow(
    page,
    font,
    fontBold,
    "SYSTEM EXPECTED",
    `${formatEtb(report?.expected)} ETB`,
    y,
    12
  );
  y -= 2;

  y = drawRow(
    page,
    font,
    fontBold,
    "DECLARED CASH",
    `${formatEtb(report?.actual)} ETB`,
    y,
    12
  );
  y -= 10;

  const variance = Number(report?.variance ?? 0);
  const isExact = variance === 0;
  const isShort = variance < 0;
  const boxColor = isExact
    ? rgb(0.9, 0.98, 0.95)
    : isShort
      ? rgb(0.99, 0.92, 0.92)
      : rgb(0.92, 0.96, 0.99);
  const borderColor = isExact
    ? emerald
    : isShort
      ? rgb(0.86, 0.15, 0.15)
      : rgb(0.23, 0.51, 0.96);
  const textColor = isExact
    ? emeraldDark
    : isShort
      ? rgb(0.6, 0.1, 0.1)
      : rgb(0.12, 0.35, 0.7);

  const boxH = 36;
  page.drawRectangle({
    x: MARGIN,
    y: y - boxH + 12,
    width: PAGE_W - MARGIN * 2,
    height: boxH,
    color: boxColor,
    borderColor,
    borderWidth: 1.5,
  });

  page.drawText("VARIANCE", {
    x: MARGIN + 12,
    y: y - 8,
    size: 9,
    font: fontBold,
    color: rgb(0.45, 0.45, 0.5),
  });

  const varianceLabel = `${variance > 0 ? "+" : ""}${formatEtb(variance)} ETB`;
  const varW = fontBold.widthOfTextAtSize(varianceLabel, 14);
  page.drawText(varianceLabel, {
    x: PAGE_W - MARGIN - 12 - varW,
    y: y - 10,
    size: 14,
    font: fontBold,
    color: textColor,
  });

  y -= boxH + 8;

  const status = String(report?.status || "EXACT MATCH").toUpperCase();
  const statusW = fontBold.widthOfTextAtSize(`*** ${status} ***`, 10);
  page.drawText(`*** ${status} ***`, {
    x: (PAGE_W - statusW) / 2,
    y,
    size: 10,
    font: fontBold,
    color: textColor,
  });

  y -= 28;
  drawDashedRule(page, y);
  y -= 16;

  const footLines = wrapText(
    font,
    "Report automatically synced to Admin Ledger. Generated by VisionPark attendant shift close.",
    PAGE_W - MARGIN * 2,
    7.5
  );
  for (const ln of footLines) {
    const lw = font.widthOfTextAtSize(ln, 7.5);
    page.drawText(ln, {
      x: (PAGE_W - lw) / 2,
      y,
      size: 7.5,
      font,
      color: rgb(0.55, 0.55, 0.58),
    });
    y -= 10;
  }

  const generatedAt = new Date().toLocaleString();
  const genLabel = `Generated ${generatedAt}`;
  const genW = font.widthOfTextAtSize(genLabel, 7);
  page.drawText(genLabel, {
    x: (PAGE_W - genW) / 2,
    y: MARGIN,
    size: 7,
    font,
    color: rgb(0.6, 0.6, 0.62),
  });

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeId = String(report?.id || "zreport")
    .replace(/[^a-zA-Z0-9-_]/g, "")
    .slice(-12) || "zreport";
  a.href = url;
  a.download = `VisionPark-Z-Report-${safeId}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
