import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  addWaitlist,
  cancelReservation,
  claimWaitlistPlace,
  confirmHostedIfEligible,
  customerInterestViews,
  expireInsufficientInterest,
  expireUnpaidReservations,
  expressInterest,
  listPublicInterestGroups,
  markReservationPaid,
  openPaymentWindow,
  proposeJourneyFromInterest,
  reservePlace,
  savePaymentLink,
  setInterestDeadline,
  setPaymentDeadline,
} from "./bookingFlow";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { toCustomerBookingView } from "./hostedPayment";
import { publicInterestHasPrivateData } from "./interestGroups";
import { isLondonQuietHours } from "./paymentDeadline";
import { buildNotification, shareNotificationsEnabled } from "./notifications";
import {
  confirmationGuard,
  customerStageLabel,
  formatCountdown,
  occupancyDots,
  paymentProgress,
  recordShareNotification,
  reminderDue,
  seatProgress,
} from "./shareProgress";
import { isHeathrowShare } from "./terminalGuide";
import { MockPaymentProvider } from "./paymentProvider";

function contact(name: string, uid = `uid_${name}`) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    flexibility: "plus_minus_30" as const,
    dropoffTerminal: "T3",
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

function interestInput(name: string, seats: number, uid: string, extras: Record<string, unknown> = {}) {
  return {
    origin: "Oxford",
    destinationRegion: "Heathrow",
    travelDate: "2026-10-12",
    preferredDepartureTime: "14:00",
    flexibility: "plus_minus_30" as const,
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
    ...DEFAULT_SHARE_CONFIG,
    airports: [...DEFAULT_SHARE_CONFIG.airports],
    passengerCapacity: 5,
    interestRegistrationHours: 48,
    paymentReminderMinutesBeforeDeadline: 30,
    paymentFinalReminderMinutesBeforeDeadline: 10,
    pilotDefaults: { ...DEFAULT_SHARE_CONFIG.pilotDefaults, minPassengerThreshold: 5, capacity: 5 },
  };
}

