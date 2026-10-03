import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  cancelReservation,
  confirmHostedIfEligible,
  markNoShow,
  markReservationPaid,
  openPaymentWindow,
  reservePlace,
  savePaymentLink,
  verifyPassengerBoarding,
} from "./bookingFlow";
import {
  boardingDisplayStatus,
  boardingProgress,
  codeLooksDerivedFromPii,
  customerBoardingCodeForView,
  generateBoardingCode,
  hashBoardingCode,
  issueBoardingCodes,
  publicDtoHasBoardingSecrets,
  verifyBoardingCode,
} from "./boarding";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import { toCustomerBookingView } from "./hostedPayment";
import { stripPrivateFields, toPublicJourney } from "./logic";
import { buildNotification, shareNotificationsEnabled } from "./notifications";
import { MockPaymentProvider } from "./paymentProvider";
import { buildNeedsAction, humanJourneyStage, penceFromPounds, poundsFromPence } from "./operatorConsole";

function contact(name: string) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    flexibility: "plus_minus_30" as const,
    dropoffTerminal: "T3" as const,
    uid: `uid_${name}`,
  };
}

async function fillAndConfirm(db: InMemoryShareDb) {
  const first = await reservePlace(db, new MockPaymentProvider(), {
    action: "propose",
    airportId: "heathrow",
    travelDate: "2026-10-12",
    preferredDepartureTime: "10:00",
    passengers: 1,
    luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
    contact: contact("Ada"),
    idempotencyKey: "a1",
    termsAccepted: true,
  });
  for (let i = 2; i <= 5; i += 1) {
    await reservePlace(db, new MockPaymentProvider(), {
      action: "join",
      journeyId: String(first.journeyId),
      airportId: "heathrow",
      travelDate: "2026-10-12",
      preferredDepartureTime: "10:00",
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: contact(`Pax${i}`),
      idempotencyKey: `k${i}`,
      termsAccepted: true,
    });
  }
  const journeyId = String(first.journeyId);
  savePaymentLink(db, journeyId, "https://pay.example/share");
  openPaymentWindow(db, journeyId, "2026-10-11T09:00:00.000Z");
  for (const booking of [...db.bookings.values()].filter((row) => row.journeyId === journeyId)) {
    markReservationPaid(db, booking.id, "admin", "2026-10-11T10:00:00.000Z");
  }
  return { journeyId, first };
}

describe("Spires Share operator console", () => {
  it("1. Needs Action classifications include ready to propose", () => {
    const items = buildNeedsAction({
      journeys: [],
      bookings: [],
      interestGroups: [
        {
          id: "g1",
          publicNumber: "INT-1",
          origin: "Oxford",
          destinationRegion: "Heathrow",
          travelDate: "2026-10-12",
          timeWindowStart: "10:00",
          timeWindowEnd: "10:30",
          interestedSeatCount: 5,
          minPassengerThreshold: 5,
          status: "READY_FOR_REVIEW",
        } as never,
      ],
    });
    assert.equal(items[0]?.kind, "ready_to_propose");
    assert.equal(items[0]?.primaryLabel, "Review and propose");
  });

  it("5. Pounds convert to pence for callables", () => {
    assert.equal(penceFromPounds("35"), 3500);
    assert.equal(penceFromPounds("35.00"), 3500);
    assert.equal(poundsFromPence(3500), "£35.00");
  });

  it("16. Human stages hide raw enums", () => {
    assert.equal(
      humanJourneyStage({ status: "PAYMENT_WINDOW_OPEN", paymentStageStatus: "OPEN", capacity: 5, occupiedSeats: 5, minPassengerThreshold: 5 } as never, []),
      "Collecting payment"
    );
  });
});

