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
exports.reviewWelcomeEmail = void 0;
const crypto_1 = require("crypto");
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions/v1"));
const driverReminderEmail_1 = require("../driverReminderEmail");
const messages_1 = require("./messages");
const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
function requireAdmin(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    const email = String(context.auth.token.email || "").trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }
    return email;
}
function audit(ref, action, actorEmail, extra) {
    return ref.collection("audit").add({
        action,
        actorEmail,
        at: firestore_1.FieldValue.serverTimestamp(),
        ...extra,
    });
}
/**
 * A message left for review is not sent again until a person checks the inbox.
 * "arrived" records that check. "send_once" claims the row, then sends one copy.
 */
exports.reviewWelcomeEmail = functions.https.onCall(async (data, context) => {
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
                welcomeEmailReviewedAt: firestore_1.FieldValue.serverTimestamp(),
                welcomeEmailReviewedBy: actor,
                welcomeEmailReviewReason: firestore_1.FieldValue.delete(),
            }, { merge: true });
        });
        await audit(ref, "welcome_review_arrived", actor, { sent: false });
        return { ok: true, sent: false };
    }
    const claimId = (0, crypto_1.randomBytes)(8).toString("hex");
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
    const welcome = (0, messages_1.buildWelcomeEmail)({ fullName, email: claimed.email, nowMs: Date.now() });
    try {
        if (process.env.FUNCTIONS_EMULATOR === "true" && claimed.email.toLowerCase().startsWith("reject.welcome@")) {
            throw new Error("rejected by the local test transport");
        }
        await (0, driverReminderEmail_1.getTransporter)().sendMail({
            from: `"Spires Taxis" <bookings@spires-taxis.com>`,
            to: claimed.email,
            subject: welcome.subject,
            html: welcome.html,
            text: welcome.text,
        });
    }
    catch (err) {
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
        throw new functions.https.HttpsError("failed-precondition", "The copy was not accepted. No message was captured. It is still waiting for review.");
    }
    await ref.set({
        welcomeEmailStatus: "sent",
        welcomeEmailSentAt: firestore_1.FieldValue.serverTimestamp(),
        welcomeEmailReviewedAt: firestore_1.FieldValue.serverTimestamp(),
        welcomeEmailReviewedBy: actor,
        welcomeEmailSendId: claimId,
        welcomeEmailFailure: firestore_1.FieldValue.delete(),
        welcomeEmailReviewReason: firestore_1.FieldValue.delete(),
    }, { merge: true });
    await audit(ref, "welcome_review_sent", actor, { sent: true, to: claimed.email, claimId });
    return { ok: true, sent: true };
});
