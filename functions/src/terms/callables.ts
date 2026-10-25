import { createHash, randomBytes } from "crypto";
import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { escapeHtml } from "../driverReminderEmail";
import { sendHtmlEmail } from "../quotes/emails";
import { isQuoteAdmin } from "../quotes/quoteWorkflow";
import {
  CURRENT_BOOKING_TERMS,
  TERMS_ACCEPT_PAGE,
  onlineTermsAcceptance,
  validateStaffTermsReport,
} from "./bookingTerms";

const db = () => admin.firestore();

function httpsError(code: functions.https.FunctionsErrorCode, message: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, message);
}

function requireAdmin(context: functions.https.CallableContext): string {
  if (!context.auth) throw httpsError("unauthenticated", "Sign in required.");
  const email = String(context.auth.token.email || "");
  if (!isQuoteAdmin(email)) throw httpsError("permission-denied", "Admin access required.");
  return email.trim().toLowerCase();
}

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

async function audit(bookingId: string, action: string, actor: string, extra: Record<string, unknown> = {}) {
  await db().collection("bookings").doc(bookingId).collection("audit").add({
    action,
    actor,
    at: admin.firestore.FieldValue.serverTimestamp(),
    ...extra,
  });
}

function setCors(res: functions.Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

export const createCustomerBooking = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw httpsError("unauthenticated", "You must be logged in to create a booking.");
  const decision = onlineTermsAcceptance({
    termsAccepted: data?.termsAccepted,
    termsVersion: data?.termsVersion,
    channel: "customer_portal",
  });
  if (!decision.ok) throw httpsError("failed-precondition", decision.error);

  const pickup = str(data?.pickup);
  const destination = str(data?.destination);
  const dateTime = str(data?.dateTime);
  const vehicleType = str(data?.vehicleType);
  const paymentMethod = str(data?.paymentMethod);
  if (!pickup || !destination || !dateTime || !vehicleType || !paymentMethod) {
    throw httpsError("invalid-argument", "Pickup, destination, date, vehicle and payment method are required.");
  }
  const bookingType = str(data?.bookingType) === "return" ? "return" : "one_way";
  if (bookingType === "return") {
    if (!str(data?.returnPickupTime) || !str(data?.returnPickupLocation) || !str(data?.returnDestination)) {
      throw httpsError("invalid-argument", "Return bookings need a return date, pickup and destination.");
    }
  }
  const passengers = Number(data?.passengers) || 1;
  const ref = db().collection("bookings").doc();
  const email = str(context.auth.token.email);
  await ref.set({
    uid: context.auth.uid,
    name: str(data?.name) || email.split("@")[0] || "Customer",
    email,
    phone: str(data?.phone),
    pickup,
    destination,
    dateTime,
    passengers,
    luggage: Number(data?.luggage) || 0,
    specialRequirements: str(data?.specialRequirements).slice(0, 2000),
    bookingType,
    returnTrip: bookingType === "return",
    returnDateTime: bookingType === "return" ? str(data?.returnPickupTime) : "",
    returnPickupTime: bookingType === "return" ? str(data?.returnPickupTime) : "",
    returnPickupLocation: bookingType === "return" ? str(data?.returnPickupLocation) : "",
    returnDestination: bookingType === "return" ? str(data?.returnDestination) : "",
    airportCollection: data?.airportCollection === true,
    returnAirportCollection: bookingType === "return" && data?.returnAirportCollection === true,
    returnFlightNumber:
      bookingType === "return" && data?.returnAirportCollection === true ? str(data?.returnFlightNumber) : "",
    notes: str(data?.notes).slice(0, 2000),
    paymentMethod,
    paymentStatus: "pending",
    vehicleType,
    source: "customer_app",
    createdByFunction: true,
    depositRequired: false,
    depositStatus: "not_required",
    flightNumber: data?.airportCollection === true ? str(data?.flightNumber) : "",
    terminal: str(data?.terminal),
    status: "pending",
    termsAccepted: true,
    termsVersion: decision.version,
    termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
    acceptanceMethod: "customer_portal",
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  await audit(ref.id, "terms_accepted", email || context.auth.uid, {
    termsVersion: decision.version,
    acceptanceMethod: "customer_portal",
  });
  return { ok: true, bookingId: ref.id };
});

export const recordStaffTermsAcceptance = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const bookingId = str(data?.bookingId);
  if (!bookingId) throw httpsError("invalid-argument", "A booking is required.");
  const report = validateStaffTermsReport({
    acceptanceMethod: str(data?.acceptanceMethod),
    acceptedAtLocal: str(data?.acceptedAtLocal),
    note: str(data?.note),
    nowMs: Date.now(),
  });
  if (!report.ok) throw httpsError("invalid-argument", report.error);
  const ref = db().collection("bookings").doc(bookingId);
  const snap = await ref.get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const existing = snap.data() || {};
  if (existing.termsAccepted === true && existing.termsVersion) {
    throw httpsError("failed-precondition", "Acceptance is already recorded for this booking.");
  }
  await ref.set(
    {
      termsAccepted: true,
      termsVersion: CURRENT_BOOKING_TERMS.version,
      termsAcceptedAt: admin.firestore.Timestamp.fromMillis(report.acceptedAtMs),
      termsAcceptanceRecordedAt: admin.firestore.FieldValue.serverTimestamp(),
      termsAcceptanceRecordedBy: actor,
      termsAcceptanceNote: report.note.slice(0, 1000),
      acceptanceMethod: report.method,
    },
    { merge: true }
  );
  await audit(bookingId, "terms_acceptance_recorded", actor, {
    termsVersion: CURRENT_BOOKING_TERMS.version,
    acceptanceMethod: report.method,
    acceptedAtMs: report.acceptedAtMs,
  });
  return {
    ok: true,
    termsVersion: CURRENT_BOOKING_TERMS.version,
    termsUrl: CURRENT_BOOKING_TERMS.url,
    acceptanceMethod: report.method,
  };
});

