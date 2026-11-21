import { strict as assert } from 'node:assert';
import { test } from 'node:test';
import {
  applyMeasurementContext,
  bookingSourceParam,
  measurementContextFromBooking,
  routeCategoryFromText,
  vehicleTypeParam,
} from './measurementContext';

const now = 1800000000000;

test('classifies vehicle, route and verified ads booking source', () => {
  assert.equal(vehicleTypeParam('8_seater'), '8_seater');
  assert.equal(routeCategoryFromText('/heathrow-to-oxford-8-seater', 'Heathrow T5'), 'heathrow');
  const attribution = {
    consent: 'granted' as const,
    consentAt: now,
    capturedAt: now,
    expiresAt: now + 86400000,
    clientId: '1.2',
    gclid: 'click-1',
  };
  const context = measurementContextFromBooking(
    {
      vehicleType: '8_seater',
      journeyType: 'return',
      websiteLandingPath: '/heathrow-to-oxford-8-seater',
      pickup: 'Heathrow Airport',
      destination: 'Oxford',
    },
    attribution,
  );
  assert.equal(context.vehicle_type, '8_seater');
  assert.equal(context.route_category, 'heathrow');
  assert.equal(context.journey_type, 'return');
  assert.equal(context.booking_source, 'verified_ads');
  assert.equal(bookingSourceParam(null, { heardAbout: 'google_ads' }), 'likely_ads');
});

test('applies only allowlisted measurement context fields', () => {
  const params = applyMeasurementContext(
    { event_id: 'booking_confirmed_one' },
    {
      vehicle_type: '8_seater',
      route_category: 'heathrow',
      journey_type: 'one_way',
      booking_source: 'verified_ads',
      campaign_source: 'google',
      campaign_medium: 'cpc',
      campaign_name: 'heathrow_8_seater',
      landing_page: '/heathrow-to-oxford-8-seater',
    },
  );
  assert.equal(params.vehicle_type, '8_seater');
  assert.equal(params.route_category, 'heathrow');
  assert.equal(params.landing_page, '/heathrow-to-oxford-8-seater');
  assert.equal(params.campaign_name, 'heathrow_8_seater');
  assert.equal('email' in params, false);
});
