"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const attribution_1 = require("./attribution");
const now = 1800000000000;
const valid = { consent: 'granted', consentAt: now, capturedAt: now, expiresAt: now + 86400000, clientId: '123.456', gclid: 'valid-click_1', sessionId: String(Math.floor(now / 1000)), sessionCapturedAt: now };
(0, node_test_1.test)('rejects denied, missing, stale, future and malformed attribution', () => {
    for (const value of [null, {}, { ...valid, consent: 'denied' }, { ...valid, expiresAt: now }, { ...valid, capturedAt: now + 120000 }, { ...valid, consentAt: 0 }, { ...valid, clientId: 'name@example.com', gclid: 'email@example.com' }])
        node_assert_1.strict.equal((0, attribution_1.readAttribution)(value, now), null);
});
(0, node_test_1.test)('only validated advertising identifiers survive the allowlist', () => {
    const result = (0, attribution_1.readAttribution)({ ...valid, email: 'private@example.com', pickup: 'Home address', url: 'https://example.com/?token=secret' }, now);
    node_assert_1.strict.equal(result.gclid, 'valid-click_1');
    node_assert_1.strict.equal('email' in result, false);
    node_assert_1.strict.equal('pickup' in result, false);
    node_assert_1.strict.equal('url' in result, false);
});
(0, node_test_1.test)('confirmed payload has no invented monetary value or customer data', () => {
    const payload = (0, attribution_1.confirmationPayload)('booking123', valid, now);
    node_assert_1.strict.equal(payload.events[0].name, 'booking_confirmed');
    node_assert_1.strict.equal(payload.events[0].params.session_id, Number(valid.sessionId));
    node_assert_1.strict.equal('value' in payload.events[0].params, false);
    node_assert_1.strict.equal(payload.client_id, '123.456');
});
(0, node_test_1.test)('does not pretend a late booking confirmation belongs to an old session', () => {
    const payload = (0, attribution_1.confirmationPayload)('booking123', { ...valid, expiresAt: now + 5 * 86400000 }, now + 2 * 86400000);
    node_assert_1.strict.equal('session_id' in payload.events[0].params, false);
    node_assert_1.strict.equal((0, attribution_1.confirmationPayload)('booking123', valid, now + 2 * 86400000), null);
});
(0, node_test_1.test)('keeps the first click when a later visit has no campaign and rejects personal campaign text', () => {
    const result = (0, attribution_1.readAttribution)({
        ...valid,
        gclid: undefined,
        first: { capturedAt: now, gclid: 'first-click', landingPath: '/oxford-to-heathrow' },
        latest: { capturedAt: now, landingPath: '/oxford-to-heathrow', utmSource: 'private@example.com', utmCampaign: '07776897772' },
    }, now);
    node_assert_1.strict.equal(result.gclid, 'first-click');
    node_assert_1.strict.equal(result.latest, undefined);
    node_assert_1.strict.equal(JSON.stringify(result).includes('private@'), false);
    node_assert_1.strict.equal(JSON.stringify(result).includes('07776'), false);
    const dirty = (0, attribution_1.readAttribution)({
        ...valid,
        latest: { capturedAt: now, utmSource: 'newsletter', landingPath: '/claim/person@example.com', referrerHost: 'customer.spires-taxis.com' },
    }, now);
    node_assert_1.strict.equal(dirty.gclid, 'valid-click_1');
    node_assert_1.strict.equal(dirty.latest && dirty.latest.utmSource, 'newsletter');
    node_assert_1.strict.equal(dirty.latest && dirty.latest.landingPath, undefined);
    node_assert_1.strict.equal(dirty.latest && dirty.latest.referrerHost, undefined);
});
