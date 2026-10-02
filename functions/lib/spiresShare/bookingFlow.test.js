"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const paymentProvider_1 = require("./paymentProvider");
const logic_1 = require("./logic");
function contact(name) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        flexibility: "plus_minus_30",
        dropoffTerminal: "T5",
        flightDepartureTime: "18:00",
    };
}
async function book(db, provider, opts) {
    return (0, bookingFlow_1.reservePlace)(db, provider, {
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
(0, node_test_1.describe)("Heathrow booking flow", () => {
    (0, node_test_1.it)("rejects Gatwick on the MVP", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        await strict_1.default.rejects(() => (0, bookingFlow_1.reservePlace)(db, provider, {
            action: "propose",
            airportId: "gatwick",
            travelDate: "2026-10-13",
            preferredDepartureTime: "10:30",
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: contact("A"),
            idempotencyKey: "gat-1xxxxxxx",
            termsAccepted: true,
        }), /not available/);
    });
    (0, node_test_1.it)("rejects a party larger than capacity on propose", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        await strict_1.default.rejects(() => book(db, new paymentProvider_1.MockPaymentProvider(), { action: "propose", passengers: 6, key: "big-party1", name: "A" }));
    });
    (0, node_test_1.it)("rejects luggage over the per-passenger allowance", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        await strict_1.default.rejects(() => book(db, new paymentProvider_1.MockPaymentProvider(), {
            action: "propose",
            key: "bags-too-many",
            name: "A",
            luggage: { largeSuitcases: 3, cabinBags: 0 },
        }));
    });
    (0, node_test_1.it)("does not duplicate a retry with the same idempotency key", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", key: "same-key-01", name: "A" });
        const second = await book(db, provider, { action: "propose", key: "same-key-01", name: "A" });
        strict_1.default.equal(first.bookingId, second.bookingId);
        strict_1.default.equal(second.idempotentReplay, true);
        strict_1.default.equal([...db.bookings.values()].length, 1);
    });
    (0, node_test_1.it)("does not create two journeys for the same Heathrow slot", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", key: "slot-a-0001", name: "A" });
        const second = await book(db, provider, { action: "propose", key: "slot-b-0001", name: "B" });
        strict_1.default.equal(first.ok, true);
        strict_1.default.equal(second.needsChoice, true);
        strict_1.default.equal(db.journeys.size, 1);
    });
    (0, node_test_1.it)("serialises the last remaining place so occupancy never exceeds 5", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const seed = await book(db, provider, { action: "propose", passengers: 4, key: "seed-4pax01", name: "A" });
        const [one, two] = await Promise.allSettled([
            book(db, provider, { action: "join", journeyId: seed.journeyId, key: "last-seat-a", name: "B" }),
            book(db, provider, { action: "join", journeyId: seed.journeyId, key: "last-seat-b", name: "C" }),
        ]);
        const ok = [one, two].filter((row) => row.status === "fulfilled");
        const rejected = [one, two].filter((row) => row.status === "rejected");
        strict_1.default.equal(ok.length, 1);
        strict_1.default.equal(rejected.length, 1);
        const journey = db.journeys.get(String(seed.journeyId));
        strict_1.default.equal(journey?.occupiedSeats, 5);
        strict_1.default.equal((0, logic_1.remainingSeats)(journey.occupiedSeats, 5), 0);
        strict_1.default.ok((journey?.occupiedSeats || 0) <= 5);
    });
    (0, node_test_1.it)("does not charge at booking; four passengers only become ready for payment setup", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", passengers: 4, key: "pay-a-0001", name: "A" });
        const journey = db.journeys.get(String(first.journeyId));
        strict_1.default.equal(journey?.status, "READY_FOR_PAYMENT_SETUP");
        const statuses = [...db.bookings.values()].map((row) => row.reservationStatus);
        strict_1.default.ok(statuses.every((row) => row === "PROVISIONAL"));
        strict_1.default.ok([...db.payments.values()].every((row) => row.provider === "hosted_payment_link"));
    });
    (0, node_test_1.it)("does not confirm when one of five authorisations fails", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", key: "fail-a-0001", name: "A" });
        await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-b-0001", name: "B" });
        await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-c-0001", name: "C" });
        await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-d-0001", name: "D" });
        await book(db, provider, { action: "join", journeyId: first.journeyId, key: "fail-e-0001", name: "E" });
        const bookings = [...db.bookings.values()];
        const flags = {};
        bookings.forEach((row, index) => {
            flags[row.id] = index !== 4;
        });
        for (const booking of bookings) {
            booking.paymentStatus = "PAYMENT_METHOD_VERIFIED";
            const payment = booking.paymentId ? db.payments.get(booking.paymentId) : undefined;
            if (payment)
                payment.status = "PAYMENT_METHOD_VERIFIED";
        }
        const journey = db.journeys.get(String(first.journeyId));
        journey.status = "FULL";
        const result = await (0, bookingFlow_1.confirmIfEligible)(db, provider, journey.id, undefined, flags);
        strict_1.default.equal(result.ok, false);
        strict_1.default.equal(result.status, "PAYMENT_ACTION_REQUIRED");
        strict_1.default.equal(result.failedBookingIds.length, 1);
        strict_1.default.ok([...db.bookings.values()].every((row) => row.paymentStatus !== "CAPTURED"));
    });
    (0, node_test_1.it)("voids successful authorisations if a failed payer is released", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", passengers: 4, key: "void-a-0001", name: "A" });
        await book(db, provider, { action: "join", journeyId: first.journeyId, key: "void-b-0001", name: "B" });
        const bookings = [...db.bookings.values()];
        const flags = { [bookings[0].id]: true, [bookings[1].id]: false };
        for (const booking of bookings) {
            booking.paymentStatus = "PAYMENT_METHOD_VERIFIED";
            const payment = booking.paymentId ? db.payments.get(booking.paymentId) : undefined;
            if (payment)
                payment.status = "PAYMENT_METHOD_VERIFIED";
        }
        db.journeys.get(String(first.journeyId)).status = "FULL";
        const result = await (0, bookingFlow_1.confirmIfEligible)(db, provider, String(first.journeyId), undefined, flags);
        await (0, bookingFlow_1.resolvePaymentFailure)(db, provider, String(first.journeyId), result.failedBookingIds[0]);
        const remaining = [...db.bookings.values()].filter((row) => row.paymentStatus !== "AUTHORISATION_RELEASED" && row.paymentStatus !== "FAILED");
        strict_1.default.ok(remaining.every((row) => row.paymentStatus === "PAYMENT_METHOD_VERIFIED" || row.paymentStatus === "AUTHORISATION_RELEASED"));
        strict_1.default.ok([...db.payments.values()].every((row) => row.status !== "CAPTURED"));
    });
    (0, node_test_1.it)("expires an unfilled journey without charging", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", key: "exp-a-0001", name: "A" });
        const journey = db.journeys.get(String(first.journeyId));
        journey.confirmationDeadlineAt = "2020-01-01T00:00:00.000Z";
        const result = await (0, bookingFlow_1.expireOpenJourneys)(db, provider, "2026-10-12T12:00:00.000Z");
        strict_1.default.equal(result.expired, 1);
        strict_1.default.equal(db.journeys.get(journey.id)?.status, "EXPIRED");
        strict_1.default.equal([...db.bookings.values()][0].paymentStatus, "HOSTED_UNPAID");
    });
    (0, node_test_1.it)("requires every booking to accept the four-passenger fare", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", passengers: 2, key: "four-a-0001", name: "A" });
        await book(db, provider, { action: "join", journeyId: first.journeyId, passengers: 2, key: "four-b-0001", name: "B" });
        const offer = await (0, bookingFlow_1.offerEarlyDeparture)(db, String(first.journeyId));
        strict_1.default.equal(offer.proposedFarePence, 4375);
        const bookings = [...db.bookings.values()];
        const one = (0, bookingFlow_1.acceptEarlyDeparture)(db, String(first.journeyId), bookings[0].id, true);
        strict_1.default.equal(one.confirmed, false);
        (0, bookingFlow_1.acceptEarlyDeparture)(db, String(first.journeyId), bookings[1].id, false);
        const rejected = (0, bookingFlow_1.acceptEarlyDeparture)(db, String(first.journeyId), bookings[1].id, false);
        strict_1.default.equal(rejected.confirmed, false);
    });
    (0, node_test_1.it)("offers an expired waitlist place without charging", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const provider = new paymentProvider_1.MockPaymentProvider();
        const first = await book(db, provider, { action: "propose", passengers: 5, key: "wait-a-0001", name: "A" });
        (0, bookingFlow_1.addWaitlist)(db, String(first.journeyId), { passengers: 1, name: "Wait", email: "wait@example.com", termsAccepted: true });
        const journey = db.journeys.get(String(first.journeyId));
        journey.occupiedSeats = 4;
        journey.status = "ALMOST_FULL";
        const offered = await (0, bookingFlow_1.offerWaitlistIfPossible)(db, journey.id);
        strict_1.default.equal(offered?.status, "OFFERED");
        strict_1.default.ok(offered?.offerExpiresAt);
        strict_1.default.equal([...db.bookings.values()].length, 1);
    });
    (0, node_test_1.it)("blocks a departure that misses the flight safety buffer", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        await strict_1.default.rejects(() => (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
            action: "propose",
            airportId: "heathrow",
            travelDate: "2026-10-13",
            preferredDepartureTime: "10:30",
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            contact: { ...contact("Late"), flightDepartureTime: "11:00" },
            idempotencyKey: "flight-late01",
            termsAccepted: true,
        }));
    });
});
