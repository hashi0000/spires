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
export function invoiceRevisionDecision(
  existingRevision: unknown,
  expectedRevision: unknown
): { ok: true; revision: number } | { ok: false; reason: string } {
  const current = Number.isInteger(existingRevision) && Number(existingRevision) >= 0 ? Number(existingRevision) : 0;
  if (!Number.isInteger(expectedRevision) || expectedRevision !== current) {
    return { ok: false, reason: "These invoices were saved in another session. Reload before saving." };
  }
  return { ok: true, revision: current + 1 };
}

const INVOICE_NUMBER = /^(.*?)-(\d{6})-(\d+)$/;

function rememberIssuedNumber(seq: Record<string, number>, used: Set<string>, row: InvoiceLike): void {
  const number = String(row.invoiceNumber || "");
  if (!number || number === "PENDING") return;
  used.add(number);
  const match = number.match(INVOICE_NUMBER);
  if (!match) return;
  const period = `${match[2].slice(0, 4)}-${match[2].slice(4)}`;
  const key = `${match[1]}-${period}`;
  const count = Number(match[3]);
  if (Number.isInteger(count) && count > 0) seq[key] = Math.max(seq[key] || 0, count);
}

/**
 * New invoices ask for a number. The counter already stored with the vault
 * is the one that advances, inside the same save as the revision.
 */
export function assignServerInvoiceNumbers(
  existing: InvoiceLike[],
  incoming: InvoiceLike[],
  existingSeq: Record<string, number> | undefined
): { invoices: InvoiceLike[]; seq: Record<string, number>; assigned: { id: string; invoiceNumber: string }[] } {
  const seq: Record<string, number> = {};
  for (const [key, value] of Object.entries(existingSeq || {})) {
    const count = Math.round(Number(value));
    if (Number.isInteger(count) && count > 0) seq[key] = count;
  }
  const used = new Set<string>();
  for (const row of existing) rememberIssuedNumber(seq, used, row);
  const assigned: { id: string; invoiceNumber: string }[] = [];
  const previousById = new Map<string, InvoiceLike>();
  for (const row of existing) {
    const id = String(row.id || "");
    if (id) previousById.set(id, row);
  }
  const invoices = mergeInvoiceRecords(existing, incoming).map((row) => {
    const number = String(row.invoiceNumber || "");
    const needs = row.needsServerNumber === true || !number || number === "PENDING";
    const prior = previousById.get(String(row.id || ""));
    const priorNumber = String(prior?.invoiceNumber || "");
    if (needs && prior && priorNumber && priorNumber !== "PENDING") {
      const id = String(row.id || prior.id || priorNumber);
      assigned.push({ id, invoiceNumber: priorNumber });
      const copy: InvoiceLike = { ...row, id, invoiceNumber: priorNumber };
      delete copy.needsServerNumber;
      delete copy.numberPrefix;
      delete copy.numberPeriod;
      rememberIssuedNumber(seq, used, copy);
      return copy;
    }
    if (!needs) {
      rememberIssuedNumber(seq, used, row);
      const copy = { ...row };
      delete copy.needsServerNumber;
      delete copy.numberPrefix;
      delete copy.numberPeriod;
      return copy;
    }
    const prefix = String(row.numberPrefix || "ST-INV").replace(/[^A-Za-z0-9-]/g, "").replace(/-+/g, "-").replace(/^-|-$/g, "").slice(0, 16) || "ST-INV";
    const period = String(row.numberPeriod || row.invoiceDate || "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(period)) {
      throw new Error("A new invoice needs a year and month before a number can be issued.");
    }
    const key = `${prefix}-${period}`;
    let count = (seq[key] || 0) + 1;
    let invoiceNumber = `${prefix}-${period.replace("-", "")}-${String(count).padStart(3, "0")}`;
    while (used.has(invoiceNumber)) {
      count += 1;
      invoiceNumber = `${prefix}-${period.replace("-", "")}-${String(count).padStart(3, "0")}`;
    }
    seq[key] = count;
    used.add(invoiceNumber);
    const id = String(row.id || invoiceNumber);
    assigned.push({ id, invoiceNumber });
    const copy: InvoiceLike = { ...row, id, invoiceNumber };
    delete copy.needsServerNumber;
    delete copy.numberPrefix;
    delete copy.numberPeriod;
    return copy;
  });
  return { invoices, seq, assigned };
}

export function planInvoiceSave(
  existing: { invoices?: InvoiceLike[]; seq?: Record<string, number>; revision?: unknown } | null,
  incoming: { invoices?: InvoiceLike[]; seq?: Record<string, number>; expectedRevision?: unknown; supplier?: unknown; routes?: unknown[] }
): { ok: true; revision: number; supplier: unknown; routes: unknown[]; invoices: InvoiceLike[]; seq: Record<string, number>; assigned: { id: string; invoiceNumber: string }[] } | { ok: false; reason: string } {
  const decision = invoiceRevisionDecision(existing?.revision, incoming.expectedRevision);
  if (!decision.ok) return decision;
  try {
    const numbered = assignServerInvoiceNumbers(existing?.invoices || [], incoming.invoices || [], existing?.seq);
    return {
      ok: true,
      revision: decision.revision,
      supplier: incoming.supplier ?? null,
      routes: Array.isArray(incoming.routes) ? incoming.routes : [],
      invoices: numbered.invoices,
      seq: numbered.seq,
      assigned: numbered.assigned,
    };
  } catch (err) {
    return { ok: false, reason: err instanceof Error ? err.message : "Could not issue an invoice number." };
  }
}

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
