"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.CURRENT_WAITING = exports.CURRENT_WAITING_VERSION = exports.AIRPORT_WAITING_POLICY = void 0;
exports.airportWaitingDisclaimerTitle = airportWaitingDisclaimerTitle;
exports.airportWaitingDisclaimerBody = airportWaitingDisclaimerBody;
exports.airportWaitingWebsiteBody = airportWaitingWebsiteBody;
exports.airportWaitingChargeSummary = airportWaitingChargeSummary;
exports.calculateAirportWaitingCharge = calculateAirportWaitingCharge;
exports.bookingHasAirportCollection = bookingHasAirportCollection;
exports.bookingLooksLikeAirportTransfer = bookingLooksLikeAirportTransfer;
exports.airportWaitingScopeNote = airportWaitingScopeNote;
exports.waitingPolicyForBooking = waitingPolicyForBooking;
exports.currentCollectionCopy = currentCollectionCopy;
exports.fixedTimeExplanation = fixedTimeExplanation;
exports.fixedTimeAcknowledgement = fixedTimeAcknowledgement;
exports.proposeWaitingCharge = proposeWaitingCharge;
exports.addAdditionalCharge = addAdditionalCharge;
exports.additionalChargesPence = additionalChargesPence;
exports.airportWaitingTextForBooking = airportWaitingTextForBooking;
exports.isReturnBooking = isReturnBooking;
const servicePolicy_json_1 = __importDefault(require("./servicePolicy.json"));
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
    if (policy === exports.AIRPORT_WAITING_POLICY)
        return currentCollectionCopy();
    const minutes = policy.freeMinutesAfterActualLanding;
    const block = policy.chargeBlockMinutes;
    const charge = policy.chargePerBlock;
    const basis = "basis" in policy && policy.basis === "booked_time"
        ? "the booked collection time"
        : "the verified actual landing time";
    return [
        `The included allowance is ${minutes} minutes from ${basis}.`,
        `Additional waiting is charged at £${charge} per started ${block} minutes after your included allowance.`,
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
exports.CURRENT_WAITING_VERSION = servicePolicy_json_1.default.version;
exports.CURRENT_WAITING = {
    version: exports.CURRENT_WAITING_VERSION,
    ...servicePolicy_json_1.default.airport,
};
function waitingPolicyForBooking(booking) {
    const current = booking?.waitingPolicyVersion === exports.CURRENT_WAITING_VERSION;
    const hotel = booking?.collectionLocationKind === "hotel";
    const arrangement = hotel || booking?.collectionArrangement === "fixed_time"
        ? "fixed_time"
        : "flight_monitored";
    if (!current) {
        return {
            ...exports.AIRPORT_WAITING_POLICY,
            version: "legacy-50-30",
            basis: "actual_landing",
            arrangement: "flight_monitored",
        };
    }
    return {
        version: exports.CURRENT_WAITING_VERSION,
        freeMinutesAfterActualLanding: arrangement === "fixed_time" ? exports.CURRENT_WAITING.fixedFreeMinutes : exports.CURRENT_WAITING.flightFreeMinutes,
        chargeBlockMinutes: exports.CURRENT_WAITING.blockMinutes,
        chargePerBlock: exports.CURRENT_WAITING.chargePounds,
        basis: arrangement === "fixed_time" ? "booked_time" : "actual_landing",
        arrangement,
    };
}
function currentCollectionCopy() {
    return [
        "Flight monitored collection is the usual choice for an airport terminal pickup. We track the verified actual landing, not the scheduled arrival. The included allowance is 60 minutes from that verified landing. A delay before landing does not use the allowance.",
        "Fixed time collection is scheduled for the date and clock time you choose. Flight monitoring is not included, and the pickup does not change automatically if the flight is early or late. The included allowance is 15 minutes from the booked collection time. Earlier collection or a change of time is subject to availability.",
        "Additional waiting is charged at £5 per started 15 minutes after your included allowance. Waiting caused by our driver is not charged. The time starts only once the included allowance has ended and the driver is ready at the agreed collection point.",
        "A hotel collection uses the fixed time arrangement. A delay to an earlier flight does not move the hotel pickup unless we agree a different time with you.",
        "If you would prefer a later pickup, choose fixed time collection and allow enough time for immigration, luggage and reaching the collection point. Your driver will be scheduled for that time; earlier pickup is subject to availability.",
        "Bookings already accepted keep the waiting terms agreed at the time. Those terms are not replaced by this policy.",
    ].join("\n\n");
}
function fixedTimeExplanation() {
    return "Your driver is scheduled for your chosen collection time. Flight monitoring is not included with this option, and your pickup will not automatically change if your flight arrives early or late. Earlier collection or rescheduling is subject to availability. Please contact us promptly if you are delayed.";
}
function fixedTimeAcknowledgement() {
    return "I understand that my flight will not be monitored and my collection time will not automatically change.";
}
function instant(value) {
    if (value == null || value === "")
        return null;
    const parsed = new Date(String(value)).getTime();
    return Number.isNaN(parsed) ? null : parsed;
}
function londonWhen(ms) {
    return new Intl.DateTimeFormat("en-GB", {
        timeZone: "Europe/London",
        day: "numeric",
        month: "short",
        hour: "2-digit",
        minute: "2-digit",
        hourCycle: "h23",
    }).format(new Date(ms));
}
/** Proposed waiting only. This does not take payment or send a message. */
function proposeWaitingCharge(input) {
    const policy = waitingPolicyForBooking(input);
    const rate = `Additional waiting is charged at £${policy.chargePerBlock} per started ${policy.chargeBlockMinutes} minutes after your included allowance.`;
    if (policy.basis === "actual_landing") {
        const verified = input.landingStatus === "actual" && instant(input.verifiedLandingAt) != null;
        if (!verified) {
            return {
                status: "needs_verification",
                includedUntil: null,
                chargeableMinutes: 0,
                blocks: 0,
                proposedPounds: 0,
                preview: "Needs verification. A scheduled, estimated or unclear arrival is not a verified landing, so no waiting charge is final.",
            };
        }
    }
    const anchor = policy.basis === "booked_time" ? instant(input.bookedCollectionAt) : instant(input.verifiedLandingAt);
    if (anchor == null) {
        return {
            status: "needs_verification",
            includedUntil: null,
            chargeableMinutes: 0,
            blocks: 0,
            proposedPounds: 0,
            preview: "Needs verification. The collection time is not recorded, so no waiting charge is final.",
        };
    }
    const includedUntilMs = anchor + policy.freeMinutesAfterActualLanding * 60000;
    const driverReady = instant(input.driverReadyAt);
    const passengerReady = instant(input.passengerReadyAt);
    const deadline = londonWhen(includedUntilMs);
    if (driverReady == null || passengerReady == null) {
        return {
            status: "proposed",
            includedUntil: new Date(includedUntilMs).toISOString(),
            chargeableMinutes: 0,
            blocks: 0,
            proposedPounds: 0,
            preview: `Included waiting ends at ${deadline} UK time. ${rate} Record when the driver is ready at the collection point and when the passenger is ready before a charge is proposed.`,
        };
    }
    const chargeFrom = Math.max(includedUntilMs, driverReady);
    const chargeableMs = Math.max(0, passengerReady - chargeFrom);
    const blocks = chargeableMs === 0 ? 0 : Math.ceil(chargeableMs / (policy.chargeBlockMinutes * 60000));
    const chargeableMinutes = Math.ceil(chargeableMs / 60000);
    const proposedPounds = blocks * policy.chargePerBlock;
    return {
        status: "proposed",
        includedUntil: new Date(includedUntilMs).toISOString(),
        chargeableMinutes,
        blocks,
        proposedPounds,
        preview: `Included waiting ends at ${deadline} UK time. Chargeable waiting is ${chargeableMinutes} minutes, ${blocks} started ${policy.chargeBlockMinutes} minute blocks, proposed additional charge £${proposedPounds}. ${rate} This is not a payment and it has not been sent to the customer.`,
    };
}
function addAdditionalCharge(existing, charge) {
    const rows = Array.isArray(existing) ? existing : [];
    const id = String(charge.id || "").trim();
    const amount = Math.round(Number(charge.amountPence));
    const reason = String(charge.reason || "").trim();
    if (!id)
        return { ok: false, error: "A charge needs an id so a retry cannot add it twice." };
    if (!reason)
        return { ok: false, error: "Record why this charge is being added." };
    if (!Number.isFinite(amount) || amount <= 0)
        return { ok: false, error: "Enter the additional charge in pence." };
    if (rows.some((row) => row && row.id === id))
        return { ok: false, error: "This charge was already added." };
    return { ok: true, charges: rows.concat([{ id, amountPence: amount, reason }]).map((row) => ({
            id: String(row.id || ""),
            amountPence: Math.round(Number(row.amountPence) || 0),
            reason: String(row.reason || ""),
        })) };
}
function additionalChargesPence(booking) {
    const rows = booking && Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [];
    return rows.reduce((sum, row) => sum + Math.max(0, Math.round(Number(row && row.amountPence) || 0)), 0);
}
function airportWaitingTextForBooking(booking) {
    if (booking?.acceptedServiceTerms)
        booking = { ...booking, ...booking.acceptedServiceTerms, acceptedServiceTerms: undefined };
    if (booking?.waitingPolicyVersion === exports.CURRENT_WAITING_VERSION && booking.returnAirportCollection) {
        const returning = airportWaitingTextForBooking({ waitingPolicyVersion: booking.waitingPolicyVersion,
            collectionArrangement: booking.returnCollectionArrangement, collectionLocationKind: booking.returnCollectionLocationKind });
        if (!booking.airportCollection)
            return `Return collection: ${returning}`;
        const outbound = airportWaitingTextForBooking({ waitingPolicyVersion: booking.waitingPolicyVersion,
            collectionArrangement: booking.collectionArrangement, collectionLocationKind: booking.collectionLocationKind });
        return `Outbound collection: ${outbound}\n\nReturn collection: ${returning}`;
    }
    const policy = waitingPolicyForBooking(booking);
    if (policy.version !== exports.CURRENT_WAITING_VERSION)
        return airportWaitingDisclaimerBody(exports.AIRPORT_WAITING_POLICY);
    const arrangement = policy.arrangement === "fixed_time" ? "fixed time collection" : "flight monitored collection";
    const allowance = policy.arrangement === "fixed_time"
        ? "15 minutes from the booked collection time"
        : "60 minutes from the verified actual landing";
    return `This booking uses ${arrangement}. Included waiting is ${allowance}. Additional waiting is charged at £5 per started 15 minutes after your included allowance. Waiting stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point. Delays caused by our driver are not charged.${policy.arrangement === 'fixed_time' ? ' Flight monitoring and automatic adjustment are not included. Earlier collection or rescheduling is subject to availability.' : ''}`;
}
function isReturnBooking(booking) {
    if (!booking)
        return false;
    if (booking.bookingType === "return")
        return true;
    return Boolean((booking.returnPickupLocation || "").trim() && (booking.returnDestination || "").trim());
}
