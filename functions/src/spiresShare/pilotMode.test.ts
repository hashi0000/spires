import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  customerShareAccessAllowed,
  isCustomerListableJourney,
  publicSharePageAllowed,
  shareFlagsFromEnv,
  sharePilotActive,
} from "./access";
import {
  InMemoryShareDb,
  acceptFourPassenger,
  cancelReservation,
  confirmHostedIfEligible,
  createPilotJourney,
  markReservationPaid,
  markSupplementPaid,
  offerFourPassengerOption,
  openPaymentWindow,
  publishPilotJourney,
  recordPaymentSubmitted,
  recordRefund,
  reservePlace,
  savePaymentLink,
  saveSupplementLink,
} from "./bookingFlow";
import { DEFAULT_SHARE_CONFIG, SPIRES_SHARE_PILOT_ENABLED, SPIRES_SHARE_PUBLIC_ENABLED } from "./defaults";
import { canCustomerAccessBooking, hostedPaymentUrlForCustomer, toCustomerBookingView } from "./hostedPayment";
import { stripPrivateFields, toPublicJourney } from "./logic";
import { shareNotificationsEnabled } from "./notifications";
import { MockPaymentProvider } from "./paymentProvider";

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

async function book(
  db: InMemoryShareDb,
  opts: { action: "propose" | "join"; journeyId?: string; passengers?: number; key: string; name: string; uid?: string }
) {
  return reservePlace(db, new MockPaymentProvider(), {
    action: opts.action,
    airportId: "heathrow",
    travelDate: "2026-10-06",
    preferredDepartureTime: "14:00",
    journeyId: opts.journeyId,
    passengers: opts.passengers || 1,
    luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
    contact: contact(opts.name, opts.uid),
    idempotencyKey: opts.key,
    termsAccepted: true,
  });
}

describe("pilot mode access", () => {
  it("1. Pilot disabled → ordinary customer cannot access Share", () => {
    const flags = shareFlagsFromEnv({ SPIRES_SHARE_ENABLED: "false", SPIRES_SHARE_PILOT: "true" });
    assert.equal(
      customerShareAccessAllowed({ flags, authenticated: true, isAdmin: false, isPreviewTester: false }),
      false
    );
    assert.equal(publicSharePageAllowed(flags), false);
    assert.equal(SPIRES_SHARE_PUBLIC_ENABLED, false);
    assert.equal(SPIRES_SHARE_PILOT_ENABLED, false);
  });

  it("2. Pilot enabled → authenticated customer can view available journeys", () => {
    const flags = { enabled: true, pilot: true, publicEnabled: false };
    assert.equal(sharePilotActive(flags), true);
    assert.equal(
      customerShareAccessAllowed({ flags, authenticated: true, isAdmin: false, isPreviewTester: false }),
      true
    );
    const db = new InMemoryShareDb();
    const hidden = createPilotJourney(db, { travelDate: "2026-10-06", departureTime: "14:00" });
    const shown = createPilotJourney(db, { travelDate: "2026-10-06", departureTime: "16:00" });
    publishPilotJourney(db, shown.id, true);
    assert.equal(isCustomerListableJourney(hidden, "customer"), false);
    assert.equal(isCustomerListableJourney(shown, "customer"), true);
    const listed = [...db.journeys.values()]
      .filter((row) => isCustomerListableJourney(row, "customer"))
      .map((row) => toPublicJourney(row, DEFAULT_SHARE_CONFIG));
    assert.equal(listed.length, 1);
    assert.equal(listed[0].departureTime, "16:00");
  });
});

