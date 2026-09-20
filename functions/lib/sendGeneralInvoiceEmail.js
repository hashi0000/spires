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
exports.sendGeneralInvoiceEmail = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const driverReminderEmail_1 = require("./driverReminderEmail");
const MAX_INLINE_PDF_BYTES = 4 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
function isoDateParts(iso) {
    const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
    if (!match)
        return null;
    const y = Number(match[1]);
    const m = Number(match[2]);
    const d = Number(match[3]);
    if (!y || m < 1 || m > 12 || d < 1 || d > 31)
        return null;
    return { y, m, d };
}
function calendarDaysBetween(fromIso, toIso) {
    const from = isoDateParts(fromIso);
    const to = isoDateParts(toIso);
    if (!from || !to)
        return null;
    const fromUtc = Date.UTC(from.y, from.m - 1, from.d);
    const toUtc = Date.UTC(to.y, to.m - 1, to.d);
    return Math.round((toUtc - fromUtc) / 86400000);
}
function paymentTermsFromDates(invoiceDate, dueDate) {
    const days = calendarDaysBetween(invoiceDate, dueDate);
    if (days === 0)
        return "due_on_receipt";
    if (days === 7)
        return "7_days";
    if (days === 14)
        return "14_days";
    if (days === 28)
        return "28_days";
    if (days === 30)
        return "30_days";
    return "custom";
}
function paymentTermsLabel(terms, dueDate = "") {
    if (terms === "due_on_receipt")
        return "Due on receipt";
    if (terms === "7_days")
        return "Payment within 7 days";
    if (terms === "14_days")
        return "Payment within 14 days";
    if (terms === "28_days")
        return "Payment within 28 days";
    if (terms === "30_days")
        return "Payment within 30 days";
    return dueDate ? `Payment due by ${formatUkDate(dueDate)}` : "Payment due by the due date";
}
function invoicePaymentTermsLabel(invoiceDate, dueDate, storedTerms = "") {
    if (invoiceDate && dueDate) {
        return paymentTermsLabel(paymentTermsFromDates(invoiceDate, dueDate), dueDate);
    }
    if (storedTerms === "7_days")
        return "Payment within 7 days";
    if (storedTerms === "14_days")
        return "Payment within 14 days";
    if (storedTerms === "28_days")
        return "Payment within 28 days";
    if (storedTerms === "30_days")
        return "Payment within 30 days";
    if (storedTerms === "custom" && dueDate)
        return `Payment due by ${formatUkDate(dueDate)}`;
    return "Due on receipt";
}
function formatUkDate(iso) {
    if (!iso)
        return "";
    const [y, m, d] = iso.split("-").map(Number);
    return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-GB", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "Europe/London",
    });
}
function formatGbpHtml(n) {
    const amount = (Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
    });
    return `&pound;${amount}`;
}
function isEmail(value) {
    return EMAIL_RE.test(value);
}
/**
 * Authenticated staff: email a general invoice PDF to the customer,
 * with a copy to the office mailbox.
 */
exports.sendGeneralInvoiceEmail = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    if (!(0, driverReminderEmail_1.reminderConfigOk)()) {
        throw new functions.https.HttpsError("failed-precondition", "Email is not configured. Set: firebase functions:config:set email.pass=\"...\" (and smtp.host if needed).");
    }
    const toEmail = typeof data?.toEmail === "string" ? data.toEmail.trim() : "";
    if (!toEmail || !isEmail(toEmail)) {
        throw new functions.https.HttpsError("invalid-argument", "A valid customer email is required.");
    }
    const invoiceNumber = typeof data?.invoiceNumber === "string" && data.invoiceNumber.trim()
        ? data.invoiceNumber.trim()
        : "";
    if (!invoiceNumber) {
        throw new functions.https.HttpsError("invalid-argument", "invoiceNumber is required.");
    }
    const customerName = typeof data?.customerName === "string" && data.customerName.trim()
        ? data.customerName.trim()
        : "Customer";
    const invoiceDate = typeof data?.invoiceDate === "string" ? data.invoiceDate.trim() : "";
    const dueDate = typeof data?.dueDate === "string" ? data.dueDate.trim() : "";
    const termsRaw = typeof data?.paymentTerms === "string" ? data.paymentTerms : "";
    const paymentTermsLabelText = invoicePaymentTermsLabel(invoiceDate, dueDate, termsRaw);
    const total = Number(data?.total);
    if (!Number.isFinite(total) || total <= 0) {
        throw new functions.https.HttpsError("invalid-argument", "Invoice total is required.");
    }
    const pdfBase64Raw = typeof data?.pdfBase64 === "string" ? data.pdfBase64.trim() : "";
    const comma = pdfBase64Raw.indexOf(",");
    const pdfBase64 = comma >= 0 ? pdfBase64Raw.slice(comma + 1) : pdfBase64Raw;
    if (!pdfBase64) {
        throw new functions.https.HttpsError("invalid-argument", "No PDF attached.");
    }
    let pdfBuffer;
    try {
        pdfBuffer = Buffer.from(pdfBase64, "base64");
    }
    catch (e) {
        functions.logger.error("sendGeneralInvoiceEmail invalid base64", e);
        throw new functions.https.HttpsError("invalid-argument", "Invalid PDF data.");
    }
    if (pdfBuffer.length === 0) {
        throw new functions.https.HttpsError("invalid-argument", "Empty PDF.");
    }
    if (pdfBuffer.length > MAX_INLINE_PDF_BYTES) {
        throw new functions.https.HttpsError("invalid-argument", `PDF is too large to send (${Math.round(pdfBuffer.length / 1024)} KB).`);
    }
    const officeCc = driverReminderEmail_1.ADMIN_EMAIL;
    const cc = toEmail.toLowerCase() === officeCc.toLowerCase() ? undefined : officeCc;
    const html = `
      <div style="font-family:sans-serif;font-size:16px;color:#333;">
        <p>Dear ${(0, driverReminderEmail_1.escapeHtml)(customerName)},</p>
        <p>Please find attached invoice <strong>${(0, driverReminderEmail_1.escapeHtml)(invoiceNumber)}</strong> for <strong>${formatGbpHtml(total)}</strong>.</p>
        <p>Payment terms: ${(0, driverReminderEmail_1.escapeHtml)(paymentTermsLabelText)}${dueDate ? `. Due ${(0, driverReminderEmail_1.escapeHtml)(formatUkDate(dueDate))}` : ""}${invoiceDate ? `. Invoice date: ${(0, driverReminderEmail_1.escapeHtml)(formatUkDate(invoiceDate))}` : ""}.</p>
        <p>Please pay by bank transfer using the invoice number as the payment reference. Bank details are on the attached invoice.</p>
        <p>
          📱 <a href="tel:07776897772">07776 897772</a><br>
          📧 <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
          🌐 <a href="https://www.spires-taxis.com">www.spires-taxis.com</a>
        </p>
      </div>`;
    await (0, driverReminderEmail_1.getTransporter)().sendMail({
        from: (0, driverReminderEmail_1.mailFrom)(),
        to: toEmail,
        cc,
        subject: `Invoice ${invoiceNumber} — Spires Taxis`,
        html,
        attachments: [
            {
                filename: `Spires-Taxis-Invoice-${invoiceNumber}.pdf`,
                content: pdfBuffer,
                contentType: "application/pdf",
            },
        ],
    });
    functions.logger.info(`General invoice emailed ${invoiceNumber} to ${toEmail} cc ${cc || "none"}`);
    return { success: true, to: toEmail, cc: cc || null };
});
