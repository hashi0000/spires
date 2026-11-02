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
exports.claimGuestBooking = exports.guestClaimPreview = void 0;
exports.handleGuestBookingHttp = handleGuestBookingHttp;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const emails_1 = require("../quotes/emails");
const londonTime_1 = require("../quotes/londonTime");
const guestRequest_1 = require("./guestRequest");
const guestStore_1 = require("./guestStore");
const db = () => admin.firestore();
function str(value) {
    return typeof value === "string" ? value.trim() : "";
}
function setCors(res) {
    res.set("Access-Control-Allow-Origin", "*");
    res.set("Access-Control-Allow-Methods", "POST, OPTIONS");
    res.set("Access-Control-Allow-Headers", "Content-Type");
}
function httpsError(code, message) {
    return new functions.https.HttpsError(code, message);
}
async function handleGuestBookingHttp(req, res) {
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
    const prepared = (0, guestRequest_1.prepareGuestBooking)((req.body || {}), {
        now,
        todayYmd: (0, londonTime_1.londonYmd)(now),
        bookingNumber: (0, guestRequest_1.guestBookingNumber)(now),
        claimToken: (0, guestRequest_1.newGuestClaimToken)(),
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
        const saved = await (0, guestRequest_1.commitGuestBooking)((0, guestStore_1.firestoreGuestDb)(), prepared, {
            now,
            ipHash: (0, guestRequest_1.clientIpHash)(req.header("x-forwarded-for") || req.ip),
            bookingId,
        });
        if (!saved.ok) {
            res.status(saved.status).json({ error: saved.error });
            return;
        }
        const claimUrl = saved.claimToken ? `${guestRequest_1.GUEST_CLAIM_ORIGIN}?t=${encodeURIComponent(saved.claimToken)}` : "";
        let emailSent = false;
        if (!saved.duplicate && saved.email) {
            try {
                await (0, emails_1.sendHtmlEmail)({
                    to: saved.email,
                    subject: `Your Spires Taxis booking request ${saved.bookingNumber}`,
                    html: (0, emails_1.guestRequestEmailHtml)({
                        name: saved.name,
                        bookingNumber: saved.bookingNumber,
                        claimUrl,
                        hasPhone: Boolean(saved.phone),
                    }),
                    bccAdmin: false,
                });
                emailSent = true;
            }
            catch (err) {
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
            }
            catch (err) {
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
    }
    catch (err) {
        if ((0, guestRequest_1.isGuestRateError)(err)) {
            res.status(429).json({ error: guestRequest_1.GUEST_RATE_MESSAGE });
            return;
        }
        functions.logger.error("guest booking request failed", err);
        res.status(500).json({ error: "We could not save your request. Please call or WhatsApp us on 07776 897772." });
    }
}
exports.guestClaimPreview = functions.https.onRequest(async (req, res) => {
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
    const claimSnap = await db().collection("guestClaims").doc((0, guestRequest_1.hashGuestKey)(token)).get();
    const row = claimSnap.data() || {};
    const decision = (0, guestRequest_1.decideGuestClaim)({
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
    if (!bookingSnap.exists || (0, guestRequest_1.normaliseGuestEmail)(str(booking.email) || str(booking.hirerEmail)) !== (0, guestRequest_1.normaliseGuestEmail)(str(row.email))) {
        res.status(404).json({ error: "This link is not valid." });
        return;
    }
    res.json({
        ok: true,
        bookingNumber: str(booking.bookingNumber),
        name: str(booking.name) || str(booking.hirerName),
        email: (0, guestRequest_1.normaliseGuestEmail)(str(booking.email) || str(booking.hirerEmail)),
        phone: str(booking.phone) || str(booking.hirerPhone),
        pickup: str(booking.pickup) || str(booking.pickupLocation),
        destination: str(booking.destination),
        when: str(booking.dateTime) || str(booking.pickupTime),
    });
});
exports.claimGuestBooking = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        throw httpsError("unauthenticated", "Sign in required.");
    const token = str(data?.token);
    if (!token)
        throw httpsError("invalid-argument", "This link is not valid.");
    const accountEmail = (0, guestRequest_1.normaliseGuestEmail)(str(context.auth.token.email));
    const claimRef = db().collection("guestClaims").doc((0, guestRequest_1.hashGuestKey)(token));
    const uid = context.auth.uid;
    const outcome = {
        bookingId: "",
        failure: null,
    };
    await db().runTransaction(async (tx) => {
        const claimSnap = await tx.get(claimRef);
        const row = claimSnap.data() || {};
        const decision = (0, guestRequest_1.decideGuestClaim)({
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
        const bookingEmail = (0, guestRequest_1.normaliseGuestEmail)(str(booking.email) || str(booking.hirerEmail));
        if (!bookingEmail || bookingEmail !== accountEmail) {
            outcome.failure = { code: "permission-denied", message: "Sign in with the email address on this request." };
            return;
        }
        const existingUid = str(booking.uid);
        if (existingUid && existingUid !== uid) {
            outcome.failure = { code: "permission-denied", message: "This request is already linked to an account." };
            return;
        }
        if (!existingUid)
            tx.update(bookingRef, (0, guestRequest_1.guestClaimPatch)(uid));
        tx.set(claimRef, {
            used: true,
            usedBy: uid,
            usedAt: admin.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });
        outcome.bookingId = decision.bookingId;
    });
    if (outcome.failure)
        throw httpsError(outcome.failure.code, outcome.failure.message);
    return { ok: true, bookingId: outcome.bookingId };
});