describe("pilot booking and payment", () => {
  it("3. Customer can register interest as a provisional place", async () => {
    const db = new InMemoryShareDb();
    const journey = createPilotJourney(db, { travelDate: "2026-10-06", departureTime: "14:00", customerVisible: true });
    const result = await book(db, { action: "join", journeyId: journey.id, key: "pilot-reg-01", name: "A" });
    const booking = db.bookings.get(String(result.bookingId))!;
    assert.equal(booking.reservationStatus, "PROVISIONAL");
    assert.equal(booking.termsAcceptedAt != null, true);
    assert.equal(booking.termsVersion, "spires-share-pilot-2026-10");
  });

  it("4. Customer cannot access another reservation", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", key: "pilot-own-01", name: "A", uid: "uid_A" });
    const booking = db.bookings.get(String(first.bookingId))!;
    assert.equal(canCustomerAccessBooking(booking, { uid: "uid_A" }), true);
    assert.equal(canCustomerAccessBooking(booking, { uid: "uid_other" }), false);
  });

  it("5. Four registrations → READY_FOR_PAYMENT_SETUP", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-four-01", name: "A" });
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "READY_FOR_PAYMENT_SETUP");
  });

  it("6. Saving hosted payment link sends no payment email", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-link-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
    assert.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 0);
  });

  it("7. Opening payment window creates PAYMENT_PENDING", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-open-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    assert.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAYMENT_PENDING");
  });

  it("8. Customer can retrieve payment link only for their own eligible reservation", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-url-01", name: "A", uid: "uid_A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    const own = db.bookings.get(String(first.bookingId))!;
    const journey = db.journeys.get(String(first.journeyId))!;
    const link = hostedPaymentUrlForCustomer(journey, own);
    assert.equal(link?.url, "https://pay.example.com/ss-pilot");
    assert.equal(canCustomerAccessBooking(own, { uid: "uid_other" }), false);
    const view = toCustomerBookingView(journey, own, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.equal("url" in view, false);
    assert.equal("paymentLinkUrl" in view, false);
  });

  it("9. Customer returning from hosted payment DOES NOT become PAID", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-ret-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    recordPaymentSubmitted(db, String(first.bookingId), "2026-10-01T12:05:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    assert.equal(Boolean(booking.paymentSubmittedAt), true);
    assert.notEqual(booking.reservationStatus, "PAID");
    assert.equal(booking.reservationStatus, "PAYMENT_PENDING");
  });

  it("10. Admin Mark Paid works", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-paid-01", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "hashim@spires.com");
    assert.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAID");
  });

  it("11. Five paid passengers confirms exactly once", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-conf-a", name: "A" });
    const fifth = await book(db, { action: "join", journeyId: first.journeyId, key: "pilot-conf-b", name: "E" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    markReservationPaid(db, String(fifth.bookingId), "admin");
    const again = confirmHostedIfEligible(db, String(first.journeyId), "2026-10-01T12:20:00.000Z");
    assert.equal(again.alreadyConfirmed, true);
    assert.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 2);
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("12. Sixth passenger cannot register", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 5, key: "pilot-six-a", name: "A" });
    await assert.rejects(
      () => book(db, { action: "join", journeyId: first.journeyId, key: "pilot-six-b", name: "F" }),
      /No remaining places/
    );
    assert.ok((db.journeys.get(String(first.journeyId))?.occupiedSeats || 0) <= 5);
  });

  it("13. Four passenger fallback cannot activate automatically", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 4, key: "pilot-auto-4", name: "A" });
    const journey = db.journeys.get(String(first.journeyId))!;
    assert.equal(journey.status, "READY_FOR_PAYMENT_SETUP");
    assert.notEqual(journey.status, "FOUR_PASSENGER_OPTION");
  });

  it("14. All four must accept", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 2, key: "pilot-acc-a", name: "A" });
    const second = await book(db, { action: "join", journeyId: first.journeyId, passengers: 2, key: "pilot-acc-b", name: "B" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    markReservationPaid(db, String(second.bookingId), "admin");
    offerFourPassengerOption(db, String(first.journeyId));
    const one = acceptFourPassenger(db, String(first.bookingId), true);
    assert.equal(one.allAccepted, false);
    assert.notEqual(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("15. Supplements must all be verified before confirmation", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 2, key: "pilot-sup-a", name: "A" });
    const second = await book(db, { action: "join", journeyId: first.journeyId, passengers: 2, key: "pilot-sup-b", name: "B" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    markReservationPaid(db, String(second.bookingId), "admin");
    offerFourPassengerOption(db, String(first.journeyId));
    acceptFourPassenger(db, String(first.bookingId), true);
    acceptFourPassenger(db, String(second.bookingId), true);
    saveSupplementLink(db, String(first.journeyId), "https://pay.example.com/supplement");
    markSupplementPaid(db, String(first.bookingId), "admin");
    const halfway = confirmHostedIfEligible(db, String(first.journeyId));
    assert.equal(halfway.ok, false);
    markSupplementPaid(db, String(second.bookingId), "admin");
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("16. Late cancellation does not unconfirm a locked journey", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", passengers: 5, key: "pilot-late-a", name: "A" });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/ss");
    openPaymentWindow(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    const journey = db.journeys.get(String(first.journeyId))!;
    journey.departureAt = "2026-10-01T14:00:00.000Z";
    const result = cancelReservation(db, String(first.bookingId), "2026-10-01T13:00:00.000Z");
    assert.equal(result.category, "LATE_CANCELLATION");
    assert.equal(result.journeyStillConfirmed, true);
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    recordRefund(db, String(first.bookingId), {
      refundStatus: "RETAINED",
      amountRefundedPence: 0,
      amountRetainedPence: 17500,
      adminNotes: "Pilot late cancellation, retention recorded by admin",
    });
    assert.equal(db.bookings.get(String(first.bookingId))?.refundStatus, "RETAINED");
  });

  it("17-18. Public and customer DTO contain no passenger PII and no hosted payment URL", async () => {
    const db = new InMemoryShareDb();
    const first = await book(db, { action: "propose", key: "pilot-pii-a", name: "Ahmed" });
    await book(db, { action: "join", journeyId: first.journeyId, key: "pilot-pii-b", name: "Sarah" });
    savePaymentLink(db, String(first.journeyId), "https://secret-pay.example/hosted");
    const journey = db.journeys.get(String(first.journeyId))!;
    const pub = toPublicJourney(journey, DEFAULT_SHARE_CONFIG);
    const blob = JSON.stringify(pub);
    assert.equal(blob.includes("Ahmed"), false);
    assert.equal(blob.includes("Sarah"), false);
    assert.equal(blob.includes("sarah@example.com"), false);
    assert.equal(blob.includes("https://secret-pay.example/hosted"), false);
    assert.equal("paymentLinkUrl" in pub, false);
    const own = [...db.bookings.values()].find((row) => row.name === "Ahmed")!;
    const view = toCustomerBookingView(journey, own, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    const viewBlob = JSON.stringify(view);
    assert.equal(viewBlob.includes("Sarah"), false);
    assert.equal(viewBlob.includes("https://secret-pay.example/hosted"), false);
    const stripped = stripPrivateFields({ ...journey, paymentLinkUrl: "https://secret-pay.example/hosted" } as unknown as Record<string, unknown>);
    assert.equal(stripped.paymentLinkUrl, undefined);
  });
});

describe("pilot sitemap and email defaults", () => {
  it("20. Public Share pages are sitemap eligible; Share emails stay off by default", () => {
    const websiteRoot = path.resolve(__dirname, "../../../spires-website");
    const generator = fs.readFileSync(path.join(websiteRoot, "scripts/generate-sitemap.mjs"), "utf8");
    const shareHtml = fs.readFileSync(path.join(websiteRoot, "share.html"), "utf8");
    const robots = fs.readFileSync(path.join(websiteRoot, "robots.txt"), "utf8");
    assert.doesNotMatch(generator, /locPath === '\/share'/);
    assert.match(generator, /path\.join\(root, 'share'\)/);
    assert.match(shareHtml, /<meta name="robots" content="index, follow">/);
    assert.match(shareHtml, /rel="canonical" href="https:\/\/www\.spires-taxis\.com\/share"/);
    assert.doesNotMatch(shareHtml, /noindex/);
    assert.doesNotMatch(robots, /^Disallow:\s*\/share\s*$/m);
    assert.match(robots, /Disallow: \/share-terms/);
    assert.equal(shareNotificationsEnabled({ ...DEFAULT_SHARE_CONFIG, notificationsSend: false }), false);
    assert.equal(shareNotificationsEnabled({ ...DEFAULT_SHARE_CONFIG, notificationsSend: true }), false);
  });
});
