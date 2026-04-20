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
exports.sendDriverReminderManual = void 0;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const driverReminderEmail_1 = require("./driverReminderEmail");
/**
 * Manual send: email goes to the driver's address on file (not admin).
 * Reuses trip HTML builder from driverReminderEmail.ts.
 */
exports.sendDriverReminderManual = functions.https.onCall(async (data, context) => {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    if (!(0, driverReminderEmail_1.reminderConfigOk)()) {
        throw new functions.https.HttpsError("failed-precondition", "Email is not configured for Cloud Functions. Set functions.config().email.pass.");
    }
    const bookingId = data?.bookingId;
    if (!bookingId || typeof bookingId !== "string") {
        throw new functions.https.HttpsError("invalid-argument", "bookingId is required.");
    }
    const bookingSnap = await admin.firestore().collection("bookings").doc(bookingId).get();
    if (!bookingSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Booking not found.");
    }
    const booking = bookingSnap.data();
    const driverId = booking.driverId?.toString().trim();
    if (!driverId) {
        throw new functions.https.HttpsError("failed-precondition", "No driver assigned");
    }
    const driverSnap = await admin.firestore().collection("drivers").doc(driverId).get();
    if (!driverSnap.exists) {
        throw new functions.https.HttpsError("failed-precondition", "Driver not found.");
    }
    const driverData = driverSnap.data();
    const email = (driverData.email || "").toString().trim();
    if (!email) {
        throw new functions.https.HttpsError("failed-precondition", "Driver has no email");
    }
    const trip = (0, driverReminderEmail_1.extractTripDetailsFromBooking)(booking);
    if (!trip) {
        throw new functions.https.HttpsError("failed-precondition", "Booking has no valid pickup time.");
    }
    const driverName = (driverData.name || "Driver").toString().trim() || "Driver";
    const bookingNumber = (booking.bookingNumber || "").toString().trim() || bookingId;
    await (0, driverReminderEmail_1.sendDriverManualReminderEmail)({
        to: email,
        driverName,
        bookingNumber,
        trip,
    });
    return { success: true };
});
