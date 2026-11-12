import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { hasTimedReturn, returnReminderTarget } from "./journeyLegs";

const future = "2026-11-15T19:05:00.000Z";

describe("return reminder legs", () => {
  it("reviews a completed booking with a future return and does not assume its driver", () => {
    const target = returnReminderTarget({
      status: "completed",
      bookingType: "return",
      pickupTime: "2026-10-30T17:25:00.000Z",
      driverId: "driver-a",
      returnPickupTime: future,
      returnPickupLocation: "London Heathrow Terminal 2",
      returnDestination: "10 Beech Crescent OX5 1DN",
      actualFare: 180,
    });
    assert.equal(target?.status, "needs_review");
    assert.equal(target?.driverId, "");
    assert.equal(target?.pickup, "London Heathrow Terminal 2");
    assert.equal(target?.dropoff, "10 Beech Crescent OX5 1DN");
    assert.equal(target?.pickupMs, Date.parse(future));
  });

  it("skips a return that is completed or cancelled", () => {
    assert.equal(returnReminderTarget({ status: "completed", bookingType: "return", returnPickupTime: future, returnStatus: "completed" }), null);
    assert.equal(returnReminderTarget({ status: "completed", bookingType: "return", returnPickupTime: future, returnStatus: "cancelled", outboundStatus: "completed" }), null);
  });

  it("uses the return driver when the legs have different drivers", () => {
    const target = returnReminderTarget({
      status: "allocated",
      bookingType: "return",
      driverId: "driver-a",
      returnDriverId: "driver-b",
      returnStatus: "allocated",
      returnPickupTime: future,
      returnPickupLocation: "Heathrow",
      returnDestination: "Oxford",
    });
    assert.equal(target?.status, "active");
    assert.equal(target?.driverId, "driver-b");
  });

  it("leaves one way bookings and open returns unchanged", () => {
    assert.equal(hasTimedReturn({ bookingType: "one_way", pickupTime: future }), false);
    assert.equal(returnReminderTarget({ status: "confirmed", bookingType: "one_way", pickupTime: future }), null);
    assert.equal(returnReminderTarget({ status: "confirmed", bookingType: "return", openReturn: true, returnDate: "2026-11-20" }), null);
  });
});
