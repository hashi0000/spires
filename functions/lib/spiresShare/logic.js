"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.MockPaymentProvider = void 0;
exports.penceToGbp = penceToGbp;
exports.flexibilityMinutes = flexibilityMinutes;
exports.parseHmToMinutes = parseHmToMinutes;
exports.minutesToHm = minutesToHm;
exports.canAddPassengers = canAddPassengers;
exports.occupancyLabel = occupancyLabel;
exports.remainingSeats = remainingSeats;
exports.statusFromOccupancy = statusFromOccupancy;
exports.earlyDepartureFarePence = earlyDepartureFarePence;
exports.earlyDepartureEligible = earlyDepartureEligible;
exports.earlyDepartureConfirmed = earlyDepartureConfirmed;
exports.timesCompatible = timesCompatible;
exports.estimatedArrivalHm = estimatedArrivalHm;
exports.flightCompatible = flightCompatible;
exports.luggageFits = luggageFits;
exports.paymentSecuresSeat = paymentSecuresSeat;
exports.airportById = airportById;
exports.toPublicJourney = toPublicJourney;
exports.matchJourneys = matchJourneys;
exports.publicHomeCollectionMessage = publicHomeCollectionMessage;
exports.evaluateHomeCollection = evaluateHomeCollection;
exports.acceptedPassengerCount = acceptedPassengerCount;
exports.canMovePassengers = canMovePassengers;
exports.mockCaptureIfAuthorised = mockCaptureIfAuthorised;
exports.mockReleaseIfOpen = mockReleaseIfOpen;
exports.nextCompatibleWaitlistOffer = nextCompatibleWaitlistOffer;
exports.stripPrivateFields = stripPrivateFields;
const types_1 = require("./types");
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
function statusFromOccupancy(occupied, capacity, current) {
    if (current === "CANCELLED" ||
        current === "EXPIRED" ||
        current === "COMPLETED" ||
        current === "CONFIRMED" ||
        current === "AWAITING_EARLY_DEPARTURE_DECISION") {
        return current;
    }
    if (occupied <= 0)
        return "PROPOSED";
    if (occupied >= capacity)
        return "FULL";
    if (occupied === capacity - 1)
        return "ALMOST_FULL";
    if (occupied === 1)
        return "PROPOSED";
    return "FILLING";
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
    // Without a flight date, only treat the flight as next-day when it is earlier than departure.
    if (flightMinutes < depart)
        flightMinutes += 24 * 60;
    let arriveMinutes = arrive;
    if (arriveMinutes < depart)
        arriveMinutes += 24 * 60;
    return arriveMinutes + bufferMinutes <= flightMinutes;
}
function luggageFits(existing, incoming, maxLarge, maxCabin) {
    const large = existing.reduce((sum, row) => sum + (row.largeSuitcases || 0), 0) + (incoming.largeSuitcases || 0);
    const cabin = existing.reduce((sum, row) => sum + (row.cabinBags || 0), 0) + (incoming.cabinBags || 0);
    return large <= maxLarge && cabin <= maxCabin;
}
function paymentSecuresSeat(status) {
    return status === "AUTHORISED" || status === "CAPTURE_PENDING" || status === "CAPTURED";
}
function airportById(config, airportId) {
    return config.airports.find((row) => row.id === airportId);
}
function toPublicJourney(journey, config) {
    const airport = airportById(config, journey.airportId);
    const confirmed = journey.status === "CONFIRMED" || journey.status === "FULL" || journey.status === "COMPLETED";
    return {
        id: journey.id,
        airportId: journey.airportId,
        airportName: airport?.name || journey.airportId,
        meetingPointName: config.meetingPoint.publicName,
        dropoffLabel: airport?.dropoffLabel || "",
        travelDate: journey.travelDate,
        departureTime: journey.departureTime,
        approximateArrival: airport
            ? estimatedArrivalHm(journey.departureTime, airport.estimatedDurationMinutes)
            : "",
        occupiedSeats: journey.occupiedSeats,
        remainingSeats: remainingSeats(journey.occupiedSeats, journey.capacity),
        capacity: journey.capacity,
        farePence: journey.farePence,
        status: journey.status,
        confirmed,
        warning: confirmed ? undefined : types_1.UNCONFIRMED_WARNING,
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
        if (journey.status === "CANCELLED" || journey.status === "EXPIRED" || journey.status === "COMPLETED") {
            return false;
        }
        if (!canAddPassengers(journey.occupiedSeats, request.passengers, journey.capacity))
            return false;
        if (!timesCompatible(request.preferredDepartureTime, journey.departureTime, request.flexibility)) {
            return false;
        }
        if (!flightCompatible(journey.departureTime, airport.estimatedDurationMinutes, request.flightDepartureTime, airport.flightSafetyBufferMinutes)) {
            return false;
        }
        const existingLuggage = (bookingsByJourney[journey.id] || []).map((row) => row.luggage);
        return luggageFits(existingLuggage, request.luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle);
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
/** Dev stub: never uses a private origin. Postcode presence only. */
function evaluateHomeCollection(postcode, currentHomeCollections, maxHomeCollections, surchargePence) {
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
function mockCaptureIfAuthorised(status) {
    if (status === "CAPTURED")
        return "CAPTURED";
    if (status === "AUTHORISED" || status === "CAPTURE_PENDING")
        return "CAPTURED";
    return status;
}
function mockReleaseIfOpen(status) {
    if (status === "CAPTURED" || status === "REFUNDED")
        return status;
    if (status === "AUTHORISED" ||
        status === "CAPTURE_PENDING" ||
        status === "AUTHORISATION_PENDING" ||
        status === "PAYMENT_METHOD_PENDING") {
        return "AUTHORISATION_RELEASED";
    }
    return status;
}
function nextCompatibleWaitlistOffer(entries, remaining) {
    if (remaining <= 0)
        return null;
    if (entries.some((row) => row.status === "OFFERED"))
        return null;
    return (entries
        .filter((row) => row.status === "WAITLISTED" && row.passengers <= remaining)
        .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] || null);
}
function stripPrivateFields(row) {
    const blocked = [
        "name",
        "mobile",
        "email",
        "homePostcode",
        "homeAddress",
        "pickupAddress",
        "flightNumber",
        "privateNotes",
        "origin",
        "privateOrigin",
        "startLocation",
        "vehicleStart",
    ];
    const out = {};
    for (const [key, value] of Object.entries(row)) {
        if (blocked.includes(key))
            continue;
        out[key] = value;
    }
    return out;
}
/** Future Shift4 (or other) adapters implement PaymentProvider. No live card calls. */
class MockPaymentProvider {
    constructor(store = new Map()) {
        this.store = store;
    }
    authorise(id, amountPence, succeed = true) {
        if (!succeed) {
            this.store.set(id, { status: "FAILED", amountPence });
            return { id, status: "FAILED" };
        }
        this.store.set(id, { status: "AUTHORISED", amountPence });
        return { id, status: "AUTHORISED" };
    }
    capture(id) {
        const row = this.store.get(id);
        if (!row || row.status !== "AUTHORISED")
            return { id, status: row?.status || "FAILED" };
        const next = { ...row, status: "CAPTURED" };
        this.store.set(id, next);
        return { id, status: next.status };
    }
    release(id) {
        const row = this.store.get(id);
        if (!row)
            return { id, status: "FAILED" };
        if (row.status === "CAPTURED")
            return { id, status: "CAPTURED" };
        const next = { ...row, status: "AUTHORISATION_RELEASED" };
        this.store.set(id, next);
        return { id, status: next.status };
    }
    get(id) {
        return this.store.get(id) || null;
    }
}
exports.MockPaymentProvider = MockPaymentProvider;
