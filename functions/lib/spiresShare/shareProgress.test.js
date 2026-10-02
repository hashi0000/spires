"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const defaults_1 = require("./defaults");
const hostedPayment_1 = require("./hostedPayment");
const interestGroups_1 = require("./interestGroups");
const paymentDeadline_1 = require("./paymentDeadline");
const notifications_1 = require("./notifications");
const shareProgress_1 = require("./shareProgress");
const terminalGuide_1 = require("./terminalGuide");
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
        travelDate: "2026-10-12",
        preferredDepartureTime: "14:00",
        journeyId: opts.journeyId,
        passengers: opts.passengers || 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: contact(opts.name, opts.uid),
        idempotencyKey: opts.key,
        termsAccepted: true,
    });
}
function interestInput(name, seats, uid, extras = {}) {
    return {
        origin: "Oxford",
        destinationRegion: "Heathrow",
        travelDate: "2026-10-12",
        preferredDepartureTime: "14:00",
        flexibility: "plus_minus_30",
        passengers: seats,
        name,
        email: `${name.toLowerCase()}@example.com`,
        uid,
        termsAccepted: true,
        dropoffTerminal: "T3",
        departureTerminal: "T3",
        nowIso: "2026-10-01T10:00:00.000Z",
        ...extras,
    };
}
function configWithFive() {
    return {
        ...defaults_1.DEFAULT_SHARE_CONFIG,
        airports: [...defaults_1.DEFAULT_SHARE_CONFIG.airports],
        passengerCapacity: 5,
        interestRegistrationHours: 48,
        paymentReminderMinutesBeforeDeadline: 30,
        paymentFinalReminderMinutesBeforeDeadline: 10,
        pilotDefaults: { ...defaults_1.DEFAULT_SHARE_CONFIG.pilotDefaults, minPassengerThreshold: 5, capacity: 5 },
    };
}
(0, node_test_1.describe)("Spires Share payment guarantee, countdowns and notifications", () => {
    (0, node_test_1.it)("1. 3/5 shows 2 passengers needed", () => {
        const progress = (0, shareProgress_1.seatProgress)(3, 5);
        strict_1.default.equal(progress.remaining, 2);
        strict_1.default.equal(progress.neededLabel, "2 more passengers needed");
        strict_1.default.equal(progress.enough, false);
    });
    (0, node_test_1.it)("2. 4/5 shows 1 passenger needed", () => {
        const progress = (0, shareProgress_1.seatProgress)(4, 5);
        strict_1.default.equal(progress.remaining, 1);
        strict_1.default.equal(progress.neededHeadline, "1 MORE PASSENGER NEEDED");
    });
    (0, node_test_1.it)("3. 5/5 says enough interest but NOT confirmed", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        for (let i = 1; i <= 5; i += 1) {
            (0, bookingFlow_1.expressInterest)(db, interestInput(`P${i}`, 1, `uid-${i}`, { nowIso: "2026-10-01T10:00:00.000Z" }));
        }
        const group = [...db.interestGroups.values()][0];
        const progress = (0, shareProgress_1.seatProgress)(group.interestedSeatCount, 5);
        strict_1.default.equal(progress.enough, true);
        strict_1.default.match(progress.neededHeadline, /ENOUGH INTEREST RECEIVED/);
        strict_1.default.notEqual(group.status, "CONVERTED_TO_JOURNEY");
        strict_1.default.equal(db.journeys.size, 0);
    });
    (0, node_test_1.it)("4. Interest countdown uses stored deadline", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const { group } = (0, bookingFlow_1.expressInterest)(db, interestInput("Ann", 1, "uid-ann"));
        strict_1.default.ok(group.interestDeadlineAt);
        const first = (0, shareProgress_1.formatCountdown)(group.interestDeadlineAt, "2026-10-01T10:00:00.000Z");
        strict_1.default.equal(first.expired, false);
        strict_1.default.ok(first.remainingMs > 0);
    });
    (0, node_test_1.it)("5. Refresh does not reset countdown", () => {
        const stored = "2026-10-03T10:00:00.000Z";
        const first = (0, shareProgress_1.formatCountdown)(stored, "2026-10-01T10:00:00.000Z");
        const afterRefresh = (0, shareProgress_1.formatCountdown)(stored, "2026-10-02T10:00:00.000Z");
        strict_1.default.ok(afterRefresh.remainingMs < first.remainingMs);
        strict_1.default.equal(afterRefresh.remainingMs, 24 * 60 * 60 * 1000);
    });
    (0, node_test_1.it)("6. Expired insufficient interest cannot proceed to payment normally", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const { group } = (0, bookingFlow_1.expressInterest)(db, interestInput("Ann", 2, "uid-ann"));
        group.interestDeadlineAt = "2026-10-01T11:00:00.000Z";
        (0, bookingFlow_1.expireInsufficientInterest)(db, "2026-10-01T12:00:00.000Z");
        strict_1.default.equal(group.status, "EXPIRED");
        strict_1.default.throws(() => (0, bookingFlow_1.proposeJourneyFromInterest)(db, group.id, {
            departureLocation: "Thornhill Park & Ride",
            departureTime: "14:00",
        }), /expired without enough passengers/);
    });
    (0, node_test_1.it)("7. Threshold sends admin email once", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        for (let i = 1; i <= 5; i += 1) {
            (0, bookingFlow_1.expressInterest)(db, interestInput(`P${i}`, 1, `uid-${i}`));
        }
        const ready = db.notifications.filter((row) => row.type === "ADMIN_THRESHOLD_REACHED");
        strict_1.default.equal(ready.length, 1);
        (0, bookingFlow_1.expressInterest)(db, interestInput("P1", 1, "uid-1"));
        strict_1.default.equal(db.notifications.filter((row) => row.type === "ADMIN_THRESHOLD_REACHED").length, 1);
    });
    (0, node_test_1.it)("8. Admin can open payment window", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "open-win-1", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        const opened = (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        strict_1.default.ok(opened.deadlineAt);
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.paymentStageStatus, "OPEN");
    });
    (0, node_test_1.it)("9. Opening payment window sends eligible customer payment emails", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "pay-mail-1", name: "Ann", passengers: 4 });
        await book(db, { action: "join", key: "pay-mail-2", name: "Ben", passengers: 1, journeyId: first.journeyId });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        const opened = (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        strict_1.default.equal(opened.emailedBookingIds.length, 2);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 2);
    });
    (0, node_test_1.it)("10. Payment countdown uses stored deadline", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "pay-cd-1", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        const opened = (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        const later = (0, shareProgress_1.formatCountdown)(opened.deadlineAt, "2026-10-10T10:30:00.000Z");
        const stored = db.journeys.get(String(first.journeyId))?.paymentDeadlineAt;
        strict_1.default.equal(stored, opened.deadlineAt);
        strict_1.default.equal(later.expired, false);
    });
    (0, node_test_1.it)("11. Customer payment does not confirm journey individually", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "one-pay-1", name: "Ann", passengers: 2 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        const paid = (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        strict_1.default.equal(paid.confirmed, false);
        strict_1.default.notEqual(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("12. 4/5 paid remains unconfirmed", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const ids = [];
        const first = await book(db, { action: "propose", key: "four-pay-a", name: "A", passengers: 1 });
        ids.push(String(first.bookingId));
        for (const name of ["B", "C", "D", "E"]) {
            const row = await book(db, { action: "join", journeyId: first.journeyId, key: `four-pay-${name}`, name, passengers: 1 });
            ids.push(String(row.bookingId));
        }
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        ids.slice(0, 4).forEach((id) => (0, bookingFlow_1.markReservationPaid)(db, id, "admin"));
        const journey = db.journeys.get(String(first.journeyId));
        const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journey.id);
        const guard = (0, shareProgress_1.confirmationGuard)(bookings, journey, db.config);
        strict_1.default.equal(guard.ok, false);
        strict_1.default.equal(guard.verifiedRequiredSeats, 4);
        strict_1.default.notEqual(journey.status, "CONFIRMED");
    });
    (0, node_test_1.it)("13. 5/5 paid but unverified does not confirm if verification is required", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "unverified-1", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        booking.paymentSubmittedAt = "2026-10-10T10:05:00.000Z";
        const journey = db.journeys.get(String(first.journeyId));
        const guard = (0, shareProgress_1.confirmationGuard)([...db.bookings.values()], journey, db.config);
        strict_1.default.equal(guard.ok, false);
        strict_1.default.equal(guard.verifiedRequiredSeats, 0);
        strict_1.default.notEqual((0, bookingFlow_1.confirmHostedIfEligible)(db, journey.id).status, "CONFIRMED");
    });
    (0, node_test_1.it)("14. All required verified payments confirms once", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "all-pay-1", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
        const again = (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId));
        strict_1.default.equal(again.alreadyConfirmed, true);
    });
    (0, node_test_1.it)("15. Confirmed journey sends confirmation emails once", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "conf-mail-1", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId));
        strict_1.default.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 1);
    });
    (0, node_test_1.it)("16. Public payment progress contains no identities", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        (0, bookingFlow_1.expressInterest)(db, interestInput("Secret Name", 2, "uid-secret"));
        const pub = (0, bookingFlow_1.listPublicInterestGroups)(db)[0];
        strict_1.default.equal((0, interestGroups_1.publicInterestHasPrivateData)(pub), false);
        strict_1.default.equal(JSON.stringify(pub).includes("Secret Name"), false);
    });
    (0, node_test_1.it)("17. Customer can only see own payment status plus aggregates", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "priv-a", name: "Ann", passengers: 4 });
        const second = await book(db, { action: "join", key: "priv-b", name: "Ben", passengers: 1, journeyId: first.journeyId });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(second.bookingId), "admin");
        const journey = db.journeys.get(String(first.journeyId));
        const view = (0, hostedPayment_1.toCustomerBookingView)(journey, db.bookings.get(String(first.bookingId)), [...db.bookings.values()], db.config);
        const json = JSON.stringify(view);
        strict_1.default.equal(json.includes("Ben"), false);
        strict_1.default.equal(json.includes("ben@example.com"), false);
        strict_1.default.equal(view.paymentsReceived, 1);
        strict_1.default.equal(view.ownPaymentReceived, false);
    });
    (0, node_test_1.it)("18. Paid customer does not receive unpaid reminder", () => {
        strict_1.default.equal((0, shareProgress_1.reminderDue)("2026-10-10T12:00:00.000Z", "2026-10-10T11:40:00.000Z", 30, "already"), false);
    });
    (0, node_test_1.it)("19. Unpaid customer receives appropriate reminder", () => {
        strict_1.default.equal((0, shareProgress_1.reminderDue)("2026-10-10T12:00:00.000Z", "2026-10-10T11:40:00.000Z", 30), true);
        const mail = (0, notifications_1.buildNotification)("PAYMENT_DEADLINE_APPROACHING", "unpaid@example.com", null, { amountPence: 3500 });
        strict_1.default.match(mail.subject, /deadline/i);
    });
    (0, node_test_1.it)("20. Interest expiry sends correct customer notification", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const { group } = (0, bookingFlow_1.expressInterest)(db, interestInput("Ann", 1, "uid-ann"));
        group.interestDeadlineAt = "2026-10-01T11:00:00.000Z";
        (0, bookingFlow_1.expireInsufficientInterest)(db, "2026-10-01T12:00:00.000Z");
        const mail = db.notifications.filter((row) => row.type === "INTEREST_EXPIRED" && row.email === "ann@example.com");
        strict_1.default.equal(mail.length, 1);
        const copy = (0, notifications_1.buildNotification)("INTEREST_EXPIRED", "ann@example.com", null);
        strict_1.default.match(copy.text, /No payment was taken/);
    });
    (0, node_test_1.it)("21. Payment expiry without all payments does not confirm", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "exp-nc-1", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        const booking = db.bookings.get(String(first.bookingId));
        booking.paymentDeadlineAt = "2026-10-10T10:05:00.000Z";
        (0, bookingFlow_1.expireUnpaidReservations)(db, "2026-10-10T10:10:00.000Z");
        strict_1.default.notEqual(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    });
    (0, node_test_1.it)("22. Admin receives payment failure/expiry alert", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "exp-admin-a", name: "Ann", passengers: 4 });
        const second = await book(db, { action: "join", key: "exp-admin-b", name: "Ben", passengers: 1, journeyId: first.journeyId });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        const unpaid = db.bookings.get(String(second.bookingId));
        unpaid.paymentDeadlineAt = "2026-10-10T10:05:00.000Z";
        (0, bookingFlow_1.expireUnpaidReservations)(db, "2026-10-10T10:10:00.000Z");
        strict_1.default.equal(db.notifications.filter((row) => row.type === "ADMIN_PAYMENT_WINDOW_EXPIRED").length, 1);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "PAYMENT_WINDOW_EXPIRED_CUSTOMER").length, 1);
    });
    (0, node_test_1.it)("23. Two seats from one customer count as two seats where appropriate", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const { group, entry } = (0, bookingFlow_1.expressInterest)(db, interestInput("Ann", 2, "uid-ann"));
        strict_1.default.equal(entry.passengers, 2);
        strict_1.default.equal(group.interestedSeatCount, 2);
        const admin = db.notifications.find((row) => row.type === "ADMIN_NEW_INTEREST");
        strict_1.default.equal(admin?.seatsRequested, 2);
    });
    (0, node_test_1.it)("24. Admin interest email is not duplicated on retry", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = (0, bookingFlow_1.expressInterest)(db, interestInput("Ann", 1, "uid-ann"));
        const retry = (0, bookingFlow_1.expressInterest)(db, interestInput("Ann", 1, "uid-ann"));
        strict_1.default.equal(retry.joinedExisting, true);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "ADMIN_NEW_INTEREST").length, 1);
        (0, shareProgress_1.recordShareNotification)(db.notifications, {
            type: "ADMIN_NEW_INTEREST",
            deduplicationKey: `ADMIN_NEW_INTEREST:${first.entry.id}`,
        });
        strict_1.default.equal(db.notifications.filter((row) => row.type === "ADMIN_NEW_INTEREST").length, 1);
    });
    (0, node_test_1.it)("25. Threshold email is not duplicated", () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        for (let i = 1; i <= 5; i += 1)
            (0, bookingFlow_1.expressInterest)(db, interestInput(`P${i}`, 1, `uid-${i}`));
        const group = [...db.interestGroups.values()][0];
        (0, shareProgress_1.recordShareNotification)(db.notifications, {
            type: "ADMIN_THRESHOLD_REACHED",
            deduplicationKey: `ADMIN_THRESHOLD_REACHED:${group.id}`,
        });
        strict_1.default.equal(db.notifications.filter((row) => row.type === "ADMIN_THRESHOLD_REACHED").length, 1);
    });
    (0, node_test_1.it)("26. Confirmation email is not duplicated", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "dup-conf", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId));
        (0, bookingFlow_1.confirmHostedIfEligible)(db, String(first.journeyId));
        strict_1.default.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 1);
    });
    (0, node_test_1.it)("27. Existing waitlist logic still works", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "wl-full", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.addWaitlist)(db, String(first.journeyId), { ...contact("Wait"), passengers: 1, termsAccepted: true });
        (0, bookingFlow_1.cancelReservation)(db, String(first.bookingId), "2026-10-10T10:00:00.000Z");
        const offer = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
        strict_1.default.ok(offer);
        const claimed = await (0, bookingFlow_1.claimWaitlistPlace)(db, offer.id, "uid_Wait", "2026-10-10T10:10:00.000Z");
        strict_1.default.ok(claimed.booking);
    });
    (0, node_test_1.it)("28. Existing Heathrow four passenger fallback still works", () => {
        strict_1.default.equal((0, terminalGuide_1.isHeathrowShare)({ airportId: "heathrow", destinationLabel: "Heathrow Airport Terminal 3" }), true);
        const dots = (0, shareProgress_1.occupancyDots)(4, 5);
        strict_1.default.equal(dots.filter((row) => row === "filled").length, 4);
    });
    (0, node_test_1.it)("29. Existing quiet hours logic still works", () => {
        strict_1.default.equal((0, paymentDeadline_1.isLondonQuietHours)("2026-10-10T22:30:00.000Z"), true);
        strict_1.default.equal((0, shareProgress_1.reminderDue)("2026-10-11T08:00:00.000Z", "2026-10-10T22:30:00.000Z", 30, undefined, true), false);
    });
    (0, node_test_1.it)("30. Existing security/privacy tests still pass", () => {
        strict_1.default.equal((0, notifications_1.shareNotificationsEnabled)({ ...defaults_1.DEFAULT_SHARE_CONFIG, notificationsSend: true }), false);
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        (0, bookingFlow_1.expressInterest)(db, interestInput("Private Person", 1, "uid-priv"));
        const pub = (0, bookingFlow_1.listPublicInterestGroups)(db)[0];
        strict_1.default.equal((0, interestGroups_1.publicInterestHasPrivateData)(pub), false);
        const mine = (0, bookingFlow_1.customerInterestViews)(db, "uid-priv")[0];
        strict_1.default.equal(mine.customerStageLabel, (0, shareProgress_1.customerStageLabel)("REGISTERING_INTEREST"));
        strict_1.default.ok(mine.interestDeadlineAt);
        (0, bookingFlow_1.setInterestDeadline)(db, [...db.interestGroups.values()][0].id, "2026-10-04T10:00:00.000Z", "admin");
        strict_1.default.equal([...db.interestGroups.values()][0].interestDeadlineAt, "2026-10-04T10:00:00.000Z");
    });
    (0, node_test_1.it)("dynamic capacity is not hardcoded to five", () => {
        const progress = (0, shareProgress_1.seatProgress)(2, 8);
        strict_1.default.equal(progress.remaining, 6);
        strict_1.default.equal((0, shareProgress_1.occupancyDots)(2, 8).length, 8);
        const pay = (0, shareProgress_1.paymentProgress)([
            { passengers: 1, reservationStatus: "PAID", hostedPaymentStatus: "PAID" },
            { passengers: 1, reservationStatus: "PAYMENT_PENDING", hostedPaymentStatus: "PAYMENT_PENDING" },
        ], 8);
        strict_1.default.equal(pay.remainingPayments, 7);
    });
    (0, node_test_1.it)("admin can change a payment deadline without resetting paid status", async () => {
        const db = new bookingFlow_1.InMemoryShareDb(configWithFive());
        const first = await book(db, { action: "propose", key: "deadline-chg", name: "Ann", passengers: 5 });
        (0, bookingFlow_1.savePaymentLink)(db, String(first.journeyId), "https://pay.example.com/share");
        (0, bookingFlow_1.openPaymentWindow)(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
        (0, bookingFlow_1.markReservationPaid)(db, String(first.bookingId), "admin");
        (0, bookingFlow_1.setPaymentDeadline)(db, String(first.journeyId), "2026-10-10T18:00:00.000Z", "admin");
        strict_1.default.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAID");
        strict_1.default.equal(db.journeys.get(String(first.journeyId))?.paymentDeadlineAt, "2026-10-10T18:00:00.000Z");
    });
});
