import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readAttribution, confirmationPayload } from './attribution';
const now = 1800000000000;
const valid = { consent: 'granted', consentAt: now, capturedAt: now, expiresAt: now + 86400000, clientId: '123.456', gclid: 'valid-click_1', sessionId: String(Math.floor(now / 1000)), sessionCapturedAt: now };
test('rejects denied, missing, stale, future and malformed attribution', () => {
  for (const value of [null, {}, {...valid, consent:'denied'}, {...valid, expiresAt:now}, {...valid, capturedAt:now+120000}, {...valid, consentAt:0}, {...valid, clientId:'name@example.com', gclid:'email@example.com'}]) assert.equal(readAttribution(value, now), null);
});
test('only validated advertising identifiers survive the allowlist', () => {
  const result = readAttribution({...valid, email:'private@example.com', pickup:'Home address', url:'https://example.com/?token=secret'}, now)!;
  assert.equal(result.gclid, 'valid-click_1');
  assert.equal('email' in result, false); assert.equal('pickup' in result, false); assert.equal('url' in result, false);
});
test('confirmed payload has no invented monetary value or customer data', () => {
  const payload = confirmationPayload('booking123', valid as any, now)!;
  assert.equal(payload.events[0].name, 'booking_confirmed');
  assert.equal(payload.events[0].params.session_id, valid.sessionId);
  assert.equal('value' in payload.events[0].params, false);
  assert.equal(payload.client_id, '123.456');
});
test('does not pretend a late booking confirmation belongs to an old session', () => {
  const payload = confirmationPayload('booking123', {...valid, expiresAt:now+5*86400000} as any, now+2*86400000)!;
  assert.equal('session_id' in payload.events[0].params, false);
  assert.equal(confirmationPayload('booking123', valid as any, now+2*86400000), null);
});
