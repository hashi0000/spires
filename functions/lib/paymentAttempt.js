"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.paymentAttemptPlan = paymentAttemptPlan;
const payments_1 = require("./marketing/payments");
/**
 * Booking id plus amount is not a safe Stripe idempotency key.
 * Two real payments can be the same amount, and a retry after a lost
 * response must return the open payment rather than a second one.
 * The key is one attempt. A new balance gets a new attempt.
 */
function paymentAttemptPlan(booking, payablePence, nonce) {
    const openId = String(booking.openStripePaymentIntentId || "");
    const openAmount = Math.round(Number(booking.openStripePaymentAmountPence) || 0);
    const credited = (0, payments_1.appliedCardIntentIds)(booking).includes(openId);
    if (openId && openAmount === payablePence && !credited) {
        return { action: "reuse", paymentIntentId: openId, idempotencyKey: null };
    }
    const cleanNonce = nonce.replace(/[^A-Za-z0-9_-]/g, "").slice(0, 40);
    const bookingId = String(booking.id || "booking").replace(/[^A-Za-z0-9_-]/g, "").slice(0, 80);
    return { action: "create", nonce: cleanNonce, idempotencyKey: `spires_${bookingId}_${cleanNonce}` };
}
