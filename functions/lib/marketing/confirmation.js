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
exports.deliverBookingMeasurements = exports.queueBookingMeasurement = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const params_1 = require("firebase-functions/params");
const quoteWorkflow_1 = require("../quotes/quoteWorkflow");
const attribution_1 = require("./attribution");
const apiSecret = (0, params_1.defineSecret)('SPIRES_GA4_API_SECRET');
const db = () => admin.firestore();
/** A single outbox document per booking survives status reversals and trigger retries. */
exports.queueBookingMeasurement = functions.runWith({ failurePolicy: true }).firestore.document('bookings/{bookingId}').onWrite(async (change, context) => {
    if (!change.after.exists)
        return;
    const after = change.after.data() || {}, before = change.before.data() || {};
    if (!(0, quoteWorkflow_1.isWorkflowConfirmed)(after) || (change.before.exists && (0, quoteWorkflow_1.isWorkflowConfirmed)(before)))
        return;
    // Only the server-validated online booking paths can supply attribution.
    if (after.createdByFunction !== true || !['website', 'customer_app'].includes(String(after.source)))
        return;
    const at = Date.now(), attribution = (0, attribution_1.readAttribution)(after.marketingAttribution, Number(after.marketingAttribution?.consentAt) || at);
    if (!attribution || attribution.expiresAt <= at)
        return;
    const ref = db().collection('marketingConversions').doc(context.params.bookingId);
    await db().runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists)
            return;
        tx.create(ref, { bookingId: context.params.bookingId, event: 'booking_confirmed', attribution, occurredAt: at, status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
});
/** Scheduled delivery is intentionally opt-in via server config and a Secret Manager secret. */
exports.deliverBookingMeasurements = functions.runWith({ secrets: [apiSecret], timeoutSeconds: 120 }).pubsub.schedule('every 15 minutes').onRun(async () => {
    const config = await db().collection('marketingConfig').doc('ga4').get();
    if (config.data()?.enabled !== true)
        return;
    const secret = apiSecret.value();
    if (!secret)
        throw new Error('GA4 measurement secret is missing');
    const rows = await db().collection('marketingConversions').where('status', '==', 'pending').limit(20).get();
    for (const row of rows.docs) {
        const claimed = await db().runTransaction(async (tx) => {
            const fresh = await tx.get(row.ref);
            if (fresh.data()?.status !== 'pending')
                return null;
            tx.update(row.ref, { status: 'sending', attemptedAt: Date.now() });
            return fresh.data();
        });
        if (!claimed)
            continue;
        // Recheck the booking so deleted, cancelled or explicitly revoked requests are never sent.
        const booking = await db().collection('bookings').doc(claimed.bookingId).get();
        const current = booking.data();
        const payload = (0, attribution_1.confirmationPayload)(claimed.bookingId, claimed.attribution, claimed.occurredAt);
        if (!current || !(0, quoteWorkflow_1.isWorkflowConfirmed)(current) || current.marketingAttribution?.consent !== 'granted' || !payload || claimed.attribution.expiresAt <= Date.now() || Date.now() - claimed.occurredAt > 48 * 3600000) {
            await row.ref.update({ status: 'skipped', reason: 'Not eligible at delivery' });
            continue;
        }
        try {
            const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-RSE4NNBP64&api_secret=${encodeURIComponent(secret)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
            // GA4's collection endpoint does not validate payloads: validate in staging before enabling.
            await row.ref.update({ status: response.ok ? 'submitted' : 'review_required', httpStatus: response.status, submittedAt: Date.now() });
        }
        catch (_) {
            // An ambiguous network result may already be delivered. Never automatically resend and double-count.
            await row.ref.update({ status: 'review_required', reason: 'Ambiguous delivery; inspect before retrying' });
        }
    }
});
