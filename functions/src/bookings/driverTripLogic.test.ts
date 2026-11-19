import { test } from "node:test";
import * as assert from "node:assert/strict";
import { assignedLegs, driverBooking, driverPaymentSummary, tripCharge } from "../driverTripLogic";

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

test("£235 fare with £35 deposit shows £200 to collect on a one way", () => {
  const booking = {
    actualFare: 235,
    depositRequired: true,
    depositAmount: 35,
    depositStatus: "paid",
    amountReceivedPence: 3500,
    paymentEntries: [{ kind: "deposit", amountPence: 3500, mode: "add" }],
    paymentStatus: "partial",
    paymentMethod: "cash",
  };
  const summary = driverPaymentSummary(booking, "outbound");
  assert.equal(summary.kind, "collect");
  assert.equal(summary.amountToCollectPence, 20000);
  assert.match(summary.title, /£200\.00/);
});

test("fully prepaid and account jobs need no collection", () => {
  assert.equal(driverPaymentSummary({ actualFare: 90, paymentStatus: "paid", amountReceivedPence: 9000 }, "outbound").kind, "paid");
  assert.equal(driverPaymentSummary({ actualFare: 90, paymentMethod: "account", paymentStatus: "pending" }, "outbound").kind, "account");
});

test("return leg uses dueOnReturn and unknown split asks the office", () => {
  const booking = {
    bookingType: "return",
    returnTrip: true,
    actualFare: 235,
    amountReceivedPence: 3500,
    depositRequired: true,
    depositAmount: 35,
    depositStatus: "paid",
    paymentEntries: [{ kind: "deposit", amountPence: 3500, mode: "add" }],
    dueOnOutbound: 100,
    dueOnReturn: 100,
    paymentStatus: "partial",
    paymentMethod: "card",
  };
  assert.equal(driverPaymentSummary(booking, "outbound").amountToCollectPence, 10000);
  assert.equal(driverPaymentSummary(booking, "return").amountToCollectPence, 10000);
  const unknown = { ...booking, dueOnOutbound: "", dueOnReturn: "" };
  assert.equal(driverPaymentSummary(unknown, "outbound").kind, "office");
  assert.match(driverPaymentSummary(unknown, "outbound").title, /Check with the office/);
});

test("driver booking exposes payment summary for assigned legs only", () => {
  const booking = {
    driverId: "a",
    returnDriverId: "b",
    bookingType: "return",
    actualFare: 200,
    dueOnOutbound: 80,
    dueOnReturn: 120,
    amountReceivedPence: 0,
    paymentStatus: "pending",
    paymentMethod: "cash",
    pickupLocation: "Oxford",
    returnPickupLocation: "Heathrow",
  };
  const outbound = driverBooking(booking, "a", "id");
  assert.equal(outbound.outboundPaymentSummary.amountToCollectPence, 8000);
  assert.equal(outbound.returnPaymentSummary, undefined);
  const returning = driverBooking(booking, "b", "id");
  assert.equal(returning.returnPaymentSummary.amountToCollectPence, 12000);
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