export const createTermsAcceptanceLink = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const bookingId = str(data?.bookingId);
  if (!bookingId) throw httpsError("invalid-argument", "A booking is required.");
  const snap = await db().collection("bookings").doc(bookingId).get();
  if (!snap.exists) throw httpsError("not-found", "Booking not found.");
  const booking = snap.data() || {};
  if (booking.termsAccepted === true && booking.termsVersion) {
    throw httpsError("failed-precondition", "Acceptance is already recorded for this booking.");
  }
  const token = randomBytes(32).toString("base64url");
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + 14 * 24 * 60 * 60 * 1000);
  await db().collection("termsTokens").doc(hashToken(token)).set({
    bookingId,
    termsVersion: CURRENT_BOOKING_TERMS.version,
    expiresAt,
    createdBy: actor,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
  });
  const url = `${TERMS_ACCEPT_PAGE}?t=${encodeURIComponent(token)}`;
  let emailed = false;
  let emailError = "";
  if (data?.sendEmail === true) {
    const to = str(booking.email) || str(booking.hirerEmail);
    if (!to) {
      emailError = "This booking has no email address. Copy the link instead.";
    } else {
      try {
        const name = escapeHtml(str(booking.name) || str(booking.hirerName) || "Customer");
        const reference = escapeHtml(str(booking.bookingNumber) || bookingId);
        await sendHtmlEmail({
          to,
          subject: `Spires Taxis terms for booking ${reference}`,
          html: `<div style="font-family:Georgia,serif;color:#1a2332;background:#f4f7fa;padding:24px;">
            <div style="max-width:560px;margin:0 auto;background:#fff;border:1px solid #e4e9ef;border-radius:12px;padding:24px;">
              <p style="margin:0 0 8px;color:#b8956a;font-size:13px;">SPIRES TAXIS</p>
              <h1 style="color:#002147;font-size:22px;">Please review the terms</h1>
              <p>Dear ${name},</p>
              <p>Booking reference <strong>${reference}</strong>. This message does not confirm the booking and it does not record your agreement.</p>
              <p>Please read <a href="${CURRENT_BOOKING_TERMS.url}">Terms and Conditions version ${CURRENT_BOOKING_TERMS.version}</a>, then use the button below if you agree.</p>
              <p><a href="${url}" style="background:#002147;color:#fff;text-decoration:none;padding:12px 18px;border-radius:8px;display:inline-block;">Review and agree</a></p>
            </div>
          </div>`,
        });
        emailed = true;
      } catch (err) {
        emailError = err instanceof Error ? err.message : "The email could not be sent.";
      }
    }
  }
  await audit(bookingId, "terms_link_created", actor, { termsVersion: CURRENT_BOOKING_TERMS.version, emailed });
  return { ok: true, url, termsUrl: CURRENT_BOOKING_TERMS.url, emailed, emailError };
});

