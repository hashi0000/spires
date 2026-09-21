import {
  Flexibility,
  HomeCollectionEligibility,
  JourneyStatus,
  LuggageDeclaration,
  PublicJourneyView,
  ShareAirport,
  ShareBooking,
  ShareConfig,
  ShareJourney,
  ShareSearchRequest,
  UNCONFIRMED_WARNING,
} from "./types";

export function penceToGbp(pence: number): string {
  return `£${(pence / 100).toFixed(2)}`;
}

export function flexibilityMinutes(flex: Flexibility): number {
  if (flex === "plus_minus_15") return 15;
  if (flex === "plus_minus_30") return 30;
  if (flex === "plus_minus_60") return 60;
  return 0;
}

export function parseHmToMinutes(hhmm: string): number | null {
  const match = /^(\d{1,2}):(\d{2})$/.exec((hhmm || "").trim());
  if (!match) return null;
  const h = Number(match[1]);
  const m = Number(match[2]);
  if (h < 0 || h > 23 || m < 0 || m > 59) return null;
  return h * 60 + m;
}

export function minutesToHm(total: number): string {
  const wrapped = ((total % (24 * 60)) + 24 * 60) % (24 * 60);
  const h = Math.floor(wrapped / 60);
  const m = wrapped % 60;
  return `${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`;
}

export function canAddPassengers(occupied: number, adding: number, capacity: number): boolean {
  return Number.isInteger(adding) && adding > 0 && occupied >= 0 && occupied + adding <= capacity;
}

export function occupancyLabel(occupied: number, capacity: number): string {
  return `${occupied}/${capacity}`;
}

export function remainingSeats(occupied: number, capacity: number): number {
  return Math.max(0, capacity - occupied);
}

export function statusFromOccupancy(
  occupied: number,
  capacity: number,
  current: JourneyStatus
): JourneyStatus {
  if (
    current === "CANCELLED" ||
    current === "EXPIRED" ||
    current === "COMPLETED" ||
    current === "CONFIRMED" ||
    current === "AWAITING_EARLY_DEPARTURE_DECISION"
  ) {
    return current;
  }
  if (occupied <= 0) return "PROPOSED";
  if (occupied >= capacity) return "FULL";
  if (occupied === capacity - 1) return "ALMOST_FULL";
  if (occupied === 1) return "PROPOSED";
  return "FILLING";
}

/** Equal split of target revenue. Never invent a hardcoded early-departure fare. */
export function earlyDepartureFarePence(targetRevenuePence: number, travellingPassengers: number): number {
  if (travellingPassengers <= 0) {
    throw new Error("travellingPassengers must be greater than zero");
  }
  return Math.round(targetRevenuePence / travellingPassengers);
}

export function earlyDepartureEligible(
  occupied: number,
  capacity: number,
  threshold: number,
  alreadyConfirmed: boolean
): boolean {
  return !alreadyConfirmed && occupied === threshold && threshold === capacity - 1 && occupied < capacity;
}

export function earlyDepartureConfirmed(acceptedCount: number, travellingPassengers: number): boolean {
  return travellingPassengers > 0 && acceptedCount === travellingPassengers;
}

export function timesCompatible(
  requestedHm: string,
  existingHm: string,
  flexibility: Flexibility
): boolean {
  const requested = parseHmToMinutes(requestedHm);
  const existing = parseHmToMinutes(existingHm);
  if (requested == null || existing == null) return false;
  return Math.abs(requested - existing) <= flexibilityMinutes(flexibility);
}

export function estimatedArrivalHm(departureHm: string, durationMinutes: number): string {
  const start = parseHmToMinutes(departureHm);
  if (start == null) return "";
  return minutesToHm(start + durationMinutes);
}

export function flightCompatible(
  departureHm: string,
  durationMinutes: number,
  flightDepartureHm: string | undefined,
  bufferMinutes: number
): boolean {
  if (!flightDepartureHm) return true;
  const arrive = parseHmToMinutes(estimatedArrivalHm(departureHm, durationMinutes));
  const flight = parseHmToMinutes(flightDepartureHm);
  const depart = parseHmToMinutes(departureHm);
  if (arrive == null || flight == null || depart == null) return false;
  let flightMinutes = flight;
  // Without a flight date, only treat the flight as next-day when it is earlier than departure.
  if (flightMinutes < depart) flightMinutes += 24 * 60;
  let arriveMinutes = arrive;
  if (arriveMinutes < depart) arriveMinutes += 24 * 60;
  return arriveMinutes + bufferMinutes <= flightMinutes;
}

export function luggageFits(
  existing: LuggageDeclaration[],
  incoming: LuggageDeclaration,
  maxLarge: number,
  maxCabin: number
): boolean {
  const large = existing.reduce((sum, row) => sum + (row.largeSuitcases || 0), 0) + (incoming.largeSuitcases || 0);
  const cabin = existing.reduce((sum, row) => sum + (row.cabinBags || 0), 0) + (incoming.cabinBags || 0);
  return large <= maxLarge && cabin <= maxCabin;
}

export function paymentSecuresSeat(status: string): boolean {
  return status === "AUTHORISED" || status === "CAPTURE_PENDING" || status === "CAPTURED";
}

export function airportById(config: ShareConfig, airportId: string): ShareAirport | undefined {
  return config.airports.find((row) => row.id === airportId);
}

export function toPublicJourney(
  journey: ShareJourney,
  config: ShareConfig
): PublicJourneyView {
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
    warning: confirmed ? undefined : UNCONFIRMED_WARNING,
  };
}

