"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.COTSWOLDS_POLICY = void 0;
exports.cotswoldsRequest = cotswoldsRequest;
const servicePolicy_json_1 = __importDefault(require("./servicePolicy.json"));
const bookingTerms_1 = require("./terms/bookingTerms");
exports.COTSWOLDS_POLICY = servicePolicy_json_1.default.cotswolds;
function cotswoldsRequest(input, startAt, vehicle, now) {
    if (input.journeyType !== "cotswolds")
        return { ok: true, fields: {} };
    if (input.bookingType === 'return')
        return { ok: false, error: "A Cotswolds hire is one timed itinerary. Include the return to Oxford in the itinerary and final drop off, rather than a separate return leg." };
    const hours = Number(input.hireHours);
    const index = exports.COTSWOLDS_POLICY.durationsHours.indexOf(hours);
    if (index < 0)
        return { ok: false, error: "Choose four, six or eight hours for your Cotswolds trip." };
    const itinerary = String(input.hireItinerary || "").trim().slice(0, 2000);
    if (!itinerary)
        return { ok: false, error: "Tell us the places you would like to visit and your final drop off." };
    if (input.timedHireAccepted !== true && input.timedHireAccepted !== "yes")
        return { ok: false, error: "Please acknowledge the total hire duration and additional time charges." };
    const prices = exports.COTSWOLDS_POLICY.prices[vehicle];
    if (!prices)
        return { ok: false, error: "Choose a valid vehicle." };
    const start = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startAt) ? (0, bookingTerms_1.londonWallTimeToUtcMs)(startAt) : Date.parse(startAt);
    if (start == null || !Number.isFinite(start))
        return { ok: false, error: "Enter a valid pickup time." };
    return { ok: true, fields: { journeyType: "cotswolds", proposedFarePounds: prices[index], timedHire: {
                policyVersion: servicePolicy_json_1.default.version, startAt: new Date(start).toISOString(), includedMinutes: hours * 60, itinerary,
                extraRatePounds: exports.COTSWOLDS_POLICY.extraRatePounds, extraIntervalMinutes: exports.COTSWOLDS_POLICY.extraIntervalMinutes,
                acceptedAt: new Date(now).toISOString(),
            } } };
}
