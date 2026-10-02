"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.heathrowRoutePricing = heathrowRoutePricing;
exports.fourPassengerFallbackEnabled = fourPassengerFallbackEnabled;
exports.resolveJourneyFarePence = resolveJourneyFarePence;
exports.cityJourneyRequiresOwnFare = cityJourneyRequiresOwnFare;
exports.fillNoticeForJourney = fillNoticeForJourney;
exports.journeyTypeLabel = journeyTypeLabel;
const terminalGuide_1 = require("./terminalGuide");
const HEATHROW_FARE_PENCE = 3500;
const HEATHROW_TARGET_REVENUE_PENCE = 17500;
function heathrowRoutePricing() {
    return {
        routeKey: "heathrow",
        farePerPassengerPence: HEATHROW_FARE_PENCE,
        minimumPassengers: 4,
        capacity: 5,
        targetRevenuePence: HEATHROW_TARGET_REVENUE_PENCE,
        fourPassengerFallbackEnabled: true,
        fallbackFarePerPassengerPence: 4375,
    };
}
function fourPassengerFallbackEnabled(journey) {
    if (journey.fourPassengerFallbackEnabled === true)
        return true;
    if (journey.fourPassengerFallbackEnabled === false)
        return false;
    return (0, terminalGuide_1.isHeathrowShare)(journey);
}
function resolveJourneyFarePence(journey, config) {
    if (Number.isFinite(Number(journey.farePence)) && Number(journey.farePence) > 0) {
        return Number(journey.farePence);
    }
    if ((0, terminalGuide_1.isHeathrowShare)(journey)) {
        return config?.pilotDefaults.farePence || HEATHROW_FARE_PENCE;
    }
    throw new Error("Set a fare per passenger for this route. This journey does not use the Heathrow fare.");
}
function cityJourneyRequiresOwnFare(farePence) {
    if (farePence == null || !Number.isFinite(Number(farePence)) || Number(farePence) <= 0) {
        throw new Error("Set a fare per passenger for this route. City and event journeys do not use the Heathrow fare.");
    }
    return Number(farePence);
}
function fillNoticeForJourney(journey) {
    if (fourPassengerFallbackEnabled(journey)) {
        return "We aim to confirm the journey with five passengers. If five passengers are not secured, Spires Taxis may offer the four passenger departure option. If the required passenger numbers are not reached, the shared journey will not operate and affected passengers will be contacted regarding their payment.";
    }
    return "The journey is confirmed when enough passengers have paid. If the required passenger numbers are not reached, the shared journey will not operate and affected passengers will be contacted regarding their payment.";
}
function journeyTypeLabel(type) {
    if (type === "AIRPORT")
        return "Airport";
    if (type === "CITY")
        return "City";
    if (type === "EVENT")
        return "Event";
    return "Other";
}
