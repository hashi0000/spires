import { randomBytes } from "crypto";
import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import { getTransporter } from "../driverReminderEmail";
import { buildWelcomeEmail } from "./messages";

const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

function requireAdmin(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
  const email = String(context.auth.token.email || "").trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  return email;
}

function audit(
  ref: FirebaseFirestore.DocumentReference,
  action: string,
  actorEmail: string,
  extra: Record<string, unknown>
) {
  return ref.collection("audit").add({
    action,
    actorEmail,
    at: FieldValue.serverTimestamp(),
    ...extra,
  });
}

/**
 * A message left for review is not sent again until a person checks the inbox.
 * "arrived" records that check. "send_once" claims the row, then sends one copy.
 */
export const reviewWelcomeEmail = functions.https.onCall(async (data, context) => {
  const actor = requireAdmin(context);
  const customerId = String(data?.customerId || "").trim();
  const action = data?.action === "send_once" ? "send_once" : data?.action === "arrived" ? "arrived" : "";
  if (!customerId || customerId.includes("/") || !action) {
    throw new functions.https.HttpsError("invalid-argument", "Choose the customer and whether the message arrived.");
  }
  const ref = admin.firestore().collection("customers").doc(customerId);
  if (action === "arrived") {
    await admin.firestore().runTransaction(async (tx) => {
      const snap = await tx.get(ref);
      if (String(snap.data()?.welcomeEmailStatus || "") !== "needs_review") {
        throw new functions.https.HttpsError("failed-precondition", "This message is not waiting for review.");
      }
      tx.set(ref, {
        welcomeEmailStatus: "sent",
        welcomeEmailReviewedAt: FieldValue.serverTimestamp(),
        welcomeEmailReviewedBy: actor,
        welcomeEmailReviewReason: FieldValue.delete(),
      }, { merge: true });
    });
    await audit(ref, "welcome_review_arrived", actor, { sent: false });
    return { ok: true, sent: false };
  }

  const claimId = randomBytes(8).toString("hex");
  const claimed = await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const row = snap.data() || {};
    if (String(row.welcomeEmailStatus || "") !== "needs_review") {
      throw new functions.https.HttpsError("failed-precondition", "This message is not waiting for review.");
    }
    tx.set(ref, {
      welcomeEmailStatus: "sending",
      welcomeEmailSendId: claimId,
      welcomeEmailReviewedBy: actor,
    }, { merge: true });
    return {
      email: String(row.email || ""),
      firstName: String(row.firstName || ""),
      lastName: String(row.lastName || ""),
    };
  });

  const fullName = `${claimed.firstName} ${claimed.lastName}`.trim() || "Customer";
  const welcome = buildWelcomeEmail({ fullName, email: claimed.email, nowMs: Date.now() });
  try {
    if (process.env.FUNCTIONS_EMULATOR === "true" && claimed.email.toLowerCase().startsWith("reject.welcome@")) {
      throw new Error("rejected by the local test transport");
    }
    await getTransporter().sendMail({
      from: `"Spires Taxis" <bookings@spires-taxis.com>`,
      to: claimed.email,
      subject: welcome.subject,
      html: welcome.html,
      text: welcome.text,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    const timedOut = /timeout|ETIMEDOUT|ESOCKET/i.test(message);
    await ref.set({
      welcomeEmailStatus: "needs_review",
      welcomeEmailFailure: timedOut ? "timeout" : "rejected",
      welcomeEmailReviewReason: "The copy was not accepted. Check the inbox, then send one copy if it did not arrive.",
    }, { merge: true });
    await audit(ref, "welcome_review_send_failed", actor, {
      sent: false,
      failure: timedOut ? "timeout" : "rejected",
      claimId,
    });
    throw new functions.https.HttpsError(
      "failed-precondition",
      "The copy was not accepted. No message was captured. It is still waiting for review."
    );
  }

  await ref.set({
    welcomeEmailStatus: "sent",
    welcomeEmailSentAt: FieldValue.serverTimestamp(),
    welcomeEmailReviewedAt: FieldValue.serverTimestamp(),
    welcomeEmailReviewedBy: actor,
    welcomeEmailSendId: claimId,
    welcomeEmailFailure: FieldValue.delete(),
    welcomeEmailReviewReason: FieldValue.delete(),
  }, { merge: true });
  await audit(ref, "welcome_review_sent", actor, { sent: true, to: claimed.email, claimId });
  return { ok: true, sent: true };
});
