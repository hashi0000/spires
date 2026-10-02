import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  InMemoryShareDb,
  acceptEarlyDeparture,
  addWaitlist,
  confirmIfEligible,
  expireOpenJourneys,
  offerEarlyDeparture,
  offerWaitlistIfPossible,
  reservePlace,
  resolvePaymentFailure,
} from "./bookingFlow";
import { MockPaymentProvider } from "./paymentProvider";
import { remainingSeats } from "./logic";

function contact(name: string) {
  return {
    name,
    mobile: "07776897772",
    email: `${name.toLowerCase()}@example.com`,
    flexibility: "plus_minus_30" as const,
    dropoffTerminal: "T5",
    flightDepartureTime: "18:00",
  };
}

async function book(
  db: InMemoryShareDb,
  provider: MockPaymentProvider,
  opts: { action: "propose" | "join"; journeyId?: string; passengers?: number; key: string; name: string; time?: string; payment?: boolean; luggage?: { largeSuitcases: number; cabinBags: number } }
) {
  return reservePlace(db, provider, {
    action: opts.action,
    airportId: "heathrow",
    travelDate: "2026-10-13",
    preferredDepartureTime: opts.time || "10:30",
    journeyId: opts.journeyId,
    passengers: opts.passengers || 1,
    luggage: { largeSuitcases: opts.luggage?.largeSuitcases ?? 1, cabinBags: opts.luggage?.cabinBags ?? 1, other: "" },
    contact: contact(opts.name),
    idempotencyKey: opts.key,
    paymentMethodSucceeds: opts.payment,
    termsAccepted: true,
  });
}

