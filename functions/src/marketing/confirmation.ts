import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { defineSecret } from 'firebase-functions/params';
import { isWorkflowConfirmed } from '../quotes/quoteWorkflow';
import { measurementStream } from '../international/rules';
import { confirmationPayload, readAttribution, type Attribution } from './attribution';
import { deliveryOutcome, eligibleToSend, interpretValidation, paymentChange, paymentPayload, type PaymentMeasurement } from './payments';
import { measurementEventTime } from './eventTime';
import { measurementWithdrawn } from './consent';

const apiSecret = defineSecret('SPIRES_GA4_API_SECRET');
const MEASUREMENT_ID = 'G-RSE4NNBP64';
const db = () => admin.firestore();

function safeId(value: string): string {
  return value.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 120);
}

async function createOnce(id: string, data: Record<string, unknown>) {
  const ref = db().collection('marketingConversions').doc(safeId(id));
  await db().runTransaction(async (tx) => {
    const existing = await tx.get(ref);
    if (existing.exists) return;
    tx.create(ref, { ...data, status: 'pending', attempts: 0, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
}

/** A single outbox document per booking survives status reversals and trigger retries. */
export const queueBookingMeasurement = functions.runWith({ failurePolicy: true }).firestore.document('bookings/{bookingId}').onWrite(async (change, context) => {
  if (!change.after.exists) return;
  const after = change.after.data() || {};
  const before = change.before.data() || {};
  if (measurementStream(after) !== 'taxis') return;
  const bookingId = context.params.bookingId;
  const writeAt = change.after.updateTime?.toMillis() || Date.parse(context.timestamp);
  const at = measurementEventTime(after.confirmedAt, writeAt);
  if (isWorkflowConfirmed(after) && !(change.before.exists && isWorkflowConfirmed(before)) && after.createdByFunction === true && ['website', 'customer_app'].includes(String(after.source))) {
    const attribution = readAttribution(after.marketingAttribution, Number(after.marketingAttribution?.consentAt) || at);
    if (attribution && attribution.expiresAt > at) {
      await createOnce(bookingId, { bookingId, event: 'booking_confirmed', attribution, occurredAt: at });
    }
  }
  const changeInPayment = paymentChange(before, after);
  if (!changeInPayment) return;
  const attribution = readAttribution(after.marketingAttribution, Number(after.marketingAttribution?.consentAt) || at);
  if (!attribution?.clientId || attribution.expiresAt <= at) return;
  if (!['website', 'customer_app'].includes(String(after.source)) || after.createdByFunction !== true) return;
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

async function postMeasurement(secret: string, path: 'debug/mp/collect' | 'mp/collect', payload: unknown) {
  return fetch(`https://www.google-analytics.com/${path}?measurement_id=${MEASUREMENT_ID}&api_secret=${encodeURIComponent(secret)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(10000),
  });
}

function payloadFor(row: FirebaseFirestore.DocumentData) {
  const attribution = row.attribution as Attribution;
  if(!attribution || typeof attribution!=='object')return null;
  if (row.event === 'booking_confirmed') return confirmationPayload(String(row.bookingId), attribution, Number(row.occurredAt), Date.now());
  const change: PaymentMeasurement = {
    direction: row.event === 'refund' ? 'refund' : 'purchase',
    deltaPence: Number(row.valuePence) || 0,
    entryId: String(row.entryId || row.bookingId),
    kind: row.paymentKind === 'deposit' || row.paymentKind === 'full' ? row.paymentKind : 'balance',
    method: row.paymentMethod === 'card' || row.paymentMethod === 'cash' || row.paymentMethod === 'bank' ? row.paymentMethod : undefined,
    farePence: 0,
    receivedAfterPence: Number(row.receivedAfterPence) || 0,
  };
  return paymentPayload(String(row.bookingId), attribution, change, Number(row.occurredAt), Date.now());
}

/** Scheduled delivery stays off until marketingConfig/ga4.enabled is set after a real debug validation. */
export const deliverBookingMeasurements = functions.runWith({ secrets: [apiSecret], timeoutSeconds: 120 }).pubsub.schedule('every 15 minutes').onRun(async () => {
  const config = await db().collection('marketingConfig').doc('ga4').get();
  if (config.data()?.enabled !== true) return;
  const secret = apiSecret.value();
  if (!secret) throw new Error('GA4 measurement secret is missing');
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
      if (fresh.data()?.status !== 'pending') return null;
      tx.update(row.ref, { status: 'sending', attemptedAt: Date.now(), attempts: attempts + 1 });
      return fresh.data()!;
    });
    if (!claimed) continue;
    const booking = await db().collection('bookings').doc(String(claimed.bookingId)).get();
    const current = booking.data();
    const withdrawn = await measurementWithdrawn(claimed.attribution, current?.uid);
    const payload = payloadFor(claimed);
    const paymentStillThere = claimed.event !== 'purchase'
      || Math.max(0, Math.round(Number(current?.amountReceivedPence) || 0)) >= Number(claimed.receivedAfterPence || 0);
    const eligibility = !current || !paymentStillThere
      ? { ok: false, reason: 'Booking payment or record changed before delivery' }
      : eligibleToSend({
          consent: withdrawn ? 'denied' : current.marketingAttribution?.consent,
          occurredAt: Number(claimed.occurredAt),
          now: Date.now(),
          hasPayload: Boolean(payload),
          confirmed: isWorkflowConfirmed(current),
          event: String(claimed.event),
        });
    if (!eligibility.ok || !payload) {
      const outcome = deliveryOutcome({ validationOk: false, thrown: false, attempts: attempts + 1, eligible: false, eligibilityReason: eligibility.reason });
      await row.ref.update({ ...outcome, httpStatus: admin.firestore.FieldValue.delete() });
      continue;
    }
    let validation = { ok: false, reason: 'Validation did not run' };
    try {
      const debug = await postMeasurement(secret, 'debug/mp/collect', payload);
      validation = interpretValidation(await debug.json());
    } catch {
      const outcome = deliveryOutcome({ validationOk: false, validationReason: 'Validation could not be reached. Nothing was sent.', thrown: false, attempts: attempts + 1, eligible: true });
      if (outcome.status === 'invalid' && attempts + 1 < 3) {
        await row.ref.update({ status: 'pending', reason: outcome.reason, validation: 'not_run', transport: 'not_sent', ga4Receipt: 'not_confirmed', adsAttribution: 'not_confirmed' });
      } else {
        await row.ref.update(outcome);
      }
      continue;
    }
    if (!validation.ok) {
      await row.ref.update(deliveryOutcome({ validationOk: false, validationReason: validation.reason, thrown: false, attempts: attempts + 1, eligible: true }));
      continue;
    }
    if (await measurementWithdrawn(claimed.attribution, current?.uid)) {
      await row.ref.update(deliveryOutcome({validationOk:true,thrown:false,attempts:attempts+1,eligible:false,eligibilityReason:'Consent withdrawn before collection'}));
      continue;
    }
    try {
      const response = await postMeasurement(secret, 'mp/collect', payload);
      await row.ref.update({ ...deliveryOutcome({ validationOk: true, httpStatus: response.status, thrown: false, attempts: attempts + 1, eligible: true }), httpStatus: response.status });
    } catch {
      await row.ref.update(deliveryOutcome({ validationOk: true, thrown: true, attempts: attempts + 1, eligible: true }));
    }
  }
});