describe("Spires Share payment guarantee, countdowns and notifications", () => {
  it("1. 3/5 shows 2 passengers needed", () => {
    const progress = seatProgress(3, 5);
    assert.equal(progress.remaining, 2);
    assert.equal(progress.neededLabel, "2 more passengers needed");
    assert.equal(progress.enough, false);
  });

  it("2. 4/5 shows 1 passenger needed", () => {
    const progress = seatProgress(4, 5);
    assert.equal(progress.remaining, 1);
    assert.equal(progress.neededHeadline, "1 MORE PASSENGER NEEDED");
  });

  it("3. 5/5 says enough interest but NOT confirmed", () => {
    const db = new InMemoryShareDb(configWithFive());
    for (let i = 1; i <= 5; i += 1) {
      expressInterest(db, interestInput(`P${i}`, 1, `uid-${i}`, { nowIso: "2026-10-01T10:00:00.000Z" }));
    }
    const group = [...db.interestGroups.values()][0];
    const progress = seatProgress(group.interestedSeatCount, 5);
    assert.equal(progress.enough, true);
    assert.match(progress.neededHeadline, /ENOUGH INTEREST RECEIVED/);
    assert.notEqual(group.status, "CONVERTED_TO_JOURNEY");
    assert.equal(db.journeys.size, 0);
  });

  it("4. Interest countdown uses stored deadline", () => {
    const db = new InMemoryShareDb(configWithFive());
    const { group } = expressInterest(db, interestInput("Ann", 1, "uid-ann"));
    assert.ok(group.interestDeadlineAt);
    const first = formatCountdown(group.interestDeadlineAt, "2026-10-01T10:00:00.000Z");
    assert.equal(first.expired, false);
    assert.ok(first.remainingMs > 0);
  });

  it("5. Refresh does not reset countdown", () => {
    const stored = "2026-10-03T10:00:00.000Z";
    const first = formatCountdown(stored, "2026-10-01T10:00:00.000Z");
    const afterRefresh = formatCountdown(stored, "2026-10-02T10:00:00.000Z");
    assert.ok(afterRefresh.remainingMs < first.remainingMs);
    assert.equal(afterRefresh.remainingMs, 24 * 60 * 60 * 1000);
  });

  it("6. Expired insufficient interest cannot proceed to payment normally", () => {
    const db = new InMemoryShareDb(configWithFive());
    const { group } = expressInterest(db, interestInput("Ann", 2, "uid-ann"));
    group.interestDeadlineAt = "2026-10-01T11:00:00.000Z";
    expireInsufficientInterest(db, "2026-10-01T12:00:00.000Z");
    assert.equal(group.status, "EXPIRED");
    assert.throws(
      () =>
        proposeJourneyFromInterest(db, group.id, {
          departureLocation: "Thornhill Park & Ride",
          departureTime: "14:00",
        }),
      /expired without enough passengers/
    );
  });

  it("7. Threshold sends admin email once", () => {
    const db = new InMemoryShareDb(configWithFive());
    for (let i = 1; i <= 5; i += 1) {
      expressInterest(db, interestInput(`P${i}`, 1, `uid-${i}`));
    }
    const ready = db.notifications.filter((row) => row.type === "ADMIN_THRESHOLD_REACHED");
    assert.equal(ready.length, 1);
    expressInterest(db, interestInput("P1", 1, "uid-1"));
    assert.equal(db.notifications.filter((row) => row.type === "ADMIN_THRESHOLD_REACHED").length, 1);
  });

  it("8. Admin can open payment window", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "open-win-1", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    const opened = openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    assert.ok(opened.deadlineAt);
    assert.equal(db.journeys.get(String(first.journeyId))?.paymentStageStatus, "OPEN");
  });

  it("9. Opening payment window sends eligible customer payment emails", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "pay-mail-1", name: "Ann", passengers: 4 });
    await book(db, { action: "join", key: "pay-mail-2", name: "Ben", passengers: 1, journeyId: first.journeyId });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    const opened = openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    assert.equal(opened.emailedBookingIds.length, 2);
    assert.equal(db.notifications.filter((row) => row.type === "PAYMENT_REQUIRED").length, 2);
  });

  it("10. Payment countdown uses stored deadline", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "pay-cd-1", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    const opened = openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    const later = formatCountdown(opened.deadlineAt, "2026-10-10T10:30:00.000Z");
    const stored = db.journeys.get(String(first.journeyId))?.paymentDeadlineAt;
    assert.equal(stored, opened.deadlineAt);
    assert.equal(later.expired, false);
  });

  it("11. Customer payment does not confirm journey individually", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "one-pay-1", name: "Ann", passengers: 2 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    const paid = markReservationPaid(db, String(first.bookingId), "admin");
    assert.equal(paid.confirmed, false);
    assert.notEqual(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("12. 4/5 paid remains unconfirmed", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const ids: string[] = [];
    const first = await book(db, { action: "propose", key: "four-pay-a", name: "A", passengers: 1 });
    ids.push(String(first.bookingId));
    for (const name of ["B", "C", "D", "E"]) {
      const row = await book(db, { action: "join", journeyId: first.journeyId, key: `four-pay-${name}`, name, passengers: 1 });
      ids.push(String(row.bookingId));
    }
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    ids.slice(0, 4).forEach((id) => markReservationPaid(db, id, "admin"));
    const journey = db.journeys.get(String(first.journeyId))!;
    const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journey.id);
    const guard = confirmationGuard(bookings, journey, db.config);
    assert.equal(guard.ok, false);
    assert.equal(guard.verifiedRequiredSeats, 4);
    assert.notEqual(journey.status, "CONFIRMED");
  });

  it("13. 5/5 paid but unverified does not confirm if verification is required", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "unverified-1", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    booking.paymentSubmittedAt = "2026-10-10T10:05:00.000Z";
    const journey = db.journeys.get(String(first.journeyId))!;
    const guard = confirmationGuard([...db.bookings.values()], journey, db.config);
    assert.equal(guard.ok, false);
    assert.equal(guard.verifiedRequiredSeats, 0);
    assert.notEqual(confirmHostedIfEligible(db, journey.id).status, "CONFIRMED");
  });

  it("14. All required verified payments confirms once", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "all-pay-1", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    assert.equal(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
    const again = confirmHostedIfEligible(db, String(first.journeyId));
    assert.equal(again.alreadyConfirmed, true);
  });

  it("15. Confirmed journey sends confirmation emails once", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "conf-mail-1", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    confirmHostedIfEligible(db, String(first.journeyId));
    assert.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 1);
  });

  it("16. Public payment progress contains no identities", () => {
    const db = new InMemoryShareDb(configWithFive());
    expressInterest(db, interestInput("Secret Name", 2, "uid-secret"));
    const pub = listPublicInterestGroups(db)[0];
    assert.equal(publicInterestHasPrivateData(pub), false);
    assert.equal(JSON.stringify(pub).includes("Secret Name"), false);
  });

  it("17. Customer can only see own payment status plus aggregates", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "priv-a", name: "Ann", passengers: 4 });
    const second = await book(db, { action: "join", key: "priv-b", name: "Ben", passengers: 1, journeyId: first.journeyId });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    markReservationPaid(db, String(second.bookingId), "admin");
    const journey = db.journeys.get(String(first.journeyId))!;
    const view = toCustomerBookingView(journey, db.bookings.get(String(first.bookingId))!, [...db.bookings.values()], db.config);
    const json = JSON.stringify(view);
    assert.equal(json.includes("Ben"), false);
    assert.equal(json.includes("ben@example.com"), false);
    assert.equal(view.paymentsReceived, 1);
    assert.equal(view.ownPaymentReceived, false);
  });

  it("18. Paid customer does not receive unpaid reminder", () => {
    assert.equal(reminderDue("2026-10-10T12:00:00.000Z", "2026-10-10T11:40:00.000Z", 30, "already"), false);
  });

  it("19. Unpaid customer receives appropriate reminder", () => {
    assert.equal(reminderDue("2026-10-10T12:00:00.000Z", "2026-10-10T11:40:00.000Z", 30), true);
    const mail = buildNotification("PAYMENT_DEADLINE_APPROACHING", "unpaid@example.com", null, { amountPence: 3500 });
    assert.match(mail.subject, /deadline/i);
  });

  it("20. Interest expiry sends correct customer notification", () => {
    const db = new InMemoryShareDb(configWithFive());
    const { group } = expressInterest(db, interestInput("Ann", 1, "uid-ann"));
    group.interestDeadlineAt = "2026-10-01T11:00:00.000Z";
    expireInsufficientInterest(db, "2026-10-01T12:00:00.000Z");
    const mail = db.notifications.filter((row) => row.type === "INTEREST_EXPIRED" && row.email === "ann@example.com");
    assert.equal(mail.length, 1);
    const copy = buildNotification("INTEREST_EXPIRED", "ann@example.com", null);
    assert.match(copy.text, /No payment was taken/);
  });

  it("21. Payment expiry without all payments does not confirm", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "exp-nc-1", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    const booking = db.bookings.get(String(first.bookingId))!;
    booking.paymentDeadlineAt = "2026-10-10T10:05:00.000Z";
    expireUnpaidReservations(db, "2026-10-10T10:10:00.000Z");
    assert.notEqual(db.journeys.get(String(first.journeyId))?.status, "CONFIRMED");
  });

  it("22. Admin receives payment failure/expiry alert", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "exp-admin-a", name: "Ann", passengers: 4 });
    const second = await book(db, { action: "join", key: "exp-admin-b", name: "Ben", passengers: 1, journeyId: first.journeyId });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    const unpaid = db.bookings.get(String(second.bookingId))!;
    unpaid.paymentDeadlineAt = "2026-10-10T10:05:00.000Z";
    expireUnpaidReservations(db, "2026-10-10T10:10:00.000Z");
    assert.equal(db.notifications.filter((row) => row.type === "ADMIN_PAYMENT_WINDOW_EXPIRED").length, 1);
    assert.equal(db.notifications.filter((row) => row.type === "PAYMENT_WINDOW_EXPIRED_CUSTOMER").length, 1);
  });

  it("23. Two seats from one customer count as two seats where appropriate", () => {
    const db = new InMemoryShareDb(configWithFive());
    const { group, entry } = expressInterest(db, interestInput("Ann", 2, "uid-ann"));
    assert.equal(entry.passengers, 2);
    assert.equal(group.interestedSeatCount, 2);
    const admin = db.notifications.find((row) => row.type === "ADMIN_NEW_INTEREST");
    assert.equal(admin?.seatsRequested, 2);
  });

  it("24. Admin interest email is not duplicated on retry", () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = expressInterest(db, interestInput("Ann", 1, "uid-ann"));
    const retry = expressInterest(db, interestInput("Ann", 1, "uid-ann"));
    assert.equal(retry.joinedExisting, true);
    assert.equal(db.notifications.filter((row) => row.type === "ADMIN_NEW_INTEREST").length, 1);
    recordShareNotification(db.notifications, {
      type: "ADMIN_NEW_INTEREST",
      deduplicationKey: `ADMIN_NEW_INTEREST:${first.entry.id}`,
    });
    assert.equal(db.notifications.filter((row) => row.type === "ADMIN_NEW_INTEREST").length, 1);
  });

  it("25. Threshold email is not duplicated", () => {
    const db = new InMemoryShareDb(configWithFive());
    for (let i = 1; i <= 5; i += 1) expressInterest(db, interestInput(`P${i}`, 1, `uid-${i}`));
    const group = [...db.interestGroups.values()][0];
    recordShareNotification(db.notifications, {
      type: "ADMIN_THRESHOLD_REACHED",
      deduplicationKey: `ADMIN_THRESHOLD_REACHED:${group.id}`,
    });
    assert.equal(db.notifications.filter((row) => row.type === "ADMIN_THRESHOLD_REACHED").length, 1);
  });

  it("26. Confirmation email is not duplicated", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "dup-conf", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    confirmHostedIfEligible(db, String(first.journeyId));
    confirmHostedIfEligible(db, String(first.journeyId));
    assert.equal(db.notifications.filter((row) => row.type === "JOURNEY_CONFIRMED").length, 1);
  });

  it("27. Existing waitlist logic still works", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "wl-full", name: "Ann", passengers: 5 });
    addWaitlist(db, String(first.journeyId), { ...contact("Wait"), passengers: 1, termsAccepted: true });
    cancelReservation(db, String(first.bookingId), "2026-10-10T10:00:00.000Z");
    const offer = [...db.waitlist.values()].find((row) => row.status === "OFFERED");
    assert.ok(offer);
    const claimed = await claimWaitlistPlace(db, offer!.id, "uid_Wait", "2026-10-10T10:10:00.000Z");
    assert.ok(claimed.booking);
  });

  it("28. Existing Heathrow four passenger fallback still works", () => {
    assert.equal(isHeathrowShare({ airportId: "heathrow", destinationLabel: "Heathrow Airport Terminal 3" }), true);
    const dots = occupancyDots(4, 5);
    assert.equal(dots.filter((row) => row === "filled").length, 4);
  });

  it("29. Existing quiet hours logic still works", () => {
    assert.equal(isLondonQuietHours("2026-10-10T22:30:00.000Z"), true);
    assert.equal(reminderDue("2026-10-11T08:00:00.000Z", "2026-10-10T22:30:00.000Z", 30, undefined, true), false);
  });

  it("30. Existing security/privacy tests still pass", () => {
    assert.equal(shareNotificationsEnabled({ ...DEFAULT_SHARE_CONFIG, notificationsSend: true }), false);
    const db = new InMemoryShareDb(configWithFive());
    expressInterest(db, interestInput("Private Person", 1, "uid-priv"));
    const pub = listPublicInterestGroups(db)[0];
    assert.equal(publicInterestHasPrivateData(pub), false);
    const mine = customerInterestViews(db, "uid-priv")[0];
    assert.equal(mine.customerStageLabel, customerStageLabel("REGISTERING_INTEREST"));
    assert.ok(mine.interestDeadlineAt);
    setInterestDeadline(db, [...db.interestGroups.values()][0].id, "2026-10-04T10:00:00.000Z", "admin");
    assert.equal([...db.interestGroups.values()][0].interestDeadlineAt, "2026-10-04T10:00:00.000Z");
  });

  it("dynamic capacity is not hardcoded to five", () => {
    const progress = seatProgress(2, 8);
    assert.equal(progress.remaining, 6);
    assert.equal(occupancyDots(2, 8).length, 8);
    const pay = paymentProgress(
      [
        { passengers: 1, reservationStatus: "PAID", hostedPaymentStatus: "PAID" },
        { passengers: 1, reservationStatus: "PAYMENT_PENDING", hostedPaymentStatus: "PAYMENT_PENDING" },
      ],
      8
    );
    assert.equal(pay.remainingPayments, 7);
  });

  it("admin can change a payment deadline without resetting paid status", async () => {
    const db = new InMemoryShareDb(configWithFive());
    const first = await book(db, { action: "propose", key: "deadline-chg", name: "Ann", passengers: 5 });
    savePaymentLink(db, String(first.journeyId), "https://pay.example.com/share");
    openPaymentWindow(db, String(first.journeyId), "2026-10-10T10:00:00.000Z");
    markReservationPaid(db, String(first.bookingId), "admin");
    setPaymentDeadline(db, String(first.journeyId), "2026-10-10T18:00:00.000Z", "admin");
    assert.equal(db.bookings.get(String(first.bookingId))?.reservationStatus, "PAID");
    assert.equal(db.journeys.get(String(first.journeyId))?.paymentDeadlineAt, "2026-10-10T18:00:00.000Z");
  });
});
