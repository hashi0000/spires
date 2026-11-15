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
exports.deliverWelcomeEmail = deliverWelcomeEmail;
exports.sendWelcomeEmail = sendWelcomeEmail;
const admin = __importStar(require("firebase-admin"));
const firestore_1 = require("firebase-admin/firestore");
const functions = __importStar(require("firebase-functions/v1"));
const nodemailer = __importStar(require("nodemailer"));
const driverReminderEmail_1 = require("./driverReminderEmail");
const messages_1 = require("./offers/messages");
/** Lazy init: avoid `functions.config()` at module load (breaks Firebase deploy code analysis / times out). */
let welcomeTransporter = null;
function getWelcomeTransporter() {
    if (!welcomeTransporter) {
        if (process.env.FUNCTIONS_EMULATOR === "true") {
            welcomeTransporter = (0, driverReminderEmail_1.getTransporter)();
        }
        else {
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
async function deliverWelcomeEmail(db, customerId, customerData, send, nowMs = Date.now()) {
    const email = String(customerData.email || "").trim();
    if (!customerId || !email)
        return "stopped";
    const ref = db.collection("customers").doc(customerId);
    const sendId = `welcome_${nowMs}_${Math.random().toString(16).slice(2, 8)}`;
    const claim = await db.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const decision = (0, messages_1.decideWelcomeClaim)(snap.data() || {}, sendId);
        if (decision.action !== "send")
            return decision;
        tx.set(ref, {
            welcomeEmailStatus: "sending",
            welcomeEmailAttempts: decision.attempts,
            welcomeEmailSendId: decision.sendId,
            welcomeEmailAttemptedAt: firestore_1.FieldValue.serverTimestamp(),
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
    const welcome = (0, messages_1.buildWelcomeEmail)({ fullName, email, nowMs });
    try {
        await send({ to: email, subject: welcome.subject, html: welcome.html, text: welcome.text });
    }
    catch (err) {
        const message = err instanceof Error ? err.message : "send failed";
        const timedOut = /timeout|ETIMEDOUT|ESOCKET/i.test(message);
        await ref.set({ welcomeEmailStatus: "failed", welcomeEmailFailure: timedOut ? "timeout" : "rejected" }, { merge: true });
        functions.logger.error("Failed to send welcome email", { attempts: claim.attempts });
        if ((0, messages_1.welcomeFailureShouldRetry)(claim.attempts))
            throw err;
        return "failed";
    }
    try {
        await ref.set({
            welcomeEmailStatus: "sent",
            welcomeEmailSentAt: firestore_1.FieldValue.serverTimestamp(),
            welcomeEmailSendId: claim.sendId,
        }, { merge: true });
    }
    catch (err) {
        functions.logger.error("Welcome message was accepted but the sent status was not stored", { sendId: claim.sendId });
        throw err;
    }
    return "sent";
}
async function sendWelcomeEmail(customerId, customerData, nowMs = Date.now()) {
    await deliverWelcomeEmail(admin.firestore(), customerId, customerData, async (message) => {
        await getWelcomeTransporter().sendMail({
            from: `"Spires Taxis" <bookings@spires-taxis.com>`,
            to: message.to,
            subject: message.subject,
            html: message.html,
            text: message.text,
        });
    }, nowMs);
}
