import assert from "node:assert/strict";
import { describe, it } from "node:test";
import fs from "node:fs";
import path from "node:path";
import {
  InMemoryShareDb,
  acceptSharedDropoff,
  addWaitlist,
  cancelReservation,
  claimWaitlistPlace,
  confirmHostedIfEligible,
  createCityMatchingJourney,
  createDropoffHub,
  createPilotJourney,
  expressInterest,
  markReservationPaid,
  offerFourPassengerOption,
  offerWaitlistIfPossible,
  openPaymentWindow,
  proposeSharedDropoff,
  reservePlace,
  savePaymentLink,
  listPublicInterestGroups,
} from "./bookingFlow";
import { MockPaymentProvider } from "./paymentProvider";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { previewCompatibleInterest as previewFromGroups, publicInterestHasPrivateData } from "./interestGroups";
import { stripPrivateFields, toPublicJourney } from "./logic";
import { canCustomerAccessBooking, toCustomerBookingView } from "./hostedPayment";
import { canPassengerEnterPayment } from "./destinationMatching";
import { cityJourneyRequiresOwnFare } from "./routePricing";
import {
  PREVIOUS_SHARE_TERMS_VERSION,
  SHARE_TERMS_VERSION,
  ShareBooking,
  isCurrentShareTermsVersion,
} from "./types";
import { terminalGuideHref, terminalGuideLinkText, terminalTransferRequired, terminalTransferWarning } from "./terminalGuide";

function contact(name: string, uid = `uid_${name}`, extras: Record<string, unknown> = {}) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    uid,
    dropoffTerminal: "T3" as const,
    ...extras,
  };
}

async function joinHeathrow(db: InMemoryShareDb, journeyId: string, name: string, key: string, extras: Record<string, unknown> = {}) {
  return reservePlace(db, new MockPaymentProvider(), {
    action: "join",
    airportId: "heathrow",
    travelDate: "2026-10-12",
    preferredDepartureTime: "14:00",
    journeyId,
    passengers: 1,
    luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
    contact: { ...contact(name, `uid_${name}`, extras), flexibility: "plus_minus_30" as const },
    idempotencyKey: key,
    termsAccepted: true,
  });
}

