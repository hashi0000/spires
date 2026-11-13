import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { cardReceiptPatch, deliveryOutcome, eligibleToSend, interpretValidation, paymentChange, paymentPayload } from './payments';

const now = 1800000000000;
const attribution = { consent: 'granted' as const, consentAt: now, capturedAt: now, expiresAt: now + 86400000, clientId: '123.456', sessionId: '1800000000', sessionCapturedAt: now };

test('a deposit and a later balance are separate amounts', () => {
  const deposit = paymentChange({}, { actualFare: 92, amountReceivedPence: 2000, paymentMethod: 'card', paymentEntries: [{ clientRequestId: 'dep', amountPence: 2000, method: 'card' }] });
  const balance = paymentChange(
    { amountReceivedPence: 2000 },
    { actualFare: 92, amountReceivedPence: 9200, paymentMethod: 'bank transfer', paymentEntries: [{ clientRequestId: 'dep' }, { clientRequestId: 'bal', amountPence: 7200, method: 'bank transfer' }] }
  );
  assert.equal(deposit && deposit.direction, 'purchase');
  assert.equal(deposit && deposit.kind, 'deposit');
  assert.equal(deposit && deposit.deltaPence, 2000);
  assert.equal(balance && balance.kind, 'balance');
  assert.equal(balance && balance.deltaPence, 7200);
  assert.equal(balance && balance.method, 'bank');
  const payload = paymentPayload('booking1', attribution, deposit!, now)!;
  assert.equal(payload.events[0].name, 'purchase');
  assert.equal(payload.events[0].params.value, 20);
  assert.equal(payload.events[0].params.currency, 'GBP');
  assert.equal(payload.events[0].params.transaction_id, 'pay_booking1_dep');
  assert.equal(JSON.stringify(payload).includes('Heathrow'), false);
});

test('a reduced total is a refund and a repeated card receipt is ignored', () => {
  const refund = paymentChange({ amountReceivedPence: 9200 }, { amountReceivedPence: 7200, paymentMethod: 'cash', paymentEntries: [{ clientRequestId: 'fix', method: 'cash', at: '2026-11-11T12:00:00Z' }] });
  assert.equal(refund && refund.direction, 'refund');
  assert.equal(refund && refund.deltaPence, 2000);
  const booking = { actualFare: 92, amountReceivedPence: 0, paymentEntries: [] as unknown[] };
  const first = cardReceiptPatch(booking, { paymentIntentId: 'pi_abc123', amountPence: 2000 }, '2026-11-11T12:00:00Z');
  assert.equal(first && first.paymentStatus, 'partial');
  assert.equal(first && first.amountReceivedPence, 2000);
  const second = cardReceiptPatch({ ...booking, ...first }, { paymentIntentId: 'pi_abc123', amountPence: 2000 }, '2026-11-11T12:05:00Z');
  assert.equal(second, null);
  const rest = cardReceiptPatch({ ...booking, ...first }, { paymentIntentId: 'pi_balance1', amountPence: 7200 }, '2026-11-11T13:00:00Z');
  assert.equal(rest && rest.amountReceivedPence, 9200);
  const replay = cardReceiptPatch({ actualFare: 92, amountReceivedPence: 9200, stripePaymentIntentId: 'pi_oldpaid1', paymentEntries: [] }, { paymentIntentId: 'pi_oldpaid1', amountPence: 9200 }, '2026-11-11T14:00:00Z');
  assert.equal(replay, null);
});

test('validation must pass before transport, and transport is not a GA4 receipt', () => {
  assert.equal(interpretValidation({ validationMessages: [] }).ok, true);
  assert.equal(interpretValidation({ validationMessages: [{ validationCode: 'VALUE_INVALID' }] }).ok, false);
  const sent = deliveryOutcome({ validationOk: true, httpStatus: 204, thrown: false, attempts: 1, eligible: true });
  assert.equal(sent.status, 'submitted');
  assert.equal(sent.ga4Receipt, 'not_confirmed');
  assert.equal(sent.adsAttribution, 'not_confirmed');
  const retry = deliveryOutcome({ validationOk: true, httpStatus: 503, thrown: false, attempts: 1, eligible: true });
  assert.equal(retry.status, 'review_required');
  const ambiguous = deliveryOutcome({ validationOk: true, thrown: true, attempts: 1, eligible: true });
  assert.equal(ambiguous.status, 'review_required');
  const old = eligibleToSend({ consent: 'granted', occurredAt: now - 73 * 3600000, now, hasPayload: true, event: 'booking_confirmed', confirmed: true });
  assert.equal(old.ok, false);
  const revoked = eligibleToSend({ consent: 'denied', occurredAt: now, now, hasPayload: true, event: 'purchase' });
  assert.equal(revoked.ok, false);
});
