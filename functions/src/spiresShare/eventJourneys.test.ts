import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  acceptProposedInterestJourney,
  addWaitlist,
  cancelReservation,
  confirmHostedIfEligible,
  createEventInterest,
  createPilotJourney,
  eventAdvertForGroup,
  eventRevenueForInput,
  expireInsufficientInterest,
  expressInterest,
  listPublicInterestGroups,
  markReservationPaid,
  offerWaitlistIfPossible,
  openPaymentWindow,
  proposeJourneyFromInterest,
  publishEventInterest,
  reservePlace,
  savePaymentLink,
  unpublishEventInterest,
  verifyPassengerBoarding,
} from "./bookingFlow";
import { driverManifestLines, issueBoardingCodes } from "./boarding";
import { confirmationGuard } from "./shareProgress";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import {
  applyVenueDefaults,
  EVENT_PASSENGER_CAP,
  eventPublicView,
  fareFromLondonArea,
  publicEventHasPii,
} from "./eventJourneys";
import { publicInterestHasPrivateData, toPublicInterestGroup } from "./interestGroups";
import { buildNotification } from "./notifications";
import { buildNeedsAction } from "./operatorConsole";
import { MockPaymentProvider } from "./paymentProvider";
import { toPublicJourney } from "./logic";

function person(name: string, extras: Record<string, unknown> = {}) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    uid: `uid_${name}`,
    termsAccepted: true,
    ...extras,
  };
}

function wembleyInput(overrides: Record<string, unknown> = {}) {
  return {
    eventName: "England match",
    venueName: "Wembley Stadium",
    venueId: "wembley",
    eventDate: "2026-11-12",
    eventStartTime: "19:45",
    origin: "Oxford",
    pickupLocation: "Thornhill Park and Ride",
    destination: "Wembley Stadium",
    suggestedDepartureTime: "16:30",
    outboundFarePence: 4000,
    returnFarePence: 7500,
    offerReturn: true,
    returnDepartureBasis: "AFTER_EVENT" as const,
    returnAfterMinutes: 45,
    passengerLimit: 5,
    interestDeadlineAt: "2026-11-11T12:00:00.000Z",
    venueReturnMeetingPoint: "Wembley Stadium area",
    ...overrides,
  };
}

function register(db: InMemoryShareDb, name: string, extras: Record<string, unknown> = {}) {
  const group = [...db.interestGroups.values()].find((row) => row.journeyType === "EVENT");
  assert.ok(group);
  return expressInterest(db, {
    origin: group.origin,
    destinationRegion: group.destinationRegion,
    travelDate: group.travelDate,
    preferredDepartureTime: group.preferredDepartureTime || "16:30",
    passengers: 1,
    publicNumber: group.publicNumber,
    eventSlug: group.eventSlug,
    ...person(name, extras),
  });
}

