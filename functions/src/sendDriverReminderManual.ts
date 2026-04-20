import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import {
  extractTripDetailsFromBooking,
  reminderConfigOk,
  sendDriverManualReminderEmail,
} from "./driverReminderEmail";

/**
 * Manual send: email goes to the driver's address on file (not admin).
 * Reuses trip HTML builder from driverReminderEmail.ts.
 */
export const sendDriverReminderManual = functions.https.onCall(async (data, context) => {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }

  if (!reminderConfigOk()) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Email is not configured for Cloud Functions. Set functions.config().email.pass."
    );
  }

  const bookingId = data?.bookingId;
  if (!bookingId || typeof bookingId !== "string") {
    throw new functions.https.HttpsError("invalid-argument", "bookingId is required.");
  }

  const bookingSnap = await admin.firestore().collection("bookings").doc(bookingId).get();
  if (!bookingSnap.exists) {
    throw new functions.https.HttpsError("not-found", "Booking not found.");
  }

  const booking = bookingSnap.data()!;
  const driverId = (booking.driverId as string | undefined)?.toString().trim();
  if (!driverId) {
    throw new functions.https.HttpsError("failed-precondition", "No driver assigned");
  }

  const driverSnap = await admin.firestore().collection("drivers").doc(driverId).get();
  if (!driverSnap.exists) {
    throw new functions.https.HttpsError("failed-precondition", "Driver not found.");
  }

  const driverData = driverSnap.data()!;
  const email = (driverData.email || "").toString().trim();
  if (!email) {
    throw new functions.https.HttpsError("failed-precondition", "Driver has no email");
  }

  const trip = extractTripDetailsFromBooking(booking);
  if (!trip) {
    throw new functions.https.HttpsError("failed-precondition", "Booking has no valid pickup time.");
  }

  const driverName = (driverData.name || "Driver").toString().trim() || "Driver";
  const bookingNumber = (booking.bookingNumber || "").toString().trim() || bookingId;

  await sendDriverManualReminderEmail({
    to: email,
    driverName,
    bookingNumber,
    trip,
  });

  return { success: true as const };
});
