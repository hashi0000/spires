import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import Stripe from "stripe";

/** Lazy init: never call `functions.config()` at module load (Firebase deploy analysis times out). */
let stripeSingleton: Stripe | null = null;
function getStripe(): Stripe {
  if (!stripeSingleton) {
    const secretKey = functions.config().stripe?.secret_key;
    if (!secretKey) {
      throw new Error("Stripe secret key not configured");
    }
    stripeSingleton = new Stripe(secretKey, {
      apiVersion: "2023-10-16",
    });
  }
  return stripeSingleton;
}
/**
 * Create a payment intent for a booking
 * This is called from the frontend when user clicks "Pay Now"
 */
export const createPaymentIntent = functions.https.onCall(async (data, context) => {
  // Check if Stripe is initialized
  const secretKey = functions.config().stripe?.secret_key;
  if (!secretKey) {
    console.error("STRIPE_SECRET_KEY not configured");
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Payment system not configured. Please contact support."
    );
  }

  // Verify user is authenticated
  if (!context.auth) {
    throw new functions.https.HttpsError(
      "unauthenticated",
      "User must be authenticated to create payment"
    );
  }

  const { bookingId, amount } = data;

  console.log("createPaymentIntent called with:", { bookingId, amount, userId: context.auth.uid });

  // Validate bookingId exists
  if (!bookingId || typeof bookingId !== "string") {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "bookingId is required and must be a string"
    );
  }

  // Validate amount exists and is numeric
  if (!amount) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "amount is required"
    );
  }

  // Convert amount to number, handling strings with currency symbols
  const amountString = String(amount).replace(/[£$€,\s]/g, "");
  const amountNumber = parseFloat(amountString);

  if (isNaN(amountNumber) || amountNumber <= 0) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Amount must be a valid positive number"
    );
  }

  // Verify the booking exists and belongs to the user
  const bookingRef = admin.firestore().collection("bookings").doc(bookingId);
  const bookingDoc = await bookingRef.get();

  if (!bookingDoc.exists) {
    throw new functions.https.HttpsError("not-found", "Booking not found");
  }

  const booking = bookingDoc.data();

  if (!booking) {
    throw new functions.https.HttpsError("not-found", "Booking data not found");
  }

  // Verify booking belongs to the authenticated user
  if (booking.uid !== context.auth.uid) {
    throw new functions.https.HttpsError(
      "permission-denied",
      "You don't have permission to pay for this booking"
    );
  }

  // Check if already paid
  if (booking.paymentStatus === "paid") {
    throw new functions.https.HttpsError(
      "already-exists",
      "This booking has already been paid"
    );
  }

  // Convert amount to pence (Stripe uses smallest currency unit)
  const amountInPence = Math.round(amountNumber * 100);

  if (amountInPence < 50) {
    throw new functions.https.HttpsError(
      "invalid-argument",
      "Amount must be at least £0.50"
    );
  }

  try {
    const stripe = getStripe();

    console.log("Creating Stripe payment intent with amount:", amountInPence);

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInPence,
      currency: "gbp",
      metadata: {
        bookingId: bookingId,
        userId: context.auth.uid,
        customerName: booking?.name || "Customer",
      },
      description: `Payment for booking ${bookingId}`,
    });

    console.log("Payment intent created:", paymentIntent.id);

    // Update booking with payment intent ID
    await bookingRef.update({
      stripePaymentIntentId: paymentIntent.id,
      paymentStatus: "processing",
    });

    return {
      clientSecret: paymentIntent.client_secret,
      paymentIntentId: paymentIntent.id,
    };
  } catch (error: any) {
    console.error("FULL STRIPE ERROR:", JSON.stringify(error, null, 2));
    console.error("Error creating payment intent:", error);
    console.error("Error type:", error?.type);
    console.error("Error code:", error?.code);
    console.error("Error message:", error?.message);
    
    // Provide more specific error messages
    let errorMessage = "Failed to create payment intent";
    if (error?.type === "StripeAuthenticationError") {
      errorMessage = "Invalid Stripe API key. Please check configuration.";
    } else if (error?.type === "StripeAPIError") {
      errorMessage = `Stripe API error: ${error.message}`;
    } else if (error?.message) {
      errorMessage = error.message;
    }

    throw new functions.https.HttpsError(
      "internal",
      errorMessage,
      {
        type: error?.type,
        code: error?.code,
        message: error?.message,
        fullError: JSON.stringify(error, null, 2),
      }
    );
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
        `Payment not succeeded. Status: ${paymentIntent.status}`
      );
    }

    // Update booking with payment confirmation
    await bookingRef.update({
      paymentStatus: "paid",
      paymentMethod: "card",
      paidAt: admin.firestore.FieldValue.serverTimestamp(),
      stripePaymentIntentId: paymentIntentId,
      stripeChargeId: paymentIntent.latest_charge as string,
    });

    return {
      success: true,
      message: "Payment confirmed successfully",
    };
  } catch (error: any) {
    console.error("FULL STRIPE ERROR:", JSON.stringify(error, null, 2));
    console.error("Error confirming payment:", error);
    throw new functions.https.HttpsError(
      "internal",
      "Failed to confirm payment",
      error?.message || "Unknown error"
    );
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
        await bookingRef.update({
          paymentStatus: "paid",
          paymentMethod: "card",
          paidAt: admin.firestore.FieldValue.serverTimestamp(),
          stripePaymentIntentId: paymentIntent.id,
          stripeChargeId: paymentIntent.latest_charge as string,
        });
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

