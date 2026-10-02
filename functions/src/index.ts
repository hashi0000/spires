import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  sendBookingReceipt,
  notifyAdminNewBookingRequest,
} from "./sendBookingReceipt";
import { sendWelcomeEmail } from "./sendWelcomeEmail";
import { processBookingReminders } from "./sendBookingReminderEmails";
import { createPaymentIntent, confirmPayment, stripeWebhook } from "./payment";

admin.initializeApp();

function isConfirmedStatus(data: admin.firestore.DocumentData | undefined | null): boolean {
  if (!data) return false;
  return (
    data.status === "confirmed" ||
    data.customerStatus === "confirmed" ||
    data.adminStatus === "confirmed"
  );
}

function isPendingRequest(data: admin.firestore.DocumentData): boolean {
  const status = data.status || "pending";
  return status === "pending" || data.customerStatus === "pending";
}

export const onBookingWrite = functions.firestore
  .document("bookings/{bookingId}")
  .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    const bookingId = context.params.bookingId as string;

    if (!after) return;

    // New pending customer booking request → email the office
    if (!before && isPendingRequest(after)) {
      await notifyAdminNewBookingRequest(after, bookingId);
      return;
    }

    // Created already confirmed (admin-created) → send confirmation PDF
    if (!before && isConfirmedStatus(after)) {
      await sendBookingReceipt(after, "confirmation", bookingId);
      await change.after.ref.update({
        confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Pending → confirmed (or customerStatus flipped) → auto-send confirmation PDF once
    if (
      before &&
      !isConfirmedStatus(before) &&
      isConfirmedStatus(after) &&
      !after.confirmationEmailSentAt
    ) {
      await sendBookingReceipt(after, "confirmation", bookingId);
      await change.after.ref.update({
        confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      return;
    }

    // Payment status changed to paid
    if (before && before.paymentStatus !== "paid" && after.paymentStatus === "paid") {
      await sendBookingReceipt(after, "payment", bookingId);
    }
  });

// Send welcome email when a new customer signs up
export const onCustomerCreate = functions.firestore
  .document("customers/{customerId}")
  .onCreate(async (snapshot) => {
    const customerData = snapshot.data();
    await sendWelcomeEmail(customerData);
  });

/** ~24h and ~1h before pickup; uses same SMTP config as welcome email (functions.config().email / .smtp) */
export const scheduledBookingReminderEmails = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 15 minutes")
  .timeZone("Europe/London")
  .onRun(async () => {
    await processBookingReminders(functions.logger);
  });

// Stripe kept in codebase but unused in customer UI for now
export { createPaymentIntent, confirmPayment, stripeWebhook };
export { sendDriverReminderManual } from "./sendDriverReminderManual";
export { sendBookingPdfToCustomer } from "./sendBookingPdfToCustomer";
export { getSchoolInvoiceVault, saveSchoolInvoiceVault } from "./schoolInvoiceVault";
export { sendGeneralInvoiceEmail } from "./sendGeneralInvoiceEmail";
export {
  spiresShareSession,
  spiresShareGetState,
  spiresShareSaveConfig,
  spiresShareSearch,
  spiresShareListDepartures,
  spiresShareProposeOrJoin,
  spiresShareGetMyBooking,
  spiresShareGetMyBookings,
  spiresShareGetPaymentLink,
  spiresShareCustomerAction,
  spiresShareExpressInterest,
  spiresShareAcceptWaitlist,
  spiresShareAdminAction,
  spiresSharePublicAccess,
  spiresSharePublicList,
  spiresShareRunTick,
  scheduledSpiresShareTick,
} from "./spiresShare/callables";
