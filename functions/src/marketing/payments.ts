import { paymentPosition } from '../quotes/fareMath';
import { MEASUREMENT_MAX_AGE_MS, SESSION_JOIN_MS, type Attribution } from './attribution';

export type PaymentMethod = 'card' | 'cash' | 'bank';
export type PaymentKind = 'deposit' | 'balance' | 'full';

export type PaymentMeasurement = {
  direction: 'purchase' | 'refund';
  deltaPence: number;
  entryId: string;
  kind: PaymentKind;
  method?: PaymentMethod;
  farePence: number;
  receivedAfterPence: number;
};

type BookingRow = Record<string, unknown>;

export function farePence(booking: BookingRow): number {
  const quote = booking.issuedQuote && typeof booking.issuedQuote === 'object' ? booking.issuedQuote as Record<string, unknown> : null;
  if (quote && Number.isFinite(Number(quote.finalFarePence))) return Math.round(Number(quote.finalFarePence));
  const fare = Number(booking.actualFare);
  return Number.isFinite(fare) ? Math.round(fare * 100) : 0;
}

export function paymentMethod(value: unknown): PaymentMethod | undefined {
  const text = String(value || '').toLowerCase();
  if (text.includes('card') || text === 'stripe') return 'card';
  if (text.includes('cash')) return 'cash';
  if (text.includes('bank') || text.includes('transfer')) return 'bank';
  return undefined;
}

function entryId(entry: Record<string, unknown>, receivedAfter: number): string {
  const raw = String(entry.stripePaymentIntentId || entry.clientRequestId || entry.at || `received_${receivedAfter}`);
  const clean = raw.replace(/[^A-Za-z0-9_-]/g, '').slice(0, 64);
  return clean || `received_${receivedAfter}`;
}

/**
 * The Google value is only the money newly recorded or newly removed.
 * A later balance payment does not send the full fare again.
 */
export function paymentChange(before: BookingRow, after: BookingRow): PaymentMeasurement | null {
  const previous = Math.max(0, Math.round(Number(before.amountReceivedPence) || 0));
  const received = Math.max(0, Math.round(Number(after.amountReceivedPence) || 0));
  const delta = received - previous;
  if (delta === 0) return null;
  const fare = farePence(after);
  const entries = Array.isArray(after.paymentEntries) ? after.paymentEntries : [];
  const entry = entries.length && entries[entries.length - 1] && typeof entries[entries.length - 1] === 'object'
    ? entries[entries.length - 1] as Record<string, unknown>
    : {};
  const kind: PaymentKind = delta > 0 && previous === 0 && fare > 0 && delta >= fare
    ? 'full'
    : delta > 0 && previous === 0
      ? 'deposit'
      : 'balance';
  return {
    direction: delta > 0 ? 'purchase' : 'refund',
    deltaPence: Math.abs(delta),
    entryId: entryId(entry, received),
    kind: delta > 0 ? kind : 'balance',
    method: paymentMethod(entry.method || after.paymentMethod),
    farePence: fare,
    receivedAfterPence: received,
  };
}

export function paymentPayload(bookingId: string, attribution: Attribution, change: PaymentMeasurement, at: number, sentAt = at) {
  if (!attribution.clientId || attribution.expiresAt <= at) return null;
  if (change.deltaPence <= 0 || change.deltaPence > 1_000_000_00) return null;
  const transactionId = `${change.direction === 'purchase' ? 'pay' : 'refund'}_${bookingId}_${change.entryId}`.slice(0, 100);
  const params: Record<string, unknown> = {
    transaction_id: transactionId,
    value: change.deltaPence / 100,
    currency: 'GBP',
    payment_kind: change.kind,
    event_id: `${change.direction}_${bookingId}_${change.entryId}`.slice(0, 100),
    engagement_time_msec: 1,
  };
  if (change.method) params.payment_method = change.method;
  if (attribution.sessionId && attribution.sessionCapturedAt && at >= attribution.sessionCapturedAt && sentAt - attribution.sessionCapturedAt < SESSION_JOIN_MS) {
    params.session_id = Number(attribution.sessionId);
  }
  return {
    client_id: attribution.clientId,
    timestamp_micros: at * 1000,
    consent: { ad_user_data: 'GRANTED' as const, ad_personalization: 'DENIED' as const },
    events: [{ name: change.direction, params }],
  };
}

