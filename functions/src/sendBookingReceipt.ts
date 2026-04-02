import * as functions from "firebase-functions";
import * as nodemailer from "nodemailer";
import { generateBookingPDF } from "./pdfGenerator";

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp-1and1.live.any.po.server.lan",
  port: Number(process.env.SMTP_PORT) || 587,
  secure: false,
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS,
  },
  tls: { rejectUnauthorized: false },
});

type EmailDocType =
  | "confirmation"
  | "booking_confirmation"
  | "payment"
  | "payment_receipt"
  | "payment_request";

const docTitleMap: Record<EmailDocType, string> = {
  confirmation: "Booking Confirmation",
  booking_confirmation: "Booking Confirmation",
  payment: "Payment Receipt",
  payment_receipt: "Payment Receipt",
  payment_request: "Payment Request",
};

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

const getIntroCopy = (type: EmailDocType) => {
  switch (type) {
    case "payment":
    case "payment_receipt":
      return `<p>We've received your payment. Your receipt is attached below.</p>`;
    case "payment_request":
      return `<p>This is a payment request for your booking with Spires Taxis. Please arrange payment for the fare amount shown in the attached document.</p>`;
    default:
      return `<p>Thank you for booking with Spires Taxis. Your confirmed booking details are attached below.</p>`;
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

export async function sendBookingReceipt(booking: any, type: EmailDocType = "booking_confirmation") {
  try {
    const pdfBuffer = await generateBookingPDF(booking, type);

    const subject = getSubjectLine(type, booking.bookingNumber);
    const introCopy = getIntroCopy(type);
    const filenamePrefix = getFilenamePrefix(type);

    const html = `
      <div style="font-family:sans-serif;font-size:16px;color:#333;">
        <p>Dear ${booking.hirerName || "Customer"},</p>
        ${introCopy}
        <p>
          📱 <a href="tel:07776897772">07776 897772</a><br>
          📧 <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
          🌐 <a href="https://www.spires-taxis.com">www.spires-taxis.com</a><br>
          ⭐ <a href="https://uk.trustpilot.com/evaluate/spires-taxis.com">Leave a review on Trustpilot</a>
        </p>
      </div>`;

    await transporter.sendMail({
      from: `"Bookings Team – Spires Taxis" <bookings@spires-taxis.com>`,
      to: booking.hirerEmail || "bookings@spires-taxis.com",
      subject,
      html,
      attachments: [
        {
          filename: `${filenamePrefix}_${booking.bookingNumber || "Spires"}.pdf`,
          content: pdfBuffer,
        },
      ],
    });

    functions.logger.info(`✅ Email sent for booking ${booking.bookingNumber}`);
  } catch (err) {
    functions.logger.error("❌ Failed to send booking email", err);
  }
}
