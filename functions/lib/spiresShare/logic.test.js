"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const defaults_1 = require("./defaults");
const paymentProvider_1 = require("./paymentProvider");
const logic_1 = require("./logic");
const bookingFlow_1 = require("./bookingFlow");
function journey(partial) {
    return {
        id: "j1",
        publicNumber: "SS-TEST-001",
        airportId: "heathrow",
        travelDate: "2026-10-13",
        departureTime: "10:30",
        departureAt: "2026-10-13T09:30:00.000Z",
        confirmationDeadlineAt: "2026-10-12T09:30:00.000Z",
        status: "FILLING",
        capacity: 5,
        occupiedSeats: 3,
        farePence: 3500,
        targetRevenuePence: 17500,
        dropoffMode: "per_passenger_terminal",
        earlyDepartureOffered: false,
        earlyDepartureAcceptedBookingIds: [],
        homeCollectionCount: 0,
        waitlistCount: 0,
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
    (0, node_test_1.it)("rejects a party larger than commercial capacity", () => {
        strict_1.default.throws(() => (0, logic_1.assertPartyFitsCapacity)(6, 5));
        strict_1.default.doesNotThrow(() => (0, logic_1.assertPartyFitsCapacity)(5, 5));
    });
});
(0, node_test_1.describe)("early departure equal split", () => {
    (0, node_test_1.it)("Heathrow 4-person equal split is target/4", () => {
        strict_1.default.equal((0, logic_1.earlyDepartureFarePence)(17500, 4), 4375);
        strict_1.default.equal(4375 * 4, 17500);
    });
    (0, node_test_1.it)("only offers at 4/5 and requires all four passenger-places to accept", () => {
        strict_1.default.equal((0, logic_1.earlyDepartureEligible)(4, 5, 4, false), true);
        strict_1.default.equal((0, logic_1.earlyDepartureEligible)(3, 5, 4, false), false);
        strict_1.default.equal((0, logic_1.earlyDepartureConfirmed)(3, 4), false);
        strict_1.default.equal((0, logic_1.earlyDepartureConfirmed)(4, 4), true);
        strict_1.default.equal((0, logic_1.acceptedPassengerCount)([
            { earlyDepartureAccepted: true, passengers: 2 },
            { earlyDepartureAccepted: true, passengers: 1 },
            { earlyDepartureAccepted: false, passengers: 1 },
        ]), 3);
    });
});
(0, node_test_1.describe)("matching and luggage payload", () => {
    (0, node_test_1.it)("parses luggage from nested or flat payloads", () => {
        strict_1.default.deepEqual((0, bookingFlow_1.parseLuggage)({ luggage: { largeSuitcases: 1, cabinBags: 1 } }, 1), {
            largeSuitcases: 1,
            cabinBags: 1,
            other: "",
        });
        strict_1.default.deepEqual((0, bookingFlow_1.parseLuggage)({ largeSuitcases: 2, cabinBags: 1 }, 2), {
            largeSuitcases: 2,
            cabinBags: 1,
            other: "",
        });
    });
    (0, node_test_1.it)("matches within flexibility", () => {
        strict_1.default.equal((0, logic_1.timesCompatible)("10:15", "10:30", "plus_minus_15"), true);
        const found = (0, logic_1.matchJourneys)({
            airportId: "heathrow",
            travelDate: "2026-10-13",
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
    });
    (0, node_test_1.it)("enforces per-passenger and vehicle luggage caps", () => {
        strict_1.default.equal((0, logic_1.luggageFitsPassengerAllowance)({ largeSuitcases: 2, cabinBags: 0, other: "" }, 1, 1, 1), false);
        strict_1.default.equal((0, logic_1.luggageFitsPassengerAllowance)({ largeSuitcases: 1, cabinBags: 1, other: "" }, 1, 1, 1), true);
        strict_1.default.equal((0, logic_1.luggageFitsVehicle)([{ largeSuitcases: 4, cabinBags: 4, other: "" }], { largeSuitcases: 2, cabinBags: 0, other: "" }, 5, 5), false);
    });
});
(0, node_test_1.describe)("payments", () => {
    (0, node_test_1.it)("verified payment methods secure a place without authorising funds", () => {
        strict_1.default.equal((0, paymentProvider_1.paymentSecuresSeat)("PAYMENT_METHOD_VERIFIED"), true);
        strict_1.default.equal((0, paymentProvider_1.paymentSecuresSeat)("AUTHORISED"), true);
        strict_1.default.equal((0, paymentProvider_1.paymentSecuresSeat)("FAILED"), false);
        strict_1.default.equal((0, paymentProvider_1.paymentCanRelease)("PAYMENT_METHOD_VERIFIED"), true);
        strict_1.default.equal((0, paymentProvider_1.paymentCanRelease)("CAPTURED"), false);
    });
    (0, node_test_1.it)("payment method failure does not secure a place", async () => {
        const provider = new paymentProvider_1.MockPaymentProvider();
        const failed = await provider.verifyPaymentMethod({ succeed: false });
        strict_1.default.equal(failed.status, "FAILED");
        strict_1.default.equal((0, paymentProvider_1.paymentSecuresSeat)(failed.status), false);
    });
});
(0, node_test_1.describe)("privacy and public DTO", () => {
    (0, node_test_1.it)("never sends PII, flight numbers or payment ids in public views", () => {
        const pub = (0, logic_1.toPublicJourney)(journey({ occupiedSeats: 4 }), defaults_1.DEFAULT_SHARE_CONFIG);
        strict_1.default.equal("name" in pub, false);
        strict_1.default.equal("flightNumber" in pub, false);
        strict_1.default.equal("id" in pub, false);
        strict_1.default.equal(pub.destinationLabel, "Heathrow Airport");
        strict_1.default.equal(pub.guarantee, "PROVISIONAL");
        strict_1.default.equal((0, logic_1.publicStatusFromJourney)(journey({ occupiedSeats: 4, status: "ALMOST_FULL" })).publicStatus, "ALMOST_FULL");
        const stripped = (0, logic_1.stripPrivateFields)({
            airportId: "heathrow",
            name: "Jane",
            paymentId: "pay_secret",
            flightNumber: "BA123",
            manageTokenHash: "abc",
        });
        strict_1.default.equal(stripped.name, undefined);
        strict_1.default.equal(stripped.paymentId, undefined);
        strict_1.default.equal(stripped.flightNumber, undefined);
    });
    (0, node_test_1.it)("home collection stays disabled for the Heathrow MVP", () => {
        const home = (0, logic_1.evaluateHomeCollection)("OX4 1AA", 0, 2, 1500, false);
        strict_1.default.equal(home.eligibility, "HOME_COLLECTION_UNAVAILABLE");
    });
    (0, node_test_1.it)("public access stays disabled by default", () => {
        strict_1.default.equal(defaults_1.DEFAULT_SHARE_CONFIG.publicEnabled, false);
        strict_1.default.equal(process.env.SPIRES_SHARE_ENABLED || "false", "false");
        strict_1.default.equal(process.env.SPIRES_SHARE_PILOT || "false", "false");
        strict_1.default.deepEqual(defaults_1.DEFAULT_SHARE_CONFIG.mvpAirportIds, ["heathrow"]);
        strict_1.default.equal(defaults_1.DEFAULT_SHARE_CONFIG.homeCollectionCustomerEnabled, false);
    });
    (0, node_test_1.it)("CONFIRMED occupancy does not revert", () => {
        strict_1.default.equal((0, logic_1.statusFromOccupancy)(5, 5, "CONFIRMED"), "CONFIRMED");
        strict_1.default.equal((0, logic_1.canMovePassengers)(3, 4, 1, 5), true);
    });
});
(0, node_test_1.describe)("types smoke", () => {
    (0, node_test_1.it)("keeps a booking type usable in luggage tests", () => {
        const row = {
            id: "b1",
            journeyId: "j1",
            publicNumber: "SS",
            passengers: 1,
            name: "hidden",
            mobile: "hidden",
            email: "hidden",
            flexibility: "exact",
            luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
            homeCollection: "HOME_COLLECTION_UNAVAILABLE",
            homeCollectionSurchargePence: 0,
            paymentStatus: "PAYMENT_METHOD_VERIFIED",
            boardStatus: "NOT_CHECKED_IN",
            earlyDepartureAccepted: false,
            manageTokenHash: "x",
            idempotencyKey: "k",
            createdAt: "",
        };
        strict_1.default.equal(row.passengers, 1);
    });
});
