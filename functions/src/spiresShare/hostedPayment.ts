import {
  CONFIRMED_NOTICE,
  CustomerBookingView,
  DROPOFF_ACCEPTED_WAITING_PAYMENT_LABEL,
  DROPOFF_DECLINED_LABEL,
  FILL_NOTICE,
  HostedPaymentStatus,
  JourneyStatus,
  PAID_AWAITING_CONFIRMATION,
  PaymentStageStatus,
  PaymentStatus,
  PROVISIONAL_PLACE_LABEL,
  ReservationStatus,
  REVIEW_PROPOSED_DROPOFF_LABEL,
  SHARED_JOURNEY_CONFIRMED_NOTICE,
  ShareBooking,
  ShareConfig,
  ShareJourney,
  STRICT_DEPARTURE_NOTICE,
  UNCONFIRMED_WARNING,
  WAITING_FOR_MATCHING_LABEL,
} from "./types";
import { bookingHoldsSeat, minutesToHm, parseHmToMinutes, remainingSeats, toPublicJourney } from "./logic";
import { fillNoticeForJourney, fourPassengerFallbackEnabled } from "./routePricing";
import {
  flightTerminalOf,
  isHeathrowShare,
  terminalGuideHref,
  terminalGuideLinkText,
  terminalTransferRequired,
  terminalTransferWarning,
} from "./terminalGuide";
import {
  canPassengerEnterPayment,
  destinationMatchingEnabled,
  journeyTypeOf,
  matchingAwareJourneyStatus,
  OccupancyStatusContext,
  passengerSharedDropoffStatus,
  proposedDropoffCustomerNotice,
} from "./destinationMatching";

export function reservationHoldsSeat(booking: Pick<ShareBooking, "reservationStatus" | "paymentStatus">): boolean {
  return bookingHoldsSeat(booking);
}

export const STANDARD_FARE_PENCE = 3500;
export const FOUR_PASSENGER_FARE_PENCE = 4375;
export const SUPPLEMENT_PENCE = 875;
export const TARGET_REVENUE_PENCE = 17500;

export function hostedFromReservation(status: ReservationStatus): HostedPaymentStatus {
  if (status === "PAID") return "PAID";
  if (status === "PAYMENT_PENDING") return "PAYMENT_PENDING";
  if (status === "PAYMENT_EXPIRED") return "EXPIRED";
  return "UNPAID";
}

export function paymentStatusFromReservation(status: ReservationStatus): PaymentStatus {
  if (status === "PAID") return "HOSTED_PAID";
  if (status === "PAYMENT_PENDING") return "HOSTED_PENDING";
  if (status === "PAYMENT_EXPIRED") return "HOSTED_EXPIRED";
  if (status === "CANCELLED" || status === "LATE_CANCELLED" || status === "NO_SHOW") return "HOSTED_EXPIRED";
  if (status === "DROP_OFF_DECLINED") return "HOSTED_UNPAID";
  return "HOSTED_UNPAID";
}

export function occupiedFromBookings(bookings: Array<Pick<ShareBooking, "passengers" | "reservationStatus" | "paymentStatus">>): number {
  return bookings.filter(reservationHoldsSeat).reduce((sum, row) => sum + (row.passengers || 0), 0);
}

export function paidPassengerPlaces(bookings: Array<Pick<ShareBooking, "passengers" | "reservationStatus" | "hostedPaymentStatus">>): number {
  return bookings
    .filter((row) => row.reservationStatus === "PAID" || row.hostedPaymentStatus === "PAID")
    .reduce((sum, row) => sum + (row.passengers || 0), 0);
}

export function receivedPence(bookings: Array<Pick<ShareBooking, "paidAmountPence" | "supplementPaidPence" | "reservationStatus">>): number {
  return bookings.reduce((sum, row) => {
    if (row.reservationStatus === "PAYMENT_EXPIRED" && !row.paidAmountPence) return sum;
    return sum + (row.paidAmountPence || 0) + (row.supplementPaidPence || 0);
  }, 0);
}

export function journeyStatusFromOccupancy(
  occupied: number,
  capacity: number,
  current: JourneyStatus,
  paymentStageStatus: PaymentStageStatus = "NOT_CREATED",
  matching?: OccupancyStatusContext
): JourneyStatus {
  return matchingAwareJourneyStatus(occupied, capacity, current, paymentStageStatus, matching, (occ, cap, cur, stage) =>
    occupancyWithoutMatching(occ, cap, cur, stage)
  );
}

