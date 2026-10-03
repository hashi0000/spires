import { bookingHoldsSeat } from "./logic";
import {
  DestinationMatchQuality,
  GEOCODING_PROVIDER_NEEDED,
  INTENDED_DESTINATION_HELP,
  JourneyStatus,
  JourneyType,
  LatLng,
  ROUTING_PROVIDER_NEEDED,
  ShareBooking,
  ShareDropoffHub,
  ShareJourney,
  SharedDropoffCustomerStatus,
} from "./types";

export type OccupancyStatusContext = {
  destinationMatchingEnabled?: boolean;
  proposedSharedDropoffHubId?: string;
  allHoldingAccepted?: boolean;
  minPassengerThreshold?: number;
};

export type DestinationInput = {
  intendedDestinationText: string;
  intendedDestinationPostcode?: string;
  intendedDestinationLat?: number;
  intendedDestinationLng?: number;
  sharedDropoffAcknowledged: boolean;
  preferredDepartureTime?: string;
  flexibleMinutes?: number;
  earliestDepartureTime?: string;
  latestDepartureTime?: string;
};

export type DestinationGeocoder = {
  geocode(query: string): Promise<LatLng | null>;
};

export type RouteEstimate = {
  distanceMetres: number;
  durationSeconds: number;
};

export type RouteEstimator = {
  estimate(from: LatLng, to: LatLng): Promise<RouteEstimate | null>;
};

export const UNIMPLEMENTED_GEOCODER: DestinationGeocoder = {
  async geocode() {
    return null;
  },
};

export const UNIMPLEMENTED_ROUTER: RouteEstimator = {
  async estimate() {
    return null;
  },
};

export type HubScore = {
  hubId: string;
  name: string;
  displayName: string;
  enabled: boolean;
  quality: DestinationMatchQuality;
  meanDistanceMetres: number | null;
  maxDistanceMetres: number | null;
  passengersWithCoordinates: number;
  passengersTotal: number;
  passengersReasonablyServed: number;
  reason: string;
  selectable: boolean;
};

export type DestinationCluster = {
  clusterId: string;
  bookingIds: string[];
  quality: DestinationMatchQuality;
  suggestedHubId?: string;
};

export type MatchingResult = {
  overallQuality: DestinationMatchQuality;
  hubScores: HubScore[];
  clusters: DestinationCluster[];
  routingAvailable: boolean;
  geocodingAvailable: boolean;
  notes: string[];
};

export function journeyTypeOf(journey: Pick<ShareJourney, "journeyType" | "airportId">): JourneyType {
  if (journey.journeyType) return journey.journeyType;
  if (String(journey.airportId || "").startsWith("city:")) return "CITY";
  return "AIRPORT";
}

export function destinationMatchingEnabled(
  journey: Pick<ShareJourney, "destinationMatchingEnabled" | "journeyType" | "airportId">
): boolean {
  return journey.destinationMatchingEnabled === true;
}

