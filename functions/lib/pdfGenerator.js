"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.__pdfTest = void 0;
exports.generateBookingPDF = generateBookingPDF;
const pdfkit_1 = __importDefault(require("pdfkit"));
const bankDetails_1 = require("./bankDetails");
const airportWaitingPolicy_1 = require("./airportWaitingPolicy");
const vehicleTypes_1 = require("./vehicleTypes");
const documentTitleMap = {
    confirmation: "Booking Confirmation",
    booking_confirmation: "Booking Confirmation",
    payment: "Payment Receipt",
    payment_receipt: "Payment Receipt",
    payment_request: "Payment Request",
};
const NAVY = "#002147";
const GOLD = "#C5A572";
const SLATE = "#0f172a";
const CREAM = "#f7f4ec";
const CREAM_PANEL = "#f7f4e9";
const MUTED = "#666666";
const BORDER = "#e5e7eb";
const WHITE = "#ffffff";
const PAYMENT_REQUEST_BG = "#92400e";
const GOOGLE_BLUE = "#4285F4";
const PAGE_MARGIN = 20;
const HEADER_H = 88;
const BANNER_H = 36;
const FOOTER_H = 72;
const BOX_PAD = 10;
function toDate(raw) {
    if (raw == null || raw === "")
        return null;
    if (raw instanceof Date && !Number.isNaN(raw.getTime()))
        return raw;
    if (typeof raw === "object" && raw !== null && typeof raw.toDate === "function") {
        try {
            const d = raw.toDate();
            return Number.isNaN(d.getTime()) ? null : d;
        }
        catch {
            return null;
        }
    }
    const d = new Date(String(raw));
    return Number.isNaN(d.getTime()) ? null : d;
}
function formatPdfDate(raw) {
    const d = toDate(raw);
    if (d)
        return d.toLocaleDateString("en-GB", { timeZone: "Europe/London" });
    const s = String(raw || "").trim();
    const m = s.match(/^(\d{1,2}\/\d{1,2}\/\d{4})/);
    return m ? m[1] : s;
}
function formatPdfTime(raw) {
    const d = toDate(raw);
    if (d) {
        return d.toLocaleTimeString("en-GB", {
            timeZone: "Europe/London",
            hour: "2-digit",
            minute: "2-digit",
        });
    }
    const s = String(raw || "").trim();
    const m = s.match(/(\d{1,2}:\d{2})/);
    return m ? m[1] : "";
}
function formatPaymentMethod(method) {
    if (!method)
        return "TO BE CONFIRMED";
    return method.replace(/_/g, " ").toUpperCase();
}
function paymentCopy(type, booking, hasFare) {
    const amount = hasFare && typeof booking.actualFare === "number"
        ? `£${Number(booking.actualFare).toFixed(2)}`
        : hasFare && Number.isFinite(Number(booking.actualFare))
            ? `£${Number(booking.actualFare).toFixed(2)}`
            : "TBC";
    const method = formatPaymentMethod(booking.paymentMethod);
    const isPaid = booking.paymentStatus === "paid";
    const isPartial = booking.paymentStatus === "partial";
    const isCompleted = booking.status === "completed";
    const isPaymentReceipt = type === "payment" || type === "payment_receipt";
    const isPaymentRequest = type === "payment_request";
    let methodLine;
    if (isPaymentRequest && hasFare) {
        methodLine = `Payment Required - ${method}`;
    }
    else if ((isCompleted && isPaid && hasFare) || (isPaymentReceipt && hasFare)) {
        methodLine = `Paid by ${method}`;
    }
    else if (hasFare && isPartial) {
        methodLine = `Partially paid by ${method}`;
    }
    else {
        methodLine = `To be paid by ${method}`;
    }
    return { amount, methodLine };
}
function pageContentBottom(doc) {
    return doc.page.height - FOOTER_H - 12;
}
function drawFooter(doc) {
    const w = doc.page.width;
    const y = doc.page.height - FOOTER_H;
    doc.save();
    doc.rect(0, y, w, FOOTER_H).fill(NAVY);
    doc
        .fillColor(GOLD)
        .font("Times-Bold")
        .fontSize(11)
        .text("SPIRES TAXIS", PAGE_MARGIN, y + 10, { width: w - PAGE_MARGIN * 2, align: "center" });
    doc
        .fillColor(WHITE)
        .font("Helvetica")
        .fontSize(8)
        .text("bookings@spires-taxis.com  ·  07776 897772  ·  www.spires-taxis.com", PAGE_MARGIN, y + 28, {
        width: w - PAGE_MARGIN * 2,
        align: "center",
    });
    doc
        .fillColor(GOLD)
        .fontSize(8)
        .text("We'd love your feedback!", PAGE_MARGIN, y + 44, {
        width: w - PAGE_MARGIN * 2,
        align: "center",
    });
    doc
        .fillColor(GOOGLE_BLUE)
        .fontSize(8)
        .text("Leave a Review on Google", PAGE_MARGIN, y + 56, {
        width: w - PAGE_MARGIN * 2,
        align: "center",
        link: "https://g.page/r/CWu0N7lUD-YKEAI/review",
    });
    doc.restore();
}
function drawHeader(doc, bookingNumber) {
    const w = doc.page.width;
    doc.save();
    doc.rect(0, 0, w, HEADER_H).fill(NAVY);
    doc
        .fillColor(GOLD)
        .font("Times-Bold")
        .fontSize(22)
        .text("SPIRES TAXIS", 0, 22, { width: w, align: "center" });
    doc
        .fillColor("#e8eef5")
        .font("Times-Italic")
        .fontSize(10)
        .text("Your Oxford Journey Starts Here", 0, 50, { width: w, align: "center" });
    const label = bookingNumber || "";
    if (label) {
        const badgeW = Math.min(160, Math.max(86, label.length * 7.2 + 18));
        const bx = w - PAGE_MARGIN - badgeW;
        const by = 18;
        doc.roundedRect(bx, by, badgeW, 26, 4).lineWidth(1.6).strokeColor(GOLD).stroke();
        doc
            .fillColor(WHITE)
            .font("Times-Bold")
            .fontSize(9)
            .text(label, bx, by + 8, { width: badgeW, align: "center" });
    }
    doc.restore();
}
function drawBanner(doc, title) {
    const w = doc.page.width;
    const y = HEADER_H;
    doc.save();
    doc.rect(0, y, w, BANNER_H).fill(CREAM);
    doc.moveTo(0, y + BANNER_H).lineTo(w, y + BANNER_H).lineWidth(3).strokeColor(SLATE).stroke();
    doc
        .fillColor(SLATE)
        .font("Helvetica-Bold")
        .fontSize(11)
        .text(title.toUpperCase(), 0, y + 12, { width: w, align: "center", characterSpacing: 1.4 });
    doc.restore();
}
function ensureSpace(doc, y, needed) {
    if (y + needed <= pageContentBottom(doc))
        return y;
    drawFooter(doc);
    doc.addPage({ size: "A4", margin: 0 });
    drawHeader(doc, "");
    return HEADER_H + 16;
}
function boxedSection(doc, x, y, width, title, drawBody) {
    const startY = y;
    doc
        .fillColor(NAVY)
        .font("Times-Bold")
        .fontSize(11)
        .text(title, x + BOX_PAD, startY + 8, { width: width - BOX_PAD * 2 });
    doc
        .moveTo(x + BOX_PAD, startY + 24)
        .lineTo(x + width - BOX_PAD, startY + 24)
        .lineWidth(1.4)
        .strokeColor(GOLD)
        .stroke();
    const innerEnd = drawBody(startY + BOX_PAD + 22);
    const height = Math.max(52, innerEnd - startY + BOX_PAD);
    doc.save();
    doc.roundedRect(x, startY, width, height, 6).lineWidth(1.4).strokeColor(BORDER).stroke();
    doc.restore();
    return startY + height;
}
function detailRow(doc, x, y, width, label, value) {
    const labelW = Math.min(118, width * 0.4);
    const valueW = width - labelW - 6;
    const h = Math.max(doc.font("Helvetica").fontSize(8).heightOfString(label || " ", { width: labelW }), doc.font("Helvetica").fontSize(9).heightOfString(value || " ", { width: valueW }));
    doc.fillColor(MUTED).font("Helvetica").fontSize(8).text(label, x, y, { width: labelW });
    doc
        .fillColor(NAVY)
        .font("Helvetica")
        .fontSize(9)
        .text(value || "", x + labelW + 6, y, { width: valueW, align: "right" });
    return y + h + 5;
}
function journeyBlock(doc, x, y, width, title, pickupTime, pickupLocation, destination, airportCollection, flightNumber) {
    let cy = y;
    doc
        .fillColor(NAVY)
        .font("Times-Bold")
        .fontSize(9)
        .text(title.toUpperCase(), x, cy, { width, characterSpacing: 0.4 });
    cy += 16;
    cy = detailRow(doc, x, cy, width, "Date", formatPdfDate(pickupTime));
    cy = detailRow(doc, x, cy, width, "Pickup time", formatPdfTime(pickupTime));
    const panelH = 48;
    doc.save();
    doc.roundedRect(x, cy, width, panelH, 5).fill(CREAM_PANEL);
    doc.rect(x, cy, 3, panelH).fill(GOLD);
    doc.restore();
    const innerW = (width - 28) / 2;
    doc
        .fillColor(MUTED)
        .font("Helvetica")
        .fontSize(8)
        .text(formatPdfTime(pickupTime), x + 12, cy + 8, { width: innerW, align: "center" });
    doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(pickupLocation || "", x + 12, cy + 22, { width: innerW, align: "center" });
    doc.fillColor(GOLD).font("Helvetica-Bold").fontSize(14).text(">", x + 12 + innerW, cy + 16, {
        width: 16,
        align: "center",
    });
    doc
        .fillColor(NAVY)
        .font("Helvetica-Bold")
        .fontSize(9)
        .text(destination || "", x + 12 + innerW + 16, cy + 22, { width: innerW, align: "center" });
    cy += panelH + 8;
    if (airportCollection) {
        cy = detailRow(doc, x, cy, width, "Airport collection", "Yes");
    }
    if (airportCollection && (flightNumber || "").trim()) {
        cy = detailRow(doc, x, cy, width, "Flight number", String(flightNumber).trim());
    }
    return cy;
}
async function generateBookingPDF(booking, type = "booking_confirmation") {
    const doc = new pdfkit_1.default({ size: "A4", margin: 0, compress: false });
    const buffers = [];
    doc.on("data", (chunk) => buffers.push(chunk));
    const docTitle = documentTitleMap[type] || "Booking Confirmation";
    const bookingNumber = String(booking.bookingNumber || "");
    const pageW = doc.page.width;
    const contentW = pageW - PAGE_MARGIN * 2;
    const colGap = 10;
    const colW = (contentW - colGap) / 2;
    const leftX = PAGE_MARGIN;
    const rightX = PAGE_MARGIN + colW + colGap;
    const outboundTime = booking.dateTime || booking.pickupTime;
    const returnTime = booking.returnPickupTime || booking.returnDateTime;
    const isReturn = (0, airportWaitingPolicy_1.isReturnBooking)(booking);
    const fareRaw = typeof booking.actualFare === "number" ? booking.actualFare : Number(booking.actualFare);
    const hasFare = Number.isFinite(fareRaw);
    const { amount, methodLine } = paymentCopy(type, { ...booking, actualFare: fareRaw }, hasFare);
    const isPaid = booking.paymentStatus === "paid";
    const isPaymentRequest = type === "payment_request";
    drawHeader(doc, bookingNumber);
    drawBanner(doc, docTitle);
    let y = HEADER_H + BANNER_H + 14;
    const tripRows = [
        ["Trip Date", formatPdfDate(outboundTime)],
        ["Pickup Time", formatPdfTime(outboundTime)],
        [
            "Booking Method",
            booking.bookingMethod
                ? String(booking.bookingMethod).replace(/_/g, " ").toUpperCase()
                : "",
        ],
    ];
    if (isReturn)
        tripRows.push(["Booking type", "Return"]);
    const customerRows = [
        ["Name", booking.hirerName || booking.name || "Customer"],
        ["Phone", booking.hirerPhone || booking.phone || ""],
    ];
    if (booking.hirerAddress)
        customerRows.push(["Address", String(booking.hirerAddress)]);
    if (booking.hirerEmail || booking.email) {
        customerRows.push(["Email", String(booking.hirerEmail || booking.email)]);
    }
    y = ensureSpace(doc, y, 110);
    const colTop = y;
    let leftBottom = colTop;
    let rightBottom = colTop;
    leftBottom = boxedSection(doc, leftX, colTop, colW, "Trip Information", (innerY) => {
        let cy = innerY;
        for (const [label, value] of tripRows) {
            if (!value)
                continue;
            cy = detailRow(doc, leftX + BOX_PAD, cy, colW - BOX_PAD * 2, label, value);
        }
        return cy;
    });
    rightBottom = boxedSection(doc, rightX, colTop, colW, "Customer Details", (innerY) => {
        let cy = innerY;
        for (const [label, value] of customerRows) {
            if (!value)
                continue;
            cy = detailRow(doc, rightX + BOX_PAD, cy, colW - BOX_PAD * 2, label, value);
        }
        return cy;
    });
    y = Math.max(leftBottom, rightBottom) + 10;
    y = ensureSpace(doc, y, 140);
    y = boxedSection(doc, leftX, y, contentW, "Journey Details", (innerY) => {
        let cy = innerY;
        if (isReturn) {
            cy = journeyBlock(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Outbound Journey", outboundTime, booking.pickupLocation || booking.pickup || "", booking.destination || "", booking.airportCollection === true, booking.flightNumber);
            cy += 8;
            cy = journeyBlock(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Return Journey", returnTime, booking.returnPickupLocation || "", booking.returnDestination || "", booking.returnAirportCollection === true, booking.returnFlightNumber);
        }
        else {
            cy = journeyBlock(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Journey", outboundTime, booking.pickupLocation || booking.pickup || "", booking.destination || "", booking.airportCollection === true, booking.flightNumber);
        }
        if (booking.vehicleType) {
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Vehicle Class", (0, vehicleTypes_1.formatVehicleTypeLabel)(booking.vehicleType));
            const examples = (0, vehicleTypes_1.vehicleClassExamples)(booking.vehicleType);
            if (examples) {
                doc.fillColor("#5c6570").font("Helvetica").fontSize(8).text(examples, leftX + BOX_PAD, cy, {
                    width: contentW - BOX_PAD * 2,
                    align: "right",
                });
                cy += 14;
            }
        }
        if (booking.passengers) {
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Passengers", String(booking.passengers));
        }
        if (booking.terminal) {
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Terminal", String(booking.terminal));
        }
        return cy;
    }) + 10;
    if ((0, airportWaitingPolicy_1.bookingHasAirportCollection)(booking)) {
        const body = (0, airportWaitingPolicy_1.airportWaitingDisclaimerBody)(airportWaitingPolicy_1.AIRPORT_WAITING_POLICY);
        const scope = (0, airportWaitingPolicy_1.airportWaitingScopeNote)(booking);
        y = ensureSpace(doc, y, 90);
        const noteX = leftX;
        const noteW = contentW;
        const textW = noteW - 20;
        let textH = 18;
        if (scope)
            textH += doc.font("Helvetica").fontSize(8).heightOfString(scope, { width: textW }) + 6;
        textH += doc.font("Helvetica").fontSize(8).heightOfString(body, { width: textW }) + 16;
        doc.save();
        doc.roundedRect(noteX, y, noteW, textH, 6).fill("#fbfaf7").strokeColor("#e8e4da").lineWidth(1).stroke();
        doc.restore();
        let ny = y + 8;
        doc
            .fillColor("#334155")
            .font("Helvetica-Bold")
            .fontSize(8)
            .text((0, airportWaitingPolicy_1.airportWaitingDisclaimerTitle)(), noteX + 10, ny, { width: textW });
        ny += 14;
        if (scope) {
            doc.fillColor("#334155").font("Helvetica-Bold").fontSize(8).text(scope, noteX + 10, ny, { width: textW });
            ny += doc.heightOfString(scope, { width: textW }) + 6;
        }
        doc.fillColor("#4b5563").font("Helvetica").fontSize(8).text(body, noteX + 10, ny, { width: textW, lineGap: 2 });
        y += textH + 10;
    }
    const hasSchedule = (booking.dueOnOutbound != null && String(booking.dueOnOutbound) !== "") ||
        (booking.dueOnReturn != null && String(booking.dueOnReturn) !== "");
    if (hasSchedule) {
        y = ensureSpace(doc, y, 80);
        y =
            boxedSection(doc, leftX, y, contentW, "Payment Schedule", (innerY) => {
                let cy = innerY;
                const total = Number(booking.actualFare);
                const deposit = Number(booking.depositAmount);
                const outbound = Number(booking.dueOnOutbound);
                const ret = Number(booking.dueOnReturn);
                if (Number.isFinite(total)) {
                    cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Total fare", `£${total.toFixed(2)}`);
                }
                if (Number.isFinite(deposit)) {
                    cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Deposit paid", `£${deposit.toFixed(2)}`);
                }
                if (Number.isFinite(outbound)) {
                    cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Due on outbound journey", `£${outbound.toFixed(2)}`);
                }
                if (Number.isFinite(ret)) {
                    cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Due on return journey", `£${ret.toFixed(2)}`);
                }
                return cy;
            }) + 10;
    }
    y = ensureSpace(doc, y, 120);
    const payBg = isPaymentRequest ? PAYMENT_REQUEST_BG : NAVY;
    y = boxedSection(doc, leftX, y, contentW, docTitle, (innerY) => {
        let cy = innerY;
        const boxH = (0, airportWaitingPolicy_1.bookingLooksLikeAirportTransfer)(booking) || isPaymentRequest ? 78 : 64;
        doc.save();
        doc.roundedRect(leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, boxH, 6).fill(payBg);
        doc.restore();
        doc
            .fillColor(GOLD)
            .font("Helvetica-Bold")
            .fontSize(20)
            .text(amount, leftX + BOX_PAD, cy + 12, { width: contentW - BOX_PAD * 2, align: "center" });
        doc
            .fillColor(WHITE)
            .font("Helvetica")
            .fontSize(9)
            .text(methodLine, leftX + BOX_PAD, cy + 38, { width: contentW - BOX_PAD * 2, align: "center" });
        let extraY = cy + 52;
        if (isPaymentRequest && hasFare) {
            doc
                .fillColor(WHITE)
                .fontSize(8)
                .text("Please arrange payment for this booking using the method above.", leftX + BOX_PAD, extraY, {
                width: contentW - BOX_PAD * 2,
                align: "center",
            });
            extraY += 12;
        }
        if ((0, airportWaitingPolicy_1.bookingLooksLikeAirportTransfer)(booking)) {
            doc
                .fillColor("#e8eef5")
                .fontSize(8)
                .text("Standard airport charge included", leftX + BOX_PAD, extraY, {
                width: contentW - BOX_PAD * 2,
                align: "center",
            });
            extraY += 12;
        }
        cy += boxH + 8;
        if (!hasSchedule && booking.depositRequired) {
            const depAmt = Number(booking.depositAmount);
            if (booking.depositStatus === "paid") {
                cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Deposit", `Paid${Number.isFinite(depAmt) ? ` (£${depAmt.toFixed(2)})` : ""}`);
            }
            else {
                const depText = Number.isFinite(depAmt)
                    ? `Please pay a deposit of £${depAmt.toFixed(2)} to confirm this booking. Use your booking number as the payment reference.`
                    : "A deposit is required to confirm this booking. Use your booking number as the payment reference.";
                doc
                    .save()
                    .roundedRect(leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, 42, 5)
                    .fill("#fff8eb")
                    .strokeColor(GOLD)
                    .lineWidth(1)
                    .stroke();
                doc.restore();
                doc
                    .fillColor(NAVY)
                    .font("Helvetica-Bold")
                    .fontSize(9)
                    .text("Deposit required", leftX + BOX_PAD + 8, cy + 6, { width: contentW - BOX_PAD * 2 - 16 });
                doc
                    .fillColor(NAVY)
                    .font("Helvetica")
                    .fontSize(8)
                    .text(depText, leftX + BOX_PAD + 8, cy + 20, { width: contentW - BOX_PAD * 2 - 16 });
                cy += 50;
            }
        }
        if ((0, bankDetails_1.isBankTransferMethod)(booking.paymentMethod) && !isPaid) {
            const { accountName, sortCode, accountNumber } = bankDetails_1.SPIRES_BANK_DETAILS;
            doc
                .fillColor(NAVY)
                .font("Helvetica-Bold")
                .fontSize(10)
                .text("Pay by bank transfer", leftX + BOX_PAD, cy);
            cy += 14;
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Account name", accountName);
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Sort code", sortCode);
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Account number", accountNumber);
            doc
                .fillColor(MUTED)
                .font("Helvetica")
                .fontSize(8)
                .text(`Please use booking number ${bookingNumber || "as shown above"} as the payment reference.`, leftX + BOX_PAD, cy, { width: contentW - BOX_PAD * 2 });
            cy += 16;
        }
        if (booking.notes) {
            cy = detailRow(doc, leftX + BOX_PAD, cy, contentW - BOX_PAD * 2, "Notes", String(booking.notes));
        }
        return cy;
    });
    drawFooter(doc);
    doc.end();
    await new Promise((resolve, reject) => {
        doc.on("end", () => resolve());
        doc.on("error", reject);
    });
    return Buffer.concat(buffers);
}
exports.__pdfTest = {
    formatPdfDate,
    formatPdfTime,
    formatPaymentMethod,
};
