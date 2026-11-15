import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { randomUUID } from "crypto";
import Stripe from "stripe";
import { cardReceiptPatch } from "./marketing/payments";
import { clientAmountMatchesPayable, paymentClaimAllows, serverPayablePence } from "./paymentAmount";
import { paymentAttemptPlan } from "./paymentAttempt";
import { nextBookingRevision } from "./bookings/bookingRevision";

/** Lazy init: never call `functions.config()` at module load (Firebase deploy analysis times out). */
let stripeSingleton: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeSingleton) {
    const secretKey = functions.config().stripe?.secret_key;
    if (!secretKey) {
      throw new Error("Stripe secret key not configured");
    }
    if (process.env.FUNCTIONS_EMULATOR === "true" && String(secretKey).startsWith("sk_live")) {
      throw new Error("The emulator refused a live Stripe key.");
    }
    stripeSingleton = new Stripe(secretKey, {
      apiVersion: "2023-10-16",
    });
  }
  return stripeSingleton;
}

export type CardReceiptIntent = {
  id: string;
  amount: number;
  amount_received?: number | null;
  currency: string;
  latest_charge?: string | null;
  metadata?: { bookingId?: string; userId?: string };
};

/** Records the verified Stripe amount once. A deposit stays part paid and is not stored as the full fare. */
export async function commitCardReceipt(
  db: admin.firestore.Firestore,
  bookingId: string,
  paymentIntent: CardReceiptIntent,
  atIso = new Date().toISOString()
): Promise<"credited" | "duplicate" | "rejected"> {
  const amountPence = paymentIntent.amount_received || paymentIntent.amount;
  if (!Number.isInteger(amountPence) || amountPence <= 0 || paymentIntent.currency !== "gbp") return "rejected";
  const metadataBookingId = String(paymentIntent.metadata?.bookingId || "");
  if (!metadataBookingId || metadataBookingId !== bookingId) return "rejected";
  const ref = db.collection("bookings").doc(bookingId);
  const claimRef = db.collection("stripePaymentClaims").doc(paymentIntent.id);
  return db.runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    const claimedBookingId = claimSnap.exists ? String(claimSnap.data()?.bookingId || "") : "";
    if (!paymentClaimAllows(claimedBookingId, bookingId)) return "rejected" as const;
    const snap = await tx.get(ref);
    if (!snap.exists) return "rejected" as const;
    const booking = snap.data() || {};
    const accountId = String(paymentIntent.metadata?.userId || "");
    if (booking.uid && accountId && booking.uid !== accountId) return "rejected" as const;
    const patch = cardReceiptPatch(booking, {
      paymentIntentId: paymentIntent.id,
      amountPence,
      chargeId: typeof paymentIntent.latest_charge === "string" ? paymentIntent.latest_charge : "",
    }, atIso);
    if (!patch) return "duplicate" as const;
    const now = admin.firestore.FieldValue.serverTimestamp();
    tx.set(ref, {
      ...patch,
      revision: nextBookingRevision(booking),
      paidAt: patch.paymentStatus === "paid" ? now : admin.firestore.FieldValue.delete(),
      updatedAt: now,
    }, { merge: true });
    tx.set(claimRef, {
      bookingId,
      paymentIntentId: paymentIntent.id,
      amountPence,
      updatedAt: now,
    }, { merge: true });
    return "credited" as const;
  });
}

async function recordCardReceipt(bookingId: string, paymentIntent: Stripe.PaymentIntent) {
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
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to create payment"
    );
  }

  const secretKey = functions.config().stripe?.secret_key;
  if (process.env.FUNCTIONS_EMULATOR === "true" && String(secretKey || "").startsWith("sk_live")) {
    throw new functions.https.HttpsError("failed-precondition", "The emulator refused a live Stripe key.");
  }
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY not configured");
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Payment system not configured. Please contact support."
    );
  }

  const { bookingId, amount } = data;

  if (!bookingId || typeof bookingId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "bookingId is required and must be a string"
    );
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
    throw new functions.https.HttpsError(
      "permission-denied",
      "You don't have permission to pay for this booking"
    );
  }

  const payable = serverPayablePence(booking);
  if (!payable.ok) {
    throw new functions.https.HttpsError("failed-precondition", payable.reason);
  }
  if (!clientAmountMatchesPayable(payable.pence, amount)) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The amount on this screen is out of date. Reload the booking and try again."
    );
  }

  try {
    const stripe = getStripe();
    const attempt = paymentAttemptPlan({ ...booking, id: bookingId }, payable.pence, randomUUID());
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
      revision: nextBookingRevision(booking),
      ...(booking.paymentStatus === "partial" ? {} : { paymentStatus: "processing" }),
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
    console.error("createPaymentIntent failed");
    throw new functions.https.HttpsError("internal", "Failed to create payment intent");
  }
});

/**
 * Confirm payment after successful Stripe payment
 * This is called from the frontend after payment is confirmed
 */
export const confirmPayment = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated"
    );
  }

  const { bookingId, paymentIntentId } = data;

  if (!bookingId || !paymentIntentId) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "bookingId and paymentIntentId are required"
    );
  }

  // Verify the booking exists and belongs to the user
  const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
  const bookingDoc = await bookingRef.get();

  if (!bookingDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Booking not found");
  }

  const booking = bookingDoc.data();

  if (booking?.uid !== context.auth.uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You don't have permission to update this booking"
    );
  }

  try {
    const stripe = getStripe();
    // Retrieve payment intent from Stripe to verify payment
    const paymentIntent = await stripe.paymentIntents.retrieve(paymentIntentId);

    if (paymentIntent.status !== "succeeded") {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "Payment not succeeded"
      );
    }
    if (paymentIntent.metadata?.bookingId !== bookingId || paymentIntent.metadata?.userId !== context.auth.uid) {
      throw new functions.https.HttpsError(
        "permission-denied",
        "This payment does not belong to this booking."
      );
    }

    await recordCardReceipt(bookingId, paymentIntent);

    return {
      success: true,
      message: "Payment confirmed successfully",
    };
  } catch (error: any) {
    if (error instanceof functions.https.HttpsError) throw error;
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
export const stripeWebhook = functions.https.onRequest(async (req, res) => {
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

  let event: Stripe.Event;

  try {
    // In Firebase Functions v1, rawBody is available on the request object
    // Access it directly from the Express request
    const rawBody = (req as any).rawBody;
    
    if (!rawBody) {
      console.error("rawBody not available on request");
      res.status(500).send("Internal server error: rawBody not available");
      return;
    }

    event = getStripe().webhooks.constructEvent(rawBody, sig, secret);
  } catch (err: any) {
    console.error("Webhook signature verification failed:", err);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  // Handle the event
  if (event.type === "payment_intent.succeeded") {
    const paymentIntent = event.data.object as Stripe.PaymentIntent;
    const bookingId = paymentIntent.metadata?.bookingId;

    if (bookingId) {
      const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
      const bookingDoc = await bookingRef.get();

      if (bookingDoc.exists) {
        await recordCardReceipt(bookingId, paymentIntent);
        console.log(`Payment confirmed for booking ${bookingId}`);
      } else {
        console.warn(`Booking ${bookingId} not found in Firestore`);
      }
    } else {
      console.warn("Payment intent missing bookingId in metadata");
    }
  }

  res.json({ received: true });
});

