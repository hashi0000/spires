import servicePolicy from "../data/servicePolicy.json";

/** Central airport collection waiting policy. Change here, not in PDF or website copy. */
export const AIRPORT_WAITING_POLICY = {
  freeMinutesAfterActualLanding: 50,
  chargeBlockMinutes: 30,
  chargePerBlock: 10,
} as const;

export type AirportWaitingPolicy = {
  freeMinutesAfterActualLanding: number;
  chargeBlockMinutes: number;
  chargePerBlock: number;
};

export function airportWaitingDisclaimerTitle(): string {
  return "Airport Collection";
}

export function airportWaitingDisclaimerBody(
  policy: AirportWaitingPolicy = AIRPORT_WAITING_POLICY
): string {
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

export function airportWaitingWebsiteBody(
  policy: AirportWaitingPolicy = AIRPORT_WAITING_POLICY
): string {
  if (policy === AIRPORT_WAITING_POLICY) return currentCollectionCopy();
  const minutes = policy.freeMinutesAfterActualLanding;
  const block = policy.chargeBlockMinutes;
  const charge = policy.chargePerBlock;
  const basis = "basis" in policy && (policy as { basis?: string }).basis === "booked_time"
    ? "the booked collection time"
    : "the verified actual landing time";
  return [
    `The included allowance is ${minutes} minutes from ${basis}.`,
    `Additional waiting is charged at £${charge} per started ${block} minutes after your included allowance.`,
  ].join("\n\n");
}

export function airportWaitingChargeSummary(
  policy: AirportWaitingPolicy = AIRPORT_WAITING_POLICY
): string {
  return `£${policy.chargePerBlock} per additional ${policy.chargeBlockMinutes} minutes or part thereof`;
}

export function calculateAirportWaitingCharge(
  minutesAfterActualLanding: number,
  policy: AirportWaitingPolicy = AIRPORT_WAITING_POLICY
): number {
  if (!Number.isFinite(minutesAfterActualLanding) || minutesAfterActualLanding <= policy.freeMinutesAfterActualLanding) {
    return 0;
  }
  const chargeableMinutes = minutesAfterActualLanding - policy.freeMinutesAfterActualLanding;
  return Math.ceil(chargeableMinutes / policy.chargeBlockMinutes) * policy.chargePerBlock;
}

export function bookingHasAirportCollection(booking: {
  airportCollection?: boolean;
  returnAirportCollection?: boolean;
} | null | undefined): boolean {
  if (!booking) return false;
  return booking.airportCollection === true || booking.returnAirportCollection === true;
}

const AIRPORT_LOCATION_HINT =
  /\b(heathrow|gatwick|luton|stansted|birmingham airport|london city|bristol airport|lhr|lgw|ltn|stn|bhx|lcy|brs)\b/i;

function locationLooksLikeAirport(value: unknown): boolean {
  return AIRPORT_LOCATION_HINT.test(String(value || ""));
}

export function bookingLooksLikeAirportTransfer(booking: {
  pickupLocation?: string;
  pickup?: string;
  destination?: string;
  returnPickupLocation?: string;
  returnDestination?: string;
  airportCollection?: boolean;
  returnAirportCollection?: boolean;
} | null | undefined): boolean {
  if (!booking) return false;
  if (bookingHasAirportCollection(booking)) return true;
  return [
    booking.pickupLocation,
    booking.pickup,
    booking.destination,
    booking.returnPickupLocation,
    booking.returnDestination,
  ].some(locationLooksLikeAirport);
}

export function airportWaitingScopeNote(booking: {
  bookingType?: string;
  airportCollection?: boolean;
  returnAirportCollection?: boolean;
  returnPickupLocation?: string;
  returnDestination?: string;
} | null | undefined): string {
  if (!bookingHasAirportCollection(booking)) return "";
  const outbound = booking?.airportCollection === true;
  const returning = booking?.returnAirportCollection === true;
  const isReturn =
    booking?.bookingType === "return" ||
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

export const CURRENT_WAITING_VERSION = servicePolicy.version;

export const CURRENT_WAITING = {
  version: CURRENT_WAITING_VERSION,
  ...servicePolicy.airport,
} as const;

/** Published waiting schedules kept so earlier acceptances keep their agreed numbers. */
const PUBLISHED_WAITING: Record<string, {
  flightFreeMinutes: number;
  fixedFreeMinutes: number;
  blockMinutes: number;
  chargePounds: number;
}> = {
  "2026-11-15": { flightFreeMinutes: 60, fixedFreeMinutes: 15, blockMinutes: 15, chargePounds: 5 },
  [CURRENT_WAITING_VERSION]: {
    flightFreeMinutes: CURRENT_WAITING.flightFreeMinutes,
    fixedFreeMinutes: CURRENT_WAITING.fixedFreeMinutes,
    blockMinutes: CURRENT_WAITING.blockMinutes,
    chargePounds: CURRENT_WAITING.chargePounds,
  },
};

export type CollectionArrangement = "flight_monitored" | "fixed_time";

function publishedWaiting(version: string | null | undefined) {
  if (!version) return null;
  return PUBLISHED_WAITING[version] || null;
}

export function waitingPolicyForBooking(booking: {
  waitingPolicyVersion?: string | null;
  collectionArrangement?: string | null;
  collectionLocationKind?: string | null;
} | null | undefined): AirportWaitingPolicy & { version: string; basis: "actual_landing" | "booked_time"; arrangement: CollectionArrangement } {
  const hotel = booking?.collectionLocationKind === "hotel";
  const arrangement: CollectionArrangement = hotel || booking?.collectionArrangement === "fixed_time"
    ? "fixed_time"
    : "flight_monitored";
  const version = String(booking?.waitingPolicyVersion || "");
  const published = publishedWaiting(version);
  if (!published) {
    return {
      ...AIRPORT_WAITING_POLICY,
      version: "legacy-50-30",
      basis: "actual_landing",
      arrangement: "flight_monitored",
    };
  }
  return {
    version,
    freeMinutesAfterActualLanding: arrangement === "fixed_time" ? published.fixedFreeMinutes : published.flightFreeMinutes,
    chargeBlockMinutes: published.blockMinutes,
    chargePerBlock: published.chargePounds,
    basis: arrangement === "fixed_time" ? "booked_time" : "actual_landing",
    arrangement,
  };
}

export function currentCollectionCopy(): string {
  const flight = CURRENT_WAITING.flightFreeMinutes;
  const fixed = CURRENT_WAITING.fixedFreeMinutes;
  const charge = CURRENT_WAITING.chargePounds;
  const block = CURRENT_WAITING.blockMinutes;
  return [
    `Flight monitored collection is the usual choice for an airport terminal pickup. We track the verified actual landing, not the scheduled arrival. The included allowance is ${flight} minutes from that verified landing. A delay before landing does not use the allowance.`,
    `Fixed time collection is scheduled for the date and clock time you choose. Flight monitoring is not included, and the pickup does not change automatically if the flight is early or late. The included allowance is ${fixed} minutes from the booked collection time. Earlier collection or a change of time is subject to availability.`,
    `Additional waiting is charged at £${charge} per started ${block} minutes after your included allowance. Waiting caused by our driver is not charged. The time starts only once the included allowance has ended and the driver is ready at the agreed collection point.`,
    "A hotel collection uses the fixed time arrangement. A delay to an earlier flight does not move the hotel pickup unless we agree a different time with you.",
    "If you would prefer a later pickup, choose fixed time collection and allow enough time for immigration, luggage and reaching the collection point. Your driver will be scheduled for that time; earlier pickup is subject to availability.",
    "Bookings already accepted keep the waiting terms agreed at the time. Those terms are not replaced by this policy.",
  ].join("\n\n");
}

/** Short public paragraph used on rates, airport pages and the guest form. */
export function publicWaitingParagraph(): string {
  const flight = CURRENT_WAITING.flightFreeMinutes;
  const fixed = CURRENT_WAITING.fixedFreeMinutes;
  const charge = CURRENT_WAITING.chargePounds;
  const block = CURRENT_WAITING.blockMinutes;
  return `Flight monitored collection includes ${flight} minutes from verified actual landing, then £${charge} per started ${block} minutes. Fixed time collection includes ${fixed} minutes from the booked clock time, then the same rate; flight monitoring and automatic adjustment are not included. Your waiting timer stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point. We do not charge for delays caused by our driver. Your confirmation states the arrangement you selected.`;
}

export function fixedTimeExplanation(): string {
  return "Your driver is scheduled for your chosen collection time. Flight monitoring is not included with this option, and your pickup will not automatically change if your flight arrives early or late. Earlier collection or rescheduling is subject to availability. Please contact us promptly if you are delayed.";
}

export function fixedTimeAcknowledgement(): string {
  return "I understand that my flight will not be monitored and my collection time will not automatically change.";
}

function instant(value: unknown): number | null {
  if (value == null || value === "") return null;
  const parsed = new Date(String(value)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function londonWhen(ms: number): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(new Date(ms));
}

export type WaitingProposal = {
  status: "needs_verification" | "proposed";
  includedUntil: string | null;
  chargeableMinutes: number;
  blocks: number;
  proposedPounds: number;
  preview: string;
};

/** Proposed waiting only. This does not take payment or send a message. */
export function proposeWaitingCharge(input: {
  waitingPolicyVersion?: string | null;
  collectionArrangement?: string | null;
  collectionLocationKind?: string | null;
  landingStatus?: string | null;
  verifiedLandingAt?: string | null;
  bookedCollectionAt?: string | null;
  driverReadyAt?: string | null;
  passengerReadyAt?: string | null;
}): WaitingProposal {
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

export function addAdditionalCharge(
  existing: Array<{ id?: string; amountPence?: number; reason?: string }> | null | undefined,
  charge: { id: string; amountPence: number; reason: string }
): { ok: true; charges: Array<{ id: string; amountPence: number; reason: string }> } | { ok: false; error: string } {
  const rows = Array.isArray(existing) ? existing : [];
  const id = String(charge.id || "").trim();
  const amount = Math.round(Number(charge.amountPence));
  const reason = String(charge.reason || "").trim();
  if (!id) return { ok: false, error: "A charge needs an id so a retry cannot add it twice." };
  if (!reason) return { ok: false, error: "Record why this charge is being added." };
  if (!Number.isFinite(amount) || amount <= 0) return { ok: false, error: "Enter the additional charge in pence." };
  if (rows.some((row) => row && row.id === id)) return { ok: false, error: "This charge was already added." };
  return { ok: true, charges: rows.concat([{ id, amountPence: amount, reason }]).map((row) => ({
    id: String(row.id || ""),
    amountPence: Math.round(Number(row.amountPence) || 0),
    reason: String(row.reason || ""),
  })) };
}

export function additionalChargesPence(booking: { additionalCharges?: Array<{ amountPence?: number }> | null } | null | undefined): number {
  const rows = booking && Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [];
  return rows.reduce((sum, row) => sum + Math.max(0, Math.round(Number(row && row.amountPence) || 0)), 0);
}

export function airportWaitingTextForBooking(booking: {
  waitingPolicyVersion?: string | null;
  collectionArrangement?: string | null;
  collectionLocationKind?: string | null;
  airportCollection?: boolean;
  returnAirportCollection?: boolean;
  returnCollectionArrangement?: string | null;
  returnCollectionLocationKind?: string | null;
  acceptedServiceTerms?: Record<string, any>;
} | null | undefined): string {
  if (!booking) return airportWaitingDisclaimerBody(AIRPORT_WAITING_POLICY);
  if (booking.acceptedServiceTerms) booking = { ...booking, ...booking.acceptedServiceTerms, acceptedServiceTerms: undefined };
  if (publishedWaiting(booking.waitingPolicyVersion) && booking.returnAirportCollection) {
    const returning = airportWaitingTextForBooking({ waitingPolicyVersion: booking.waitingPolicyVersion,
      collectionArrangement: booking.returnCollectionArrangement, collectionLocationKind: booking.returnCollectionLocationKind });
    if (!booking.airportCollection) return `Return collection: ${returning}`;
    const outbound = airportWaitingTextForBooking({ waitingPolicyVersion: booking.waitingPolicyVersion,
      collectionArrangement: booking.collectionArrangement, collectionLocationKind: booking.collectionLocationKind });
    return `Outbound collection: ${outbound}\n\nReturn collection: ${returning}`;
  }
  const policy = waitingPolicyForBooking(booking);
  if (!publishedWaiting(policy.version)) return airportWaitingDisclaimerBody(AIRPORT_WAITING_POLICY);
  const arrangement = policy.arrangement === "fixed_time" ? "fixed time collection" : "flight monitored collection";
  const allowance = policy.arrangement === "fixed_time"
    ? `${policy.freeMinutesAfterActualLanding} minutes from the booked collection time`
    : `${policy.freeMinutesAfterActualLanding} minutes from the verified actual landing`;
  return `This booking uses ${arrangement}. Included waiting is ${allowance}. Additional waiting is charged at £${policy.chargePerBlock} per started ${policy.chargeBlockMinutes} minutes after your included allowance. Waiting stops when you call or message to confirm your whole group and luggage are ready at the agreed collection point. Delays caused by our driver are not charged.${policy.arrangement === 'fixed_time' ? ' Flight monitoring and automatic adjustment are not included. Earlier collection or rescheduling is subject to availability.' : ''}`;
}

export function isReturnBooking(booking: {
  bookingType?: string;
  returnPickupLocation?: string;
  returnDestination?: string;
} | null | undefined): boolean {
  if (!booking) return false;
  if (booking.bookingType === "return") return true;
  return Boolean((booking.returnPickupLocation || "").trim() && (booking.returnDestination || "").trim());
}
