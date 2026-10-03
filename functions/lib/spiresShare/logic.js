"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.penceToGbp = penceToGbp;
exports.flexibilityMinutes = flexibilityMinutes;
exports.parseHmToMinutes = parseHmToMinutes;
exports.minutesToHm = minutesToHm;
exports.canAddPassengers = canAddPassengers;
exports.occupancyLabel = occupancyLabel;
exports.remainingSeats = remainingSeats;
exports.assertPartyFitsCapacity = assertPartyFitsCapacity;
exports.bookingHoldsSeat = bookingHoldsSeat;
exports.statusFromOccupancy = statusFromOccupancy;
exports.publicStatusFromJourney = publicStatusFromJourney;
exports.isListableJourney = isListableJourney;
exports.earlyDepartureFarePence = earlyDepartureFarePence;
exports.earlyDepartureEligible = earlyDepartureEligible;
exports.earlyDepartureConfirmed = earlyDepartureConfirmed;
exports.timesCompatible = timesCompatible;
exports.estimatedArrivalHm = estimatedArrivalHm;
exports.flightCompatible = flightCompatible;
exports.luggageFitsVehicle = luggageFitsVehicle;
exports.luggageFits = luggageFits;
exports.luggageFitsPassengerAllowance = luggageFitsPassengerAllowance;
exports.airportById = airportById;
exports.isMvpAirport = isMvpAirport;
exports.isHeathrowTerminal = isHeathrowTerminal;
exports.toPublicJourney = toPublicJourney;
exports.matchJourneys = matchJourneys;
exports.publicHomeCollectionMessage = publicHomeCollectionMessage;
exports.evaluateHomeCollection = evaluateHomeCollection;
exports.acceptedPassengerCount = acceptedPassengerCount;
exports.canMovePassengers = canMovePassengers;
exports.nextCompatibleWaitlistOffer = nextCompatibleWaitlistOffer;
exports.stripPrivateFields = stripPrivateFields;
exports.hashToken = hashToken;
exports.newOpaqueToken = newOpaqueToken;
exports.publicNumberFor = publicNumberFor;
const types_1 = require("./types");
const paymentProvider_1 = require("./paymentProvider");
function penceToGbp(pence) {
    return `£${(pence / 100).toFixed(2)}`;
}
function flexibilityMinutes(flex) {
    if (flex === "plus_minus_15")
        return 15;
    if (flex === "plus_minus_30")
        return 30;
    if (flex === "plus_minus_60")
        return 60;
    return 0;
}
function parseHmToMinutes(hhmm) {
    const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
    if (!match)
        return null;
    const h = Number(match[1]);
    const m = Number(match[2]);
    if (h < 0 || h > 23 || m < 0 || m > 59)
        return null;
    return h * 60 + m;
}
function minutesToHm(total) {
    const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
    const h = Math.floor(wrapped / 60);
    const m = wrapped % 60;
    return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}
