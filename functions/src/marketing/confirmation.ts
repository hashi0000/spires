import * as admin from 'firebase-admin';
import * as functions from 'firebase-functions/v1';
import { defineSecret } from 'firebase-functions/params';
import { isWorkflowConfirmed } from '../quotes/quoteWorkflow';
import { confirmationPayload, readAttribution } from './attribution';

const apiSecret = defineSecret('SPIRES_GA4_API_SECRET');
const db = () => admin.firestore();

/** A single outbox document per booking survives status reversals and trigger retries. */
export const queueBookingMeasurement = functions.runWith({ failurePolicy: true }).firestore.document('bookings/{bookingId}').onWrite(async (change, context) => {
  if (!change.after.exists) return;
  const after = change.after.data() || {}, before = change.before.data() || {};
  if (!isWorkflowConfirmed(after) || (change.before.exists && isWorkflowConfirmed(before))) return;
  // Only the server-validated online booking paths can supply attribution.
  if (after.createdByFunction !== true || !['website', 'customer_app'].includes(String(after.source))) return;
  const at = Date.now(), attribution = readAttribution(after.marketingAttribution, Number(after.marketingAttribution?.consentAt) || at);
  if (!attribution || attribution.expiresAt <= at) return;
  const ref = db().collection('marketingConversions').doc(context.params.bookingId);
  await db().runTransaction(async tx => {
    const existing = await tx.get(ref);
    if (existing.exists) return;
    tx.create(ref, { bookingId: context.params.bookingId, event: 'booking_confirmed', attribution, occurredAt: at, status: 'pending', createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
});

/** Scheduled delivery is intentionally opt-in via server config and a Secret Manager secret. */
export const deliverBookingMeasurements = functions.runWith({ secrets: [apiSecret], timeoutSeconds: 120 }).pubsub.schedule('every 15 minutes').onRun(async () => {
  const config = await db().collection('marketingConfig').doc('ga4').get();
  if (config.data()?.enabled !== true) return;
  const secret = apiSecret.value();
  if (!secret) throw new Error('GA4 measurement secret is missing');
  const rows = await db().collection('marketingConversions').where('status', '==', 'pending').limit(20).get();
  for (const row of rows.docs) {
    const claimed = await db().runTransaction(async tx => {
      const fresh = await tx.get(row.ref);
      if (fresh.data()?.status !== 'pending') return null;
      tx.update(row.ref, { status: 'sending', attemptedAt: Date.now() });
      return fresh.data()!;
    });
    if (!claimed) continue;
    // Recheck the booking so deleted, cancelled or explicitly revoked requests are never sent.
    const booking = await db().collection('bookings').doc(claimed.bookingId).get();
    const current = booking.data();
    const payload = confirmationPayload(claimed.bookingId, claimed.attribution, claimed.occurredAt);
    if (!current || !isWorkflowConfirmed(current) || current.marketingAttribution?.consent !== 'granted' || !payload || claimed.attribution.expiresAt <= Date.now() || Date.now() - claimed.occurredAt > 48 * 3600000) {
      await row.ref.update({ status: 'skipped', reason: 'Not eligible at delivery' }); continue;
    }
    try {
      const response = await fetch(`https://www.google-analytics.com/mp/collect?measurement_id=G-RSE4NNBP64&api_secret=${encodeURIComponent(secret)}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload), signal: AbortSignal.timeout(10000) });
      // GA4's collection endpoint does not validate payloads: validate in staging before enabling.
      await row.ref.update({ status: response.ok ? 'submitted' : 'review_required', httpStatus: response.status, submittedAt: Date.now() });
    } catch (_) {
      // An ambiguous network result may already be delivered. Never automatically resend and double-count.
      await row.ref.update({ status: 'review_required', reason: 'Ambiguous delivery; inspect before retrying' });
    }
  }
});
