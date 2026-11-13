import * as admin from "firebase-admin";
import { measurementWithdrawn } from '../marketing/consent';
import { Attribution } from '../marketing/attribution';
import { GuestDb, isGuestRateError, nextGuestRate, RateRow } from "./guestRequest";

export { isGuestRateError };

const db = () => admin.firestore();

function rateOf(data: FirebaseFirestore.DocumentData | undefined): RateRow | null {
  const count = Number(data?.count);
  const windowStart = Number(data?.windowStart);
  if (!Number.isFinite(count) || !Number.isFinite(windowStart)) return null;
  return { count, windowStart };
}

export function firestoreGuestDb(): GuestDb {
  return {
    async getSubmission(id) {
      if (!id) return null;
      const snap = await db().collection("guestBookingSubmissions").doc(id).get();
      if (!snap.exists) return null;
      const row = snap.data() || {};
      return { bookingId: String(row.bookingId || ""), bookingNumber: String(row.bookingNumber || "") };
    },
    async getRate(key) {
      const snap = await db().collection("guestBookingRate").doc(key).get();
      return snap.exists ? rateOf(snap.data()) : null;
    },
    async insert(input) {
      const submissionRef = input.submissionId
        ? db().collection("guestBookingSubmissions").doc(input.submissionId)
        : null;
      const bookingRef = db().collection("bookings").doc(input.bookingId);
      const ipRef = db().collection("guestBookingRate").doc(`ip:${input.ipHash}`);
      const contactRef = db().collection("guestBookingRate").doc(`contact:${input.contactHash}`);
      const claimRef = input.claim ? db().collection("guestClaims").doc(input.claim.hash) : null;
      return db().runTransaction(async (tx) => {
        const submission = submissionRef ? await tx.get(submissionRef) : null;
        const ipSnap = await tx.get(ipRef);
        const contactSnap = await tx.get(contactRef);
        if (submission?.exists) {
          const row = submission.data() || {};
          return {
            duplicate: true,
            bookingId: String(row.bookingId || ""),
            bookingNumber: String(row.bookingNumber || ""),
          };
        }
        const ipNow = nextGuestRate(rateOf(ipSnap.data()), Date.now());
        const contactNow = nextGuestRate(rateOf(contactSnap.data()), Date.now());
        if (!ipNow.allowed || !contactNow.allowed) {
          const error = new Error("Too many guest requests");
          (error as Error & { code?: string }).code = "RATE";
          throw error;
        }
        const attribution=input.record.marketingAttribution as Attribution | null;
        const withdrawn=attribution?await measurementWithdrawn(attribution,undefined,tx):false;
        tx.set(bookingRef, {
          ...input.record,
          marketingAttribution:withdrawn?null:(attribution || null),
          termsAcceptedAt: admin.firestore.FieldValue.serverTimestamp(),
          createdAt: admin.firestore.FieldValue.serverTimestamp(),
        });
        if (submissionRef) {
          tx.set(submissionRef, {
            bookingId: input.bookingId,
            bookingNumber: input.bookingNumber,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        tx.set(ipRef, ipNow.next);
        tx.set(contactRef, contactNow.next);
        if (claimRef && input.claim) {
          tx.set(claimRef, {
            bookingId: input.claim.bookingId,
            email: input.claim.email,
            used: false,
            expiresAt: input.claim.expiresAt,
            createdAt: admin.firestore.FieldValue.serverTimestamp(),
          });
        }
        return { duplicate: false, bookingId: input.bookingId, bookingNumber: input.bookingNumber };
      });
    },
  };
}