function canAddPassengers(occupied, adding, capacity) {
    return Number.isInteger(adding) && adding > 0 && occupied >= 0 && occupied + adding <= capacity;
}
function occupancyLabel(occupied, capacity) {
    return `${occupied}/${capacity}`;
}
function remainingSeats(occupied, capacity) {
    return Math.max(0, capacity - occupied);
}
function assertPartyFitsCapacity(passengers, capacity) {
    if (!Number.isInteger(passengers) || passengers < 1) {
        throw new Error("At least one passenger is required.");
    }
    if (passengers > capacity) {
        throw new Error(`This shared departure is limited to ${capacity} passengers.`);
    }
}
function bookingHoldsSeat(booking) {
    if (booking.reservationStatus) {
        return booking.reservationStatus === "PROVISIONAL" || booking.reservationStatus === "PAYMENT_PENDING" || booking.reservationStatus === "PAID";
    }
    return (0, paymentProvider_1.paymentSecuresSeat)(booking.paymentStatus);
}
function statusFromOccupancy(occupied, capacity, current, paymentStageStatus = "NOT_CREATED") {
    if (current === "CANCELLED" || current === "EXPIRED" || current === "COMPLETED" || current === "CONFIRMED") {
        return current;
    }
    if (current === "FOUR_PASSENGER_OPTION" || current === "SUPPLEMENT_PAYMENT") {
        if (occupied >= 5)
            return paymentStageStatus === "OPEN" ? "PAYMENT_WINDOW_OPEN" : "READY_FOR_PAYMENT_SETUP";
        if (occupied < 4)
            return "GATHERING_INTEREST";
        return current;
    }
    if (occupied <= 0)
        return "GATHERING_INTEREST";
    if (paymentStageStatus === "OPEN") {
        if (occupied === capacity - 1)
            return "AWAITING_FINAL_PASSENGER";
        return "PAYMENT_WINDOW_OPEN";
    }
    if (occupied >= capacity - 1)
        return "READY_FOR_PAYMENT_SETUP";
    return "GATHERING_INTEREST";
}
function publicStatusFromJourney(journey) {
    if (journey.status === "CONFIRMED" || journey.status === "COMPLETED") {
        return { publicStatus: "CONFIRMED", guarantee: "CONFIRMED" };
    }
    if (journey.occupiedSeats >= journey.capacity) {
        return { publicStatus: "FULL", guarantee: "PROVISIONAL" };
    }
    if (journey.occupiedSeats === journey.capacity - 1) {
        return { publicStatus: "ALMOST_FULL", guarantee: "PROVISIONAL" };
    }
    return { publicStatus: "FILLING", guarantee: "PROVISIONAL" };
}
function isListableJourney(status) {
    return (status === "GATHERING_INTEREST" ||
        status === "READY_FOR_PAYMENT_SETUP" ||
        status === "PAYMENT_WINDOW_OPEN" ||
        status === "AWAITING_FINAL_PASSENGER" ||
        status === "FOUR_PASSENGER_OPTION" ||
        status === "SUPPLEMENT_PAYMENT" ||
        status === "PROPOSED" ||
        status === "FILLING" ||
        status === "ALMOST_FULL" ||
        status === "FULL" ||
        status === "CONFIRMED" ||
        status === "AWAITING_EARLY_DEPARTURE_DECISION" ||
        status === "AWAITING_DROPOFF_SELECTION" ||
        status === "AWAITING_DROPOFF_ACCEPTANCE");
}
/** Equal split of target revenue. Never invent a hardcoded early-departure fare. */
function earlyDepartureFarePence(targetRevenuePence, travellingPassengers) {
    if (travellingPassengers <= 0) {
        throw new Error("travellingPassengers must be greater than zero");
    }
    return Math.round(targetRevenuePence / travellingPassengers);
}
function earlyDepartureEligible(occupied, capacity, threshold, alreadyConfirmed) {
    return !alreadyConfirmed && occupied === threshold && threshold === capacity - 1 && occupied < capacity;
}
function earlyDepartureConfirmed(acceptedCount, travellingPassengers) {
    return travellingPassengers > 0 && acceptedCount === travellingPassengers;
}
function timesCompatible(requestedHm, existingHm, flexibility) {
    const requested = parseHmToMinutes(requestedHm);
    const existing = parseHmToMinutes(existingHm);
    if (requested == null || existing == null)
        return false;
    return Math.abs(requested - existing) <= flexibilityMinutes(flexibility);
}
function estimatedArrivalHm(departureHm, durationMinutes) {
    const start = parseHmToMinutes(departureHm);
    if (start == null)
        return "";
    return minutesToHm(start + durationMinutes);
}
function flightCompatible(departureHm, durationMinutes, flightDepartureHm, bufferMinutes) {
    if (!flightDepartureHm)
        return true;
    const arrive = parseHmToMinutes(estimatedArrivalHm(departureHm, durationMinutes));
    const flight = parseHmToMinutes(flightDepartureHm);
    const depart = parseHmToMinutes(departureHm);
    if (arrive == null || flight == null || depart == null)
        return false;
    let flightMinutes = flight;
    if (flightMinutes < depart)
        flightMinutes += 24 * 60;
    let arriveMinutes = arrive;
    if (arriveMinutes < depart)
        arriveMinutes += 24 * 60;
    return arriveMinutes + bufferMinutes <= flightMinutes;
}
function luggageFitsVehicle(existing, incoming, maxLarge, maxCabin) {
    const large = existing.reduce((sum, row) => sum + (row.largeSuitcases || 0), 0) + (incoming.largeSuitcases || 0);
    const cabin = existing.reduce((sum, row) => sum + (row.cabinBags || 0), 0) + (incoming.cabinBags || 0);
    return large <= maxLarge && cabin <= maxCabin;
}
/** @deprecated use luggageFitsVehicle */
function luggageFits(existing, incoming, maxLarge, maxCabin) {
    return luggageFitsVehicle(existing, incoming, maxLarge, maxCabin);
}
function luggageFitsPassengerAllowance(incoming, passengers, perPassengerLarge, perPassengerCabin) {
    if (passengers < 1)
        return false;
    return ((incoming.largeSuitcases || 0) <= passengers * perPassengerLarge &&
        (incoming.cabinBags || 0) <= passengers * perPassengerCabin);
}
function airportById(config, airportId) {
    return config.airports.find((row) => row.id === airportId);
}
function isMvpAirport(config, airportId) {
    return config.mvpAirportIds.includes(airportId);
}
function isHeathrowTerminal(value, allowed) {
    return allowed.includes(value);
}
function toPublicJourney(journey, config) {
    const airport = airportById(config, journey.airportId);
    const defaults = config.pilotDefaults;
    const { publicStatus, guarantee } = publicStatusFromJourney(journey);
    return {
        publicNumber: journey.publicNumber,
        airportId: journey.airportId,
        airportName: airport?.name || journey.airportId,
        originLabel: journey.originLabel || defaults?.originLabel || "Oxford",
        meetingPointName: journey.departureLocation || config.meetingPoint.publicName,
        destinationLabel: journey.destinationLabel || airport?.dropoffLabel || "Heathrow Airport",
        travelDate: journey.travelDate,
        departureTime: journey.departureTime,
        recommendedArrivalTime: minutesToHm((parseHmToMinutes(journey.departureTime) || 0) - (config.arriveBeforeDepartureMinutes || 15)),
        graceUntilTime: minutesToHm((parseHmToMinutes(journey.departureTime) || 0) + (config.boardingClosesMinutesBeforeDeparture || 5)),
        approximateArrival: airport
            ? estimatedArrivalHm(journey.departureTime, airport.estimatedDurationMinutes)
            : "",
        occupiedSeats: journey.occupiedSeats,
        remainingSeats: journey.waitlistOfferOutstanding ? 0 : remainingSeats(journey.occupiedSeats, journey.capacity),
        capacity: journey.capacity,
        farePence: journey.farePence,
        publicStatus: journey.waitlistOfferOutstanding && remainingSeats(journey.occupiedSeats, journey.capacity) > 0 ? "ALMOST_FULL" : publicStatus,
        journeyStatus: journey.status,
        guarantee,
        warning: guarantee === "CONFIRMED" ? undefined : types_1.UNCONFIRMED_WARNING,
        journeyType: journey.journeyType || (String(journey.airportId || "").startsWith("city:") ? "CITY" : "AIRPORT"),
        originCity: journey.originCity,
        destinationCity: journey.destinationCity,
        destinationMatchingEnabled: journey.destinationMatchingEnabled === true,
        proposedSharedDropoffDisplayName: journey.destinationMatchingEnabled ? journey.proposedSharedDropoffDisplayName : undefined,
    };
}
function matchJourneys(request, journeys, config, bookingsByJourney) {
    const airport = airportById(config, request.airportId);
    if (!airport)
        return [];
    return journeys.filter((journey) => {
        if (journey.airportId !== request.airportId)
            return false;
        if (journey.travelDate !== request.travelDate)
            return false;
        if (!isListableJourney(journey.status))
            return false;
        if (journey.status === "CONFIRMED" && !canAddPassengers(journey.occupiedSeats, request.passengers, journey.capacity)) {
            return false;
        }
        if (journey.status === "PAYMENT_ACTION_REQUIRED")
            return false;
        if (!canAddPassengers(journey.occupiedSeats, request.passengers, journey.capacity))
            return false;
        if (!timesCompatible(request.preferredDepartureTime, journey.departureTime, request.flexibility)) {
            return false;
        }
        if (!flightCompatible(journey.departureTime, airport.estimatedDurationMinutes, request.flightDepartureTime, airport.flightSafetyBufferMinutes)) {
            return false;
        }
        const existingLuggage = (bookingsByJourney[journey.id] || [])
            .filter((row) => bookingHoldsSeat(row))
            .map((row) => row.luggage);
        return luggageFitsVehicle(existingLuggage, request.luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle);
    });
}
function publicHomeCollectionMessage(eligibility, surchargePence) {
    if (eligibility === "HOME_COLLECTION_ELIGIBLE")
        return "Home collection available";
    if (eligibility === "HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE") {
        return `Home collection available +${penceToGbp(surchargePence)}`;
    }
    return "Home collection is unavailable for this journey. Please board at Thornhill Park & Ride.";
}
/** Architecture retained for a later product. Heathrow MVP does not offer home collection. */
function evaluateHomeCollection(postcode, currentHomeCollections, maxHomeCollections, surchargePence, customerEnabled) {
    if (!customerEnabled) {
        return {
            eligibility: "HOME_COLLECTION_UNAVAILABLE",
            surchargePence: 0,
            message: publicHomeCollectionMessage("HOME_COLLECTION_UNAVAILABLE", 0),
        };
    }
    const cleaned = (postcode || "").trim();
    if (!cleaned) {
        return {
            eligibility: "HOME_COLLECTION_UNAVAILABLE",
            surchargePence: 0,
            message: publicHomeCollectionMessage("HOME_COLLECTION_UNAVAILABLE", 0),
        };
    }
    if (currentHomeCollections >= maxHomeCollections) {
        return {
            eligibility: "HOME_COLLECTION_UNAVAILABLE",
            surchargePence: 0,
            message: publicHomeCollectionMessage("HOME_COLLECTION_UNAVAILABLE", 0),
        };
    }
    const eligibility = surchargePence > 0 ? "HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE" : "HOME_COLLECTION_ELIGIBLE";
    return {
        eligibility,
        surchargePence,
        message: publicHomeCollectionMessage(eligibility, surchargePence),
    };
}
function acceptedPassengerCount(bookings) {
    return bookings
        .filter((row) => row.earlyDepartureAccepted)
        .reduce((sum, row) => sum + (row.passengers || 0), 0);
}
function canMovePassengers(fromOccupied, toOccupied, moving, toCapacity) {
    return moving > 0 && fromOccupied >= moving && canAddPassengers(toOccupied, moving, toCapacity);
}
function nextCompatibleWaitlistOffer(entries, remaining) {
    if (remaining <= 0)
        return null;
    if (entries.some((row) => row.status === "OFFERED"))
        return null;
    return (entries
        .filter((row) => (row.status === "WAITLISTED" || row.status === "WAITING") && row.passengers <= remaining)
        .sort((a, b) => {
        const aAt = a.joinedWaitlistAt || a.createdAt;
        const bAt = b.joinedWaitlistAt || b.createdAt;
        const joined = aAt.localeCompare(bAt);
        if (joined !== 0)
            return joined;
        return String(a.id || "").localeCompare(String(b.id || ""));
    })[0] || null);
}
const PRIVATE_FIELDS = [
    "name",
    "mobile",
    "email",
    "homePostcode",
    "homeAddress",
    "pickupAddress",
    "flightNumber",
    "flightDepartureTime",
    "privateNotes",
    "origin",
    "privateOrigin",
    "startLocation",
    "vehicleStart",
    "paymentId",
    "paymentMethodRef",
    "paymentLinkUrl",
    "supplementPaymentLinkUrl",
    "manageTokenHash",
    "idempotencyKey",
    "uid",
    "adminNotes",
    "boardingCode",
    "boardingCodeHash",
    "boardingVerifiedBy",
    "boardingCodeCreatedAt",
    "boardingVerifiedAt",
    "intendedDestinationText",
    "intendedDestinationPostcode",
    "intendedDestinationLat",
    "intendedDestinationLng",
    "destinationEnteredAt",
    "sharedDropoffAcknowledgedAt",
    "acceptedDropoffProposalVersion",
    "destinationClusterId",
    "preferredDepartureTime",
    "flexibleMinutes",
    "earliestDepartureTime",
    "latestDepartureTime",
];
function stripPrivateFields(row) {
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (PRIVATE_FIELDS.includes(key))
            continue;
        out[key] = value;
    }
    return out;
}
function hashToken(token) {
    const crypto = require("crypto");
    return crypto.createHash("sha256").update(token).digest("hex");
}
function newOpaqueToken() {
    const crypto = require("crypto");
    return crypto.randomBytes(32).toString("base64url");
}
function publicNumberFor(travelDate, departureTime, suffix = "") {
    return `SS-${travelDate.replace(/-/g, "")}-${departureTime.replace(":", "")}${suffix}`;
}
