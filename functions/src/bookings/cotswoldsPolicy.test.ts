import { test } from 'node:test';
import * as assert from 'node:assert/strict';
import { cotswoldsRequest } from '../cotswoldsPolicy';
import { tripCharge } from '../driverTripLogic';
const input = { journeyType: 'cotswolds', hireHours: 6, hireItinerary: 'Burford and final Oxford', timedHireAccepted: true };
test('published rates come from the server and London summer time is converted', () => {
 const result = cotswoldsRequest({...input, extraRatePounds: 0}, '2027-06-01T10:00', 'executive', 1);
 assert.equal(result.ok, true); if (!result.ok) return;
 assert.equal(result.fields.proposedFarePounds, 350);
 assert.equal((result.fields.timedHire as any).startAt, '2027-06-01T09:00:00.000Z');
 assert.equal((result.fields.timedHire as any).extraRatePounds, 10);
 assert.equal((result.fields.timedHire as any).extraIntervalMinutes, 20);
});
test('a request needs an itinerary, acknowledgement and a single total hire', () => {
 assert.equal(cotswoldsRequest({...input, timedHireAccepted:false}, '2027-01-01T10:00', 'standard', 1).ok, false);
 assert.equal(cotswoldsRequest({...input, bookingType:'return'}, '2027-01-01T10:00', 'standard', 1).ok, false);
 assert.equal(cotswoldsRequest({...input, hireHours:2}, '2027-01-01T10:00', 'standard', 1).ok, false);
});
test('accepted hire rates survive later draft edits', () => {
 const agreed = {startAt:'2026-11-15T10:00:00Z', includedMinutes:240, extraRatePounds:10, extraIntervalMinutes:20};
 const booking = {timedHire:{...agreed,extraRatePounds:99}, acceptedServiceTerms:{timedHire:agreed},outboundCompletedAt:'2026-11-15T14:20:00Z'};
 assert.equal(tripCharge(booking,'outbound'),10);
 assert.equal(tripCharge({...booking,outboundCompletedAt:'2026-11-15T14:20:01Z'},'outbound'),20);
});
