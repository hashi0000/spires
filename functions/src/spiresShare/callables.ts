import * as functions from "firebase-functions/v1";
import * as admin from "firebase-admin";
import { DEFAULT_SHARE_CONFIG, SPIRES_SHARE_PUBLIC_ENABLED } from "./defaults";
import {
  MockPaymentProvider,
  acceptedPassengerCount,
  airportById,
  canAddPassengers,
  canMovePassengers,
  earlyDepartureConfirmed,
  earlyDepartureEligible,
  earlyDepartureFarePence,
  evaluateHomeCollection,
  flightCompatible,
  luggageFits,
  matchJourneys,
  mockCaptureIfAuthorised,
  mockReleaseIfOpen,
  nextCompatibleWaitlistOffer,
  paymentSecuresSeat,
  remainingSeats,
  statusFromOccupancy,
  toPublicJourney,
} from "./logic";
import {
  AuditEventType,
  Flexibility,
  JourneyStatus,
  LuggageDeclaration,
  ShareBooking,
  ShareConfig,
  ShareJourney,
} from "./types";

const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];
const CONFIG_DOC = "spiresShareConfig/current";
const JOURNEYS = "spiresShareJourneys";
const BOOKINGS = "spiresShareBookings";
const WAITLIST = "spiresShareWaitlist";
const AUDIT = "spiresShareAudit";
const PAYMENTS = "spiresSharePayments";

function db() {
  return admin.firestore();
}

function assertAdmin(context: functions.https.CallableContext): string {
  if (!context.auth) {
    throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  }
  const email = (context.auth.token.email || "").toString().trim().toLowerCase();
  if (!ADMIN_EMAILS.includes(email)) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
  return email;
}

function publicBlocked(): never {
  throw new functions.https.HttpsError("not-found", "Spires Share is not available.");
}

function assertShareCallable(context: functions.https.CallableContext): string {
  return assertAdmin(context);
}

async function loadConfig(): Promise<ShareConfig> {
  const snap = await db().doc(CONFIG_DOC).get();
  if (!snap.exists) return { ...DEFAULT_SHARE_CONFIG, airports: [...DEFAULT_SHARE_CONFIG.airports] };
  return { ...DEFAULT_SHARE_CONFIG, ...(snap.data() as Partial<ShareConfig>) };
}

async function writeAudit(
  type: AuditEventType,
  actorEmail: string,
  refs: Record<string, string>
): Promise<void> {
  await db().collection(AUDIT).add({
    type,
    actorEmail,
    refs,
    at: admin.firestore.FieldValue.serverTimestamp(),
  });
}

function asJourney(id: string, data: FirebaseFirestore.DocumentData): ShareJourney {
  return { id, ...(data as Omit<ShareJourney, "id">) };
}

async function loadBookingsForJourney(
  tx: FirebaseFirestore.Transaction | null,
  journeyId: string
): Promise<ShareBooking[]> {
  const query = db().collection(BOOKINGS).where("journeyId", "==", journeyId);
  const snap = tx ? await tx.get(query) : await query.get();
  return snap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ShareBooking[];
}

async function applyMockPaymentStatus(paymentId: string | undefined, status: string): Promise<void> {
  if (!paymentId) return;
  await db().collection(PAYMENTS).doc(paymentId).set({ status }, { merge: true });
}

async function captureJourneyPayments(bookings: ShareBooking[]): Promise<void> {
  for (const booking of bookings) {
    const next = mockCaptureIfAuthorised(booking.paymentStatus);
    if (next === booking.paymentStatus) continue;
    await applyMockPaymentStatus(booking.paymentId, next);
    await db().collection(BOOKINGS).doc(booking.id).set({ paymentStatus: next }, { merge: true });
  }
}