function occupancyWithoutMatching(
  occupied: number,
  capacity: number,
  current: JourneyStatus,
  paymentStageStatus: PaymentStageStatus
): JourneyStatus {
  if (current === "CANCELLED" || current === "EXPIRED" || current === "COMPLETED" || current === "CONFIRMED") {
    return current;
  }
  if (current === "FOUR_PASSENGER_OPTION" || current === "SUPPLEMENT_PAYMENT") {
    if (occupied >= 5 && (paymentStageStatus === "OPEN" || paymentStageStatus === "LINK_SAVED")) {
      return "PAYMENT_WINDOW_OPEN";
    }
    if (occupied < 4) {
      return paymentStageStatus === "OPEN" ? "PAYMENT_WINDOW_OPEN" : occupied <= 0 ? "GATHERING_INTEREST" : "GATHERING_INTEREST";
    }
    return current;
  }
  if (occupied <= 0) return "GATHERING_INTEREST";
  if (paymentStageStatus === "OPEN") {
    if (occupied === capacity - 1) return "AWAITING_FINAL_PASSENGER";
    return "PAYMENT_WINDOW_OPEN";
  }
  if (occupied >= capacity - 1) return "READY_FOR_PAYMENT_SETUP";
  return "GATHERING_INTEREST";
}

export function validateHostedPaymentUrl(raw: string): string {
  const url = String(raw || "").trim();
  if (!url) throw new Error("Paste a hosted payment link first.");
  if (url.length > 2048) throw new Error("That payment link is too long.");
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    throw new Error("The payment link must be a valid https URL.");
  }
  if (parsed.protocol !== "https:") throw new Error("The payment link must use https.");
  if (!parsed.hostname || !parsed.hostname.includes(".")) throw new Error("The payment link hostname is not valid.");
  if (parsed.username || parsed.password) throw new Error("The payment link must not contain credentials.");
  return parsed.toString();
}

export function fivePassengerConfirmReady(
  bookings: ShareBooking[],
  capacity: number
): { ok: boolean; occupied: number; paid: number } {
  const holding = bookings.filter(reservationHoldsSeat);
  const occupied = holding.reduce((sum, row) => sum + row.passengers, 0);
  const paid = paidPassengerPlaces(holding);
  return { ok: occupied >= capacity && paid >= capacity && holding.every((row) => row.reservationStatus === "PAID"), occupied, paid };
}

export function fourPassengerConfirmReady(
  bookings: ShareBooking[],
  threshold = 4
): { ok: boolean; occupied: number; paid: number; accepted: number; supplementsPaid: number } {
  const holding = bookings.filter(reservationHoldsSeat);
  const occupied = holding.reduce((sum, row) => sum + row.passengers, 0);
  const paid = paidPassengerPlaces(holding);
  const accepted = holding.filter((row) => row.fourPassengerAccepted).reduce((sum, row) => sum + row.passengers, 0);
  const supplementsPaid = holding.filter((row) => (row.supplementPaidPence || 0) >= SUPPLEMENT_PENCE * row.passengers).reduce((sum, row) => sum + row.passengers, 0);
  return {
    ok: occupied === threshold && paid === threshold && accepted === threshold && supplementsPaid === threshold,
    occupied,
    paid,
    accepted,
    supplementsPaid,
  };
}

export function bookingAmountDuePence(booking: Pick<ShareBooking, "passengers">, farePence: number): number {
  return farePence * booking.passengers;
}

export function supplementDuePence(booking: Pick<ShareBooking, "passengers">): number {
  return SUPPLEMENT_PENCE * booking.passengers;
}

export function cancellationCategoryFor(hoursBeforeDeparture: number, journeyConfirmed: boolean): "FREE" | "LATE_CANCELLATION" {
  if (hoursBeforeDeparture > 24) return "FREE";
  return "LATE_CANCELLATION";
}

export function hoursBeforeIso(departureAt: string, nowIso: string): number {
  return (new Date(departureAt).getTime() - new Date(nowIso).getTime()) / (60 * 60 * 1000);
}

export function recommendedArrivalHm(departureHm: string, minutesBefore: number): string {
  const start = parseHmToMinutes(departureHm);
  if (start == null) return "";
  return minutesToHm(start - minutesBefore);
}

export function graceUntilHm(departureHm: string, graceMinutes: number): string {
  const start = parseHmToMinutes(departureHm);
  if (start == null) return "";
  return minutesToHm(start + graceMinutes);
}

export function customerStatusLabel(
  journey: Pick<ShareJourney, "status" | "paymentStageStatus" | "destinationMatchingEnabled" | "journeyType" | "airportId" | "proposedSharedDropoffHubId" | "confirmedSharedDropoffHubId" | "sharedDropoffProposalVersion">,
  booking: Pick<ShareBooking, "reservationStatus" | "hostedPaymentStatus" | "acceptedDropoffProposalVersion" | "sharedDropoffAcceptedAt" | "sharedDropoffDeclinedAt">
): string {
  if (journey.status === "CONFIRMED") return "Journey confirmed";
  if (booking.reservationStatus === "PAID" || booking.hostedPaymentStatus === "PAID") {
    return PAID_AWAITING_CONFIRMATION;
  }
  if (destinationMatchingEnabled(journey)) {
    const dropoff = passengerSharedDropoffStatus(journey, booking);
    if (dropoff === "DECLINED") return DROPOFF_DECLINED_LABEL;
    if (dropoff === "PROPOSED") return REVIEW_PROPOSED_DROPOFF_LABEL;
    if (dropoff === "ACCEPTED" && journey.paymentStageStatus !== "OPEN") return DROPOFF_ACCEPTED_WAITING_PAYMENT_LABEL;
    if (dropoff === "NOT_SELECTED") return WAITING_FOR_MATCHING_LABEL;
  }
  return PROVISIONAL_PLACE_LABEL;
}

