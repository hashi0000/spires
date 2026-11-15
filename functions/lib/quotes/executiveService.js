"use strict";
/**
 * Executive Heathrow transfers.
 *
 * EXECUTIVE_SERVICE_ENABLED is the single launch switch. Keep it false until
 * supplier availability, these rates, and the inclusions below are confirmed.
 *
 * LAUNCH BLOCKER: partner terms must cover these existing airport inclusions
 * before the flag is turned on:
 * - the standard airport pickup or drop-off charge, included in the published fare
 * - flight monitoring for airport collections
 * - 50 minutes waiting from the actual landing time, then £10 per additional
 *   30 minutes or part thereof
 *
 * Do not describe Executive as available for immediate dispatch.
 * Fares match spires-website/js/airport-prices.js. Do not keep a second price list.
 */
Object.defineProperty(exports, "__esModule", { value: true });
exports.EXECUTIVE_AREAS = exports.EXECUTIVE_PASSENGER_LIMIT = exports.EXECUTIVE_PASSENGER_MESSAGE = exports.EXECUTIVE_HEATHROW_ONLY_MESSAGE = exports.EXECUTIVE_NOT_OPEN_MESSAGE = exports.EXECUTIVE_COMMERCE_MESSAGE = exports.EXECUTIVE_CUSTOMER_WORDING = exports.EXECUTIVE_SERVICE_ENABLED = void 0;
exports.executiveServiceEnabled = executiveServiceEnabled;
exports.isExecutiveVehicle = isExecutiveVehicle;
exports.executiveCommerceBlocked = executiveCommerceBlocked;
exports.executiveJourneyText = executiveJourneyText;
exports.classifyExecutiveJourney = classifyExecutiveJourney;
exports.proposedExecutiveFare = proposedExecutiveFare;
exports.assessExecutiveBooking = assessExecutiveBooking;
exports.EXECUTIVE_SERVICE_ENABLED = false;
exports.EXECUTIVE_CUSTOMER_WORDING = "Executive Heathrow transfers. Advance booking required. Subject to availability and booking confirmation.";
exports.EXECUTIVE_COMMERCE_MESSAGE = "This Executive Heathrow request is awaiting availability confirmation. Accept the request before sending a quote, taking payment, or confirming the booking.";
exports.EXECUTIVE_NOT_OPEN_MESSAGE = "Executive Car is not open for booking yet.";
exports.EXECUTIVE_HEATHROW_ONLY_MESSAGE = "Executive Car is only available for Heathrow transfers.";
exports.EXECUTIVE_PASSENGER_MESSAGE = "Enter the number of passengers travelling, from 1 to 8. We confirm that an Executive Car is suitable before we accept the booking.";
/** Form limit only. It is not a published seat or luggage capacity. */
exports.EXECUTIVE_PASSENGER_LIMIT = 8;
exports.EXECUTIVE_AREAS = {
    oxford: { oneWay: 150, return: 290 },
    abingdon: { oneWay: 165, return: 320 },
    didcot: { oneWay: 170, return: 330 },
    bicester: { oneWay: 170, return: 330 },
    witney: { oneWay: 170, return: 330 },
};
const OTHER_AIRPORT = /\b(gatwick|stansted|luton|birmingham airport|bristol airport|london city(?: airport)?|east midlands|london oxford airport|lgw|stn|ltn|bhx|brs|lcy|ema)\b/i;
const HEATHROW = /\b(heathrow|lhr)\b/i;
const SPECIFIC_AREAS = [
    { id: "abingdon", pattern: /\babingdon\b/i },
    { id: "didcot", pattern: /\bdidcot\b/i },
    { id: "bicester", pattern: /\bbicester\b/i },
    { id: "witney", pattern: /\bwitney\b/i },
];
function executiveServiceEnabled(override) {
    if (typeof override === "boolean")
        return override;
    return exports.EXECUTIVE_SERVICE_ENABLED || process.env.EXECUTIVE_SERVICE_ENABLED === "true";
}
function isExecutiveVehicle(type) {
    return String(type || "").trim().toLowerCase() === "executive";
}
function executiveCommerceBlocked(booking) {
    return isExecutiveVehicle(booking.vehicleType) && booking.executiveAvailability !== "accepted";
}
function stopText(stop) {
    if (!stop)
        return "";
    if (typeof stop === "string")
        return stop;
    return String(stop.address || "");
}
function executiveJourneyText(input) {
    return [
        input.pickup,
        input.destination,
        input.returnPickup,
        input.returnDestination,
        ...(input.stops || []).map(stopText),
        ...(input.returnStops || []).map(stopText),
    ]
        .map((part) => String(part || "").trim())
        .filter(Boolean)
        .join("\n");
}
function classifyExecutiveJourney(input) {
    const text = executiveJourneyText(input);
    if (OTHER_AIRPORT.test(text) || !HEATHROW.test(text)) {
        return { ok: false, error: exports.EXECUTIVE_HEATHROW_ONLY_MESSAGE };
    }
    const specific = SPECIFIC_AREAS.filter((area) => area.pattern.test(text)).map((area) => area.id);
    const area = specific.length === 1 ? specific[0] : specific.length === 0 && /\boxford\b/i.test(text) ? "oxford" : null;
    if (!area) {
        return {
            ok: true,
            airport: "heathrow",
            area: null,
            fareStatus: "quote_required",
            oneWay: null,
            returnFare: null,
        };
    }
    const prices = exports.EXECUTIVE_AREAS[area];
    return {
        ok: true,
        airport: "heathrow",
        area,
        fareStatus: "published",
        oneWay: prices.oneWay,
        returnFare: prices.return,
    };
}
function proposedExecutiveFare(classification, bookingType) {
    if (classification.fareStatus !== "published")
        return null;
    return bookingType === "return" ? classification.returnFare : classification.oneWay;
}
function assessExecutiveBooking(input) {
    if (!executiveServiceEnabled(input.enabled)) {
        return { ok: false, error: exports.EXECUTIVE_NOT_OPEN_MESSAGE };
    }
    if (!Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > exports.EXECUTIVE_PASSENGER_LIMIT) {
        return { ok: false, error: exports.EXECUTIVE_PASSENGER_MESSAGE };
    }
    const classification = classifyExecutiveJourney(input);
    if (!classification.ok)
        return classification;
    const bookingType = input.bookingType === "return" ? "return" : "one_way";
    const proposed = proposedExecutiveFare(classification, bookingType);
    return {
        ok: true,
        fields: {
            serviceType: "executive",
            airport: "heathrow",
            executiveAvailability: "awaiting_confirmation",
            executiveFareStatus: classification.fareStatus,
            executiveArea: classification.area || "",
            ...(proposed == null ? {} : { proposedFarePounds: proposed }),
            executiveSuitability: "pending",
            customerStatus: "awaiting_availability",
            adminStatus: "awaiting_availability",
        },
    };
}
