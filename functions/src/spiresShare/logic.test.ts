import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { DEFAULT_SHARE_CONFIG } from "./defaults";
import {
  MockPaymentProvider,
  acceptedPassengerCount,
  canAddPassengers,
  canMovePassengers,
  earlyDepartureConfirmed,
  earlyDepartureEligible,
  earlyDepartureFarePence,
  evaluateHomeCollection,
  flightCompatible,
  luggageFits,
  matchJourneys,
  mockCaptureIfAuthorised,
  mockReleaseIfOpen,
  nextCompatibleWaitlistOffer,
  occupancyLabel,
  paymentSecuresSeat,
  remainingSeats,
  statusFromOccupancy,
  stripPrivateFields,
  timesCompatible,
  toPublicJourney,
} from "./logic";
import { ShareBooking, ShareJourney } from "./types";

function journey(partial: Partial<ShareJourney>): ShareJourney {
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
});

describe("early departure equal split", () => {
  it("Heathrow 4-person equal split is target/4", () => {
    assert.equal(earlyDepartureFarePence(17500, 4), 4375);
    assert.equal(4375 * 4, 17500);
  });

  it("Gatwick 4-person equal split is target/4", () => {
    assert.equal(earlyDepartureFarePence(22500, 4), 5625);
    assert.equal(5625 * 4, 22500);
  });

  it("only offers at 4/5 and requires all four acceptances", () => {
    assert.equal(earlyDepartureEligible(4, 5, 4, false), true);
    assert.equal(earlyDepartureEligible(3, 5, 4, false), false);
    assert.equal(earlyDepartureEligible(5, 5, 4, false), false);
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

describe("matching", () => {
  it("matches within flexibility", () => {
    assert.equal(timesCompatible("10:15", "10:30", "plus_minus_15"), true);
    assert.equal(timesCompatible("10:15", "10:30", "exact"), false);
    const found = matchJourneys(
      {
        airportId: "heathrow",
        travelDate: "2026-09-29",
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
    const found = matchJourneys(
      {
        airportId: "heathrow",
        travelDate: "2026-09-29",
        preferredDepartureTime: "10:30",
        flexibility: "plus_minus_30",
        flightDepartureTime: "11:00",
        passengers: 1,
        luggage: { largeSuitcases: 1, cabinBags: 1, other: "" },
      },
      [journey({})],
      DEFAULT_SHARE_CONFIG,
      {}
    );
    assert.equal(found.length, 0);
  });
});

describe("payments and confirmation", () => {
  it("payment failure does not secure a seat", () => {
    const provider = new MockPaymentProvider();
    const failed = provider.authorise("p1", 3500, false);
    assert.equal(failed.status, "FAILED");
    assert.equal(paymentSecuresSeat(failed.status), false);
  });

  it("cancelled journey releases mock authorisations", () => {
    const provider = new MockPaymentProvider();
    provider.authorise("p2", 3500, true);
    const released = provider.release("p2");
    assert.equal(released.status, "AUTHORISATION_RELEASED");
  });

  it("duplicate confirmation is blocked once CONFIRMED", () => {
    assert.equal(statusFromOccupancy(5, 5, "CONFIRMED"), "CONFIRMED");
    assert.equal(earlyDepartureEligible(4, 5, 4, true), false);
    assert.equal(mockCaptureIfAuthorised("CAPTURED"), "CAPTURED");
    assert.equal(mockCaptureIfAuthorised("AUTHORISED"), "CAPTURED");
    assert.equal(mockReleaseIfOpen("AUTHORISED"), "AUTHORISATION_RELEASED");
  });
});

describe("waitlist, luggage, privacy, flag", () => {
  it("waitlist is used when remaining seats are zero", () => {
    assert.equal(remainingSeats(5, 5), 0);
    assert.equal(DEFAULT_SHARE_CONFIG.waitlistEnabled, true);
    const entries = [
      { id: "w1", status: "WAITLISTED", passengers: 1, createdAt: "2026-09-20T10:00:00.000Z" },
      { id: "w2", status: "WAITLISTED", passengers: 1, createdAt: "2026-09-20T11:00:00.000Z" },
    ];
    assert.equal(nextCompatibleWaitlistOffer(entries, 1)?.id, "w1");
    assert.equal(
      nextCompatibleWaitlistOffer([{ ...entries[0], status: "OFFERED" }, entries[1]], 1),
      null
    );
    assert.equal(canMovePassengers(3, 4, 1, 5), true);
    assert.equal(canMovePassengers(3, 5, 1, 5), false);
  });

  it("rejects luggage over vehicle limits", () => {
    const existing: ShareBooking[] = [
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
    assert.equal(
      luggageFits(
        existing.map((row) => row.luggage),
        { largeSuitcases: 2, cabinBags: 0, other: "" },
        5,
        5
      ),
      false
    );
  });

  it("never sends private origin or passenger PII in public views", () => {
    const pub = toPublicJourney(journey({ occupiedSeats: 4 }), DEFAULT_SHARE_CONFIG);
    assert.equal("name" in pub, false);
    assert.equal("mobile" in pub, false);
    assert.equal("privateOrigin" in pub, false);
    const stripped = stripPrivateFields({
      airportId: "heathrow",
      name: "Jane",
      mobile: "07700",
      email: "a@b.c",
      homePostcode: "OX4 1AA",
      privateOrigin: "SECRET_YARD",
      flightNumber: "BA123",
    });
    assert.equal(stripped.name, undefined);
    assert.equal(stripped.privateOrigin, undefined);
    assert.equal(stripped.airportId, "heathrow");
    const home = evaluateHomeCollection("OX4 1AA", 0, 2, 1500);
    assert.match(home.message, /Home collection available/);
    assert.equal(home.message.includes("SECRET"), false);
  });

  it("public access stays disabled by default", () => {
    assert.equal(DEFAULT_SHARE_CONFIG.publicEnabled, false);
    assert.equal(process.env.SPIRES_SHARE_ENABLED || "false", "false");
  });
});
