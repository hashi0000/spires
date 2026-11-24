import {
  inferAirportMode,
  parseKnownTerminal,
  syncOutboundAirportFromAddresses,
  syncReturnAirportFromAddresses,
  terminalSuggestionsFor,
} from "./airportLegFields";

describe("airportLegFields", () => {
  it("recognises Heathrow Terminal 5 from the location label", () => {
    const known = parseKnownTerminal("Heathrow Terminal 5, TW6 2GA");
    expect(known).toEqual({
      airport: "Heathrow",
      terminal: "5",
      label: "Heathrow Terminal 5",
      postcode: "TW6 2GA",
    });
  });

  it("treats a journey to a known terminal as drop off, not collection", () => {
    expect(inferAirportMode("The Randolph Hotel, OX1 2LN", "Heathrow Terminal 5, TW6 2GA")).toBe("dropoff");
    const patch = syncOutboundAirportFromAddresses(
      "The Randolph Hotel, OX1 2LN",
      "Heathrow Terminal 5, TW6 2GA",
      { airportCollection: true, flightNumber: "BA123", terminal: "5", collectionLocation: "Terminal 5" }
    );
    expect(patch.airportCollection).toBe(false);
    expect(patch.airportDropOff).toBe(true);
    expect(patch.flightNumber).toBe("");
    expect(patch.terminal).toBe("");
    expect(patch.collectionLocation).toBe("");
  });

  it("fills terminal from a known pickup without asking again", () => {
    const patch = syncOutboundAirportFromAddresses(
      "Heathrow Terminal 5, TW6 2GA",
      "Oxford Station, OX1 1HS",
      {}
    );
    expect(patch.airportCollection).toBe(true);
    expect(patch.airportDropOff).toBe(false);
    expect(patch.terminal).toBe("5");
    expect(patch.collectionLocation).toBe("Heathrow Terminal 5");
  });

  it("keeps return airport requirements independent of the outbound", () => {
    const outboundDrop = syncOutboundAirportFromAddresses(
      "Oxford Station, OX1 1HS",
      "Heathrow Terminal 5, TW6 2GA",
      {}
    );
    expect(outboundDrop.airportDropOff).toBe(true);

    const returnCollect = syncReturnAirportFromAddresses(
      "Heathrow Terminal 3, TW6 1QG",
      "Oxford Station, OX1 1HS",
      {}
    );
    expect(returnCollect.returnAirportCollection).toBe(true);
    expect(returnCollect.returnTerminal).toBe("3");
    expect(returnCollect.returnCollectionLocation).toBe("Heathrow Terminal 3");
  });

  it("offers Heathrow terminal suggestions for ambiguous airport text", () => {
    const suggestions = terminalSuggestionsFor("Heathrow Airport");
    expect(suggestions.map((row) => row.terminal)).toEqual(["2", "3", "4", "5"]);
  });
});
