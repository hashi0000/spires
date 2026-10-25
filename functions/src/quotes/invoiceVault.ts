export type InvoiceLike = {
  id?: string;
  invoiceNumber?: string;
  paidAt?: string | null;
  emailedAt?: string | null;
  emailedTo?: string | null;
  emailStatus?: string | null;
  emailError?: string | null;
  dueDate?: string | null;
  lines?: Array<{ quantity?: number; unitPrice?: number; vatRatePercent?: number }>;
  [key: string]: unknown;
};

const PRESERVE_IF_MISSING = ["emailedAt", "emailedTo", "emailStatus", "emailError"] as const;

export function invoiceKey(row: InvoiceLike): string {
  return String(row.id || row.invoiceNumber || "");
}

/**
 * Incoming vault writes replace the invoice list, but payment and email fields
 * are kept when the incoming copy simply omits them. A null paidAt clears payment.
 */
export function mergeInvoiceRecords(existing: InvoiceLike[], incoming: InvoiceLike[]): InvoiceLike[] {
  const prev = new Map<string, InvoiceLike>();
  for (const row of existing) {
    const key = invoiceKey(row);
    if (key) prev.set(key, row);
  }
  return incoming.map((row) => {
    const key = invoiceKey(row);
    const old = key ? prev.get(key) : undefined;
    if (!old) return { ...row };
    const next: InvoiceLike = { ...old, ...row };
    if (!Object.prototype.hasOwnProperty.call(row, "paidAt")) {
      if (typeof old.paidAt === "string" && old.paidAt) next.paidAt = old.paidAt;
    } else if (row.paidAt == null || row.paidAt === "") {
      delete next.paidAt;
    }
    for (const field of PRESERVE_IF_MISSING) {
      if (!Object.prototype.hasOwnProperty.call(row, field) && old[field]) {
        next[field] = old[field];
      }
    }
    return next;
  });
}

export function isInvoicePaid(row?: { paidAt?: string | null } | null): boolean {
  return Boolean(row?.paidAt);
}

export function invoicePaymentState(
  row: InvoiceLike,
  todayYmd: string,
  totalPenceOrPounds: number
): "paid" | "unpaid" | "overdue" {
  if (isInvoicePaid(row)) return "paid";
  const due = String(row.dueDate || "").slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(due)) return "unpaid";
  if (!(totalPenceOrPounds > 0)) return "unpaid";
  if (/^\d{4}-\d{2}-\d{2}$/.test(todayYmd) && todayYmd > due) return "overdue";
  return "unpaid";
}

export function invoiceEmailState(row: InvoiceLike): "not_sent" | "queued" | "sent" | "failed" {
  if (row.emailStatus === "failed") return "failed";
  if (row.emailStatus === "queued") return "queued";
  if (row.emailStatus === "sent" || row.emailedAt) return "sent";
  return "not_sent";
}

export function invoicePaidDateLabel(paidAt?: string | null): string {
  if (!paidAt) return "";
  const day = String(paidAt).slice(0, 10);
  if (!/^\d{4}-\d{2}-\d{2}$/.test(day)) return "";
  return day;
}
