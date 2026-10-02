import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  acceptFourPassenger,
  acceptSharedDropoff,
  cancelReservation,
  confirmHostedIfEligible,
  createCityMatchingJourney,
  createDropoffHub,
  createPilotJourney,
  declineSharedDropoff,
  markReservationPaid,
  markSupplementPaid,
  offerFourPassengerOption,
  openPaymentWindow,
  proposeSharedDropoff,
  reservePlace,
  savePaymentLink,
  saveSupplementLink,
  setDropoffHubEnabled,
} from "./bookingFlow";
import { MockPaymentProvider } from "./paymentProvider";
import {
  canCustomerAccessBooking,
  hostedPaymentUrlForCustomer,
  toCustomerBookingView,
} from "./hostedPayment";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { isCustomerListableJourney } from "./access";
import { stripPrivateFields, toPublicJourney } from "./logic";
import {
  adminDestinationSummary,
  publicDtoHasPrivateDestinations,
  rankSharedDropoffHubs,
  requireIntendedDestination,
} from "./destinationMatching";
import { ShareBooking } from "./types";

function contact(name: string, uid = `uid_${name}`) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    flexibility: "plus_minus_30" as const,
    dropoffTerminal: "T3" as const,
    uid,
  };
}

async function bookHeathrow(
  db: InMemoryShareDb,
  opts: { action: "propose" | "join"; journeyId?: string; key: string; name: string }
) {
  return reservePlace(db, new MockPaymentProvider(), {
    action: opts.action,
    airportId: "heathrow",
    travelDate: "2026-10-06",
    preferredDepartureTime: "14:00",
    journeyId: opts.journeyId,
    passengers: 1,
    luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
    contact: contact(opts.name),
    idempotencyKey: opts.key,
    termsAccepted: true,
  });
}

async function joinCity(
  db: InMemoryShareDb,
  journeyId: string,
  name: string,
  destination: string,
  key: string
) {
  return reservePlace(db, new MockPaymentProvider(), {
    action: "join",
    airportId: "city:oxford-london",
    travelDate: "2026-10-10",
    preferredDepartureTime: "10:00",
    journeyId,
    passengers: 1,
    luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
    contact: contact(name),
    idempotencyKey: key,
    termsAccepted: true,
    intendedDestinationText: destination,
    sharedDropoffAcknowledged: true,
  });
}

