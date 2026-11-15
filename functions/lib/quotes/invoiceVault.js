"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceKey = invoiceKey;
exports.invoiceRevisionDecision = invoiceRevisionDecision;
exports.assignServerInvoiceNumbers = assignServerInvoiceNumbers;
exports.planInvoiceSave = planInvoiceSave;
exports.mergeInvoiceRecords = mergeInvoiceRecords;
exports.isInvoicePaid = isInvoicePaid;
exports.invoicePaymentState = invoicePaymentState;
exports.invoiceEmailState = invoiceEmailState;
exports.invoicePaidDateLabel = invoicePaidDateLabel;
const PRESERVE_IF_MISSING = ["emailedAt", "emailedTo", "emailStatus", "emailError"];
function invoiceKey(row) {
    return String(row.id || row.invoiceNumber || "");
}
/**
 * Incoming vault writes replace the invoice list, but payment and email fields
 * are kept when the incoming copy simply omits them. A null paidAt clears payment.
 */
function invoiceRevisionDecision(existingRevision, expectedRevision) {
    const current = Number.isInteger(existingRevision) && Number(existingRevision) >= 0 ? Number(existingRevision) : 0;
    if (!Number.isInteger(expectedRevision) || expectedRevision !== current) {
        return { ok: false, reason: "These invoices were saved in another session. Reload before saving." };
    }
    return { ok: true, revision: current + 1 };
}
const INVOICE_NUMBER = /^(.*?)-(\d{6})-(\d+)$/;
function rememberIssuedNumber(seq, used, row) {
    const number = String(row.invoiceNumber || "");
    if (!number || number === "PENDING")
        return;
    used.add(number);
    const match = number.match(INVOICE_NUMBER);
    if (!match)
        return;
    const period = `${match[2].slice(0, 4)}-${match[2].slice(4)}`;
    const key = `${match[1]}-${period}`;
    const count = Number(match[3]);
    if (Number.isInteger(count) && count > 0)
        seq[key] = Math.max(seq[key] || 0, count);
}
/**
 * New invoices ask for a number. The counter already stored with the vault
 * is the one that advances, inside the same save as the revision.
 */
function assignServerInvoiceNumbers(existing, incoming, existingSeq) {
    const seq = {};
    for (const [key, value] of Object.entries(existingSeq || {})) {
        const count = Math.round(Number(value));
        if (Number.isInteger(count) && count > 0)
            seq[key] = count;
    }
    const used = new Set();
    for (const row of existing)
        rememberIssuedNumber(seq, used, row);
    const assigned = [];
    const previousById = new Map();
    for (const row of existing) {
        const id = String(row.id || "");
        if (id)
            previousById.set(id, row);
    }
    const invoices = mergeInvoiceRecords(existing, incoming).map((row) => {
        const number = String(row.invoiceNumber || "");
        const needs = row.needsServerNumber === true || !number || number === "PENDING";
        const prior = previousById.get(String(row.id || ""));
        const priorNumber = String(prior?.invoiceNumber || "");
        if (needs && prior && priorNumber && priorNumber !== "PENDING") {
            const id = String(row.id || prior.id || priorNumber);
            assigned.push({ id, invoiceNumber: priorNumber });
            const copy = { ...row, id, invoiceNumber: priorNumber };
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
        const copy = { ...row, id, invoiceNumber };
        delete copy.needsServerNumber;
        delete copy.numberPrefix;
        delete copy.numberPeriod;
        return copy;
    });
    return { invoices, seq, assigned };
}
function planInvoiceSave(existing, incoming) {
    const decision = invoiceRevisionDecision(existing?.revision, incoming.expectedRevision);
    if (!decision.ok)
        return decision;
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
    }
    catch (err) {
        return { ok: false, reason: err instanceof Error ? err.message : "Could not issue an invoice number." };
    }
}
function mergeInvoiceRecords(existing, incoming) {
    const prev = new Map();
    for (const row of existing) {
        const key = invoiceKey(row);
        if (key)
            prev.set(key, row);
    }
    return incoming.map((row) => {
        const key = invoiceKey(row);
        const old = key ? prev.get(key) : undefined;
        if (!old)
            return { ...row };
        const next = { ...old, ...row };
        if (!Object.prototype.hasOwnProperty.call(row, "paidAt")) {
            if (typeof old.paidAt === "string" && old.paidAt)
                next.paidAt = old.paidAt;
        }
        else if (row.paidAt == null || row.paidAt === "") {
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
function isInvoicePaid(row) {
    return Boolean(row?.paidAt);
}
function invoicePaymentState(row, todayYmd, totalPenceOrPounds) {
    if (isInvoicePaid(row))
        return "paid";
    const due = String(row.dueDate || "").slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(due))
        return "unpaid";
    if (!(totalPenceOrPounds > 0))
        return "unpaid";
    if (/^\d{4}-\d{2}-\d{2}$/.test(todayYmd) && todayYmd > due)
        return "overdue";
    return "unpaid";
}
function invoiceEmailState(row) {
    if (row.emailStatus === "failed")
        return "failed";
    if (row.emailStatus === "queued")
        return "queued";
    if (row.emailStatus === "sent" || row.emailedAt)
        return "sent";
    return "not_sent";
}
function invoicePaidDateLabel(paidAt) {
    if (!paidAt)
        return "";
    const day = String(paidAt).slice(0, 10);
    if (!/^\d{4}-\d{2}-\d{2}$/.test(day))
        return "";
    return day;
}
