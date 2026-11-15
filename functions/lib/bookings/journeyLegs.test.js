"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const journeyLegs_1 = require("./journeyLegs");
const future = "2026-11-15T19:05:00.000Z";
(0, node_test_1.describe)("return reminder legs", () => {
    (0, node_test_1.it)("reviews a completed booking with a future return and does not assume its driver", () => {
        const target = (0, journeyLegs_1.returnReminderTarget)({
            status: "completed",
            bookingType: "return",
            pickupTime: "2026-10-30T17:25:00.000Z",
            driverId: "driver-a",
            returnPickupTime: future,
            returnPickupLocation: "London Heathrow Terminal 2",
            returnDestination: "10 Beech Crescent OX5 1DN",
            actualFare: 180,
        });
        strict_1.default.equal(target?.status, "needs_review");
        strict_1.default.equal(target?.driverId, "");
        strict_1.default.equal(target?.pickup, "London Heathrow Terminal 2");
        strict_1.default.equal(target?.dropoff, "10 Beech Crescent OX5 1DN");
        strict_1.default.equal(target?.pickupMs, Date.parse(future));
    });
    (0, node_test_1.it)("skips a return that is completed or cancelled", () => {
        strict_1.default.equal((0, journeyLegs_1.returnReminderTarget)({ status: "completed", bookingType: "return", returnPickupTime: future, returnStatus: "completed" }), null);
        strict_1.default.equal((0, journeyLegs_1.returnReminderTarget)({ status: "completed", bookingType: "return", returnPickupTime: future, returnStatus: "cancelled", outboundStatus: "completed" }), null);
    });
    (0, node_test_1.it)("uses the return driver when the legs have different drivers", () => {
        const target = (0, journeyLegs_1.returnReminderTarget)({
            status: "allocated",
            bookingType: "return",
            driverId: "driver-a",
            returnDriverId: "driver-b",
            returnStatus: "allocated",
            returnPickupTime: future,
            returnPickupLocation: "Heathrow",
            returnDestination: "Oxford",
        });
        strict_1.default.equal(target?.status, "active");
        strict_1.default.equal(target?.driverId, "driver-b");
    });
    (0, node_test_1.it)("leaves one way bookings and open returns unchanged", () => {
        strict_1.default.equal((0, journeyLegs_1.hasTimedReturn)({ bookingType: "one_way", pickupTime: future }), false);
        strict_1.default.equal((0, journeyLegs_1.returnReminderTarget)({ status: "confirmed", bookingType: "one_way", pickupTime: future }), null);
        strict_1.default.equal((0, journeyLegs_1.returnReminderTarget)({ status: "confirmed", bookingType: "return", openReturn: true, returnDate: "2026-11-20" }), null);
    });
});