describe("Heathrow booking flow", () => {
  it("rejects Gatwick on the MVP", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    await assert.rejects(
      () =>
        reservePlace(db, provider, {
          action: "propose",
          airportId: "gatwick",
          travelDate: "2026-10-13",
          preferredDepartureTime: "10:30",
          passengers: 1,
          luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
          contact: contact("A"),
          idempotencyKey: "gat-1xxxxxxx",
          termsAccepted: true,
        }),
      /not available/
    );
  });

  it("rejects a party larger than capacity on propose", async () => {
    const db = new InMemoryShareDb();
    await assert.rejects(() => book(db, new MockPaymentProvider(), { action: "propose", passengers: 6, key: "big-party1", name: "A" }));
  });

  it("rejects luggage over the per-passenger allowance", async () => {
    const db = new InMemoryShareDb();
    await assert.rejects(() =>
      book(db, new MockPaymentProvider(), {
        action: "propose",
        key: "bags-too-many",
        name: "A",
        luggage: { largeSuitcases: 3, cabinBags: 0 },
      })
    );
  });

  it("does not duplicate a retry with the same idempotency key", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", key: "same-key-01", name: "A" });
    const second = await book(db, provider, { action: "propose", key: "same-key-01", name: "A" });
    assert.equal(first.bookingId, second.bookingId);
    assert.equal(second.idempotentReplay, true);
    assert.equal([...db.bookings.values()].length, 1);
  });

  it("does not create two journeys for the same Heathrow slot", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", key: "slot-a-0001", name: "A" });
    const second = await book(db, provider, { action: "propose", key: "slot-b-0001", name: "B" });
    assert.equal(first.ok, true);
    assert.equal(second.needsChoice, true);
    assert.equal(db.journeys.size, 1);
  });

  it("serialises the last remaining place so occupancy never exceeds 5", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const seed = await book(db, provider, { action: "propose", passengers: 4, key: "seed-4pax01", name: "A" });
    const [one, two] = await Promise.allSettled([
      book(db, provider, { action: "join", journeyId: seed.journeyId, key: "last-seat-a", name: "B" }),
      book(db, provider, { action: "join", journeyId: seed.journeyId, key: "last-seat-b", name: "C" }),
    ]);
    const ok = [one, two].filter((row) => row.status === "fulfilled") as PromiseFulfilledResult<Awaited<ReturnType<typeof book>>>[];
    const rejected = [one, two].filter((row) => row.status === "rejected");
    assert.equal(ok.length, 1);
    assert.equal(rejected.length, 1);
    const journey = db.journeys.get(String(seed.journeyId));
    assert.equal(journey?.occupiedSeats, 5);
    assert.equal(remainingSeats(journey!.occupiedSeats, 5), 0);
    assert.ok((journey?.occupiedSeats || 0) <= 5);
  });

  it("does not charge at booking; four passengers only become ready for payment setup", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", passengers: 4, key: "pay-a-0001", name: "A" });
    const journey = db.journeys.get(String(first.journeyId));
    assert.equal(journey?.status, "READY_FOR_PAYMENT_SETUP");
    const statuses = [...db.bookings.values()].map((row) => row.reservationStatus);
    assert.ok(statuses.every((row) => row === "PROVISIONAL"));
    assert.ok([...db.payments.values()].every((row) => row.provider === "hosted_payment_link"));
  });

  it("does not confirm when one of five authorisations fails", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", key: "fail-a-0001", name: "A" });
    await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-b-0001", name: "B" });
    await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-c-0001", name: "C" });
    await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-d-0001", name: "D" });
    await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-e-0001", name: "E" });
    const bookings = [...db.bookings.values()];
    const flags: Record<string, boolean> = {};
    bookings.forEach((row, index) => {
      flags[row.id] = index !== 4;
    });
    for (const booking of bookings) {
      booking.paymentStatus = "PAYMENT_METHOD_VERIFIED";
      const payment = booking.paymentId ? db.payments.get(booking.paymentId) : undefined;
      if (payment) payment.status = "PAYMENT_METHOD_VERIFIED";
    }
    const journey = db.journeys.get(String(first.journeyId))!;
    journey.status = "FULL";
    const result = await confirmIfEligible(db, provider, journey.id, undefined, flags);
    assert.equal(result.ok, false);
    assert.equal(result.status, "PAYMENT_ACTION_REQUIRED");
    assert.equal(result.failedBookingIds.length, 1);
    assert.ok([...db.bookings.values()].every((row) => row.paymentStatus !== "CAPTURED"));
  });

  it("voids successful authorisations if a failed payer is released", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", passengers: 4, key: "void-a-0001", name: "A" });
    await book(db, provider, { action: "join", journeyId: first.journeyId, key: "void-b-0001", name: "B" });
    const bookings = [...db.bookings.values()];
    const flags: Record<string, boolean> = { [bookings[0].id]: true, [bookings[1].id]: false };
    for (const booking of bookings) {
      booking.paymentStatus = "PAYMENT_METHOD_VERIFIED";
      const payment = booking.paymentId ? db.payments.get(booking.paymentId) : undefined;
      if (payment) payment.status = "PAYMENT_METHOD_VERIFIED";
    }
    db.journeys.get(String(first.journeyId))!.status = "FULL";
    const result = await confirmIfEligible(db, provider, String(first.journeyId), undefined, flags);
    await resolvePaymentFailure(db, provider, String(first.journeyId), result.failedBookingIds[0]);
    const remaining = [...db.bookings.values()].filter((row) => row.paymentStatus !== "AUTHORISATION_RELEASED" && row.paymentStatus !== "FAILED");
    assert.ok(remaining.every((row) => row.paymentStatus === "PAYMENT_METHOD_VERIFIED" || row.paymentStatus === "AUTHORISATION_RELEASED"));
    assert.ok([...db.payments.values()].every((row) => row.status !== "CAPTURED"));
  });

  it("expires an unfilled journey without charging", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", key: "exp-a-0001", name: "A" });
    const journey = db.journeys.get(String(first.journeyId))!;
    journey.confirmationDeadlineAt = "2020-01-01T00:00:00.000Z";
    const result = await expireOpenJourneys(db, provider, "2026-10-12T12:00:00.000Z");
    assert.equal(result.expired, 1);
    assert.equal(db.journeys.get(journey.id)?.status, "EXPIRED");
    assert.equal([...db.bookings.values()][0].paymentStatus, "HOSTED_UNPAID");
  });

  it("requires every booking to accept the four-passenger fare", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", passengers: 2, key: "four-a-0001", name: "A" });
    await book(db, provider, { action: "join", journeyId: first.journeyId, passengers: 2, key: "four-b-0001", name: "B" });
    const offer = await offerEarlyDeparture(db, String(first.journeyId));
    assert.equal(offer.proposedFarePence, 4375);
    const bookings = [...db.bookings.values()];
    const one = acceptEarlyDeparture(db, String(first.journeyId), bookings[0].id, true);
    assert.equal(one.confirmed, false);
    acceptEarlyDeparture(db, String(first.journeyId), bookings[1].id, false);
    const rejected = acceptEarlyDeparture(db, String(first.journeyId), bookings[1].id, false);
    assert.equal(rejected.confirmed, false);
  });

  it("offers an expired waitlist place without charging", async () => {
    const db = new InMemoryShareDb();
    const provider = new MockPaymentProvider();
    const first = await book(db, provider, { action: "propose", passengers: 5, key: "wait-a-0001", name: "A" });
    addWaitlist(db, String(first.journeyId), { passengers: 1, name: "Wait", email: "wait@example.com", termsAccepted: true });
    const journey = db.journeys.get(String(first.journeyId))!;
    journey.occupiedSeats = 4;
    journey.status = "ALMOST_FULL";
    const offered = await offerWaitlistIfPossible(db, journey.id);
    assert.equal(offered?.status, "OFFERED");
    assert.ok(offered?.offerExpiresAt);
    assert.equal([...db.bookings.values()].length, 1);
  });

  it("blocks a departure that misses the flight safety buffer", async () => {
    const db = new InMemoryShareDb();
    await assert.rejects(() =>
      reservePlace(db, new MockPaymentProvider(), {
        action: "propose",
        airportId: "heathrow",
        travelDate: "2026-10-13",
        preferredDepartureTime: "10:30",
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        contact: { ...contact("Late"), flightDepartureTime: "11:00" },
        idempotencyKey: "flight-late01",
        termsAccepted: true,
      })
    );
  });
});
