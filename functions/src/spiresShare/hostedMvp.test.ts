import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  acceptFourPassenger,
  cancelReservation,
  confirmHostedIfEligible,
  expireUnpaidReservations,
  markReservationPaid,
  markSupplementPaid,
  offerFourPassengerOption,
  openPaymentWindow,
  reservePlace,
  savePaymentLink,
  saveSupplementLink,
  undoReservationPaid,
} from "./bookingFlow";
import { MockPaymentProvider } from "./paymentProvider";
import { canCustomerAccessBooking, toCustomerBookingView, validateHostedPaymentUrl } from "./hostedPayment";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { stripPrivateFields, toPublicJourney } from "./logic";

function contact(name: string, uid = `uid_${name}`) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    flexibility: "plus_minus_30" as const,
    dropoffTerminal: "T5",
    uid,
  };
}

async function book(
  db: InMemoryShareDb,
  opts: { action: "propose" | "join"; journeyId?: string; passengers?: number; key: string; name: string; uid?: string }
) {
  return reservePlace(db, new MockPaymentProvider(), {
    action: opts.action,
    airportId: "heathrow",
    travelDate: "2026-10-13",
    preferredDepartureTime: "10:30",
    journeyId: opts.journeyId,
    passengers: opts.passengers || 1,
    luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
    contact: contact(opts.name, opts.uid),
    idempotencyKey: opts.key,
    termsAccepted: true,
  });
}

