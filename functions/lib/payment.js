"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.stripeWebhook = exports.confirmPayment = exports.createPaymentIntent = void 0;
exports.commitCardReceipt = commitCardReceipt;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const crypto_1 = require("crypto");
const stripe_1 = __importDefault(require("stripe"));
const payments_1 = require("./marketing/payments");
const paymentAmount_1 = require("./paymentAmount");
const paymentAttempt_1 = require("./paymentAttempt");
const bookingRevision_1 = require("./bookings/bookingRevision");
/** Lazy init: never call `functions.config()` at module load (Firebase deploy analysis times out). */
let stripeSingleton = null;
function getStripe() {
    if (!stripeSingleton) {
        const secretKey = functions.config().stripe?.secret_key;
        if (!secretKey) {
            throw new Error("Stripe secret key not configured");
        }
        if (process.env.FUNCTIONS_EMULATOR === "true" && String(secretKey).startsWith("sk_live")) {
            throw new Error("The emulator refused a live Stripe key.");
        }
        stripeSingleton = new stripe_1.default(secretKey, {
            apiVersion: "2023-10-16",
        });
    }
    return stripeSingleton;
}
/** Records the verified Stripe amount once. A deposit stays part paid and is not stored as the full fare. */
async function commitCardReceipt(db, bookingId, paymentIntent, atIso = new Date().toISOString()) {
    const amountPence = paymentIntent.amount_received || paymentIntent.amount;
    if (!Number.isInteger(amountPence) || amountPence <= 0 || paymentIntent.currency !== "gbp")
        return "rejected";
    const metadataBookingId = String(paymentIntent.metadata?.bookingId || "");
    if (!metadataBookingId || metadataBookingId !== bookingId)
        return "rejected";
    const ref = db.collection("bookings").doc(bookingId);
    const claimRef = db.collection("stripePaymentClaims").doc(paymentIntent.id);
    return db.runTransaction(async (tx) => {
        const claimSnap = await tx.get(claimRef);
        const claimedBookingId = claimSnap.exists ? String(claimSnap.data()?.bookingId || "") : "";
        if (!(0, paymentAmount_1.paymentClaimAllows)(claimedBookingId, bookingId))
            return "rejected";
        const snap = await tx.get(ref);
        if (!snap.exists)
            return "rejected";
        const booking = snap.data() || {};
        const accountId = String(paymentIntent.metadata?.userId || "");
        if (booking.uid && accountId && booking.uid !== accountId)
            return "rejected";
        const patch = (0, payments_1.cardReceiptPatch)(booking, {
            paymentIntentId: paymentIntent.id,
            amountPence,
            chargeId: typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : "",
        }, atIso);
        if (!patch)
            return "duplicate";
        const now = admin.firestore.FieldValue.serverTimestamp();
        tx.set(ref, {
            ...patch,
            revision: (0, bookingRevision_1.nextBookingRevision)(booking),
            paidAt: patch.paymentStatus === "paid" ? now : admin.firestore.FieldValue.delete(),
            updatedAt: now,
        }, { merge: true });
        tx.set(claimRef, {
            bookingId,
            paymentIntentId: paymentIntent.id,
            amountPence,
            updatedAt: now,
        }, { merge: true });
        return "credited";
    });
}
async function recordCardReceipt(bookingId, paymentIntent) {
    const charge = paymentIntent.latest_charge;
    await commitCardReceipt(admin.firestore(), bookingId, {
        id: paymentIntent.id,
        amount: paymentIntent.amount,
        amount_received: paymentIntent.amount_received,
        currency: paymentIntent.currency,
        latest_charge: typeof charge === "string" ? charge : null,
        metadata: {
            bookingId: paymentIntent.metadata?.bookingId,
            userId: paymentIntent.metadata?.userId,
        },
    });
}
/**
 * Create a payment intent for a booking
 * This is called from the frontend when user clicks "Pay Now"
 */
