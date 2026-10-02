import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  acceptProposedInterestJourney,
  acceptSharedDropoff,
  addWaitlist,
  cancelReservation,
  claimWaitlistPlace,
  closeInterestGroup,
  confirmHostedIfEligible,
  createCityMatchingJourney,
  createDropoffHub,
  createPilotJourney,
  customerInterestViews,
  customerWaitlistViews,
  declineProposedInterestJourney,
  declineSharedDropoff,
  declineWaitlistOffer,
  expireOpenJourneys,
  expireUnpaidReservations,
  expressInterest,
  joinInterestGroup,
  listPublicInterestGroups,
  markReservationPaid,
  mergeInterestGroups,
  offerWaitlistIfPossible,
  openPaymentWindow,
  proposeJourneyFromInterest,
  proposeSharedDropoff,
  requireShareAuth,
  reservationStageForIncomingPassenger,
  reservePlace,
  savePaymentLink,
} from "./bookingFlow";
import { MockPaymentProvider } from "./paymentProvider";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { publicInterestHasPrivateData, toPublicInterestGroup } from "./interestGroups";
import { stripPrivateFields, toPublicJourney } from "./logic";

function contact(name: string, uid = `uid_${name}`) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    uid,
  };
}

function interestBase(name: string, extras: Record<string, unknown> = {}) {
  return {
    origin: "Oxford",
    destinationRegion: "London",
    travelDate: "2026-10-10",
    preferredDepartureTime: "10:00",
    flexibility: "plus_minus_30" as const,
    passengers: 1,
    intendedDestinationText: "South Kensington",
    intendedDestinationPostcode: "SW7 2AZ",
    sharedDropoffAcknowledged: true,
    termsAccepted: true,
    ...contact(name),
    ...extras,
  };
}

