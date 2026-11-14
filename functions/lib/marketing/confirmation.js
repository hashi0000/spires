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
const rules_1 = require("../international/rules");
const attribution_1 = require("./attribution");
const payments_1 = require("./payments");
const eventTime_1 = require("./eventTime");
const consent_1 = require("./consent");
const apiSecret = (0, params_1.defineSecret)('SPIRES_GA4_API_SECRET');
const MEASUREMENT_ID = 'G-RSE4NNBP64';
const db = () => admin.firestore();
function safeId(value) {
    return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
}
async function createOnce(id, data) {
    const ref = db().collection('marketingConversions').doc(safeId(id));
    await db().runTransaction(async (tx) => {
        const existing = await tx.get(ref);
        if (existing.exists)
            return;
        tx.create(ref, { ...data, status: 'pending', attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
}
/** A single outbox document per booking survives status reversals and trigger retries. */
exports.queueBookingMeasurement = functions.runWith({ failurePolicy: true }).firestore.document('bookings/{bookingId}').onWrite(async (change, context) => {
    if (!change.after.exists)
        return;
    const after = change.after.data() || {};
    const before = change.before.data() || {};
    if ((0, rules_1.measurementStream)(after) !== 'taxis')
        return;
    const bookingId = context.params.bookingId;
    const writeAt = change.after.updateTime?.toMillis() || Date.parse(context.timestamp);
    const at = (0, eventTime_1.measurementEventTime)(after.confirmedAt, writeAt);
    if ((0, quoteWorkflow_1.isWorkflowConfirmed)(after) && !(change.before.exists && (0, quoteWorkflow_1.isWorkflowConfirmed)(before)) && after.createdByFunction === true && ['website', 'customer_app'].includes(String(after.source))) {
        const attribution = (0, attribution_1.readAttribution)(after.marketingAttribution, Number(after.marketingAttribution?.consentAt) || at);
        if (attribution && attribution.expiresAt > at) {
            await createOnce(bookingId, { bookingId, event: 'booking_confirmed', attribution, occurredAt: at });
        }
    }
    const changeInPayment = (0, payments_1.paymentChange)(before, after);
    if (!changeInPayment)
        return;
    const attribution = (0, attribution_1.readAttribution)(after.marketingAttribution, Number(after.marketingAttribution?.consentAt) || at);
    if (!attribution?.clientId || attribution.expiresAt <= at)
        return;
    if (!['website', 'customer_app'].includes(String(after.source)) || after.createdByFunction !== true)
        return;
    const id = `${changeInPayment.direction}_${bookingId}_${changeInPayment.entryId}`;
    await createOnce(id, {
        bookingId,
        event: changeInPayment.direction,
        attribution,
        occurredAt: writeAt,
        valuePence: changeInPayment.deltaPence,
        currency: 'GBP',
        paymentKind: changeInPayment.kind,
        paymentMethod: changeInPayment.method || '',
        receivedAfterPence: changeInPayment.receivedAfterPence,
        entryId: changeInPayment.entryId,
    });
});
async function postMeasurement(secret, path, payload) {
    return fetch(`https://www.google-analytics.com/${path}?measurement_id=${MEASUREMENT_ID}&api_secret=${encodeURIComponent(secret)}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: AbortSignal.timeout(10000),
    });
}
function payloadFor(row) {
    const attribution = row.attribution;
    if (!attribution || typeof attribution !== 'object')
        return null;
    if (row.event === 'booking_confirmed')
        return (0, attribution_1.confirmationPayload)(String(row.bookingId), attribution, Number(row.occurredAt), Date.now());
    const change = {
        direction: row.event === 'refund' ? 'refund' : 'purchase',
        deltaPence: Number(row.valuePence) || 0,
        entryId: String(row.entryId || row.bookingId),
        kind: row.paymentKind === 'deposit' || row.paymentKind === 'full' ? row.paymentKind : 'balance',
        method: row.paymentMethod === 'card' || row.paymentMethod === 'cash' || row.paymentMethod === 'bank' ? row.paymentMethod : undefined,
        farePence: 0,
        receivedAfterPence: Number(row.receivedAfterPence) || 0,
    };
    return (0, payments_1.paymentPayload)(String(row.bookingId), attribution, change, Number(row.occurredAt), Date.now());
}
/** Scheduled delivery stays off until marketingConfig/ga4.enabled is set after a real debug validation. */
exports.deliverBookingMeasurements = functions.runWith({ secrets: [apiSecret], timeoutSeconds: 120 }).pubsub.schedule('every 15 minutes').onRun(async () => {
    const config = await db().collection('marketingConfig').doc('ga4').get();
    if (config.data()?.enabled !== true)
        return;
    const secret = apiSecret.value();
    if (!secret)
        throw new Error('GA4 measurement secret is missing');
    const stuck = await db().collection('marketingConversions').where('status', '==', 'sending').limit(20).get();
    for (const row of stuck.docs) {
        const attemptedAt = Number(row.data().attemptedAt) || 0;
        if (attemptedAt && Date.now() - attemptedAt > 20 * 60000) {
            await row.ref.update({ status: 'review_required', reason: 'Sending did not finish. Not sent again automatically.', transport: 'not_sent', ga4Receipt: 'not_confirmed', adsAttribution: 'not_confirmed' });
        }
    }
    const rows = await db().collection('marketingConversions').where('status', '==', 'pending').limit(20).get();
    for (const row of rows.docs) {
        const attempts = Number(row.data().attempts) || 0;
        const claimed = await db().runTransaction(async (tx) => {
            const fresh = await tx.get(row.ref);
            if (fresh.data()?.status !== 'pending')
                return null;
            tx.update(row.ref, { status: 'sending', attemptedAt: Date.now(), attempts: attempts + 1 });
            return fresh.data();
        });
        if (!claimed)
            continue;
        const booking = await db().collection('bookings').doc(String(claimed.bookingId)).get();
        const current = booking.data();
        const withdrawn = await (0, consent_1.measurementWithdrawn)(claimed.attribution, current?.uid);
        const payload = payloadFor(claimed);
        const paymentStillThere = claimed.event !== 'purchase'
            || Math.max(0, Math.round(Number(current?.amountReceivedPence) || 0)) >= Number(claimed.receivedAfterPence || 0);
        const eligibility = !current || !paymentStillThere
            ? { ok: false, reason: 'Booking payment or record changed before delivery' }
            : (0, payments_1.eligibleToSend)({
                consent: withdrawn ? 'denied' : current.marketingAttribution?.consent,
                occurredAt: Number(claimed.occurredAt),
                now: Date.now(),
                hasPayload: Boolean(payload),
                confirmed: (0, quoteWorkflow_1.isWorkflowConfirmed)(current),
                event: String(claimed.event),
            });
        if (!eligibility.ok || !payload) {
            const outcome = (0, payments_1.deliveryOutcome)({ validationOk: false, thrown: false, attempts: attempts + 1, eligible: false, eligibilityReason: eligibility.reason });
            await row.ref.update({ ...outcome, httpStatus: admin.firestore.FieldValue.delete() });
            continue;
        }
        let validation = { ok: false, reason: 'Validation did not run' };
        try {
            const debug = await postMeasurement(secret, 'debug/mp/collect', payload);
            validation = (0, payments_1.interpretValidation)(await debug.json());
        }
        catch {
            const outcome = (0, payments_1.deliveryOutcome)({ validationOk: false, validationReason: 'Validation could not be reached. Nothing was sent.', thrown: false, attempts: attempts + 1, eligible: true });
            if (outcome.status === 'invalid' && attempts + 1 < 3) {
                await row.ref.update({ status: 'pending', reason: outcome.reason, validation: 'not_run', transport: 'not_sent', ga4Receipt: 'not_confirmed', adsAttribution: 'not_confirmed' });
            }
            else {
                await row.ref.update(outcome);
            }
            continue;
        }
        if (!validation.ok) {
            await row.ref.update((0, payments_1.deliveryOutcome)({ validationOk: false, validationReason: validation.reason, thrown: false, attempts: attempts + 1, eligible: true }));
            continue;
        }
        if (await (0, consent_1.measurementWithdrawn)(claimed.attribution, current?.uid)) {
            await row.ref.update((0, payments_1.deliveryOutcome)({ validationOk: true, thrown: false, attempts: attempts + 1, eligible: false, eligibilityReason: 'Consent withdrawn before collection' }));
            continue;
        }
        try {
            const response = await postMeasurement(secret, 'mp/collect', payload);
            await row.ref.update({ ...(0, payments_1.deliveryOutcome)({ validationOk: true, httpStatus: response.status, thrown: false, attempts: attempts + 1, eligible: true }), httpStatus: response.status });
        }
        catch {
            await row.ref.update((0, payments_1.deliveryOutcome)({ validationOk: true, thrown: true, attempts: attempts + 1, eligible: true }));
        }
    }
});
