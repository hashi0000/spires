import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { guestRequestEmailHtml, sendHtmlEmail } from "../quotes/emails";
import { londonYmd } from "../quotes/londonTime";
import {
  clientIpHash,
  commitGuestBooking,
  decideGuestClaim,
  GUEST_CLAIM_ORIGIN,
  GUEST_RATE_MESSAGE,
  guestBookingNumber,
  guestClaimPatch,
  hashGuestKey,
  isGuestRateError,
  newGuestClaimToken,
  normaliseGuestEmail,
  prepareGuestBooking,
} from "./guestRequest";
import { firestoreGuestDb } from "./guestStore";

const db = () => admin.firestore();

function str(value: unknown): string {
  return typeof value === "string" ? value.trim() : "";
}

function setCors(res: functions.Response) {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
  res.set("Access-Control-Allow-Headers", "Content-Type");
}

function httpsError(code: functions.https.FunctionsErrorCode, message: string): functions.https.HttpsError {
  return new functions.https.HttpsError(code, message);
}

export async function handleGuestBookingHttp(req: functions.https.Request, res: functions.Response): Promise<void> {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  const now = Date.now();
  const prepared = prepareGuestBooking((req.body || {}) as Record<string, unknown>, {
    now,
    todayYmd: londonYmd(now),
    bookingNumber: guestBookingNumber(now),
    claimToken: newGuestClaimToken(),
  });
  if (!prepared.ok) {
    res.status(400).json({ error: prepared.error });
    return;
  }
  if (prepared.spam) {
    res.json({ ok: true });
    return;
  }
  try {
    const bookingId = db().collection("bookings").doc().id;
    const saved = await commitGuestBooking(firestoreGuestDb(), prepared, {
      now,
      ipHash: clientIpHash(req.header("x-forwarded-for") || req.ip),
      bookingId,
    });
    if (!saved.ok) {
      res.status(saved.status).json({ error: saved.error });
      return;
    }
    const claimUrl = saved.claimToken ? `${GUEST_CLAIM_ORIGIN}?t=${encodeURIComponent(saved.claimToken)}` : "";
    let emailSent = false;
    if (!saved.duplicate && saved.email) {
      try {
        await sendHtmlEmail({
          to: saved.email,
          subject: `Your Spires Taxis booking request ${saved.bookingNumber}`,
          html: guestRequestEmailHtml({
            name: saved.name,
            bookingNumber: saved.bookingNumber,
            claimUrl,
            hasPhone: Boolean(saved.phone),
          }),
          bccAdmin: false,
        });
        emailSent = true;
      } catch (err) {
        functions.logger.error("guest request acknowledgement failed", {
          bookingId: saved.bookingId,
          message: err instanceof Error ? err.message : "Email failed",
        });
      }
    }
    if (!saved.duplicate) {
      try {
        await db().collection("bookings").doc(saved.bookingId).collection("audit").add({
          action: "terms_accepted",
          actor: saved.email || "guest",
          at: admin.firestore.FieldValue.serverTimestamp(),
          termsVersion: "2026-10-25",
          acceptanceMethod: "website",
          guestRequest: true,
        });
      } catch (err) {
        functions.logger.error("guest request audit failed", err);
      }
    }
    res.json({
      ok: true,
      bookingNumber: saved.bookingNumber,
      duplicate: saved.duplicate,
      emailSent,
      claimUrl,
      contactBy: String(prepared.record.contactBy || ""),
    });
  } catch (err) {
    if (isGuestRateError(err)) {
      res.status(429).json({ error: GUEST_RATE_MESSAGE });
      return;
    }
    functions.logger.error("guest booking request failed", err);
    res.status(500).json({ error: "We could not save your request. Please call or WhatsApp us on 07776 897772." });
  }
}

