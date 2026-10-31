"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ADMIN_EMAILS = exports.WORKFLOW_STATUSES = void 0;
exports.isQuoteAdmin = isQuoteAdmin;
exports.canCustomerAccept = canCustomerAccept;
exports.decideAcceptance = decideAcceptance;
exports.canIssueQuote = canIssueQuote;
exports.paymentBuckets = paymentBuckets;
exports.shouldMoveToConfirmedAfterPayment = shouldMoveToConfirmedAfterPayment;
exports.effectiveWorkflowStatus = effectiveWorkflowStatus;
exports.isWorkflowConfirmed = isWorkflowConfirmed;
exports.shouldSendConfirmation = shouldSendConfirmation;
exports.bookingMatchesStatusFilter = bookingMatchesStatusFilter;
exports.workflowStatusLabel = workflowStatusLabel;
exports.emailEnqueueDecision = emailEnqueueDecision;
exports.emailJobDocId = emailJobDocId;
exports.WORKFLOW_STATUSES = [
    "pending",
    "awaiting_customer_confirmation",
    "confirmed",
    "allocated",
    "completed",
    "cancelled",
];
exports.ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
function isQuoteAdmin(email) {
    return exports.ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}
function canCustomerAccept(input) {
    if (input.tokenValid)
        return true;
    return Boolean(input.authUid && input.bookingUid && input.authUid === input.bookingUid);
}
function decideAcceptance(input) {
    if (!input.authorised)
        return { ok: false, code: "forbidden" };
    if ((input.status || input.customerStatus) === "cancelled")
        return { ok: false, code: "cancelled" };
    if (!input.quoteIssuedVersion)
        return { ok: false, code: "not_issued" };
    if (input.requestedVersion !== input.quoteIssuedVersion)
        return { ok: false, code: "stale" };
    if (input.validUntilMs != null && input.nowMs > input.validUntilMs)
        return { ok: false, code: "expired" };
    const locked = input.status === "confirmed" || input.status === "allocated" || input.status === "completed";
    if (input.quoteAcceptedVersion === input.quoteIssuedVersion) {
        if (locked || input.paymentRequirement !== "advance" || input.advancePaymentSatisfied === true) {
            return { ok: true, already: true, nextStatus: "confirmed", substatus: "" };
        }
        return {
            ok: true,
            already: true,
            nextStatus: "awaiting_customer_confirmation",
            substatus: "awaiting_payment",
        };
    }
    if (locked)
        return { ok: false, code: "stale" };
    if (input.paymentRequirement === "advance" && input.advancePaymentSatisfied !== true) {
        return { ok: true, already: false, nextStatus: "awaiting_customer_confirmation", substatus: "awaiting_payment" };
    }
    return { ok: true, already: false, nextStatus: "confirmed", substatus: "" };
}
function canIssueQuote(status, reissue) {
    if (status === "cancelled" || status === "completed" || status === "allocated" || status === "confirmed") {
        return { ok: false, reason: "This booking is already confirmed, allocated, completed or cancelled. It was not reset." };
    }
    if (status === "awaiting_customer_confirmation" && !reissue) {
        return { ok: false, reason: "This quote was already sent. Tick reissue to send a new version." };
    }
    return { ok: true };
}
function paymentBuckets(input) {
    const finalFare = Math.max(0, Math.round(input.finalFarePence || 0));
    const received = Math.max(0, Math.round(input.amountReceivedPence || 0));
    const outstandingPence = Math.max(0, finalFare - received);
    if (finalFare > 0 && received >= finalFare) {
        return { stored: "paid", label: "Paid", outstandingPence: 0 };
    }
    if (received > 0) {
        return { stored: "partial", label: "Part paid", outstandingPence };
    }
    const awaiting = input.paymentRequirement === "advance" ||
        input.substatus === "awaiting_payment" ||
        input.hasPaymentLink === true;
    return {
        stored: "pending",
        label: awaiting ? "Awaiting payment" : "Unpaid",
        outstandingPence,
    };
}
function shouldMoveToConfirmedAfterPayment(input) {
    if (!input.paymentVerified)
        return false;
    if (!input.acceptedVersion || input.acceptedVersion !== input.issuedVersion)
        return false;
    return input.status === "awaiting_customer_confirmation" || input.status === "pending";
}
/** Main status wins. Preserve the historical confirmed/admin-allocated representation. */
function effectiveWorkflowStatus(data) {
    const primary = data.status || data.adminStatus || data.customerStatus || "pending";
    if (primary === "paid")
        return "completed";
    if (primary === "confirmed" && ["allocated", "completed"].includes(data.adminStatus || "")) {
        return data.adminStatus;
    }
    return primary;
}
function isWorkflowConfirmed(data) {
    return ["confirmed", "allocated", "completed"].includes(effectiveWorkflowStatus(data));
}
function shouldSendConfirmation(before, after) {
    if (after.confirmationEmailSentAt || !isWorkflowConfirmed(after))
        return false;
    if (!before || !isWorkflowConfirmed(before))
        return true;
    // A confirmed booking that previously had no recipient can now receive its first confirmation.
    const recipient = (row) => String(row.hirerEmail || row.email || "").trim();
    return !recipient(before) && Boolean(recipient(after));
}
function bookingMatchesStatusFilter(booking, filter) {
    return !filter || filter === "all" || effectiveWorkflowStatus(booking) === filter;
}
function workflowStatusLabel(status) {
    switch (status) {
        case "pending":
            return "Pending";
        case "awaiting_customer_confirmation":
            return "Awaiting customer confirmation";
        case "confirmed":
            return "Confirmed";
        case "allocated":
            return "Allocated";
        case "completed":
            return "Completed";
        case "cancelled":
            return "Cancelled";
        case "paid":
            return "Paid";
        default:
            return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending";
    }
}
function emailEnqueueDecision(existing, mode) {
    if (mode === "resend")
        return "create";
    if (!existing)
        return "create";
    if (mode === "retry" && existing.status === "failed")
        return "requeue";
    return "skip";
}
function emailJobDocId(bookingId, event, version, resend = 0) {
    const base = `${bookingId}__${event}__${version}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
    return resend > 0 ? `${base}__resend_${resend}` : base;
}