export function cardReceiptPatch(booking: BookingRow, input: { paymentIntentId: string; amountPence: number; chargeId?: string }, atIso: string): Record<string, unknown> | null {
  if (!/^pi_[A-Za-z0-9]+$/.test(input.paymentIntentId)) return null;
  if (!Number.isInteger(input.amountPence) || input.amountPence <= 0) return null;
  const entries = Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [];
  if (entries.some((entry) => entry && typeof entry === 'object' && (entry as Record<string, unknown>).stripePaymentIntentId === input.paymentIntentId)) return null;
  if (String(booking.stripePaymentIntentId || '') === input.paymentIntentId && Math.round(Number(booking.amountReceivedPence) || 0) > 0) return null;
  const previous = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  const received = previous + input.amountPence;
  const fare = farePence(booking);
  const position = paymentPosition(fare, received, '');
  return {
    amountReceivedPence: received,
    outstandingPence: position.outstandingPence,
    overpaymentPence: position.overpaymentPence,
    paymentStatus: position.stored,
    paymentMethod: 'card',
    paymentVerified: fare > 0 && received >= fare,
    stripePaymentIntentId: input.paymentIntentId,
    stripeChargeId: input.chargeId || '',
    paymentEntries: [...entries, {
      stripePaymentIntentId: input.paymentIntentId,
      clientRequestId: input.paymentIntentId,
      mode: 'add',
      amountPence: input.amountPence,
      method: 'card',
      at: atIso,
    }].slice(-50),
  };
}

export type DeliveryOutcome = {
  status: 'pending' | 'submitted' | 'review_required' | 'invalid' | 'skipped';
  reason: string;
  validation: 'passed' | 'failed' | 'not_run';
  transport: 'submitted' | 'failed' | 'not_sent';
  ga4Receipt: 'not_confirmed';
  adsAttribution: 'not_confirmed';
};

export function interpretValidation(body: unknown): { ok: boolean; reason: string } {
  if (!body || typeof body !== 'object' || !Array.isArray((body as { validationMessages?: unknown }).validationMessages)) {
    return { ok: false, reason: 'Validation response was not understood' };
  }
  const messages = (body as { validationMessages: Array<Record<string, unknown>> }).validationMessages;
  if (!messages.length) return { ok: true, reason: '' };
  const text = messages.map((message) => String(message.validationCode || 'invalid')).join('; ').slice(0, 240);
  return { ok: false, reason: text.replace(/[A-Za-z0-9+/_=-]{24,}/g, '[redacted]') };
}

/** A collection response is transport only. Validation must already have passed, and nothing here proves a GA4 report. */
export function deliveryOutcome(input: { validationOk: boolean; validationReason?: string; httpStatus?: number; thrown: boolean; attempts: number; eligible: boolean; eligibilityReason?: string }): DeliveryOutcome {
  const base = { ga4Receipt: 'not_confirmed' as const, adsAttribution: 'not_confirmed' as const };
  if (!input.eligible) return { ...base, status: 'skipped', reason: input.eligibilityReason || 'Not eligible at delivery', validation: 'not_run', transport: 'not_sent' };
  if (!input.validationOk) return { ...base, status: 'invalid', reason: input.validationReason || 'Payload failed validation', validation: 'failed', transport: 'not_sent' };
  if (input.thrown) return { ...base, status: 'review_required', reason: 'Ambiguous delivery. Inspect before retrying', validation: 'passed', transport: 'not_sent' };
  if (input.httpStatus && input.httpStatus >= 200 && input.httpStatus < 300) {
    return { ...base, status: 'submitted', reason: 'Collection endpoint accepted the request. GA4 reporting is not confirmed.', validation: 'passed', transport: 'submitted' };
  }
  if ((input.httpStatus === 429 || (input.httpStatus || 0) >= 500) && input.attempts < 3) {
    return { ...base, status: 'review_required', reason: 'Collection returned an error. Receipt is unknown; inspect before replaying.', validation: 'passed', transport: 'failed' };
  }
  return { ...base, status: 'review_required', reason: 'Transport failed', validation: 'passed', transport: 'failed' };
}

export function eligibleToSend(input: { consent: unknown; occurredAt: number; now: number; hasPayload: boolean; confirmed?: boolean; event: string }): { ok: boolean; reason: string } {
  if (input.consent !== 'granted') return { ok: false, reason: 'Consent was not granted' };
  if (!input.hasPayload) return { ok: false, reason: 'No safe payload' };
  if (input.now - input.occurredAt > MEASUREMENT_MAX_AGE_MS) return { ok: false, reason: 'Older than 72 hours' };
  if (input.event === 'booking_confirmed' && input.confirmed === false) return { ok: false, reason: 'Booking is no longer confirmed' };
  return { ok: true, reason: '' };
}
