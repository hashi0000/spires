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
exports.sendBookingPdfToCustomer = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const driverReminderEmail_1 = require("./driverReminderEmail");
const bookingTerms_1 = require("./terms/bookingTerms");
const quoteWorkflow_1 = require("./quotes/quoteWorkflow");
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
const getIntroCopy = (type) => {
    switch (type) {
        case "payment":
        case "payment_receipt":
            return `<p>We've received your payment. Your receipt is attached below.</p>`;
        case "payment_request":
            return `<p>This is a payment request for your booking with Spires Taxis. Please arrange payment for the fare amount shown in the attached document.</p>`;
        default:
            return `<p>Thank you for booking with Spires Taxis. Your booking details are attached below.</p>`;
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
const ALLOWED_TYPES = [
    "confirmation",
    "booking_confirmation",
    "payment",
    "payment_receipt",
    "payment_request",
];
/** Keep under ~10 MiB callable request limit after base64 expansion (~4/3×). */
const MAX_INLINE_PDF_BYTES = 4 * 1024 * 1024;
function resolveStorageBucket() {
    const opts = admin.app().options;
    if (opts.storageBucket && typeof opts.storageBucket === "string") {
        return opts.storageBucket;
    }
    const project = process.env.GCLOUD_PROJECT || process.env.GCP_PROJECT || "";
    return project ? `${project}.appspot.com` : "";
}
async function sendMailWithPdf(params) {
    const { pdfBuffer, toEmail, pdfType, bookingNumber, hirerName, termsParagraph } = params;
    const subject = getSubjectLine(pdfType, bookingNumber);
    const introCopy = getIntroCopy(pdfType);
    const filenamePrefix = getFilenamePrefix(pdfType);
    const html = `
      <div style="font-family:sans-serif;font-size:16px;color:#333;">
        <p>Dear ${hirerName},</p>
        ${introCopy}
        ${termsParagraph ? `<p>${(0, driverReminderEmail_1.escapeHtml)(termsParagraph)}</p>` : ""}
        <p style="font-size:14px;color:#555;">Attached: ${bookingNumber}</p>
        <p>
          📱 <a href="tel:07776897772">07776 897772</a><br>
          📧 <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
          🌐 <a href="https://www.spires-taxis.com">www.spires-taxis.com</a><br>
          ⭐ <a href="https://uk.trustpilot.com/evaluate/spires-taxis.com">Leave a review on Trustpilot</a>
        </p>
      </div>`;
    await (0, driverReminderEmail_1.getTransporter)().sendMail({
        from: (0, driverReminderEmail_1.mailFrom)(),
        to: toEmail,
        subject,
        html,
        attachments: [
            {
                filename: `${filenamePrefix}_${bookingNumber}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
}
/**
 * Authenticated staff: email a booking PDF.
 * Prefer **pdfBase64** from the admin app (same styled PDF as in the browser) — no Storage rules required.
 * Optional **storagePath** fallback for very large files uploaded by the same user.
 */
exports.sendBookingPdfToCustomer = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    if (!(0, driverReminderEmail_1.reminderConfigOk)()) {
        throw new functions.https.HttpsError("failed-precondition", "Email is not configured. Set: firebase functions:config:set email.pass=\"...\" (and smtp.host if needed). Same as driver reminder emails.");
    }
    const toEmail = typeof data?.toEmail === "string" ? data.toEmail.trim() : "";
    if (!toEmail) {
        throw new functions.https.HttpsError("invalid-argument", "toEmail is required.");
    }
    let pdfType = data?.pdfType || "booking_confirmation";
    if (!ALLOWED_TYPES.includes(pdfType)) {
        pdfType = "booking_confirmation";
    }
    const bookingNumber = typeof data?.bookingNumber === "string" && data.bookingNumber.trim()
        ? data.bookingNumber.trim()
        : "Spires";
    const hirerName = typeof data?.hirerName === "string" && data.hirerName.trim() ? data.hirerName.trim() : "Customer";
    let termsParagraph = "";
    const bookingId = typeof data?.bookingId === "string" ? data.bookingId.trim() : "";
    if ((pdfType === "confirmation" || pdfType === "booking_confirmation") &&
        bookingId &&
        (0, quoteWorkflow_1.isQuoteAdmin)(String(context.auth.token.email || ""))) {
        const snap = await admin.firestore().collection("bookings").doc(bookingId).get();
        if (snap.exists)
            termsParagraph = (0, bookingTerms_1.confirmationTermsParagraph)(snap.data() || {});
    }
    const pdfBase64Raw = typeof data?.pdfBase64 === "string" ? data.pdfBase64.trim() : "";
    const comma = pdfBase64Raw.indexOf(",");
    const pdfBase64 = comma >= 0 ? pdfBase64Raw.slice(comma + 1) : pdfBase64Raw;
    if (pdfBase64.length > 0) {
        let pdfBuffer;
        try {
            pdfBuffer = Buffer.from(pdfBase64, "base64");
        }
        catch (e) {
            functions.logger.error("sendBookingPdfToCustomer invalid base64", e);
            throw new functions.https.HttpsError("invalid-argument", "Invalid PDF data.");
        }
        if (pdfBuffer.length === 0) {
            throw new functions.https.HttpsError("invalid-argument", "Empty PDF.");
        }
        if (pdfBuffer.length > MAX_INLINE_PDF_BYTES) {
            throw new functions.https.HttpsError("invalid-argument", `PDF is too large to send inline (${Math.round(pdfBuffer.length / 1024)} KB). Use Download, or contact support.`);
        }
        await sendMailWithPdf({ pdfBuffer, toEmail, pdfType, bookingNumber, hirerName, termsParagraph });
        functions.logger.info(`Booking PDF emailed (inline) ${bookingNumber} to ${toEmail}`);
        return { success: true, to: toEmail, via: "inline" };
    }
    const uid = context.auth.uid;
    const storagePath = typeof data?.storagePath === "string" ? data.storagePath.trim() : "";
    if (!storagePath) {
        throw new functions.https.HttpsError("invalid-argument", "No PDF attached. Send pdfBase64 from the admin app, or storagePath for large uploads.");
    }
    const prefix = `admin-email-pdf/${uid}/`;
    if (!storagePath.startsWith(prefix) || storagePath.includes("..") || storagePath.includes("//")) {
        throw new functions.https.HttpsError("invalid-argument", "Invalid storage path.");
    }
    const bucketName = resolveStorageBucket();
    if (!bucketName) {
        throw new functions.https.HttpsError("failed-precondition", "Could not resolve Storage bucket for this project.");
    }
    const bucket = admin.storage().bucket(bucketName);
    const file = bucket.file(storagePath);
    const [exists] = await file.exists();
    if (!exists) {
        throw new functions.https.HttpsError("not-found", "Upload not found. Deploy Storage rules for admin-email-pdf, or use the latest admin app (sends PDF inline).");
    }
    let pdfBuffer;
    try {
        const [buf] = await file.download();
        pdfBuffer = buf;
    }
    catch (e) {
        functions.logger.error("sendBookingPdfToCustomer download failed", e);
        throw new functions.https.HttpsError("internal", "Could not read uploaded PDF from Storage.");
    }
    try {
        await sendMailWithPdf({ pdfBuffer, toEmail, pdfType, bookingNumber, hirerName, termsParagraph });
    }
    finally {
        await file.delete().catch((err) => functions.logger.warn("Temp PDF delete failed", err));
    }
    functions.logger.info(`Booking PDF emailed (storage) ${bookingNumber} to ${toEmail}`);
    return { success: true, to: toEmail, via: "storage" };
});