exports.createPaymentIntent = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated to create payment");
    }
    const secretKey = functions.config().stripe?.secret_key;
    if (process.env.FUNCTIONS_EMULATOR === "true" && String(secretKey || "").startsWith("sk_live")) {
        throw new functions.https.HttpsError("failed-precondition", "The emulator refused a live Stripe key.");
    }
    if (!secretKey) {
        console.error("STRIPE_SECRET_KEY not configured");
        throw new functions.https.HttpsError("failed-precondition", "Payment system not configured. Please contact support.");
    }
    const { bookingId, amount } = data;
    if (!bookingId || typeof bookingId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "bookingId is required and must be a string");
    }
    const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Booking not found");
    }
    const booking = bookingDoc.data();
    if (!booking) {
        throw new functions.https.HttpsError("not-found", "Booking data not found");
    }
    if (booking.uid !== context.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "You don't have permission to pay for this booking");
    }
    const payable = (0, paymentAmount_1.serverPayablePence)(booking);
    if (!payable.ok) {
        throw new functions.https.HttpsError("failed-precondition", payable.reason);
    }
    if (!(0, paymentAmount_1.clientAmountMatchesPayable)(payable.pence, amount)) {
        throw new functions.https.HttpsError("failed-precondition", "The amount on this screen is out of date. Reload the booking and try again.");
    }
    try {
        const stripe = getStripe();
        const attempt = (0, paymentAttempt_1.paymentAttemptPlan)({ ...booking, id: bookingId }, payable.pence, (0, crypto_1.randomUUID)());
        const paymentIntent = attempt.action === "reuse"
            ? await stripe.paymentIntents.retrieve(attempt.paymentIntentId)
            : await stripe.paymentIntents.create({
                amount: payable.pence,
                currency: "gbp",
                metadata: {
                    bookingId,
                    userId: context.auth.uid,
                },
                description: `Spires Taxis booking ${booking.bookingNumber || bookingId}`,
            }, { idempotencyKey: attempt.idempotencyKey });
        await bookingRef.update({
            openStripePaymentIntentId: paymentIntent.id,
            openStripePaymentAmountPence: payable.pence,
            openStripePaymentNonce: attempt.action === "create" ? attempt.nonce : booking.openStripePaymentNonce || "",
            revision: (0, bookingRevision_1.nextBookingRevision)(booking),
            ...(booking.paymentStatus === "partial" ? {} : { paymentStatus: "processing" }),
        });
        return {
            clientSecret: paymentIntent.client_secret,
            paymentIntentId: paymentIntent.id,
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error("createPaymentIntent failed");
        throw new functions.https.HttpsError("internal", "Failed to create payment intent");
    }
});
/**
 * Confirm payment after successful Stripe payment
 * This is called from the frontend after payment is confirmed
 */
exports.confirmPayment = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "User must be authenticated");
    }
    const { bookingId, paymentIntentId } = data;
    if (!bookingId || !paymentIntentId) {
        throw new functions.https.HttpsError("invalid-argument", "bookingId and paymentIntentId are required");
    }
    // Verify the booking exists and belongs to the user
    const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
    const bookingDoc = await bookingRef.get();
    if (!bookingDoc.exists) {
        throw new functions.https.HttpsError("not-found", "Booking not found");
    }
    const booking = bookingDoc.data();
    if (booking?.uid !== context.auth.uid) {
        throw new functions.https.HttpsError("permission-denied", "You don't have permission to update this booking");
    }
    try {
        const stripe = getStripe();
        // Retrieve payment intent from Stripe to verify payment
        const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);
        if (paymentIntent.status !== "succeeded") {
            throw new functions.https.HttpsError("failed-precondition", "Payment not succeeded");
        }
        if (paymentIntent.metadata?.bookingId !== bookingId || paymentIntent.metadata?.userId !== context.auth.uid) {
            throw new functions.https.HttpsError("permission-denied", "This payment does not belong to this booking.");
        }
        await recordCardReceipt(bookingId, paymentIntent);
        return {
            success: true,
            message: "Payment confirmed successfully",
        };
    }
    catch (error) {
        if (error instanceof functions.https.HttpsError)
            throw error;
        console.error("confirmPayment failed");
        throw new functions.https.HttpsError("internal", "Failed to confirm payment");
    }
});
/**
 * Webhook handler for Stripe events
 * This handles payment confirmations from Stripe
 * Must use raw body for signature verification
 * Note: For Firebase Functions v1, we need to use Express middleware to get raw body
 */
exports.stripeWebhook = functions.https.onRequest(async (req, res) => {
    const sig = req.headers["stripe-signature"];
    if (!sig) {
        console.error("Missing stripe-signature header");
        res.status(400).send("No signature");
        return;
    }
    const secret = functions.config().stripe.webhook_secret;
    if (!secret) {
        console.error("STRIPE_WEBHOOK_SECRET not set in functions.config()");
        res.status(500).send("Webhook secret not configured");
        return;
    }
    let event;
    try {
        // In Firebase Functions v1, rawBody is available on the request object
        // Access it directly from the Express request
        const rawBody = req.rawBody;
        if (!rawBody) {
            console.error("rawBody not available on request");
            res.status(500).send("Internal server error: rawBody not available");
            return;
        }
        event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
    }
    catch (err) {
        console.error("Webhook signature verification failed:", err);
        res.status(400).send(`Webhook Error: ${err.message}`);
        return;
    }
    // Handle the event
    if (event.type === "payment_intent.succeeded") {
        const paymentIntent = event.data.object;
        const bookingId = paymentIntent.metadata?.bookingId;
        if (bookingId) {
            const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
            const bookingDoc = await bookingRef.get();
            if (bookingDoc.exists) {
                await recordCardReceipt(bookingId, paymentIntent);
                console.log(`Payment confirmed for booking ${bookingId}`);
            }
            else {
                console.warn(`Booking ${bookingId} not found in Firestore`);
            }
        }
        else {
            console.warn("Payment intent missing bookingId in metadata");
        }
    }
    res.json({ received: true });
});