export function hostedPaymentUrlForCustomer(
  journey: ShareJourney,
  booking: ShareBooking
): { url: string; kind: "fare" | "supplement"; amountPence: number } | null {
  const supplement =
    journey.status === "SUPPLEMENT_PAYMENT" &&
    booking.fourPassengerAccepted &&
    (booking.supplementPaidPence || 0) < supplementDuePence(booking);
  if (supplement) {
    if (!canPassengerEnterPayment(journey, booking)) return null;
    if (!journey.supplementPaymentLinkUrl) return null;
    return {
      url: journey.supplementPaymentLinkUrl,
      kind: "supplement",
      amountPence: supplementDuePence(booking),
    };
  }
  if (!canPassengerEnterPayment(journey, booking)) return null;
  if (journey.paymentStageStatus !== "OPEN" || booking.reservationStatus !== "PAYMENT_PENDING" || !journey.paymentLinkUrl) {
    return null;
  }
  return {
    url: journey.paymentLinkUrl,
    kind: "fare",
    amountPence: bookingAmountDuePence(booking, journey.farePence),
  };
}

export function canCustomerAccessBooking(
  booking: Pick<ShareBooking, "uid" | "email">,
  actor: { uid?: string; email?: string; isAdmin?: boolean }
): boolean {
  if (actor.isAdmin) return true;
  if (booking.uid && actor.uid && booking.uid === actor.uid) return true;
  return false;
}

