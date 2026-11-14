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
exports.recordBookingSource = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const quoteWorkflow_1 = require("../quotes/quoteWorkflow");
/** Staff reports stay separate from observed browser attribution and retain an append-only application history. */
exports.recordBookingSource = functions.https.onCall(async (data, context) => {
    const actor = String(context.auth?.token.email || '').trim().toLowerCase();
    if (!context.auth || !(0, quoteWorkflow_1.isQuoteAdmin)(actor))
        throw new functions.https.HttpsError('permission-denied', 'Admin access required.');
    const id = String(data?.bookingId || '');
    const source = String(data?.source || '');
    const channel = String(data?.channel || '');
    if (!/^[A-Za-z0-9_-]{1,128}$/.test(id) || !['', 'google_ads', 'website', 'repeat', 'recommendation', 'other'].includes(source) || !['telephone', 'whatsapp'].includes(channel)) {
        throw new functions.https.HttpsError('invalid-argument', 'Choose a supported booking, source and channel.');
    }
    const db = admin.firestore();
    const bookingRef = db.collection('bookings').doc(id);
    const noteRef = db.collection('bookingMeasurementNotes').doc(id);
    const auditRef = db.collection('bookingSourceAudit').doc();
    await db.runTransaction(async (tx) => {
        const [booking, note] = await Promise.all([tx.get(bookingRef), tx.get(noteRef)]);
        if (!booking.exists)
            throw new functions.https.HttpsError('not-found', 'Booking not found.');
        const patch = { staffReportedSource: source, enquiryChannel: channel, provenance: 'staff_recorded', updatedBy: actor, updatedAt: admin.firestore.FieldValue.serverTimestamp() };
        tx.set(noteRef, patch, { merge: true });
        tx.create(auditRef, { bookingId: id, previousSource: note.data()?.staffReportedSource || '', previousChannel: note.data()?.enquiryChannel || '', ...patch });
    });
    return { saved: true };
});
