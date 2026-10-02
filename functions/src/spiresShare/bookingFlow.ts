import {
  CustomerInterestView,
  CustomerWaitlistView,
  HeathrowTerminal,
  JourneyStatus,
  LuggageDeclaration,
  PaymentStatus,
  PublicInterestGroupView,
  ReservationStatus,
  ShareBooking,
  ShareConfig,
  ShareJourney,
  SharePayment,
  ShareWaitlistEntry,
  Flexibility,
  SHARE_TERMS_VERSION,
  ShareDropoffHub,
  ShareInterestEntry,
  ShareInterestGroup,
} from "./types";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import {
  assertPartyFitsCapacity,
  canAddPassengers,
  earlyDepartureConfirmed,
  earlyDepartureEligible,
  earlyDepartureFarePence,
  evaluateHomeCollection,
  flightCompatible,
  hashToken,
  isHeathrowTerminal,
  isMvpAirport,
  luggageFitsPassengerAllowance,
  luggageFitsVehicle,
  matchJourneys,
  newOpaqueToken,
  publicNumberFor,
  remainingSeats,
  statusFromOccupancy,
  airportById,
  acceptedPassengerCount,
  nextCompatibleWaitlistOffer,
} from "./logic";
import { londonDateTimeToUtcIso, slotKey, subtractHoursIso, addMinutesIso, isPast } from "./timezone";
import { MockPaymentProvider, PaymentProvider, paymentCanRelease, paymentSecuresSeat } from "./paymentProvider";
import {
  bookingAmountDuePence,
  cancellationCategoryFor,
  fivePassengerConfirmReady,
  fourPassengerConfirmReady,
  hoursBeforeIso,
  journeyStatusFromOccupancy,
  occupiedFromBookings,
  paymentStatusFromReservation,
  reservationHoldsSeat,
  supplementDuePence,
  validateHostedPaymentUrl,
} from "./hostedPayment";
import {
  applyMatchingSuggestion,
  assertCanOpenPaymentWindow,
  assertHubSelectable,
  cityRouteKey,
  destinationFieldsForBooking,
  destinationMatchingEnabled,
  matchingOccupancyContext,
  paymentSensitiveForDropoffChange,
  proposedHubId,
  rankSharedDropoffHubs,
  requireIntendedDestination,
} from "./destinationMatching";
import {
  adminInterestDestinations,
  destinationMatchingForRegion,
  derivedWaitlistPosition,
  findCompatibleInterestGroup,
  interestGroupStatusFromCount,
  interestPublicNumber,
  journeyTypeForRegion,
  normalizePlace,
  previewCompatibleInterest,
  resolveInterestWindow,
  timeLabelForWindow,
  toPublicInterestGroup,
  waitlistOrder,
  windowsOverlap,
  type InterestRequest,
} from "./interestGroups";
import { cityJourneyRequiresOwnFare, fourPassengerFallbackEnabled } from "./routePricing";
import {
  confirmationGuard,
  interestCustomerStage,
  customerStageLabel,
  publicInterestSafeFields,
  morePassengersNeededCopy,
  notificationDedupeKey,
  paymentWindowMayOpen,
  recordShareNotification,
  requiredSeatsForGroup,
  seatProgress,
} from "./shareProgress";
import { computeInterestDeadline, computeJoinerPaymentDeadline, computePaymentDeadline } from "./paymentDeadline";
import { isHeathrowShare, parseFlightTerminal } from "./terminalGuide";

export type ContactInput = {
  name: string;
  mobile: string;
  email: string;
  uid?: string;
  flightNumber?: string;
  flightDepartureTime?: string;
  flexibility: Flexibility;
  dropoffTerminal?: string;
  departureTerminal?: string;
};

export type ReserveInput = {
  action: "propose" | "join";
  airportId: string;
  travelDate: string;
  preferredDepartureTime: string;
  journeyId?: string;
  forcePropose?: boolean;
  passengers: number;
  luggage: LuggageDeclaration;
  contact: ContactInput;
  idempotencyKey: string;
  paymentMethodSucceeds?: boolean;
  termsAccepted?: boolean;
  nowIso?: string;
  intendedDestinationText?: string;
  intendedDestinationPostcode?: string;
  intendedDestinationLat?: number;
  intendedDestinationLng?: number;
  sharedDropoffAcknowledged?: boolean;
  flexibleMinutes?: number;
  earliestDepartureTime?: string;
  latestDepartureTime?: string;
};

export type ReserveResult = {
  ok: boolean;
  needsChoice?: boolean;
  idempotentReplay?: boolean;
  journeyId?: string;
  bookingId?: string;
  publicNumber?: string;
  occupiedSeats?: number;
  status?: JourneyStatus;
  manageToken?: string;
  matches?: ShareJourney[];
  message?: string;
};

type Slot = { journeyId: string };
type IdempotencyRow = { bookingId: string; journeyId: string; publicNumber: string; occupiedSeats: number };

export class InMemoryShareDb {
  config: ShareConfig;
  journeys = new Map<string, ShareJourney>();
  bookings = new Map<string, ShareBooking>();
  payments = new Map<string, SharePayment>();
  waitlist = new Map<string, ShareWaitlistEntry>();
  interestGroups = new Map<string, ShareInterestGroup>();
  interestEntries = new Map<string, ShareInterestEntry>();
  slots = new Map<string, Slot>();
  idempotency = new Map<string, IdempotencyRow>();
  hubs = new Map<string, ShareDropoffHub>();
  notifications: Array<Record<string, unknown>> = [];
  audit: Array<Record<string, unknown>> = [];
  mutex: Promise<void> = Promise.resolve();

  constructor(config: ShareConfig = { ...DEFAULT_SHARE_CONFIG, airports: [...DEFAULT_SHARE_CONFIG.airports] }) {
    this.config = config;
  }

  async runExclusive<T>(fn: () => Promise<T>): Promise<T> {
    let release: () => void = () => undefined;
    const prev = this.mutex;
    this.mutex = new Promise((resolve) => {
      release = resolve;
    });
    await prev;
    try {
      return await fn();
    } finally {
      release();
    }
  }
}