describe("broader Spires Share product", () => {
  it("1 and 2. Existing Heathrow £35 hosted payment flow still works", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    assert.equal(journey.farePence, 3500);
    assert.equal(journey.fourPassengerFallbackEnabled, true);
    for (let i = 0; i < 5; i += 1) {
      await joinHeathrow(db, journey.id, `H${i}`, `heathrow-pay-${i}xxxx`);
    }
    savePaymentLink(db, journey.id, "https://pay.example.com/share35");
    openPaymentWindow(db, journey.id);
    for (const booking of db.bookings.values()) {
      markReservationPaid(db, booking.id, "admin");
    }
    confirmHostedIfEligible(db, journey.id);
    assert.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
    assert.equal(db.journeys.get(journey.id)?.farePence, 3500);
  });

  it("3. Existing four passenger Heathrow fallback still works", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    for (let i = 0; i < 4; i += 1) {
      await joinHeathrow(db, journey.id, `Four${i}`, `four-opt-${i}xxxxxxx`);
    }
    savePaymentLink(db, journey.id, "https://pay.example.com/share35");
    openPaymentWindow(db, journey.id);
    for (const booking of db.bookings.values()) markReservationPaid(db, booking.id, "admin");
    offerFourPassengerOption(db, journey.id);
    assert.equal(db.journeys.get(journey.id)?.status, "FOUR_PASSENGER_OPTION");
  });

  it("4 and 7. Generic CITY interest can be created and compatible passengers join the same group", () => {
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
      ...contact("Ava"),
    });
    const second = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:15",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "Chelsea",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Ben"),
    });
    assert.equal(first.joinedExisting, false);
    assert.equal(second.joinedExisting, true);
    assert.equal(second.group.id, first.group.id);
    assert.equal(db.interestGroups.get(first.group.id)?.interestedSeatCount, 2);
    assert.equal(first.entry.termsVersion, SHARE_TERMS_VERSION);
  });

  it("5 and 6. Public sees aggregate interest only and private destinations stay private", () => {
    const db = new InMemoryShareDb();
    expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "South Kensington",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Cara"),
    });
    const pub = listPublicInterestGroups(db);
    assert.equal(pub.length, 1);
    assert.equal(pub[0].origin, "Oxford");
    assert.equal(pub[0].destinationRegion, "London");
    assert.equal(pub[0].interestedSeatCount, 1);
    assert.equal(publicInterestHasPrivateData(pub[0]), false);
    assert.equal("intendedDestinationText" in pub[0], false);
    assert.equal("email" in pub[0], false);
  });

  it("8 and 9. Waitlist is FIFO and cannot exceed capacity", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    for (let i = 0; i < 5; i += 1) {
      await joinHeathrow(db, journey.id, `Full${i}`, `wl-full-${i}xxxxxxx`);
    }
    addWaitlist(db, journey.id, { ...contact("First"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:00:00.000Z" });
    addWaitlist(db, journey.id, { ...contact("Second"), passengers: 1, termsAccepted: true, nowIso: "2026-10-01T09:01:00.000Z" });
    cancelReservation(db, [...db.bookings.values()][0].id);
    const offered = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
    assert.equal(offered?.email, "first@example.com");
    const second = [...db.waitlist.values()].find((row) => row.email === "second@example.com")!;
    assert.notEqual(second.status, "OFFERED");
    await claimWaitlistPlace(db, offered!.id, offered!.uid, "2026-10-01T10:10:00.000Z");
    assert.equal(db.journeys.get(journey.id)?.occupiedSeats, 5);
    const results = await Promise.allSettled([
      claimWaitlistPlace(db, offered!.id, offered!.uid, "2026-10-01T10:11:00.000Z"),
    ]);
    assert.equal(results[0].status, "rejected");
  });

  it("10. CITY drop off must be accepted before payment", async () => {
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
    const result = await reservePlace(db, new MockPaymentProvider(), {
      action: "join",
      airportId: journey.airportId,
      travelDate: journey.travelDate,
      preferredDepartureTime: journey.departureTime,
      journeyId: journey.id,
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: { ...contact("Dana"), flexibility: "plus_minus_30" },
      intendedDestinationText: "South Kensington",
      sharedDropoffAcknowledged: true,
      idempotencyKey: "city-drop-1xxxxxxx",
      termsAccepted: true,
    });
    proposeSharedDropoff(db, journey.id, hub.id, "admin@example.com");
    const before = db.bookings.get(String(result.bookingId))!;
    assert.equal(canPassengerEnterPayment(db.journeys.get(journey.id)!, before), false);
    const view = toCustomerBookingView(db.journeys.get(journey.id)!, before, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(view.canAcceptSharedDropoff, true);
    assert.equal(view.paymentLinkAvailable, false);
    acceptSharedDropoff(db, String(result.bookingId));
  });

  it("11-14. Heathrow passengers can specify T2/T3/T4/T5 with the correct transfer guidance", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    const t3 = await joinHeathrow(db, journey.id, "T3p", "term-t3-01xxxxxxxx", { departureTerminal: "T3", dropoffTerminal: "T3" });
    const t5 = await joinHeathrow(db, journey.id, "T5p", "term-t5-01xxxxxxxx", { departureTerminal: "T5", dropoffTerminal: "T5" });
    const t4 = await joinHeathrow(db, journey.id, "T4p", "term-t4-01xxxxxxxx", { departureTerminal: "T4", dropoffTerminal: "T4" });
    const t2 = await joinHeathrow(db, journey.id, "T2p", "term-t2-01xxxxxxxx", { departureTerminal: "T2", dropoffTerminal: "T2" });
    const live = db.journeys.get(journey.id)!;
    const bookings = [...db.bookings.values()];
    const viewT3 = toCustomerBookingView(live, db.bookings.get(String(t3.bookingId)) as ShareBooking, bookings, DEFAULT_SHARE_CONFIG);
    const viewT5 = toCustomerBookingView(live, db.bookings.get(String(t5.bookingId)) as ShareBooking, bookings, DEFAULT_SHARE_CONFIG);
    const viewT4 = toCustomerBookingView(live, db.bookings.get(String(t4.bookingId)) as ShareBooking, bookings, DEFAULT_SHARE_CONFIG);
    const viewT2 = toCustomerBookingView(live, db.bookings.get(String(t2.bookingId)) as ShareBooking, bookings, DEFAULT_SHARE_CONFIG);
    assert.equal(db.bookings.get(String(t5.bookingId))?.dropoffTerminal, "T3");
    assert.equal(viewT3.terminalTransferRequired, false);
    assert.match(String(viewT3.terminalTransferWarning), /No terminal transfer/);
    assert.equal(viewT5.terminalTransferRequired, true);
    assert.equal(viewT5.terminalGuideLabel, "How to get from T3 to T5");
    assert.equal(viewT4.terminalGuideLabel, "How to get from T3 to T4");
    assert.equal(viewT2.terminalGuideLabel, "How to get from T3 to T2");
    assert.ok(String(viewT5.terminalGuideUrl).includes("#t5"));
    assert.ok(String(viewT4.terminalGuideUrl).includes("#t4"));
  });

  it("15 and 16. Terminal guide is a public page and does not expose customer information", () => {
    const file = path.join(process.cwd(), "..", "spires-website", "share", "heathrow-terminal-transfer.html");
    const html = fs.readFileSync(file, "utf8");
    assert.match(html, /Getting from Heathrow Terminal 3 to your departure terminal/);
    assert.match(html, /id="t2"/);
    assert.match(html, /id="t5"/);
    assert.equal(html.includes("bookingId"), false);
    assert.equal(html.includes("@example.com"), false);
    assert.equal(html.includes("intendedDestination"), false);
    assert.equal(terminalTransferRequired("T5"), true);
    assert.equal(terminalGuideLinkText("T5"), "How to get from T3 to T5");
    assert.ok(terminalGuideHref("T4").includes("#t4"));
    assert.match(String(terminalTransferWarning("T3")), /No terminal transfer/);
  });

  it("17 and 18. New terms version is recorded and old acceptances are not treated as current", () => {
    const db = new InMemoryShareDb();
    const result = expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "Heathrow",
      travelDate: "2026-10-12",
      preferredDepartureTime: "14:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      termsAccepted: true,
      ...contact("Eve"),
    });
    assert.equal(result.entry.termsVersion, SHARE_TERMS_VERSION);
    assert.equal(isCurrentShareTermsVersion(SHARE_TERMS_VERSION), true);
    assert.equal(isCurrentShareTermsVersion(PREVIOUS_SHARE_TERMS_VERSION), false);
    assert.equal(isCurrentShareTermsVersion("share-heathrow-mvp-2026-09-28"), false);
  });

  it("19 and 20. Route specific pricing works and London does not inherit Heathrow pricing", () => {
    assert.throws(() => cityJourneyRequiresOwnFare(undefined));
    assert.throws(() =>
      createCityMatchingJourney(new InMemoryShareDb(), {
        originCity: "Oxford",
        destinationCity: "London",
        departureLocation: "Thornhill Park & Ride",
        travelDate: "2026-10-10",
        departureTime: "10:00",
      })
    );
    const db = new InMemoryShareDb();
    const london = createCityMatchingJourney(db, {
      originCity: "Oxford",
      destinationCity: "London",
      departureLocation: "Thornhill Park & Ride",
      travelDate: "2026-10-10",
      departureTime: "10:00",
      farePence: 4500,
    });
    const heathrow = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00" });
    assert.equal(london.farePence, 4500);
    assert.equal(london.fourPassengerFallbackEnabled, false);
    assert.equal(heathrow.farePence, 3500);
    assert.equal(heathrow.fourPassengerFallbackEnabled, true);
    assert.throws(() => offerFourPassengerOption(db, london.id));
  });

  it("21 and 22. Payment URLs stay private and customers cannot self mark paid", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    const result = await joinHeathrow(db, journey.id, "Fay", "pay-priv-01xxxxxxx");
    savePaymentLink(db, journey.id, "https://pay.example.com/secret");
    const pub = toPublicJourney(db.journeys.get(journey.id)!, DEFAULT_SHARE_CONFIG);
    assert.equal("paymentLinkUrl" in pub, false);
    const stripped = stripPrivateFields(db.journeys.get(journey.id) as unknown as Record<string, unknown>);
    assert.equal("paymentLinkUrl" in stripped, false);
    const booking = db.bookings.get(String(result.bookingId))!;
    assert.equal(canCustomerAccessBooking(booking, { uid: "uid_Fay" }), true);
    assert.equal(booking.hostedPaymentStatus === "PAID", false);
  });

  it("23 and 24. Sixth passenger cannot bypass capacity and confirmed journeys stay locked", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-12", departureTime: "14:00", customerVisible: true });
    for (let i = 0; i < 5; i += 1) {
      await joinHeathrow(db, journey.id, `Cap${i}`, `cap-${i}xxxxxxxxxxxx`);
    }
    await assert.rejects(() => joinHeathrow(db, journey.id, "Sixth", "cap-sixthxxxxxxxxx"));
    savePaymentLink(db, journey.id, "https://pay.example.com/share35");
    openPaymentWindow(db, journey.id);
    for (const booking of db.bookings.values()) markReservationPaid(db, booking.id, "admin");
    confirmHostedIfEligible(db, journey.id);
    const locked = db.journeys.get(journey.id)!;
    assert.equal(locked.status, "CONFIRMED");
    locked.occupiedSeats = 4;
    confirmHostedIfEligible(db, journey.id);
    assert.equal(db.journeys.get(journey.id)?.status, "CONFIRMED");
  });

  it("compatible preview does not force an unsuitable match", () => {
    const db = new InMemoryShareDb();
    expressInterest(db, {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "10:00",
      flexibility: "plus_minus_30",
      passengers: 1,
      intendedDestinationText: "Mayfair",
      sharedDropoffAcknowledged: true,
      termsAccepted: true,
      ...contact("Gina"),
    });
    const match = previewFromGroups([...db.interestGroups.values()], {
      origin: "Oxford",
      destinationRegion: "London",
      travelDate: "2026-10-10",
      preferredDepartureTime: "18:00",
      flexibility: "exact",
      passengers: 1,
    });
    assert.equal(match, null);
  });
});