export function matchJourneys(
  request: ShareSearchRequest,
  journeys: ShareJourney[],
  config: ShareConfig,
  bookingsByJourney: Record<string, ShareBooking[]>
): ShareJourney[] {
  const airport = airportById(config, request.airportId);
  if (!airport) return [];
  return journeys.filter((journey) => {
    if (journey.airportId !== request.airportId) return false;
    if (journey.travelDate !== request.travelDate) return false;
    if (journey.status === "CANCELLED" || journey.status === "EXPIRED" || journey.status === "COMPLETED") {
      return false;
    }
    if (!canAddPassengers(journey.occupiedSeats, request.passengers, journey.capacity)) return false;
    if (!timesCompatible(request.preferredDepartureTime, journey.departureTime, request.flexibility)) {
      return false;
    }
    if (
      !flightCompatible(
        journey.departureTime,
        airport.estimatedDurationMinutes,
        request.flightDepartureTime,
        airport.flightSafetyBufferMinutes
      )
    ) {
      return false;
    }
    const existingLuggage = (bookingsByJourney[journey.id] || []).map((row) => row.luggage);
    return luggageFits(
      existingLuggage,
      request.luggage,
      config.luggage.maxLargeSuitcasesPerVehicle,
      config.luggage.maxCabinBagsPerVehicle
    );
  });
}

export function publicHomeCollectionMessage(
  eligibility: HomeCollectionEligibility,
  surchargePence: number
): string {
  if (eligibility === "HOME_COLLECTION_ELIGIBLE") return "Home collection available";
  if (eligibility === "HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE") {
    return `Home collection available +${penceToGbp(surchargePence)}`;
  }
  return "Home collection is unavailable for this journey. Please board at Thornhill Park & Ride.";
}

/** Dev stub: never uses a private origin. Postcode presence only. */
export function evaluateHomeCollection(
  postcode: string | undefined,
  currentHomeCollections: number,
  maxHomeCollections: number,
  surchargePence: number
): { eligibility: HomeCollectionEligibility; surchargePence: number; message: string } {
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
  const eligibility: HomeCollectionEligibility =
    surchargePence > 0 ? "HOME_COLLECTION_ELIGIBLE_WITH_SURCHARGE" : "HOME_COLLECTION_ELIGIBLE";
  return {
    eligibility,
    surchargePence,
    message: publicHomeCollectionMessage(eligibility, surchargePence),
  };
}

export function acceptedPassengerCount(
  bookings: Array<{ earlyDepartureAccepted?: boolean; passengers?: number }>
): number {
  return bookings
    .filter((row) => row.earlyDepartureAccepted)
    .reduce((sum, row) => sum + (row.passengers || 0), 0);
}

export function canMovePassengers(
  fromOccupied: number,
  toOccupied: number,
  moving: number,
  toCapacity: number
): boolean {
  return moving > 0 && fromOccupied >= moving && canAddPassengers(toOccupied, moving, toCapacity);
}

export function mockCaptureIfAuthorised(status: string): string {
  if (status === "CAPTURED") return "CAPTURED";
  if (status === "AUTHORISED" || status === "CAPTURE_PENDING") return "CAPTURED";
  return status;
}

export function mockReleaseIfOpen(status: string): string {
  if (status === "CAPTURED" || status === "REFUNDED") return status;
  if (
    status === "AUTHORISED" ||
    status === "CAPTURE_PENDING" ||
    status === "AUTHORISATION_PENDING" ||
    status === "PAYMENT_METHOD_PENDING"
  ) {
    return "AUTHORISATION_RELEASED";
  }
  return status;
}

export function nextCompatibleWaitlistOffer<T extends { status: string; passengers: number; createdAt: string }>(
  entries: T[],
  remaining: number
): T | null {
  if (remaining <= 0) return null;
  if (entries.some((row) => row.status === "OFFERED")) return null;
  return (
    entries
      .filter((row) => row.status === "WAITLISTED" && row.passengers <= remaining)
      .sort((a, b) => a.createdAt.localeCompare(b.createdAt))[0] || null
  );
}

export function stripPrivateFields<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
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
  const out: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    if (blocked.includes(key)) continue;
    out[key] = value;
  }
  return out;
}

export interface PaymentProvider {
  authorise(id: string, amountPence: number, succeed?: boolean): { id: string; status: string };
  capture(id: string): { id: string; status: string };
  release(id: string): { id: string; status: string };
}

/** Future Shift4 (or other) adapters implement PaymentProvider. No live card calls. */
export class MockPaymentProvider implements PaymentProvider {
  constructor(private store: Map<string, { status: string; amountPence: number }> = new Map()) {}

  authorise(id: string, amountPence: number, succeed = true): { id: string; status: string } {
    if (!succeed) {
      this.store.set(id, { status: "FAILED", amountPence });
      return { id, status: "FAILED" };
    }
    this.store.set(id, { status: "AUTHORISED", amountPence });
    return { id, status: "AUTHORISED" };
  }

  capture(id: string): { id: string; status: string } {
    const row = this.store.get(id);
    if (!row || row.status !== "AUTHORISED") return { id, status: row?.status || "FAILED" };
    const next = { ...row, status: "CAPTURED" };
    this.store.set(id, next);
    return { id, status: next.status };
  }

  release(id: string): { id: string; status: string } {
    const row = this.store.get(id);
    if (!row) return { id, status: "FAILED" };
    if (row.status === "CAPTURED") return { id, status: "CAPTURED" };
    const next = { ...row, status: "AUTHORISATION_RELEASED" };
    this.store.set(id, next);
    return { id, status: next.status };
  }

  get(id: string) {
    return this.store.get(id) || null;
  }
}
