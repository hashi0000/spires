import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { sendBookingReceipt } from "./sendBookingReceipt";
import { sendWelcomeEmail } from "./sendWelcomeEmail";
import { createPaymentIntent, confirmPayment, stripeWebhook } from "./payment";

admin.initializeApp();

export const onBookingWrite = functions.firestore
  .document("bookings/{bookingId}")
  .onWrite(async (change: functions.Change<functions.firestore.DocumentSnapshot>, context: functions.EventContext) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;

    if (!after) return;

    // New confirmed booking
    if (!before && after.status === "confirmed") {
      await sendBookingReceipt(after, "confirmation");
      return;
    }

    // Payment status changed to paid
    if (before && before.paymentStatus !== "paid" && after.paymentStatus === "paid") {
      await sendBookingReceipt(after, "payment");
      return;
    }
  });

// Send welcome email when a new customer signs up
export const onCustomerCreate = functions.firestore
  .document("customers/{customerId}")
  .onCreate(async (snapshot, context) => {
    const customerData = snapshot.data();
    await sendWelcomeEmail(customerData);
  });

// Export payment functions
export { createPaymentIntent, confirmPayment, stripeWebhook };
