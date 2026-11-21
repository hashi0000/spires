"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const node_assert_1 = require("node:assert");
const node_test_1 = require("node:test");
const measurementContext_1 = require("./measurementContext");
const now = 1800000000000;
(0, node_test_1.test)('classifies vehicle, route and verified ads booking source', () => {
    node_assert_1.strict.equal((0, measurementContext_1.vehicleTypeParam)('8_seater'), '8_seater');
    node_assert_1.strict.equal((0, measurementContext_1.routeCategoryFromText)('/heathrow-to-oxford-8-seater', 'Heathrow T5'), 'heathrow');
    const attribution = {
        consent: 'granted',
        consentAt: now,
        capturedAt: now,
        expiresAt: now + 86400000,
        clientId: '1.2',
        gclid: 'click-1',
    };
    const context = (0, measurementContext_1.measurementContextFromBooking)({
        vehicleType: '8_seater',
        journeyType: 'return',
        websiteLandingPath: '/heathrow-to-oxford-8-seater',
        pickup: 'Heathrow Airport',
        destination: 'Oxford',
    }, attribution);
    node_assert_1.strict.equal(context.vehicle_type, '8_seater');
    node_assert_1.strict.equal(context.route_category, 'heathrow');
    node_assert_1.strict.equal(context.journey_type, 'return');
    node_assert_1.strict.equal(context.booking_source, 'verified_ads');
    node_assert_1.strict.equal((0, measurementContext_1.bookingSourceParam)(null, { heardAbout: 'google_ads' }), 'likely_ads');
});
(0, node_test_1.test)('applies only allowlisted measurement context fields', () => {
    const params = (0, measurementContext_1.applyMeasurementContext)({ event_id: 'booking_confirmed_one' }, {
        vehicle_type: '8_seater',
        route_category: 'heathrow',
        journey_type: 'one_way',
        booking_source: 'verified_ads',
        campaign_source: 'google',
        campaign_medium: 'cpc',
        campaign_name: 'heathrow_8_seater',
        landing_page: '/heathrow-to-oxford-8-seater',
    });
    node_assert_1.strict.equal(params.vehicle_type, '8_seater');
    node_assert_1.strict.equal(params.route_category, 'heathrow');
    node_assert_1.strict.equal(params.landing_page, '/heathrow-to-oxford-8-seater');
    node_assert_1.strict.equal(params.campaign_name, 'heathrow_8_seater');
    node_assert_1.strict.equal('email' in params, false);
});