async function fillHeathrow(db: InMemoryShareDb, journeyId: string, count: number, prefix: string) {
  const provider = new MockPaymentProvider();
  for (let i = 0; i < count; i += 1) {
    await reservePlace(db, provider, {
      action: "join",
      airportId: "heathrow",
      travelDate: "2026-10-12",
      preferredDepartureTime: "14:00",
      journeyId,
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: { ...contact(`${prefix}${i}`), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
      idempotencyKey: `${prefix}-join-${i}xxxxxx`,
      termsAccepted: true,
    });
  }
}

describe("Spires Share interest groups and waitlist", () => {
  it("requires login to create interest", () => {
    assert.throws(() => requireShareAuth(undefined), /Sign in/);
    const db = new InMemoryShareDb();
    assert.throws(() => expressInterest(db, interestBase("A", { uid: undefined })), /Sign in/);
  });

  it("lets a customer create interest", () => {
    const db = new InMemoryShareDb();
    const result = expressInterest(db, interestBase("A"));
    assert.equal(result.joinedExisting, false);
    assert.equal(result.group.origin, "Oxford");
    assert.equal(result.group.destinationRegion, "London");
    assert.equal(result.group.interestedSeatCount, 1);
    assert.equal(result.group.status, "GATHERING_INTEREST");
    assert.equal(result.entry.intendedDestinationText, "South Kensington");
    assert.equal(result.entry.status, "ACTIVE");
  });

  it("joins a compatible customer into an existing group", () => {
    const db = new InMemoryShareDb();
    const first = expressInterest(db, interestBase("A"));
    const second = expressInterest(db, interestBase("B", { preferredDepartureTime: "10:15", intendedDestinationText: "Chelsea" }));
    assert.equal(second.joinedExisting, true);
    assert.equal(second.group.id, first.group.id);
    assert.equal(db.interestGroups.size, 1);
    assert.equal(second.group.interestedSeatCount, 2);
  });

  it("creates a separate group when the request is incompatible", () => {
    const db = new InMemoryShareDb();
    expressInterest(db, interestBase("A"));
    const heathrow = expressInterest(db, interestBase("B", { destinationRegion: "Heathrow", intendedDestinationText: undefined, sharedDropoffAcknowledged: false }));
    const later = expressInterest(db, interestBase("C", { preferredDepartureTime: "14:00", flexibility: "exact" }));
    assert.equal(db.interestGroups.size, 3);
    assert.equal(heathrow.joinedExisting, false);
    assert.equal(later.joinedExisting, false);
  });

  it("shows the public only an aggregate count", () => {
    const db = new InMemoryShareDb();
    expressInterest(db, interestBase("A"));
    expressInterest(db, interestBase("B", { intendedDestinationText: "Paddington" }));
    const publicRows = listPublicInterestGroups(db);
    assert.equal(publicRows.length, 1);
    assert.equal(publicRows[0].interestedSeatCount, 2);
    assert.equal(publicRows[0].origin, "Oxford");
    assert.equal(publicRows[0].destinationRegion, "London");
    assert.equal(publicInterestHasPrivateData(publicRows[0]), false);
    assert.ok(!JSON.stringify(publicRows[0]).includes("South Kensington"));
    assert.ok(!JSON.stringify(publicRows[0]).includes("@example.com"));
    assert.ok(!JSON.stringify(publicRows[0]).includes("07776"));
    assert.ok(!("interestGroupId" in publicRows[0]));
  });

  it("does not expose intended destinations on the public interest board", () => {
    const db = new InMemoryShareDb();
    const created = expressInterest(db, interestBase("A"));
    const pub = toPublicInterestGroup(created.group);
    const stripped = stripPrivateFields(pub as unknown as Record<string, unknown>);
    assert.equal(stripped.intendedDestinationText, undefined);
    assert.ok(!JSON.stringify(pub).toLowerCase().includes("kensington"));
    assert.ok(!JSON.stringify(pub).toLowerCase().includes("sw7"));
  });

  it("requires login to join an existing interest group", () => {
    const db = new InMemoryShareDb();
    const first = expressInterest(db, interestBase("A"));
    assert.throws(
      () => joinInterestGroup(db, first.group.publicNumber, interestBase("B", { uid: undefined })),
      /Sign in/
    );
  });

  it("flags unknown places for admin review instead of forcing a match", () => {
    const db = new InMemoryShareDb();
    const result = expressInterest(db, interestBase("A", { origin: "Witney" }));
    assert.equal(result.matchingUncertain, true);
    assert.equal(result.group.matchingUncertain, true);
    assert.equal(result.group.origin, "Witney");
  });

  it("does not charge when converting interest into a proposed journey", () => {
    const db = new InMemoryShareDb();
    const first = expressInterest(db, interestBase("A"));
    expressInterest(db, interestBase("B", { intendedDestinationText: "Chelsea" }));
    expressInterest(db, interestBase("C", { intendedDestinationText: "Paddington" }));
    expressInterest(db, interestBase("D", { intendedDestinationText: "Victoria" }));
    assert.equal(first.group.status, "READY_FOR_REVIEW");
    const hub = createDropoffHub(db, { name: "South Kensington", city: "London", enabled: true });
    const journey = proposeJourneyFromInterest(db, first.group.id, {
      departureLocation: "Thornhill Park & Ride",
      departureTime: "09:30",
      farePence: 3500,
      capacity: 5,
      hubId: hub.id,
      actor: "admin@spires.com",
    });
    assert.equal(journey.status, "PROPOSED");
    assert.equal(journey.occupiedSeats, 0);
    assert.equal(db.bookings.size, 0);
    assert.equal(db.interestGroups.get(first.group.id)?.status, "CONVERTED_TO_JOURNEY");
    assert.ok(db.notifications.some((row) => row.type === "JOURNEY_PROPOSED_FROM_INTEREST"));
  });

  it("requires a passenger to accept the proposed journey before they hold a seat", () => {
    const db = new InMemoryShareDb();
    const first = expressInterest(db, interestBase("A"));
    proposeJourneyFromInterest(db, first.group.id, {
      departureLocation: "Thornhill Park & Ride",
      departureTime: "09:30",
      farePence: 3500,
    });
    const declined = declineProposedInterestJourney(db, first.entry.id, first.entry.uid);
    assert.equal(declined.status, "DECLINED_PROPOSAL");
    assert.equal(db.bookings.size, 0);
    const second = expressInterest(db, interestBase("B", { intendedDestinationText: "Chelsea" }));
    const otherGroup = [...db.interestGroups.values()].find((row) => row.id !== first.group.id)!;
    proposeJourneyFromInterest(db, otherGroup.id, {
      departureLocation: "Thornhill Park & Ride",
      departureTime: "10:00",
    });
    const accepted = acceptProposedInterestJourney(db, second.entry.id, second.entry.uid);
    assert.equal(accepted.booking.reservationStatus, "PROVISIONAL");
    assert.equal(accepted.booking.hostedPaymentStatus, "UNPAID");
    assert.equal(db.journeys.get(accepted.booking.journeyId)?.occupiedSeats, 1);
  });

  it("lets admin merge compatible groups and close an interest group", () => {
    const db = new InMemoryShareDb();
    const morning = expressInterest(db, interestBase("A", { flexibility: "exact" }));
    const later = expressInterest(db, interestBase("B", { preferredDepartureTime: "10:05", flexibility: "exact", intendedDestinationText: "Chelsea" }));
    assert.equal(db.interestGroups.size, 2);
    mergeInterestGroups(db, later.group.id, morning.group.id);
    assert.equal(db.interestGroups.get(later.group.id)?.status, "CANCELLED");
    assert.equal(db.interestGroups.get(morning.group.id)?.interestedSeatCount, 2);
    closeInterestGroup(db, morning.group.id);
    assert.equal(db.interestGroups.get(morning.group.id)?.status, "CANCELLED");
  });

  it("offers a waitlist option when a journey is full", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Full");
    assert.equal(remaining(db, journey.id), 0);
    const entry = addWaitlist(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
    assert.equal(entry.status, "WAITING");
    assert.ok(entry.joinedWaitlistAt);
    assert.equal(db.journeys.get(journey.id)?.waitlistCount, 1);
  });

  it("keeps FIFO waitlist order from joinedWaitlistAt", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Fifo");
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T10:00:00.000Z" });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T10:05:00.000Z" });
    db.journeys.get(journey.id)!.occupiedSeats = 4;
    const offered = await offerWaitlistIfPossible(db, journey.id, "2026-10-01T11:00:00.000Z");
    assert.equal(offered?.email, "first@example.com");
    const views = customerWaitlistViews(db, "uid_First");
    assert.equal(views[0].waitlistPosition, 1);
    const later = customerWaitlistViews(db, "uid_Second");
    assert.equal(later[0].waitlistPosition, 2);
    assert.equal(toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG).remainingSeats, 0);
  });

  it("offers a vacant seat to the first waiting passenger", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Vac");
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
    const booking = [...db.bookings.values()][0];
    cancelReservation(db, booking.id, "2026-10-01T12:00:00.000Z");
    const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
    assert.equal(offered?.email, "first@example.com");
    assert.equal(db.journeys.get(journey.id)?.waitlistOfferOutstanding, true);
    assert.equal(toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG).remainingSeats, 0);
  });

  it("advances to the next person when a waitlist offer expires", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Exp");
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
    db.journeys.get(journey.id)!.occupiedSeats = 4;
    const first = await offerWaitlistIfPossible(db, journey.id, "2026-10-01T10:00:00.000Z");
    assert.ok(first?.offerExpiresAt);
    const tick = await expireOpenJourneys(db, new MockPaymentProvider(), first.offerExpiresAt);
    assert.ok(tick.waitlistExpired >= 1);
    const next = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
    assert.equal(next?.email, "second@example.com");
    assert.equal(db.waitlist.get(first.id)?.status, "EXPIRED");
  });

  it("advances to the next person when a waitlist offer is declined", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Dec");
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
    db.journeys.get(journey.id)!.occupiedSeats = 4;
    const first = await offerWaitlistIfPossible(db, journey.id, "2026-10-01T10:00:00.000Z");
    await declineWaitlistOffer(db, first!.id, "uid_First", "2026-10-01T10:10:00.000Z");
    const next = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
    assert.equal(next?.email, "second@example.com");
    assert.equal(db.waitlist.get(first!.id)?.status, "DECLINED");
  });

  it("does not let two waitlist customers claim the same seat", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Race");
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true });
    cancelReservation(db, [...db.bookings.values()][0].id);
    const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
    const results = await Promise.allSettled([
      claimWaitlistPlace(db, offered!.id, "uid_First"),
      claimWaitlistPlace(db, offered!.id, "uid_First"),
    ]);
    const fulfilled = results.filter((row) => row.status === "fulfilled");
    const rejected = results.filter((row) => row.status === "rejected");
    assert.equal(fulfilled.length, 1);
    assert.equal(rejected.length, 1);
    assert.equal(db.journeys.get(journey.id)?.occupiedSeats, 5);
    assert.equal([...db.bookings.values()].filter((row) => row.waitlistId === offered!.id).length, 1);
  });

  it("offers the waitlist when a payment deadline expires", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Pay");
    addWaitlist(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
    savePaymentLink(db, journey.id, "https://pay.example.test/hosted");
    openPaymentWindow(db, journey.id, "2026-10-10T08:00:00.000Z", 2);
    const pending = [...db.bookings.values()][0];
    pending.paymentDeadlineAt = "2026-10-10T09:00:00.000Z";
    expireUnpaidReservations(db, "2026-10-10T09:01:00.000Z");
    assert.equal(pending.reservationStatus, "PAYMENT_EXPIRED");
    assert.equal([...db.waitlist.values()].some((row) => row.status === "OFFERED"), true);
  });

  it("offers the waitlist when a passenger declines the shared drop off", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
    });
    const hub = createDropoffHub(db, { name: "South Kensington", city: "London", enabled: true });
    const provider = new MockPaymentProvider();
    for (let i = 0; i < 5; i += 1) {
      await reservePlace(db, provider, {
        action: "join",
        airportId: journey.airportId,
        travelDate: journey.travelDate,
        preferredDepartureTime: journey.departureTime,
        journeyId: journey.id,
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: { ...contact(`City${i}`), flexibility: "exact" },
        idempotencyKey: `city-drop-${i}xxxxx`,
        termsAccepted: true,
        intendedDestinationText: "Chelsea",
        sharedDropoffAcknowledged: true,
      });
    }
    addWaitlist(db, journey.id, {
      ...contact("Wait"),
      passengers: 1,
      termsAccepted: true,
      intendedDestinationText: "Chelsea",
      intendedDestinationPostcode: "SW3",
      sharedDropoffAcknowledged: true,
    });
    proposeSharedDropoff(db, journey.id, hub.id, "admin");
    const booking = [...db.bookings.values()][0];
    declineSharedDropoff(db, booking.id);
    assert.equal([...db.waitlist.values()].some((row) => row.status === "OFFERED"), true);
  });

  it("offers the waitlist after an eligible cancellation", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Can");
    addWaitlist(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
    const booking = [...db.bookings.values()][0];
    const result = cancelReservation(db, booking.id, "2026-10-01T12:00:00.000Z");
    assert.equal(result.released, true);
    assert.equal([...db.waitlist.values()].some((row) => row.status === "OFFERED"), true);
  });

  it("keeps a confirmed journey confirmed when a replacement seat opens", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Cnf");
    savePaymentLink(db, journey.id, "https://pay.example.test/hosted");
    openPaymentWindow(db, journey.id, "2026-10-10T08:00:00.000Z", 2);
    for (const booking of db.bookings.values()) {
      markReservationPaid(db, booking.id, "admin", "2026-10-10T08:10:00.000Z");
    }
    confirmHostedIfEligible(db, journey.id, "2026-10-10T08:20:00.000Z");
    assert.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
    addWaitlist(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
    const paid = [...db.bookings.values()][0];
    const result = cancelReservation(db, paid.id, "2026-10-11T08:00:00.000Z");
    assert.equal(result.journeyStillConfirmed, true);
    assert.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
    const claimed = await claimWaitlistPlace(db, [...db.waitlist.values()].find((row) => row.status === "OFFERED")!.id, "uid_Wait");
    assert.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
    assert.equal(claimed.booking.reservationStatus, "PAYMENT_PENDING");
  });

  it("does not let waitlist promotion bypass payment", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await fillHeathrow(db, journey.id, 5, "Payb");
    savePaymentLink(db, journey.id, "https://pay.example.test/hosted");
    openPaymentWindow(db, journey.id, "2026-10-10T08:00:00.000Z", 2);
    addWaitlist(db, journey.id, { ...contact("Wait"), passengers: 1, termsAccepted: true });
    const booking = [...db.bookings.values()][0];
    booking.paymentDeadlineAt = "2026-10-10T08:30:00.000Z";
    expireUnpaidReservations(db, "2026-10-10T08:31:00.000Z");
    const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED")!;
    const claimed = await claimWaitlistPlace(db, offered.id, "uid_Wait", "2026-10-10T08:32:00.000Z");
    assert.equal(claimed.booking.reservationStatus, "PAYMENT_PENDING");
    assert.equal(claimed.booking.hostedPaymentStatus, "PAYMENT_PENDING");
    assert.ok(claimed.booking.paymentDeadlineAt);
    assert.notEqual(claimed.booking.reservationStatus, "PAID");
  });

  it("does not let waitlist promotion bypass drop off acceptance", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
    });
    const hub = createDropoffHub(db, { name: "South Kensington", city: "London", enabled: true });
    const provider = new MockPaymentProvider();
    await reservePlace(db, provider, {
      action: "join",
      airportId: journey.airportId,
      travelDate: journey.travelDate,
      preferredDepartureTime: journey.departureTime,
      journeyId: journey.id,
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: { ...contact("CityA"), flexibility: "exact" },
      idempotencyKey: "city-wl-a-xxxxxx",
      termsAccepted: true,
      intendedDestinationText: "Chelsea",
      sharedDropoffAcknowledged: true,
    });
    proposeSharedDropoff(db, journey.id, hub.id, "admin");
    assert.equal(reservationStageForIncomingPassenger(db.journeys.get(journey.id)!, db.config, new Date().toISOString()).reservationStatus, "PROVISIONAL");
    db.journeys.get(journey.id)!.occupiedSeats = journey.capacity;
    addWaitlist(db, journey.id, {
      ...contact("Wait"),
      passengers: 1,
      termsAccepted: true,
      intendedDestinationText: "Chelsea",
      sharedDropoffAcknowledged: true,
    });
    db.journeys.get(journey.id)!.occupiedSeats = 0;
    db.journeys.get(journey.id)!.waitlistOfferOutstanding = false;
    const offered = await offerWaitlistIfPossible(db, journey.id);
    const claimed = await claimWaitlistPlace(db, offered!.id, "uid_Wait");
    assert.equal(claimed.booking.reservationStatus, "PROVISIONAL");
    assert.equal(claimed.booking.hostedPaymentStatus, "UNPAID");
    assert.equal(claimed.booking.sharedDropoffAcceptedAt, undefined);
    acceptSharedDropoff(db, claimed.booking.id);
    assert.ok(db.bookings.get(claimed.booking.id)?.sharedDropoffAcceptedAt);
  });

  it("keeps the existing Heathrow flow operational", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    const first = await reservePlace(db, new MockPaymentProvider(), {
      action: "join",
      airportId: "heathrow",
      travelDate: "2026-10-12",
      preferredDepartureTime: "14:00",
      journeyId: journey.id,
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: { ...contact("Heath"), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
      idempotencyKey: "heath-keep-01xx",
      termsAccepted: true,
    });
    assert.equal(first.ok, true);
    assert.equal(first.status, "GATHERING_INTEREST");
    const pub = toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG);
    assert.equal(pub.destinationLabel.includes("Heathrow"), true);
    assert.equal(pub.remainingSeats, 4);
  });

  it("does not show other waitlist identities to a customer", () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    db.journeys.get(journey.id)!.occupiedSeats = 5;
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true });
    const mine = customerWaitlistViews(db, "uid_First");
    assert.equal(mine.length, 1);
    assert.ok(!JSON.stringify(mine).includes("Second"));
    assert.ok(!JSON.stringify(mine).includes("second@example.com"));
  });

  it("shows a customer only their own interest, including a private intended destination", () => {
    const db = new InMemoryShareDb();
    expressInterest(db, interestBase("A"));
    expressInterest(db, interestBase("B", { intendedDestinationText: "Chelsea" }));
    const mine = customerInterestViews(db, "uid_A");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].intendedDestinationText, "South Kensington");
    assert.ok(!JSON.stringify(mine).includes("Chelsea"));
    assert.ok(!JSON.stringify(listPublicInterestGroups(db)).includes("South Kensington"));
  });
});

function remaining(db: InMemoryShareDb, journeyId: string): number {
  const journey = db.journeys.get(journeyId)!;
  return Math.max(0, journey.capacity - journey.occupiedSeats);
}
