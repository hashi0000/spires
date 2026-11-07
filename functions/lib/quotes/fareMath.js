"use strict";
/** Fare and payment totals. Amounts are integer pence. */
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentPosition = paymentPosition;
exports.depositStillDuePence = depositStillDuePence;
exports.requestAmountPence = requestAmountPence;
exports.nextReceivedPence = nextReceivedPence;
function paymentPosition(farePence, receivedPence, storedStatus) {
    const fare = Math.max(0, Math.round(Number(farePence) || 0));
    const received = Math.max(0, Math.round(Number(receivedPence) || 0));
    const outstandingPence = Math.max(0, fare - received);
    const overpaymentPence = Math.max(0, received - fare);
    if (storedStatus === "refunded") {
        return {
            farePence: fare,
            receivedPence: received,
            outstandingPence,
            overpaymentPence,
            stored: "refunded",
            label: "Refunded",
            inconsistent: received > 0 && overpaymentPence === 0 && outstandingPence > 0,
        };
    }
    if (fare > 0 && received >= fare) {
        return {
            farePence: fare,
            receivedPence: received,
            outstandingPence: 0,
            overpaymentPence,
            stored: "paid",
            label: "Paid",
            inconsistent: false,
        };
    }
    if (received > 0) {
        return {
            farePence: fare,
            receivedPence: received,
            outstandingPence,
            overpaymentPence: 0,
            stored: "partial",
            label: "Part paid",
            inconsistent: false,
        };
    }
    return {
        farePence: fare,
        receivedPence: received,
        outstandingPence,
        overpaymentPence: 0,
        stored: "pending",
        label: "Unpaid",
        inconsistent: storedStatus === "paid" || storedStatus === "partial",
    };
}
function depositStillDuePence(depositPence, receivedPence) {
    return Math.max(0, Math.round(Number(depositPence) || 0) - Math.max(0, Math.round(Number(receivedPence) || 0)));
}
function requestAmountPence(input) {
    const position = paymentPosition(input.farePence, input.receivedPence);
    const outstanding = position.outstandingPence;
    const fallback = input.kind === "deposit"
        ? Math.min(outstanding, depositStillDuePence(input.depositPence, input.receivedPence))
        : outstanding;
    const amount = input.customPence == null ? fallback : Math.round(input.customPence);
    if (!Number.isInteger(amount) || amount <= 0) {
        return { ok: false, error: "Enter an amount greater than zero." };
    }
    if (amount > outstanding) {
        return { ok: false, error: "The request cannot be more than the outstanding balance." };
    }
    return { ok: true, amountPence: amount };
}
function nextReceivedPence(input) {
    const current = Math.max(0, Math.round(Number(input.currentReceivedPence) || 0));
    const amount = Math.round(Number(input.amountPence));
    if (input.mode === "add") {
        if (!Number.isInteger(amount) || amount <= 0) {
            return { ok: false, error: "Enter the amount received, greater than zero." };
        }
        return { ok: true, next: current + amount };
    }
    if (!Number.isInteger(amount) || amount < 0) {
        return { ok: false, error: "Enter the corrected total received, or zero." };
    }
    return { ok: true, next: amount };
}
