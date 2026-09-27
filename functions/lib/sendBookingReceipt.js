"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.sendBookingReceipt = sendBookingReceipt;
exports.notifyAdminNewBookingRequest = notifyAdminNewBookingRequest;
const functions = __importStar(require("firebase-functions"));
const pdfGenerator_1 = require("./pdfGenerator");
const driverReminderEmail_1 = require("./driverReminderEmail");
const bankDetails_1 = require("./bankDetails");
const vehicleTypes_1 = require("./vehicleTypes");
const airportWaitingPolicy_1 = require("./airportWaitingPolicy");
const getSubjectLine = (type, bookingNumber) => {
    switch (type) {
        case "payment":
        case "payment_receipt":
            return "Your Spires Taxis Payment Receipt";
        case "payment_request":
            return `Payment Request - Spires Taxis Booking ${bookingNumber || ""}`.trim();
        default:
            return "Your Spires Taxis Booking Confirmation";
    }
};
const getIntroCopy = (type, booking) => {
    const bankNote = (0, bankDetails_1.isBankTransferMethod)(booking.paymentMethod) &&
        booking.paymentStatus !== "paid"
        ? `<p style="margin-top:12px;padding:12px;border:1px solid #C5A572;background:#faf8f4;border-radius:8px;white-space:pre-line;">${(0, driverReminderEmail_1.escapeHtml)((0, bankDetails_1.bankTransferDetailsPlainText)())}</p>`
        : "";
    const depAmt = Number(booking.depositAmount);
    const depositNote = booking.depositRequired && booking.depositStatus !== "paid"
        ? `<p style="margin-top:12px;padding:12px;border:1px solid #C5A572;background:#fff8eb;border-radius:8px;">A deposit${Number.isFinite(depAmt) ? ` of <strong>£${depAmt.toFixed(2)}</strong>` : ""} is required. Please use your booking number as the payment reference.</p>`
        : "";
    switch (type) {
        case "payment":
        case "payment_receipt":
            return `<p>We've received your payment. Your receipt is attached below.</p>`;
        case "payment_request":
            return `<p>This is a payment request for your booking with Spires Taxis. Please arrange payment for the fare amount shown in the attached document.</p>${bankNote}${depositNote}`;
        default: {
            const collectionNote = (0, airportWaitingPolicy_1.bookingHasAirportCollection)(booking)
                ? `<p style="margin-top:12px;padding:12px;border:1px solid #e8e4da;background:#fbfaf7;border-radius:8px;white-space:pre-line;">${(0, driverReminderEmail_1.escapeHtml)((0, airportWaitingPolicy_1.airportWaitingDisclaimerBody)())}</p>`
                : "";
            return `<p>Thank you for booking with Spires Taxis. Your confirmed booking details are attached below.</p>${bankNote}${depositNote}${collectionNote}`;
        }
    }
};
const getFilenamePrefix = (type) => {
    switch (type) {
        case "payment":
        case "payment_receipt":
            return "Payment_Receipt";
        case "payment_request":
            return "Payment_Request";
        default:
            return "Booking_Confirmation";
    }
};
async function sendBookingReceipt(booking, type = "booking_confirmation", bookingId) {
    try {
        const normalized = (0, bankDetails_1.normalizeBookingForEmail)(booking, bookingId);
        const to = normalized.hirerEmail || normalized.email;
        if (!to) {
            functions.logger.warn(`No customer email for booking ${normalized.bookingNumber}; skipping receipt`);
            return;
        }
        const pdfBuffer = await (0, pdfGenerator_1.generateBookingPDF)(normalized, type);
        const subject = getSubjectLine(type, normalized.bookingNumber);
        const introCopy = getIntroCopy(type, normalized);
        const filenamePrefix = getFilenamePrefix(type);
        const html = `
      <div style="font-family:sans-serif;font-size:16px;color:#333;">
        <p>Dear ${(0, driverReminderEmail_1.escapeHtml)(normalized.hirerName || "Customer")},</p>
        ${introCopy}
        <p>
          <a href="tel:07776897772">07776 897772</a><br>
          <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
          <a href="https://www.spires-taxis.com">www.spires-taxis.com</a><br>
          <a href="https://uk.trustpilot.com/evaluate/spires-taxis.com">Leave a review on Trustpilot</a>
        </p>
      </div>`;
        await (0, driverReminderEmail_1.getTransporter)().sendMail({
            from: (0, driverReminderEmail_1.mailFrom)(),
            to,
            bcc: driverReminderEmail_1.ADMIN_EMAIL,
            subject,
            html,
            attachments: [
                {
                    filename: `${filenamePrefix}_${normalized.bookingNumber || "Spires"}.pdf`,
                    content: pdfBuffer,
                },
            ],
        });
        functions.logger.info(`Email sent (${type}) for booking ${normalized.bookingNumber} to ${to}`);
    }
    catch (err) {
        functions.logger.error("Failed to send booking email", err);
    }
}
/** Notify office when a new pending customer booking arrives */
async function notifyAdminNewBookingRequest(booking, bookingId) {
    try {
        const n = (0, bankDetails_1.normalizeBookingForEmail)(booking, bookingId);
        const subject = `New booking request · ${n.hirerName} · ${n.pickupTime || "time TBC"}`;
        const pay = n.paymentMethod
            ? n.paymentMethod.replace(/_/g, " ")
            : "Not specified";
        const html = `
      <div style="font-family:sans-serif;font-size:15px;color:#222;line-height:1.5;">
        <h2 style="color:#002147;margin:0 0 12px;">New customer booking request</h2>
        <p>A new booking was submitted via the customer portal and needs a fare / confirmation.</p>
        <table style="border-collapse:collapse;width:100%;max-width:560px;">
          <tr><td style="padding:4px 8px;font-weight:600;">Customer</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.hirerName)}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Phone</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.hirerPhone || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Email</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.hirerEmail || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Pickup</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.pickupLocation || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Destination</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.destination || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">When</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(String(n.pickupTime || "—"))}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Passengers</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(String(booking.passengers ?? "—"))}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Vehicle Class</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)((0, vehicleTypes_1.formatVehicleTypeLabel)(n.vehicleType))}${(0, vehicleTypes_1.vehicleClassExamples)(n.vehicleType)
            ? `<br><span style="font-size:13px;color:#555;">${(0, driverReminderEmail_1.escapeHtml)((0, vehicleTypes_1.vehicleClassExamples)(n.vehicleType))}</span>`
            : ""}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Pay by</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(pay)}</td></tr>
          ${n.flightNumber ? `<tr><td style="padding:4px 8px;font-weight:600;">Flight</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.flightNumber)}${n.terminal ? ` · Terminal ${(0, driverReminderEmail_1.escapeHtml)(n.terminal)}` : ""}</td></tr>` : ""}
          ${n.bookingType === "return" || n.returnPickupLocation ? `<tr><td style="padding:4px 8px;font-weight:600;">Return</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.returnPickupLocation || "")} → ${(0, driverReminderEmail_1.escapeHtml)(n.returnDestination || "")}</td></tr>` : ""}
          ${n.notes ? `<tr><td style="padding:4px 8px;font-weight:600;">Notes</td><td style="padding:4px 8px;">${(0, driverReminderEmail_1.escapeHtml)(n.notes)}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;">Open the admin Bookings page to set the fare and confirm.</p>
      </div>`;
        await (0, driverReminderEmail_1.getTransporter)().sendMail({
            from: (0, driverReminderEmail_1.mailFrom)(),
            to: driverReminderEmail_1.ADMIN_EMAIL,
            subject,
            html,
            text: [
                "New customer booking request",
                `Customer: ${n.hirerName}`,
                `Phone: ${n.hirerPhone}`,
                `Email: ${n.hirerEmail}`,
                `Pickup: ${n.pickupLocation}`,
                `Destination: ${n.destination}`,
                `When: ${n.pickupTime}`,
                `Pay by: ${pay}`,
            ].join("\n"),
        });
        functions.logger.info(`Admin notified of new booking ${bookingId}`);
    }
    catch (err) {
        functions.logger.error("Failed to notify admin of new booking", err);
    }
}
