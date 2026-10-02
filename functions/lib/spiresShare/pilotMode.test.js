"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_fs_1 = __importDefault(require("node:fs"));
const node_path_1 = __importDefault(require("node:path"));
const node_test_1 = require("node:test");
const access_1 = require("./access");
const bookingFlow_1 = require("./bookingFlow");
const defaults_1 = require("./defaults");
const hostedPayment_1 = require("./hostedPayment");
const logic_1 = require("./logic");
const notifications_1 = require("./notifications");
const paymentProvider_1 = require("./paymentProvider");
function contact(name, uid = `uid_${name}`) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        flexibility: "plus_minus_30",
        dropoffTerminal: "T3",
        uid,
    };
}
async function book(db, opts) {
    return (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
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
(0, node_test_1.describe)("pilot mode access", () => {
    (0, node_test_1.it)("1. Pilot disabled → ordinary customer cannot access Share", () => {
        const flags = (0, access_1.shareFlagsFromEnv)({ SPIRES_SHARE_ENABLED: "false", SPIRES_SHARE_PILOT: "true" });
        strict_1.default.equal((0, access_1.customerShareAccessAllowed)({ flags, authenticated: true, isAdmin: false, isPreviewTester: false }), false);
        strict_1.default.equal((0, access_1.publicSharePageAllowed)(flags), false);
        strict_1.default.equal(defaults_1.SPIRES_SHARE_PUBLIC_ENABLED, false);
        strict_1.default.equal(defaults_1.SPIRES_SHARE_PILOT_ENABLED, false);
    });
    (0, node_test_1.it)("2. Pilot enabled → authenticated customer can view available journeys", () => {
        const flags = { enabled: true, pilot: true, publicEnabled: false };
        strict_1.default.equal((0, access_1.sharePilotActive)(flags), true);
        strict_1.default.equal((0, access_1.customerShareAccessAllowed)({ flags, authenticated: true, isAdmin: false, isPreviewTester: false }), true);
        const db = new bookingFlow_1.InMemoryShareDb();
        const hidden = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-06", departureTime: "14:00" });
        const shown = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-06", departureTime: "16:00" });
        (0, bookingFlow_1.publishPilotJourney)(db, shown.id, true);
        strict_1.default.equal((0, access_1.isCustomerListableJourney)(hidden, "customer"), false);
        strict_1.default.equal((0, access_1.isCustomerListableJourney)(shown, "customer"), true);
        const listed = [...db.journeys.values()]
            .filter((row) => (0, access_1.isCustomerListableJourney)(row, "customer"))
            .map((row) => (0, logic_1.toPublicJourney)(row, defaults_1.DEFAULT_SHARE_CONFIG));
        strict_1.default.equal(listed.length, 1);
        strict_1.default.equal(listed[0].departureTime, "16:00");
    });
});
(0, node_test_1.describe)("pilot booking and payment", () => {
    (0, node_test_1.it)("3. Customer can register interest as a provisional place", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const journey = (0, bookingFlow_1.createPilotJourney)(db, { travelDate: "2026-10-06", departureTime: "14:00", customerVisible: true });
        const result = await book(db, { action: "join", journeyId: journey.id, key: "pilot-reg-01", name: "A" });
        const booking = db.bookings.get(String(result.bookingId));
        strict_1.default.equal(booking.reservationStatus, "PROVISIONAL");
        strict_1.default.equal(booking.termsAcceptedAt != null, true);
        strict_1.default.equal(booking.termsVersion, "share-heathrow-mvp-2026-09-28");
    });
    (0, node_test_1.it)("4. Customer cannot access another reservation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", key: "pilot-own-01", name: "A", uid: "uid_A" });
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(booking, { uid: "uid_A" }), true);
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(booking, { uid: "uid_other" }), false);
    });
    (0, node_test_1.it)("5. Four registrations → READY_FOR_PAYMENT_SETUP", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-four-01", name: "A" });
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "READY_FOR_PAYMENT_SETUP");
    });
    (0, node_test_1.it)("6. Saving hosted payment link sends no payment email", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-link-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
        strict_1.default.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 0);
    });
    (0, node_test_1.it)("7. Opening payment window creates PAYMENT_PENDING", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-open-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        strict_1.default.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAYMENT_PENDING");
    });
    (0, node_test_1.it)("8. Customer can retrieve payment link only for their own eligible reservation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-url-01", name: "A", uid: "uid_A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        const own = db.bookings.get(String(first.bookingId));
        const journey = db.journeys.get(String(first.journeyId));
        const link = (0, hostedPayment_1.hostedPaymentUrlForCustomer)(journey, own);
        strict_1.default.equal(link?.url, "https://pay.example.com/ss-pilot");
        strict_1.default.equal((0, hostedPayment_1.canCustomerAccessBooking)(own, { uid: "uid_other" }), false);
        const view = (0, hostedPayment_1.toCustomerBookingView)(journey, own, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal("url" in view, false);
        strict_1.default.equal("paymentLinkUrl" in view, false);
    });
    (0, node_test_1.it)("9. Customer returning from hosted payment DOES NOT become PAID", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-ret-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        (0, bookingFlow_1.recordPaymentSubmitted)(db, String(first.bookingId), "2026-10-01T12:05:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        strict_1.default.equal(Boolean(booking.paymentSubmittedAt), true);
        strict_1.default.notEqual(booking.reservationStatus, "PAID");
        strict_1.default.equal(booking.reservationStatus, "PAYMENT_PENDING");
    });
    (0, node_test_1.it)("10. Admin Mark Paid works", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-paid-01", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss-pilot");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "hashim@spires.com");
        strict_1.default.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAID");
    });
    (0, node_test_1.it)("11. Five paid passengers confirms exactly once", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-conf-a", name: "A" });
        const fifth = await book(db, { action: "join", journeyId: first.journeyId, key: "pilot-conf-b", name: "E" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.markReservationPaid)(db, String(fifth.bookingId), "admin");
        const again = (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId), "2026-10-01T12:20:00.000Z");
        strict_1.default.equal(again.alreadyConfirmed, true);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 2);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("12. Sixth passenger cannot register", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 5, key: "pilot-six-a", name: "A" });
        await strict_1.default.rejects(() => book(db, { action: "join", journeyId: first.journeyId, key: "pilot-six-b", name: "F" }), /No remaining places/);
        strict_1.default.ok((db.journeys.get(String(first.journeyId))?.occupiedSeats || 0) <= 5);
    });
    (0, node_test_1.it)("13. Four passenger fallback cannot activate automatically", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 4, key: "pilot-auto-4", name: "A" });
        const journey = db.journeys.get(String(first.journeyId));
        strict_1.default.equal(journey.status, "READY_FOR_PAYMENT_SETUP");
        strict_1.default.notEqual(journey.status, "FOUR_PASSENGER_OPTION");
    });
    (0, node_test_1.it)("14. All four must accept", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 2, key: "pilot-acc-a", name: "A" });
        const second = await book(db, { action: "join", journeyId: first.journeyId, passengers: 2, key: "pilot-acc-b", name: "B" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.markReservationPaid)(db, String(second.bookingId), "admin");
        (0, bookingFlow_1.offerFourPassengerOption)(db, String(first.journeyId));
        const one = (0, bookingFlow_1.acceptFourPassenger)(db, String(first.bookingId), true);
        strict_1.default.equal(one.allAccepted, false);
        strict_1.default.notEqual(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("15. Supplements must all be verified before confirmation", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 2, key: "pilot-sup-a", name: "A" });
        const second = await book(db, { action: "join", journeyId: first.journeyId, passengers: 2, key: "pilot-sup-b", name: "B" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.markReservationPaid)(db, String(second.bookingId), "admin");
        (0, bookingFlow_1.offerFourPassengerOption)(db, String(first.journeyId));
        (0, bookingFlow_1.acceptFourPassenger)(db, String(first.bookingId), true);
        (0, bookingFlow_1.acceptFourPassenger)(db, String(second.bookingId), true);
        (0, bookingFlow_1.saveSupplementLink)(db, String(first.journeyId), "https://pay.example.com/supplement");
        (0, bookingFlow_1.markSupplementPaid)(db, String(first.bookingId), "admin");
        const halfway = (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId));
        strict_1.default.equal(halfway.ok, false);
        (0, bookingFlow_1.markSupplementPaid)(db, String(second.bookingId), "admin");
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("16. Late cancellation does not unconfirm a locked journey", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", passengers: 5, key: "pilot-late-a", name: "A" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/ss");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-01T12:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        const journey = db.journeys.get(String(first.journeyId));
        journey.departureAt = "2026-10-01T14:00:00.000Z";
        const result = (0, bookingFlow_1.cancelReservation)(db, String(first.bookingId), "2026-10-01T13:00:00.000Z");
        strict_1.default.equal(result.category, "LATE_CANCELLATION");
        strict_1.default.equal(result.journeyStillConfirmed, true);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
        (0, bookingFlow_1.recordRefund)(db, String(first.bookingId), {
            refundStatus: "RETAINED",
            amountRefundedPence: 0,
            amountRetainedPence: 17500,
            adminNotes: "Pilot late cancellation, retention recorded by admin",
        });
        strict_1.default.equal(db.bookings.get(String(first.bookingId))?.refundStatus, "RETAINED");
    });
    (0, node_test_1.it)("17-18. Public and customer DTO contain no passenger PII and no hosted payment URL", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await book(db, { action: "propose", key: "pilot-pii-a", name: "Ahmed" });
        await book(db, { action: "join", journeyId: first.journeyId, key: "pilot-pii-b", name: "Sarah" });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://secret-pay.example/hosted");
        const journey = db.journeys.get(String(first.journeyId));
        const pub = (0, logic_1.toPublicJourney)(journey, defaults_1.DEFAULT_SHARE_CONFIG);
        const blob = JSON.stringify(pub);
        strict_1.default.equal(blob.includes("Ahmed"), false);
        strict_1.default.equal(blob.includes("Sarah"), false);
        strict_1.default.equal(blob.includes("sarah@example.com"), false);
        strict_1.default.equal(blob.includes("https://secret-pay.example/hosted"), false);
        strict_1.default.equal("paymentLinkUrl" in pub, false);
        const own = [...db.bookings.values()].find((row) => row.name === "Ahmed");
        const view = (0, hostedPayment_1.toCustomerBookingView)(journey, own, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        const viewBlob = JSON.stringify(view);
        strict_1.default.equal(viewBlob.includes("Sarah"), false);
        strict_1.default.equal(viewBlob.includes("https://secret-pay.example/hosted"), false);
        const stripped = (0, logic_1.stripPrivateFields)({ ...journey, paymentLinkUrl: "https://secret-pay.example/hosted" });
        strict_1.default.equal(stripped.paymentLinkUrl, undefined);
    });
});
(0, node_test_1.describe)("pilot sitemap and email defaults", () => {
    (0, node_test_1.it)("20. Pilot journey cannot accidentally become publicly indexed through sitemap generation", () => {
        const websiteRoot = node_path_1.default.resolve(__dirname, "../../../spires-website");
        const generator = node_fs_1.default.readFileSync(node_path_1.default.join(websiteRoot, "scripts/generate-sitemap.mjs"), "utf8");
        const shareHtml = node_fs_1.default.readFileSync(node_path_1.default.join(websiteRoot, "share.html"), "utf8");
        const robots = node_fs_1.default.readFileSync(node_path_1.default.join(websiteRoot, "robots.txt"), "utf8");
        strict_1.default.match(generator, /'share\.html'/);
        strict_1.default.match(generator, /locPath === '\/share'/);
        strict_1.default.match(shareHtml, /noindex/);
        strict_1.default.match(robots, /Disallow: \/share/);
        strict_1.default.equal((0, notifications_1.shareNotificationsEnabled)({ ...defaults_1.DEFAULT_SHARE_CONFIG, notificationsSend: false }), false);
        strict_1.default.equal((0, notifications_1.shareNotificationsEnabled)({ ...defaults_1.DEFAULT_SHARE_CONFIG, notificationsSend: true }), false);
    });
});
