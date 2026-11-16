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
const cotswoldsPolicy_1 = require("../cotswoldsPolicy");
const driverTripLogic_1 = require("../driverTripLogic");
const input = { journeyType: 'cotswolds', hireHours: 6, hireItinerary: 'Burford and final Oxford', timedHireAccepted: true };
(0, node_test_1.test)('published rates come from the server and London summer time is converted', () => {
    const result = (0, cotswoldsPolicy_1.cotswoldsRequest)({ ...input, extraRatePounds: 0 }, '2027-06-01T10:00', 'executive', 1);
    assert.equal(result.ok, true);
    if (!result.ok)
        return;
    assert.equal(result.fields.proposedFarePounds, 350);
    assert.equal(result.fields.timedHire.startAt, '2027-06-01T09:00:00.000Z');
    assert.equal(result.fields.timedHire.extraRatePounds, 10);
    assert.equal(result.fields.timedHire.extraIntervalMinutes, 20);
});
(0, node_test_1.test)('a request needs an itinerary, acknowledgement and a single total hire', () => {
    assert.equal((0, cotswoldsPolicy_1.cotswoldsRequest)({ ...input, timedHireAccepted: false }, '2027-01-01T10:00', 'standard', 1).ok, false);
    assert.equal((0, cotswoldsPolicy_1.cotswoldsRequest)({ ...input, bookingType: 'return' }, '2027-01-01T10:00', 'standard', 1).ok, false);
    assert.equal((0, cotswoldsPolicy_1.cotswoldsRequest)({ ...input, hireHours: 2 }, '2027-01-01T10:00', 'standard', 1).ok, false);
});
(0, node_test_1.test)('accepted hire rates survive later draft edits', () => {
    const agreed = { startAt: '2026-11-15T10:00:00Z', includedMinutes: 240, extraRatePounds: 10, extraIntervalMinutes: 20 };
    const booking = { timedHire: { ...agreed, extraRatePounds: 99 }, acceptedServiceTerms: { timedHire: agreed }, outboundCompletedAt: '2026-11-15T14:20:00Z' };
    assert.equal((0, driverTripLogic_1.tripCharge)(booking, 'outbound'), 10);
    assert.equal((0, driverTripLogic_1.tripCharge)({ ...booking, outboundCompletedAt: '2026-11-15T14:20:01Z' }, 'outbound'), 20);
});