describe("Event Share journeys", () => {
  it("lets admin create, unpublish and publish an event opportunity", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput());
    assert.equal(created.journeyType, "EVENT");
    assert.equal(created.eventPublished, false);
    assert.equal(created.minPassengerThreshold, EVENT_PASSENGER_CAP);
    unpublishEventInterest(db, created.id);
    assert.equal(db.interestGroups.get(created.id)?.eventPublished, false);
    publishEventInterest(db, created.id);
    assert.equal(db.interestGroups.get(created.id)?.eventPublished, true);
    assert.equal(db.interestGroups.get(created.id)?.eventStatus, "PUBLISHED");
  });

  it("lists an event on the Share page only when published", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput());
    assert.equal(listPublicInterestGroups(db).some((row) => row.eventSlug === created.eventSlug), false);
    publishEventInterest(db, created.id);
    const listed = listPublicInterestGroups(db).filter((row) => row.journeyType === "EVENT");
    assert.equal(listed.length, 1);
    assert.equal(listed[0].eventName, "England match");
    assert.equal(listed[0].interestedSeatCount, 0);
  });

  it("defaults to a maximum of 5 passengers and keeps Heathrow fare independent", () => {
    const db = new InMemoryShareDb();
    const event = createEventInterest(db, wembleyInput({ outboundFarePence: undefined, venueId: "wembley" }));
    const heathrow = createPilotJourney(db, { travelDate: "2026-11-12", departureTime: "14:00" });
    assert.equal(event.minPassengerThreshold, 5);
    assert.equal(event.outboundFarePence, 4000);
    assert.equal(heathrow.farePence, 3500);
    assert.notEqual(event.outboundFarePence, heathrow.farePence);
  });

  it("can populate fare from a London area and allow an admin override", () => {
    const db = new InMemoryShareDb();
    const areaFare = fareFromLondonArea(db.config.londonShareAreas, "london_west");
    assert.equal(areaFare, 3500);
    const populated = applyVenueDefaults({ eventName: "Gig", venueName: "The O2", venueId: "o2", eventDate: "2026-10-24", eventStartTime: "19:00" }, db.config);
    assert.equal(populated.outboundFarePence, 5000);
    const overridden = createEventInterest(db, wembleyInput({ outboundFarePence: 4200 }));
    assert.equal(overridden.outboundFarePence, 4200);
  });

  it("lets a customer register interest without creating a booking or requesting payment", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true }));
    publishEventInterest(db, created.id);
    const result = register(db, "Sarah");
    assert.equal(result.group.status, "GATHERING_INTEREST");
    assert.equal(result.entry.status, "ACTIVE");
    assert.equal(db.bookings.size, 0);
    assert.equal(db.notifications.some((row) => row.type === "PAYMENT_REQUIRED"), false);
    assert.equal(result.group.interestedSeatCount, 1);
  });

  it("keeps a real interest count and hides customer PII on the public event view", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true }));
    publishEventInterest(db, created.id);
    register(db, "Sarah");
    register(db, "James");
    const publicView = toPublicInterestGroup(db.interestGroups.get(created.id)!);
    assert.equal(publicView.interestedSeatCount, 2);
    assert.equal(publicEventHasPii(publicView), false);
    assert.equal(publicInterestHasPrivateData(publicView), false);
    const json = JSON.stringify(eventPublicView(db.interestGroups.get(created.id)!));
    assert.equal(json.includes("sarah@example.com"), false);
    assert.equal(json.includes("07776897772"), false);
  });

  it("creates Needs Action when the 5 passenger threshold is reached", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true }));
    publishEventInterest(db, created.id);
    for (const name of ["A", "B", "C", "D", "E"]) register(db, name);
    const group = db.interestGroups.get(created.id)!;
    assert.equal(group.status, "READY_FOR_REVIEW");
    assert.equal(group.interestedSeatCount, 5);
    const needs = buildNeedsAction({ journeys: [], bookings: [], interestGroups: [group] });
    assert.ok(needs.some((row) => row.kind === "ready_to_propose"));
  });

  it("stores one way and return demand separately and uses the return package fare", async () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true }));
    publishEventInterest(db, created.id);
    register(db, "Out", { tripType: "ONE_WAY" });
    register(db, "Back", { tripType: "RETURN" });
    register(db, "C", { tripType: "ONE_WAY" });
    register(db, "D", { tripType: "RETURN" });
    register(db, "E", { tripType: "ONE_WAY" });
    const group = db.interestGroups.get(created.id)!;
    assert.equal(group.interestedSeatCount, 5);
    assert.equal(group.returnSeatCount, 2);
    const journey = proposeJourneyFromInterest(db, created.id, {
      departureLocation: "Thornhill Park and Ride",
      departureTime: "16:30",
      farePence: 4000,
      capacity: 5,
    });
    assert.equal(journey.journeyType, "EVENT");
    assert.equal(journey.farePence, 4000);
    assert.equal(journey.fourPassengerFallbackEnabled, false);
    for (const entry of db.interestEntries.values()) {
      acceptProposedInterestJourney(db, entry.id, entry.uid);
    }
    savePaymentLink(db, journey.id, "https://pay.spires-taxis.com/share-wembley");
    openPaymentWindow(db, journey.id, "2026-11-10T10:00:00.000Z");
    const returnBooking = [...db.bookings.values()].find((row) => row.tripType === "RETURN");
    const oneWay = [...db.bookings.values()].find((row) => row.tripType !== "RETURN");
    assert.ok(returnBooking);
    assert.ok(oneWay);
    const payment = db.payments.get(returnBooking.paymentId || "");
    assert.equal(payment?.amountPence, 7500);
    const oneWayPay = db.payments.get(oneWay.paymentId || "");
    assert.equal(oneWayPay?.amountPence, 4000);
  });

  it("runs the existing acceptance, payment and confirmation guard for events", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true, offerReturn: false, returnFarePence: undefined }));
    publishEventInterest(db, created.id);
    for (const name of ["A", "B", "C", "D", "E"]) register(db, name);
    const journey = proposeJourneyFromInterest(db, created.id, {
      departureLocation: "Thornhill Park and Ride",
      departureTime: "16:30",
      farePence: 4000,
      capacity: 5,
    });
    for (const entry of db.interestEntries.values()) acceptProposedInterestJourney(db, entry.id, entry.uid);
    savePaymentLink(db, journey.id, "https://pay.spires-taxis.com/share-event");
    openPaymentWindow(db, journey.id, "2026-11-10T10:00:00.000Z");
    const bookings = [...db.bookings.values()];
    assert.equal(confirmationGuard(bookings, db.journeys.get(journey.id)!, db.config).ok, false);
    for (const booking of bookings) markReservationPaid(db, booking.id, "admin");
    const live = db.journeys.get(journey.id)!;
    assert.equal(live.status, "CONFIRMED");
    assert.ok(bookings.every((row) => row.boardingCode));
  });

  it("keeps return boarding separate from outbound and lists both legs on the driver manifest", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true }));
    publishEventInterest(db, created.id);
    register(db, "Out", { tripType: "ONE_WAY" });
    for (const name of ["R1", "R2", "R3", "R4"]) register(db, name, { tripType: "RETURN" });
    const journey = proposeJourneyFromInterest(db, created.id, {
      departureLocation: "Thornhill Park and Ride",
      departureTime: "16:30",
      farePence: 4000,
      capacity: 5,
    });
    for (const entry of db.interestEntries.values()) acceptProposedInterestJourney(db, entry.id, entry.uid);
    savePaymentLink(db, journey.id, "https://pay.spires-taxis.com/share-event");
    openPaymentWindow(db, journey.id, "2026-11-10T10:00:00.000Z");
    for (const booking of db.bookings.values()) markReservationPaid(db, booking.id, "admin");
    const live = db.journeys.get(journey.id)!;
    const bookings = [...db.bookings.values()];
    issueBoardingCodes(live, bookings, "2026-11-12T15:00:00.000Z");
    const outbound = bookings.find((row) => row.tripType !== "RETURN")!;
    const returning = bookings.find((row) => row.tripType === "RETURN")!;
    verifyPassengerBoarding(db, outbound.id, outbound.boardingCode || "", "driver", "2026-11-12T16:20:00.000Z", "OUTBOUND");
    assert.equal(db.bookings.get(outbound.id)?.boardStatus, "BOARDED");
    assert.notEqual(db.bookings.get(returning.id)?.returnBoardStatus, "BOARDED");
    verifyPassengerBoarding(db, returning.id, returning.boardingCode || "", "driver", "2026-11-12T22:00:00.000Z", "RETURN");
    assert.equal(db.bookings.get(returning.id)?.returnBoardStatus, "BOARDED");
    assert.notEqual(db.bookings.get(returning.id)?.boardStatus, "BOARDED");
    const manifest = driverManifestLines(bookings, live);
    assert.match(manifest, /OUTBOUND/);
    assert.match(manifest, /RETURN/);
    assert.match(manifest, /England match/);
    assert.match(manifest, /Wembley Stadium/);
  });

  it("respects the 5 passenger cap on the waitlist and drops cancelled passengers from the current manifest", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true, offerReturn: false, returnFarePence: undefined }));
    publishEventInterest(db, created.id);
    for (const name of ["A", "B", "C", "D", "E"]) register(db, name);
    assert.throws(() => register(db, "Late"));
    const journey = proposeJourneyFromInterest(db, created.id, {
      departureLocation: "Thornhill Park and Ride",
      departureTime: "16:30",
      farePence: 4000,
      capacity: 5,
    });
    for (const entry of db.interestEntries.values()) acceptProposedInterestJourney(db, entry.id, entry.uid);
    savePaymentLink(db, journey.id, "https://pay.spires-taxis.com/share-event");
    openPaymentWindow(db, journey.id, "2026-11-10T10:00:00.000Z");
    for (const booking of db.bookings.values()) markReservationPaid(db, booking.id, "admin");
    addWaitlist(db, journey.id, { ...person("Wait"), passengers: 1, termsAccepted: true });
    const dropped = [...db.bookings.values()][0];
    cancelReservation(db, dropped.id, "2026-11-11T10:00:00.000Z");
    const after = driverManifestLines([...db.bookings.values()], db.journeys.get(journey.id)!);
    assert.equal(after.includes(dropped.name), false);
    offerWaitlistIfPossible(db, journey.id);
    const live = db.journeys.get(journey.id)!;
    assert.equal(live.status, "CONFIRMED");
  });

  it("expires unpublished demand and includes event details in customer emails", () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true, interestDeadlineAt: "2026-11-01T12:00:00.000Z" }));
    publishEventInterest(db, created.id);
    register(db, "Solo");
    const expired = expireInsufficientInterest(db, "2026-11-02T12:00:00.000Z");
    assert.equal(expired, 1);
    assert.equal(db.interestGroups.get(created.id)?.eventStatus, "DID_NOT_FILL");
    const mail = buildNotification("INTEREST_RECEIVED", "solo@example.com", null, {
      eventName: "England match",
      venueName: "Wembley Stadium",
      eventDate: "2026-11-12",
      origin: "Oxford",
      destination: "Wembley Stadium",
    });
    assert.match(mail.text, /England match/);
    assert.match(mail.text, /Wembley Stadium/);
    const advert = eventAdvertForGroup(db, created.id);
    assert.match(advert, /Maximum 5 passengers/);
    const revenue = eventRevenueForInput(wembleyInput());
    assert.equal(revenue.outboundPence, 20000);
    assert.equal(revenue.returnPackagePence, 37500);
  });

  it("does not mix an unpublished event with organic London interest and keeps airport Share working", async () => {
    const db = new InMemoryShareDb();
    const created = createEventInterest(db, wembleyInput({ publish: true }));
    publishEventInterest(db, created.id);
    expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "Wembley Stadium",
      travelDate: "2026-11-12",
      preferredDepartureTime: "16:30",
      passengers: 1,
      ...person("Organic"),
    });
    const groups = [...db.interestGroups.values()];
    assert.equal(groups.length, 2);
    assert.equal(groups.filter((row) => row.eventPublished === true).length, 1);
    const provider = new MockPaymentProvider();
    const heathrow = createPilotJourney(db, { travelDate: "2026-10-13", departureTime: "14:00", customerVisible: true });
    await reservePlace(db, provider, {
      action: "join",
      airportId: "heathrow",
      travelDate: "2026-10-13",
      preferredDepartureTime: "14:00",
      journeyId: heathrow.id,
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: { ...person("Air"), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
      idempotencyKey: "heathrow-event-reg1",
      termsAccepted: true,
    });
    assert.equal(db.journeys.get(heathrow.id)?.occupiedSeats, 1);
    assert.equal(toPublicJourney(heathrow, DEFAULT_SHARE_CONFIG).farePence, 3500);
  });
});
