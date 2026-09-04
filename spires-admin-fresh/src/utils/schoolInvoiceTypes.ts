import { SPIRES_BANK_DETAILS } from "./bankDetails";

export type SchoolInvoiceKind = "monthly_contract" | "social_care_one_off";

export type SchoolContractRoute = {
  id: string;
  routeNumber: string;
  /** Daily contract price in pounds, excluding VAT */
  dailyPrice: number;
  vatRatePercent: number;
  /** Route description — must not include children’s names */
  description: string;
};

export type SchoolInvoiceLine = {
  routeNumber: string;
  description: string;
  dailyPrice: number;
  schoolDays: number;
  vatRatePercent: number;
  /** Contractual deductions / cancellations in pounds (ex VAT) */
  deductions: number;
};

export type SchoolSupplierDetails = {
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

export type GeneratedSchoolInvoice = {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  kind: SchoolInvoiceKind;
  serviceMonth: string;
  lines: SchoolInvoiceLine[];
  notes: string;
  createdAt: string;
  draft: boolean;
};

export const DEFAULT_SUPPLIER_DETAILS: SchoolSupplierDetails = {
  providerName: SPIRES_BANK_DETAILS.accountName,
  address: "",
  phone: "07776 897772",
  email: "bookings@spires-taxis.com",
  companyNumber: "",
  vatNumber: "",
  accountName: SPIRES_BANK_DETAILS.accountName,
  sortCode: SPIRES_BANK_DETAILS.sortCode,
  accountNumber: SPIRES_BANK_DETAILS.accountNumber,
  invoicePrefix: "ST-OCC",
};

export function roundMoney(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function lineNet(line: SchoolInvoiceLine): number {
  const grossDays = roundMoney(line.dailyPrice * line.schoolDays);
  return roundMoney(Math.max(0, grossDays - (line.deductions || 0)));
}

export function lineVat(line: SchoolInvoiceLine): number {
  return roundMoney(lineNet(line) * ((line.vatRatePercent || 0) / 100));
}

export function lineTotal(line: SchoolInvoiceLine): number {
  return roundMoney(lineNet(line) + lineVat(line));
}

export function invoiceTotals(lines: SchoolInvoiceLine[]): {
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

export function formatGbp(n: number): string {
  return n.toLocaleString("en-GB", { style: "currency", currency: "GBP" });
}

const NAME_HINT =
  /\b(pupil|child|children|student named|named pupil|master |miss )\b/i;

/** Soft check — invoices must never include children’s names. */
export function looksLikeItContainsChildNames(text: string): boolean {
  return NAME_HINT.test(text);
}
