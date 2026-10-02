"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRPORT_WAITING_POLICY = void 0;
exports.airportWaitingDisclaimerTitle = airportWaitingDisclaimerTitle;
exports.airportWaitingDisclaimerBody = airportWaitingDisclaimerBody;
exports.airportWaitingWebsiteBody = airportWaitingWebsiteBody;
exports.airportWaitingChargeSummary = airportWaitingChargeSummary;
exports.calculateAirportWaitingCharge = calculateAirportWaitingCharge;
exports.bookingHasAirportCollection = bookingHasAirportCollection;
exports.bookingLooksLikeAirportTransfer = bookingLooksLikeAirportTransfer;
exports.airportWaitingScopeNote = airportWaitingScopeNote;
exports.isReturnBooking = isReturnBooking;
/** Central airport collection waiting policy. Change here, not in PDF or website copy. */
exports.AIRPORT_WAITING_POLICY = {
    freeMinutesAfterActualLanding: 50,
    chargeBlockMinutes: 30,
    chargePerBlock: 10,
};
function airportWaitingDisclaimerTitle() {
    return "Airport Collection";
}
function airportWaitingDisclaimerBody(policy = exports.AIRPORT_WAITING_POLICY) {
    const minutes = policy.freeMinutesAfterActualLanding;
    const block = policy.chargeBlockMinutes;
    const charge = policy.chargePerBlock;
    return [
        `We monitor your flight using the actual landing time. You have ${minutes} minutes from the actual landing time to clear immigration, collect your luggage and let us know you are ready for collection.`,
        "Once you let us know you are ready, your driver will make their way to the airport pickup point.",
        `If you are not ready within ${minutes} minutes of the actual landing time, waiting is charged at £${charge} per additional ${block} minutes or part thereof.`,
        "The standard airport pickup charge is included in your fare.",
    ].join("\n\n");
}
function airportWaitingWebsiteBody(policy = exports.AIRPORT_WAITING_POLICY) {
    const minutes = policy.freeMinutesAfterActualLanding;
    const block = policy.chargeBlockMinutes;
    const charge = policy.chargePerBlock;
    return [
        `We monitor your flight and allow ${minutes} minutes from the actual landing time for you to clear immigration, collect your luggage and let us know you are ready. Your driver will then make their way to the airport pickup point.`,
        `If you are not ready within ${minutes} minutes of landing, waiting time is charged at £${charge} per additional ${block} minutes or part thereof.`,
    ].join("\n\n");
}
function airportWaitingChargeSummary(policy = exports.AIRPORT_WAITING_POLICY) {
    return `£${policy.chargePerBlock} per additional ${policy.chargeBlockMinutes} minutes or part thereof`;
}
function calculateAirportWaitingCharge(minutesAfterActualLanding, policy = exports.AIRPORT_WAITING_POLICY) {
    if (!Number.isFinite(minutesAfterActualLanding) || minutesAfterActualLanding <= policy.freeMinutesAfterActualLanding) {
        return 0;
    }
    const chargeableMinutes = minutesAfterActualLanding - policy.freeMinutesAfterActualLanding;
    return Math.ceil(chargeableMinutes / policy.chargeBlockMinutes) * policy.chargePerBlock;
}
function bookingHasAirportCollection(booking) {
    if (!booking)
        return false;
    return booking.airportCollection === true || booking.returnAirportCollection === true;
}
const AIRPORT_LOCATION_HINT = /\b(heathrow|gatwick|luton|stansted|birmingham airport|london city|bristol airport|lhr|lgw|ltn|stn|bhx|lcy|brs)\b/i;
function locationLooksLikeAirport(value) {
    return AIRPORT_LOCATION_HINT.test(String(value || ""));
}
function bookingLooksLikeAirportTransfer(booking) {
    if (!booking)
        return false;
    if (bookingHasAirportCollection(booking))
        return true;
    return [
        booking.pickupLocation,
        booking.pickup,
        booking.destination,
        booking.returnPickupLocation,
        booking.returnDestination,
    ].some(locationLooksLikeAirport);
}
function airportWaitingScopeNote(booking) {
    if (!bookingHasAirportCollection(booking))
        return "";
    const outbound = booking?.airportCollection === true;
    const returning = booking?.returnAirportCollection === true;
    const isReturn = booking?.bookingType === "return" ||
        Boolean((booking?.returnPickupLocation || "").trim() && (booking?.returnDestination || "").trim());
    if (isReturn && returning && !outbound) {
        return "This applies to the return journey (airport collection). It does not apply to the outbound drop off.";
    }
    if (isReturn && outbound && !returning) {
        return "This applies to the outbound airport collection. It does not apply to the return drop off.";
    }
    if (isReturn && outbound && returning) {
        return "This applies to each airport collection on this booking.";
    }
    return "";
}
function isReturnBooking(booking) {
    if (!booking)
        return false;
    if (booking.bookingType === "return")
        return true;
    return Boolean((booking.returnPickupLocation || "").trim() && (booking.returnDestination || "").trim());
}
