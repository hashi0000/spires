"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
const node_test_1 = require("node:test");
const assert = __importStar(require("node:assert/strict"));
const driverTripLogic_1 = require("../driverTripLogic");
(0, node_test_1.test)("a return driver never receives outbound locations, tokens or the payment ledger", () => {
    const booking = { driverId: "a", returnDriverId: "b", pickupLocation: "private outbound", returnPickupLocation: "return hotel", quoteToken: "secret", paymentEntries: [{ amountPence: 500 }], actualFare: 100 };
    assert.deepEqual((0, driverTripLogic_1.assignedLegs)(booking, "b"), ["return"]);
    const visible = (0, driverTripLogic_1.driverBooking)(booking, "b", "booking");
    assert.equal(visible.pickupLocation, undefined);
    assert.equal(visible.quoteToken, undefined);
    assert.equal(visible.paymentEntries, undefined);
    assert.equal(visible.returnPickupLocation, "return hotel");
    assert.throws(() => (0, driverTripLogic_1.driverBooking)(booking, "stranger", "booking"));
});
(0, node_test_1.test)("approved Cotswolds blocks and excluded delay", () => {
    const booking = { timedHire: { startAt: "2026-11-15T10:00:00Z", includedMinutes: 240, extraRatePounds: 10, extraIntervalMinutes: 20 }, outboundCompletedAt: "2026-11-15T14:21:00Z" };
    assert.equal((0, driverTripLogic_1.tripCharge)(booking, "outbound"), 20);
    assert.equal((0, driverTripLogic_1.tripCharge)({ ...booking, outboundExcludedMinutes: 21 }, "outbound"), 0);
    assert.equal((0, driverTripLogic_1.tripCharge)({ ...booking, outboundDriverReadyAt: "2026-11-15T10:21:00Z" }, "outbound"), 0);
});
(0, node_test_1.test)("airport waiting ends at ready contact and uses the accepted legacy/current policy", () => {
    const booking = { airportCollection: true, waitingPolicyVersion: "2026-11-15", landingStatus: "actual", verifiedLandingAt: "2026-11-15T12:00:00Z", outboundDriverReadyAt: "2026-11-15T12:00:00Z", outboundPassengerReadyAt: "2026-11-15T13:16:00Z", outboundDepartedAt: "2026-11-15T14:00:00Z" };
    assert.equal((0, driverTripLogic_1.tripCharge)(booking, "outbound"), 10);
    assert.equal((0, driverTripLogic_1.tripCharge)({ ...booking, waitingPolicyVersion: undefined }, "outbound"), 10);
    assert.equal((0, driverTripLogic_1.tripCharge)({ ...booking, outboundPassengerReadyAt: "2026-11-15T13:00:00Z" }, "outbound"), 0);
});
