import { test } from "node:test";
import * as assert from "node:assert/strict";
import { assignedLegs, driverBooking, tripCharge } from "../driverTripLogic";

test("a return driver never receives outbound locations, tokens or the payment ledger", () => {
  const booking = { driverId: "a", returnDriverId: "b", pickupLocation: "private outbound", returnPickupLocation: "return hotel", quoteToken: "secret", paymentEntries: [{ amountPence: 500 }], actualFare: 100 };
  assert.deepEqual(assignedLegs(booking, "b"), ["return"]);
  const visible = driverBooking(booking, "b", "booking");
  assert.equal(visible.pickupLocation, undefined);
  assert.equal(visible.quoteToken, undefined);
  assert.equal(visible.paymentEntries, undefined);
  assert.equal(visible.returnPickupLocation, "return hotel");
  assert.throws(() => driverBooking(booking, "stranger", "booking"));
});

test("approved Cotswolds blocks and excluded delay", () => {
  const booking = { timedHire: { startAt: "2026-11-15T10:00:00Z", includedMinutes: 240, extraRatePounds: 10, extraIntervalMinutes: 20 }, outboundCompletedAt: "2026-11-15T14:21:00Z" };
  assert.equal(tripCharge(booking, "outbound"), 20);
  assert.equal(tripCharge({ ...booking, outboundExcludedMinutes: 21 }, "outbound"), 0);
  assert.equal(tripCharge({ ...booking, outboundDriverReadyAt: "2026-11-15T10:21:00Z" }, "outbound"), 0);
});

test("airport waiting ends at ready contact and uses the accepted legacy/current policy", () => {
  const booking = { airportCollection: true, waitingPolicyVersion: "2026-11-15", landingStatus: "actual", verifiedLandingAt: "2026-11-15T12:00:00Z", outboundDriverReadyAt: "2026-11-15T12:00:00Z", outboundPassengerReadyAt: "2026-11-15T13:16:00Z", outboundDepartedAt: "2026-11-15T14:00:00Z" };
  assert.equal(tripCharge(booking, "outbound"), 10);
  assert.equal(tripCharge({ ...booking, waitingPolicyVersion: undefined }, "outbound"), 10);
  assert.equal(tripCharge({ ...booking, outboundPassengerReadyAt: "2026-11-15T13:00:00Z" }, "outbound"), 0);
});
