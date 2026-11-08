import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { describeStops, emailJourneyText, normaliseStops, openReturnSummary, validateStops } from "./journeyStops";

describe("journey stops", () => {
  it("keeps an older pickup and destination as two stops", () => {
    const stops = normaliseStops(undefined, "Oxford", "Heathrow");
    assert.equal(stops.length, 2);
    assert.equal(validateStops(stops), null);
    assert.match(describeStops(stops), /1\. Pickup: Oxford/);
  });

  it("rejects a journey that does not start and end correctly", () => {
    const stops = normaliseStops([
      { type: "dropoff", address: "Oxford" },
      { type: "pickup", address: "Heathrow" },
    ]);
    assert.equal(validateStops(stops), "The journey needs to start with a pickup.");
  });

  it("describes an open return without inventing a pickup time", () => {
    const text = openReturnSummary({ openReturn: true, returnDate: "2026-11-20", returnPickupTime: "", returnNoticeNote: "Customer will contact the driver when ready" });
    assert.match(text, /Open return on 2026-11-20/);
    assert.match(text, /Return time to be confirmed/);
    assert.match(text, /at least 30 minutes/);
    assert.match(text, /outside Oxford/);
    assert.doesNotMatch(text, /00:00/);
  });

  it("lists every extra pickup and drop off for an email", () => {
    const text = emailJourneyText({
      pickupLocation: "1 High Street, Oxford",
      destination: "Heathrow Terminal 5",
      bookingType: "return",
      openReturn: true,
      returnDate: "2026-11-21",
      returnPickupTime: "",
      stops: [
        { type: "pickup", address: "1 High Street, Oxford", notes: "Wait at the door" },
        { type: "pickup", address: "Headington, Oxford" },
        { type: "dropoff", address: "Heathrow Terminal 5" },
      ],
      returnStops: [
        { type: "pickup", address: "Heathrow Terminal 5" },
        { type: "dropoff", address: "Summertown, Oxford" },
        { type: "dropoff", address: "1 High Street, Oxford" },
      ],
    });
    assert.match(text, /Wait at the door/);
    assert.match(text, /Headington, Oxford/);
    assert.match(text, /Summertown, Oxford/);
    assert.match(text, /Return time to be confirmed/);
    assert.match(text, /Extra stops. Agree the fare/);
  });
});
