import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  acceptProposedInterestJourney,
  addWaitlist,
  cancelReservation,
  claimWaitlistPlace,
  confirmHostedIfEligible,
  createDropoffHub,
  createPilotJourney,
  customerInterestViews,
  customerWaitlistViews,
  declineProposedInterestJourney,
  expressInterest,
  markReservationPaid,
  openPaymentWindow,
  proposeJourneyFromInterest,
  proposeSharedDropoff,
  requireShareAuth,
  reservePlace,
  savePaymentLink,
  updateInterestEntry,
  withdrawInterest,
  listPublicInterestGroups,
} from "./bookingFlow";
import { MockPaymentProvider } from "./paymentProvider";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { previewCompatibleInterest } from "./interestGroups";
import { toCustomerBookingView } from "./hostedPayment";
import { toPublicJourney } from "./logic";

function contact(name: string, uid = `uid_${name}`) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    uid,
  };
}

describe("customer initiated Spires Share", () => {
  it("logged in customer can start a new request without an existing Share booking", () => {
    assert.equal(requireShareAuth("uid_new"), "uid_new");
    assert.throws(() => requireShareAuth(undefined));
    const db = new InMemoryShareDb();
    assert.equal(customerInterestViews(db, "uid_new").length, 0);
  });

  it("customer can enter a route and join compatible interest or create their own", () => {
    const db = new InMemoryShareDb();
    const first = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "South Kensington",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Ada"),
    });
    const suggested = previewCompatibleInterest([...db.interestGroups.values()], {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:10",
      flexibility: "plus_minus_30",
      passengers: 1,
    });
    assert.equal(suggested?.publicNumber, first.group.publicNumber);
    const joined = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:10",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "Chelsea",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Bea"),
    });
    assert.equal(joined.joinedExisting, true);
    const own = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "18:00",
      flexibility: "exact",
      passengers: 1,
      intendedDestinationText: "Canary Wharf",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Cyd"),
    });
    assert.equal(own.joinedExisting, false);
    assert.notEqual(own.group.id, first.group.id);
    const mine = customerInterestViews(db, "uid_Ada");
    assert.equal(mine.length, 1);
    assert.equal(mine[0].status, "ACTIVE");
    const pub = listPublicInterestGroups(db);
    assert.equal(pub.find((row: { publicNumber: string }) => row.publicNumber === first.group.publicNumber)?.interestedSeatCount, 2);
    assert.equal("name" in pub[0], false);
  });

  it("customer can withdraw unpaid interest", () => {
    const db = new InMemoryShareDb();
    const created = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "Paddington",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Dee"),
    });
    withdrawInterest(db, created.entry.id, "uid_Dee");
    assert.equal(db.interestEntries.get(created.entry.id)?.status, "WITHDRAWN");
  });

  it("CITY intended destination stays private and Heathrow collects flight terminals", () => {
    const db = new InMemoryShareDb();
    const city = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "South Kensington",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Eli"),
    });
    const air = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "Heathrow",
      travelDate: "2026-10-12",
      preferredDepartureTime: "14:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      departureTerminal: "T5",
      flightNumber: "BA123",
      flightDepartureTime: "18:30",
      termsAccepted: true,
      ...contact("Fay"),
    });
    const pub = listPublicInterestGroups(db);
    assert.equal(JSON.stringify(pub).includes("intendedDestinationText"), false);
    const cityView = customerInterestViews(db, "uid_Eli")[0];
    const airView = customerInterestViews(db, "uid_Fay")[0];
    assert.equal(cityView.intendedDestinationText, "South Kensington");
    assert.equal(airView.departureTerminal, "T5");
    assert.equal(airView.flightNumber, "BA123");
    assert.equal(city.group.destinationMatchingEnabled, true);
    assert.equal(air.group.journeyType, "AIRPORT");
  });

  it("proposed journey appears, can be accepted or declined, and CITY drop off is required before payment", () => {
    const db = new InMemoryShareDb();
    const created = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "South Kensington",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Gus"),
    });
    const proposed = proposeJourneyFromInterest(db, created.group.id, {
      departureLocation: "Thornhill Park & Ride",
      departureTime: "10:15",
      farePence: 4500,
      capacity: 5,
    });
    const view = customerInterestViews(db, "uid_Gus")[0];
    assert.equal(view.canAcceptProposal, true);
    assert.equal(view.proposedFarePence, 4500);
    const accepted = acceptProposedInterestJourney(db, created.entry.id, "uid_Gus");
    const hub = createDropoffHub(db, { name: "Victoria", city: "London", enabled: true });
    proposeSharedDropoff(db, accepted.booking.journeyId || proposed.id, hub.id, "admin@example.com");
    const booking = accepted.booking;
    const customer = toCustomerBookingView(db.journeys.get(booking.journeyId)!, booking, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(customer.paymentLinkAvailable, false);
    assert.equal(customer.canAcceptSharedDropoff, true);
    assert.equal(proposed.farePence, 4500);
    const other = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "Wembley",
      travelDate: "2026-10-17",
      preferredDepartureTime: "12:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      termsAccepted: true,
      ...contact("Ned"),
    });
    proposeJourneyFromInterest(db, other.group.id, {
      departureLocation: "Thornhill Park & Ride",
      departureTime: "12:15",
      farePence: 4000,
      capacity: 5,
    });
    const declined = declineProposedInterestJourney(db, other.entry.id, "uid_Ned");
    assert.equal(declined.status, "DECLINED_PROPOSAL");
  });

  it("returning from hosted payment does not mark paid until admin verifies", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    await reservePlace(db, new MockPaymentProvider(), {
      action: "join",
      airportId: "heathrow",
      travelDate: journey.travelDate,
      preferredDepartureTime: journey.departureTime,
      journeyId: journey.id,
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: { ...contact("Hal"), flexibility: "plus_minus_30", dropoffTerminal: "T3", departureTerminal: "T5" },
      idempotencyKey: "app-pay-01xxxxxxxx",
      termsAccepted: true,
    });
    const booking = [...db.bookings.values()][0];
    booking.paymentSubmittedAt = new Date().toISOString();
    const view = toCustomerBookingView(db.journeys.get(journey.id)!, booking, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(view.hostedPaymentStatus === "PAID", false);
    assert.match(String(view.paymentSubmittedNotice), /confirming your payment/);
    assert.equal(view.terminalGuideLabel, "How to get from T3 to T5");
    markReservationPaid(db, booking.id, "admin");
    const paid = toCustomerBookingView(db.journeys.get(journey.id)!, db.bookings.get(booking.id)!, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(paid.hostedPaymentStatus, "PAID");
  });

  it("waitlist can be joined, offered and claimed without exceeding capacity", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    for (let i = 0; i < 5; i += 1) {
      await reservePlace(db, new MockPaymentProvider(), {
        action: "join",
        airportId: "heathrow",
        travelDate: journey.travelDate,
        preferredDepartureTime: journey.departureTime,
        journeyId: journey.id,
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: { ...contact(`Ivy${i}`), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
        idempotencyKey: `app-wl-ivy${i}xxxxxx`,
        termsAccepted: true,
      });
    }
    addWaitlist(db, journey.id, { ...contact("Jay"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
    addWaitlist(db, journey.id, { ...contact("Kay"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:05:00.000Z" });
    const views = customerWaitlistViews(db, "uid_Jay");
    assert.equal(views[0].status, "WAITING");
    cancelReservation(db, [...db.bookings.values()][0].id);
    const offered = customerWaitlistViews(db, "uid_Jay", "2026-10-01T10:05:00.000Z")[0];
    assert.equal(offered.canClaim, true);
    await claimWaitlistPlace(db, offered.waitlistId, "uid_Jay", "2026-10-01T10:10:00.000Z");
    assert.equal(db.journeys.get(journey.id)?.occupiedSeats, 5);
    const kay = [...db.waitlist.values()].find((row) => row.uid === "uid_Kay")!;
    assert.notEqual(kay.status, "ACCEPTED");
  });

  it("confirmed Share journeys stay distinct from interest and ordinary taxi bookings", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    for (let i = 0; i < 5; i += 1) {
      await reservePlace(db, new MockPaymentProvider(), {
        action: "join",
        airportId: "heathrow",
        travelDate: journey.travelDate,
        preferredDepartureTime: journey.departureTime,
        journeyId: journey.id,
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: { ...contact(`P${i}`), flexibility: "plus_minus_30", dropoffTerminal: "T3" },
        idempotencyKey: `app-conf-${i}xxxxxxxx`,
        termsAccepted: true,
      });
    }
    savePaymentLink(db, journey.id, "https://pay.example.com/share35");
    openPaymentWindow(db, journey.id);
    for (const booking of db.bookings.values()) markReservationPaid(db, booking.id, "admin");
    confirmHostedIfEligible(db, journey.id);
    const view = toCustomerBookingView(db.journeys.get(journey.id)!, [...db.bookings.values()][0], [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(view.journeyStatus, "CONFIRMED");
    assert.equal(view.customerStatusLabel, "Journey confirmed");
    const pub = toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG);
    assert.equal(pub.guarantee, "CONFIRMED");
  });

  it("updating interest rematches when the window no longer overlaps", () => {
    const db = new InMemoryShareDb();
    const created = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "Camden",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Lee"),
    });
    const moved = updateInterestEntry(db, created.entry.id, "uid_Lee", {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "18:00",
      flexibility: "exact",
      passengers: 1,
      intendedDestinationText: "Camden",
      sharedDropoffAcknowledged: true,
    });
    assert.equal(moved.rematched, true);
    assert.notEqual(moved.group.id, created.group.id);
  });
});