async function releaseJourneyPayments(bookings: ShareBooking[]): Promise<void> {
  for (const booking of bookings) {
    const next = mockReleaseIfOpen(booking.paymentStatus);
    if (next === booking.paymentStatus) continue;
    await applyMockPaymentStatus(booking.paymentId, next);
    await db().collection(BOOKINGS).doc(booking.id).set({ paymentStatus: next }, { merge: true });
  }
}

export const spiresShareGetState = functions.https.onCall(async (_data, context) => {
  const email = assertShareCallable(context);
  const config = await loadConfig();
  const [journeysSnap, bookingsSnap, waitSnap, auditSnap] = await Promise.all([
    db().collection(JOURNEYS).orderBy("travelDate", "asc").limit(200).get(),
    db().collection(BOOKINGS).limit(500).get(),
    db().collection(WAITLIST).limit(200).get(),
    db().collection(AUDIT).orderBy("at", "desc").limit(100).get(),
  ]);
  const journeys = journeysSnap.docs.map((doc) => asJourney(doc.id, doc.data()));
  const bookings = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ShareBooking[];
  return {
    actorEmail: email,
    publicEnabled: false,
    envFlag: SPIRES_SHARE_PUBLIC_ENABLED,
    config,
    journeys,
    publicJourneys: journeys.map((row) => toPublicJourney(row, config)),
    bookings,
    waitlist: waitSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
    audit: auditSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
  };
});

export const spiresShareSaveConfig = functions.https.onCall(async (data, context) => {
  assertShareCallable(context);
  const incoming = (data?.config || {}) as Partial<ShareConfig>;
  const next: ShareConfig = {
    ...DEFAULT_SHARE_CONFIG,
    ...incoming,
    publicEnabled: false,
    requiresRegulatoryApproval: true,
  };
  if (!next.passengerCapacity || next.passengerCapacity < 1) {
    throw new functions.https.HttpsError("invalid-argument", "passengerCapacity is required.");
  }
  await db().doc(CONFIG_DOC).set(next, { merge: true });
  return { ok: true, config: next };
});

export const spiresShareSearch = functions.https.onCall(async (data, context) => {
  assertShareCallable(context);
  const config = await loadConfig();
  const airport = airportById(config, String(data?.airportId || ""));
  if (!airport) throw new functions.https.HttpsError("invalid-argument", "Unknown airport.");
  const request = {
    airportId: airport.id,
    travelDate: String(data?.travelDate || ""),
    preferredDepartureTime: String(data?.preferredDepartureTime || ""),
    flexibility: (data?.flexibility || "plus_minus_30") as Flexibility,
    flightDepartureTime: data?.flightDepartureTime ? String(data.flightDepartureTime) : undefined,
    passengers: Number(data?.passengers) || 0,
    luggage: {
      largeSuitcases: Number(data?.luggage?.largeSuitcases) || 0,
      cabinBags: Number(data?.luggage?.cabinBags) || 0,
      other: String(data?.luggage?.other || ""),
    } as LuggageDeclaration,
  };
  const journeysSnap = await db()
    .collection(JOURNEYS)
    .where("airportId", "==", airport.id)
    .where("travelDate", "==", request.travelDate)
    .get();
  const journeys = journeysSnap.docs.map((doc) => asJourney(doc.id, doc.data()));
  const bookingsSnap = await db().collection(BOOKINGS).get();
  const bookingsByJourney: Record<string, ShareBooking[]> = {};
  bookingsSnap.docs.forEach((doc) => {
    const row = { id: doc.id, ...doc.data() } as ShareBooking;
    bookingsByJourney[row.journeyId] = bookingsByJourney[row.journeyId] || [];
    bookingsByJourney[row.journeyId].push(row);
  });
  const matches = matchJourneys(request, journeys, config, bookingsByJourney);
  const home = evaluateHomeCollection(
    data?.homePostcode ? String(data.homePostcode) : "",
    0,
    config.maxHomeCollectionsPerJourney,
    config.homeCollectionSurchargePence
  );
  return {
    matches: matches.map((row) => toPublicJourney(row, config)),
    homeCollection: { eligibility: home.eligibility, message: home.message, surchargePence: home.surchargePence },
    warning: "Spires Share is a proposed service and is not publicly available.",
  };
});