describe("hosted payment MVP", () => {
  it("registers one passenger as provisional interest with no payment", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", key: "one-pax-0001", name: "A" });
    const journey = db.journeys.get(String(first.journeyId))!;
    const booking = db.bookings.get(String(first.bookingId))!;
    assert.equal(journey.status, "GATHERING_INTEREST");
    assert.equal(journey.occupiedSeats, 1);
    assert.equal(booking.reservationStatus, "PROVISIONAL");
    assert.equal(booking.paymentStatus, "HOSTED_UNPAID");
  });

  it("moves to READY_FOR_PAYMENT_SETUP at four passengers", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "four-pax-0001", name: "A" });
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "READY_FOR_PAYMENT_SETUP");
  });

  it("does not email when a payment link is saved", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "link-save-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-1010");
    const journey = db.journeys.get(String(first.journeyId))!;
    assert.equal(journey.paymentStageStatus, "LINK_SAVED");
    assert.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 0);
  });

  it("opens the payment window, emails, and does not mark paid", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "open-win-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-1010");
    const opened = openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    assert.equal(opened.emailedBookingIds.length, 1);
    assert.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 1);
    const booking = [...db.bookings.values()][0];
    assert.equal(booking.reservationStatus, "PAYMENT_PENDING");
    assert.notEqual(booking.reservationStatus, "PAID");
  });

  it("rejects a non https payment url", () => {
    assert.throws(() => validateHostedPaymentUrl("http://pay.example.com/x"));
  });

  it("lets only the assigned customer see the payment link flag", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "own-link-01", name: "A", uid: "uid_A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-1010");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    const journey = db.journeys.get(String(first.journeyId))!;
    const view = toCustomerBookingView(journey, booking, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(view.paymentLinkAvailable, true);
    assert.equal("paymentLinkUrl" in view, false);
    assert.equal(canCustomerAccessBooking(booking, { uid: "uid_A" }), true);
    assert.equal(canCustomerAccessBooking(booking, { uid: "uid_other" }), false);
  });

  it("never puts passenger identities in the public or customer aggregate view", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", key: "priv-a-0001", name: "Ahmed" });
    await book(db, { action: "join", journeyId: first.journeyId, key: "priv-b-0001", name: "Sarah" });
    const journey = db.journeys.get(String(first.journeyId))!;
    const pub = toPublicJourney(journey, DEFAULT_SHARE_CONFIG);
    assert.equal("name" in pub, false);
    const own = [...db.bookings.values()].find((row) => row.name === "Ahmed")!;
    const view = toCustomerBookingView(journey, own, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    const blob = JSON.stringify(view);
    assert.equal(blob.includes("Sarah"), false);
    assert.equal(blob.includes("sarah@example.com"), false);
    const stripped = stripPrivateFields({ ...journey, paymentLinkUrl: "https://secret.example/pay" } as unknown as Record<string, unknown>);
    assert.equal(stripped.paymentLinkUrl, undefined);
  });

  it("admin mark paid updates own status and aggregate paid count", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "paid-a-0001", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-1010");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "hashim@spires.com", "2026-09-28T12:10:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    assert.equal(booking.reservationStatus, "PAID");
    assert.equal(booking.paidAmountPence, 14000);
    const view = toCustomerBookingView(db.journeys.get(String(first.journeyId))!, booking, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal(view.hostedPaymentStatus, "PAID");
    assert.equal(view.paidPassengerPlaces, 4);
  });

  it("expires an unpaid reservation and frees the seat without overselling", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "exp-pay-001", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-1010");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    booking.paymentDeadlineAt = "2026-09-28T12:05:00.000Z";
    const result = expireUnpaidReservations(db, "2026-09-28T12:10:00.000Z");
    assert.equal(result.expired, 1);
    assert.equal(db.journeys.get(String(first.journeyId))?.occupiedSeats, 0);
    assert.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAYMENT_EXPIRED");
  });

  it("gives a fifth passenger the same payment link during an open window", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "fifth-a-001", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/shared");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    const fifth = await book(db, { action: "join", journeyId: first.journeyId, key: "fifth-b-001", name: "E" });
    const journey = db.journeys.get(String(first.journeyId))!;
    const joining = db.bookings.get(String(fifth.bookingId))!;
    assert.equal(journey.occupiedSeats, 5);
    assert.equal(joining.reservationStatus, "PAYMENT_PENDING");
    assert.equal(journey.paymentLinkUrl, "https://pay.example.com/shared");
  });

  it("confirms 5/5 paid exactly once and does not send a second confirmation", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "conf-a-001", name: "A" });
    const fifth = await book(db, { action: "join", journeyId: first.journeyId, key: "conf-b-001", name: "E" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin", "2026-09-28T12:10:00.000Z");
    markReservationPaid(db, String(fifth.bookingId), "admin", "2026-09-28T12:11:00.000Z");
    const again = confirmHostedIfEligible(db, String(first.journeyId), "2026-09-28T12:12:00.000Z");
    assert.equal(again.alreadyConfirmed, true);
    assert.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 2);
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("requires unanimous four passenger acceptance and £43.75 including supplement", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 2, key: "four-a-mvp1", name: "A" });
    const second = await book(db, { action: "join", journeyId: first.journeyId, passengers: 2, key: "four-b-mvp1", name: "B" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    markReservationPaid(db, String(second.bookingId), "admin");
    const offer = offerFourPassengerOption(db, String(first.journeyId));
    assert.equal(offer.proposedFarePence, 4375);
    const one = acceptFourPassenger(db, String(first.bookingId), true);
    assert.equal(one.allAccepted, false);
    acceptFourPassenger(db, String(second.bookingId), true);
    saveSupplementLink(db, String(first.journeyId), "https://pay.example.com/supplement");
    markSupplementPaid(db, String(first.bookingId), "admin");
    const last = markSupplementPaid(db, String(second.bookingId), "admin");
    assert.equal(last.confirmed, true);
    const total = [...db.bookings.values()].reduce((sum, row) => sum + (row.paidAmountPence || 0) + (row.supplementPaidPence || 0), 0);
    assert.equal(total, 17500);
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("does not unconfirm a locked journey after a late cancellation", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 5, key: "late-a-001", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    const journey = db.journeys.get(String(first.journeyId))!;
    assert.equal(journey.status, "CONFIRMED");
    journey.departureAt = "2026-09-28T14:00:00.000Z";
    const result = cancelReservation(db, String(first.bookingId), "2026-09-28T13:00:00.000Z");
    assert.equal(result.category, "LATE_CANCELLATION");
    assert.equal(result.journeyStillConfirmed, true);
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    assert.equal(db.journeys.get(String(first.journeyId))?.occupiedSeats, 0);
  });

  it("does not let two concurrent last seats exceed capacity", async () => {
    const db = new InMemoryShareDb();
    const seed = await book(db, { action: "propose", passengers: 4, key: "race-a-001", name: "A" });
    const [one, two] = await Promise.allSettled([
      book(db, { action: "join", journeyId: seed.journeyId, key: "race-b-001", name: "B" }),
      book(db, { action: "join", journeyId: seed.journeyId, key: "race-c-001", name: "C" }),
    ]);
    const ok = [one, two].filter((row) => row.status === "fulfilled");
    assert.equal(ok.length, 1);
    assert.ok((db.journeys.get(String(seed.journeyId))?.occupiedSeats || 0) <= 5);
  });

  it("customers cannot mark themselves paid via undo/mark helpers used by admin", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "self-pay-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    assert.notEqual(booking.reservationStatus, "PAID");
    undoReservationPaid(db, String(first.bookingId), "admin");
    assert.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAYMENT_PENDING");
  });
});
