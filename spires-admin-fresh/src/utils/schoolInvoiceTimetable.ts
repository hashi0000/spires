/**
 * Oxfordshire County Council school transport invoice timetable
 * Academic year 2026/2027 — monthly in arrears.
 */
export type SchoolTransportMonth = {
  /** ISO year-month of the service period, e.g. 2026-09 */
  serviceMonth: string;
  label: string;
  /** First calendar day invoices may be submitted (ISO date) */
  earliestSubmit: string;
  /** Date processing begins (ISO date) */
  processedFrom: string;
  note?: string;
};

export const OCC_FINANCE_EMAIL = "SchoolTransportFinance@Oxfordshire.gov.uk";
export const OCC_FINANCE_EMAIL_LOWER = "schooltransportfinance@oxfordshire.gov.uk";

export const SCHOOL_INVOICE_TIMETABLE_2026_27: SchoolTransportMonth[] = [
  { serviceMonth: "2026-09", label: "September 2026", earliestSubmit: "2026-10-01", processedFrom: "2026-10-01" },
  { serviceMonth: "2026-10", label: "October 2026", earliestSubmit: "2026-11-01", processedFrom: "2026-11-02" },
  { serviceMonth: "2026-11", label: "November 2026", earliestSubmit: "2026-12-01", processedFrom: "2026-12-01" },
  { serviceMonth: "2026-12", label: "December 2026", earliestSubmit: "2027-01-01", processedFrom: "2027-01-04" },
  { serviceMonth: "2027-01", label: "January 2027", earliestSubmit: "2027-02-01", processedFrom: "2027-02-01" },
  { serviceMonth: "2027-02", label: "February 2027", earliestSubmit: "2027-03-01", processedFrom: "2027-03-01" },
  {
    serviceMonth: "2027-03",
    label: "March 2027",
    earliestSubmit: "2027-04-01",
    processedFrom: "2027-04-08",
    note: "March invoices are expected to be processed from 8 April 2027 due to financial year-end. Confirm once the Council’s year-end timetable is finalised.",
  },
  { serviceMonth: "2027-04", label: "April 2027", earliestSubmit: "2027-05-01", processedFrom: "2027-05-04" },
  { serviceMonth: "2027-05", label: "May 2027", earliestSubmit: "2027-06-01", processedFrom: "2027-06-01" },
  { serviceMonth: "2027-06", label: "June 2027", earliestSubmit: "2027-07-01", processedFrom: "2027-07-01" },
  { serviceMonth: "2027-07", label: "July 2027", earliestSubmit: "2027-08-01", processedFrom: "2027-08-02" },
];

export function parseIsoDate(iso: string): Date {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

export function formatUkDate(iso: string): string {
  return parseIsoDate(iso).toLocaleDateString("en-GB", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

export function monthKeyFromDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function getTimetableRow(serviceMonth: string): SchoolTransportMonth | undefined {
  return SCHOOL_INVOICE_TIMETABLE_2026_27.find((row) => row.serviceMonth === serviceMonth);
}

/** Generic arrears rule if the month is outside the published 2026/27 table. */
export function earliestSubmitForServiceMonth(serviceMonth: string): string {
  const known = getTimetableRow(serviceMonth);
  if (known) return known.earliestSubmit;
  const [y, m] = serviceMonth.split("-").map(Number);
  const next = new Date(y, m, 1);
  return toIsoDate(next);
}

export function canSubmitOn(serviceMonth: string, today: Date = new Date()): boolean {
  const earliest = parseIsoDate(earliestSubmitForServiceMonth(serviceMonth));
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return startOfToday.getTime() >= earliest.getTime();
}

export function daysUntilSubmit(serviceMonth: string, today: Date = new Date()): number {
  const earliest = parseIsoDate(earliestSubmitForServiceMonth(serviceMonth));
  const startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
  return Math.ceil((earliest.getTime() - startOfToday.getTime()) / (24 * 60 * 60 * 1000));
}

export function defaultServiceMonth(today: Date = new Date()): string {
  const previous = monthKeyFromDate(new Date(today.getFullYear(), today.getMonth() - 1, 1));
  if (getTimetableRow(previous)) return previous;
  const current = monthKeyFromDate(today);
  if (getTimetableRow(current)) return current;
  return SCHOOL_INVOICE_TIMETABLE_2026_27[0].serviceMonth;
}

export function labelForServiceMonth(serviceMonth: string): string {
  const known = getTimetableRow(serviceMonth);
  if (known) return known.label;
  const [y, m] = serviceMonth.split("-").map(Number);
  return new Date(y, m - 1, 1).toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}
