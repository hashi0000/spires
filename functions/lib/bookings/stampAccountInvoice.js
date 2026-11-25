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
exports.stampAccountInvoiceBookings = void 0;
exports.planAccountInvoiceStamp = planAccountInvoiceStamp;
const functions = __importStar(require("firebase-functions/v1"));
const admin = __importStar(require("firebase-admin"));
const bookingRevision_1 = require("./bookingRevision");
const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
function assertAdmin(context) {
    if (!context.auth) {
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    }
    const email = (context.auth.token.email || "").toString().trim().toLowerCase();
    if (!ADMIN_EMAILS.includes(email)) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }
}
function text(value) {
    return String(value || "").trim();
}
function planAccountInvoiceStamp(row, bookingId, keys, invoiceId, invoiceNumber) {
    const existingLinks = Array.isArray(row.invoiceLinks) ? [...row.invoiceLinks] : [];
    const existingKeys = new Set((Array.isArray(row.invoicedBillingKeys) ? row.invoicedBillingKeys : [])
        .map((key) => text(key))
        .filter(Boolean));
    for (const existing of existingLinks) {
        const key = text(existing?.key);
        const number = text(existing?.invoiceNumber);
        if (key)
            existingKeys.add(key);
        if (key && keys.includes(key) && number && number !== invoiceNumber) {
            throw new functions.https.HttpsError("failed-precondition", `${text(row.bookingNumber) || bookingId} key ${key} is already on invoice ${number}.`);
        }
    }
    if (row.invoiceStatus === "invoiced" && text(row.invoiceReference) && text(row.invoiceReference) !== invoiceNumber) {
        const wholeClaimed = keys.some((key) => key === bookingId || existingKeys.has(bookingId));
        if (wholeClaimed) {
            throw new functions.https.HttpsError("failed-precondition", `${text(row.bookingNumber) || bookingId} is already marked invoiced as ${text(row.invoiceReference)}.`);
        }
    }
    const nextLinks = [...existingLinks];
    for (const key of keys) {
        if (existingKeys.has(key)) {
            const other = nextLinks.find((item) => text(item?.key) === key);
            if (other && text(other.invoiceNumber) && text(other.invoiceNumber) !== invoiceNumber) {
                throw new functions.https.HttpsError("failed-precondition", `${text(row.bookingNumber) || bookingId} key ${key} is already on invoice ${text(other.invoiceNumber)}.`);
            }
        }
        if (!nextLinks.some((item) => text(item?.key) === key && text(item?.invoiceNumber) === invoiceNumber)) {
            nextLinks.push({ key, invoiceId, invoiceNumber });
        }
        existingKeys.add(key);
    }
    const invoicedBillingKeys = Array.from(existingKeys);
    const fullyCovered = row.invoiceStatus === "invoiced" ||
        keys.includes(bookingId) ||
        (invoicedBillingKeys.includes(`${bookingId}:outbound`) &&
            invoicedBillingKeys.includes(`${bookingId}:return`));
    return {
        invoiceStatus: fullyCovered ? "invoiced" : "partial",
        invoiceReference: invoiceNumber,
        invoiceId,
        invoicedBillingKeys,
        invoiceLinks: nextLinks.slice(-40),
        revision: (0, bookingRevision_1.nextBookingRevision)(row),
    };
}
/**
 * After an account invoice is issued in the vault, stamp each included booking.
 * Refuses keys already linked to a different invoice number. Idempotent for the same invoice.
 * Does not change paymentStatus.
 */
exports.stampAccountInvoiceBookings = functions.https.onCall(async (data, context) => {
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
    const stamped = [];
    await db.runTransaction(async (tx) => {
        const snaps = await Promise.all(normalised.map((link) => tx.get(db.collection("bookings").doc(link.bookingId))));
        const patches = [];
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