export const guestClaimPreview = functions.https.onRequest(async (req, res) => {
  setCors(res);
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "POST") {
    res.status(405).json({ error: "Use POST." });
    return;
  }
  const token = str((req.body || {}).token);
  if (!token) {
    res.status(400).json({ error: "This link is not valid." });
    return;
  }
  const claimSnap = await db().collection("guestClaims").doc(hashGuestKey(token)).get();
  const row = claimSnap.data() || {};
  const decision = decideGuestClaim({
    claim: claimSnap.exists
      ? {
          bookingId: str(row.bookingId),
          email: str(row.email),
          used: row.used === true,
          expiresAt: Number(row.expiresAt) || 0,
        }
      : null,
    accountEmail: str(row.email),
    now: Date.now(),
  });
  if (!decision.ok) {
    res.status(404).json({ error: decision.error });
    return;
  }
  const bookingSnap = await db().collection("bookings").doc(decision.bookingId).get();
  const booking = bookingSnap.data() || {};
  if (!bookingSnap.exists || normaliseGuestEmail(str(booking.email) || str(booking.hirerEmail)) !== normaliseGuestEmail(str(row.email))) {
    res.status(404).json({ error: "This link is not valid." });
    return;
  }
  res.json({
    ok: true,
    bookingNumber: str(booking.bookingNumber),
    name: str(booking.name) || str(booking.hirerName),
    email: normaliseGuestEmail(str(booking.email) || str(booking.hirerEmail)),
    phone: str(booking.phone) || str(booking.hirerPhone),
    pickup: str(booking.pickup) || str(booking.pickupLocation),
    destination: str(booking.destination),
    when: str(booking.dateTime) || str(booking.pickupTime),
  });
});

export const claimGuestBooking = functions.https.onCall(async (data, context) => {
  if (!context.auth) throw httpsError("unauthenticated", "Sign in required.");
  const token = str((data as { token?: string })?.token);
  if (!token) throw httpsError("invalid-argument", "This link is not valid.");
  const accountEmail = normaliseGuestEmail(str(context.auth.token.email));
  const claimRef = db().collection("guestClaims").doc(hashGuestKey(token));
  const uid = context.auth.uid;
  const outcome: { bookingId: string; failure: { code: functions.https.FunctionsErrorCode; message: string } | null } = {
    bookingId: "",
    failure: null,
  };
  await db().runTransaction(async (tx) => {
    const claimSnap = await tx.get(claimRef);
    const row = claimSnap.data() || {};
    const decision = decideGuestClaim({
      claim: claimSnap.exists
        ? {
            bookingId: str(row.bookingId),
            email: str(row.email),
            used: row.used === true,
            expiresAt: Number(row.expiresAt) || 0,
          }
        : null,
      accountEmail,
      now: Date.now(),
    });
    if (!decision.ok) {
      outcome.failure = { code: "permission-denied", message: decision.error };
      return;
    }
    const bookingRef = db().collection("bookings").doc(decision.bookingId);
    const bookingSnap = await tx.get(bookingRef);
    if (!bookingSnap.exists) {
      outcome.failure = { code: "not-found", message: "This link is not valid." };
      return;
    }
    const booking = bookingSnap.data() || {};
    const bookingEmail = normaliseGuestEmail(str(booking.email) || str(booking.hirerEmail));
    if (!bookingEmail || bookingEmail !== accountEmail) {
      outcome.failure = { code: "permission-denied", message: "Sign in with the email address on this request." };
      return;
    }
    const existingUid = str(booking.uid);
    if (existingUid && existingUid !== uid) {
      outcome.failure = { code: "permission-denied", message: "This request is already linked to an account." };
      return;
    }
    if (!existingUid) tx.update(bookingRef, guestClaimPatch(uid));
    tx.set(claimRef, {
      used: true,
      usedBy: uid,
      usedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    outcome.bookingId = decision.bookingId;
  });
  if (outcome.failure) throw httpsError(outcome.failure.code, outcome.failure.message);
  return { ok: true, bookingId: outcome.bookingId };
});
