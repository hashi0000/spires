import { SPIRES_BANK_DETAILS } from "./bankDetails";

export type InvoicePaymentTerms =
  | "due_on_receipt"
  | "7_days"
  | "14_days"
  | "28_days"
  | "30_days"
  | "custom";

export const FORM_PAYMENT_TERMS: InvoicePaymentTerms[] = [
  "due_on_receipt",
  "7_days",
  "14_days",
  "30_days",
];

export type InvoiceSupplierDetails = {
  providerName: string;
  address: string;
  phone: string;
  email: string;
  companyNumber: string;
  vatNumber: string;
  accountName: string;
  sortCode: string;
  accountNumber: string;
  invoicePrefix: string;
};

export type GeneralInvoiceCustomer = {
  name: string;
  address: string;
  email: string;
  phone: string;
};

export type GeneralInvoiceLine = {
  description: string;
  quantity: number;
  unitPrice: number;
  vatRatePercent: number;
};

export type SavedInvoiceClient = {
  id: string;
  name: string;
  address: string;
  email: string;
  phone: string;
  invoicePrefix: string;
};

export type GeneratedGeneralInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string;
  paymentTerms: InvoicePaymentTerms;
  customer: GeneralInvoiceCustomer;
  clientId?: string;
  bookingNumber: string;
  travelDate: string;
  pickup: string;
  destination: string;
  lines: GeneralInvoiceLine[];
  notes: string;
  createdAt: string;
  emailedAt?: string;
  emailedTo?: string;
};

export const DEFAULT_GENERAL_SUPPLIER: InvoiceSupplierDetails = {
  providerName: SPIRES_BANK_DETAILS.accountName,
  address: "",
  phone: "07776 897772",
  email: "bookings@spires-taxis.com",
  companyNumber: "",
  vatNumber: "",
  accountName: SPIRES_BANK_DETAILS.accountName,
  sortCode: SPIRES_BANK_DETAILS.sortCode,
  accountNumber: SPIRES_BANK_DETAILS.accountNumber,
  invoicePrefix: "ST-INV",
};

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineNet(line: GeneralInvoiceLine): number {
  return roundMoney(Math.max(0, (line.unitPrice || 0) * (line.quantity || 0)));
}

export function lineVat(line: GeneralInvoiceLine): number {
  return roundMoney(lineNet(line) * ((line.vatRatePercent || 0) / 100));
}

export function lineTotal(line: GeneralInvoiceLine): number {
  return roundMoney(lineNet(line) + lineVat(line));
}

export function invoiceTotals(lines: GeneralInvoiceLine[]): {
  net: number;
  vat: number;
  total: number;
} {
  return lines.reduce(
    (acc, line) => ({
      net: roundMoney(acc.net + lineNet(line)),
      vat: roundMoney(acc.vat + lineVat(line)),
      total: roundMoney(acc.total + lineTotal(line)),
    }),
    { net: 0, vat: 0, total: 0 }
  );
}

export function sanitiseInvoicePrefix(raw: string): string {
  const cleaned = raw
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
  return cleaned || "ST-INV";
}

export function suggestInvoicePrefix(name: string): string {
  const words = name
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9 ]+/g, " ")
    .split(/\s+/)
    .filter(Boolean);
  if (!words.length) return "ST-INV";
  const slug =
    words.length === 1 ? words[0].slice(0, 8) : words.map((word) => word[0]).join("").slice(0, 8);
  return sanitiseInvoicePrefix(`ST-${slug}`);
}

/** Always pounds sterling — never a dollar sign, even if the browser locale is US. */
export function formatGbp(n: number): string {
  const amount = (Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `£${amount}`;
}

export function formatGbpHtml(n: number): string {
  const amount = (Number.isFinite(n) ? n : 0).toLocaleString("en-GB", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `&pound;${amount}`;
}

export function todayIsoDate(d = new Date()): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function formatUkDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

function isoDateParts(iso: string): { y: number; m: number; d: number } | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec((iso || "").trim());
  if (!match) return null;
  const y = Number(match[1]);
  const m = Number(match[2]);
  const d = Number(match[3]);
  if (!y || m < 1 || m > 12 || d < 1 || d > 31) return null;
  return { y, m, d };
}

/** Calendar-day difference from YYYY-MM-DD parts, ignoring local time and DST. */
export function calendarDaysBetween(fromIso: string, toIso: string): number | null {
  const from = isoDateParts(fromIso);
  const to = isoDateParts(toIso);
  if (!from || !to) return null;
  const fromUtc = Date.UTC(from.y, from.m - 1, from.d);
  const toUtc = Date.UTC(to.y, to.m - 1, to.d);
  return Math.round((toUtc - fromUtc) / 86400000);
}

export function paymentTermsFromDates(invoiceDate: string, dueDate: string): InvoicePaymentTerms {
  const days = calendarDaysBetween(invoiceDate, dueDate);
  if (days === 0) return "due_on_receipt";
  if (days === 7) return "7_days";
  if (days === 14) return "14_days";
  if (days === 28) return "28_days";
  if (days === 30) return "30_days";
  return "custom";
}

export function formPaymentTermsValue(terms: InvoicePaymentTerms): InvoicePaymentTerms {
  return FORM_PAYMENT_TERMS.includes(terms) ? terms : "custom";
}

export function paymentTermsLabel(terms: InvoicePaymentTerms, dueDate = ""): string {
  if (terms === "due_on_receipt") return "Due on receipt";
  if (terms === "7_days") return "Payment within 7 days";
  if (terms === "14_days") return "Payment within 14 days";
  if (terms === "28_days") return "Payment within 28 days";
  if (terms === "30_days") return "Payment within 30 days";
  return dueDate ? `Payment due by ${formatUkDate(dueDate)}` : "Payment due by the due date";
}

/** Display wording from the selected dates so stored terms cannot contradict the due date. */
export function invoicePaymentTermsLabel(invoiceDate: string, dueDate: string): string {
  return paymentTermsLabel(paymentTermsFromDates(invoiceDate, dueDate), dueDate);
}

export function paymentDueNotice(invoiceDate: string, dueDate: string): string {
  const terms = paymentTermsFromDates(invoiceDate, dueDate);
  if (terms === "due_on_receipt") return "Payment is due on receipt.";
  if (terms === "7_days") return "Payment is due within 7 days.";
  if (terms === "14_days") return "Payment is due within 14 days.";
  if (terms === "28_days") return "Payment is due within 28 days.";
  if (terms === "30_days") return "Payment is due within 30 days.";
  return dueDate ? `Payment is due by ${formatUkDate(dueDate)}.` : "Please pay by the due date.";
}

export function dueDateFor(invoiceDate: string, terms: InvoicePaymentTerms): string {
  if (!invoiceDate || terms === "due_on_receipt" || terms === "custom") return invoiceDate;
  const days = terms === "7_days" ? 7 : terms === "14_days" ? 14 : terms === "30_days" ? 30 : 28;
  const parts = isoDateParts(invoiceDate);
  const dt = parts
    ? new Date(parts.y, parts.m - 1, parts.d)
    : new Date(invoiceDate);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
