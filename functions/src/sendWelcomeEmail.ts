import * as admin from "firebase-admin";
import { FieldValue } from "firebase-admin/firestore";
import * as functions from "firebase-functions/v1";
import * as nodemailer from "nodemailer";
import { getTransporter } from "./driverReminderEmail";
import { buildWelcomeEmail, decideWelcomeClaim, welcomeFailureShouldRetry } from "./offers/messages";

/** Lazy init: avoid `functions.config()` at module load (breaks Firebase deploy code analysis / times out). */
let welcomeTransporter: nodemailer.Transporter | null = null;
function getWelcomeTransporter(): nodemailer.Transporter {
  if (!welcomeTransporter) {
    if (process.env.FUNCTIONS_EMULATOR === "true") {
      welcomeTransporter = getTransporter();
    } else {
      const config = functions.config();
      welcomeTransporter = nodemailer.createTransport({
        host: config.smtp?.host || "smtp.ionos.co.uk",
        port: Number(config.smtp?.port || 587),
        secure: false,
        auth: {
          user: config.email?.user || "bookings@spires-taxis.com",
          pass: config.email?.pass,
        },
      });
    }
  }
  return welcomeTransporter;
}

export type WelcomeSender = (message: { to: string; subject: string; html: string; text: string }) => Promise<void>;

export async function deliverWelcomeEmail(
  db: admin.firestore.Firestore,
  customerId: string,
  customerData: { email?: string; firstName?: string; lastName?: string },
  send: WelcomeSender,
  nowMs = Date.now()
): Promise<"sent" | "already_sent" | "stopped" | "needs_review" | "failed"> {
  const email = String(customerData.email || "").trim();
  if (!customerId || !email) return "stopped";
  const ref = db.collection("customers").doc(customerId);
  const sendId = `welcome_${nowMs}_${Math.random().toString(16).slice(2, 8)}`;
  const claim = await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const decision = decideWelcomeClaim(snap.data() || {}, sendId);
    if (decision.action !== "send") return decision;
    tx.set(ref, {
      welcomeEmailStatus: "sending",
      welcomeEmailAttempts: decision.attempts,
      welcomeEmailSendId: decision.sendId,
      welcomeEmailAttemptedAt: FieldValue.serverTimestamp(),
    }, { merge: true });
    return decision;
  });
  if (claim.action === "skip") {
    if (claim.reason === "needs_review") {
      await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (String(snap.data()?.welcomeEmailStatus || "") === "sending") {
          tx.set(ref, {
            welcomeEmailStatus: "needs_review",
            welcomeEmailReviewReason: "A previous attempt is still marked sending. Check the inbox before sending another copy.",
          }, { merge: true });
        }
      });
    }
    return claim.reason;
  }

  const fullName = `${customerData.firstName || ""} ${customerData.lastName || ""}`.trim() || "Customer";
  const welcome = buildWelcomeEmail({ fullName, email, nowMs });
  try {
    await send({ to: email, subject: welcome.subject, html: welcome.html, text: welcome.text });
  } catch (err) {
    const message = err instanceof Error ? err.message : "send failed";
    const timedOut = /timeout|ETIMEDOUT|ESOCKET/i.test(message);
    await ref.set({ welcomeEmailStatus: "failed", welcomeEmailFailure: timedOut ? "timeout" : "rejected" }, { merge: true });
    functions.logger.error("Failed to send welcome email", { attempts: claim.attempts });
    if (welcomeFailureShouldRetry(claim.attempts)) throw err;
    return "failed";
  }
  try {
    await ref.set({
      welcomeEmailStatus: "sent",
      welcomeEmailSentAt: FieldValue.serverTimestamp(),
      welcomeEmailSendId: claim.sendId,
    }, { merge: true });
  } catch (err) {
    functions.logger.error("Welcome message was accepted but the sent status was not stored", { sendId: claim.sendId });
    throw err;
  }
  return "sent";
}

export async function sendWelcomeEmail(
  customerId: string,
  customerData: { email?: string; firstName?: string; lastName?: string },
  nowMs = Date.now()
) {
  await deliverWelcomeEmail(
    admin.firestore(),
    customerId,
    customerData,
    async (message) => {
      await getWelcomeTransporter().sendMail({
        from: `"Spires Taxis" <bookings@spires-taxis.com>`,
        to: message.to,
        subject: message.subject,
        html: message.html,
        text: message.text,
      });
    },
    nowMs
  );
}