function publicTermsView(booking: FirebaseFirestore.DocumentData, bookingId: string) {
  return {
    bookingId,
    bookingNumber: str(booking.bookingNumber),
    pickup: str(booking.pickup) || str(booking.pickupLocation),
    destination: str(booking.destination),
    when: str(booking.dateTime) || str(booking.pickupTime),
    termsAccepted: booking.termsAccepted === true,
    termsVersion: booking.termsAccepted === true ? str(booking.termsVersion) : "",
    termsUrl: CURRENT_BOOKING_TERMS.url,
    publishedVersion: CURRENT_BOOKING_TERMS.version,
  };
}

export const acceptTermsPublic = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  try {
    const body = req.body || {};
    const token = str(body.token);
    const action = str(body.action) || "view";
    if (!token) {
      res.status(400).json({ error: "An acceptance link is required." });
      return;
    }
    const tokenRef = db().collection("termsTokens").doc(hashToken(token));
    const tokenSnap = await tokenRef.get();
    if (!tokenSnap.exists) {
      res.status(403).json({ error: "This link is not valid." });
      return;
    }
    const tokenRow = tokenSnap.data() || {};
    const expires = tokenRow.expiresAt?.toMillis?.() || 0;
    if (!expires || expires < Date.now()) {
      res.status(403).json({ error: "This link has expired." });
      return;
    }
    if (str(tokenRow.termsVersion) !== CURRENT_BOOKING_TERMS.version) {
      res.status(403).json({ error: "These terms have been updated. Please ask us for a new link." });
      return;
    }
    const bookingRef = db().collection("bookings").doc(str(tokenRow.bookingId));
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists) {
      res.status(404).json({ error: "Booking not found." });
      return;
    }
    const booking = bookingSnap.data() || {};
    if (action === "view") {
      res.json({ ok: true, booking: publicTermsView(booking, bookingSnap.id) });
      return;
    }
    if (action !== "accept") {
      res.status(400).json({ error: "Unknown action." });
      return;
    }
    if (body.termsAccepted !== true) {
      res.status(400).json({ error: "Please agree to the Terms and Conditions." });
      return;
    }
    if (booking.status === "cancelled") {
      res.status(400).json({ error: "This booking is cancelled." });
      return;
    }
    if (booking.termsAccepted === true && str(booking.termsVersion) === CURRENT_BOOKING_TERMS.version) {
      res.json({ ok: true, already: true, booking: publicTermsView(booking, bookingSnap.id) });
      return;
    }
    await bookingRef.set(
      {
        termsAccepted: true,
        termsVersion: CURRENT_BOOKING_TERMS.version,
        termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
        termsAcceptanceRecordedAt: admin.firestore.FieldValue.serverTimestamp(),
        acceptanceMethod: "terms_link",
      },
      { merge: true }
    );
    await audit(bookingSnap.id, "terms_accepted", "terms_link", { termsVersion: CURRENT_BOOKING_TERMS.version });
    const fresh = await bookingRef.get();
    res.json({ ok: true, already: false, booking: publicTermsView(fresh.data() || {}, fresh.id) });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Could not record agreement.";
    res.status(400).json({ error: message });
  }
});
