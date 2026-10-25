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
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledSpiresShareTick = exports.spiresShareRunTick = exports.spiresSharePublicList = exports.spiresSharePublicAccess = exports.spiresShareAdminAction = exports.spiresShareAcceptWaitlist = exports.spiresSharePreviewInterest = exports.spiresShareExpressInterest = exports.spiresShareCustomerAction = exports.spiresShareGetPaymentLink = exports.spiresShareGetMyBookings = exports.spiresShareGetMyBooking = exports.spiresShareProposeOrJoin = exports.spiresShareListDepartures = exports.spiresShareSearch = exports.spiresShareSaveConfig = exports.spiresShareGetState = exports.spiresShareSession = exports.acceptTermsPublic = exports.createTermsAcceptanceLink = exports.recordStaffTermsAcceptance = exports.createCustomerBooking = exports.processEmailJob = exports.submitWebsiteQuote = exports.quotePublic = exports.resendQuoteEmail = exports.retryEmailJob = exports.acceptQuote = exports.recordManualAcceptance = exports.recordManualPayment = exports.sendPaymentRequest = exports.savePaymentLink = exports.issueQuote = exports.saveQuoteDraft = exports.sendGeneralInvoiceEmail = exports.saveSchoolInvoiceVault = exports.getSchoolInvoiceVault = exports.sendBookingPdfToCustomer = exports.unlockFamilyJobs = exports.sendDriverReminderManual = exports.stripeWebhook = exports.confirmPayment = exports.createPaymentIntent = exports.scheduledBookingReminderEmails = exports.onCustomerCreate = exports.onBookingWrite = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const sendBookingReceipt_1 = require("./sendBookingReceipt");
const sendWelcomeEmail_1 = require("./sendWelcomeEmail");
const sendBookingReminderEmails_1 = require("./sendBookingReminderEmails");
const payment_1 = require("./payment");
Object.defineProperty(exports, "createPaymentIntent", { enumerable: true, get: function () { return payment_1.createPaymentIntent; } });
Object.defineProperty(exports, "confirmPayment", { enumerable: true, get: function () { return payment_1.confirmPayment; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return payment_1.stripeWebhook; } });
const callables_1 = require("./quotes/callables");
Object.defineProperty(exports, "saveQuoteDraft", { enumerable: true, get: function () { return callables_1.saveQuoteDraft; } });
Object.defineProperty(exports, "issueQuote", { enumerable: true, get: function () { return callables_1.issueQuote; } });
Object.defineProperty(exports, "savePaymentLink", { enumerable: true, get: function () { return callables_1.savePaymentLink; } });
Object.defineProperty(exports, "sendPaymentRequest", { enumerable: true, get: function () { return callables_1.sendPaymentRequest; } });
Object.defineProperty(exports, "recordManualPayment", { enumerable: true, get: function () { return callables_1.recordManualPayment; } });
Object.defineProperty(exports, "recordManualAcceptance", { enumerable: true, get: function () { return callables_1.recordManualAcceptance; } });
Object.defineProperty(exports, "acceptQuote", { enumerable: true, get: function () { return callables_1.acceptQuote; } });
Object.defineProperty(exports, "retryEmailJob", { enumerable: true, get: function () { return callables_1.retryEmailJob; } });
Object.defineProperty(exports, "resendQuoteEmail", { enumerable: true, get: function () { return callables_1.resendQuoteEmail; } });
Object.defineProperty(exports, "quotePublic", { enumerable: true, get: function () { return callables_1.quotePublic; } });
Object.defineProperty(exports, "submitWebsiteQuote", { enumerable: true, get: function () { return callables_1.submitWebsiteQuote; } });
Object.defineProperty(exports, "processEmailJob", { enumerable: true, get: function () { return callables_1.processEmailJob; } });
const callables_2 = require("./terms/callables");
Object.defineProperty(exports, "createCustomerBooking", { enumerable: true, get: function () { return callables_2.createCustomerBooking; } });
Object.defineProperty(exports, "recordStaffTermsAcceptance", { enumerable: true, get: function () { return callables_2.recordStaffTermsAcceptance; } });
Object.defineProperty(exports, "createTermsAcceptanceLink", { enumerable: true, get: function () { return callables_2.createTermsAcceptanceLink; } });
Object.defineProperty(exports, "acceptTermsPublic", { enumerable: true, get: function () { return callables_2.acceptTermsPublic; } });
const quoteWorkflow_1 = require("./quotes/quoteWorkflow");
admin.initializeApp();
admin.firestore().settings({ ignoreUndefinedProperties: true });
function isPendingRequest(data) {
    const status = data.status || "pending";
    return status === "pending" || data.customerStatus === "pending";
}
exports.onBookingWrite = functions.firestore
    .document("bookings/{bookingId}")
    .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    const bookingId = context.params.bookingId;
    if (!after)
        return;
    if (!before) {
        await (0, callables_1.stampPromotionOnCreate)(change.after);
        const freshSnap = await change.after.ref.get();
        const fresh = freshSnap.data() || after;
        if (isPendingRequest(fresh)) {
            await (0, sendBookingReceipt_1.notifyAdminNewBookingRequest)(fresh, bookingId);
        }
        if ((0, quoteWorkflow_1.shouldSendConfirmation)(null, fresh)) {
            const familyWithoutEmail = fresh.source === "family" && !(fresh.hirerEmail || fresh.email);
            if (!familyWithoutEmail)
                await (0, callables_1.enqueueConfirmationIfNeeded)(null, fresh, bookingId);
        }
        return;
    }
    if ((0, quoteWorkflow_1.shouldSendConfirmation)(before, after)) {
        const familyWithoutEmail = after.source === "family" && !(after.hirerEmail || after.email);
        if (!familyWithoutEmail)
            await (0, callables_1.enqueueConfirmationIfNeeded)(before, after, bookingId);
    }
    if (before &&
        before.paymentStatus !== "paid" &&
        after.paymentStatus === "paid" &&
        !after.paymentReceiptEmailSentAt) {
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
exports.onCustomerCreate = functions.firestore
    .document("customers/{customerId}")
    .onCreate(async (snapshot) => {
    const customerData = snapshot.data();
    await (0, sendWelcomeEmail_1.sendWelcomeEmail)(customerData);
});
/** ~24h and ~1h before pickup; uses same SMTP config as welcome email (functions.config().email / .smtp) */
exports.scheduledBookingReminderEmails = functions
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .pubsub.schedule("every 15 minutes")
    .timeZone("Europe/London")
    .onRun(async () => {
    await (0, sendBookingReminderEmails_1.processBookingReminders)(functions.logger);
});
var sendDriverReminderManual_1 = require("./sendDriverReminderManual");
Object.defineProperty(exports, "sendDriverReminderManual", { enumerable: true, get: function () { return sendDriverReminderManual_1.sendDriverReminderManual; } });
var familyJobsAuth_1 = require("./familyJobsAuth");
Object.defineProperty(exports, "unlockFamilyJobs", { enumerable: true, get: function () { return familyJobsAuth_1.unlockFamilyJobs; } });
var sendBookingPdfToCustomer_1 = require("./sendBookingPdfToCustomer");
Object.defineProperty(exports, "sendBookingPdfToCustomer", { enumerable: true, get: function () { return sendBookingPdfToCustomer_1.sendBookingPdfToCustomer; } });
var schoolInvoiceVault_1 = require("./schoolInvoiceVault");
Object.defineProperty(exports, "getSchoolInvoiceVault", { enumerable: true, get: function () { return schoolInvoiceVault_1.getSchoolInvoiceVault; } });
Object.defineProperty(exports, "saveSchoolInvoiceVault", { enumerable: true, get: function () { return schoolInvoiceVault_1.saveSchoolInvoiceVault; } });
var sendGeneralInvoiceEmail_1 = require("./sendGeneralInvoiceEmail");
Object.defineProperty(exports, "sendGeneralInvoiceEmail", { enumerable: true, get: function () { return sendGeneralInvoiceEmail_1.sendGeneralInvoiceEmail; } });
var callables_3 = require("./spiresShare/callables");
Object.defineProperty(exports, "spiresShareSession", { enumerable: true, get: function () { return callables_3.spiresShareSession; } });
Object.defineProperty(exports, "spiresShareGetState", { enumerable: true, get: function () { return callables_3.spiresShareGetState; } });
Object.defineProperty(exports, "spiresShareSaveConfig", { enumerable: true, get: function () { return callables_3.spiresShareSaveConfig; } });
Object.defineProperty(exports, "spiresShareSearch", { enumerable: true, get: function () { return callables_3.spiresShareSearch; } });
Object.defineProperty(exports, "spiresShareListDepartures", { enumerable: true, get: function () { return callables_3.spiresShareListDepartures; } });
Object.defineProperty(exports, "spiresShareProposeOrJoin", { enumerable: true, get: function () { return callables_3.spiresShareProposeOrJoin; } });
Object.defineProperty(exports, "spiresShareGetMyBooking", { enumerable: true, get: function () { return callables_3.spiresShareGetMyBooking; } });
Object.defineProperty(exports, "spiresShareGetMyBookings", { enumerable: true, get: function () { return callables_3.spiresShareGetMyBookings; } });
Object.defineProperty(exports, "spiresShareGetPaymentLink", { enumerable: true, get: function () { return callables_3.spiresShareGetPaymentLink; } });
Object.defineProperty(exports, "spiresShareCustomerAction", { enumerable: true, get: function () { return callables_3.spiresShareCustomerAction; } });
Object.defineProperty(exports, "spiresShareExpressInterest", { enumerable: true, get: function () { return callables_3.spiresShareExpressInterest; } });
Object.defineProperty(exports, "spiresSharePreviewInterest", { enumerable: true, get: function () { return callables_3.spiresSharePreviewInterest; } });
Object.defineProperty(exports, "spiresShareAcceptWaitlist", { enumerable: true, get: function () { return callables_3.spiresShareAcceptWaitlist; } });
Object.defineProperty(exports, "spiresShareAdminAction", { enumerable: true, get: function () { return callables_3.spiresShareAdminAction; } });
Object.defineProperty(exports, "spiresSharePublicAccess", { enumerable: true, get: function () { return callables_3.spiresSharePublicAccess; } });
Object.defineProperty(exports, "spiresSharePublicList", { enumerable: true, get: function () { return callables_3.spiresSharePublicList; } });
Object.defineProperty(exports, "spiresShareRunTick", { enumerable: true, get: function () { return callables_3.spiresShareRunTick; } });
Object.defineProperty(exports, "scheduledSpiresShareTick", { enumerable: true, get: function () { return callables_3.scheduledSpiresShareTick; } });
