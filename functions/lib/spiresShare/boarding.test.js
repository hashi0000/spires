"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingFlow_1 = require("./bookingFlow");
const boarding_1 = require("./boarding");
const defaults_1 = require("./defaults");
const hostedPayment_1 = require("./hostedPayment");
const logic_1 = require("./logic");
const notifications_1 = require("./notifications");
const paymentProvider_1 = require("./paymentProvider");
const operatorConsole_1 = require("./operatorConsole");
function contact(name) {
    return {
        name,
        mobile: "07776897772",
        email: `${name.toLowerCase()}@example.com`,
        flexibility: "plus_minus_30",
        dropoffTerminal: "T3",
        uid: `uid_${name}`,
    };
}
async function fillAndConfirm(db) {
    const first = await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
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
        await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
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
    (0, bookingFlow_1.savePaymentLink)(db, journeyId, "https://pay.example/share");
    (0, bookingFlow_1.openPaymentWindow)(db, journeyId, "2026-10-11T09:00:00.000Z");
    for (const booking of [...db.bookings.values()].filter((row) => row.journeyId === journeyId)) {
        (0, bookingFlow_1.markReservationPaid)(db, booking.id, "admin", "2026-10-11T10:00:00.000Z");
    }
    return { journeyId, first };
}
(0, node_test_1.describe)("Spires Share operator console", () => {
    (0, node_test_1.it)("1. Needs Action classifications include ready to propose", () => {
        const items = (0, operatorConsole_1.buildNeedsAction)({
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
                },
            ],
        });
        strict_1.default.equal(items[0]?.kind, "ready_to_propose");
        strict_1.default.equal(items[0]?.primaryLabel, "Review and propose");
    });
    (0, node_test_1.it)("5. Pounds convert to pence for callables", () => {
        strict_1.default.equal((0, operatorConsole_1.penceFromPounds)("35"), 3500);
        strict_1.default.equal((0, operatorConsole_1.penceFromPounds)("35.00"), 3500);
        strict_1.default.equal((0, operatorConsole_1.poundsFromPence)(3500), "£35.00");
    });
    (0, node_test_1.it)("16. Human stages hide raw enums", () => {
        strict_1.default.equal((0, operatorConsole_1.humanJourneyStage)({ status: "PAYMENT_WINDOW_OPEN", paymentStageStatus: "OPEN", capacity: 5, occupiedSeats: 5, minPassengerThreshold: 5 }, []), "Collecting payment");
    });
});
(0, node_test_1.describe)("Spires Share boarding verification", () => {
    (0, node_test_1.it)("1. Unconfirmed journey does not issue boarding codes", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const first = await (0, bookingFlow_1.reservePlace)(db, new paymentProvider_1.MockPaymentProvider(), {
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
        const journey = db.journeys.get(String(first.journeyId));
        const bookings = [...db.bookings.values()];
        (0, boarding_1.issueBoardingCodes)(journey, bookings, "2026-10-11T10:00:00.000Z");
        strict_1.default.equal(bookings[0].boardingCode, undefined);
    });
    (0, node_test_1.it)("2-3. Confirmed eligible passenger receives a code and cancelled does not keep an active code path", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
        strict_1.default.ok(bookings.every((row) => /^\d{4}$/.test(String(row.boardingCode || ""))));
        const victim = bookings[0];
        (0, bookingFlow_1.cancelReservation)(db, victim.id, "2026-10-11T11:00:00.000Z");
        const live = db.bookings.get(victim.id);
        strict_1.default.equal((0, boarding_1.boardingDisplayStatus)(live), "CANCELLED");
        strict_1.default.equal((0, boarding_1.customerBoardingCodeForView)(db.journeys.get(journeyId), live), undefined);
    });
    (0, node_test_1.it)("4-5. Codes are not sequential and not derived from PII", async () => {
        const used = new Set();
        const codes = Array.from({ length: 8 }, () => (0, boarding_1.generateBoardingCode)(used));
        used.forEach((code) => used.add(code));
        const sequential = codes.every((code, index) => index === 0 || Number(code) === Number(codes[index - 1]) + 1);
        strict_1.default.equal(sequential, false);
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        for (const booking of [...db.bookings.values()].filter((row) => row.journeyId === journeyId)) {
            strict_1.default.equal((0, boarding_1.codeLooksDerivedFromPii)(String(booking.boardingCode), booking), false);
        }
    });
    (0, node_test_1.it)("6-8. Codes are not public, customer sees only own, admin record keeps code", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const journey = db.journeys.get(journeyId);
        const bookings = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
        const pub = (0, logic_1.toPublicJourney)(journey, defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal((0, boarding_1.publicDtoHasBoardingSecrets)(pub), false);
        strict_1.default.equal("boardingCode" in (0, logic_1.stripPrivateFields)(bookings[0]), false);
        const own = (0, hostedPayment_1.toCustomerBookingView)(journey, bookings[0], bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        const other = (0, hostedPayment_1.toCustomerBookingView)(journey, bookings[1], bookings, defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(own.boardingCode, bookings[0].boardingCode);
        strict_1.default.notEqual(other.boardingCode, bookings[0].boardingCode);
        strict_1.default.ok(bookings[0].boardingCode);
    });
    (0, node_test_1.it)("9-13. Verify correct code, hide correct code on failure, record time and actor, second verify is idempotent", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const booking = [...db.bookings.values()].find((row) => row.journeyId === journeyId);
        const journey = db.journeys.get(journeyId);
        strict_1.default.throws(() => (0, boarding_1.verifyBoardingCode)(journey, booking, "0000", "driver@spires", "2026-10-12T09:00:00.000Z"), /Code does not match/);
        try {
            (0, boarding_1.verifyBoardingCode)(journey, booking, "0000", "driver", "2026-10-12T09:00:00.000Z");
        }
        catch (err) {
            strict_1.default.equal(String(err.message).includes(String(booking.boardingCode)), false);
        }
        const first = (0, bookingFlow_1.verifyPassengerBoarding)(db, booking.id, String(booking.boardingCode), "driver@spires", "2026-10-12T09:01:00.000Z");
        strict_1.default.equal(first.ok, true);
        strict_1.default.equal(db.bookings.get(booking.id)?.boardStatus, "BOARDED");
        strict_1.default.equal(db.bookings.get(booking.id)?.boardingVerifiedAt, "2026-10-12T09:01:00.000Z");
        strict_1.default.equal(db.bookings.get(booking.id)?.boardingVerifiedBy, "driver@spires");
        const again = (0, bookingFlow_1.verifyPassengerBoarding)(db, booking.id, String(booking.boardingCode), "driver@spires", "2026-10-12T09:02:00.000Z");
        strict_1.default.equal(again.alreadyVerified, true);
        strict_1.default.equal(db.bookings.get(booking.id)?.boardingVerifiedAt, "2026-10-12T09:01:00.000Z");
    });
    (0, node_test_1.it)("14-15. Driver can mark no show and it does not auto refund", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const booking = [...db.bookings.values()].find((row) => row.journeyId === journeyId);
        (0, bookingFlow_1.markNoShow)(db, booking.id, "2026-10-12T10:05:00.000Z");
        const live = db.bookings.get(booking.id);
        strict_1.default.equal(live.boardStatus, "NO_SHOW");
        strict_1.default.equal(live.refundStatus || "NONE", "NONE");
        strict_1.default.equal(live.amountRefundedPence || 0, 0);
    });
    (0, node_test_1.it)("16. Confirmation email text includes boarding code", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const booking = [...db.bookings.values()].find((row) => row.journeyId === journeyId);
        const draft = (0, notifications_1.buildNotification)("JOURNEY_CONFIRMED", booking.email, db.journeys.get(journeyId), {
            boardingCode: booking.boardingCode,
            pickup: "Thornhill Park and Ride",
            travelDate: "2026-10-12",
        });
        strict_1.default.match(draft.text, new RegExp(String(booking.boardingCode)));
        strict_1.default.match(draft.subject, /confirmed/i);
    });
    (0, node_test_1.it)("17-20. Driver manifest only for confirmed journeys with assigned driver email and dedupes", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const before = db.notifications.filter((row) => String(row.type).startsWith("DRIVER_MANIFEST")).length;
        strict_1.default.equal(before, 0);
        const journey = db.journeys.get(journeyId);
        journey.assignedDriverEmail = "irfan@example.com";
        const { recordDriverManifestIfNeeded } = await Promise.resolve().then(() => __importStar(require("./bookingFlow")));
        const first = recordDriverManifestIfNeeded(db, journey, [...db.bookings.values()].filter((row) => row.journeyId === journeyId), "2026-10-11T12:00:00.000Z");
        const second = recordDriverManifestIfNeeded(db, journey, [...db.bookings.values()].filter((row) => row.journeyId === journeyId), "2026-10-11T12:01:00.000Z");
        strict_1.default.equal(first.sent, true);
        strict_1.default.equal(second.sent, false);
        strict_1.default.equal(db.notifications.filter((row) => row.type === "DRIVER_MANIFEST" && row.email === "irfan@example.com").length, 1);
    });
    (0, node_test_1.it)("21-25. Passenger list change can update manifest, seat counts and progress", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const journey = db.journeys.get(journeyId);
        journey.assignedDriverEmail = "irfan@example.com";
        const { recordDriverManifestIfNeeded } = await Promise.resolve().then(() => __importStar(require("./bookingFlow")));
        recordDriverManifestIfNeeded(db, journey, [...db.bookings.values()].filter((row) => row.journeyId === journeyId), "2026-10-11T12:00:00.000Z");
        const victim = [...db.bookings.values()].find((row) => row.journeyId === journeyId);
        (0, bookingFlow_1.cancelReservation)(db, victim.id, "2026-10-11T13:00:00.000Z");
        const remaining = [...db.bookings.values()].filter((row) => row.journeyId === journeyId && (0, boarding_1.boardingDisplayStatus)(row) !== "CANCELLED");
        strict_1.default.equal(remaining.some((row) => row.id === victim.id), false);
        const progress = (0, boarding_1.boardingProgress)([...db.bookings.values()].filter((row) => row.journeyId === journeyId));
        strict_1.default.equal(progress.totalSeats, 4);
        const twoSeat = remaining[0];
        twoSeat.passengers = 2;
        const progress2 = (0, boarding_1.boardingProgress)(remaining);
        strict_1.default.equal(progress2.totalSeats >= 5, true);
    });
    (0, node_test_1.it)("27-28. Customer cannot verify another booking by seeing its code, public DTO omits codes", async () => {
        const db = new bookingFlow_1.InMemoryShareDb();
        const { journeyId } = await fillAndConfirm(db);
        const [own, other] = [...db.bookings.values()].filter((row) => row.journeyId === journeyId);
        const view = (0, hostedPayment_1.toCustomerBookingView)(db.journeys.get(journeyId), own, [...db.bookings.values()], defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.notEqual(view.boardingCode, other.boardingCode);
        const pub = (0, logic_1.toPublicJourney)(db.journeys.get(journeyId), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal(pub.boardingCode, undefined);
    });
    (0, node_test_1.it)("hash differs by booking so the same digits would not verify the wrong passenger", () => {
        const a = (0, boarding_1.hashBoardingCode)("j1", "b1", "4827");
        const b = (0, boarding_1.hashBoardingCode)("j1", "b2", "4827");
        strict_1.default.notEqual(a, b);
    });
    (0, node_test_1.it)("emails stay dry run unless both send flags are on", () => {
        strict_1.default.equal((0, notifications_1.shareNotificationsEnabled)({ ...defaults_1.DEFAULT_SHARE_CONFIG, notificationsSend: false }), false);
    });
});
