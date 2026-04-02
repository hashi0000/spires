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
exports.stripeWebhook = exports.confirmPayment = exports.createPaymentIntent = exports.onCustomerCreate = exports.onBookingWrite = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const sendBookingReceipt_1 = require("./sendBookingReceipt");
const sendWelcomeEmail_1 = require("./sendWelcomeEmail");
const payment_1 = require("./payment");
Object.defineProperty(exports, "createPaymentIntent", { enumerable: true, get: function () { return payment_1.createPaymentIntent; } });
Object.defineProperty(exports, "confirmPayment", { enumerable: true, get: function () { return payment_1.confirmPayment; } });
Object.defineProperty(exports, "stripeWebhook", { enumerable: true, get: function () { return payment_1.stripeWebhook; } });
admin.initializeApp();
exports.onBookingWrite = functions.firestore
    .document("bookings/{bookingId}")
    .onWrite(async (change, context) => {
    const after = change.after.exists ? change.after.data() : null;
    const before = change.before.exists ? change.before.data() : null;
    if (!after)
        return;
    // New confirmed booking
    if (!before && after.status === "confirmed") {
        await (0, sendBookingReceipt_1.sendBookingReceipt)(after, "confirmation");
        return;
    }
    // Payment status changed to paid
    if (before && before.paymentStatus !== "paid" && after.paymentStatus === "paid") {
        await (0, sendBookingReceipt_1.sendBookingReceipt)(after, "payment");
        return;
    }
});
// Send welcome email when a new customer signs up
exports.onCustomerCreate = functions.firestore
    .document("customers/{customerId}")
    .onCreate(async (snapshot, context) => {
    const customerData = snapshot.data();
    await (0, sendWelcomeEmail_1.sendWelcomeEmail)(customerData);
});
