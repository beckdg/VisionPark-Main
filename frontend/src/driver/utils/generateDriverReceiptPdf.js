import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

const A4_W = 595.28;
const A4_H = 841.89;
const MARGIN = 48;

const formatDateTime = (iso) => {
  if (!iso) return "—";
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return "—";
  return dt.toLocaleString("en-US", { dateStyle: "medium", timeStyle: "short" });
};

const formatEtb = (value) => {
  const n = Number(value);
  if (!Number.isFinite(n)) return "0";
  return new Intl.NumberFormat("en-US", {
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(n);
};

const formatDuration = (h, m, s) =>
  `${String(h ?? 0).padStart(2, "0")} : ${String(m ?? 0).padStart(2, "0")} : ${String(s ?? 0).padStart(2, "0")}`;

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

function drawStamp(page, fontBold, merchant, stampX, stampBottomY, stampW, stampH) {
  page.drawRectangle({
    x: stampX,
    y: stampBottomY,
    width: stampW,
    height: stampH,
    borderColor: rgb(0.72, 0.14, 0.14),
    borderWidth: 1.1,
  });
  page.drawRectangle({
    x: stampX + 2,
    y: stampBottomY + 2,
    width: stampW - 4,
    height: stampH - 4,
    borderColor: rgb(0.88, 0.42, 0.42),
    borderWidth: 0.45,
  });
  const lines = wrapText(fontBold, merchant, stampW - 14, 9.5).slice(0, 4);
  let ty = stampBottomY + stampH - 14;
  for (const ln of lines) {
    const w = fontBold.widthOfTextAtSize(ln, 9.5);
    page.drawText(ln, {
      x: stampX + (stampW - w) / 2,
      y: ty,
      size: 9.5,
      font: fontBold,
      color: rgb(0.62, 0.1, 0.1),
    });
    ty -= 11;
  }
}

/**
 * Builds a downloadable PDF e-receipt for a driver history session.
 * @param {object} session — UI session object from DriverHistory (mapSessionToUI).
 */
export async function generateDriverReceiptPdf(session) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([A4_W, A4_H]);
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const merchant = (session?.merchantName && String(session.merchantName).trim()) || "Parking facility";

  const title = "VisionPark";
  const titleW = fontBold.widthOfTextAtSize(title, 22);
  page.drawText(title, {
    x: (A4_W - titleW) / 2,
    y: A4_H - MARGIN - 4,
    size: 22,
    font: fontBold,
    color: rgb(0.09, 0.09, 0.11),
  });

  const sub = "Parking session e-receipt";
  const subW = font.widthOfTextAtSize(sub, 10);
  page.drawText(sub, {
    x: (A4_W - subW) / 2,
    y: A4_H - MARGIN - 30,
    size: 10,
    font,
    color: rgb(0.35, 0.35, 0.4),
  });

  const stampW = 188;
  const stampH = 58;
  const stampX = A4_W - MARGIN - stampW;
  const stampBottom = A4_H - MARGIN - 8 - stampH;
  drawStamp(page, fontBold, merchant, stampX, stampBottom, stampW, stampH);

  let y = stampBottom - 28;
  const valueColX = MARGIN + 132;
  const valueMaxW = A4_W - MARGIN - valueColX;

  const pushSection = (label) => {
    y -= 10;
    page.drawText(label, {
      x: MARGIN,
      y,
      size: 11,
      font: fontBold,
      color: rgb(0.12, 0.12, 0.14),
    });
    y -= 14;
    page.drawLine({
      start: { x: MARGIN, y: y + 10 },
      end: { x: A4_W - MARGIN, y: y + 10 },
      thickness: 0.4,
      color: rgb(0.88, 0.88, 0.9),
    });
    y -= 6;
  };

  const pushRow = (label, value) => {
    const valStr = value == null || value === "" ? "—" : String(value);
    const lines = wrapText(font, valStr, valueMaxW, 9);
    const lineH = 11;
    const valueBlockH = lines.length * lineH;
    const rowH = Math.max(lineH + 2, valueBlockH + 2);

    page.drawText(label, {
      x: MARGIN,
      y: y - 9,
      size: 9,
      font: fontBold,
      color: rgb(0.45, 0.45, 0.5),
    });

    let vy = y - 9;
    for (const ln of lines) {
      page.drawText(ln, {
        x: valueColX,
        y: vy,
        size: 9,
        font,
        color: rgb(0.09, 0.09, 0.11),
      });
      vy -= lineH;
    }
    y -= rowH + 4;
  };

  pushSection("Session");
  pushRow("Receipt #", String(session?.id || ""));
  pushRow("Status", session?.status || "—");
  pushRow("Facility operator", merchant);
  pushRow("Lot", session?.location || "—");
  const addrParts = [session?.lotAddress, session?.lotCity, session?.lotRegion].filter(Boolean);
  pushRow("Lot address", addrParts.length ? addrParts.join(", ") : "—");
  pushRow("Spot", session?.spotId ? `Spot ${session.spotId}` : "—");

  pushSection("Schedule");
  pushRow("Reserved at", formatDateTime(session?.reservedAtIso));
  pushRow("Parked from", formatDateTime(session?.parkedAtIso));
  pushRow("Parked until", formatDateTime(session?.exitedAtIso));
  if (session?.status === "Completed") {
    pushRow("Duration", formatDuration(session?.hours, session?.minutes, session?.seconds));
  }

  pushSection("Payment");
  pushRow("Payment method", session?.paymentMethod || "—");
  if (session?.hasReservationPayment) {
    pushRow("Reservation", `${formatEtb(session.reservationPayment)} ETB`);
    pushRow(
      "Parking",
      session?.parkingCost != null && Number.isFinite(session.parkingCost)
        ? `${formatEtb(session.parkingCost)} ETB${session.parkingCostIsEstimate ? " (estimated)" : ""}`
        : "—"
    );
    pushRow("Total", `${formatEtb(session.totalPaymentDisplay)} ETB`);
    if (session?.paymentMismatch) {
      pushRow("Recorded charges to date", `${formatEtb(session.totalPaid)} ETB`);
    }
  } else {
    pushRow("Upfront deposit", `${formatEtb(session.deposit)} ETB`);
    const costLabel = session?.status === "Completed" ? "Parking charge" : "No-show / penalty";
    pushRow(costLabel, `${formatEtb(session.cost)} ETB`);
  }
  pushRow("Wallet credit (per app)", `${formatEtb(session.walletRefund)} ETB`);

  y -= 8;
  const foot = wrapText(
    font,
    "Issued by VisionPark for your records. For billing questions, contact the facility operator listed above.",
    A4_W - MARGIN * 2,
    8
  );
  for (const ln of foot) {
    if (y < MARGIN + 40) break;
    page.drawText(ln, {
      x: MARGIN,
      y,
      size: 8,
      font,
      color: rgb(0.45, 0.45, 0.5),
    });
    y -= 10;
  }

  const bytes = await doc.save();
  const blob = new Blob([bytes], { type: "application/pdf" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  const safeId = String(session?.id || "session").replace(/[^a-zA-Z0-9-_]/g, "").slice(-12) || "session";
  a.href = url;
  a.download = `VisionPark-receipt-${safeId}.pdf`;
  a.rel = "noopener";
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
