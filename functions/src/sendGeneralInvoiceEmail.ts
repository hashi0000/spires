import * as functions from "firebase-functions/v1";
import {
  ADMIN_EMAIL,
  escapeHtml,
  getTransporter,
  mailFrom,
  reminderConfigOk,
} from "./driverReminderEmail";

const MAX_INLINE_PDF_BYTES = 4 * 1024 * 1024;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

type PaymentTerms = "due_on_receipt" | "14_days" | "28_days";

function paymentTermsLabel(terms: string): string {
  if (terms === "14_days") return "14 days";
  if (terms === "28_days") return "28 days";
  return "Due on receipt";
}

function formatUkDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "Europe/London",
  });
}

function formatGbpHtml(n: number): string {
  const amount = (Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `&pound;${amount}`;
}

function isEmail(value: string): boolean {
  return EMAIL_RE.test(value);
}

/**
 * Authenticated staff: email a general invoice PDF to the customer,
 * with a copy to the office mailbox.
 */
export const sendGeneralInvoiceEmail = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  if (!reminderConfigOk()) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Email is not configured. Set: firebase functions:config:set email.pass=\"...\" (and smtp.host if needed)."
    );
  }

  const toEmail = typeof data?.toEmail === "string" ? data.toEmail.trim() : "";
  if (!toEmail || !isEmail(toEmail)) {
    throw new functions.https.HttpsError("invalid-argument", "A valid customer email is required.");
  }

  const invoiceNumber =
    typeof data?.invoiceNumber === "string" && data.invoiceNumber.trim()
      ? data.invoiceNumber.trim()
      : "";
  if (!invoiceNumber) {
    throw new functions.https.HttpsError("invalid-argument", "invoiceNumber is required.");
  }

  const customerName =
    typeof data?.customerName === "string" && data.customerName.trim()
      ? data.customerName.trim()
      : "Customer";
  const invoiceDate = typeof data?.invoiceDate === "string" ? data.invoiceDate.trim() : "";
  const dueDate = typeof data?.dueDate === "string" ? data.dueDate.trim() : "";
  const termsRaw = typeof data?.paymentTerms === "string" ? data.paymentTerms : "due_on_receipt";
  const paymentTerms: PaymentTerms =
    termsRaw === "14_days" || termsRaw === "28_days" ? termsRaw : "due_on_receipt";
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

  let pdfBuffer: Buffer;
  try {
    pdfBuffer = Buffer.from(pdfBase64, "base64");
  } catch (e) {
    functions.logger.error("sendGeneralInvoiceEmail invalid base64", e);
    throw new functions.https.HttpsError("invalid-argument", "Invalid PDF data.");
  }
  if (pdfBuffer.length === 0) {
    throw new functions.https.HttpsError("invalid-argument", "Empty PDF.");
  }
  if (pdfBuffer.length > MAX_INLINE_PDF_BYTES) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      `PDF is too large to send (${Math.round(pdfBuffer.length / 1024)} KB).`
    );
  }

  const officeCc = ADMIN_EMAIL;
  const cc =
    toEmail.toLowerCase() === officeCc.toLowerCase() ? undefined : officeCc;

  const html = `
      <div style="font-family:sans-serif;font-size:16px;color:#333;">
        <p>Dear ${escapeHtml(customerName)},</p>
        <p>Please find attached invoice <strong>${escapeHtml(invoiceNumber)}</strong> for <strong>${formatGbpHtml(total)}</strong>.</p>
        <p>Payment terms: ${escapeHtml(paymentTermsLabel(paymentTerms))}${
          dueDate ? `. Due ${escapeHtml(formatUkDate(dueDate))}` : ""
        }${invoiceDate ? `. Invoice date: ${escapeHtml(formatUkDate(invoiceDate))}` : ""}.</p>
        <p>Please pay by bank transfer using the invoice number as the payment reference. Bank details are on the attached invoice.</p>
        <p>
          📱 <a href="tel:07776897772">07776 897772</a><br>
          📧 <a href="mailto:bookings@spires-taxis.com">bookings@spires-taxis.com</a><br>
          🌐 <a href="https://www.spires-taxis.com">www.spires-taxis.com</a>
        </p>
      </div>`;

  await getTransporter().sendMail({
    from: mailFrom(),
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
  return { success: true as const, to: toEmail, cc: cc || null };
});
