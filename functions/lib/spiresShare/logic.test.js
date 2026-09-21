"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const defaults_1 = require("./defaults");
const logic_1 = require("./logic");
function journey(partial) {
    return {
        id: "j1",
        publicNumber: "SS-TEST-001",
        airportId: "heathrow",
        travelDate: "2026-09-29",
        departureTime: "10:30",
        status: "FILLING",
        capacity: 5,
        occupiedSeats: 3,
        farePence: 3500,
        targetRevenuePence: 17500,
        earlyDepartureOffered: false,
        earlyDepartureAcceptedBookingIds: [],
        homeCollectionCount: 0,
        waitlistCount: 0,
        confirmationDeadlineAt: "2026-09-28T10:30:00.000Z",
        createdAt: "2026-09-20T00:00:00.000Z",
        updatedAt: "2026-09-20T00:00:00.000Z",
        ...partial,
    };
}
(0, node_test_1.describe)("occupancy", () => {
    (0, node_test_1.it)("labels 1/5 through 5/5", () => {
        for (let n = 1; n <= 5; n += 1) {
            strict_1.default.equal((0, logic_1.occupancyLabel)(n, 5), `${n}/5`);
        }
    });
    (0, node_test_1.it)("counts passengers not bookings", () => {
        const occupied = 2 + 1 + 2;
        strict_1.default.equal(occupied, 5);
        strict_1.default.equal((0, logic_1.remainingSeats)(occupied, 5), 0);
        strict_1.default.equal((0, logic_1.canAddPassengers)(occupied, 1, 5), false);
    });
    (0, node_test_1.it)("prevents 6/5", () => {
        strict_1.default.equal((0, logic_1.canAddPassengers)(5, 1, 5), false);
        strict_1.default.equal((0, logic_1.canAddPassengers)(4, 2, 5), false);
        strict_1.default.equal((0, logic_1.canAddPassengers)(3, 2, 5), true);
    });
});
(0, node_test_1.describe)("early departure equal split", () => {
    (0, node_test_1.it)("Heathrow 4-person equal split is target/4", () => {
        strict_1.default.equal((0, logic_1.earlyDepartureFarePence)(17500, 4), 4375);
        strict_1.default.equal(4375 * 4, 17500);
    });
    (0, node_test_1.it)("Gatwick 4-person equal split is target/4", () => {
        strict_1.default.equal((0, logic_1.earlyDepartureFarePence)(22500, 4), 5625);
        strict_1.default.equal(5625 * 4, 22500);
    });
    (0, node_test_1.it)("only offers at 4/5 and requires all four acceptances", () => {
        strict_1.default.equal((0, logic_1.earlyDepartureEligible)(4, 5, 4, false), true);
        strict_1.default.equal((0, logic_1.earlyDepartureEligible)(3, 5, 4, false), false);
        strict_1.default.equal((0, logic_1.earlyDepartureEligible)(5, 5, 4, false), false);
        strict_1.default.equal((0, logic_1.earlyDepartureConfirmed)(3, 4), false);
        strict_1.default.equal((0, logic_1.earlyDepartureConfirmed)(4, 4), true);
        strict_1.default.equal((0, logic_1.acceptedPassengerCount)([
            { earlyDepartureAccepted: true, passengers: 2 },
            { earlyDepartureAccepted: true, passengers: 1 },
            { earlyDepartureAccepted: false, passengers: 1 },
        ]), 3);
    });
});
(0, node_test_1.describe)("matching", () => {
    (0, node_test_1.it)("matches within flexibility", () => {
        strict_1.default.equal((0, logic_1.timesCompatible)("10:15", "10:30", "plus_minus_15"), true);
        strict_1.default.equal((0, logic_1.timesCompatible)("10:15", "10:30", "exact"), false);
        const found = (0, logic_1.matchJourneys)({
            airportId: "heathrow",
            travelDate: "2026-09-29",
            preferredDepartureTime: "10:15",
            flexibility: "plus_minus_30",
            passengers: 2,
            luggage: { largeSuitcases: 2, cabinBags: 2, other: "" },
        }, [journey({ occupiedSeats: 3 })], defaults_1.DEFAULT_SHARE_CONFIG, {});
        strict_1.default.equal(found.length, 1);
    });
    (0, node_test_1.it)("rejects incompatible flight times", () => {
        strict_1.default.equal((0, logic_1.flightCompatible)("10:30", 75, "11:00", 180), false);
        strict_1.default.equal((0, logic_1.flightCompatible)("06:00", 75, "12:00", 180), true);
        const found = (0, logic_1.matchJourneys)({
            airportId: "heathrow",
            travelDate: "2026-09-29",
            preferredDepartureTime: "10:30",
            flexibility: "plus_minus_30",
            flightDepartureTime: "11:00",
            passengers: 1,
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
        }, [journey({})], defaults_1.DEFAULT_SHARE_CONFIG, {});
        strict_1.default.equal(found.length, 0);
    });
});
(0, node_test_1.describe)("payments and confirmation", () => {
    (0, node_test_1.it)("payment failure does not secure a seat", () => {
        const provider = new logic_1.MockPaymentProvider();
        const failed = provider.authorise("p1", 3500, false);
        strict_1.default.equal(failed.status, "FAILED");
        strict_1.default.equal((0, logic_1.paymentSecuresSeat)(failed.status), false);
    });
    (0, node_test_1.it)("cancelled journey releases mock authorisations", () => {
        const provider = new logic_1.MockPaymentProvider();
        provider.authorise("p2", 3500, true);
        const released = provider.release("p2");
        strict_1.default.equal(released.status, "AUTHORISATION_RELEASED");
    });
    (0, node_test_1.it)("duplicate confirmation is blocked once CONFIRMED", () => {
        strict_1.default.equal((0, logic_1.statusFromOccupancy)(5, 5, "CONFIRMED"), "CONFIRMED");
        strict_1.default.equal((0, logic_1.earlyDepartureEligible)(4, 5, 4, true), false);
        strict_1.default.equal((0, logic_1.mockCaptureIfAuthorised)("CAPTURED"), "CAPTURED");
        strict_1.default.equal((0, logic_1.mockCaptureIfAuthorised)("AUTHORISED"), "CAPTURED");
        strict_1.default.equal((0, logic_1.mockReleaseIfOpen)("AUTHORISED"), "AUTHORISATION_RELEASED");
    });
});
(0, node_test_1.describe)("waitlist, luggage, privacy, flag", () => {
    (0, node_test_1.it)("waitlist is used when remaining seats are zero", () => {
        strict_1.default.equal((0, logic_1.remainingSeats)(5, 5), 0);
        strict_1.default.equal(defaults_1.DEFAULT_SHARE_CONFIG.waitlistEnabled, true);
        const entries = [
            { id: "w1", status: "WAITLISTED", passengers: 1, createdAt: "2026-09-20T10:00:00.000Z" },
            { id: "w2", status: "WAITLISTED", passengers: 1, createdAt: "2026-09-20T11:00:00.000Z" },
        ];
        strict_1.default.equal((0, logic_1.nextCompatibleWaitlistOffer)(entries, 1)?.id, "w1");
        strict_1.default.equal((0, logic_1.nextCompatibleWaitlistOffer)([{ ...entries[0], status: "OFFERED" }, entries[1]], 1), null);
        strict_1.default.equal((0, logic_1.canMovePassengers)(3, 4, 1, 5), true);
        strict_1.default.equal((0, logic_1.canMovePassengers)(3, 5, 1, 5), false);
    });
    (0, node_test_1.it)("rejects luggage over vehicle limits", () => {
        const existing = [
            {
                id: "b1",
                journeyId: "j1",
                passengers: 4,
                name: "hidden",
                mobile: "hidden",
                email: "hidden",
                flexibility: "exact",
                luggage: { largeSuitcases: 4, cabinBags: 4, other: "" },
                homeCollection: "HOME_COLLECTION_UNAVAILABLE",
                homeCollectionSurchargePence: 0,
                paymentStatus: "AUTHORISED",
                boardStatus: "NOT_CHECKED_IN",
                earlyDepartureAccepted: false,
                createdAt: "",
            },
        ];
        strict_1.default.equal((0, logic_1.luggageFits)(existing.map((row) => row.luggage), { largeSuitcases: 2, cabinBags: 0, other: "" }, 5, 5), false);
    });
    (0, node_test_1.it)("never sends private origin or passenger PII in public views", () => {
        const pub = (0, logic_1.toPublicJourney)(journey({ occupiedSeats: 4 }), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal("name" in pub, false);
        strict_1.default.equal("mobile" in pub, false);
        strict_1.default.equal("privateOrigin" in pub, false);
        const stripped = (0, logic_1.stripPrivateFields)({
            airportId: "heathrow",
            name: "Jane",
            mobile: "07700",
            email: "a@b.c",
            homePostcode: "OX4 1AA",
            privateOrigin: "SECRET_YARD",
            flightNumber: "BA123",
        });
        strict_1.default.equal(stripped.name, undefined);
        strict_1.default.equal(stripped.privateOrigin, undefined);
        strict_1.default.equal(stripped.airportId, "heathrow");
        const home = (0, logic_1.evaluateHomeCollection)("OX4 1AA", 0, 2, 1500);
        strict_1.default.match(home.message, /Home collection available/);
        strict_1.default.equal(home.message.includes("SECRET"), false);
    });
    (0, node_test_1.it)("public access stays disabled by default", () => {
        strict_1.default.equal(defaults_1.DEFAULT_SHARE_CONFIG.publicEnabled, false);
        strict_1.default.equal(process.env.SPIRES_SHARE_ENABLED || "false", "false");
    });
});
