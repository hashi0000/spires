import * as functions from "firebase-functions";
import { generateBookingPDF } from "./pdfGenerator";
import {
  ADMIN_EMAIL,
  getTransporter,
  mailFrom,
  escapeHtml,
} from "./driverReminderEmail";
import {
  bankTransferDetailsPlainText,
  isBankTransferMethod,
  normalizeBookingForEmail,
} from "./bankDetails";
import { formatVehicleTypeLabel, vehicleClassExamples } from "./vehicleTypes";
import {
  airportWaitingDisclaimerBody,
  bookingHasAirportCollection,
} from "./airportWaitingPolicy";

type EmailDocType =
  | "confirmation"
  | "booking_confirmation"
  | "payment"
  | "payment_receipt"
  | "payment_request";

const getSubjectLine = (type: EmailDocType, bookingNumber?: string) => {
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

const getIntroCopy = (type: EmailDocType, booking: any) => {
  const bankNote =
    isBankTransferMethod(booking.paymentMethod) &&
    booking.paymentStatus !== "paid"
      ? `<p style="margin-top:12px;padding:12px;border:1px solid #C5A572;background:#faf8f4;border-radius:8px;white-space:pre-line;">${escapeHtml(
          bankTransferDetailsPlainText()
        )}</p>`
      : "";

  const depAmt = Number(booking.depositAmount);
  const depositNote =
    booking.depositRequired && booking.depositStatus !== "paid"
      ? `<p style="margin-top:12px;padding:12px;border:1px solid #C5A572;background:#fff8eb;border-radius:8px;">A deposit${
          Number.isFinite(depAmt) ? ` of <strong>£${depAmt.toFixed(2)}</strong>` : ""
        } is required. Please use your booking number as the payment reference.</p>`
      : "";

  switch (type) {
    case "payment":
    case "payment_receipt":
      return `<p>We've received your payment. Your receipt is attached below.</p>`;
    case "payment_request":
      return `<p>This is a payment request for your booking with Spires Taxis. Please arrange payment for the fare amount shown in the attached document.</p>${bankNote}${depositNote}`;
    default: {
      const collectionNote = bookingHasAirportCollection(booking)
        ? `<p style="margin-top:12px;padding:12px;border:1px solid #e8e4da;background:#fbfaf7;border-radius:8px;white-space:pre-line;">${escapeHtml(
            airportWaitingDisclaimerBody()
          )}</p>`
        : "";
      return `<p>Thank you for booking with Spires Taxis. Your confirmed booking details are attached below.</p>${bankNote}${depositNote}${collectionNote}`;
    }
  }
};

const getFilenamePrefix = (type: EmailDocType) => {
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

export async function sendBookingReceipt(
  booking: any,
  type: EmailDocType = "booking_confirmation",
  bookingId?: string
) {
  try {
    const normalized = normalizeBookingForEmail(booking, bookingId);
    const to = normalized.hirerEmail || normalized.email;
    if (!to) {
      functions.logger.warn(
        `No customer email for booking ${normalized.bookingNumber}; skipping receipt`
      );
      return;
    }

    const pdfBuffer = await generateBookingPDF(normalized, type);
    const subject = getSubjectLine(type, normalized.bookingNumber);
    const introCopy = getIntroCopy(type, normalized);
    const filenamePrefix = getFilenamePrefix(type);

    const html = `
      <div style="font-family:sans-serif;font-size:16px;color:#333;">
        <p>Dear ${escapeHtml(normalized.hirerName || "Customer")},</p>
        ${introCopy}
        <p>
          <a href="tel:07776897772">07776 897772</a><br>
          <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
          <a href="https://www.spires-taxis.com">www.spires-taxis.com</a><br>
          <a href="https://uk.trustpilot.com/evaluate/spires-taxis.com">Leave a review on Trustpilot</a>
        </p>
      </div>`;

    await getTransporter().sendMail({
      from: mailFrom(),
      to,
      bcc: ADMIN_EMAIL,
      subject,
      html,
      attachments: [
        {
          filename: `${filenamePrefix}_${normalized.bookingNumber || "Spires"}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    functions.logger.info(
      `Email sent (${type}) for booking ${normalized.bookingNumber} to ${to}`
    );
  } catch (err) {
    functions.logger.error("Failed to send booking email", err);
  }
}

/** Notify office when a new pending customer booking arrives */
export async function notifyAdminNewBookingRequest(
  booking: any,
  bookingId: string
) {
  try {
    const n = normalizeBookingForEmail(booking, bookingId);
    const subject = `New booking request · ${n.hirerName} · ${n.pickupTime || "time TBC"}`;
    const rawPay = String(n.paymentMethod || "").trim().toLowerCase().replace(/_/g, " ");
    const pay = !n.paymentMethod
      ? "Not specified"
      : rawPay === "tbc"
        ? "TBC"
        : rawPay === "undecided"
          ? "Not decided yet"
          : String(n.paymentMethod).replace(/_/g, " ");

    const html = `
      <div style="font-family:sans-serif;font-size:15px;color:#222;line-height:1.5;">
        <h2 style="color:#002147;margin:0 0 12px;">New customer booking request</h2>
        <p>A new booking was submitted via the customer portal and needs a fare / confirmation.</p>
        <table style="border-collapse:collapse;width:100%;max-width:560px;">
          <tr><td style="padding:4px 8px;font-weight:600;">Customer</td><td style="padding:4px 8px;">${escapeHtml(n.hirerName)}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Phone</td><td style="padding:4px 8px;">${escapeHtml(n.hirerPhone || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Email</td><td style="padding:4px 8px;">${escapeHtml(n.hirerEmail || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Pickup</td><td style="padding:4px 8px;">${escapeHtml(n.pickupLocation || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Destination</td><td style="padding:4px 8px;">${escapeHtml(n.destination || "—")}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">When</td><td style="padding:4px 8px;">${escapeHtml(String(n.pickupTime || "—"))}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Passengers</td><td style="padding:4px 8px;">${escapeHtml(String(booking.passengers ?? "—"))}</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Vehicle Class</td><td style="padding:4px 8px;">${escapeHtml(
            formatVehicleTypeLabel(n.vehicleType)
          )}${
            vehicleClassExamples(n.vehicleType)
              ? `<br><span style="font-size:13px;color:#555;">${escapeHtml(vehicleClassExamples(n.vehicleType))}</span>`
              : ""
          }</td></tr>
          <tr><td style="padding:4px 8px;font-weight:600;">Pay by</td><td style="padding:4px 8px;">${escapeHtml(pay)}</td></tr>
          ${n.flightNumber ? `<tr><td style="padding:4px 8px;font-weight:600;">Flight</td><td style="padding:4px 8px;">${escapeHtml(n.flightNumber)}${n.terminal ? ` · Terminal ${escapeHtml(n.terminal)}` : ""}</td></tr>` : ""}
          ${n.bookingType === "return" || n.returnPickupLocation ? `<tr><td style="padding:4px 8px;font-weight:600;">Return</td><td style="padding:4px 8px;">${escapeHtml(n.returnPickupLocation || "")} → ${escapeHtml(n.returnDestination || "")}</td></tr>` : ""}
          ${n.notes ? `<tr><td style="padding:4px 8px;font-weight:600;">Notes</td><td style="padding:4px 8px;">${escapeHtml(n.notes)}</td></tr>` : ""}
        </table>
        <p style="margin-top:16px;">Open the admin Bookings page to set the fare and confirm.</p>
      </div>`;

    await getTransporter().sendMail({
      from: mailFrom(),
      to: ADMIN_EMAIL,
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
  } catch (err) {
    functions.logger.error("Failed to notify admin of new booking", err);
  }
}
