import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import { readAttribution, confirmationPayload } from './attribution';
const now = 1800000000000;
const valid = { consent: 'granted', consentAt: now, capturedAt: now, expiresAt: now + 86400000, clientId: '123.456', gclid: 'valid-click_1', sessionId: String(Math.floor(now / 1000)), sessionCapturedAt: now };
test('delivery crossing the 24 hour boundary keeps the event time but omits old session attribution', () => {
  const at = now + 23 * 3600000;
  const payload = confirmationPayload('one', {...valid, expiresAt:now+3*86400000} as any, at, now+25*3600000)!;
  assert.equal(payload.timestamp_micros,at*1000);
  assert.equal('session_id' in payload.events[0].params,false);
  assert.equal(readAttribution({...valid,consentGrantedAt:now-10*86400000},now)?.consentGrantedAt,now-10*86400000);
});
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

test('confirmed payload can include non-PII vehicle and campaign context', () => {
  const payload = confirmationPayload('booking123', valid as any, now, now, {
    vehicle_type: '8_seater',
    route_category: 'heathrow',
    journey_type: 'return',
    booking_source: 'verified_ads',
    campaign_source: 'google',
    campaign_medium: 'cpc',
    landing_page: '/heathrow-to-oxford-8-seater',
  })!;
  assert.equal(payload.events[0].params.vehicle_type, '8_seater');
  assert.equal(payload.events[0].params.route_category, 'heathrow');
  assert.equal(payload.events[0].params.booking_source, 'verified_ads');
  assert.equal(payload.events[0].params.landing_page, '/heathrow-to-oxford-8-seater');
  assert.equal(JSON.stringify(payload).includes('@'), false);
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

test('keeps the most recent paid click across a referral and a saved-record read', () => {
  const result = readAttribution({
    ...valid,
    first: { capturedAt: now - 1000, gclid: 'older-click' },
    latest: { capturedAt: now, referrerHost: 'example.org' },
    paidClick: { capturedAt: now, wbraid: 'newer-click', utmCampaign: 'private@example.com' },
  }, now)!;
  assert.equal(result.wbraid, 'newer-click');
  assert.equal(result.gclid, undefined);
  assert.equal(result.paidClick?.utmCampaign, undefined);
  assert.deepEqual(readAttribution(result, now), result);
});
