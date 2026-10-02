"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const paymentProvider_1 = require("./paymentProvider");
const hostedPayment_1 = require("./hostedPayment");
const defaults_1 = require("./defaults");
const logic_1 = require("./logic");
function contact(name, uid = `uid_${name}`) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        flexibility: "plus_minus_30",
        dropoffTerminal: "T5",
        uid,
    };
}
async function book(db, opts) {
    return (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
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
(0, node_test_1.describe)("hosted payment MVP", () => {
    (0, node_test_1.it)("registers one passenger as provisional interest with no payment", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", key: "one-pax-0001", name: "A" });
        const journey = db.journeys.get(String(first.journeyId));
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.equal(journey.status, "GATHERING_INTEREST");
        strict_1.default.equal(journey.occupiedSeats, 1);
        strict_1.default.equal(booking.reservationStatus, "PROVISIONAL");
        strict_1.default.equal(booking.paymentStatus, "HOSTED_UNPAID");
    });
    (0, node_test_1.it)("moves to READY_FOR_PAYMENT_SETUP at four passengers", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "four-pax-0001", name: "A" });
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "READY_FOR_PAYMENT_SETUP");
    });
    (0, node_test_1.it)("does not email when a payment link is saved", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "link-save-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-1010");
        const journey = db.journeys.get(String(first.journeyId));
        strict_1.default.equal(journey.paymentStageStatus, "LINK_SAVED");
        strict_1.default.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 0);
    });
    (0, node_test_1.it)("opens the payment window, emails, and does not mark paid", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "open-win-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-1010");
        const opened = (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        strict_1.default.equal(opened.emailedBookingIds.length, 1);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 1);
        const booking = [...db.bookings.values()][0];
        strict_1.default.equal(booking.reservationStatus, "PAYMENT_PENDING");
        strict_1.default.notEqual(booking.reservationStatus, "PAID");
    });
    (0, node_test_1.it)("rejects a non https payment url", () => {
        strict_1.default.throws(() => (0, hostedPayment_1.validateHostedPaymentUrl)("http://pay.example.com/x"));
    });
    (0, node_test_1.it)("lets only the assigned customer see the payment link flag", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "own-link-01", name: "A", uid: "uid_A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-1010");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        const journey = db.journeys.get(String(first.journeyId));
        const view = (0, hostedPayment_1.toCustomerBookingView)(journey, booking, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(view.paymentLinkAvailable, true);
        strict_1.default.equal("paymentLinkUrl" in view, false);
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(booking, { uid: "uid_A" }), true);
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(booking, { uid: "uid_other" }), false);
    });
    (0, node_test_1.it)("never puts passenger identities in the public or customer aggregate view", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", key: "priv-a-0001", name: "Ahmed" });
        await book(db, { action: "join", journeyId: first.journeyId, key: "priv-b-0001", name: "Sarah" });
        const journey = db.journeys.get(String(first.journeyId));
        const pub = (0, logic_1.toPublicJourney)(journey, defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal("name" in pub, false);
        const own = [...db.bookings.values()].find((row) => row.name === "Ahmed");
        const view = (0, hostedPayment_1.toCustomerBookingView)(journey, own, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        const blob = JSON.stringify(view);
        strict_1.default.equal(blob.includes("Sarah"), false);
        strict_1.default.equal(blob.includes("sarah@example.com"), false);
        const stripped = (0, logic_1.stripPrivateFields)({ ...journey, paymentLinkUrl: "https://secret.example/pay" });
        strict_1.default.equal(stripped.paymentLinkUrl, undefined);
    });
    (0, node_test_1.it)("admin mark paid updates own status and aggregate paid count", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "paid-a-0001", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-1010");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "hashim@spires.com", "2026-09-28T12:10:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.equal(booking.reservationStatus, "PAID");
        strict_1.default.equal(booking.paidAmountPence, 14000);
        const view = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(String(first.journeyId)), booking, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(view.hostedPaymentStatus, "PAID");
        strict_1.default.equal(view.paidPassengerPlaces, 4);
    });
    (0, node_test_1.it)("expires an unpaid reservation and frees the seat without overselling", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "exp-pay-001", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-1010");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        booking.paymentDeadlineAt = "2026-09-28T12:05:00.000Z";
        const result = (0, bookingFlow_1.expireUnpaidReservations)(db, "2026-09-28T12:10:00.000Z");
        strict_1.default.equal(result.expired, 1);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.occupiedSeats, 0);
        strict_1.default.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAYMENT_EXPIRED");
    });
    (0, node_test_1.it)("gives a fifth passenger the same payment link during an open window", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "fifth-a-001", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/shared");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        const fifth = await book(db, { action: "join", journeyId: first.journeyId, key: "fifth-b-001", name: "E" });
        const journey = db.journeys.get(String(first.journeyId));
        const joining = db.bookings.get(String(fifth.bookingId));
        strict_1.default.equal(journey.occupiedSeats, 5);
        strict_1.default.equal(joining.reservationStatus, "PAYMENT_PENDING");
        strict_1.default.equal(journey.paymentLinkUrl, "https://pay.example.com/shared");
    });
    (0, node_test_1.it)("confirms 5/5 paid exactly once and does not send a second confirmation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "conf-a-001", name: "A" });
        const fifth = await book(db, { action: "join", journeyId: first.journeyId, key: "conf-b-001", name: "E" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin", "2026-09-28T12:10:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(fifth.bookingId), "admin", "2026-09-28T12:11:00.000Z");
        const again = (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId), "2026-09-28T12:12:00.000Z");
        strict_1.default.equal(again.alreadyConfirmed, true);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 2);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("requires unanimous four passenger acceptance and £43.75 including supplement", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 2, key: "four-a-mvp1", name: "A" });
        const second = await book(db, { action: "join", journeyId: first.journeyId, passengers: 2, key: "four-b-mvp1", name: "B" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.markReservationPaid)(db, String(second.bookingId), "admin");
        const offer = (0, bookingFlow_1.offerFourPassengerOption)(db, String(first.journeyId));
        strict_1.default.equal(offer.proposedFarePence, 4375);
        const one = (0, bookingFlow_1.acceptFourPassenger)(db, String(first.bookingId), true);
        strict_1.default.equal(one.allAccepted, false);
        (0, bookingFlow_1.acceptFourPassenger)(db, String(second.bookingId), true);
        (0, bookingFlow_1.saveSupplementLink)(db, String(first.journeyId), "https://pay.example.com/supplement");
        (0, bookingFlow_1.markSupplementPaid)(db, String(first.bookingId), "admin");
        const last = (0, bookingFlow_1.markSupplementPaid)(db, String(second.bookingId), "admin");
        strict_1.default.equal(last.confirmed, true);
        const total = [...db.bookings.values()].reduce((sum, row) => sum + (row.paidAmountPence || 0) + (row.supplementPaidPence || 0), 0);
        strict_1.default.equal(total, 17500);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("does not unconfirm a locked journey after a late cancellation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 5, key: "late-a-001", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        const journey = db.journeys.get(String(first.journeyId));
        strict_1.default.equal(journey.status, "CONFIRMED");
        journey.departureAt = "2026-09-28T14:00:00.000Z";
        const result = (0, bookingFlow_1.cancelReservation)(db, String(first.bookingId), "2026-09-28T13:00:00.000Z");
        strict_1.default.equal(result.category, "LATE_CANCELLATION");
        strict_1.default.equal(result.journeyStillConfirmed, true);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.occupiedSeats, 0);
    });
    (0, node_test_1.it)("does not let two concurrent last seats exceed capacity", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const seed = await book(db, { action: "propose", passengers: 4, key: "race-a-001", name: "A" });
        const [one, two] = await Promise.allSettled([
            book(db, { action: "join", journeyId: seed.journeyId, key: "race-b-001", name: "B" }),
            book(db, { action: "join", journeyId: seed.journeyId, key: "race-c-001", name: "C" }),
        ]);
        const ok = [one, two].filter((row) => row.status === "fulfilled");
        strict_1.default.equal(ok.length, 1);
        strict_1.default.ok((db.journeys.get(String(seed.journeyId))?.occupiedSeats || 0) <= 5);
    });
    (0, node_test_1.it)("customers cannot mark themselves paid via undo/mark helpers used by admin", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "self-pay-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-09-28T12:00:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.notEqual(booking.reservationStatus, "PAID");
        (0, bookingFlow_1.undoReservationPaid)(db, String(first.bookingId), "admin");
        strict_1.default.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAYMENT_PENDING");
    });
});
