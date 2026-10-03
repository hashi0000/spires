import { cityJourneyRequiresOwnFare } from "./routePricing";
import {
  EventLeg,
  EventReturnBasis,
  EventShareFields,
  EventStatus,
  EventTripType,
  PublicInterestGroupView,
  ShareBooking,
  ShareConfig,
  ShareInterestEntry,
  ShareInterestGroup,
  ShareJourney,
  ShareLondonArea,
  ShareVenue,
} from "./types";

export const EVENT_PASSENGER_CAP = 5;
export const SHARE_PUBLIC_EVENT_BASE = "https://www.spires-taxis.com/share/event";

export type EventOpportunityInput = {
  eventName: string;
  venueName: string;
  venueAddress?: string;
  eventDate: string;
  eventStartTime: string;
  expectedFinishTime?: string;
  eventUrl?: string;
  eventImageUrl?: string;
  eventCategory?: string;
  origin?: string;
  pickupLocation?: string;
  destination?: string;
  suggestedDepartureTime?: string;
  outboundFarePence?: number;
  returnFarePence?: number;
  offerReturn?: boolean;
  returnDepartureBasis?: EventReturnBasis;
  returnDepartureTime?: string;
  returnAfterMinutes?: number;
  passengerLimit?: number;
  interestDeadlineAt?: string;
  venueDropoffPoint?: string;
  venueReturnMeetingPoint?: string;
  londonAreaId?: ShareLondonArea["id"];
  publish?: boolean;
  venueId?: string;
};

export function defaultLondonShareAreas(config?: Pick<ShareConfig, "londonShareAreas">): ShareLondonArea[] {
  return config?.londonShareAreas?.length
    ? config.londonShareAreas
    : [
        { id: "london_west", name: "London West", defaultShareFarePenceMin: 3500, defaultShareFarePenceMax: 4000 },
        { id: "london_central", name: "London Central", defaultShareFarePenceMin: 4000, defaultShareFarePenceMax: 4500 },
        { id: "london_east", name: "London East", defaultShareFarePenceMin: 4500, defaultShareFarePenceMax: 5000 },
        { id: "london_extended", name: "London Extended", defaultShareFarePenceMin: 5000, defaultShareFarePenceMax: 6000 },
      ];
}

export function defaultShareVenues(config?: Pick<ShareConfig, "shareVenues">): ShareVenue[] {
  return config?.shareVenues?.length ? config.shareVenues : [];
}

export function eventSlugFrom(eventName: string, venueName: string, eventDate: string): string {
  const raw = `${eventName}-${venueName}-${eventDate}`
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .slice(0, 80);
  return raw || `event-${eventDate}`;
}

export function isPublishedEvent(group: Pick<ShareInterestGroup, "journeyType" | "eventPublished" | "eventStatus" | "status">): boolean {
  if (group.journeyType !== "EVENT") return false;
  if (group.eventPublished === false) return false;
  if (group.eventStatus && group.eventStatus !== "PUBLISHED") return false;
  return group.eventPublished === true && (group.status === "GATHERING_INTEREST" || group.status === "READY_FOR_REVIEW");
}

export function isEventDraft(group: Pick<ShareInterestGroup, "journeyType" | "eventPublished" | "eventStatus">): boolean {
  return group.journeyType === "EVENT" && (group.eventPublished !== true || group.eventStatus === "DRAFT");
}

export function eventPublicListingAllowed(group: ShareInterestGroup): boolean {
  return isPublishedEvent(group);
}

export function clampEventPassengerCap(value: number | undefined, configCap = EVENT_PASSENGER_CAP): number {
  const cap = Number(value) || configCap || EVENT_PASSENGER_CAP;
  if (cap < 1) return 1;
  if (cap > EVENT_PASSENGER_CAP) return EVENT_PASSENGER_CAP;
  return cap;
}

export function fareFromLondonArea(
  areas: ShareLondonArea[] | undefined,
  areaId: ShareLondonArea["id"] | undefined
): number | undefined {
  const area = (areas || []).find((row) => row.id === areaId);
  if (!area) return undefined;
  return area.defaultShareFarePenceMin;
}