describe("destination matching architecture", () => {
  it("1. Heathrow journey works without destination matching", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-06", departureTime: "14:00", customerVisible: true });
    assert.equal(journey.destinationMatchingEnabled, false);
    assert.equal(journey.journeyType, "AIRPORT");
    const first = await bookHeathrow(db, { action: "join", journeyId: journey.id, key: "h1xxxxxxx", name: "Ann" });
    const booking = db.bookings.get(String(first.bookingId));
    assert.equal(booking?.intendedDestinationText, undefined);
    assert.equal(db.journeys.get(journey.id)?.status, "GATHERING_INTEREST");
  });

  it("2. CITY matching journey asks for intended destination", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    await assert.rejects(
      () =>
        reservePlace(db, new MockPaymentProvider(), {
          action: "join",
          airportId: journey.airportId,
          travelDate: journey.travelDate,
          preferredDepartureTime: journey.departureTime,
          journeyId: journey.id,
          passengers: 1,
          luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
          contact: contact("Ben"),
          idempotencyKey: "city-missing",
          termsAccepted: true,
        }),
      /Where in London/
    );
    assert.throws(() => requireIntendedDestination({ intendedDestinationText: "Chelsea" }), /shared drop off/);
  });

  it("3. Intended destination is stored against the correct reservation", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const result = await joinCity(db, journey.id, "Cara", "South Kensington", "city-dest-1");
    const booking = db.bookings.get(String(result.bookingId)) as ShareBooking;
    assert.equal(booking.intendedDestinationText, "South Kensington");
    assert.ok(booking.destinationEnteredAt);
    assert.ok(booking.sharedDropoffAcknowledgedAt);
    assert.equal(booking.journeyId, journey.id);
  });

  it("4 and 10. Passenger cannot see another passenger destination and can see their own", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const a = await joinCity(db, journey.id, "Dana", "Paddington", "city-a");
    const b = await joinCity(db, journey.id, "Eli", "Chelsea", "city-b");
    const live = db.journeys.get(journey.id)!;
    const bookings = [...db.bookings.values()];
    const viewA = toCustomerBookingView(live, db.bookings.get(String(a.bookingId))!, bookings, DEFAULT_SHARE_CONFIG);
    const viewB = toCustomerBookingView(live, db.bookings.get(String(b.bookingId))!, bookings, DEFAULT_SHARE_CONFIG);
    assert.equal(viewA.intendedDestinationText, "Paddington");
    assert.equal(viewB.intendedDestinationText, "Chelsea");
    assert.equal(JSON.stringify(viewA).includes("Chelsea"), false);
    assert.equal(JSON.stringify(viewB).includes("Paddington"), false);
    assert.equal(
      canCustomerAccessBooking(db.bookings.get(String(b.bookingId))!, { uid: "uid_Dana" }),
      false
    );
  });

  it("5. Public journey DTO contains no intended destinations", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    await joinCity(db, journey.id, "Fay", "Mayfair", "city-f");
    const pub = toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG);
    assert.equal(publicDtoHasPrivateDestinations(pub), false);
    assert.equal(pub.destinationMatchingEnabled, true);
    const stripped = stripPrivateFields(db.bookings.get([...db.bookings.keys()][0]) as unknown as Record<string, unknown>);
    assert.equal("intendedDestinationText" in stripped, false);
    assert.equal("paymentLinkUrl" in stripped, false);
  });

  it("6. Admin can see passenger destinations", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    await joinCity(db, journey.id, "Gina", "Westminster", "city-g");
    const summary = adminDestinationSummary(db.journeys.get(journey.id)!, [...db.bookings.values()], [...db.hubs.values()]);
    assert.equal(summary.destinations[0].intendedDestinationText, "Westminster");
    assert.equal(summary.interestedCount, 1);
  });

  it("7 and 8. Admin can select an enabled hub and cannot select a disabled hub", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const disabled = createDropoffHub(db, { name: "Marble Arch", city: "London", enabled: false });
    const enabled = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    await joinCity(db, journey.id, "Hugo", "Chelsea", "city-h");
    assert.throws(() => proposeSharedDropoff(db, journey.id, disabled.id, "admin@example.com"), /not enabled/);
    proposeSharedDropoff(db, journey.id, enabled.id, "admin@example.com");
    assert.equal(db.journeys.get(journey.id)?.proposedSharedDropoffDisplayName, "Victoria");
    setDropoffHubEnabled(db, enabled.id, false);
    assert.throws(() => proposeSharedDropoff(db, journey.id, enabled.id, "admin@example.com"), /not enabled/);
  });

  it("9 and 11. Passenger sees proposed drop off and can accept it", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const hub = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    const result = await joinCity(db, journey.id, "Ivy", "South Kensington", "city-i");
    proposeSharedDropoff(db, journey.id, hub.id, "admin@example.com");
    const live = db.journeys.get(journey.id)!;
    const booking = db.bookings.get(String(result.bookingId))!;
    const view = toCustomerBookingView(live, booking, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(view.proposedSharedDropoffDisplayName, "Victoria");
    assert.equal(view.sharedDropoffStatus, "PROPOSED");
    assert.match(view.sharedDropoffNotice || "", /South Kensington/);
    assert.match(view.sharedDropoffNotice || "", /Victoria/);
    acceptSharedDropoff(db, booking.id);
    assert.equal(db.bookings.get(booking.id)?.acceptedDropoffProposalVersion, 1);
    assert.ok(db.bookings.get(booking.id)?.sharedDropoffAcceptedAt);
  });

  it("12, 13 and 14. Declining does not create a late cancellation and releases the seat", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const hub = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    const first = await joinCity(db, journey.id, "Jade", "Mayfair", "city-j");
    await joinCity(db, journey.id, "Kai", "Chelsea", "city-k");
    proposeSharedDropoff(db, journey.id, hub.id, "admin@example.com");
    declineSharedDropoff(db, String(first.bookingId));
    const declined = db.bookings.get(String(first.bookingId))!;
    assert.equal(declined.reservationStatus, "DROP_OFF_DECLINED");
    assert.equal(declined.cancellationCategory, undefined);
    assert.ok(declined.sharedDropoffDeclinedAt);
    assert.equal(db.journeys.get(journey.id)?.occupiedSeats, 1);
    const again = await joinCity(db, journey.id, "Leah", "Paddington", "city-l");
    assert.equal(again.ok, true);
    assert.equal(db.journeys.get(journey.id)?.occupiedSeats, 2);
  });

  it("15. CITY passenger cannot enter payment before accepting proposed drop off", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const names = ["Mia", "Ned", "Ora", "Pat"];
    for (const [index, name] of names.entries()) {
      await joinCity(db, journey.id, name, ["Paddington", "Mayfair", "Chelsea", "Westminster"][index], `pay-${name}`);
    }
    assert.equal(db.journeys.get(journey.id)?.status, "AWAITING_DROPOFF_SELECTION");
    savePaymentLink(db, journey.id, "https://pay.example.com/share35");
    assert.throws(() => openPaymentWindow(db, journey.id), /shared drop off/);
    const hub = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    proposeSharedDropoff(db, journey.id, hub.id, "admin@example.com");
    const live = db.journeys.get(journey.id)!;
    const unpaid = [...db.bookings.values()][0];
    assert.equal(hostedPaymentUrlForCustomer(live, unpaid), null);
    assert.throws(() => openPaymentWindow(db, journey.id), /accept the proposed shared drop off/);
  });

  it("16 and 17. Changing proposed drop off invalidates previous acceptance for that version", async () => {
    const db = new InMemoryShareDb();
    const journey = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const victoria = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    const marble = createDropoffHub(db, { name: "Marble Arch", city: "London", enabled: true });
    const result = await joinCity(db, journey.id, "Quinn", "Chelsea", "city-q");
    proposeSharedDropoff(db, journey.id, victoria.id, "admin@example.com");
    acceptSharedDropoff(db, String(result.bookingId));
    assert.equal(db.bookings.get(String(result.bookingId))?.acceptedDropoffProposalVersion, 1);
    proposeSharedDropoff(db, journey.id, marble.id, "admin@example.com");
    const booking = db.bookings.get(String(result.bookingId))!;
    assert.equal(booking.sharedDropoffAcceptedAt, undefined);
    assert.equal(booking.acceptedDropoffProposalVersion, undefined);
    assert.equal(db.journeys.get(journey.id)?.sharedDropoffProposalVersion, 2);
    assert.equal(db.journeys.get(journey.id)?.proposedSharedDropoffDisplayName, "Marble Arch");
  });

  it("18. Payment link remains private", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-06", departureTime: "14:00" });
    savePaymentLink(db, journey.id, "https://pay.example.com/secret-link");
    const pub = toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG);
    assert.equal("paymentLinkUrl" in pub, false);
    assert.equal(JSON.stringify(pub).includes("secret-link"), false);
    const stripped = stripPrivateFields(db.journeys.get(journey.id)! as unknown as Record<string, unknown>);
    assert.equal("paymentLinkUrl" in stripped, false);
  });

  it("19. Existing five passenger payment confirmation still works", async () => {
    const db = new InMemoryShareDb();
    const first = await bookHeathrow(db, { action: "propose", key: "five-a", name: "A" });
    const journeyId = String(first.journeyId);
    for (const name of ["B", "C", "D", "E"]) {
      await bookHeathrow(db, { action: "join", journeyId, key: `five-${name}`, name });
    }
    savePaymentLink(db, journeyId, "https://pay.example.com/share35");
    openPaymentWindow(db, journeyId, "2026-10-04T09:00:00.000Z");
    for (const booking of db.bookings.values()) {
      markReservationPaid(db, booking.id, "admin");
    }
    const confirmed = confirmHostedIfEligible(db, journeyId);
    assert.equal(confirmed.ok, true);
    assert.equal(db.journeys.get(journeyId)?.status, "CONFIRMED");
  });

  it("20. Existing four passenger fallback still works", async () => {
    const db = new InMemoryShareDb();
    const first = await bookHeathrow(db, { action: "propose", key: "four-a", name: "A" });
    const journeyId = String(first.journeyId);
    for (const name of ["B", "C", "D"]) {
      await bookHeathrow(db, { action: "join", journeyId, key: `four-${name}`, name });
    }
    savePaymentLink(db, journeyId, "https://pay.example.com/share35");
    openPaymentWindow(db, journeyId, "2026-10-04T09:00:00.000Z");
    for (const booking of db.bookings.values()) markReservationPaid(db, booking.id, "admin");
    offerFourPassengerOption(db, journeyId);
    saveSupplementLink(db, journeyId, "https://pay.example.com/share875");
    for (const booking of db.bookings.values()) {
      acceptFourPassenger(db, booking.id, true);
      markSupplementPaid(db, booking.id, "admin");
    }
    const confirmed = confirmHostedIfEligible(db, journeyId);
    assert.equal(confirmed.ok, true);
  });

  it("21. Existing concurrency protection still prevents overbooking", async () => {
    const db = new InMemoryShareDb();
    const first = await bookHeathrow(db, { action: "propose", key: "cap-a", name: "A" });
    const journeyId = String(first.journeyId);
    await Promise.all(
      ["B", "C", "D", "E"].map((name) => bookHeathrow(db, { action: "join", journeyId, key: `cap-${name}`, name }))
    );
    await assert.rejects(
      () => bookHeathrow(db, { action: "join", journeyId, key: "cap-overflow", name: "F" }),
      /No remaining places/
    );
    assert.equal(db.journeys.get(journeyId)?.occupiedSeats, 5);
  });

  it("22. Existing Heathrow tests continue: cancel is not drop off declined", async () => {
    const db = new InMemoryShareDb();
    const first = await bookHeathrow(db, { action: "propose", key: "can-a", name: "A" });
    cancelReservation(db, String(first.bookingId), "2026-10-01T09:00:00.000Z");
    const booking = db.bookings.get(String(first.bookingId));
    assert.equal(booking?.reservationStatus, "CANCELLED");
    assert.notEqual(booking?.reservationStatus, "DROP_OFF_DECLINED");
    assert.equal(isCustomerListableJourney(createPilotJourney(db, { travelDate: "2026-10-07", departureTime: "09:00", customerVisible: true }), "customer"), true);
    const city = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-11",
      departureTime: "10:00",
      farePence: 4500,
    });
    city.customerVisible = true;
    assert.equal(isCustomerListableJourney(city, "customer"), false);
    assert.equal(isCustomerListableJourney(city, "admin"), true);
  });

  it("matching ranks enabled hubs without fabricating routing times", () => {
    const hubs = [
      createDropoffHub(new InMemoryShareDb(), { name: "Victoria", city: "London", enabled: true }),
    ];
    const db = new InMemoryShareDb();
    const hub = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    const result = rankSharedDropoffHubs(
      [
        {
          id: "b1",
          journeyId: "j1",
          publicNumber: "x",
          passengers: 1,
          name: "A",
          mobile: "1",
          email: "a@example.com",
          flexibility: "exact",
          luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
          homeCollection: "HOME_COLLECTION_UNAVAILABLE",
          homeCollectionSurchargePence: 0,
          paymentStatus: "HOSTED_UNPAID",
          reservationStatus: "PROVISIONAL",
          boardStatus: "NOT_CHECKED_IN",
          earlyDepartureAccepted: false,
          manageTokenHash: "x",
          idempotencyKey: "x",
          createdAt: "2026-10-01T00:00:00.000Z",
          intendedDestinationText: "Chelsea",
        },
      ],
      [hub]
    );
    assert.equal(result.routingAvailable, false);
    assert.equal(result.geocodingAvailable, false);
    assert.equal(result.overallQuality, "MANUAL_REVIEW");
    assert.equal(result.hubScores[0].meanDistanceMetres, null);
    assert.equal(result.clusters[0].quality, "MANUAL_REVIEW");
    void hubs;
  });
});
