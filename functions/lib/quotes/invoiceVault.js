"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.invoiceKey = invoiceKey;
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
