"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AIRPORT_WAITING_POLICY = void 0;
exports.airportWaitingDisclaimerTitle = airportWaitingDisclaimerTitle;
exports.airportWaitingDisclaimerBody = airportWaitingDisclaimerBody;
exports.bookingHasAirportCollection = bookingHasAirportCollection;
exports.isReturnBooking = isReturnBooking;
/** Central airport collection waiting policy. Change here, not in PDF copy. */
exports.AIRPORT_WAITING_POLICY = {
    complimentaryAirportWaitingMinutes: 50,
    airportWaitingChargePer15Minutes: 5,
};
function airportWaitingDisclaimerTitle() {
    return "Airport Collection & Waiting Time";
}
function airportWaitingDisclaimerBody(policy = exports.AIRPORT_WAITING_POLICY) {
    const minutes = policy.complimentaryAirportWaitingMinutes;
    const charge = policy.airportWaitingChargePer15Minutes;
    return [
        `Airport collections include flight tracking and up to ${minutes} minutes of complimentary waiting time from the actual flight landing time. If your flight is delayed, the complimentary waiting period will begin from the actual landing time rather than the originally scheduled arrival time.`,
        `After the complimentary ${minutes} minute period, additional waiting time is charged at £${charge} per 15 minutes. Any additional airport parking charges incurred due to extended waiting may also be added to the final fare.`,
    ].join("\n\n");
}
function bookingHasAirportCollection(booking) {
    if (!booking)
        return false;
    return booking.airportCollection === true || booking.returnAirportCollection === true;
}
function isReturnBooking(booking) {
    if (!booking)
        return false;
    if (booking.bookingType === "return")
        return true;
    return Boolean((booking.returnPickupLocation || "").trim() && (booking.returnDestination || "").trim());
}