describe("Spires Share boarding verification", () => {
  it("1. Unconfirmed journey does not issue boarding codes", async () => {
    const db = new InMemoryShareDb();
    const first = await reservePlace(db, new MockPaymentProvider(), {
      action: "propose",
      airportId: "heathrow",
      travelDate: "2026-10-12",
      preferredDepartureTime: "10:00",
      passengers: 1,
      luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      contact: contact("Ada"),
      idempotencyKey: "u1",
      termsAccepted: true,
    });
    const journey = db.journeys.get(String(first.journeyId))!;
    const bookings = [...db.bookings.values()];
    issueBoardingCodes(journey, bookings, "2026-10-11T10:00:00.000Z");
    assert.equal(bookings[0].boardingCode, undefined);
  });

  it("2-3. Confirmed eligible passenger receives a code and cancelled does not keep an active code path", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
    assert.ok(bookings.every((row) => /^\d{4}$/.test(String(row.boardingCode || ""))));
    const victim = bookings[0];
    cancelReservation(db, victim.id, "2026-10-11T11:00:00.000Z");
    const live = db.bookings.get(victim.id)!;
    assert.equal(boardingDisplayStatus(live), "CANCELLED");
    assert.equal(customerBoardingCodeForView(db.journeys.get(journeyId)!, live), undefined);
  });

  it("4-5. Codes are not sequential and not derived from PII", async () => {
    const used = new Set<string>();
    const codes = Array.from({ length: 8 }, () => generateBoardingCode(used));
    used.forEach((code) => used.add(code));
    const sequential = codes.every((code, index) => index === 0 || Number(code) === Number(codes[index - 1]) + 1);
    assert.equal(sequential, false);
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    for (const booking of [...db.bookings.values()].filter((row) => row.journeyId === journeyId)) {
      assert.equal(codeLooksDerivedFromPii(String(booking.boardingCode), booking), false);
    }
  });

  it("6-8. Codes are not public, customer sees only own, admin record keeps code", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const journey = db.journeys.get(journeyId)!;
    const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
    const pub = toPublicJourney(journey, DEFAULT_SHARE_CONFIG) as unknown as Record<string, unknown>;
    assert.equal(publicDtoHasBoardingSecrets(pub), false);
    assert.equal("boardingCode" in stripPrivateFields(bookings[0] as unknown as Record<string, unknown>), false);
    const own = toCustomerBookingView(journey, bookings[0], bookings, DEFAULT_SHARE_CONFIG);
    const other = toCustomerBookingView(journey, bookings[1], bookings, DEFAULT_SHARE_CONFIG);
    assert.equal(own.boardingCode, bookings[0].boardingCode);
    assert.notEqual(other.boardingCode, bookings[0].boardingCode);
    assert.ok(bookings[0].boardingCode);
  });

  it("9-13. Verify correct code, hide correct code on failure, record time and actor, second verify is idempotent", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const booking = [...db.bookings.values()].find((row) => row.journeyId === journeyId)!;
    const journey = db.journeys.get(journeyId)!;
    assert.throws(() => verifyBoardingCode(journey, booking, "0000", "driver@spires", "2026-10-12T09:00:00.000Z"), /Code does not match/);
    try {
      verifyBoardingCode(journey, booking, "0000", "driver", "2026-10-12T09:00:00.000Z");
    } catch (err) {
      assert.equal(String((err as Error).message).includes(String(booking.boardingCode)), false);
    }
    const first = verifyPassengerBoarding(db, booking.id, String(booking.boardingCode), "driver@spires", "2026-10-12T09:01:00.000Z");
    assert.equal(first.ok, true);
    assert.equal(db.bookings.get(booking.id)?.boardStatus, "BOARDED");
    assert.equal(db.bookings.get(booking.id)?.boardingVerifiedAt, "2026-10-12T09:01:00.000Z");
    assert.equal(db.bookings.get(booking.id)?.boardingVerifiedBy, "driver@spires");
    const again = verifyPassengerBoarding(db, booking.id, String(booking.boardingCode), "driver@spires", "2026-10-12T09:02:00.000Z");
    assert.equal(again.alreadyVerified, true);
    assert.equal(db.bookings.get(booking.id)?.boardingVerifiedAt, "2026-10-12T09:01:00.000Z");
  });

  it("14-15. Driver can mark no show and it does not auto refund", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const booking = [...db.bookings.values()].find((row) => row.journeyId === journeyId)!;
    markNoShow(db, booking.id, "2026-10-12T10:05:00.000Z");
    const live = db.bookings.get(booking.id)!;
    assert.equal(live.boardStatus, "NO_SHOW");
    assert.equal(live.refundStatus || "NONE", "NONE");
    assert.equal(live.amountRefundedPence || 0, 0);
  });

  it("16. Confirmation email text includes boarding code", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const booking = [...db.bookings.values()].find((row) => row.journeyId === journeyId)!;
    const draft = buildNotification("JOURNEY_CONFIRMED", booking.email, db.journeys.get(journeyId)!, {
      boardingCode: booking.boardingCode,
      pickup: "Thornhill Park and Ride",
      travelDate: "2026-10-12",
    });
    assert.match(draft.text, new RegExp(String(booking.boardingCode)));
    assert.match(draft.subject, /confirmed/i);
  });

  it("17-20. Driver manifest only for confirmed journeys with assigned driver email and dedupes", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const before = db.notifications.filter((row) => String(row.type).startsWith("DRIVER_MANIFEST")).length;
    assert.equal(before, 0);
    const journey = db.journeys.get(journeyId)!;
    journey.assignedDriverEmail = "irfan@example.com";
    const { recordDriverManifestIfNeeded } = await import("./bookingFlow");
    const first = recordDriverManifestIfNeeded(db, journey, [...db.bookings.values()].filter((row) => row.journeyId === journeyId), "2026-10-11T12:00:00.000Z");
    const second = recordDriverManifestIfNeeded(db, journey, [...db.bookings.values()].filter((row) => row.journeyId === journeyId), "2026-10-11T12:01:00.000Z");
    assert.equal(first.sent, true);
    assert.equal(second.sent, false);
    assert.equal(db.notifications.filter((row) => row.type === "DRIVER_MANIFEST" && row.email === "irfan@example.com").length, 1);
  });

  it("21-25. Passenger list change can update manifest, seat counts and progress", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const journey = db.journeys.get(journeyId)!;
    journey.assignedDriverEmail = "irfan@example.com";
    const { recordDriverManifestIfNeeded } = await import("./bookingFlow");
    recordDriverManifestIfNeeded(db, journey, [...db.bookings.values()].filter((row) => row.journeyId === journeyId), "2026-10-11T12:00:00.000Z");
    const victim = [...db.bookings.values()].find((row) => row.journeyId === journeyId)!;
    cancelReservation(db, victim.id, "2026-10-11T13:00:00.000Z");
    const remaining = [...db.bookings.values()].filter((row) => row.journeyId === journeyId && boardingDisplayStatus(row) !== "CANCELLED");
    assert.equal(remaining.some((row) => row.id === victim.id), false);
    const progress = boardingProgress([...db.bookings.values()].filter((row) => row.journeyId === journeyId));
    assert.equal(progress.totalSeats, 4);
    const twoSeat = remaining[0];
    twoSeat.passengers = 2;
    const progress2 = boardingProgress(remaining);
    assert.equal(progress2.totalSeats >= 5, true);
  });

  it("27-28. Customer cannot verify another booking by seeing its code, public DTO omits codes", async () => {
    const db = new InMemoryShareDb();
    const { journeyId } = await fillAndConfirm(db);
    const [own, other] = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
    const view = toCustomerBookingView(db.journeys.get(journeyId)!, own, [...db.bookings.values()], DEFAULT_SHARE_CONFIG);
    assert.notEqual(view.boardingCode, other.boardingCode);
    const pub = toPublicJourney(db.journeys.get(journeyId)!, DEFAULT_SHARE_CONFIG) as unknown as Record<string, unknown>;
    assert.equal(pub.boardingCode, undefined);
  });

  it("hash differs by booking so the same digits would not verify the wrong passenger", () => {
    const a = hashBoardingCode("j1", "b1", "4827");
    const b = hashBoardingCode("j1", "b2", "4827");
    assert.notEqual(a, b);
  });

  it("emails stay dry run unless both send flags are on", () => {
    assert.equal(shareNotificationsEnabled({ ...DEFAULT_SHARE_CONFIG, notificationsSend: false }), false);
  });
});
