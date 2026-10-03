"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.EVENT_POSITIONING_COPY = exports.EVENT_FIVE_PASSENGER_COPY = exports.SHARE_PUBLIC_EVENT_BASE = exports.EVENT_PASSENGER_CAP = void 0;
exports.defaultLondonShareAreas = defaultLondonShareAreas;
exports.defaultShareVenues = defaultShareVenues;
exports.eventSlugFrom = eventSlugFrom;
exports.isPublishedEvent = isPublishedEvent;
exports.isEventDraft = isEventDraft;
exports.eventPublicListingAllowed = eventPublicListingAllowed;
exports.clampEventPassengerCap = clampEventPassengerCap;
exports.fareFromLondonArea = fareFromLondonArea;
exports.applyVenueDefaults = applyVenueDefaults;
exports.eventFarePence = eventFarePence;
exports.eventAmountDuePence = eventAmountDuePence;
exports.returnSeatCountFrom = returnSeatCountFrom;
exports.eventFieldsFromInput = eventFieldsFromInput;
exports.copyEventFieldsToJourney = copyEventFieldsToJourney;
exports.eventShareUrl = eventShareUrl;
exports.eventPublicStatusLabel = eventPublicStatusLabel;
exports.returnDepartureCopy = returnDepartureCopy;
exports.eventAdvertText = eventAdvertText;
exports.eventRevenuePreview = eventRevenuePreview;
exports.assertEventInterestOpen = assertEventInterestOpen;
exports.assertEventHasCapacity = assertEventHasCapacity;
exports.assertEventTripType = assertEventTripType;
exports.compatibleEventGroup = compatibleEventGroup;
exports.eventPublicView = eventPublicView;
exports.publicEventHasPii = publicEventHasPii;
exports.eventBoardingEnabled = eventBoardingEnabled;
exports.verifyEventLeg = verifyEventLeg;
exports.eventDriverManifest = eventDriverManifest;
exports.eventInterestNotBooking = eventInterestNotBooking;
const routePricing_1 = require("./routePricing");
exports.EVENT_PASSENGER_CAP = 5;
exports.SHARE_PUBLIC_EVENT_BASE = "https://www.spires-taxis.com/share/event";
function defaultLondonShareAreas(config) {
    return config?.londonShareAreas?.length
        ? config.londonShareAreas
        : [
            { id: "london_west", name: "London West", defaultShareFarePenceMin: 3500, defaultShareFarePenceMax: 4000 },
            { id: "london_central", name: "London Central", defaultShareFarePenceMin: 4000, defaultShareFarePenceMax: 4500 },
            { id: "london_east", name: "London East", defaultShareFarePenceMin: 4500, defaultShareFarePenceMax: 5000 },
            { id: "london_extended", name: "London Extended", defaultShareFarePenceMin: 5000, defaultShareFarePenceMax: 6000 },
        ];
}
function defaultShareVenues(config) {
    return config?.shareVenues?.length ? config.shareVenues : [];
}
function eventSlugFrom(eventName, venueName, eventDate) {
    const raw = `${eventName}-${venueName}-${eventDate}`
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 80);
    return raw || `event-${eventDate}`;
}
function isPublishedEvent(group) {
    if (group.journeyType !== "EVENT")
        return false;
    if (group.eventPublished === false)
        return false;
    if (group.eventStatus && group.eventStatus !== "PUBLISHED")
        return false;
    return group.eventPublished === true && (group.status === "GATHERING_INTEREST" || group.status === "READY_FOR_REVIEW");
}
function isEventDraft(group) {
    return group.journeyType === "EVENT" && (group.eventPublished !== true || group.eventStatus === "DRAFT");
}
function eventPublicListingAllowed(group) {
    return isPublishedEvent(group);
}
function clampEventPassengerCap(value, configCap = exports.EVENT_PASSENGER_CAP) {
    const cap = Number(value) || configCap || exports.EVENT_PASSENGER_CAP;
    if (cap < 1)
        return 1;
    if (cap > exports.EVENT_PASSENGER_CAP)
        return exports.EVENT_PASSENGER_CAP;
    return cap;
}
function fareFromLondonArea(areas, areaId) {
    const area = (areas || []).find((row) => row.id === areaId);
    if (!area)
        return undefined;
    return area.defaultShareFarePenceMin;
}
function applyVenueDefaults(input, config) {
    const venue = defaultShareVenues(config).find((row) => row.id === input.venueId || row.name === input.venueName);
    if (!venue)
        return input;
    const areaFare = fareFromLondonArea(config.londonShareAreas, venue.londonAreaId);
    return {
        ...input,
        venueName: input.venueName || venue.name,
        venueAddress: input.venueAddress || venue.venueAddress,
        pickupLocation: input.pickupLocation || venue.defaultPickup || config.meetingPoint?.publicName,
        destination: input.destination || venue.name,
        outboundFarePence: input.outboundFarePence || venue.defaultFarePence || areaFare,
        returnFarePence: input.returnFarePence || venue.defaultReturnFarePence,
        passengerLimit: input.passengerLimit || venue.defaultPassengerCap || exports.EVENT_PASSENGER_CAP,
        venueDropoffPoint: input.venueDropoffPoint || venue.venueDropoffPoint,
        venueReturnMeetingPoint: input.venueReturnMeetingPoint || venue.returnMeetingPoint,
        londonAreaId: input.londonAreaId || venue.londonAreaId,
        eventCategory: input.eventCategory || venue.eventCategory,
    };
}
function eventFarePence(input) {
    return (0, routePricing_1.cityJourneyRequiresOwnFare)(Number(input.outboundFarePence || input.farePence || 0) || undefined);
}
function eventAmountDuePence(tripType, outboundFarePence, returnFarePence, passengers) {
    const fare = tripType === "RETURN" ? (0, routePricing_1.cityJourneyRequiresOwnFare)(returnFarePence) : outboundFarePence;
    return fare * passengers;
}
function returnSeatCountFrom(entries) {
    return entries
        .filter((row) => row.status === "ACTIVE" && row.tripType === "RETURN")
        .reduce((sum, row) => sum + Number(row.passengers || 0), 0);
}
function eventFieldsFromInput(input, farePence) {
    const offerReturn = input.offerReturn === true;
    return {
        eventName: input.eventName.trim(),
        venueName: input.venueName.trim(),
        venueAddress: input.venueAddress?.trim() || undefined,
        eventDate: input.eventDate,
        eventStartTime: input.eventStartTime,
        expectedFinishTime: input.expectedFinishTime?.trim() || undefined,
        eventUrl: input.eventUrl?.trim() || undefined,
        eventImageUrl: input.eventImageUrl?.trim() || undefined,
        eventCategory: input.eventCategory?.trim() || undefined,
        eventStatus: input.publish === true ? "PUBLISHED" : "DRAFT",
        eventSlug: eventSlugFrom(input.eventName, input.venueName, input.eventDate),
        eventPublished: input.publish === true,
        outboundFarePence: farePence,
        returnFarePence: offerReturn ? (0, routePricing_1.cityJourneyRequiresOwnFare)(input.returnFarePence) : undefined,
        offerReturn,
        returnDepartureBasis: offerReturn ? input.returnDepartureBasis || "AFTER_EVENT" : undefined,
        returnDepartureTime: offerReturn && input.returnDepartureBasis === "SPECIFIC_TIME" ? input.returnDepartureTime : undefined,
        returnAfterMinutes: offerReturn && input.returnDepartureBasis !== "SPECIFIC_TIME" ? Number(input.returnAfterMinutes || 45) : undefined,
        venueDropoffPoint: input.venueDropoffPoint?.trim() || undefined,
        venueReturnMeetingPoint: input.venueReturnMeetingPoint?.trim() || undefined,
        londonAreaId: input.londonAreaId,
        returnSeatCount: 0,
    };
}
function copyEventFieldsToJourney(group, journey) {
    journey.journeyType = "EVENT";
    journey.eventName = group.eventName;
    journey.venueName = group.venueName;
    journey.venueAddress = group.venueAddress;
    journey.eventDate = group.eventDate || group.travelDate;
    journey.eventStartTime = group.eventStartTime;
    journey.expectedFinishTime = group.expectedFinishTime;
    journey.eventUrl = group.eventUrl;
    journey.eventImageUrl = group.eventImageUrl;
    journey.eventCategory = group.eventCategory;
    journey.eventStatus = group.eventStatus;
    journey.eventSlug = group.eventSlug;
    journey.eventPublished = false;
    journey.outboundFarePence = group.outboundFarePence || group.proposedFarePence || journey.farePence;
    journey.returnFarePence = group.returnFarePence;
    journey.offerReturn = group.offerReturn === true;
    journey.returnDepartureBasis = group.returnDepartureBasis;
    journey.returnDepartureTime = group.returnDepartureTime;
    journey.returnAfterMinutes = group.returnAfterMinutes;
    journey.venueDropoffPoint = group.venueDropoffPoint;
    journey.venueReturnMeetingPoint = group.venueReturnMeetingPoint;
    journey.londonAreaId = group.londonAreaId;
    journey.returnSeatCount = group.returnSeatCount || 0;
    journey.fourPassengerFallbackEnabled = false;
    journey.destinationMatchingEnabled = false;
    journey.destinationMatchingPublicEnabled = false;
    journey.customerVisible = false;
    return journey;
}
function eventShareUrl(slug) {
    if (!slug)
        return undefined;
    return `${exports.SHARE_PUBLIC_EVENT_BASE}/${slug}`;
}
function eventPublicStatusLabel(group) {
    if (group.status === "EXPIRED" || group.eventStatus === "DID_NOT_FILL")
        return "Did not fill";
    if (group.status === "CANCELLED" || group.eventStatus === "CANCELLED")
        return "Cancelled";
    if (group.status === "CONVERTED_TO_JOURNEY")
        return "Journey details being finalised";
    const remaining = Math.max(0, (group.minPassengerThreshold || exports.EVENT_PASSENGER_CAP) - (group.interestedSeatCount || 0));
    if (remaining === 0 || group.status === "READY_FOR_REVIEW")
        return "Journey details being finalised";
    if (remaining === 1)
        return "1 more passenger needed";
    return `${remaining} more passengers needed`;
}
function returnDepartureCopy(row) {
    if (row.returnDepartureBasis === "SPECIFIC_TIME" && row.returnDepartureTime) {
        return `Return departure ${row.returnDepartureTime}. Exact meeting instructions will be provided before travel.`;
    }
    const mins = Number(row.returnAfterMinutes || 45);
    return `Departure approximately ${mins} minutes after the event finishes. Exact meeting instructions will be provided before travel.`;
}
function eventAdvertText(group) {
    const fare = ((group.outboundFarePence || 0) / 100).toFixed(0);
    const url = eventShareUrl(group.eventSlug) || "https://www.spires-taxis.com/share";
    const cap = group.minPassengerThreshold || exports.EVENT_PASSENGER_CAP;
    return [
        group.eventName ? `Going to ${group.eventName}${group.venueName ? ` at ${group.venueName}` : ""}?` : `Travelling to ${group.venueName || group.destinationRegion}?`,
        "",
        "Spires Share is looking for passengers travelling from Oxford.",
        "",
        `Oxford → ${group.venueName || group.destinationRegion}`,
        group.eventDate || group.travelDate,
        `£${fare} per passenger`,
        `Maximum ${cap} passengers`,
        "",
        "Register your interest:",
        url,
        "",
        "Journey operates once the required passenger places are filled and confirmed.",
    ].join("\n");
}
function eventRevenuePreview(input) {
    const seats = clampEventPassengerCap(input.passengerLimit);
    const outboundPence = input.outboundFarePence * seats;
    if (!input.offerReturn) {
        return { outboundPence, note: "Full journey revenue if every required seat is taken. This is not profit." };
    }
    const pack = (0, routePricing_1.cityJourneyRequiresOwnFare)(input.returnFarePence) * seats;
    return {
        outboundPence,
        returnPackagePence: pack,
        note: "Return package revenue is the return fare times required seats. Do not add the outbound fare on top of the package.",
    };
}
function assertEventInterestOpen(group, nowIso) {
    if (group.journeyType === "EVENT" && group.eventPublished !== true) {
        throw new Error("This event is not open for interest yet.");
    }
    if (group.status !== "GATHERING_INTEREST" && group.status !== "READY_FOR_REVIEW") {
        throw new Error("This interest group is no longer open.");
    }
    if (group.interestDeadlineAt && new Date(group.interestDeadlineAt).getTime() <= new Date(nowIso).getTime()) {
        throw new Error("Registration closed.");
    }
}
function assertEventHasCapacity(group, extraSeats) {
    const cap = group.minPassengerThreshold || exports.EVENT_PASSENGER_CAP;
    if ((group.interestedSeatCount || 0) + extraSeats > cap) {
        throw new Error("This event is full. Join the waitlist if a place becomes available.");
    }
}
function assertEventTripType(group, tripType) {
    const selected = tripType === "RETURN" ? "RETURN" : "ONE_WAY";
    if (selected === "RETURN" && group.offerReturn !== true) {
        throw new Error("A return journey is not offered on this event.");
    }
    return selected;
}
function compatibleEventGroup(groups, request) {
    if (request.publicNumber) {
        return groups.find((row) => row.publicNumber === request.publicNumber) || null;
    }
    if (request.eventSlug) {
        return (groups.find((row) => row.eventSlug === request.eventSlug &&
            (row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW")) || null);
    }
    return null;
}
function eventPublicView(group, base) {
    const remaining = Math.max(0, (group.minPassengerThreshold || exports.EVENT_PASSENGER_CAP) - (group.interestedSeatCount || 0));
    return {
        ...(base || {}),
        eventName: group.eventName,
        venueName: group.venueName,
        eventDate: group.eventDate || group.travelDate,
        eventStartTime: group.eventStartTime,
        eventSlug: group.eventSlug,
        outboundFarePence: group.outboundFarePence,
        returnFarePence: group.returnFarePence,
        offerReturn: group.offerReturn === true,
        returnAfterMinutes: group.returnAfterMinutes,
        returnDepartureBasis: group.returnDepartureBasis,
        pickupLocation: group.pickupLocation || group.proposedDepartureLocation,
        suggestedDepartureTime: group.suggestedDepartureTime || group.preferredDepartureTime,
        publicStatusLabel: eventPublicStatusLabel(group),
        eventPublished: group.eventPublished === true,
        returnSeatCount: group.returnSeatCount || 0,
        eventShareUrl: eventShareUrl(group.eventSlug),
        remainingSeatsNeeded: remaining,
    };
}
function publicEventHasPii(value) {
    const json = JSON.stringify(value || {});
    return ["email", "mobile", "boardingCode", "paymentLinkUrl", "intendedDestinationText", "boardingVerifiedBy"].some((key) => json.includes(`"${key}":`));
}
function eventBoardingEnabled(journey) {
    return journey.journeyType === "EVENT" && journey.offerReturn === true;
}
function verifyEventLeg(journey, booking, actor, nowIso, eventLeg = "OUTBOUND") {
    if (eventLeg === "RETURN") {
        if (!eventBoardingEnabled(journey))
            throw new Error("This journey does not have a return leg.");
        if (booking.tripType !== "RETURN")
            throw new Error("This passenger is not travelling on the return.");
        if (booking.returnBoardStatus === "BOARDED" && booking.returnBoardedAt)
            return { ok: true, alreadyVerified: true };
        booking.returnBoardStatus = "BOARDED";
        booking.returnBoardedAt = nowIso;
        booking.returnBoardedBy = actor;
        return { ok: true };
    }
    if (booking.boardStatus === "BOARDED" && booking.boardingVerifiedAt)
        return { ok: true, alreadyVerified: true };
    booking.boardStatus = "BOARDED";
    booking.outboundBoardStatus = "BOARDED";
    booking.outboundBoardedAt = nowIso;
    booking.outboundBoardedBy = actor;
    booking.boardingVerifiedAt = nowIso;
    booking.boardingVerifiedBy = actor;
    return { ok: true };
}
function eventDriverManifest(journey, bookings) {
    const active = bookings.filter((row) => row.reservationStatus !== "CANCELLED" && row.reservationStatus !== "LATE_CANCELLED");
    const line = (row) => `${row.name}\nCode: ${row.boardingCode || "not issued"}\n${row.passengers} passenger${row.passengers === 1 ? "" : "s"}`;
    const outbound = active.map(line).join("\n\n");
    if (!eventBoardingEnabled(journey))
        return outbound;
    const returning = active.filter((row) => row.tripType === "RETURN");
    const returnLines = returning.map(line).join("\n\n") || "No return passengers.";
    const meeting = journey.venueReturnMeetingPoint || "Confirmed meeting instructions follow before travel.";
    const returnWhen = returnDepartureCopy(journey);
    return [
        journey.eventName ? `${journey.eventName}` : "Event",
        journey.venueName || "",
        "",
        "OUTBOUND",
        `${journey.originLabel || "Oxford"} → ${journey.venueName || journey.destinationLabel || ""}`,
        `Departure: ${journey.departureTime || ""}`,
        `Passengers: ${active.reduce((sum, row) => sum + row.passengers, 0)}`,
        "",
        outbound,
        "",
        "RETURN",
        `${journey.venueName || "Venue"} → ${journey.originLabel || "Oxford"}`,
        `Meeting: ${meeting}`,
        returnWhen,
        `Passengers: ${returning.reduce((sum, row) => sum + row.passengers, 0)}`,
        "",
        returnLines,
    ]
        .filter((row) => row !== undefined)
        .join("\n");
}
function eventInterestNotBooking() {
    return "This is not yet a confirmed booking. We will contact you if enough passengers register and an exact journey is proposed.";
}
exports.EVENT_FIVE_PASSENGER_COPY = "Spires Share deliberately limits each journey to five passengers, giving you more room and a more comfortable journey.";
exports.EVENT_POSITIONING_COPY = "Share the journey with a small group travelling to the same event. Maximum five passengers. More space and fewer passengers than a coach. Share the cost of private hire.";
