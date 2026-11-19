"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.agreedFarePence = agreedFarePence;
exports.depositAmountPence = depositAmountPence;
exports.paidDepositAlreadyRecorded = paidDepositAlreadyRecorded;
exports.effectiveReceivedPence = effectiveReceivedPence;
exports.serverPayablePence = serverPayablePence;
exports.paymentClaimAllows = paymentClaimAllows;
exports.clientAmountMatchesPayable = clientAmountMatchesPayable;
function agreedFarePence(booking) {
    const extras = Array.isArray(booking.additionalCharges)
        ? booking.additionalCharges.reduce((sum, row) => sum + Math.max(0, Math.round(Number(row && row.amountPence) || 0)), 0)
        : 0;
    const quote = booking.issuedQuote && typeof booking.issuedQuote === "object" ? booking.issuedQuote : null;
    const base = quote && Number.isFinite(Number(quote.finalFarePence))
        ? Math.max(0, Math.round(Number(quote.finalFarePence)))
        : (Number.isFinite(Number(booking.actualFare)) ? Math.max(0, Math.round(Number(booking.actualFare) * 100)) : 0);
    return base + extras;
}
function depositAmountPence(booking) {
    if (booking.depositRequired !== true)
        return 0;
    return Math.max(0, Math.round((Number(booking.depositAmount) || 0) * 100));
}
/** True when a paid deposit is already reflected in amountReceivedPence / paymentEntries. */
function paidDepositAlreadyRecorded(booking, depositPence = depositAmountPence(booking)) {
    if (!(depositPence > 0))
        return true;
    const entries = Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [];
    if (entries.some((entry) => entry && (entry.kind === "deposit" || String(entry.clientRequestId || "").startsWith("deposit-")))) {
        return true;
    }
    const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
    return recorded >= depositPence;
}
/**
 * Payments received for display and balance due.
 * Pending deposits leave the total unchanged. A paid deposit missing from the payment history is counted once.
 */
function effectiveReceivedPence(booking) {
    const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
    if (String(booking.depositStatus || "") !== "paid")
        return recorded;
    const depositPence = depositAmountPence(booking);
    if (!(depositPence > 0) || paidDepositAlreadyRecorded(booking, depositPence))
        return recorded;
    return recorded + depositPence;
}
/** The amount a card payment may take. The browser amount is not used. */
function serverPayablePence(booking) {
    const status = String(booking.status || "");
    if (status === "cancelled")
        return { ok: false, reason: "This booking is cancelled." };
    if (booking.brand === "spires_international") {
        return { ok: false, reason: "Spires International payments are not taken through this payment call." };
    }
    const farePence = agreedFarePence(booking);
    if (!(farePence > 0))
        return { ok: false, reason: "This booking has no agreed fare." };
    const receivedPence = effectiveReceivedPence(booking);
    const outstanding = Math.max(0, farePence - receivedPence);
    if (outstanding <= 0)
        return { ok: false, reason: "This booking has no outstanding balance." };
    const depositPence = depositAmountPence(booking);
    const depositStillDue = booking.depositRequired === true && String(booking.depositStatus || "") !== "paid" && depositPence > receivedPence;
    const pence = depositStillDue ? Math.min(outstanding, depositPence - receivedPence) : outstanding;
    if (pence < 50)
        return { ok: false, reason: "The outstanding amount is below the card minimum." };
    return { ok: true, pence, farePence, receivedPence };
}
function paymentClaimAllows(existingBookingId, bookingId) {
    return !existingBookingId || existingBookingId === bookingId;
}
function clientAmountMatchesPayable(payablePence, amount) {
    const parsed = Number(String(amount ?? "").replace(/[£$€,\s]/g, ""));
    return Number.isFinite(parsed) && Math.round(parsed * 100) === payablePence;
}
