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
  assert.equal(payload.events[0].params.session_id, Number(valid.sessionId));
  assert.equal('value' in payload.events[0].params, false);
  assert.equal(payload.client_id, '123.456');
});
test('does not pretend a late booking confirmation belongs to an old session', () => {
  const payload = confirmationPayload('booking123', {...valid, expiresAt:now+5*86400000} as any, now+2*86400000)!;
  assert.equal('session_id' in payload.events[0].params, false);
  assert.equal(confirmationPayload('booking123', valid as any, now+2*86400000), null);
});
test('keeps the first click when a later visit has no campaign and rejects personal campaign text', () => {
  const result = readAttribution({
    ...valid,
    gclid: undefined,
    first: { capturedAt: now, gclid: 'first-click', landingPath: '/oxford-to-heathrow' },
    latest: { capturedAt: now, landingPath: '/oxford-to-heathrow', utmSource: 'private@example.com', utmCampaign: '07776897772' },
  }, now)!;
  assert.equal(result.gclid, 'first-click');
  assert.equal(result.latest, undefined);
  assert.equal(JSON.stringify(result).includes('private@'), false);
  assert.equal(JSON.stringify(result).includes('07776'), false);
  const dirty = readAttribution({
    ...valid,
    latest: { capturedAt: now, utmSource: 'newsletter', landingPath: '/claim/person@example.com', referrerHost: 'customer.spires-taxis.com' },
  }, now)!;
  assert.equal(dirty.gclid, 'valid-click_1');
  assert.equal(dirty.latest && dirty.latest.utmSource, 'newsletter');
  assert.equal(dirty.latest && dirty.latest.landingPath, undefined);
  assert.equal(dirty.latest && dirty.latest.referrerHost, undefined);
});
