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
exports.isGuestRateError = void 0;
exports.firestoreGuestDb = firestoreGuestDb;
const admin = __importStar(require("firebase-admin"));
const guestRequest_1 = require("./guestRequest");
Object.defineProperty(exports, "isGuestRateError", { enumerable: true, get: function () { return guestRequest_1.isGuestRateError; } });
const db = () => admin.firestore();
function rateOf(data) {
    const count = Number(data?.count);
    const windowStart = Number(data?.windowStart);
    if (!Number.isFinite(count) || !Number.isFinite(windowStart))
        return null;
    return { count, windowStart };
}
function firestoreGuestDb() {
    return {
        async getSubmission(id) {
            if (!id)
                return null;
            const snap = await db().collection("guestBookingSubmissions").doc(id).get();
            if (!snap.exists)
                return null;
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
                const ipNow = (0, guestRequest_1.nextGuestRate)(rateOf(ipSnap.data()), Date.now());
                const contactNow = (0, guestRequest_1.nextGuestRate)(rateOf(contactSnap.data()), Date.now());
                if (!ipNow.allowed || !contactNow.allowed) {
                    const error = new Error("Too many guest requests");
                    error.code = "RATE";
                    throw error;
                }
                tx.set(bookingRef, {
                    ...input.record,
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
