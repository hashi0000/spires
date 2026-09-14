import { SPIRES_BANK_DETAILS } from "./bankDetails";

export type InvoicePaymentTerms = "due_on_receipt" | "14_days" | "28_days";

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

export function formatUkDate(iso: string): string {
  if (!iso) return "";
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function paymentTermsLabel(terms: InvoicePaymentTerms): string {
  if (terms === "due_on_receipt") return "Due on receipt";
  if (terms === "14_days") return "14 days";
  return "28 days";
}

export function dueDateFor(invoiceDate: string, terms: InvoicePaymentTerms): string {
  if (!invoiceDate || terms === "due_on_receipt") return invoiceDate;
  const days = terms === "14_days" ? 14 : 28;
  const [y, m, d] = invoiceDate.split("-").map(Number);
  const dt = new Date(y, (m || 1) - 1, d || 1);
  dt.setDate(dt.getDate() + days);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, "0");
  const dd = String(dt.getDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}