export const spiresShareProposeOrJoin = functions.https.onCall(async (data, context) => {
  const actor = assertShareCallable(context);
  const config = await loadConfig();
  const action = String(data?.action || "propose");
  const airport = airportById(config, String(data?.airportId || ""));
  if (!airport) throw new functions.https.HttpsError("invalid-argument", "Unknown airport.");
  const passengers = Number(data?.passengers) || 0;
  if (passengers < 1) throw new functions.https.HttpsError("invalid-argument", "At least one passenger is required.");
  const luggage: LuggageDeclaration = {
    largeSuitcases: Number(data?.luggage?.largeSuitcases) || 0,
    cabinBags: Number(data?.luggage?.cabinBags) || 0,
    other: String(data?.luggage?.other || ""),
  };
  const paymentOk = data?.paymentSucceeds !== false;
  const provider = new MockPaymentProvider();
  const contact = {
    name: String(data?.name || ""),
    mobile: String(data?.mobile || ""),
    email: String(data?.email || ""),
    flightNumber: data?.flightNumber ? String(data.flightNumber) : "",
    flightDepartureTime: data?.flightDepartureTime ? String(data.flightDepartureTime) : "",
    flexibility: (data?.flexibility || "plus_minus_30") as Flexibility,
    homePostcode: String(data?.homePostcode || ""),
  };

  if (action !== "join") {
    const travelDate = String(data?.travelDate || "");
    const departureTime = String(data?.preferredDepartureTime || "");
    if (!travelDate || !departureTime) {
      throw new functions.https.HttpsError("invalid-argument", "Date and departure time are required.");
    }
    const existingSnap = await db()
      .collection(JOURNEYS)
      .where("airportId", "==", airport.id)
      .where("travelDate", "==", travelDate)
      .get();
    const existingJourneys = existingSnap.docs.map((doc) => asJourney(doc.id, doc.data()));
    const bookingsSnap = await db().collection(BOOKINGS).get();
    const bookingsByJourney: Record<string, ShareBooking[]> = {};
    bookingsSnap.docs.forEach((doc) => {
      const row = { id: doc.id, ...doc.data() } as ShareBooking;
      bookingsByJourney[row.journeyId] = bookingsByJourney[row.journeyId] || [];
      bookingsByJourney[row.journeyId].push(row);
    });
    const matches = matchJourneys(
      {
        airportId: airport.id,
        travelDate,
        preferredDepartureTime: departureTime,
        flexibility: contact.flexibility,
        flightDepartureTime: contact.flightDepartureTime || undefined,
        passengers,
        luggage,
      },
      existingJourneys,
      config,
      bookingsByJourney
    );
    if (matches.length && data?.forcePropose !== true) {
      return {
        ok: false,
        needsChoice: true,
        matches: matches.map((row) => toPublicJourney(row, config)),
        message: "There's already a Spires Share journey close to your requested time.",
      };
    }
    if (
      contact.flightDepartureTime &&
      !flightCompatible(
        departureTime,
        airport.estimatedDurationMinutes,
        contact.flightDepartureTime,
        airport.flightSafetyBufferMinutes
      )
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "This departure would not meet the configured flight safety buffer."
      );
    }
    if (
      !luggageFits(
        [],
        luggage,
        config.luggage.maxLargeSuitcasesPerVehicle,
        config.luggage.maxCabinBagsPerVehicle
      )
    ) {
      throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the vehicle allowance.");
    }
    const pay = provider.authorise(`pending_${Date.now()}`, airport.farePence * passengers, paymentOk);
    if (!paymentSecuresSeat(pay.status)) {
      throw new functions.https.HttpsError("failed-precondition", "Payment was not authorised. Seat not secured.");
    }
    const home = evaluateHomeCollection(
      contact.homePostcode,
      0,
      config.maxHomeCollectionsPerJourney,
      config.homeCollectionSurchargePence
    );
    const result = await db().runTransaction(async (tx) => {
      const journeyRef = db().collection(JOURNEYS).doc();
      const bookingRef = db().collection(BOOKINGS).doc();
      const paymentId = `pay_${bookingRef.id}`;
      const deadline = new Date(`${travelDate}T${departureTime}:00`);
      deadline.setHours(deadline.getHours() - config.confirmationDeadlineHoursBeforeDeparture);
      const publicNumber = `SS-${travelDate.replace(/-/g, "")}-${departureTime.replace(":", "")}`;
      tx.set(journeyRef, {
        publicNumber,
        airportId: airport.id,
        travelDate,
        departureTime,
        status: "PROPOSED",
        capacity: config.passengerCapacity,
        occupiedSeats: passengers,
        farePence: airport.farePence,
        targetRevenuePence: airport.targetRevenuePence,
        earlyDepartureOffered: false,
        earlyDepartureAcceptedBookingIds: [],
        homeCollectionCount: home.eligibility === "HOME_COLLECTION_UNAVAILABLE" ? 0 : 1,
        waitlistCount: 0,
        confirmationDeadlineAt: deadline.toISOString(),
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      });
      tx.set(bookingRef, {
        journeyId: journeyRef.id,
        passengers,
        ...contact,
        luggage,
        homeCollection: home.eligibility,
        homeCollectionSurchargePence: home.surchargePence,
        paymentId,
        paymentStatus: "AUTHORISED",
        boardStatus: "NOT_CHECKED_IN",
        earlyDepartureAccepted: false,
        createdAt: new Date().toISOString(),
      });
      tx.set(db().collection(PAYMENTS).doc(paymentId), {
        id: paymentId,
        bookingId: bookingRef.id,
        amountPence: airport.farePence * passengers,
        status: "AUTHORISED",
      });
      return { ok: true, journeyId: journeyRef.id, bookingId: bookingRef.id, publicNumber, occupiedSeats: passengers };
    });
    await writeAudit("JOURNEY_CREATED", actor, {
      journeyId: String(result.journeyId || ""),
      bookingId: String(result.bookingId || ""),
    });
    return result;
  }

  const result = await db().runTransaction(async (tx) => {
    const journeyRef = db().collection(JOURNEYS).doc(String(data?.journeyId || ""));
    const journeySnap = await tx.get(journeyRef);
    if (!journeySnap.exists) throw new functions.https.HttpsError("not-found", "Journey not found.");
    const journey = asJourney(journeySnap.id, journeySnap.data() || {});
    if (!canAddPassengers(journey.occupiedSeats, passengers, journey.capacity)) {
      throw new functions.https.HttpsError("failed-precondition", "No remaining seats.");
    }
    if (
      contact.flightDepartureTime &&
      !flightCompatible(
        journey.departureTime,
        airport.estimatedDurationMinutes,
        contact.flightDepartureTime,
        airport.flightSafetyBufferMinutes
      )
    ) {
      throw new functions.https.HttpsError(
        "failed-precondition",
        "This departure would not meet the configured flight safety buffer."
      );
    }
    const existingBookings = await loadBookingsForJourney(tx, journey.id);
    if (
      !luggageFits(
        existingBookings.map((row) => row.luggage),
        luggage,
        config.luggage.maxLargeSuitcasesPerVehicle,
        config.luggage.maxCabinBagsPerVehicle
      )
    ) {
      throw new functions.https.HttpsError("failed-precondition", "Luggage exceeds the vehicle allowance.");
    }
    const home = evaluateHomeCollection(
      contact.homePostcode,
      journey.homeCollectionCount || 0,
      config.maxHomeCollectionsPerJourney,
      config.homeCollectionSurchargePence
    );
    const bookingRef = db().collection(BOOKINGS).doc();
    const paymentId = `pay_${bookingRef.id}`;
    const pay = provider.authorise(paymentId, airport.farePence * passengers, paymentOk);
    if (!paymentSecuresSeat(pay.status)) {
      throw new functions.https.HttpsError("failed-precondition", "Payment was not authorised. Seat not secured.");
    }
    const occupied = journey.occupiedSeats + passengers;
    let status: JourneyStatus = statusFromOccupancy(occupied, journey.capacity, journey.status);
    if (occupied >= journey.capacity) status = "FULL";
    tx.update(journeyRef, {
      occupiedSeats: occupied,
      status,
      homeCollectionCount:
        home.eligibility === "HOME_COLLECTION_UNAVAILABLE"
          ? journey.homeCollectionCount || 0
          : (journey.homeCollectionCount || 0) + 1,
      updatedAt: new Date().toISOString(),
    });
    tx.set(bookingRef, {
      journeyId: journey.id,
      passengers,
      ...contact,
      luggage,
      homeCollection: home.eligibility,
      homeCollectionSurchargePence: home.surchargePence,
      paymentId,
      paymentStatus: pay.status,
      boardStatus: "NOT_CHECKED_IN",
      earlyDepartureAccepted: false,
      createdAt: new Date().toISOString(),
    });
    tx.set(db().collection(PAYMENTS).doc(paymentId), {
      id: paymentId,
      bookingId: bookingRef.id,
      amountPence: airport.farePence * passengers,
      status: pay.status,
    });
    return { ok: true, journeyId: journey.id, bookingId: bookingRef.id, occupiedSeats: occupied, status };
  });
  await writeAudit(result.status === "FULL" ? "JOURNEY_FULL" : "PASSENGER_JOINED", actor, {
    journeyId: String(result.journeyId || ""),
    bookingId: String(result.bookingId || ""),
  });
  if (result.status === "FULL") {
    const filled = await db().collection(BOOKINGS).where("journeyId", "==", String(result.journeyId)).get();
    await captureJourneyPayments(filled.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ShareBooking[]);
  }
  return result;
});

