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
exports.sendGeneralInvoiceEmail = exports.saveSchoolInvoiceVault = exports.getSchoolInvoiceVault = exports.sendBookingPdfToCustomer = exports.sendDriverReminderManual = exports.stripeWebhook = exports.confirmPayment = exports.createPaymentIntent = exports.scheduledBookingReminderEmails = exports.onCustomerCreate = exports.onBookingWrite = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const sendBookingReceipt_1 = require("./sendBookingReceipt");
const sendWelcomeEmail_1 = require("./sendWelcomeEmail");
const sendBookingReminderEmails_1 = require("./sendBookingReminderEmails");
const payment_1 = require("./payment");
Object.defineProperty(exports, "createPaymentIntent", { enumerable: true, get: function () { return payment_1.createPaymentIntent; } });
Object.defineProperty(exports, "confirmPayment", { enumerable: true, get: function () { return payment_1.confirmPayment; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return payment_1.stripeWebhook; } });
admin.initializeApp();
function isConfirmedStatus(data) {
    if (!data)
        return false;
    return (data.status === "confirmed" ||
        data.customerStatus === "confirmed" ||
        data.adminStatus === "confirmed");
}
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
    // New pending customer booking request → email the office
    if (!before && isPendingRequest(after)) {
        await (0, sendBookingReceipt_1.notifyAdminNewBookingRequest)(after, bookingId);
        return;
    }
    // Created already confirmed (admin-created) → send confirmation PDF
    if (!before && isConfirmedStatus(after)) {
        await (0, sendBookingReceipt_1.sendBookingReceipt)(after, "confirmation", bookingId);
        await change.after.ref.update({
            confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
    }
    // Pending → confirmed (or customerStatus flipped) → auto-send confirmation PDF once
    if (before &&
        !isConfirmedStatus(before) &&
        isConfirmedStatus(after) &&
        !after.confirmationEmailSentAt) {
        await (0, sendBookingReceipt_1.sendBookingReceipt)(after, "confirmation", bookingId);
        await change.after.ref.update({
            confirmationEmailSentAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        return;
    }
    // Payment status changed to paid
    if (before && before.paymentStatus !== "paid" && after.paymentStatus === "paid") {
        await (0, sendBookingReceipt_1.sendBookingReceipt)(after, "payment", bookingId);
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
var sendBookingPdfToCustomer_1 = require("./sendBookingPdfToCustomer");
Object.defineProperty(exports, "sendBookingPdfToCustomer", { enumerable: true, get: function () { return sendBookingPdfToCustomer_1.sendBookingPdfToCustomer; } });
var schoolInvoiceVault_1 = require("./schoolInvoiceVault");
Object.defineProperty(exports, "getSchoolInvoiceVault", { enumerable: true, get: function () { return schoolInvoiceVault_1.getSchoolInvoiceVault; } });
Object.defineProperty(exports, "saveSchoolInvoiceVault", { enumerable: true, get: function () { return schoolInvoiceVault_1.saveSchoolInvoiceVault; } });
var sendGeneralInvoiceEmail_1 = require("./sendGeneralInvoiceEmail");
Object.defineProperty(exports, "sendGeneralInvoiceEmail", { enumerable: true, get: function () { return sendGeneralInvoiceEmail_1.sendGeneralInvoiceEmail; } });
