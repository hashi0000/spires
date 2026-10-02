import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import {
  MockPaymentProvider,
  paymentCanRelease,
  paymentSecuresSeat,
} from "./paymentProvider";
import {
  acceptedPassengerCount,
  assertPartyFitsCapacity,
  canAddPassengers,
  canMovePassengers,
  earlyDepartureConfirmed,
  earlyDepartureEligible,
  earlyDepartureFarePence,
  evaluateHomeCollection,
  flightCompatible,
  luggageFitsPassengerAllowance,
  luggageFitsVehicle,
  matchJourneys,
  occupancyLabel,
  publicStatusFromJourney,
  remainingSeats,
  statusFromOccupancy,
  stripPrivateFields,
  timesCompatible,
  toPublicJourney,
} from "./logic";
import { ShareBooking, ShareJourney } from "./types";
import { parseLuggage } from "./bookingFlow";

function journey(partial: Partial<ShareJourney>): ShareJourney {
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

describe("occupancy", () => {
  it("labels 1/5 through 5/5", () => {
    for (let n = 1; n <= 5; n += 1) {
      assert.equal(occupancyLabel(n, 5), `${n}/5`);
    }
  });

  it("counts passengers not bookings", () => {
    const occupied = 2 + 1 + 2;
    assert.equal(occupied, 5);
    assert.equal(remainingSeats(occupied, 5), 0);
    assert.equal(canAddPassengers(occupied, 1, 5), false);
  });

  it("prevents 6/5", () => {
    assert.equal(canAddPassengers(5, 1, 5), false);
    assert.equal(canAddPassengers(4, 2, 5), false);
    assert.equal(canAddPassengers(3, 2, 5), true);
  });

  it("rejects a party larger than commercial capacity", () => {
    assert.throws(() => assertPartyFitsCapacity(6, 5));
    assert.doesNotThrow(() => assertPartyFitsCapacity(5, 5));
  });
});

describe("early departure equal split", () => {
  it("Heathrow 4-person equal split is target/4", () => {
    assert.equal(earlyDepartureFarePence(17500, 4), 4375);
    assert.equal(4375 * 4, 17500);
  });

  it("only offers at 4/5 and requires all four passenger-places to accept", () => {
    assert.equal(earlyDepartureEligible(4, 5, 4, false), true);
    assert.equal(earlyDepartureEligible(3, 5, 4, false), false);
    assert.equal(earlyDepartureConfirmed(3, 4), false);
    assert.equal(earlyDepartureConfirmed(4, 4), true);
    assert.equal(
      acceptedPassengerCount([
        { earlyDepartureAccepted: true, passengers: 2 },
        { earlyDepartureAccepted: true, passengers: 1 },
        { earlyDepartureAccepted: false, passengers: 1 },
      ]),
      3
    );
  });
});

describe("matching and luggage payload", () => {
  it("parses luggage from nested or flat payloads", () => {
    assert.deepEqual(parseLuggage({ luggage: { largeSuitcases: 1, cabinBags: 1 } }, 1), {
      largeSuitcases: 1,
      cabinBags: 1,
      other: "",
    });
    assert.deepEqual(parseLuggage({ largeSuitcases: 2, cabinBags: 1 }, 2), {
      largeSuitcases: 2,
      cabinBags: 1,
      other: "",
    });
  });

  it("matches within flexibility", () => {
    assert.equal(timesCompatible("10:15", "10:30", "plus_minus_15"), true);
    const found = matchJourneys(
      {
        airportId: "heathrow",
        travelDate: "2026-10-13",
        preferredDepartureTime: "10:15",
        flexibility: "plus_minus_30",
        passengers: 2,
        luggage: { largeSuitcases: 2, cabinBags: 2, other: "" },
      },
      [journey({ occupiedSeats: 3 })],
      DEFAULT_SHARE_CONFIG,
      {}
    );
    assert.equal(found.length, 1);
  });

  it("rejects incompatible flight times", () => {
    assert.equal(flightCompatible("10:30", 75, "11:00", 180), false);
    assert.equal(flightCompatible("06:00", 75, "12:00", 180), true);
  });

  it("enforces per-passenger and vehicle luggage caps", () => {
    assert.equal(luggageFitsPassengerAllowance({ largeSuitcases: 2, cabinBags: 0, other: "" }, 1, 1, 1), false);
    assert.equal(luggageFitsPassengerAllowance({ largeSuitcases: 1, cabinBags: 1, other: "" }, 1, 1, 1), true);
    assert.equal(
      luggageFitsVehicle([{ largeSuitcases: 4, cabinBags: 4, other: "" }], { largeSuitcases: 2, cabinBags: 0, other: "" }, 5, 5),
      false
    );
  });
});

describe("payments", () => {
  it("verified payment methods secure a place without authorising funds", () => {
    assert.equal(paymentSecuresSeat("PAYMENT_METHOD_VERIFIED"), true);
    assert.equal(paymentSecuresSeat("AUTHORISED"), true);
    assert.equal(paymentSecuresSeat("FAILED"), false);
    assert.equal(paymentCanRelease("PAYMENT_METHOD_VERIFIED"), true);
    assert.equal(paymentCanRelease("CAPTURED"), false);
  });

  it("payment method failure does not secure a place", async () => {
    const provider = new MockPaymentProvider();
    const failed = await provider.verifyPaymentMethod({ succeed: false });
    assert.equal(failed.status, "FAILED");
    assert.equal(paymentSecuresSeat(failed.status), false);
  });
});

describe("privacy and public DTO", () => {
  it("never sends PII, flight numbers or payment ids in public views", () => {
    const pub = toPublicJourney(journey({ occupiedSeats: 4 }), DEFAULT_SHARE_CONFIG);
    assert.equal("name" in pub, false);
    assert.equal("flightNumber" in pub, false);
    assert.equal("id" in pub, false);
    assert.equal(pub.destinationLabel, "Heathrow Airport");
    assert.equal(pub.guarantee, "PROVISIONAL");
    assert.equal(publicStatusFromJourney(journey({ occupiedSeats: 4, status: "ALMOST_FULL" })).publicStatus, "ALMOST_FULL");
    const stripped = stripPrivateFields({
      airportId: "heathrow",
      name: "Jane",
      paymentId: "pay_secret",
      flightNumber: "BA123",
      manageTokenHash: "abc",
    });
    assert.equal(stripped.name, undefined);
    assert.equal(stripped.paymentId, undefined);
    assert.equal(stripped.flightNumber, undefined);
  });

  it("home collection stays disabled for the Heathrow MVP", () => {
    const home = evaluateHomeCollection("OX4 1AA", 0, 2, 1500, false);
    assert.equal(home.eligibility, "HOME_COLLECTION_UNAVAILABLE");
  });

  it("public access stays disabled by default", () => {
    assert.equal(DEFAULT_SHARE_CONFIG.publicEnabled, false);
    assert.equal(process.env.SPIRES_SHARE_ENABLED || "false", "false");
    assert.equal(process.env.SPIRES_SHARE_PILOT || "false", "false");
    assert.deepEqual(DEFAULT_SHARE_CONFIG.mvpAirportIds, ["heathrow"]);
    assert.equal(DEFAULT_SHARE_CONFIG.homeCollectionCustomerEnabled, false);
  });

  it("CONFIRMED occupancy does not revert", () => {
    assert.equal(statusFromOccupancy(5, 5, "CONFIRMED"), "CONFIRMED");
    assert.equal(canMovePassengers(3, 4, 1, 5), true);
  });
});

describe("types smoke", () => {
  it("keeps a booking type usable in luggage tests", () => {
    const row: ShareBooking = {
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
    assert.equal(row.passengers, 1);
  });
});