export const spiresShareAdminAction = functions.https.onCall(async (data, context) => {
  const actor = assertShareCallable(context);
  const config = await loadConfig();
  const action = String(data?.action || "");
  const journeyId = String(data?.journeyId || "");
  const journeyRef = db().collection(JOURNEYS).doc(journeyId);
  const snap = await journeyRef.get();
  if (!snap.exists) throw new functions.https.HttpsError("not-found", "Journey not found.");
  const journey = asJourney(snap.id, snap.data() || {});
  const bookingsSnap = await db().collection(BOOKINGS).where("journeyId", "==", journeyId).get();
  const bookings = bookingsSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as ShareBooking[];

  if (action === "cancel") {
    await db().runTransaction(async (tx) => {
      const current = await tx.get(journeyRef);
      if (!current.exists) return;
      if ((current.data()?.status as JourneyStatus) === "CANCELLED") return;
      tx.update(journeyRef, { status: "CANCELLED", updatedAt: new Date().toISOString() });
    });
    await releaseJourneyPayments(bookings);
    await writeAudit("JOURNEY_CANCELLED", actor, { journeyId });
    return { ok: true };
  }

  if (action === "confirm") {
    const occupied = bookings.reduce((sum, row) => sum + (row.passengers || 0), 0);
    if (occupied < journey.capacity && occupied !== config.earlyDepartureThreshold) {
      throw new functions.https.HttpsError("failed-precondition", "Journey is not eligible to confirm.");
    }
    if (occupied === config.earlyDepartureThreshold) {
      const accepted = acceptedPassengerCount(bookings);
      if (!earlyDepartureConfirmed(accepted, occupied)) {
        throw new functions.https.HttpsError("failed-precondition", "All travelling parties must accept early departure.");
      }
    }
    await db().runTransaction(async (tx) => {
      const current = await tx.get(journeyRef);
      if (!current.exists) throw new functions.https.HttpsError("not-found", "Journey not found.");
      const status = current.data()?.status as JourneyStatus;
      if (status === "CONFIRMED" || status === "FULL" || status === "COMPLETED") {
        throw new functions.https.HttpsError("failed-precondition", "Journey is already confirmed.");
      }
      if (status === "CANCELLED" || status === "EXPIRED") {
        throw new functions.https.HttpsError("failed-precondition", "Journey cannot be confirmed.");
      }
      tx.update(journeyRef, {
        status: occupied >= journey.capacity ? "FULL" : "CONFIRMED",
        updatedAt: new Date().toISOString(),
      });
    });
    await captureJourneyPayments(bookings);
    await writeAudit("JOURNEY_CONFIRMED", actor, { journeyId });
    return { ok: true };
  }

  if (action === "offer-early-departure") {
    if (!earlyDepartureEligible(journey.occupiedSeats, journey.capacity, config.earlyDepartureThreshold, journey.status === "CONFIRMED")) {
      throw new functions.https.HttpsError("failed-precondition", "Early departure is only available at 4/5 for launch.");
    }
    const fare = earlyDepartureFarePence(journey.targetRevenuePence, journey.occupiedSeats);
    await journeyRef.update({
      earlyDepartureOffered: true,
      status: "AWAITING_EARLY_DEPARTURE_DECISION",
      updatedAt: new Date().toISOString(),
    });
    await writeAudit("EARLY_DEPARTURE_OFFERED", actor, { journeyId });
    return { ok: true, proposedFarePence: fare, requiresAllToAccept: true };
  }

  if (action === "accept-early-departure") {
    const bookingId = String(data?.bookingId || "");
    const bookingRef = db().collection(BOOKINGS).doc(bookingId);
    const bookingSnap = await bookingRef.get();
    if (!bookingSnap.exists || bookingSnap.data()?.journeyId !== journeyId) {
      throw new functions.https.HttpsError("not-found", "Booking not found.");
    }
    await bookingRef.update({ earlyDepartureAccepted: true });
    const acceptedIds = Array.from(new Set([...(journey.earlyDepartureAcceptedBookingIds || []), bookingId]));
    await journeyRef.update({ earlyDepartureAcceptedBookingIds: acceptedIds });
    await writeAudit("EARLY_DEPARTURE_ACCEPTED", actor, { journeyId, bookingId });
    const accepted = acceptedPassengerCount(
      bookings.map((row) =>
        row.id === bookingId ? { ...row, earlyDepartureAccepted: true } : row
      )
    );
    return {
      ok: true,
      accepted,
      required: journey.occupiedSeats,
      confirmed: earlyDepartureConfirmed(accepted, journey.occupiedSeats),
      proposedFarePence: earlyDepartureFarePence(journey.targetRevenuePence, journey.occupiedSeats),
    };
  }

  if (action === "waitlist") {
    if (remainingSeats(journey.occupiedSeats, journey.capacity) > 0) {
      throw new functions.https.HttpsError("failed-precondition", "Seats are still available.");
    }
    await db().collection(WAITLIST).add({
      journeyId,
      status: "WAITLISTED",
      passengers: Number(data?.passengers) || 1,
      name: String(data?.name || ""),
      email: String(data?.email || ""),
      createdAt: new Date().toISOString(),
    });
    await journeyRef.update({ waitlistCount: (journey.waitlistCount || 0) + 1 });
    return { ok: true, status: "WAITLISTED" };
  }

  if (action === "offer-waitlist") {
    if (!config.waitlistEnabled) {
      throw new functions.https.HttpsError("failed-precondition", "Waitlist is disabled.");
    }
    const waitCol = db().collection(WAITLIST);
    await db().runTransaction(async (tx) => {
      const waitSnap = await tx.get(waitCol.where("journeyId", "==", journeyId));
      const entries = waitSnap.docs.map((doc) => ({ id: doc.id, ...doc.data() })) as Array<{
        id: string;
        status: string;
        passengers: number;
        createdAt: string;
      }>;
      const live = await tx.get(journeyRef);
      const occupied = Number(live.data()?.occupiedSeats || 0);
      const capacity = Number(live.data()?.capacity || journey.capacity);
      const next = nextCompatibleWaitlistOffer(entries, remainingSeats(occupied, capacity));
      if (!next) {
        throw new functions.https.HttpsError("failed-precondition", "No waitlist offer can be created.");
      }
      tx.set(waitCol.doc(next.id), { status: "OFFERED", offeredAt: new Date().toISOString() }, { merge: true });
    });
    return { ok: true, status: "OFFERED" };
  }

  if (action === "move-booking") {
    const bookingId = String(data?.bookingId || "");
    const targetJourneyId = String(data?.targetJourneyId || "");
    if (!bookingId || !targetJourneyId) {
      throw new functions.https.HttpsError("invalid-argument", "bookingId and targetJourneyId are required.");
    }
    if (targetJourneyId === journeyId) {
      throw new functions.https.HttpsError("invalid-argument", "Choose a different journey.");
    }
    await db().runTransaction(async (tx) => {
      const sourceRef = journeyRef;
      const targetRef = db().collection(JOURNEYS).doc(targetJourneyId);
      const bookingRef = db().collection(BOOKINGS).doc(bookingId);
      const [sourceSnap, targetSnap, bookingSnap] = await Promise.all([
        tx.get(sourceRef),
        tx.get(targetRef),
        tx.get(bookingRef),
      ]);
      if (!sourceSnap.exists || !targetSnap.exists || !bookingSnap.exists) {
        throw new functions.https.HttpsError("not-found", "Journey or booking not found.");
      }
      const source = asJourney(sourceSnap.id, sourceSnap.data() || {});
      const target = asJourney(targetSnap.id, targetSnap.data() || {});
      const booking = { id: bookingSnap.id, ...bookingSnap.data() } as ShareBooking;
      if (booking.journeyId !== source.id) {
        throw new functions.https.HttpsError("failed-precondition", "Booking is not on the source journey.");
      }
      if (source.airportId !== target.airportId || source.travelDate !== target.travelDate) {
        throw new functions.https.HttpsError("failed-precondition", "Journeys are not compatible.");
      }
      if (!canMovePassengers(source.occupiedSeats, target.occupiedSeats, booking.passengers, target.capacity)) {
        throw new functions.https.HttpsError("failed-precondition", "The destination journey does not have enough seats.");
      }
      const airport = airportById(config, target.airportId);
      if (
        airport &&
        booking.flightDepartureTime &&
        !flightCompatible(
          target.departureTime,
          airport.estimatedDurationMinutes,
          booking.flightDepartureTime,
          airport.flightSafetyBufferMinutes
        )
      ) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "The destination departure would violate this passenger's flight safety buffer."
        );
      }
      const targetOccupied = target.occupiedSeats + booking.passengers;
      const sourceOccupied = source.occupiedSeats - booking.passengers;
      tx.update(sourceRef, {
        occupiedSeats: sourceOccupied,
        status: statusFromOccupancy(
          sourceOccupied,
          source.capacity,
          source.status === "CONFIRMED" || source.status === "FULL" ? "FILLING" : source.status
        ),
        updatedAt: new Date().toISOString(),
      });
      tx.update(targetRef, {
        occupiedSeats: targetOccupied,
        status: targetOccupied >= target.capacity ? "FULL" : statusFromOccupancy(targetOccupied, target.capacity, target.status),
        updatedAt: new Date().toISOString(),
      });
      tx.update(bookingRef, { journeyId: target.id });
    });
    await writeAudit("PASSENGER_LEFT", actor, { journeyId, bookingId });
    await writeAudit("PASSENGER_JOINED", actor, { journeyId: targetJourneyId, bookingId });
    return { ok: true };
  }

  if (action === "driver") {
    const boardAction = String(data?.boardAction || "");
    const bookingId = String(data?.bookingId || "");
    if (bookingId) {
      const patch: Record<string, string> = {};
      if (boardAction === "CHECKED_IN") patch.boardStatus = "CHECKED_IN";
      if (boardAction === "BOARDED") patch.boardStatus = "BOARDED";
      if (boardAction === "NO_SHOW") patch.boardStatus = "NO_SHOW";
      if (patch.boardStatus) {
        await db().collection(BOOKINGS).doc(bookingId).update(patch);
        await writeAudit(
          boardAction === "NO_SHOW" ? "PASSENGER_NO_SHOW" : "PASSENGER_CHECKED_IN",
          actor,
          { journeyId, bookingId }
        );
      }
    }
    if (boardAction === "DEPARTED" || boardAction === "ARRIVED" || boardAction === "COMPLETED") {
      await journeyRef.update({
        status: boardAction === "COMPLETED" ? "COMPLETED" : journey.status,
        updatedAt: new Date().toISOString(),
        driverStage: boardAction,
      });
      if (boardAction === "COMPLETED") await writeAudit("JOURNEY_COMPLETED", actor, { journeyId });
      if (boardAction === "DEPARTED") await writeAudit("VEHICLE_DEPARTED", actor, { journeyId });
    }
    return { ok: true };
  }

  if (action === "change-time") {
    const nextTime = String(data?.departureTime || "");
    const airport = airportById(config, journey.airportId);
    if (!airport || !nextTime) throw new functions.https.HttpsError("invalid-argument", "Departure time required.");
    for (const booking of bookings) {
      if (
        booking.flightDepartureTime &&
        !flightCompatible(
          nextTime,
          airport.estimatedDurationMinutes,
          booking.flightDepartureTime,
          airport.flightSafetyBufferMinutes
        )
      ) {
        throw new functions.https.HttpsError(
          "failed-precondition",
          "New time would violate a passenger flight safety buffer."
        );
      }
    }
    await journeyRef.update({ departureTime: nextTime, updatedAt: new Date().toISOString() });
    return { ok: true };
  }

  throw new functions.https.HttpsError("invalid-argument", "Unknown admin action.");
});

