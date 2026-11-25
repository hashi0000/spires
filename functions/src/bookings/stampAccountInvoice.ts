import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { nextBookingRevision } from "./bookingRevision";

const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

type StampLink = {
  bookingId: string;
  keys: string[];
  expectedRevision?: number;
};

type StampRequest = {
  invoiceId: string;
  invoiceNumber: string;
  links: StampLink[];
};

function assertAdmin(context: functions.https.CallableContext): void {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
  const email = (context.auth.token.email || "").toString().trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
}

function text(value: unknown): string {
  return String(value || "").trim();
}

export function planAccountInvoiceStamp(
  row: FirebaseFirestore.DocumentData,
  bookingId: string,
  keys: string[],
  invoiceId: string,
  invoiceNumber: string
): FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> {
  const existingLinks = Array.isArray(row.invoiceLinks) ? [...row.invoiceLinks] : [];
  const existingKeys = new Set<string>(
    (Array.isArray(row.invoicedBillingKeys) ? row.invoicedBillingKeys : [])
      .map((key: unknown) => text(key))
      .filter(Boolean)
  );
  for (const existing of existingLinks) {
    const key = text(existing?.key);
    const number = text(existing?.invoiceNumber);
    if (key) existingKeys.add(key);
    if (key && keys.includes(key) && number && number !== invoiceNumber) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `${text(row.bookingNumber) || bookingId} key ${key} is already on invoice ${number}.`
      );
    }
  }
  if (row.invoiceStatus === "invoiced" && text(row.invoiceReference) && text(row.invoiceReference) !== invoiceNumber) {
    const wholeClaimed = keys.some((key) => key === bookingId || existingKeys.has(bookingId));
    if (wholeClaimed) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        `${text(row.bookingNumber) || bookingId} is already marked invoiced as ${text(row.invoiceReference)}.`
      );
    }
  }

  const nextLinks = [...existingLinks];
  for (const key of keys) {
    if (existingKeys.has(key)) {
      const other = nextLinks.find((item) => text(item?.key) === key);
      if (other && text(other.invoiceNumber) && text(other.invoiceNumber) !== invoiceNumber) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          `${text(row.bookingNumber) || bookingId} key ${key} is already on invoice ${text(other.invoiceNumber)}.`
        );
      }
    }
    if (!nextLinks.some((item) => text(item?.key) === key && text(item?.invoiceNumber) === invoiceNumber)) {
      nextLinks.push({ key, invoiceId, invoiceNumber });
    }
    existingKeys.add(key);
  }

  const invoicedBillingKeys = Array.from(existingKeys);
  const fullyCovered =
    row.invoiceStatus === "invoiced" ||
    keys.includes(bookingId) ||
    (invoicedBillingKeys.includes(`${bookingId}:outbound`) &&
      invoicedBillingKeys.includes(`${bookingId}:return`));

  return {
    invoiceStatus: fullyCovered ? "invoiced" : "partial",
    invoiceReference: invoiceNumber,
    invoiceId,
    invoicedBillingKeys,
    invoiceLinks: nextLinks.slice(-40),
    revision: nextBookingRevision(row),
  };
}

/**
 * After an account invoice is issued in the vault, stamp each included booking.
 * Refuses keys already linked to a different invoice number. Idempotent for the same invoice.
 * Does not change paymentStatus.
 */
export const stampAccountInvoiceBookings = functions.https.onCall(async (data: StampRequest, context) => {
  assertAdmin(context);
  const invoiceId = text(data?.invoiceId);
  const invoiceNumber = text(data?.invoiceNumber);
  const links = Array.isArray(data?.links) ? data.links : [];
  if (!invoiceId || !invoiceNumber || invoiceNumber === "PENDING") {
    throw new functions.https.HttpsError("invalid-argument", "Issued invoice id and number are required.");
  }
  if (!links.length) {
    throw new functions.https.HttpsError("invalid-argument", "At least one booking link is required.");
  }

  const db = admin.firestore();
  const normalised = links.map((link) => ({
    bookingId: text(link?.bookingId),
    keys: Array.isArray(link?.keys) ? link.keys.map(text).filter(Boolean) : [],
  }));
  for (const link of normalised) {
    if (!link.bookingId || !link.keys.length) {
      throw new functions.https.HttpsError("invalid-argument", "Each link needs a booking id and billable keys.");
    }
  }

  const stamped: string[] = [];

  await db.runTransaction(async (tx) => {
    const snaps = await Promise.all(
      normalised.map((link) => tx.get(db.collection("bookings").doc(link.bookingId)))
    );
    const patches: Array<{ ref: FirebaseFirestore.DocumentReference; patch: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData> }> = [];
    for (let i = 0; i < normalised.length; i += 1) {
      const link = normalised[i];
      const snap = snaps[i];
      if (!snap.exists) {
        throw new functions.https.HttpsError("not-found", `Booking ${link.bookingId} was not found.`);
      }
      const patch = planAccountInvoiceStamp(snap.data() || {}, link.bookingId, link.keys, invoiceId, invoiceNumber);
      patches.push({ ref: snap.ref, patch });
    }
    for (const row of patches) {
      tx.update(row.ref, row.patch);
      stamped.push(row.ref.id);
    }
  });

  return { ok: true, stamped, invoiceNumber };
});