function id(prefix: string): string {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}${Date.now().toString(36)}`;
}

export function parseLuggage(raw: unknown, passengers: number): LuggageDeclaration {
  const row = (raw || {}) as Record<string, unknown>;
  const nested = (row.luggage && typeof row.luggage === "object" ? row.luggage : null) as Record<string, unknown> | null;
  const source = nested || row;
  return {
    largeSuitcases: Number(source.largeSuitcases ?? row.largeSuitcases) || 0,
    cabinBags: Number(source.cabinBags ?? row.cabinBags) || 0,
    other: String(source.other ?? row.other ?? ""),
  };
}

export function requireHeathrowTerminal(config: ShareConfig, airportId: string, terminal?: string): HeathrowTerminal | undefined {
  if (airportId !== "heathrow") return undefined;
  const value = String(terminal || "").toUpperCase() as HeathrowTerminal;
  if (!isHeathrowTerminal(value, config.heathrowTerminals)) {
    throw new Error("Choose Heathrow Terminal 2, 3, 4 or 5.");
  }
  return value;
}

export async function reservePlace(
  db: InMemoryShareDb,
  provider: PaymentProvider,
  input: ReserveInput
): Promise<ReserveResult> {
  const config = db.config;
  const joinJourney = input.action === "join" ? db.journeys.get(String(input.journeyId || "")) : undefined;
  const matchingJoin = Boolean(joinJourney && destinationMatchingEnabled(joinJourney));
  const airport = matchingJoin
    ? airportById(config, joinJourney?.airportId || "") || airportById(config, "heathrow")
    : airportById(config, input.airportId);
  if (!matchingJoin) {
    if (!airport) throw new Error("Unknown airport.");
    if (!isMvpAirport(config, airport.id)) {
      throw new Error("This Spires Share route is not available yet.");
    }
  }
  if (!airport) throw new Error("Unknown airport.");
  assertPartyFitsCapacity(input.passengers, config.passengerCapacity);
  const luggage = input.luggage;
  if (
    !luggageFitsPassengerAllowance(
      luggage,
      input.passengers,
      config.luggage.largeSuitcasesPerPassenger,
      config.luggage.cabinBagsPerPassenger
    )
  ) {
    throw new Error("Luggage exceeds the allowance for this party.");
  }
  if (!luggageFitsVehicle([], luggage, config.luggage.maxLargeSuitcasesPerVehicle, config.luggage.maxCabinBagsPerVehicle)) {
    throw new Error("Luggage exceeds the vehicle allowance.");
  }
  const terminal = matchingJoin ? undefined : requireHeathrowTerminal(config, airport.id, input.contact.dropoffTerminal);
  const destination = matchingJoin
    ? requireIntendedDestination(
        {
          intendedDestinationText: input.intendedDestinationText,
          intendedDestinationPostcode: input.intendedDestinationPostcode,
          intendedDestinationLat: input.intendedDestinationLat,
          intendedDestinationLng: input.intendedDestinationLng,
          sharedDropoffAcknowledged: input.sharedDropoffAcknowledged,
          preferredDepartureTime: input.preferredDepartureTime,
          flexibleMinutes: input.flexibleMinutes,
          earliestDepartureTime: input.earliestDepartureTime,
          latestDepartureTime: input.latestDepartureTime,
        },
        joinJourney?.destinationCity || "London"
      )
    : undefined;
  if (input.termsAccepted !== true) {
    throw new Error("You must read and agree to the Spires Share terms before registering interest.");
  }
  if (!matchingJoin && input.contact.flightDepartureTime) {
    const probeTime = input.action === "join" && input.journeyId
      ? db.journeys.get(input.journeyId)?.departureTime
      : input.preferredDepartureTime;
    if (
      probeTime &&
      !flightCompatible(
        probeTime,
        airport.estimatedDurationMinutes,
        input.contact.flightDepartureTime,
        airport.flightSafetyBufferMinutes
      )
    ) {
      throw new Error("This departure would not meet the configured flight safety buffer.");
    }
  }

  const methodRef = "hosted_payment_link";

  return db.runExclusive(async () => {
    const existingIdem = db.idempotency.get(input.idempotencyKey);
    if (existingIdem) {
      return {
        ok: true,
        idempotentReplay: true,
        journeyId: existingIdem.journeyId,
        bookingId: existingIdem.bookingId,
        publicNumber: existingIdem.publicNumber,
        occupiedSeats: existingIdem.occupiedSeats,
      };
    }

    if (input.action !== "join") {
      const existing = [...db.journeys.values()].filter((row) => row.airportId === airport.id && row.travelDate === input.travelDate);
      const bookingsByJourney: Record<string, ShareBooking[]> = {};
      for (const booking of db.bookings.values()) {
        bookingsByJourney[booking.journeyId] = bookingsByJourney[booking.journeyId] || [];
        bookingsByJourney[booking.journeyId].push(booking);
      }
      const matches = matchJourneys(
        {
          airportId: airport.id,
          travelDate: input.travelDate,
          preferredDepartureTime: input.preferredDepartureTime,
          flexibility: input.contact.flexibility,
          flightDepartureTime: input.contact.flightDepartureTime,
          passengers: input.passengers,
          luggage,
        },
        existing,
        config,
        bookingsByJourney
      );
      const slot = db.slots.get(slotKey(airport.id, input.travelDate, input.preferredDepartureTime));
      if ((matches.length || slot) && input.forcePropose !== true) {
        const slotJourney = slot ? db.journeys.get(slot.journeyId) : undefined;
        return {
          ok: false,
          needsChoice: true,
          matches: slotJourney && !matches.find((row) => row.id === slotJourney.id) ? [slotJourney, ...matches] : matches,
          message: "There's already a Spires Share departure close to your requested time.",
        };
      }
      const journeyId = id("j");
      const bookingId = id("b");
      const paymentId = `pay_${bookingId}`;
      const manageToken = newOpaqueToken();
      const departureAt = londonDateTimeToUtcIso(input.travelDate, input.preferredDepartureTime);
      const now = input.nowIso || new Date().toISOString();
      const initialStatus = journeyStatusFromOccupancy(input.passengers, config.passengerCapacity, "GATHERING_INTEREST");
      const journey: ShareJourney = {
        id: journeyId,
        publicNumber: publicNumberFor(input.travelDate, input.preferredDepartureTime),
        airportId: airport.id,
        travelDate: input.travelDate,
        departureTime: input.preferredDepartureTime,
        departureAt,
        confirmationDeadlineAt: subtractHoursIso(departureAt, config.confirmationDeadlineHoursBeforeDeparture),
        status: initialStatus,
        capacity: config.passengerCapacity,
        occupiedSeats: input.passengers,
        farePence: airport.farePence,
        targetRevenuePence: airport.targetRevenuePence,
        dropoffMode: config.dropoffMode,
        journeyType: "AIRPORT",
        destinationMatchingEnabled: false,
        earlyDepartureOffered: false,
        earlyDepartureAcceptedBookingIds: [],
        homeCollectionCount: 0,
        waitlistCount: 0,
        paymentStageStatus: "NOT_CREATED",
        createdAt: now,
        updatedAt: now,
      };
      const home = evaluateHomeCollection("", 0, config.maxHomeCollectionsPerJourney, 0, false);
      const booking: ShareBooking = {
        id: bookingId,
        journeyId,
        publicNumber: journey.publicNumber,
        uid: input.contact.uid,
        passengers: input.passengers,
        name: input.contact.name,
        mobile: input.contact.mobile,
        email: input.contact.email,
        flightNumber: input.contact.flightNumber,
        flightDepartureTime: input.contact.flightDepartureTime,
        dropoffTerminal: isHeathrowShare(journey) ? "T3" : terminal,
        departureTerminal: parseFlightTerminal(input.contact.departureTerminal || terminal),
        flexibility: input.contact.flexibility,
        luggage,
        homeCollection: home.eligibility,
        homeCollectionSurchargePence: 0,
        paymentId,
        paymentMethodRef: methodRef,
        paymentStatus: "HOSTED_UNPAID",
        hostedPaymentStatus: "UNPAID",
        reservationStatus: "PROVISIONAL",
        paidAmountPence: 0,
        termsAcceptedAt: now,
        termsVersion: SHARE_TERMS_VERSION,
        boardStatus: "NOT_CHECKED_IN",
        earlyDepartureAccepted: false,
        manageTokenHash: hashToken(manageToken),
        idempotencyKey: input.idempotencyKey,
        createdAt: now,
      };
      db.journeys.set(journeyId, journey);
      db.bookings.set(bookingId, booking);
      db.slots.set(slotKey(airport.id, input.travelDate, input.preferredDepartureTime), { journeyId });
      db.idempotency.set(input.idempotencyKey, {
        bookingId,
        journeyId,
        publicNumber: journey.publicNumber,
        occupiedSeats: input.passengers,
      });
      db.payments.set(paymentId, {
        id: paymentId,
        bookingId,
        journeyId,
        amountPence: airport.farePence * input.passengers,
        currency: "GBP",
        status: "HOSTED_UNPAID",
        paymentMethodRef: methodRef,
        provider: "hosted_payment_link",
        updatedAt: now,
      });
      db.notifications.push({ type: "BOOKING_RECEIVED", bookingId, email: booking.email });
      return {
        ok: true,
        journeyId,
        bookingId,
        publicNumber: journey.publicNumber,
        occupiedSeats: input.passengers,
        status: journey.status,
        manageToken,
      };
    }

    const journey = db.journeys.get(String(input.journeyId || ""));
    if (!journey) throw new Error("Journey not found.");
    if (!canAddPassengers(journey.occupiedSeats, input.passengers, journey.capacity)) {
      throw new Error("No remaining places.");
    }
    if (journey.waitlistOfferOutstanding) {
      throw new Error("A place is currently offered to someone on the waitlist.");
    }
    const existingBookings = [...db.bookings.values()].filter((row) => row.journeyId === journey.id && reservationHoldsSeat(row));
    if (
      !luggageFitsVehicle(
        existingBookings.map((row) => row.luggage),
        luggage,
        config.luggage.maxLargeSuitcasesPerVehicle,
        config.luggage.maxCabinBagsPerVehicle
      )
    ) {
      throw new Error("Luggage exceeds the vehicle allowance.");
    }
    const occupied = journey.occupiedSeats + input.passengers;
    const bookingId = id("b");
    const paymentId = `pay_${bookingId}`;
    const manageToken = newOpaqueToken();
    const now = input.nowIso || new Date().toISOString();
    const matching = destinationMatchingEnabled(journey);
    const windowOpen = journey.paymentStageStatus === "OPEN" && !matching;
    const reservationStatus: ReservationStatus = windowOpen ? "PAYMENT_PENDING" : "PROVISIONAL";
    const joinerDeadline = windowOpen
      ? computeJoinerPaymentDeadline(
          now,
          journey.paymentDeadlineAt,
          config.paymentWindowHours,
          config.paymentQuietHoursStart,
          config.paymentQuietHoursEnd,
          config.paymentJoinerMinimumMinutes
        )
      : null;
    const booking: ShareBooking = {
      id: bookingId,
      journeyId: journey.id,
      publicNumber: journey.publicNumber,
      uid: input.contact.uid,
      passengers: input.passengers,
      name: input.contact.name,
      mobile: input.contact.mobile,
      email: input.contact.email,
      flightNumber: input.contact.flightNumber,
      flightDepartureTime: input.contact.flightDepartureTime,
      dropoffTerminal: isHeathrowShare(journey) ? "T3" : terminal,
      departureTerminal: parseFlightTerminal(input.contact.departureTerminal || terminal),
      flexibility: input.contact.flexibility,
      luggage,
      homeCollection: "HOME_COLLECTION_UNAVAILABLE",
      homeCollectionSurchargePence: 0,
      paymentId,
      paymentMethodRef: methodRef,
      paymentStatus: paymentStatusFromReservation(reservationStatus),
      hostedPaymentStatus: reservationStatus === "PAYMENT_PENDING" ? "PAYMENT_PENDING" : "UNPAID",
      reservationStatus,
      paidAmountPence: 0,
      paymentDeadlineAt: joinerDeadline?.deadlineAt,
      termsAcceptedAt: now,
      termsVersion: SHARE_TERMS_VERSION,
      boardStatus: "NOT_CHECKED_IN",
      earlyDepartureAccepted: false,
      manageTokenHash: hashToken(manageToken),
      idempotencyKey: input.idempotencyKey,
      createdAt: now,
      ...(destination ? destinationFieldsForBooking(destination, now) : {}),
    };
    journey.occupiedSeats = occupied;
    journey.status = journeyStatusFromOccupancy(
      occupied,
      journey.capacity,
      journey.status,
      journey.paymentStageStatus || "NOT_CREATED",
      matchingOccupancyContext(journey, [...existingBookings, booking])
    );
    journey.updatedAt = now;
    db.bookings.set(bookingId, booking);
    db.idempotency.set(input.idempotencyKey, {
      bookingId,
      journeyId: journey.id,
      publicNumber: journey.publicNumber,
      occupiedSeats: occupied,
    });
    db.payments.set(paymentId, {
      id: paymentId,
      bookingId,
      journeyId: journey.id,
      amountPence: journey.farePence * input.passengers,
      currency: "GBP",
      status: paymentStatusFromReservation(reservationStatus),
      paymentMethodRef: methodRef,
      provider: "hosted_payment_link",
      updatedAt: now,
    });
    db.notifications.push({ type: "BOOKING_RECEIVED", bookingId, email: booking.email });
    if (occupied >= config.earlyDepartureThreshold) {
      db.notifications.push({ type: "JOURNEY_FILLING", journeyId: journey.id });
    }
    if (windowOpen) {
      db.notifications.push({ type: "PAYMENT_REQUIRED", bookingId, email: booking.email, journeyId: journey.id });
    }
    return {
      ok: true,
      journeyId: journey.id,
      bookingId,
      publicNumber: journey.publicNumber,
      occupiedSeats: occupied,
      status: journey.status,
      manageToken,
    };
  });
}

export async function confirmIfEligible(
  db: InMemoryShareDb,
  provider: PaymentProvider,
  journeyId: string,
  nowIso?: string,
  authoriseFlags?: Record<string, boolean>
): Promise<{ ok: boolean; status: JourneyStatus; failedBookingIds: string[] }> {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  const bookings = [...db.bookings.values()].filter(
    (row) => row.journeyId === journeyId && paymentSecuresSeat(row.paymentStatus)
  );
  const occupied = bookings.reduce((sum, row) => sum + row.passengers, 0);
  const earlyOk =
    occupied === db.config.earlyDepartureThreshold &&
    earlyDepartureConfirmed(acceptedPassengerCount(bookings), occupied);
  const fullOk = occupied >= journey.capacity;
  if (!fullOk && !earlyOk) {
    return { ok: false, status: journey.status, failedBookingIds: [] };
  }
  const failedBookingIds: string[] = [];
  for (const booking of bookings) {
    const payment = booking.paymentId ? db.payments.get(booking.paymentId) : undefined;
    if (!payment) continue;
    if (payment.status === "AUTHORISED" || payment.status === "CAPTURED") continue;
    const succeed = authoriseFlags ? authoriseFlags[booking.id] !== false : payment.failAuthorise !== true;
    const auth = await provider.authorise({
      paymentId: payment.id,
      amountPence: payment.amountPence,
      paymentMethodRef: payment.paymentMethodRef,
      succeed,
    });
    payment.status = auth.status;
    booking.paymentStatus = auth.status;
    if (auth.status !== "AUTHORISED") failedBookingIds.push(booking.id);
  }
  if (failedBookingIds.length) {
    journey.status = "PAYMENT_ACTION_REQUIRED";
    journey.updatedAt = nowIso || new Date().toISOString();
    for (const id of failedBookingIds) {
      const booking = db.bookings.get(id);
      if (booking) booking.paymentStatus = "PAYMENT_ACTION_REQUIRED";
    }
    db.notifications.push({ type: "PAYMENT_PROBLEM", journeyId, failedBookingIds });
    return { ok: false, status: journey.status, failedBookingIds };
  }
  for (const booking of bookings) {
    if (!booking.paymentId) continue;
    const captured = await provider.capture(booking.paymentId);
    const payment = db.payments.get(booking.paymentId);
    if (payment) payment.status = captured.status;
    booking.paymentStatus = captured.status;
    if (captured.status !== "CAPTURED") {
      journey.status = "PAYMENT_ACTION_REQUIRED";
      db.notifications.push({ type: "PAYMENT_PROBLEM", journeyId, reason: "capture" });
      return { ok: false, status: journey.status, failedBookingIds: [booking.id] };
    }
  }
  journey.status = occupied >= journey.capacity ? "CONFIRMED" : "CONFIRMED";
  journey.updatedAt = nowIso || new Date().toISOString();
  db.notifications.push({ type: "JOURNEY_CONFIRMED", journeyId });
  return { ok: true, status: journey.status, failedBookingIds: [] };
}

export async function releaseBookingPlace(
  db: InMemoryShareDb,
  provider: PaymentProvider,
  bookingId: string,
  nowIso?: string
): Promise<void> {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  const wasSecured = paymentSecuresSeat(booking.paymentStatus);
  if (booking.paymentId) {
    const payment = db.payments.get(booking.paymentId);
    if (payment && paymentCanRelease(payment.status)) {
      const released = await provider.release(payment.id);
      payment.status = released.status === "CAPTURED" ? payment.status : released.status;
      booking.paymentStatus = payment.status;
    } else if (payment) {
      booking.paymentStatus = payment.status;
    }
  }
  if (wasSecured) {
    journey.occupiedSeats = Math.max(0, journey.occupiedSeats - booking.passengers);
    journey.status = statusFromOccupancy(journey.occupiedSeats, journey.capacity, "FILLING");
    journey.updatedAt = nowIso || new Date().toISOString();
  }
}

export async function expireOpenJourneys(
  db: InMemoryShareDb,
  provider: PaymentProvider,
  nowIso?: string
): Promise<{ expired: number; waitlistExpired: number }> {
  const now = nowIso || new Date().toISOString();
  let expired = 0;
  let waitlistExpired = 0;
  for (const journey of db.journeys.values()) {
    if (
      ![
        "GATHERING_INTEREST",
        "PROPOSED",
        "FILLING",
        "ALMOST_FULL",
        "READY_FOR_PAYMENT_SETUP",
      ].includes(journey.status)
    ) {
      continue;
    }
    if (journey.occupiedSeats >= db.config.earlyDepartureThreshold) {
      continue;
    }
    if (isPast(journey.confirmationDeadlineAt, now) && journey.occupiedSeats < journey.capacity) {
      journey.status = "EXPIRED";
      journey.updatedAt = now;
      expired += 1;
      for (const booking of db.bookings.values()) {
        if (booking.journeyId !== journey.id) continue;
        if (booking.paymentId) {
          const payment = db.payments.get(booking.paymentId);
          if (payment && paymentCanRelease(payment.status)) {
            const released = await provider.release(payment.id);
            payment.status = released.status;
            booking.paymentStatus = released.status;
          }
        }
      }
      db.notifications.push({ type: "JOURNEY_DID_NOT_FILL", journeyId: journey.id });
    }
  }
  for (const entry of db.waitlist.values()) {
    if (entry.status === "OFFERED" && entry.offerExpiresAt && isPast(entry.offerExpiresAt, now)) {
      entry.status = "EXPIRED";
      const journey = db.journeys.get(entry.journeyId);
      if (journey) journey.waitlistOfferOutstanding = false;
      waitlistExpired += 1;
      void offerWaitlistIfPossible(db, entry.journeyId, now);
    }
  }
  return { expired, waitlistExpired };
}

export async function resolvePaymentFailure(
  db: InMemoryShareDb,
  provider: PaymentProvider,
  journeyId: string,
  failedBookingId: string,
  nowIso?: string
): Promise<void> {
  await releaseBookingPlace(db, provider, failedBookingId, nowIso);
  const journey = db.journeys.get(journeyId);
  if (!journey) return;
  for (const booking of db.bookings.values()) {
    if (booking.journeyId !== journeyId || booking.id === failedBookingId) continue;
    if (booking.paymentId) {
      const payment = db.payments.get(booking.paymentId);
      if (payment && payment.status === "AUTHORISED") {
        await provider.release(payment.id);
        payment.status = "AUTHORISATION_RELEASED";
        booking.paymentStatus = "PAYMENT_METHOD_VERIFIED";
      }
    }
  }
  journey.status = statusFromOccupancy(journey.occupiedSeats, journey.capacity, "FILLING");
  await offerWaitlistIfPossible(db, journeyId, nowIso);
}

export async function offerWaitlistIfPossible(
  db: InMemoryShareDb,
  journeyId: string,
  nowIso?: string
): Promise<ShareWaitlistEntry | null> {
  if (!db.config.waitlistEnabled) return null;
  const journey = db.journeys.get(journeyId);
  if (!journey) return null;
  const remaining = remainingSeats(journey.occupiedSeats, journey.capacity);
  const entries = [...db.waitlist.values()].filter((row) => row.journeyId === journeyId);
  const next = nextCompatibleWaitlistOffer(entries, remaining);
  if (!next) return null;
  const token = newOpaqueToken();
  next.status = "OFFERED";
  next.offeredAt = nowIso || new Date().toISOString();
  next.offerExpiresAt = addMinutesIso(nowIso || new Date().toISOString(), db.config.waitlistOfferMinutes);
  next.offerTokenHash = hashToken(token);
  journey.waitlistOfferOutstanding = true;
  db.notifications.push({
    type: "WAITLIST_PLACE_AVAILABLE",
    waitlistId: next.id,
    email: next.email,
    offerToken: token,
    offerMinutes: db.config.waitlistOfferMinutes,
  });
  db.notifications.push({ type: "WAITLIST_OFFERED", waitlistId: next.id, email: next.email, offerToken: token });
  return next;
}

export function addWaitlist(
  db: InMemoryShareDb,
  journeyId: string,
  input: {
    passengers: number;
    name: string;
    email: string;
    mobile?: string;
    uid?: string;
    intendedDestinationText?: string;
    intendedDestinationPostcode?: string;
    sharedDropoffAcknowledged?: boolean;
    termsAccepted?: boolean;
    nowIso?: string;
  }
): ShareWaitlistEntry {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  const remaining = remainingSeats(journey.occupiedSeats, journey.capacity);
  if (remaining > 0 && !journey.waitlistOfferOutstanding) {
    throw new Error("Places are still available.");
  }
  if (destinationMatchingEnabled(journey)) {
    requireIntendedDestination(
      {
        intendedDestinationText: input.intendedDestinationText,
        intendedDestinationPostcode: input.intendedDestinationPostcode,
        sharedDropoffAcknowledged: input.sharedDropoffAcknowledged === true,
      },
      journey.destinationCity || "London"
    );
  }
  if (input.termsAccepted !== true) {
    throw new Error("You must read and agree to the Spires Share terms before joining the waitlist.");
  }
  const now = input.nowIso || new Date().toISOString();
  const entry: ShareWaitlistEntry = {
    id: id("w"),
    journeyId,
    status: "WAITING",
    passengers: input.passengers,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    uid: input.uid,
    joinedWaitlistAt: now,
    intendedDestinationText: input.intendedDestinationText,
    intendedDestinationPostcode: input.intendedDestinationPostcode,
    sharedDropoffAcknowledgedAt: input.sharedDropoffAcknowledged ? now : undefined,
    termsAcceptedAt: now,
    createdAt: now,
  };
  db.waitlist.set(entry.id, entry);
  journey.waitlistCount = (journey.waitlistCount || 0) + 1;
  return entry;
}

export async function offerEarlyDeparture(db: InMemoryShareDb, journeyId: string): Promise<{ proposedFarePence: number }> {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (
    !earlyDepartureEligible(
      journey.occupiedSeats,
      journey.capacity,
      db.config.earlyDepartureThreshold,
      journey.status === "CONFIRMED"
    )
  ) {
    throw new Error("Early confirmation is only available at 4/5 for this MVP.");
  }
  const fare = earlyDepartureFarePence(journey.targetRevenuePence, journey.occupiedSeats);
  journey.earlyDepartureOffered = true;
  journey.status = "AWAITING_EARLY_DEPARTURE_DECISION";
  db.notifications.push({ type: "EARLY_DEPARTURE_OFFERED", journeyId, proposedFarePence: fare });
  return { proposedFarePence: fare };
}

export function acceptEarlyDeparture(
  db: InMemoryShareDb,
  journeyId: string,
  bookingId: string,
  accept: boolean
): { accepted: number; required: number; confirmed: boolean; proposedFarePence: number } {
  const journey = db.journeys.get(journeyId);
  const booking = db.bookings.get(bookingId);
  if (!journey || !booking || booking.journeyId !== journeyId) throw new Error("Booking not found.");
  if (!accept) {
    booking.earlyDepartureAccepted = false;
    db.notifications.push({ type: "EARLY_DEPARTURE_OFFERED", journeyId, rejectedBy: bookingId });
  } else {
    booking.earlyDepartureAccepted = true;
    journey.earlyDepartureAcceptedBookingIds = Array.from(
      new Set([...(journey.earlyDepartureAcceptedBookingIds || []), bookingId])
    );
  }
  const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
  const accepted = acceptedPassengerCount(bookings);
  return {
    accepted,
    required: journey.occupiedSeats,
    confirmed: earlyDepartureConfirmed(accepted, journey.occupiedSeats),
    proposedFarePence: earlyDepartureFarePence(journey.targetRevenuePence, journey.occupiedSeats),
  };
}

export function defaultMockProvider(): MockPaymentProvider {
  return new MockPaymentProvider();
}

export function savePaymentLink(db: InMemoryShareDb, journeyId: string, url: string, nowIso?: string): ShareJourney {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  const validated = validateHostedPaymentUrl(url);
  const now = nowIso || new Date().toISOString();
  journey.paymentLinkUrl = validated;
  journey.paymentLinkAddedAt = now;
  journey.paymentStageStatus = journey.paymentStageStatus === "OPEN" ? "OPEN" : "LINK_SAVED";
  journey.updatedAt = now;
  db.audit.push({ type: "PAYMENT_LINK_SAVED", journeyId, at: now });
  return journey;
}

export function openPaymentWindow(
  db: InMemoryShareDb,
  journeyId: string,
  nowIso?: string,
  windowHours?: number
): { journey: ShareJourney; emailedBookingIds: string[]; deadlineAt: string } {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (!journey.paymentLinkUrl) throw new Error("Add a hosted payment link before opening the payment window.");
  const liveBookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
  assertCanOpenPaymentWindow(journey, liveBookings);
  const now = nowIso || new Date().toISOString();
  const deadline = computePaymentDeadline(
    now,
    windowHours ?? db.config.paymentWindowHours,
    db.config.paymentQuietHoursStart,
    db.config.paymentQuietHoursEnd
  );
  journey.paymentWindowOpenedAt = now;
  journey.paymentDeadlineAt = deadline.deadlineAt;
  journey.paymentStageStatus = "OPEN";
  journey.status = journeyStatusFromOccupancy(journey.occupiedSeats, journey.capacity, journey.status, "OPEN");
  journey.updatedAt = now;
  const emailedBookingIds: string[] = [];
  for (const booking of db.bookings.values()) {
    if (booking.journeyId !== journeyId || !reservationHoldsSeat(booking)) continue;
    if (booking.reservationStatus === "PAID") continue;
    booking.reservationStatus = "PAYMENT_PENDING";
    booking.hostedPaymentStatus = "PAYMENT_PENDING";
    booking.paymentStatus = "HOSTED_PENDING";
    booking.paymentDeadlineAt = deadline.deadlineAt;
    booking.paymentRequiredNotifiedAt = now;
    emailedBookingIds.push(booking.id);
    recordShareNotification(db.notifications, {
      type: "PAYMENT_REQUIRED",
      bookingId: booking.id,
      email: booking.email,
      journeyId,
      paymentDeadlineAt: deadline.deadlineAt,
      deduplicationKey: notificationDedupeKey(["PAYMENT_REQUIRED", booking.id]),
    });
  }
  db.audit.push({ type: "PAYMENT_WINDOW_OPENED", journeyId, deadlineAt: deadline.deadlineAt, at: now });
  return { journey, emailedBookingIds, deadlineAt: deadline.deadlineAt };
}

export function markReservationPaid(
  db: InMemoryShareDb,
  bookingId: string,
  actor: string,
  nowIso?: string
): { previousStatus: string; newStatus: string; confirmed: boolean } {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  const now = nowIso || new Date().toISOString();
  const previousStatus = booking.reservationStatus || "PROVISIONAL";
  booking.reservationStatus = "PAID";
  booking.hostedPaymentStatus = "PAID";
  booking.paymentStatus = "HOSTED_PAID";
  booking.paidAmountPence = bookingAmountDuePence(booking, journey.farePence);
  booking.paidAt = now;
  if (booking.paymentId) {
    const payment = db.payments.get(booking.paymentId);
    if (payment) {
      payment.status = "HOSTED_PAID";
      payment.updatedAt = now;
    }
  }
  db.audit.push({
    type: "PAYMENT_STATUS_CHANGED",
    journeyId: journey.id,
    bookingId,
    amount: String(booking.paidAmountPence),
    previousStatus,
    newStatus: "PAID",
    confirmedBy: actor,
    confirmedAt: now,
    paymentMethod: "hosted_payment_link",
  });
  recordShareNotification(db.notifications, {
    type: "PAYMENT_RECEIVED",
    bookingId,
    email: booking.email,
    journeyId: journey.id,
    amountPence: booking.paidAmountPence,
    deduplicationKey: notificationDedupeKey(["PAYMENT_RECEIVED", booking.id]),
  });
  const confirmed = confirmHostedIfEligible(db, journey.id, now);
  return { previousStatus, newStatus: "PAID", confirmed: confirmed.ok };
}

export function undoReservationPaid(db: InMemoryShareDb, bookingId: string, actor: string, nowIso?: string): void {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (journey.locked || journey.status === "CONFIRMED") {
    throw new Error("A confirmed journey cannot have payment undone automatically.");
  }
  const now = nowIso || new Date().toISOString();
  const previousStatus = booking.reservationStatus || "PAID";
  booking.reservationStatus = "PAYMENT_PENDING";
  booking.hostedPaymentStatus = "PAYMENT_PENDING";
  booking.paymentStatus = "HOSTED_PENDING";
  booking.paidAmountPence = 0;
  booking.paidAt = undefined;
  db.audit.push({
    type: "PAYMENT_STATUS_CHANGED",
    journeyId: journey.id,
    bookingId,
    amount: "0",
    previousStatus,
    newStatus: "PAYMENT_PENDING",
    confirmedBy: actor,
    confirmedAt: now,
    paymentMethod: "hosted_payment_link",
  });
}

export function expireUnpaidReservations(db: InMemoryShareDb, nowIso?: string): { expired: number } {
  const now = nowIso || new Date().toISOString();
  let expired = 0;
  for (const booking of db.bookings.values()) {
    if (booking.reservationStatus !== "PAYMENT_PENDING") continue;
    const deadline = booking.paymentDeadlineAt;
    if (!deadline || !isPast(deadline, now)) continue;
    const journey = db.journeys.get(booking.journeyId);
    if (!journey) continue;
    const keepConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
    booking.reservationStatus = "PAYMENT_EXPIRED";
    booking.hostedPaymentStatus = "EXPIRED";
    booking.paymentStatus = "HOSTED_EXPIRED";
    booking.paymentExpiredNotifiedAt = now;
    expired += 1;
    db.notifications.push({ type: "PAYMENT_EXPIRED", bookingId: booking.id, email: booking.email, journeyId: journey.id });
    db.audit.push({ type: "RESERVATION_EXPIRED", journeyId: journey.id, bookingId: booking.id, at: now });
    const remaining = [...db.bookings.values()].filter((row) => row.journeyId === journey.id && reservationHoldsSeat(row));
    journey.occupiedSeats = occupiedFromBookings(remaining);
    if (!keepConfirmed) {
      if (journey.occupiedSeats < db.config.earlyDepartureThreshold && journey.paymentStageStatus === "OPEN") {
        journey.paymentStageStatus = "LINK_SAVED";
      }
      journey.status = journeyStatusFromOccupancy(
        journey.occupiedSeats,
        journey.capacity,
        journey.status,
        journey.paymentStageStatus || "NOT_CREATED",
        matchingOccupancyContext(journey, [...db.bookings.values()].filter((row) => row.journeyId === journey.id))
      );
    }
    journey.updatedAt = now;
  }
  const flagged = new Set(
    [...db.bookings.values()].filter((row) => row.reservationStatus === "PAYMENT_EXPIRED").map((row) => row.journeyId)
  );
  for (const journeyId of flagged) {
    void offerWaitlistIfPossible(db, journeyId, now);
    const journey = db.journeys.get(journeyId);
    if (!journey || journey.status === "CONFIRMED" || journey.locked) continue;
    const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
    const guard = confirmationGuard(bookings, journey, db.config);
    if (guard.ok) continue;
    journey.paymentActionRequired = true;
    if (!journey.paymentWindowExpiredNotifiedAt) {
      journey.paymentWindowExpiredNotifiedAt = now;
      recordShareNotification(db.notifications, {
        type: "ADMIN_PAYMENT_WINDOW_EXPIRED",
        journeyId,
        email: "admin",
        deduplicationKey: notificationDedupeKey(["ADMIN_PAYMENT_WINDOW_EXPIRED", journeyId]),
      });
      for (const booking of bookings.filter((row) => row.reservationStatus === "PAID")) {
        recordShareNotification(db.notifications, {
          type: "PAYMENT_WINDOW_EXPIRED_CUSTOMER",
          bookingId: booking.id,
          email: booking.email,
          journeyId,
          refundStatus: booking.refundStatus || "PENDING",
          deduplicationKey: notificationDedupeKey(["PAYMENT_WINDOW_EXPIRED_CUSTOMER", booking.id]),
        });
      }
    }
  }
  return { expired };
}

export function offerFourPassengerOption(db: InMemoryShareDb, journeyId: string, nowIso?: string): { proposedFarePence: number } {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (!fourPassengerFallbackEnabled(journey)) {
    throw new Error("The four passenger option applies to the Heathrow Share pilot only unless this journey has it enabled.");
  }
  const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId && reservationHoldsSeat(row));
  const occupied = occupiedFromBookings(bookings);
  if (occupied !== db.config.earlyDepartureThreshold) {
    throw new Error("The four passenger option is only available when four passenger places are reserved.");
  }
  if (!bookings.every((row) => row.reservationStatus === "PAID")) {
    throw new Error("Every remaining passenger must have a confirmed £35 payment first.");
  }
  const now = nowIso || new Date().toISOString();
  journey.earlyDepartureOffered = true;
  journey.status = "FOUR_PASSENGER_OPTION";
  journey.updatedAt = now;
  const fare = earlyDepartureFarePence(journey.targetRevenuePence, occupied);
  for (const booking of bookings) {
    booking.supplementAmountDuePence = supplementDuePence(booking);
    db.notifications.push({ type: "EARLY_DEPARTURE_OFFERED", bookingId: booking.id, email: booking.email, journeyId, proposedFarePence: fare });
  }
  db.audit.push({ type: "FOUR_PASSENGER_OFFERED", journeyId, at: now });
  return { proposedFarePence: fare };
}

export function acceptFourPassenger(
  db: InMemoryShareDb,
  bookingId: string,
  accept: boolean,
  nowIso?: string
): { accepted: number; required: number; allAccepted: boolean } {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (journey.status !== "FOUR_PASSENGER_OPTION" && journey.status !== "SUPPLEMENT_PAYMENT") {
    throw new Error("The four passenger option is not available on this journey.");
  }
  const now = nowIso || new Date().toISOString();
  booking.fourPassengerAccepted = accept;
  booking.fourPassengerAcceptedAt = accept ? now : undefined;
  booking.earlyDepartureAccepted = accept;
  const holding = [...db.bookings.values()].filter((row) => row.journeyId === journey.id && reservationHoldsSeat(row));
  const accepted = holding.filter((row) => row.fourPassengerAccepted).reduce((sum, row) => sum + row.passengers, 0);
  const required = occupiedFromBookings(holding);
  if (accept && accepted === required) {
    journey.status = "SUPPLEMENT_PAYMENT";
    journey.updatedAt = now;
    for (const row of holding) {
      db.notifications.push({ type: "SUPPLEMENT_PAYMENT_REQUIRED", bookingId: row.id, email: row.email, journeyId: journey.id });
    }
  }
  db.audit.push({ type: accept ? "FOUR_PASSENGER_ACCEPTED" : "FOUR_PASSENGER_REJECTED", journeyId: journey.id, bookingId, at: now });
  return { accepted, required, allAccepted: accepted === required && accept };
}

export function saveSupplementLink(db: InMemoryShareDb, journeyId: string, url: string, nowIso?: string): ShareJourney {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  const now = nowIso || new Date().toISOString();
  journey.supplementPaymentLinkUrl = validateHostedPaymentUrl(url);
  journey.supplementLinkAddedAt = now;
  journey.updatedAt = now;
  db.audit.push({ type: "SUPPLEMENT_LINK_SAVED", journeyId, at: now });
  return journey;
}

export function markSupplementPaid(db: InMemoryShareDb, bookingId: string, actor: string, nowIso?: string): { confirmed: boolean } {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  const now = nowIso || new Date().toISOString();
  booking.supplementPaidPence = supplementDuePence(booking);
  booking.supplementPaidAt = now;
  db.audit.push({
    type: "SUPPLEMENT_STATUS_CHANGED",
    journeyId: journey.id,
    bookingId,
    amount: String(booking.supplementPaidPence),
    previousStatus: "UNPAID",
    newStatus: "PAID",
    confirmedBy: actor,
    confirmedAt: now,
    paymentMethod: "hosted_payment_link",
  });
  return { confirmed: confirmHostedIfEligible(db, journey.id, now).ok };
}

export function confirmHostedIfEligible(
  db: InMemoryShareDb,
  journeyId: string,
  nowIso?: string
): { ok: boolean; alreadyConfirmed?: boolean; status: JourneyStatus } {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (journey.locked || journey.confirmationEmailSentAt || journey.status === "CONFIRMED") {
    return { ok: true, alreadyConfirmed: true, status: "CONFIRMED" };
  }
  const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
  const guard = confirmationGuard(bookings, journey, db.config);
  if (!guard.ok) return { ok: false, status: journey.status };
  const now = nowIso || new Date().toISOString();
  journey.status = "CONFIRMED";
  journey.locked = true;
  journey.confirmedAt = now;
  journey.confirmationEmailSentAt = now;
  journey.updatedAt = now;
  for (const booking of bookings.filter(reservationHoldsSeat)) {
    recordShareNotification(db.notifications, {
      type: "JOURNEY_CONFIRMED",
      bookingId: booking.id,
      email: booking.email,
      journeyId,
      deduplicationKey: notificationDedupeKey(["JOURNEY_CONFIRMED", journeyId, booking.id]),
    });
  }
  recordShareNotification(db.notifications, {
    type: "ADMIN_ALL_PAYMENTS_RECEIVED",
    journeyId,
    email: "admin",
    deduplicationKey: notificationDedupeKey(["ADMIN_ALL_PAYMENTS_RECEIVED", journeyId]),
  });
  db.audit.push({ type: "JOURNEY_CONFIRMED", journeyId, at: now });
  return { ok: true, status: "CONFIRMED" };
}

export function cancelReservation(
  db: InMemoryShareDb,
  bookingId: string,
  nowIso?: string
): { category: string; released: boolean; journeyStillConfirmed: boolean } {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (!reservationHoldsSeat(booking) && booking.reservationStatus !== "PAID") {
    throw new Error("This reservation is no longer active.");
  }
  const now = nowIso || new Date().toISOString();
  const hours = hoursBeforeIso(journey.departureAt, now);
  const category = cancellationCategoryFor(hours, journey.status === "CONFIRMED");
  const wasConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
  booking.cancelledAt = now;
  booking.hoursBeforeDeparture = hours;
  booking.cancellationCategory = category;
  booking.reservationStatus = category === "LATE_CANCELLATION" ? "LATE_CANCELLED" : "CANCELLED";
  booking.refundStatus = booking.paidAmountPence ? "PENDING" : "NONE";
  booking.seatResold = false;
  const remaining = [...db.bookings.values()].filter((row) => row.journeyId === journey.id && reservationHoldsSeat(row));
  journey.occupiedSeats = occupiedFromBookings(remaining);
  if (!wasConfirmed) {
    journey.status = journeyStatusFromOccupancy(
      journey.occupiedSeats,
      journey.capacity,
      "GATHERING_INTEREST",
      journey.paymentStageStatus || "NOT_CREATED",
      matchingOccupancyContext(journey, remaining)
    );
  }
  journey.updatedAt = now;
  db.notifications.push({ type: "CANCELLATION_CONFIRMED", bookingId, email: booking.email, journeyId: journey.id });
  db.audit.push({ type: "PASSENGER_LEFT", journeyId: journey.id, bookingId, category, at: now });
  void offerWaitlistIfPossible(db, journey.id, now);
  return { category, released: true, journeyStillConfirmed: wasConfirmed };
}

export function markNoShow(db: InMemoryShareDb, bookingId: string, nowIso?: string): void {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  const now = nowIso || new Date().toISOString();
  booking.boardStatus = "NO_SHOW";
  booking.reservationStatus = "NO_SHOW";
  booking.cancellationCategory = "NO_SHOW";
  booking.cancelledAt = now;
  db.audit.push({ type: "PASSENGER_NO_SHOW", journeyId: journey.id, bookingId, at: now });
}

export function createPilotJourney(
  db: InMemoryShareDb,
  input: {
    airportId?: string;
    originLabel?: string;
    departureLocation?: string;
    destinationLabel?: string;
    destinationTerminal?: HeathrowTerminal;
    vehicleLabel?: string;
    travelDate: string;
    departureTime: string;
    capacity?: number;
    farePence?: number;
    targetRevenuePence?: number;
    minPassengerThreshold?: number;
    confirmationDeadlineHoursBeforeDeparture?: number;
    notes?: string;
    customerVisible?: boolean;
    nowIso?: string;
  }
): ShareJourney {
  const defaults = db.config.pilotDefaults;
  const airportId = input.airportId || defaults.airportId;
  const airport = airportById(db.config, airportId);
  if (!airport) throw new Error("Unknown airport.");
  if (!isMvpAirport(db.config, airportId)) {
    throw new Error("This Spires Share route is not available yet.");
  }
  if (!input.travelDate || !input.departureTime) {
    throw new Error("Date and departure time are required.");
  }
  const capacity = input.capacity || defaults.capacity;
  if (capacity < 1 || capacity > 5) throw new Error("Capacity must be between 1 and 5.");
  const farePence = input.farePence ?? defaults.farePence;
  const targetRevenuePence = input.targetRevenuePence ?? defaults.targetRevenuePence;
  const now = input.nowIso || new Date().toISOString();
  const departureAt = londonDateTimeToUtcIso(input.travelDate, input.departureTime);
  const hours =
    input.confirmationDeadlineHoursBeforeDeparture ??
    defaults.confirmationDeadlineHoursBeforeDeparture ??
    db.config.confirmationDeadlineHoursBeforeDeparture;
  const journeyId = id("j");
  const journey: ShareJourney = {
    id: journeyId,
    publicNumber: publicNumberFor(input.travelDate, input.departureTime),
    airportId,
    travelDate: input.travelDate,
    departureTime: input.departureTime,
    departureAt,
    confirmationDeadlineAt: subtractHoursIso(departureAt, hours),
    status: "GATHERING_INTEREST",
    capacity,
    occupiedSeats: 0,
    farePence,
    targetRevenuePence,
    originLabel: input.originLabel || defaults.originLabel,
    departureLocation: input.departureLocation || defaults.departureLocation,
    destinationLabel: input.destinationLabel || defaults.destinationLabel,
    destinationTerminal: input.destinationTerminal || defaults.destinationTerminal,
    vehicleLabel: input.vehicleLabel || defaults.vehicleLabel,
    minPassengerThreshold: input.minPassengerThreshold ?? defaults.minPassengerThreshold,
    customerVisible: Boolean(input.customerVisible),
    adminNotes: input.notes || "",
    dropoffMode: db.config.dropoffMode,
    journeyType: "AIRPORT",
    destinationMatchingEnabled: false,
    fourPassengerFallbackEnabled: true,
    fallbackFarePerPassengerPence: 4375,
    commonDropoffTerminal: input.destinationTerminal || defaults.destinationTerminal || "T3",
    earlyDepartureOffered: false,
    earlyDepartureAcceptedBookingIds: [],
    homeCollectionCount: 0,
    waitlistCount: 0,
    paymentStageStatus: "NOT_CREATED",
    createdAt: now,
    updatedAt: now,
  };
  db.journeys.set(journeyId, journey);
  db.slots.set(slotKey(airportId, input.travelDate, input.departureTime), { journeyId });
  db.audit.push({ type: "JOURNEY_CREATED", journeyId, at: now });
  return journey;
}

export function publishPilotJourney(db: InMemoryShareDb, journeyId: string, customerVisible: boolean, nowIso?: string): ShareJourney {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  journey.customerVisible = customerVisible;
  journey.updatedAt = nowIso || new Date().toISOString();
  return journey;
}

export function recordPaymentSubmitted(db: InMemoryShareDb, bookingId: string, nowIso?: string): ShareBooking {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  booking.paymentSubmittedAt = nowIso || new Date().toISOString();
  return booking;
}

export function recordRefund(
  db: InMemoryShareDb,
  bookingId: string,
  input: {
    refundStatus: ShareBooking["refundStatus"];
    amountRefundedPence?: number;
    amountRetainedPence?: number;
    adminNotes?: string;
  }
): ShareBooking {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const allowed = ["NONE", "PENDING", "REFUNDED", "RETAINED", "PARTIAL"];
  if (!input.refundStatus || !allowed.includes(input.refundStatus)) {
    throw new Error("Choose a valid refund status.");
  }
  booking.refundStatus = input.refundStatus;
  if (input.amountRefundedPence != null) booking.amountRefundedPence = Math.max(0, Number(input.amountRefundedPence) || 0);
  if (input.amountRetainedPence != null) booking.amountRetainedPence = Math.max(0, Number(input.amountRetainedPence) || 0);
  if (input.adminNotes != null) booking.adminNotes = String(input.adminNotes);
  return booking;
}

export function createCityMatchingJourney(
  db: InMemoryShareDb,
  input: {
    originCity: string;
    destinationCity: string;
    departureLocation: string;
    travelDate: string;
    departureTime: string;
    capacity?: number;
    farePence?: number;
    targetRevenuePence?: number;
    minPassengerThreshold?: number;
    confirmationDeadlineHoursBeforeDeparture?: number;
    notes?: string;
    nowIso?: string;
  }
): ShareJourney {
  const originCity = String(input.originCity || "").trim();
  const destinationCity = String(input.destinationCity || "").trim();
  if (!originCity || !destinationCity) throw new Error("Origin city and destination city are required.");
  if (!input.departureLocation || !input.travelDate || !input.departureTime) {
    throw new Error("Departure location, date and time are required.");
  }
  const capacity = input.capacity || db.config.pilotDefaults.capacity;
  if (capacity < 1 || capacity > 5) throw new Error("Capacity must be between 1 and 5.");
  const farePence = cityJourneyRequiresOwnFare(input.farePence);
  const targetRevenuePence = input.targetRevenuePence ?? farePence * capacity;
  const now = input.nowIso || new Date().toISOString();
  const departureAt = londonDateTimeToUtcIso(input.travelDate, input.departureTime);
  const hours =
    input.confirmationDeadlineHoursBeforeDeparture ??
    db.config.pilotDefaults.confirmationDeadlineHoursBeforeDeparture ??
    db.config.confirmationDeadlineHoursBeforeDeparture;
  const journeyId = id("j");
  const airportId = cityRouteKey(originCity, destinationCity);
  const journey: ShareJourney = {
    id: journeyId,
    publicNumber: publicNumberFor(input.travelDate, input.departureTime),
    airportId,
    travelDate: input.travelDate,
    departureTime: input.departureTime,
    departureAt,
    confirmationDeadlineAt: subtractHoursIso(departureAt, hours),
    status: "GATHERING_INTEREST",
    capacity,
    occupiedSeats: 0,
    farePence,
    targetRevenuePence,
    originLabel: originCity,
    originCity,
    destinationCity,
    destinationLabel: destinationCity,
    departureLocation: input.departureLocation,
    vehicleLabel: db.config.pilotDefaults.vehicleLabel,
    minPassengerThreshold: input.minPassengerThreshold ?? db.config.pilotDefaults.minPassengerThreshold,
    customerVisible: false,
    adminNotes: input.notes || "",
    dropoffMode: "common_dropoff",
    journeyType: journeyTypeForRegion(destinationCity),
    destinationMatchingEnabled: destinationMatchingForRegion(destinationCity),
    fourPassengerFallbackEnabled: false,
    destinationMatchingPublicEnabled: false,
    sharedDropoffProposalVersion: 0,
    earlyDepartureOffered: false,
    earlyDepartureAcceptedBookingIds: [],
    homeCollectionCount: 0,
    waitlistCount: 0,
    paymentStageStatus: "NOT_CREATED",
    createdAt: now,
    updatedAt: now,
  };
  db.journeys.set(journeyId, journey);
  db.slots.set(slotKey(airportId, input.travelDate, input.departureTime), { journeyId });
  db.audit.push({ type: "JOURNEY_CREATED", journeyId, at: now });
  return journey;
}

export function createDropoffHub(
  db: InMemoryShareDb,
  input: {
    name: string;
    city: string;
    displayName?: string;
    address?: string;
    postcode?: string;
    latitude?: number;
    longitude?: number;
    enabled?: boolean;
    adminNotes?: string;
    nowIso?: string;
  }
): ShareDropoffHub {
  const name = String(input.name || "").trim();
  const city = String(input.city || "").trim();
  if (!name || !city) throw new Error("Hub name and city are required.");
  const now = input.nowIso || new Date().toISOString();
  const hubId = id("hub");
  const hub: ShareDropoffHub = {
    id: hubId,
    hubId,
    name,
    city,
    displayName: String(input.displayName || name).trim(),
    address: String(input.address || "").trim() || undefined,
    postcode: String(input.postcode || "").trim() || undefined,
    latitude: Number.isFinite(Number(input.latitude)) ? Number(input.latitude) : undefined,
    longitude: Number.isFinite(Number(input.longitude)) ? Number(input.longitude) : undefined,
    enabled: input.enabled === true,
    adminNotes: String(input.adminNotes || "").trim() || undefined,
    createdAt: now,
    updatedAt: now,
  };
  db.hubs.set(hubId, hub);
  db.audit.push({ type: "DROPOFF_HUB_CREATED", hubId, at: now });
  return hub;
}

export function setDropoffHubEnabled(db: InMemoryShareDb, hubId: string, enabled: boolean, nowIso?: string): ShareDropoffHub {
  const hub = db.hubs.get(hubId);
  if (!hub) throw new Error("Shared drop off hub not found.");
  hub.enabled = enabled;
  hub.updatedAt = nowIso || new Date().toISOString();
  db.audit.push({ type: "DROPOFF_HUB_UPDATED", hubId, enabled, at: hub.updatedAt });
  return hub;
}

export function proposeSharedDropoff(
  db: InMemoryShareDb,
  journeyId: string,
  hubId: string,
  actor: string,
  nowIso?: string
): ShareJourney {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (!destinationMatchingEnabled(journey)) throw new Error("This journey does not use destination matching.");
  const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
  if (paymentSensitiveForDropoffChange(journey, bookings) && proposedHubId(journey)) {
    throw new Error("The shared drop off cannot be changed after payment has opened. This needs exceptional manual intervention.");
  }
  const hub = assertHubSelectable(db.hubs.get(hubId), hubId);
  const now = nowIso || new Date().toISOString();
  const previousVersion = Number(journey.sharedDropoffProposalVersion || 0);
  const nextVersion = previousVersion + 1;
  const changed = Boolean(proposedHubId(journey) && proposedHubId(journey) !== (hub.hubId || hub.id));
  journey.proposedSharedDropoffHubId = hub.hubId || hub.id;
  journey.proposedSharedDropoffDisplayName = hub.displayName || hub.name;
  journey.confirmedSharedDropoffHubId = hub.hubId || hub.id;
  journey.sharedDropoffProposalVersion = nextVersion;
  journey.sharedDropoffProposedAt = now;
  journey.sharedDropoffProposedBy = actor;
  journey.sharedDropoffConfirmedAt = now;
  journey.sharedDropoffConfirmedBy = actor;
  const suggestion = applyMatchingSuggestion(journey, rankSharedDropoffHubs(bookings, [...db.hubs.values()]));
  journey.suggestedSharedDropoffHubId = suggestion.suggestedSharedDropoffHubId;
  journey.suggestedSharedDropoffReason = suggestion.suggestedSharedDropoffReason;
  for (const booking of bookings) {
    if (!reservationHoldsSeat(booking)) continue;
    booking.sharedDropoffAcceptedAt = undefined;
    booking.acceptedDropoffProposalVersion = undefined;
    booking.sharedDropoffDeclinedAt = undefined;
  }
  journey.status = journeyStatusFromOccupancy(
    occupiedFromBookings(bookings),
    journey.capacity,
    journey.status,
    journey.paymentStageStatus || "NOT_CREATED",
    matchingOccupancyContext(journey, bookings)
  );
  journey.updatedAt = now;
  db.audit.push({
    type: changed ? "SHARED_DROPOFF_CHANGED" : "SHARED_DROPOFF_PROPOSED",
    journeyId,
    hubId: hub.hubId,
    version: nextVersion,
    actor,
    at: now,
  });
  for (const booking of bookings.filter(reservationHoldsSeat)) {
    db.notifications.push({
      type: changed ? "SHARED_DROPOFF_CHANGED" : "SHARED_DROPOFF_PROPOSED",
      bookingId: booking.id,
      email: booking.email,
      journeyId,
      hubName: hub.displayName || hub.name,
    });
  }
  return journey;
}

export function acceptSharedDropoff(db: InMemoryShareDb, bookingId: string, nowIso?: string): ShareBooking {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (!destinationMatchingEnabled(journey)) throw new Error("This journey does not use destination matching.");
  if (!proposedHubId(journey)) throw new Error("A shared drop off has not been proposed yet.");
  if (!reservationHoldsSeat(booking)) throw new Error("This reservation is no longer active.");
  const now = nowIso || new Date().toISOString();
  booking.sharedDropoffAcceptedAt = now;
  booking.acceptedDropoffProposalVersion = Number(journey.sharedDropoffProposalVersion || 1);
  booking.sharedDropoffDeclinedAt = undefined;
  if (journey.paymentStageStatus === "OPEN" && booking.reservationStatus === "PROVISIONAL") {
    booking.reservationStatus = "PAYMENT_PENDING";
    booking.hostedPaymentStatus = "PAYMENT_PENDING";
    booking.paymentStatus = "HOSTED_PENDING";
    booking.paymentDeadlineAt = journey.paymentDeadlineAt;
  }
  const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journey.id);
  journey.status = journeyStatusFromOccupancy(
    occupiedFromBookings(bookings),
    journey.capacity,
    journey.status,
    journey.paymentStageStatus || "NOT_CREATED",
    matchingOccupancyContext(journey, bookings)
  );
  journey.updatedAt = now;
  db.audit.push({ type: "SHARED_DROPOFF_ACCEPTED", journeyId: journey.id, bookingId, version: booking.acceptedDropoffProposalVersion, at: now });
  return booking;
}

export function declineSharedDropoff(db: InMemoryShareDb, bookingId: string, nowIso?: string): ShareBooking {
  const booking = db.bookings.get(bookingId);
  if (!booking) throw new Error("Booking not found.");
  const journey = db.journeys.get(booking.journeyId);
  if (!journey) throw new Error("Journey not found.");
  if (!destinationMatchingEnabled(journey)) throw new Error("This journey does not use destination matching.");
  if (!proposedHubId(journey)) throw new Error("A shared drop off has not been proposed yet.");
  if (booking.reservationStatus === "PAID" || (booking.paidAmountPence || 0) > 0) {
    throw new Error("A paid reservation cannot decline the shared drop off through this flow.");
  }
  const now = nowIso || new Date().toISOString();
  booking.reservationStatus = "DROP_OFF_DECLINED";
  booking.sharedDropoffDeclinedAt = now;
  booking.sharedDropoffAcceptedAt = undefined;
  booking.acceptedDropoffProposalVersion = undefined;
  booking.hostedPaymentStatus = "UNPAID";
  booking.paymentStatus = "HOSTED_UNPAID";
  const remaining = [...db.bookings.values()].filter((row) => row.journeyId === journey.id && reservationHoldsSeat(row));
  journey.occupiedSeats = occupiedFromBookings(remaining);
  journey.status = journeyStatusFromOccupancy(
    journey.occupiedSeats,
    journey.capacity,
    "GATHERING_INTEREST",
    journey.paymentStageStatus || "NOT_CREATED",
    matchingOccupancyContext(journey, remaining)
  );
  journey.updatedAt = now;
  db.audit.push({ type: "SHARED_DROPOFF_DECLINED", journeyId: journey.id, bookingId, at: now });
  db.notifications.push({ type: "PLACE_RELEASED", bookingId, email: booking.email, journeyId: journey.id });
  void offerWaitlistIfPossible(db, journey.id, now);
  return booking;
}

export function requireShareAuth(uid?: string): string {
  if (!uid) throw new Error("Sign in to register or manage Spires Share interest.");
  return uid;
}

export function listPublicInterestGroups(db: InMemoryShareDb): PublicInterestGroupView[] {
  return [...db.interestGroups.values()]
    .filter((row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW")
    .sort((a, b) => `${a.travelDate}${a.timeWindowStart}`.localeCompare(`${b.travelDate}${b.timeWindowStart}`))
    .map(toPublicInterestGroup);
}

function defaultPartyLuggage(passengers: number): LuggageDeclaration {
  return { largeSuitcases: passengers, cabinBags: passengers, other: "" };
}

function activeInterestEntries(db: InMemoryShareDb, groupId: string): ShareInterestEntry[] {
  return [...db.interestEntries.values()].filter((row) => row.interestGroupId === groupId && row.status === "ACTIVE");
}

function recountInterestGroup(db: InMemoryShareDb, group: ShareInterestGroup): void {
  const seats = activeInterestEntries(db, group.id).reduce((sum, row) => sum + row.passengers, 0);
  group.interestedSeatCount = seats;
  group.status = interestGroupStatusFromCount(seats, group.minPassengerThreshold, group.status);
}

export function reservationStageForIncomingPassenger(
  journey: ShareJourney,
  config: ShareConfig,
  now: string
): { reservationStatus: ReservationStatus; paymentDeadlineAt?: string } {
  if (destinationMatchingEnabled(journey)) {
    return { reservationStatus: "PROVISIONAL" };
  }
  if (journey.paymentStageStatus === "OPEN") {
    const joinerDeadline = computeJoinerPaymentDeadline(
      now,
      journey.paymentDeadlineAt,
      config.paymentWindowHours,
      config.paymentQuietHoursStart,
      config.paymentQuietHoursEnd,
      config.paymentJoinerMinimumMinutes
    );
    return { reservationStatus: "PAYMENT_PENDING", paymentDeadlineAt: joinerDeadline.deadlineAt };
  }
  return { reservationStatus: "PROVISIONAL" };
}

function addIncomingBooking(
  db: InMemoryShareDb,
  journey: ShareJourney,
  input: {
    passengers: number;
    name: string;
    email: string;
    mobile?: string;
    uid?: string;
    luggage?: LuggageDeclaration;
    dropoffTerminal?: HeathrowTerminal;
    departureTerminal?: string;
    flightNumber?: string;
    flightDepartureTime?: string;
    flexibility?: Flexibility;
    intendedDestinationText?: string;
    intendedDestinationPostcode?: string;
    sharedDropoffAcknowledged?: boolean;
    waitlistId?: string;
    interestEntryId?: string;
    claimingWaitlist?: boolean;
    nowIso?: string;
  }
): { booking: ShareBooking; manageToken: string } {
  const now = input.nowIso || new Date().toISOString();
  if (!canAddPassengers(journey.occupiedSeats, input.passengers, journey.capacity)) {
    throw new Error("No remaining places.");
  }
  if (journey.waitlistOfferOutstanding && !input.claimingWaitlist) {
    throw new Error("A place is currently offered to someone on the waitlist.");
  }
  const keepConfirmed = journey.status === "CONFIRMED" || Boolean(journey.locked);
  const luggage = input.luggage || defaultPartyLuggage(input.passengers);
  const existingBookings = [...db.bookings.values()].filter((row) => row.journeyId === journey.id && reservationHoldsSeat(row));
  if (
    !luggageFitsVehicle(
      existingBookings.map((row) => row.luggage),
      luggage,
      db.config.luggage.maxLargeSuitcasesPerVehicle,
      db.config.luggage.maxCabinBagsPerVehicle
    )
  ) {
    throw new Error("Luggage exceeds the vehicle allowance.");
  }
  if (destinationMatchingEnabled(journey)) {
    requireIntendedDestination(
      {
        intendedDestinationText: input.intendedDestinationText,
        intendedDestinationPostcode: input.intendedDestinationPostcode,
        sharedDropoffAcknowledged: input.sharedDropoffAcknowledged === true || Boolean(input.sharedDropoffAcknowledged),
      },
      journey.destinationCity || "London"
    );
  }
  const stage = reservationStageForIncomingPassenger(journey, db.config, now);
  const bookingId = id("b");
  const paymentId = `pay_${bookingId}`;
  const manageToken = newOpaqueToken();
  const destination =
    destinationMatchingEnabled(journey) && input.intendedDestinationText
      ? {
          intendedDestinationText: input.intendedDestinationText,
          intendedDestinationPostcode: input.intendedDestinationPostcode,
          sharedDropoffAcknowledged: true,
        }
      : null;
  const booking: ShareBooking = {
    id: bookingId,
    journeyId: journey.id,
    publicNumber: journey.publicNumber,
    uid: input.uid,
    passengers: input.passengers,
    name: input.name,
    mobile: input.mobile || "",
    email: input.email,
    flightNumber: input.flightNumber,
    flightDepartureTime: input.flightDepartureTime,
    dropoffTerminal: isHeathrowShare(journey) ? "T3" : input.dropoffTerminal || journey.destinationTerminal,
    departureTerminal: parseFlightTerminal(input.departureTerminal || input.dropoffTerminal || journey.destinationTerminal),
    flexibility: input.flexibility || "plus_minus_30",
    luggage,
    homeCollection: "HOME_COLLECTION_UNAVAILABLE",
    homeCollectionSurchargePence: 0,
    paymentId,
    paymentMethodRef: "hosted_payment_link",
    paymentStatus: paymentStatusFromReservation(stage.reservationStatus),
    hostedPaymentStatus: stage.reservationStatus === "PAYMENT_PENDING" ? "PAYMENT_PENDING" : "UNPAID",
    reservationStatus: stage.reservationStatus,
    paidAmountPence: 0,
    paymentDeadlineAt: stage.paymentDeadlineAt,
    termsAcceptedAt: now,
    termsVersion: SHARE_TERMS_VERSION,
    boardStatus: "NOT_CHECKED_IN",
    earlyDepartureAccepted: false,
    manageTokenHash: hashToken(manageToken),
    idempotencyKey: `join_${bookingId}`,
    createdAt: now,
    waitlistId: input.waitlistId,
    interestEntryId: input.interestEntryId,
    ...(destination ? destinationFieldsForBooking(destination, now) : {}),
  };
  const occupied = journey.occupiedSeats + input.passengers;
  journey.occupiedSeats = occupied;
  journey.status = keepConfirmed
    ? "CONFIRMED"
    : journeyStatusFromOccupancy(
        occupied,
        journey.capacity,
        journey.status === "PROPOSED" ? "GATHERING_INTEREST" : journey.status,
        journey.paymentStageStatus || "NOT_CREATED",
        matchingOccupancyContext(journey, [...existingBookings, booking])
      );
  journey.updatedAt = now;
  db.bookings.set(bookingId, booking);
  db.payments.set(paymentId, {
    id: paymentId,
    bookingId,
    journeyId: journey.id,
    amountPence: journey.farePence * input.passengers,
    currency: "GBP",
    status: paymentStatusFromReservation(stage.reservationStatus),
    paymentMethodRef: "hosted_payment_link",
    provider: "hosted_payment_link",
    updatedAt: now,
  });
  db.notifications.push({ type: "BOOKING_RECEIVED", bookingId, email: booking.email, journeyId: journey.id });
  if (stage.reservationStatus === "PAYMENT_PENDING") {
    db.notifications.push({ type: "PAYMENT_REQUIRED", bookingId, email: booking.email, journeyId: journey.id });
  }
  return { booking, manageToken };
}

export function expressInterest(
  db: InMemoryShareDb,
  input: InterestRequest & {
    name: string;
    email: string;
    mobile?: string;
    uid?: string;
    termsAccepted?: boolean;
    nowIso?: string;
  }
): { group: ShareInterestGroup; entry: ShareInterestEntry; joinedExisting: boolean; matchingUncertain: boolean } {
  const uid = requireShareAuth(input.uid);
  if (input.termsAccepted !== true) {
    throw new Error("You must read and agree to the Spires Share terms before registering interest.");
  }
  const origin = normalizePlace(input.origin);
  const destination = normalizePlace(input.destinationRegion);
  if (!origin.label || !destination.label) throw new Error("Origin and destination are required.");
  if (!input.travelDate) throw new Error("Travel date is required.");
  if (!input.passengers || input.passengers < 1) throw new Error("Choose how many seats you need.");
  assertPartyFitsCapacity(input.passengers, db.config.passengerCapacity);
  const window = resolveInterestWindow(input);
  const matchingUncertain = !origin.known || !destination.known;
  const journeyType = journeyTypeForRegion(destination.label);
  if (destinationMatchingForRegion(destination.label)) {
    requireIntendedDestination(
      {
        intendedDestinationText: input.intendedDestinationText,
        intendedDestinationPostcode: input.intendedDestinationPostcode,
        sharedDropoffAcknowledged: input.sharedDropoffAcknowledged === true,
      },
      destination.label
    );
  }
  const now = input.nowIso || new Date().toISOString();
  const openGroups = [...db.interestGroups.values()];
  const existingOwn = [...db.interestEntries.values()].find((row) => {
    if (row.uid !== uid || row.status !== "ACTIVE") return false;
    const group = db.interestGroups.get(row.interestGroupId);
    return Boolean(
      group &&
        (group.status === "GATHERING_INTEREST" || group.status === "READY_FOR_REVIEW") &&
        group.origin === origin.label &&
        group.destinationRegion === destination.label &&
        group.travelDate === input.travelDate
    );
  });
  if (existingOwn) {
    const group = db.interestGroups.get(existingOwn.interestGroupId)!;
    return { group, entry: existingOwn, joinedExisting: true, matchingUncertain: Boolean(group.matchingUncertain) };
  }
  const compatible = findCompatibleInterestGroup(openGroups, {
    origin: origin.label,
    destinationRegion: destination.label,
    travelDate: input.travelDate,
    timeWindowStart: window.start,
    timeWindowEnd: window.end,
  });
  const group =
    compatible ||
    (() => {
      const groupId = id("ig");
      const created: ShareInterestGroup = {
        id: groupId,
        publicNumber: interestPublicNumber(origin.label, destination.label, input.travelDate, window.start, window.end),
        origin: origin.label,
        destinationRegion: destination.label,
        journeyType,
        destinationMatchingEnabled: destinationMatchingForRegion(destination.label),
        travelDate: input.travelDate,
        preferredDepartureTime: window.preferred,
        timeWindowStart: window.start,
        timeWindowEnd: window.end,
        interestedSeatCount: 0,
        minPassengerThreshold: db.config.pilotDefaults.minPassengerThreshold,
        status: "GATHERING_INTEREST",
        interestDeadlineAt: computeInterestDeadline(
          now,
          db.config.interestRegistrationHours || 48,
          db.config.paymentQuietHoursStart,
          db.config.paymentQuietHoursEnd
        ).deadlineAt,
        matchingUncertain,
        createdAt: now,
        updatedAt: now,
      };
      db.interestGroups.set(groupId, created);
      db.audit.push({ type: "INTEREST_CREATED", interestGroupId: groupId, at: now });
      return created;
    })();
  const entry: ShareInterestEntry = {
    id: id("ie"),
    interestGroupId: group.id,
    uid,
    passengers: input.passengers,
    name: input.name,
    email: input.email,
    mobile: input.mobile,
    preferredDepartureTime: window.preferred,
    timeWindowStart: window.start,
    timeWindowEnd: window.end,
    flexibility: window.flexibility,
    intendedDestinationText: input.intendedDestinationText,
    intendedDestinationPostcode: input.intendedDestinationPostcode,
    sharedDropoffAcknowledgedAt: input.sharedDropoffAcknowledged ? now : undefined,
    termsAcceptedAt: now,
    termsVersion: SHARE_TERMS_VERSION,
    flightNumber: input.flightNumber,
    flightDepartureTime: input.flightDepartureTime,
    departureTerminal: parseFlightTerminal(input.departureTerminal),
    dropoffTerminal: isHeathrowTerminal(String(input.dropoffTerminal || ""), ["T2", "T3", "T4", "T5"]) ? (input.dropoffTerminal as HeathrowTerminal) : undefined,
    status: "ACTIVE",
    createdAt: now,
  };
  db.interestEntries.set(entry.id, entry);
  if (matchingUncertain) group.matchingUncertain = true;
  recountInterestGroup(db, group);
  group.updatedAt = now;
  notifyInterestRegistration(db, group, entry, now);
  db.audit.push({ type: compatible ? "INTEREST_JOINED" : "INTEREST_CREATED", interestGroupId: group.id, entryId: entry.id, at: now });
  return { group, entry, joinedExisting: Boolean(compatible), matchingUncertain: Boolean(group.matchingUncertain) };
}

function notifyInterestRegistration(
  db: InMemoryShareDb,
  group: ShareInterestGroup,
  entry: ShareInterestEntry,
  now: string
): void {
  const required = requiredSeatsForGroup(group);
  const progress = seatProgress(group.interestedSeatCount, required);
  recordShareNotification(db.notifications, {
    type: "INTEREST_RECEIVED",
    email: entry.email,
    interestGroupId: group.id,
    entryId: entry.id,
    seatsRequested: entry.passengers,
    interestedSeatCount: group.interestedSeatCount,
    requiredSeats: required,
    remainingNeeded: progress.remaining,
    interestDeadlineAt: group.interestDeadlineAt,
    deduplicationKey: notificationDedupeKey(["INTEREST_RECEIVED", entry.id]),
  });
  recordShareNotification(db.notifications, {
    type: "ADMIN_NEW_INTEREST",
    email: "admin",
    interestGroupId: group.id,
    entryId: entry.id,
    name: entry.name,
    customerEmail: entry.email,
    seatsRequested: entry.passengers,
    interestedSeatCount: group.interestedSeatCount,
    requiredSeats: required,
    remainingNeeded: progress.remaining,
    interestDeadlineAt: group.interestDeadlineAt,
    deduplicationKey: notificationDedupeKey(["ADMIN_NEW_INTEREST", entry.id]),
  });
  if (progress.remaining === 1 && !group.oneMorePassengerNotifiedAt) {
    group.oneMorePassengerNotifiedAt = now;
    for (const row of activeInterestEntries(db, group.id)) {
      recordShareNotification(db.notifications, {
        type: "INTEREST_PROGRESS_ONE_MORE",
        email: row.email,
        interestGroupId: group.id,
        entryId: row.id,
        interestedSeatCount: group.interestedSeatCount,
        requiredSeats: required,
        remainingNeeded: 1,
        interestDeadlineAt: group.interestDeadlineAt,
        deduplicationKey: notificationDedupeKey(["INTEREST_PROGRESS_ONE_MORE", group.id, row.id]),
      });
    }
  }
  if (progress.enough && !group.thresholdReachedNotifiedAt) {
    group.thresholdReachedNotifiedAt = now;
    recordShareNotification(db.notifications, {
      type: "ADMIN_THRESHOLD_REACHED",
      interestGroupId: group.id,
      email: "admin",
      interestedSeatCount: group.interestedSeatCount,
      requiredSeats: required,
      remainingNeeded: 0,
      deduplicationKey: notificationDedupeKey(["ADMIN_THRESHOLD_REACHED", group.id]),
    });
    recordShareNotification(db.notifications, {
      type: "INTEREST_GROUP_READY",
      interestGroupId: group.id,
      email: "admin",
      deduplicationKey: notificationDedupeKey(["INTEREST_GROUP_READY", group.id]),
    });
  }
}

export function expireInsufficientInterest(db: InMemoryShareDb, nowIso?: string): number {
  const now = nowIso || new Date().toISOString();
  let expired = 0;
  for (const group of db.interestGroups.values()) {
    if (group.status !== "GATHERING_INTEREST") continue;
    if (!group.interestDeadlineAt || !isPast(group.interestDeadlineAt, now)) continue;
    if (seatProgress(group.interestedSeatCount, requiredSeatsForGroup(group)).enough) continue;
    group.status = "EXPIRED";
    group.expiryReason = "INSUFFICIENT_INTEREST";
    group.updatedAt = now;
    if (!group.expiredNotifiedAt) {
      group.expiredNotifiedAt = now;
      for (const entry of activeInterestEntries(db, group.id)) {
        recordShareNotification(db.notifications, {
          type: "INTEREST_EXPIRED",
          email: entry.email,
          interestGroupId: group.id,
          entryId: entry.id,
          deduplicationKey: notificationDedupeKey(["INTEREST_EXPIRED", group.id, entry.id]),
        });
      }
      recordShareNotification(db.notifications, {
        type: "INTEREST_EXPIRED",
        email: "admin",
        interestGroupId: group.id,
        note: "Interest expired without enough passengers",
        deduplicationKey: notificationDedupeKey(["INTEREST_EXPIRED_ADMIN", group.id]),
      });
    }
    db.audit.push({ type: "INTEREST_EXPIRED", interestGroupId: group.id, at: now });
    expired += 1;
  }
  return expired;
}

export function setInterestDeadline(
  db: InMemoryShareDb,
  interestGroupId: string,
  deadlineAt: string,
  actor: string,
  nowIso?: string
): ShareInterestGroup {
  const group = db.interestGroups.get(interestGroupId);
  if (!group) throw new Error("Interest group not found.");
  const now = nowIso || new Date().toISOString();
  group.interestDeadlineAt = deadlineAt;
  group.updatedAt = now;
  db.audit.push({ type: "INTEREST_DEADLINE_CHANGED", interestGroupId, actor, deadlineAt, at: now });
  return group;
}

export function setPaymentDeadline(
  db: InMemoryShareDb,
  journeyId: string,
  deadlineAt: string,
  actor: string,
  nowIso?: string
): ShareJourney {
  const journey = db.journeys.get(journeyId);
  if (!journey) throw new Error("Journey not found.");
  const now = nowIso || new Date().toISOString();
  const previous = journey.paymentDeadlineAt;
  journey.paymentDeadlineAt = deadlineAt;
  journey.updatedAt = now;
  for (const booking of db.bookings.values()) {
    if (booking.journeyId !== journeyId || booking.reservationStatus !== "PAYMENT_PENDING") continue;
    booking.paymentDeadlineAt = deadlineAt;
  }
  db.audit.push({ type: "PAYMENT_DEADLINE_CHANGED", journeyId, actor, previousDeadlineAt: previous, deadlineAt, at: now });
  return journey;
}

export function previewInterest(db: InMemoryShareDb, input: InterestRequest): PublicInterestGroupView | null {
  return previewCompatibleInterest([...db.interestGroups.values()], input);
}

export function updateInterestEntry(
  db: InMemoryShareDb,
  entryId: string,
  uid: string | undefined,
  patch: Partial<InterestRequest> & { name?: string; mobile?: string }
): { group: ShareInterestGroup; entry: ShareInterestEntry; rematched: boolean } {
  const entry = db.interestEntries.get(entryId);
  if (!entry || entry.status !== "ACTIVE") throw new Error("Interest record not found.");
  requireShareAuth(uid);
  if (entry.uid && entry.uid !== uid) throw new Error("Interest record not found.");
  const group = db.interestGroups.get(entry.interestGroupId);
  if (!group) throw new Error("Interest group not found.");
  if (group.status === "CONVERTED_TO_JOURNEY") {
    throw new Error("This request cannot be changed after an exact journey has been proposed.");
  }
  const origin = normalizePlace(patch.origin || group.origin);
  const destination = normalizePlace(patch.destinationRegion || group.destinationRegion);
  const travelDate = patch.travelDate || group.travelDate;
  const window = resolveInterestWindow({
    origin: origin.label,
    destinationRegion: destination.label,
    travelDate,
    preferredDepartureTime: patch.preferredDepartureTime || entry.preferredDepartureTime || group.preferredDepartureTime || group.timeWindowStart,
    flexibility: patch.flexibility || entry.flexibility,
    timeWindowStart: patch.timeWindowStart,
    timeWindowEnd: patch.timeWindowEnd,
    passengers: patch.passengers || entry.passengers,
  });
  if (destinationMatchingForRegion(destination.label)) {
    requireIntendedDestination(
      {
        intendedDestinationText: patch.intendedDestinationText ?? entry.intendedDestinationText,
        intendedDestinationPostcode: patch.intendedDestinationPostcode ?? entry.intendedDestinationPostcode,
        sharedDropoffAcknowledged: patch.sharedDropoffAcknowledged === true || Boolean(entry.sharedDropoffAcknowledgedAt),
      },
      destination.label
    );
  }
  if (patch.passengers) {
    assertPartyFitsCapacity(patch.passengers, db.config.passengerCapacity);
    entry.passengers = patch.passengers;
  }
  entry.preferredDepartureTime = window.preferred;
  entry.timeWindowStart = window.start;
  entry.timeWindowEnd = window.end;
  entry.flexibility = window.flexibility;
  if (patch.intendedDestinationText != null) entry.intendedDestinationText = patch.intendedDestinationText;
  if (patch.intendedDestinationPostcode != null) entry.intendedDestinationPostcode = patch.intendedDestinationPostcode;
  if (patch.flightNumber != null) entry.flightNumber = patch.flightNumber;
  if (patch.flightDepartureTime != null) entry.flightDepartureTime = patch.flightDepartureTime;
  if (patch.departureTerminal != null) entry.departureTerminal = parseFlightTerminal(patch.departureTerminal);
  if (patch.name) entry.name = patch.name;
  if (patch.mobile) entry.mobile = patch.mobile;
  const stillMatches =
    group.origin === origin.label &&
    group.destinationRegion === destination.label &&
    group.travelDate === travelDate &&
    windowsOverlap(group.timeWindowStart, group.timeWindowEnd, window.start, window.end);
  if (stillMatches) {
    recountInterestGroup(db, group);
    return { group, entry, rematched: false };
  }
  entry.status = "WITHDRAWN";
  recountInterestGroup(db, group);
  const moved = expressInterest(db, {
    origin: origin.label,
    destinationRegion: destination.label,
    travelDate,
    preferredDepartureTime: window.preferred,
    flexibility: window.flexibility,
    timeWindowStart: window.start,
    timeWindowEnd: window.end,
    passengers: entry.passengers,
    intendedDestinationText: entry.intendedDestinationText,
    intendedDestinationPostcode: entry.intendedDestinationPostcode,
    sharedDropoffAcknowledged: Boolean(entry.sharedDropoffAcknowledgedAt),
    flightNumber: entry.flightNumber,
    flightDepartureTime: entry.flightDepartureTime,
    departureTerminal: entry.departureTerminal,
    name: entry.name,
    email: entry.email,
    mobile: entry.mobile,
    uid,
    termsAccepted: true,
  });
  return { group: moved.group, entry: moved.entry, rematched: true };
}

export function joinInterestGroup(
  db: InMemoryShareDb,
  publicNumber: string,
  input: InterestRequest & {
    name: string;
    email: string;
    mobile?: string;
    uid?: string;
    termsAccepted?: boolean;
    nowIso?: string;
  }
): { group: ShareInterestGroup; entry: ShareInterestEntry; joinedExisting: boolean; matchingUncertain: boolean } {
  const group = [...db.interestGroups.values()].find((row) => row.publicNumber === publicNumber);
  if (!group || (group.status !== "GATHERING_INTEREST" && group.status !== "READY_FOR_REVIEW")) {
    throw new Error("Interest group not found.");
  }
  return expressInterest(db, {
    ...input,
    origin: group.origin,
    destinationRegion: group.destinationRegion,
    travelDate: group.travelDate,
    preferredDepartureTime: input.preferredDepartureTime || group.preferredDepartureTime || group.timeWindowStart,
    timeWindowStart: input.timeWindowStart || group.timeWindowStart,
    timeWindowEnd: input.timeWindowEnd || group.timeWindowEnd,
    flexibility: input.flexibility || "plus_minus_30",
  });
}

export function proposeJourneyFromInterest(
  db: InMemoryShareDb,
  interestGroupId: string,
  input: {
    departureLocation: string;
    departureTime: string;
    farePence?: number;
    capacity?: number;
    hubId?: string;
    notes?: string;
    actor?: string;
    customerVisible?: boolean;
    nowIso?: string;
  }
): ShareJourney {
  const group = db.interestGroups.get(interestGroupId);
  if (!group) throw new Error("Interest group not found.");
  if (group.status === "EXPIRED") {
    throw new Error("This interest group expired without enough passengers and cannot proceed to payment.");
  }
  if (group.status !== "GATHERING_INTEREST" && group.status !== "READY_FOR_REVIEW") {
    throw new Error("This interest group cannot be converted.");
  }
  if (!input.departureLocation || !input.departureTime) {
    throw new Error("Exact departure location and departure time are required.");
  }
  const now = input.nowIso || new Date().toISOString();
  const journey =
    group.journeyType === "AIRPORT"
      ? createPilotJourney(db, {
          originLabel: group.origin,
          departureLocation: input.departureLocation,
          destinationLabel: group.destinationRegion === "Heathrow" ? "Heathrow Airport Terminal 3" : group.destinationRegion,
          travelDate: group.travelDate,
          departureTime: input.departureTime,
          capacity: input.capacity,
          farePence: input.farePence,
          notes: input.notes,
          customerVisible: input.customerVisible ?? true,
          nowIso: now,
        })
      : createCityMatchingJourney(db, {
          originCity: group.origin,
          destinationCity: group.destinationRegion,
          departureLocation: input.departureLocation,
          travelDate: group.travelDate,
          departureTime: input.departureTime,
          capacity: input.capacity,
          farePence: input.farePence,
          notes: input.notes,
          nowIso: now,
        });
  journey.interestGroupId = group.id;
  journey.customerVisible = input.customerVisible ?? group.journeyType === "AIRPORT";
  if (group.journeyType !== "AIRPORT" && input.hubId) {
    proposeSharedDropoff(db, journey.id, input.hubId, input.actor || "admin", now);
  }
  journey.status = "PROPOSED";
  group.status = "CONVERTED_TO_JOURNEY";
  group.convertedJourneyId = journey.id;
  group.proposedDepartureLocation = input.departureLocation;
  group.proposedDepartureTime = input.departureTime;
  group.proposedFarePence = journey.farePence;
  group.proposedAt = now;
  group.proposedBy = input.actor;
  group.updatedAt = now;
  for (const entry of activeInterestEntries(db, group.id)) {
    db.notifications.push({
      type: "JOURNEY_PROPOSED_FROM_INTEREST",
      email: entry.email,
      interestGroupId: group.id,
      journeyId: journey.id,
      entryId: entry.id,
    });
  }
  db.audit.push({ type: "INTEREST_CONVERTED", interestGroupId: group.id, journeyId: journey.id, at: now });
  return journey;
}

export function acceptProposedInterestJourney(
  db: InMemoryShareDb,
  entryId: string,
  uid?: string,
  nowIso?: string
): { booking: ShareBooking; manageToken: string } {
  const entry = db.interestEntries.get(entryId);
  if (!entry || entry.status !== "ACTIVE") throw new Error("Interest record not found.");
  requireShareAuth(uid);
  if (entry.uid && entry.uid !== uid) throw new Error("Interest record not found.");
  const group = db.interestGroups.get(entry.interestGroupId);
  if (!group?.convertedJourneyId || group.status !== "CONVERTED_TO_JOURNEY") {
    throw new Error("A proposed journey is not ready to accept yet.");
  }
  const journey = db.journeys.get(group.convertedJourneyId);
  if (!journey) throw new Error("Proposed journey not found.");
  const now = nowIso || new Date().toISOString();
  const result = addIncomingBooking(db, journey, {
    passengers: entry.passengers,
    name: entry.name,
    email: entry.email,
    mobile: entry.mobile,
    uid: entry.uid,
    intendedDestinationText: entry.intendedDestinationText,
    intendedDestinationPostcode: entry.intendedDestinationPostcode,
    sharedDropoffAcknowledged: Boolean(entry.sharedDropoffAcknowledgedAt),
    interestEntryId: entry.id,
    flexibility: entry.flexibility,
    flightNumber: entry.flightNumber,
    flightDepartureTime: entry.flightDepartureTime,
    departureTerminal: entry.departureTerminal,
    dropoffTerminal: entry.dropoffTerminal,
    nowIso: now,
  });
  entry.status = "CONVERTED";
  entry.convertedBookingId = result.booking.id;
  db.audit.push({ type: "INTEREST_CONVERTED", interestGroupId: group.id, bookingId: result.booking.id, at: now });
  return result;
}

export function withdrawInterest(db: InMemoryShareDb, entryId: string, uid?: string, nowIso?: string): ShareInterestEntry {
  const entry = db.interestEntries.get(entryId);
  if (!entry || entry.status !== "ACTIVE") throw new Error("Interest record not found.");
  requireShareAuth(uid);
  if (entry.uid && entry.uid !== uid) throw new Error("Interest record not found.");
  const group = db.interestGroups.get(entry.interestGroupId);
  if (group?.status === "CONVERTED_TO_JOURNEY") {
    throw new Error("Withdraw this as a proposed journey decline or reservation cancellation instead.");
  }
  entry.status = "WITHDRAWN";
  if (group) {
    recountInterestGroup(db, group);
    group.updatedAt = nowIso || new Date().toISOString();
  }
  return entry;
}

export function declineProposedInterestJourney(db: InMemoryShareDb, entryId: string, uid?: string, nowIso?: string): ShareInterestEntry {
  const entry = db.interestEntries.get(entryId);
  if (!entry || entry.status !== "ACTIVE") throw new Error("Interest record not found.");
  requireShareAuth(uid);
  if (entry.uid && entry.uid !== uid) throw new Error("Interest record not found.");
  entry.status = "DECLINED_PROPOSAL";
  const group = db.interestGroups.get(entry.interestGroupId);
  if (group) {
    group.updatedAt = nowIso || new Date().toISOString();
  }
  return entry;
}

export function mergeInterestGroups(db: InMemoryShareDb, sourceId: string, targetId: string, nowIso?: string): ShareInterestGroup {
  if (sourceId === targetId) throw new Error("Choose a different interest group to merge into.");
  const source = db.interestGroups.get(sourceId);
  const target = db.interestGroups.get(targetId);
  if (!source || !target) throw new Error("Interest group not found.");
  if (source.status === "CONVERTED_TO_JOURNEY" || target.status === "CONVERTED_TO_JOURNEY") {
    throw new Error("Converted interest groups cannot be merged.");
  }
  if (source.origin !== target.origin || source.destinationRegion !== target.destinationRegion || source.travelDate !== target.travelDate) {
    throw new Error("Only compatible interest groups can be merged.");
  }
  const now = nowIso || new Date().toISOString();
  for (const entry of [...db.interestEntries.values()].filter((row) => row.interestGroupId === source.id && row.status === "ACTIVE")) {
    entry.interestGroupId = target.id;
  }
  source.status = "CANCELLED";
  source.updatedAt = now;
  if (source.matchingUncertain) target.matchingUncertain = true;
  recountInterestGroup(db, target);
  target.updatedAt = now;
  db.audit.push({ type: "INTEREST_MERGED", sourceInterestGroupId: source.id, interestGroupId: target.id, at: now });
  return target;
}

export function closeInterestGroup(db: InMemoryShareDb, interestGroupId: string, nowIso?: string): ShareInterestGroup {
  const group = db.interestGroups.get(interestGroupId);
  if (!group) throw new Error("Interest group not found.");
  if (group.status === "CONVERTED_TO_JOURNEY") throw new Error("A converted interest group cannot be closed this way.");
  const now = nowIso || new Date().toISOString();
  group.status = "CANCELLED";
  group.updatedAt = now;
  for (const entry of activeInterestEntries(db, group.id)) {
    entry.status = "WITHDRAWN";
  }
  db.audit.push({ type: "INTEREST_CLOSED", interestGroupId: group.id, at: now });
  return group;
}

export function adminInterestGroupView(db: InMemoryShareDb, group: ShareInterestGroup) {
  const entries = [...db.interestEntries.values()].filter((row) => row.interestGroupId === group.id);
  return {
    ...group,
    destinationSpread: adminInterestDestinations(entries),
    entries: entries.map((row) => ({
      id: row.id,
      name: row.name,
      email: row.email,
      passengers: row.passengers,
      status: row.status,
      timeWindowStart: row.timeWindowStart,
      timeWindowEnd: row.timeWindowEnd,
      intendedDestinationText: row.intendedDestinationText || "",
    })),
  };
}

export function customerInterestViews(db: InMemoryShareDb, uid: string): CustomerInterestView[] {
  return [...db.interestEntries.values()]
    .filter((row) => row.uid === uid)
    .map((row) => {
      const group = db.interestGroups.get(row.interestGroupId);
      if (!group) return null;
      return {
        interestEntryId: row.id,
        publicNumber: group.publicNumber,
        origin: group.origin,
        destinationRegion: group.destinationRegion,
        travelDate: group.travelDate,
        timeLabel: timeLabelForWindow(group.timeWindowStart, group.timeWindowEnd),
        passengers: row.passengers,
        status: row.status,
        groupStatus: group.status,
        proposedDepartureLocation: group.proposedDepartureLocation,
        proposedDepartureTime: group.proposedDepartureTime,
        proposedFarePence: group.proposedFarePence,
        canAcceptProposal: row.status === "ACTIVE" && group.status === "CONVERTED_TO_JOURNEY",
        canDeclineProposal: row.status === "ACTIVE" && group.status === "CONVERTED_TO_JOURNEY",
        intendedDestinationText: row.intendedDestinationText,
        journeyType: group.journeyType,
        flexibility: row.flexibility,
        canUpdate: row.status === "ACTIVE" && group.status !== "CONVERTED_TO_JOURNEY",
        canWithdraw: row.status === "ACTIVE" && group.status !== "CONVERTED_TO_JOURNEY",
        flightNumber: row.flightNumber,
        flightDepartureTime: row.flightDepartureTime,
        departureTerminal: row.departureTerminal,
        ...publicInterestSafeFields(group),
        preferredDepartureTime: row.preferredDepartureTime,
        paymentNotOpened: group.status === "READY_FOR_REVIEW" || group.status === "CONVERTED_TO_JOURNEY",
      } as CustomerInterestView;
    })
    .filter((row): row is CustomerInterestView => Boolean(row));
}

export function customerWaitlistViews(db: InMemoryShareDb, uid: string, nowIso?: string): CustomerWaitlistView[] {
  const now = nowIso || new Date().toISOString();
  return [...db.waitlist.values()]
    .filter((row) => row.uid === uid)
    .map((row) => {
      const journey = db.journeys.get(row.journeyId);
      if (!journey) return null;
      const siblings = [...db.waitlist.values()].filter((item) => item.journeyId === row.journeyId);
      return {
        waitlistId: row.id,
        publicNumber: journey.publicNumber,
        travelDate: journey.travelDate,
        departureTime: journey.departureTime,
        originLabel: journey.originLabel || journey.originCity || "Oxford",
        destinationLabel: journey.destinationLabel || journey.destinationCity || "",
        passengers: row.passengers,
        status: row.status,
        waitlistPosition: derivedWaitlistPosition(siblings, row.id),
        offerExpiresAt: row.offerExpiresAt,
        canClaim: row.status === "OFFERED" && (!row.offerExpiresAt || !isPast(row.offerExpiresAt, now)),
        canDecline: row.status === "OFFERED",
      } as CustomerWaitlistView;
    })
    .filter((row): row is CustomerWaitlistView => Boolean(row));
}

export function adminWaitlistView(db: InMemoryShareDb, journeyId: string) {
  const entries = waitlistOrder([...db.waitlist.values()].filter((row) => row.journeyId === journeyId));
  return entries.map((row, index) => ({
    id: row.id,
    position: index + 1,
    name: row.name,
    email: row.email,
    passengers: row.passengers,
    status: row.status,
    joinedWaitlistAt: row.joinedWaitlistAt || row.createdAt,
    offeredAt: row.offeredAt,
    offerExpiresAt: row.offerExpiresAt,
    claimedAt: row.claimedAt,
    declinedAt: row.declinedAt,
  }));
}

export async function claimWaitlistPlace(
  db: InMemoryShareDb,
  waitlistId: string,
  uid?: string,
  nowIso?: string
): Promise<{ booking: ShareBooking; manageToken: string }> {
  return db.runExclusive(async () => {
    const entry = db.waitlist.get(waitlistId);
    if (!entry) throw new Error("Waitlist offer not found.");
    requireShareAuth(uid);
    if (entry.uid && entry.uid !== uid) throw new Error("Waitlist offer not found.");
    const now = nowIso || new Date().toISOString();
    if (entry.status !== "OFFERED") throw new Error("This offer is no longer valid.");
    if (entry.offerExpiresAt && isPast(entry.offerExpiresAt, now)) {
      entry.status = "EXPIRED";
      const journey = db.journeys.get(entry.journeyId);
      if (journey) journey.waitlistOfferOutstanding = false;
      void offerWaitlistIfPossible(db, entry.journeyId, now);
      throw new Error("This waitlist offer has expired.");
    }
    if (!entry.termsAcceptedAt) {
      throw new Error("You must read and agree to the Spires Share terms before claiming a place.");
    }
    const journey = db.journeys.get(entry.journeyId);
    if (!journey) throw new Error("Journey not found.");
    const result = addIncomingBooking(db, journey, {
      passengers: entry.passengers,
      name: entry.name,
      email: entry.email,
      mobile: entry.mobile,
      uid: entry.uid,
      luggage: entry.luggage,
      dropoffTerminal: entry.dropoffTerminal,
      flexibility: entry.flexibility,
      intendedDestinationText: entry.intendedDestinationText,
      intendedDestinationPostcode: entry.intendedDestinationPostcode,
      sharedDropoffAcknowledged: Boolean(entry.sharedDropoffAcknowledgedAt),
      waitlistId: entry.id,
      claimingWaitlist: true,
      nowIso: now,
    });
    entry.status = "ACCEPTED";
    entry.claimedAt = now;
    journey.waitlistOfferOutstanding = false;
    db.audit.push({ type: "WAITLIST_CLAIMED", journeyId: journey.id, waitlistId: entry.id, bookingId: result.booking.id, at: now });
    db.audit.push({ type: "WAITLIST_PROMOTED", journeyId: journey.id, waitlistId: entry.id, bookingId: result.booking.id, at: now });
    return result;
  });
}

export async function declineWaitlistOffer(
  db: InMemoryShareDb,
  waitlistId: string,
  uid?: string,
  nowIso?: string
): Promise<ShareWaitlistEntry> {
  return db.runExclusive(async () => {
    const entry = db.waitlist.get(waitlistId);
    if (!entry) throw new Error("Waitlist offer not found.");
    requireShareAuth(uid);
    if (entry.uid && entry.uid !== uid) throw new Error("Waitlist offer not found.");
    if (entry.status !== "OFFERED") throw new Error("This offer is no longer valid.");
    const now = nowIso || new Date().toISOString();
    entry.status = "DECLINED";
    entry.declinedAt = now;
    const journey = db.journeys.get(entry.journeyId);
    if (journey) journey.waitlistOfferOutstanding = false;
    db.audit.push({ type: "WAITLIST_DECLINED", journeyId: entry.journeyId, waitlistId: entry.id, at: now });
    void offerWaitlistIfPossible(db, entry.journeyId, now);
    return entry;
  });
}

export function claimWaitlistByToken(db: InMemoryShareDb, offerToken: string, uid?: string, nowIso?: string) {
  const hash = hashToken(offerToken);
  const entry = [...db.waitlist.values()].find((row) => row.offerTokenHash === hash);
  if (!entry) throw new Error("Waitlist offer not found.");
  return claimWaitlistPlace(db, entry.id, uid, nowIso);
}
