import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { notifyAdminNewBookingRequest } from "./sendBookingReceipt";
import { sendWelcomeEmail } from "./sendWelcomeEmail";
import { processBookingReminders } from "./sendBookingReminderEmails";
import { createPaymentIntent, confirmPayment, stripeWebhook } from "./payment";
import {
  enqueueConfirmationIfNeeded,
  stampPromotionOnCreate,
  saveQuoteDraft,
  issueQuote,
  savePaymentLink,
  sendPaymentRequest,
  recordManualPayment,
  recordManualAcceptance,
  acceptQuote,
  retryEmailJob,
  resendQuoteEmail,
  quotePublic,
  submitWebsiteQuote,
  processEmailJob,
} from "./quotes/callables";
import {
  createCustomerBooking,
  recordStaffTermsAcceptance,
  createTermsAcceptanceLink,
  acceptTermsPublic,
} from "./terms/callables";
import { shouldSendConfirmation } from "./quotes/quoteWorkflow";

admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });

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

    if (!before) {
      await stampPromotionOnCreate(change.after);
      const freshSnap = await change.after.ref.get();
      const fresh = freshSnap.data() || after;
      if (isPendingRequest(fresh)) {
        await notifyAdminNewBookingRequest(fresh, bookingId);
      }
      if (shouldSendConfirmation(null, fresh)) {
        const familyWithoutEmail = fresh.source === "family" && !(fresh.hirerEmail || fresh.email);
        if (!familyWithoutEmail) await enqueueConfirmationIfNeeded(null, fresh, bookingId);
      }
      return;
    }

    if (shouldSendConfirmation(before, after)) {
      const familyWithoutEmail = after.source === "family" && !(after.hirerEmail || after.email);
      if (!familyWithoutEmail) await enqueueConfirmationIfNeeded(before, after, bookingId);
    }

    if (
      before &&
      before.paymentStatus !== "paid" &&
      after.paymentStatus === "paid" &&
      !after.paymentReceiptEmailSentAt
    ) {
      const receiptRef = admin.firestore().collection("emailJobs").doc(`payment_receipt__${bookingId}__1`);
      const existingReceipt = await receiptRef.get();
      if (!existingReceipt.exists) {
        await receiptRef.set({
          bookingId,
          event: "payment_receipt",
          version: "1",
          kind: "payment_receipt",
          to: after.hirerEmail || after.email || "",
          subject: "Your Spires Taxis payment receipt",
          html: "",
          status: "queued",
          queuedAt: admin.firestore.FieldValue.serverTimestamp(),
        });
      }
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
export { unlockFamilyJobs } from "./familyJobsAuth";
export { sendBookingPdfToCustomer } from "./sendBookingPdfToCustomer";
export { getSchoolInvoiceVault, saveSchoolInvoiceVault } from "./schoolInvoiceVault";
export { sendGeneralInvoiceEmail } from "./sendGeneralInvoiceEmail";
export {
  saveQuoteDraft,
  issueQuote,
  savePaymentLink,
  sendPaymentRequest,
  recordManualPayment,
  recordManualAcceptance,
  acceptQuote,
  retryEmailJob,
  resendQuoteEmail,
  quotePublic,
  submitWebsiteQuote,
  processEmailJob,
};
export {
  createCustomerBooking,
  recordStaffTermsAcceptance,
  createTermsAcceptanceLink,
  acceptTermsPublic,
};
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
  spiresSharePreviewInterest,
  spiresShareAcceptWaitlist,
  spiresShareAdminAction,
  spiresSharePublicAccess,
  spiresSharePublicList,
  spiresShareRunTick,
  scheduledSpiresShareTick,
} from "./spiresShare/callables";
