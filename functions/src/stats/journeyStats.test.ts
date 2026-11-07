import * as assert from "assert";
import { describe, it } from "node:test";
import { isCompletedJourneyBooking, previousCalendarMonth, publicJourneyView, summariseJourneys } from "./journeyStats";

const NOW = new Date("2026-11-07T08:00:00Z");

describe("completed journey statistics", () => {
  it("uses the previous London calendar month", () => {
    const period = previousCalendarMonth(NOW);
    assert.equal(period.key, "2026-10");
    assert.equal(period.label, "October 2026");
  });

  it("counts completed legs in that month and keeps airports separate from the total", () => {
    const stats = summariseJourneys(
      [
        {
          id: "a",
          status: "completed",
          bookingType: "return",
          returnTrip: true,
          pickupTime: "2026-10-10T09:00:00Z",
          returnPickupTime: "2026-10-20T16:00:00Z",
          pickupLocation: "Oxford",
          destination: "Heathrow Terminal 5",
          returnPickupLocation: "Heathrow Terminal 5",
          returnDestination: "Oxford",
        },
        {
          id: "b",
          status: "completed",
          pickupTime: "2026-10-02T10:00:00Z",
          pickupLocation: "Abingdon",
          destination: "Heathrow Terminal 2",
        },
        {
          id: "c",
          status: "pending",
          pickupTime: "2026-10-02T10:00:00Z",
          pickupLocation: "Oxford",
          destination: "Gatwick",
        },
        {
          id: "d",
          status: "cancelled",
          pickupTime: "2026-10-02T10:00:00Z",
          pickupLocation: "Oxford",
          destination: "Heathrow",
        },
        {
          id: "e",
          status: "completed",
          source: "test",
          pickupTime: "2026-10-02T10:00:00Z",
          pickupLocation: "Oxford",
          destination: "Heathrow",
        },
        {
          id: "f",
          status: "completed",
          pickupTime: "2026-11-02T10:00:00Z",
          pickupLocation: "Oxford",
          destination: "Heathrow",
        },
        {
          id: "g",
          status: "completed",
          pickupTime: "2026-10-04T08:00:00Z",
          pickupLocation: "Home",
          destination: "St Mary's School, Oxford",
        },
      ],
      NOW,
      "2026-11-07T08:00:00Z"
    );
    assert.equal(stats.completedJourneys, 4);
    assert.equal(stats.airports.heathrow, 3);
    assert.equal(stats.areas.oxford, 2);
    assert.equal(stats.withheld, 1);
    assert.equal(isCompletedJourneyBooking({ status: "allocated" }), false);
    const pub = publicJourneyView(stats) as { airports: { heathrow: number }; completedJourneys: number };
    assert.equal(pub.completedJourneys, 4);
    assert.deepEqual(pub.airports, {});
    assert.equal("unclassified" in pub, false);
  });

  it("does not publish a category below five journeys", () => {
    const stats = summariseJourneys(
      [
        {
          id: "one",
          status: "completed",
          pickupTime: "2026-10-02T10:00:00Z",
          pickupLocation: "Didcot",
          destination: "Gatwick South",
        },
      ],
      NOW,
      "2026-11-07T08:00:00Z"
    );
    assert.equal(stats.completedJourneys, 1);
    assert.equal(stats.airports.gatwick, 1);
    assert.equal(stats.highlights.length, 0);
    const pub = publicJourneyView(stats) as { airports: Record<string, number> };
    assert.deepEqual(pub.airports, {});
  });

  it("does not count the same stored leg twice", () => {
    const row = {
      id: "same",
      status: "completed",
      pickupTime: "2026-10-02T10:00:00Z",
      pickupLocation: "Oxford",
      destination: "Birmingham Airport",
    };
    const stats = summariseJourneys([row, { ...row }], NOW, "2026-11-07T08:00:00Z");
    assert.equal(stats.completedJourneys, 1);
  });
});