export function cityRouteKey(originCity: string, destinationCity: string): string {
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

export function cityMatchingPublicBlocked(
  journey: Pick<ShareJourney, "journeyType" | "destinationMatchingEnabled" | "destinationMatchingPublicEnabled" | "airportId">,
  cityMatchingPublicEnabled = false
): boolean {
  if (journey.destinationMatchingPublicEnabled === true && cityMatchingPublicEnabled) return false;
  return destinationMatchingEnabled(journey) || journeyTypeOf(journey) === "CITY";
}

export function parseOptionalCoordinate(value: unknown): number | undefined {
  if (value == null || value === "") return undefined;
  const n = Number(value);
  if (!Number.isFinite(n)) return undefined;
  return n;
}

export function requireIntendedDestination(input: Partial<DestinationInput>, destinationCity = "London"): DestinationInput {
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

export function destinationFieldsForBooking(input: DestinationInput, nowIso: string): Partial<ShareBooking> {
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

export function currentProposalVersion(journey: Pick<ShareJourney, "sharedDropoffProposalVersion">): number {
  return Number(journey.sharedDropoffProposalVersion || 0);
}

export function proposedHubId(journey: Pick<ShareJourney, "proposedSharedDropoffHubId" | "confirmedSharedDropoffHubId">): string {
  return String(journey.proposedSharedDropoffHubId || journey.confirmedSharedDropoffHubId || "");
}

export function hasAcceptedCurrentProposal(
  booking: Pick<ShareBooking, "acceptedDropoffProposalVersion" | "sharedDropoffAcceptedAt" | "sharedDropoffDeclinedAt" | "reservationStatus">,
  journey: Pick<ShareJourney, "sharedDropoffProposalVersion">
): boolean {
  const version = currentProposalVersion(journey);
  if (version < 1) return false;
  if (booking.reservationStatus === "DROP_OFF_DECLINED" || booking.sharedDropoffDeclinedAt) return false;
  if (!booking.sharedDropoffAcceptedAt) return false;
  return Number(booking.acceptedDropoffProposalVersion || 0) === version;
}

export function passengerSharedDropoffStatus(
  journey: Pick<ShareJourney, "sharedDropoffProposalVersion" | "proposedSharedDropoffHubId" | "confirmedSharedDropoffHubId">,
  booking: Pick<ShareBooking, "sharedDropoffAcceptedAt" | "sharedDropoffDeclinedAt" | "acceptedDropoffProposalVersion" | "reservationStatus">
): SharedDropoffCustomerStatus {
  if (booking.reservationStatus === "DROP_OFF_DECLINED" || booking.sharedDropoffDeclinedAt) return "DECLINED";
  if (hasAcceptedCurrentProposal(booking, journey)) return "ACCEPTED";
  if (proposedHubId(journey)) return "PROPOSED";
  return "NOT_SELECTED";
}

export function holdingBookings(bookings: ShareBooking[]): ShareBooking[] {
  return bookings.filter((row) => bookingHoldsSeat(row));
}

export function allHoldingAcceptedCurrentProposal(journey: ShareJourney, bookings: ShareBooking[]): boolean {
  const holding = holdingBookings(bookings);
  return holding.length > 0 && holding.every((row) => hasAcceptedCurrentProposal(row, journey));
}

export function acceptedDropoffPlaces(journey: ShareJourney, bookings: ShareBooking[]): number {
  return holdingBookings(bookings)
    .filter((row) => hasAcceptedCurrentProposal(row, journey))
    .reduce((sum, row) => sum + (row.passengers || 0), 0);
}

export function matchingOccupancyContext(journey: ShareJourney, bookings: ShareBooking[]): OccupancyStatusContext | undefined {
  if (!destinationMatchingEnabled(journey)) return undefined;
  return {
    destinationMatchingEnabled: true,
    proposedSharedDropoffHubId: proposedHubId(journey) || undefined,
    allHoldingAccepted: allHoldingAcceptedCurrentProposal(journey, bookings),
    minPassengerThreshold: journey.minPassengerThreshold || Math.max(1, journey.capacity - 1),
  };
}

export function matchingAwareJourneyStatus(
  occupied: number,
  capacity: number,
  current: JourneyStatus,
  paymentStageStatus: "NOT_CREATED" | "LINK_SAVED" | "OPEN" | "CLOSED",
  matching: OccupancyStatusContext | undefined,
  fallback: (
    occupied: number,
    capacity: number,
    current: JourneyStatus,
    paymentStageStatus: "NOT_CREATED" | "LINK_SAVED" | "OPEN" | "CLOSED"
  ) => JourneyStatus
): JourneyStatus {
  if (current === "CANCELLED" || current === "EXPIRED" || current === "COMPLETED" || current === "CONFIRMED") {
    return current;
  }
  if (!matching?.destinationMatchingEnabled || paymentStageStatus === "OPEN") {
    return fallback(occupied, capacity, current, paymentStageStatus);
  }
  const threshold = matching.minPassengerThreshold ?? Math.max(1, capacity - 1);
  if (occupied <= 0) return "GATHERING_INTEREST";
  if (occupied < threshold) return "GATHERING_INTEREST";
  if (!matching.proposedSharedDropoffHubId) return "AWAITING_DROPOFF_SELECTION";
  if (matching.allHoldingAccepted) return "READY_FOR_PAYMENT_SETUP";
  return "AWAITING_DROPOFF_ACCEPTANCE";
}

export function canPassengerEnterPayment(journey: ShareJourney, booking: ShareBooking): boolean {
  if (!destinationMatchingEnabled(journey)) return true;
  return hasAcceptedCurrentProposal(booking, journey);
}

export function assertCanOpenPaymentWindow(journey: ShareJourney, bookings: ShareBooking[]): void {
  if (!destinationMatchingEnabled(journey)) return;
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

export function paymentSensitiveForDropoffChange(journey: ShareJourney, bookings: ShareBooking[]): boolean {
  if (journey.paymentStageStatus === "OPEN" || journey.paymentStageStatus === "CLOSED") return true;
  return bookings.some(
    (row) =>
      row.reservationStatus === "PAID" ||
      row.reservationStatus === "PAYMENT_PENDING" ||
      (row.paidAmountPence || 0) > 0
  );
}

export function assertHubSelectable(hub: ShareDropoffHub | undefined, hubId: string): ShareDropoffHub {
  if (!hub || (hub.hubId !== hubId && hub.id !== hubId)) {
    throw new Error("Choose a shared drop off hub.");
  }
  if (!hub.enabled) {
    throw new Error("That shared drop off hub is not enabled.");
  }
  return hub;
}

export function intendedDestinationPrivacyFields(): string[] {
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

export function publicDtoHasPrivateDestinations(value: unknown): boolean {
  const json = JSON.stringify(value || {});
  return [
    "intendedDestinationText",
    "intendedDestinationPostcode",
    "intendedDestinationLat",
    "intendedDestinationLng",
    "destinationEnteredAt",
  ].some((key) => json.includes(`"${key}"`));
}

export function haversineMetres(a: LatLng, b: LatLng): number {
  const toRad = (deg: number) => (deg * Math.PI) / 180;
  const earth = 6371000;
  const dLat = toRad(b.lat - a.lat);
  const dLng = toRad(b.lng - a.lng);
  const lat1 = toRad(a.lat);
  const lat2 = toRad(b.lat);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * earth * Math.asin(Math.min(1, Math.sqrt(h)));
}

function hubCoordinates(hub: ShareDropoffHub): LatLng | null {
  if (!Number.isFinite(hub.latitude) || !Number.isFinite(hub.longitude)) return null;
  return { lat: Number(hub.latitude), lng: Number(hub.longitude) };
}

function bookingCoordinates(booking: ShareBooking): LatLng | null {
  if (!Number.isFinite(booking.intendedDestinationLat) || !Number.isFinite(booking.intendedDestinationLng)) return null;
  return { lat: Number(booking.intendedDestinationLat), lng: Number(booking.intendedDestinationLng) };
}

function qualityFromSpread(maxMetres: number | null, withCoords: number, total: number): DestinationMatchQuality {
  if (!withCoords || withCoords < total || maxMetres == null) return "MANUAL_REVIEW";
  if (maxMetres <= 4000) return "GOOD_MATCH";
  if (maxMetres <= 9000) return "ACCEPTABLE_MATCH";
  return "POOR_MATCH";
}

export function rankSharedDropoffHubs(
  bookings: ShareBooking[],
  hubs: ShareDropoffHub[],
  options?: { geocoder?: DestinationGeocoder; router?: RouteEstimator }
): MatchingResult {
  const holding = holdingBookings(bookings);
  const notes = [GEOCODING_PROVIDER_NEEDED, ROUTING_PROVIDER_NEEDED];
  const geocodingAvailable = Boolean(options?.geocoder && options.geocoder !== UNIMPLEMENTED_GEOCODER);
  const routingAvailable = Boolean(options?.router && options.router !== UNIMPLEMENTED_ROUTER);
  const coords = holding.map(bookingCoordinates);
  const withCoords = coords.filter(Boolean).length;
  const pairwise: number[] = [];
  for (let i = 0; i < coords.length; i += 1) {
    for (let j = i + 1; j < coords.length; j += 1) {
      const a = coords[i];
      const b = coords[j];
      if (a && b) pairwise.push(haversineMetres(a, b));
    }
  }
  const spread = pairwise.length ? Math.max(...pairwise) : null;
  const overallQuality = qualityFromSpread(spread, withCoords, holding.length);
  const hubScores: HubScore[] = hubs.map((hub) => {
    const hubPoint = hubCoordinates(hub);
    const distances = hubPoint
      ? coords.map((point) => (point ? haversineMetres(point, hubPoint) : null)).filter((row): row is number => row != null)
      : [];
    const mean = distances.length ? distances.reduce((sum, n) => sum + n, 0) / distances.length : null;
    const max = distances.length ? Math.max(...distances) : null;
    const served = distances.filter((n) => n <= 5000).length;
    const quality =
      !hub.enabled || !distances.length ? "MANUAL_REVIEW" : qualityFromSpread(max, distances.length, holding.length);
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
    if (a.selectable !== b.selectable) return a.selectable ? -1 : 1;
    if (a.meanDistanceMetres != null && b.meanDistanceMetres != null) return a.meanDistanceMetres - b.meanDistanceMetres;
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

export function applyMatchingSuggestion(journey: ShareJourney, result: MatchingResult): Partial<ShareJourney> {
  const best = result.hubScores.find((row) => row.selectable);
  return {
    suggestedSharedDropoffHubId: best?.hubId,
    suggestedSharedDropoffReason: best
      ? `${result.overallQuality}. ${best.reason}`
      : "No enabled shared drop off hubs are available.",
  };
}

export function adminDestinationSummary(journey: ShareJourney, bookings: ShareBooking[], hubs: ShareDropoffHub[]) {
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

export function proposedDropoffCustomerNotice(
  journey: Pick<ShareJourney, "proposedSharedDropoffDisplayName" | "destinationCity">,
  intendedDestinationText?: string
): string {
  const hub = journey.proposedSharedDropoffDisplayName || "the proposed shared drop off";
  const intended = intendedDestinationText || "the destination you entered";
  return `Based on the destinations entered by passengers, ${hub} has been selected as the proposed shared drop off for this journey. Your intended destination: ${intended}. You will need to make your own onward journey from ${hub}.`;
}

export function intendedDestinationPrompt(destinationCity = "London"): string {
  return `Where in ${destinationCity} are you travelling to?`;
}

export { INTENDED_DESTINATION_HELP };
