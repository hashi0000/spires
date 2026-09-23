import { httpsCallable } from "firebase/functions";
import { functions } from "./firebase";
import { blobToRawBase64 } from "./blobToBase64";
import { getCallableErrorMessage } from "./callableErrorMessage";
import { generateGeneralInvoicePdfBlob } from "./generalInvoicePdf";
import {
  GeneratedGeneralInvoice,
  InvoiceSupplierDetails,
  invoiceTotals,
  normaliseInvoicePaymentMethod,
} from "./generalInvoiceTypes";

export const SPIRES_OFFICE_EMAIL = "bookings@spires-taxis.com";
const MAX_EMAIL_PDF_BYTES = 4 * 1024 * 1024;
const sendInvoiceEmail = httpsCallable(functions, "sendGeneralInvoiceEmail");

export function askInvoiceRecipient(suggested: string): string | null {
  const toInput = window.prompt(
    `Send the invoice PDF to this address. A copy will go to ${SPIRES_OFFICE_EMAIL}.`,
    suggested.trim()
  );
  const to = toInput?.trim() || "";
  if (!to) return null;
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(to)) {
    window.alert("Enter a valid email address.");
    return null;
  }
  return to;
}

export async function emailGeneralInvoicePdf(
  row: GeneratedGeneralInvoice,
  supplier: InvoiceSupplierDetails,
  toEmail: string
): Promise<{ to: string; cc: string | null }> {
  const blob = await generateGeneralInvoicePdfBlob({
    invoiceNumber: row.invoiceNumber,
    invoiceDate: row.invoiceDate,
    dueDate: row.dueDate,
    paymentTerms: row.paymentTerms,
    customer: row.customer,
    bookingNumber: row.bookingNumber,
    travelDate: row.travelDate,
    pickup: row.pickup,
    destination: row.destination,
    lines: row.lines,
    notes: row.notes,
    supplier,
    paymentMethod: normaliseInvoicePaymentMethod(row.paymentMethod),
  });
  if (blob.size > MAX_EMAIL_PDF_BYTES) {
    throw new Error(
      `This PDF is too large to email (${Math.round(blob.size / 1024)} KB). Download it instead.`
    );
  }
  const pdfBase64 = await blobToRawBase64(blob);
  try {
    const result = await sendInvoiceEmail({
      pdfBase64,
      toEmail,
      invoiceNumber: row.invoiceNumber,
      customerName: row.customer.name,
      invoiceDate: row.invoiceDate,
      dueDate: row.dueDate,
      paymentTerms: row.paymentTerms,
      paymentMethod: normaliseInvoicePaymentMethod(row.paymentMethod),
      total: invoiceTotals(row.lines).total,
    });
    const data = result.data as { success?: boolean; to?: string; cc?: string | null };
    if (!data?.success) {
      throw new Error("The invoice email was not sent.");
    }
    return { to: data.to || toEmail, cc: data.cc ?? null };
  } catch (err) {
    throw new Error(getCallableErrorMessage(err));
  }
}