export function toCustomerBookingView(
  journey: ShareJourney,
  booking: ShareBooking,
  allBookings: ShareBooking[],
  config: ShareConfig
): CustomerBookingView {
  const pub = toPublicJourney(journey, config);
  const holding = allBookings.filter(reservationHoldsSeat);
  const paidPlaces = paidPassengerPlaces(holding);
  const reservationStatus = booking.reservationStatus || "PROVISIONAL";
  const hostedPaymentStatus = booking.hostedPaymentStatus || hostedFromReservation(reservationStatus);
  const amountDue = bookingAmountDuePence(booking, journey.farePence);
  const fourAvailable =
    fourPassengerFallbackEnabled(journey) &&
    (journey.status === "FOUR_PASSENGER_OPTION" || journey.status === "SUPPLEMENT_PAYMENT");
  const canPay = Boolean(hostedPaymentUrlForCustomer(journey, booking));
  const confirmed = journey.status === "CONFIRMED";
  const paidAwaiting =
    !confirmed && (reservationStatus === "PAID" || hostedPaymentStatus === "PAID");
  const matching = destinationMatchingEnabled(journey);
  const dropoffStatus = matching ? passengerSharedDropoffStatus(journey, booking) : undefined;
  const heathrow = isHeathrowShare(journey);
  const flightTerminal = flightTerminalOf(booking);
  const terminalWarning = heathrow ? terminalTransferWarning(flightTerminal) : null;
  const confirmedNotice = confirmed
    ? journeyTypeOf(journey) === "AIRPORT"
      ? CONFIRMED_NOTICE
      : SHARED_JOURNEY_CONFIRMED_NOTICE
    : undefined;
  const paidAwaitingLine = matching
    ? `${PAID_AWAITING_CONFIRMATION}. Your shared journey is not confirmed until all required passengers have paid.`
    : `${PAID_AWAITING_CONFIRMATION}. Your journey is not confirmed until all required passengers have paid.`;
  let actionRequired: string | undefined;
  if (matching && dropoffStatus === "PROPOSED") actionRequired = "Shared drop off waiting for acceptance";
  else if (canPay) actionRequired = "Payment required";
  else if (fourAvailable && !booking.fourPassengerAccepted) actionRequired = "Four passenger option requires response";
  const paymentSubmittedNotice = booking.paymentSubmittedAt
    ? "Payment submitted. We are confirming your payment. Your journey will show as paid once Spires Taxis has verified it."
    : undefined;
  return {
    publicNumber: pub.publicNumber,
    travelDate: pub.travelDate,
    departureTime: pub.departureTime,
    recommendedArrivalTime: recommendedArrivalHm(journey.departureTime, config.arriveBeforeDepartureMinutes),
    graceUntilTime: graceUntilHm(journey.departureTime, config.boardingClosesMinutesBeforeDeparture),
    meetingPointName: pub.meetingPointName,
    destinationLabel: pub.destinationLabel,
    originLabel: pub.originLabel,
    dropoffTerminal: booking.dropoffTerminal,
    passengers: booking.passengers,
    farePence: journey.farePence,
    amountDuePence: amountDue,
    paidAmountPence: booking.paidAmountPence || 0,
    reservationStatus,
    hostedPaymentStatus,
    publicStatus: pub.publicStatus,
    journeyStatus: journey.status,
    guarantee: pub.guarantee,
    occupiedSeats: journey.occupiedSeats,
    remainingSeats: remainingSeats(journey.occupiedSeats, journey.capacity),
    capacity: journey.capacity,
    paidPassengerPlaces: paidPlaces,
    requiredPaidPlaces: Math.min(journey.occupiedSeats, journey.capacity),
    paymentDeadlineAt: booking.paymentDeadlineAt || journey.paymentDeadlineAt,
    paymentLinkAvailable: canPay,
    fourPassengerOffer: fourAvailable
      ? {
          available: true,
          currentPaidPence: booking.paidAmountPence || amountDue,
          additionalPence: supplementDuePence(booking),
          totalPence: FOUR_PASSENGER_FARE_PENCE * booking.passengers,
          accepted: Boolean(booking.fourPassengerAccepted),
        }
      : undefined,
    cancellationDeadlineAt: journey.departureAt,
    customerStatusLabel: customerStatusLabel(journey, booking),
    fillNotice: confirmed ? undefined : fillNoticeForJourney(journey),
    confirmedNotice,
    warning: confirmed
      ? `${confirmedNotice} ${STRICT_DEPARTURE_NOTICE}`
      : paidAwaiting
        ? paidAwaitingLine
        : UNCONFIRMED_WARNING,
    paymentSubmittedNotice,
    journeyType: journeyTypeOf(journey),
    destinationMatchingEnabled: matching,
    destinationCity: journey.destinationCity,
    intendedDestinationText: matching ? booking.intendedDestinationText : undefined,
    intendedDestinationPostcode: matching ? booking.intendedDestinationPostcode : undefined,
    proposedSharedDropoffDisplayName: matching ? journey.proposedSharedDropoffDisplayName : undefined,
    sharedDropoffStatus: dropoffStatus,
    canAcceptSharedDropoff: matching && dropoffStatus === "PROPOSED",
    canDeclineSharedDropoff: matching && dropoffStatus === "PROPOSED",
    sharedDropoffNotice:
      matching && dropoffStatus === "PROPOSED"
        ? proposedDropoffCustomerNotice(journey, booking.intendedDestinationText)
        : matching && dropoffStatus === "NOT_SELECTED"
          ? "Shared drop off: Not selected yet"
          : undefined,
    flightNumber: booking.flightNumber,
    flightDepartureTime: booking.flightDepartureTime,
    departureTerminal: flightTerminal,
    sharedDropoffLabel: heathrow ? "Heathrow Terminal 3" : journey.proposedSharedDropoffDisplayName,
    terminalTransferRequired: heathrow ? terminalTransferRequired(flightTerminal) : false,
    terminalGuideUrl: heathrow ? terminalGuideHref(flightTerminal) : undefined,
    terminalGuideLabel: heathrow ? terminalGuideLinkText(flightTerminal) : undefined,
    terminalTransferWarning: terminalWarning || undefined,
    actionRequired,
    fourPassengerFallbackEnabled: fourPassengerFallbackEnabled(journey),
  };
}

export function adminPaymentSummary(journey: ShareJourney, bookings: ShareBooking[]): {
  reserved: number;
  paidPlaces: number;
  outstandingPlaces: number;
  receivedPence: number;
  paymentLinkState: string;
  paymentWindowState: string;
} {
  const reserved = occupiedFromBookings(bookings);
  const paidPlaces = paidPassengerPlaces(bookings);
  return {
    reserved,
    paidPlaces,
    outstandingPlaces: Math.max(0, reserved - paidPlaces),
    receivedPence: receivedPence(bookings),
    paymentLinkState: journey.paymentLinkUrl ? "ADDED" : "NOT CREATED",
    paymentWindowState: journey.paymentStageStatus === "OPEN" ? "OPEN" : "CLOSED",
  };
}

export function stripPaymentSecrets<T extends Record<string, unknown>>(row: T): Record<string, unknown> {
  const out: Record<string, unknown> = { ...row };
  delete out.paymentLinkUrl;
  delete out.supplementPaymentLinkUrl;
  delete out.paymentMethodRef;
  delete out.paymentId;
  delete out.manageTokenHash;
  delete out.idempotencyKey;
  return out;
}