export function applyVenueDefaults(input: EventOpportunityInput, config: Pick<ShareConfig, "shareVenues" | "londonShareAreas" | "meetingPoint">): EventOpportunityInput {
  const venue = defaultShareVenues(config).find((row) => row.id === input.venueId || row.name === input.venueName);
  if (!venue) return input;
  const areaFare = fareFromLondonArea(config.londonShareAreas, venue.londonAreaId);
  return {
    ...input,
    venueName: input.venueName || venue.name,
    venueAddress: input.venueAddress || venue.venueAddress,
    pickupLocation: input.pickupLocation || venue.defaultPickup || config.meetingPoint?.publicName,
    destination: input.destination || venue.name,
    outboundFarePence: input.outboundFarePence || venue.defaultFarePence || areaFare,
    returnFarePence: input.returnFarePence || venue.defaultReturnFarePence,
    passengerLimit: input.passengerLimit || venue.defaultPassengerCap || EVENT_PASSENGER_CAP,
    venueDropoffPoint: input.venueDropoffPoint || venue.venueDropoffPoint,
    venueReturnMeetingPoint: input.venueReturnMeetingPoint || venue.returnMeetingPoint,
    londonAreaId: input.londonAreaId || venue.londonAreaId,
    eventCategory: input.eventCategory || venue.eventCategory,
  };
}

export function eventFarePence(input: { outboundFarePence?: number; farePence?: number }): number {
  return cityJourneyRequiresOwnFare(Number(input.outboundFarePence || input.farePence || 0) || undefined);
}

export function eventAmountDuePence(
  tripType: EventTripType | undefined,
  outboundFarePence: number,
  returnFarePence: number | undefined,
  passengers: number
): number {
  const fare = tripType === "RETURN" ? cityJourneyRequiresOwnFare(returnFarePence) : outboundFarePence;
  return fare * passengers;
}

export function returnSeatCountFrom(entries: Array<Pick<ShareInterestEntry, "status" | "passengers" | "tripType">>): number {
  return entries
    .filter((row) => row.status === "ACTIVE" && row.tripType === "RETURN")
    .reduce((sum, row) => sum + Number(row.passengers || 0), 0);
}