export const spiresSharePublicAccess = functions.https.onCall(async () => {
  publicBlocked();
});

export async function runShareDeadlineTick(): Promise<{ expired: number; publicEnabled: boolean }> {
  const config = await loadConfig();
  const now = new Date();
  const open = await db()
    .collection(JOURNEYS)
    .where("status", "in", ["PROPOSED", "FILLING", "ALMOST_FULL", "AWAITING_EARLY_DEPARTURE_DECISION"])
    .get();
  let expired = 0;
  for (const doc of open.docs) {
    const journey = asJourney(doc.id, doc.data());
    const deadline = journey.confirmationDeadlineAt ? new Date(journey.confirmationDeadlineAt) : null;
    if (deadline && deadline.getTime() <= now.getTime() && journey.occupiedSeats < journey.capacity) {
      await doc.ref.update({ status: "EXPIRED", updatedAt: now.toISOString() });
      const expiredBookings = await db().collection(BOOKINGS).where("journeyId", "==", journey.id).get();
      await releaseJourneyPayments(
        expiredBookings.docs.map((row) => ({ id: row.id, ...row.data() })) as ShareBooking[]
      );
      await writeAudit("JOURNEY_EXPIRED", "system", { journeyId: journey.id });
      expired += 1;
    }
  }
  return { expired, publicEnabled: config.publicEnabled };
}

export const spiresShareRunTick = functions.https.onCall(async (_data, context) => {
  assertShareCallable(context);
  return runShareDeadlineTick();
});

export const scheduledSpiresShareTick = functions
  .pubsub.schedule("every 15 minutes")
  .timeZone("Europe/London")
  .onRun(async () => {
    await runShareDeadlineTick();
  });
