"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.INTENDED_DESTINATION_HELP = exports.UNIMPLEMENTED_ROUTER = exports.UNIMPLEMENTED_GEOCODER = void 0;
exports.journeyTypeOf = journeyTypeOf;
exports.destinationMatchingEnabled = destinationMatchingEnabled;
exports.cityRouteKey = cityRouteKey;
exports.cityMatchingPublicBlocked = cityMatchingPublicBlocked;
exports.parseOptionalCoordinate = parseOptionalCoordinate;
exports.requireIntendedDestination = requireIntendedDestination;
exports.destinationFieldsForBooking = destinationFieldsForBooking;
exports.currentProposalVersion = currentProposalVersion;
exports.proposedHubId = proposedHubId;
exports.hasAcceptedCurrentProposal = hasAcceptedCurrentProposal;
exports.passengerSharedDropoffStatus = passengerSharedDropoffStatus;
exports.holdingBookings = holdingBookings;
exports.allHoldingAcceptedCurrentProposal = allHoldingAcceptedCurrentProposal;
exports.acceptedDropoffPlaces = acceptedDropoffPlaces;
exports.matchingOccupancyContext = matchingOccupancyContext;
exports.matchingAwareJourneyStatus = matchingAwareJourneyStatus;
exports.canPassengerEnterPayment = canPassengerEnterPayment;
exports.assertCanOpenPaymentWindow = assertCanOpenPaymentWindow;
exports.paymentSensitiveForDropoffChange = paymentSensitiveForDropoffChange;
exports.assertHubSelectable = assertHubSelectable;
exports.intendedDestinationPrivacyFields = intendedDestinationPrivacyFields;
exports.publicDtoHasPrivateDestinations = publicDtoHasPrivateDestinations;
exports.haversineMetres = haversineMetres;
exports.rankSharedDropoffHubs = rankSharedDropoffHubs;
exports.applyMatchingSuggestion = applyMatchingSuggestion;
exports.adminDestinationSummary = adminDestinationSummary;
exports.proposedDropoffCustomerNotice = proposedDropoffCustomerNotice;
exports.intendedDestinationPrompt = intendedDestinationPrompt;
const logic_1 = require("./logic");
const types_1 = require("./types");
Object.defineProperty(exports, "INTENDED_DESTINATION_HELP", { enumerable: true, get: function () { return types_1.INTENDED_DESTINATION_HELP; } });
exports.UNIMPLEMENTED_GEOCODER = {
    async geocode() {
        return null;
    },
};
exports.UNIMPLEMENTED_ROUTER = {
    async estimate() {
        return null;
    },
};
function journeyTypeOf(journey) {
    if (journey.journeyType)
        return journey.journeyType;
    if (String(journey.airportId || "").startsWith("city:"))
        return "CITY";
    return "AIRPORT";
}
function destinationMatchingEnabled(journey) {
    return journey.destinationMatchingEnabled === true;
}
function cityRouteKey(originCity, destinationCity) {
    const origin = String(originCity || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
    const destination = String(destinationCity || "")
        .trim()
        .toLowerCase()
        .replace(/\s+/g, "-");
    return `city:${origin}-${destination}`;
}
function cityMatchingPublicBlocked(journey, cityMatchingPublicEnabled = false) {
    if (journey.destinationMatchingPublicEnabled === true && cityMatchingPublicEnabled)
        return false;
    return destinationMatchingEnabled(journey) || journeyTypeOf(journey) === "CITY";
}
function parseOptionalCoordinate(value) {
    if (value == null || value === "")
        return undefined;
    const n = Number(value);
    if (!Number.isFinite(n))
        return undefined;
    return n;
}
function requireIntendedDestination(input, destinationCity = "London") {
    const text = String(input.intendedDestinationText || "").trim();
    if (!text) {
        throw new Error(`Where in ${destinationCity} are you travelling to?`);
    }
    if (input.sharedDropoffAcknowledged !== true) {
        throw new Error("Please confirm you understand the shared drop off may differ from your intended destination.");
    }
    const postcode = String(input.intendedDestinationPostcode || "").trim();
    return {
        intendedDestinationText: text,
        intendedDestinationPostcode: postcode || undefined,
        intendedDestinationLat: parseOptionalCoordinate(input.intendedDestinationLat),
        intendedDestinationLng: parseOptionalCoordinate(input.intendedDestinationLng),
        sharedDropoffAcknowledged: true,
        preferredDepartureTime: String(input.preferredDepartureTime || "").trim() || undefined,
        flexibleMinutes: Number.isFinite(Number(input.flexibleMinutes)) ? Number(input.flexibleMinutes) : undefined,
        earliestDepartureTime: String(input.earliestDepartureTime || "").trim() || undefined,
        latestDepartureTime: String(input.latestDepartureTime || "").trim() || undefined,
    };
}
function destinationFieldsForBooking(input, nowIso) {
    return {
        intendedDestinationText: input.intendedDestinationText,
        intendedDestinationPostcode: input.intendedDestinationPostcode,
        intendedDestinationLat: input.intendedDestinationLat,
        intendedDestinationLng: input.intendedDestinationLng,
        destinationEnteredAt: nowIso,
        sharedDropoffAcknowledgedAt: nowIso,
        preferredDepartureTime: input.preferredDepartureTime,
        flexibleMinutes: input.flexibleMinutes,
        earliestDepartureTime: input.earliestDepartureTime,
        latestDepartureTime: input.latestDepartureTime,
    };
}
function currentProposalVersion(journey) {
    return Number(journey.sharedDropoffProposalVersion || 0);
}
function proposedHubId(journey) {
    return String(journey.proposedSharedDropoffHubId || journey.confirmedSharedDropoffHubId || "");
}
function hasAcceptedCurrentProposal(booking, journey) {
    const version = currentProposalVersion(journey);
    if (version < 1)
        return false;
    if (booking.reservationStatus === "DROP_OFF_DECLINED" || booking.sharedDropoffDeclinedAt)
        return false;
    if (!booking.sharedDropoffAcceptedAt)
        return false;
    return Number(booking.acceptedDropoffProposalVersion || 0) === version;
}
function passengerSharedDropoffStatus(journey, booking) {
    if (booking.reservationStatus === "DROP_OFF_DECLINED" || booking.sharedDropoffDeclinedAt)
        return "DECLINED";
    if (hasAcceptedCurrentProposal(booking, journey))
        return "ACCEPTED";
    if (proposedHubId(journey))
        return "PROPOSED";
    return "NOT_SELECTED";
}
function holdingBookings(bookings) {
    return bookings.filter((row) => (0, logic_1.bookingHoldsSeat)(row));
}
function allHoldingAcceptedCurrentProposal(journey, bookings) {
    const holding = holdingBookings(bookings);
    return holding.length > 0 && holding.every((row) => hasAcceptedCurrentProposal(row, journey));
}
function acceptedDropoffPlaces(journey, bookings) {
    return holdingBookings(bookings)
        .filter((row) => hasAcceptedCurrentProposal(row, journey))
        .reduce((sum, row) => sum + (row.passengers || 0), 0);
}
function matchingOccupancyContext(journey, bookings) {
    if (!destinationMatchingEnabled(journey))
        return undefined;
    return {
        destinationMatchingEnabled: true,
        proposedSharedDropoffHubId: proposedHubId(journey) || undefined,
        allHoldingAccepted: allHoldingAcceptedCurrentProposal(journey, bookings),
        minPassengerThreshold: journey.minPassengerThreshold || Math.max(1, journey.capacity - 1),
    };
}
function matchingAwareJourneyStatus(occupied, capacity, current, paymentStageStatus, matching, fallback) {
    if (current === "CANCELLED" || current === "EXPIRED" || current === "COMPLETED" || current === "CONFIRMED") {
        return current;
    }
    if (!matching?.destinationMatchingEnabled || paymentStageStatus === "OPEN") {
        return fallback(occupied, capacity, current, paymentStageStatus);
    }
    const threshold = matching.minPassengerThreshold ?? Math.max(1, capacity - 1);
    if (occupied <= 0)
        return "GATHERING_INTEREST";
    if (occupied < threshold)
        return "GATHERING_INTEREST";
    if (!matching.proposedSharedDropoffHubId)
        return "AWAITING_DROPOFF_SELECTION";
    if (matching.allHoldingAccepted)
        return "READY_FOR_PAYMENT_SETUP";
    return "AWAITING_DROPOFF_ACCEPTANCE";
}
function canPassengerEnterPayment(journey, booking) {
    if (!destinationMatchingEnabled(journey))
        return true;
    return hasAcceptedCurrentProposal(booking, journey);
}
function assertCanOpenPaymentWindow(journey, bookings) {
    if (!destinationMatchingEnabled(journey))
        return;
    if (!proposedHubId(journey)) {
        throw new Error("Select a shared drop off hub and wait for passengers to accept it before opening payment.");
    }
    if (!allHoldingAcceptedCurrentProposal(journey, bookings)) {
        throw new Error("Every remaining passenger must accept the proposed shared drop off before payment opens.");
    }
    const threshold = journey.minPassengerThreshold || Math.max(1, journey.capacity - 1);
    if (acceptedDropoffPlaces(journey, bookings) < threshold) {
        throw new Error("Not enough passengers have accepted the proposed shared drop off.");
    }
}
function paymentSensitiveForDropoffChange(journey, bookings) {
    if (journey.paymentStageStatus === "OPEN" || journey.paymentStageStatus === "CLOSED")
        return true;
    return bookings.some((row) => row.reservationStatus === "PAID" ||
        row.reservationStatus === "PAYMENT_PENDING" ||
        (row.paidAmountPence || 0) > 0);
}
function assertHubSelectable(hub, hubId) {
    if (!hub || (hub.hubId !== hubId && hub.id !== hubId)) {
        throw new Error("Choose a shared drop off hub.");
    }
    if (!hub.enabled) {
        throw new Error("That shared drop off hub is not enabled.");
    }
    return hub;
}
function intendedDestinationPrivacyFields() {
    return [
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
}
function publicDtoHasPrivateDestinations(value) {
    const json = JSON.stringify(value || {});
    return [
        "intendedDestinationText",
        "intendedDestinationPostcode",
        "intendedDestinationLat",
        "intendedDestinationLng",
        "destinationEnteredAt",
    ].some((key) => json.includes(`"${key}"`));
}
function haversineMetres(a, b) {
    const toRad = (deg) => (deg * Math.PI) / 180;
    const earth = 6371000;
    const dLat = toRad(b.lat - a.lat);
    const dLng = toRad(b.lng - a.lng);
    const lat1 = toRad(a.lat);
    const lat2 = toRad(b.lat);
    const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
    return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}
function hubCoordinates(hub) {
    if (!Number.isFinite(hub.latitude) || !Number.isFinite(hub.longitude))
        return null;
    return { lat: Number(hub.latitude), lng: Number(hub.longitude) };
}
function bookingCoordinates(booking) {
    if (!Number.isFinite(booking.intendedDestinationLat) || !Number.isFinite(booking.intendedDestinationLng))
        return null;
    return { lat: Number(booking.intendedDestinationLat), lng: Number(booking.intendedDestinationLng) };
}
function qualityFromSpread(maxMetres, withCoords, total) {
    if (!withCoords || withCoords < total || maxMetres == null)
        return "MANUAL_REVIEW";
    if (maxMetres <= 4000)
        return "GOOD_MATCH";
    if (maxMetres <= 9000)
        return "ACCEPTABLE_MATCH";
    return "POOR_MATCH";
}
function rankSharedDropoffHubs(bookings, hubs, options) {
    const holding = holdingBookings(bookings);
    const notes = [types_1.GEOCODING_PROVIDER_NEEDED, types_1.ROUTING_PROVIDER_NEEDED];
    const geocodingAvailable = Boolean(options?.geocoder && options.geocoder !== exports.UNIMPLEMENTED_GEOCODER);
    const routingAvailable = Boolean(options?.router && options.router !== exports.UNIMPLEMENTED_ROUTER);
    const coords = holding.map(bookingCoordinates);
    const withCoords = coords.filter(Boolean).length;
    const pairwise = [];
    for (let i = 0; i < coords.length; i += 1) {
        for (let j = i + 1; j < coords.length; j += 1) {
            const a = coords[i];
            const b = coords[j];
            if (a && b)
                pairwise.push(haversineMetres(a, b));
        }
    }
    const spread = pairwise.length ? Math.max(...pairwise) : null;
    const overallQuality = qualityFromSpread(spread, withCoords, holding.length);
    const hubScores = hubs.map((hub) => {
        const hubPoint = hubCoordinates(hub);
        const distances = hubPoint
            ? coords.map((point) => (point ? haversineMetres(point, hubPoint) : null)).filter((row) => row != null)
            : [];
        const mean = distances.length ? distances.reduce((sum, n) => sum + n, 0) / distances.length : null;
        const max = distances.length ? Math.max(...distances) : null;
        const served = distances.filter((n) => n <= 5000).length;
        const quality = !hub.enabled || !distances.length ? "MANUAL_REVIEW" : qualityFromSpread(max, distances.length, holding.length);
        return {
            hubId: hub.hubId || hub.id,
            name: hub.name,
            displayName: hub.displayName || hub.name,
            enabled: hub.enabled,
            quality,
            meanDistanceMetres: mean,
            maxDistanceMetres: max,
            passengersWithCoordinates: withCoords,
            passengersTotal: holding.length,
            passengersReasonablyServed: served,
            reason: distances.length
                ? "Straight line distances from stored coordinates only. Road travel time, detours and extra mileage are not calculated."
                : "Passenger destinations are text only. Choose a shared drop off hub manually. Distances and travel times are not available.",
            selectable: hub.enabled === true,
        };
    });
    hubScores.sort((a, b) => {
        if (a.selectable !== b.selectable)
            return a.selectable ? -1 : 1;
        if (a.meanDistanceMetres != null && b.meanDistanceMetres != null)
            return a.meanDistanceMetres - b.meanDistanceMetres;
        return a.displayName.localeCompare(b.displayName);
    });
    const suggested = hubScores.find((row) => row.selectable);
    return {
        overallQuality,
        hubScores,
        clusters: [
            {
                clusterId: "cluster-1",
                bookingIds: holding.map((row) => row.id),
                quality: overallQuality,
                suggestedHubId: suggested?.hubId,
            },
        ],
        routingAvailable,
        geocodingAvailable,
        notes,
    };
}
function applyMatchingSuggestion(journey, result) {
    const best = result.hubScores.find((row) => row.selectable);
    return {
        suggestedSharedDropoffHubId: best?.hubId,
        suggestedSharedDropoffReason: best
            ? `${result.overallQuality}. ${best.reason}`
            : "No enabled shared drop off hubs are available.",
    };
}
function adminDestinationSummary(journey, bookings, hubs) {
    const matching = rankSharedDropoffHubs(bookings, hubs);
    const holding = holdingBookings(bookings);
    const declined = bookings.filter((row) => row.reservationStatus === "DROP_OFF_DECLINED" || row.sharedDropoffDeclinedAt);
    const accepted = holding.filter((row) => hasAcceptedCurrentProposal(row, journey));
    const pending = holding.filter((row) => !hasAcceptedCurrentProposal(row, journey));
    return {
        interestedCount: holding.reduce((sum, row) => sum + (row.passengers || 0), 0),
        destinations: holding.map((row, index) => ({
            index: index + 1,
            bookingId: row.id,
            name: row.name,
            intendedDestinationText: row.intendedDestinationText || "",
            intendedDestinationPostcode: row.intendedDestinationPostcode || "",
        })),
        suggestedHubs: matching.hubScores.filter((row) => row.selectable),
        overallQuality: matching.overallQuality,
        proposedHubId: proposedHubId(journey),
        proposedDisplayName: journey.proposedSharedDropoffDisplayName || "",
        proposalVersion: currentProposalVersion(journey),
        acceptedCount: accepted.length,
        declinedCount: declined.length,
        pendingCount: pending.length,
        notes: matching.notes,
    };
}
function proposedDropoffCustomerNotice(journey, intendedDestinationText) {
    const hub = journey.proposedSharedDropoffDisplayName || "the proposed shared drop off";
    const intended = intendedDestinationText || "the destination you entered";
    return `Based on the destinations entered by passengers, ${hub} has been selected as the proposed shared drop off for this journey. Your intended destination: ${intended}. You will need to make your own onward journey from ${hub}.`;
}
function intendedDestinationPrompt(destinationCity = "London") {
    return `Where in ${destinationCity} are you travelling to?`;
}