export function eventFieldsFromInput(input: EventOpportunityInput, farePence: number): EventShareFields {
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
    returnFarePence: offerReturn ? cityJourneyRequiresOwnFare(input.returnFarePence) : undefined,
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

export function copyEventFieldsToJourney(group: ShareInterestGroup, journey: ShareJourney): ShareJourney {
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

export function eventShareUrl(slug?: string): string | undefined {
  if (!slug) return undefined;
  return `${SHARE_PUBLIC_EVENT_BASE}/${slug}`;
}

export function eventPublicStatusLabel(group: ShareInterestGroup): string {
  if (group.status === "EXPIRED" || group.eventStatus === "DID_NOT_FILL") return "Did not fill";
  if (group.status === "CANCELLED" || group.eventStatus === "CANCELLED") return "Cancelled";
  if (group.status === "CONVERTED_TO_JOURNEY") return "Journey details being finalised";
  const remaining = Math.max(0, (group.minPassengerThreshold || EVENT_PASSENGER_CAP) - (group.interestedSeatCount || 0));
  if (remaining === 0 || group.status === "READY_FOR_REVIEW") return "Journey details being finalised";
  if (remaining === 1) return "1 more passenger needed";
  return `${remaining} more passengers needed`;
}

export function returnDepartureCopy(row: Pick<ShareJourney | ShareInterestGroup, "returnDepartureBasis" | "returnDepartureTime" | "returnAfterMinutes">): string {
  if (row.returnDepartureBasis === "SPECIFIC_TIME" && row.returnDepartureTime) {
    return `Return departure ${row.returnDepartureTime}. Exact meeting instructions will be provided before travel.`;
  }
  const mins = Number(row.returnAfterMinutes || 45);
  return `Departure approximately ${mins} minutes after the event finishes. Exact meeting instructions will be provided before travel.`;
}

export function eventAdvertText(group: ShareInterestGroup): string {
  const fare = ((group.outboundFarePence || 0) / 100).toFixed(0);
  const url = eventShareUrl(group.eventSlug) || "https://www.spires-taxis.com/share";
  const cap = group.minPassengerThreshold || EVENT_PASSENGER_CAP;
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

export function eventRevenuePreview(input: {
  outboundFarePence: number;
  returnFarePence?: number;
  offerReturn?: boolean;
  passengerLimit: number;
}): { outboundPence: number; returnPackagePence?: number; note: string } {
  const seats = clampEventPassengerCap(input.passengerLimit);
  const outboundPence = input.outboundFarePence * seats;
  if (!input.offerReturn) {
    return { outboundPence, note: "Full journey revenue if every required seat is taken. This is not profit." };
  }
  const pack = cityJourneyRequiresOwnFare(input.returnFarePence) * seats;
  return {
    outboundPence,
    returnPackagePence: pack,
    note: "Return package revenue is the return fare times required seats. Do not add the outbound fare on top of the package.",
  };
}

export function assertEventInterestOpen(group: ShareInterestGroup, nowIso: string): void {
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

export function assertEventHasCapacity(group: ShareInterestGroup, extraSeats: number): void {
  const cap = group.minPassengerThreshold || EVENT_PASSENGER_CAP;
  if ((group.interestedSeatCount || 0) + extraSeats > cap) {
    throw new Error("This event is full. Join the waitlist if a place becomes available.");
  }
}

export function assertEventTripType(group: ShareInterestGroup, tripType: EventTripType | undefined): EventTripType {
  const selected = tripType === "RETURN" ? "RETURN" : "ONE_WAY";
  if (selected === "RETURN" && group.offerReturn !== true) {
    throw new Error("A return journey is not offered on this event.");
  }
  return selected;
}

export function compatibleEventGroup(
  groups: ShareInterestGroup[],
  request: { origin: string; destinationRegion: string; travelDate: string; eventSlug?: string; publicNumber?: string }
): ShareInterestGroup | null {
  if (request.publicNumber) {
    return groups.find((row) => row.publicNumber === request.publicNumber) || null;
  }
  if (request.eventSlug) {
    return (
      groups.find(
        (row) =>
          row.eventSlug === request.eventSlug &&
          (row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW")
      ) || null
    );
  }
  return null;
}

export function eventPublicView(group: ShareInterestGroup, base?: PublicInterestGroupView): Record<string, unknown> {
  const remaining = Math.max(0, (group.minPassengerThreshold || EVENT_PASSENGER_CAP) - (group.interestedSeatCount || 0));
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

export function publicEventHasPii(value: unknown): boolean {
  const json = JSON.stringify(value || {});
  return ["email", "mobile", "boardingCode", "paymentLinkUrl", "intendedDestinationText", "boardingVerifiedBy"].some(
    (key) => json.includes(`"${key}":`)
  );
}

export function eventBoardingEnabled(journey: Pick<ShareJourney, "journeyType" | "offerReturn">): boolean {
  return journey.journeyType === "EVENT" && journey.offerReturn === true;
}

export function verifyEventLeg(
  journey: ShareJourney,
  booking: ShareBooking,
  actor: string,
  nowIso: string,
  eventLeg: EventLeg = "OUTBOUND"
): { ok: true; alreadyVerified?: boolean } {
  if (eventLeg === "RETURN") {
    if (!eventBoardingEnabled(journey)) throw new Error("This journey does not have a return leg.");
    if (booking.tripType !== "RETURN") throw new Error("This passenger is not travelling on the return.");
    if (booking.returnBoardStatus === "BOARDED" && booking.returnBoardedAt) return { ok: true, alreadyVerified: true };
    booking.returnBoardStatus = "BOARDED";
    booking.returnBoardedAt = nowIso;
    booking.returnBoardedBy = actor;
    return { ok: true };
  }
  if (booking.boardStatus === "BOARDED" && booking.boardingVerifiedAt) return { ok: true, alreadyVerified: true };
  booking.boardStatus = "BOARDED";
  booking.outboundBoardStatus = "BOARDED";
  booking.outboundBoardedAt = nowIso;
  booking.outboundBoardedBy = actor;
  booking.boardingVerifiedAt = nowIso;
  booking.boardingVerifiedBy = actor;
  return { ok: true };
}

export function eventDriverManifest(journey: ShareJourney, bookings: ShareBooking[]): string {
  const active = bookings.filter((row) => row.reservationStatus !== "CANCELLED" && row.reservationStatus !== "LATE_CANCELLED");
  const line = (row: ShareBooking) =>
    `${row.name}\nCode: ${row.boardingCode || "not issued"}\n${row.passengers} passenger${row.passengers === 1 ? "" : "s"}`;
  const outbound = active.map(line).join("\n\n");
  if (!eventBoardingEnabled(journey)) return outbound;
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

export function eventInterestNotBooking(): string {
  return "This is not yet a confirmed booking. We will contact you if enough passengers register and an exact journey is proposed.";
}

export const EVENT_FIVE_PASSENGER_COPY =
  "Spires Share deliberately limits each journey to five passengers, giving you more room and a more comfortable journey.";

export const EVENT_POSITIONING_COPY =
  "Share the journey with a small group travelling to the same event. Maximum five passengers. More space and fewer passengers than a coach. Share the cost of private hire.";
