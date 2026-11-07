import * as assert from "assert";
import { describe, it } from "node:test";
import { curatedMatches, isUkPostcode, searchLocationSuggestions } from "./places";
import { placeRecord } from "./placeRecord";

describe("location suggestions", () => {
  it("keeps London Oxford Airport distinct from Heathrow", () => {
    const heathrow = curatedMatches("heathrow").map((place) => place.label);
    assert.equal(heathrow.some((label) => /oxford/i.test(label)), false);
    assert.equal(heathrow.length, 4);
    const oxfordAirport = curatedMatches("kidlington");
    assert.equal(oxfordAirport[0].label, "London Oxford Airport, Kidlington");
  });

  it("offers the short popular list when the field is empty", () => {
    const popular = curatedMatches("");
    assert.equal(popular.some((place) => place.id === "oxford-station"), true);
    assert.equal(popular.some((place) => place.id === "heathrow-t5"), true);
  });

  it("uses a postcode result that still needs a property", async () => {
    const fetchImpl = (async () =>
      ({
        ok: true,
        json: async () => ({ result: { latitude: 51.75, longitude: -1.25, postcode: "OX1 1HS" } }),
      })) as unknown as typeof fetch;
    const result = await searchLocationSuggestions({ query: "OX1 1HS", fetchImpl });
    const postcode = result.suggestions.find((row) => row.kind === "postcode");
    assert.equal(postcode?.needsProperty, true);
    assert.equal(postcode?.latitude, 51.75);
    assert.equal(isUkPostcode("OX1 1HS"), true);
  });

  it("drops coordinates when the address text changes", () => {
    const selected = placeRecord(
      { label: "Oxford Station, OX1 1HS", latitude: 51.75, longitude: -1.27, postcode: "OX1 1HS" },
      "Oxford Station, OX1 1HS"
    );
    assert.equal(selected?.latitude, 51.75);
    assert.equal(
      placeRecord(
        { label: "Oxford Station, OX1 1HS", latitude: 51.75, longitude: -1.27 },
        "12 High Street, Oxford"
      ),
      null
    );
  });
});
