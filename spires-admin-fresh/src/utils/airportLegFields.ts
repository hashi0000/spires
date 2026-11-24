/** Derive airport collection vs drop off from addresses and keep terminal fields in sync. */

export type AirportMode = "none" | "collection" | "dropoff";

export type KnownTerminal = {
  airport: string;
  terminal: string;
  label: string;
  postcode?: string;
};

const KNOWN_TERMINALS: Array<{ pattern: RegExp; airport: string; terminal: string; label: string; postcode: string }> = [
  { pattern: /\bheathrow\b.*\bt(?:erminal)?\s*2\b|\bt(?:erminal)?\s*2\b.*\bheathrow\b/i, airport: "Heathrow", terminal: "2", label: "Heathrow Terminal 2", postcode: "TW6 1EW" },
  { pattern: /\bheathrow\b.*\bt(?:erminal)?\s*3\b|\bt(?:erminal)?\s*3\b.*\bheathrow\b/i, airport: "Heathrow", terminal: "3", label: "Heathrow Terminal 3", postcode: "TW6 1QG" },
  { pattern: /\bheathrow\b.*\bt(?:erminal)?\s*4\b|\bt(?:erminal)?\s*4\b.*\bheathrow\b/i, airport: "Heathrow", terminal: "4", label: "Heathrow Terminal 4", postcode: "TW6 3XA" },
  { pattern: /\bheathrow\b.*\bt(?:erminal)?\s*5\b|\bt(?:erminal)?\s*5\b.*\bheathrow\b/i, airport: "Heathrow", terminal: "5", label: "Heathrow Terminal 5", postcode: "TW6 2GA" },
  { pattern: /\bgatwick\b.*\bnorth\b|\bnorth\s+terminal\b.*\bgatwick\b/i, airport: "Gatwick", terminal: "North", label: "Gatwick North Terminal", postcode: "RH6 0PJ" },
  { pattern: /\bgatwick\b.*\bsouth\b|\bsouth\s+terminal\b.*\bgatwick\b/i, airport: "Gatwick", terminal: "South", label: "Gatwick South Terminal", postcode: "RH6 0NP" },
];

const GENERIC_AIRPORT = /\b(heathrow|gatwick|stansted|luton|birmingham|bristol|east midlands|london city|southampton|bournemouth|airport)\b/i;

export function looksLikeAirport(value?: string | null): boolean {
  return GENERIC_AIRPORT.test(String(value || "")) || Boolean(parseKnownTerminal(String(value || "")));
}

export function parseKnownTerminal(value?: string | null): KnownTerminal | null {
  const text = String(value || "").trim();
  if (!text) return null;
  for (const row of KNOWN_TERMINALS) {
    if (row.pattern.test(text)) {
      return { airport: row.airport, terminal: row.terminal, label: row.label, postcode: row.postcode };
    }
  }
  return null;
}

export function inferAirportMode(pickup?: string | null, destination?: string | null): AirportMode {
  const pickAir = looksLikeAirport(pickup);
  const destAir = looksLikeAirport(destination);
  if (pickAir && !destAir) return "collection";
  if (!pickAir && destAir) return "dropoff";
  if (pickAir && destAir) return "collection";
  return "none";
}

export function terminalSuggestionsFor(value?: string | null): KnownTerminal[] {
  const text = String(value || "").trim().toLowerCase();
  if (!text) return [];
  if (text.includes("heathrow") || text === "lhr") {
    return KNOWN_TERMINALS.filter((row) => row.airport === "Heathrow").map((row) => ({
      airport: row.airport,
      terminal: row.terminal,
      label: row.label,
      postcode: row.postcode,
    }));
  }
  if (text.includes("gatwick") || text === "lgw") {
    return KNOWN_TERMINALS.filter((row) => row.airport === "Gatwick").map((row) => ({
      airport: row.airport,
      terminal: row.terminal,
      label: row.label,
      postcode: row.postcode,
    }));
  }
  return [];
}

export type AirportLegPatch = {
  airportCollection: boolean;
  airportDropOff: boolean;
  terminal: string;
  flightNumber: string;
  landingTime: string;
  collectionLocation: string;
  collectionLocationKind: string;
  collectionArrangement: string;
  arrivalDate: string;
  fixedTimeAcknowledged: boolean;
};

export function emptyAirportCollectionFields(): Pick<
  AirportLegPatch,
  "flightNumber" | "landingTime" | "collectionLocation" | "collectionArrangement" | "arrivalDate" | "fixedTimeAcknowledged" | "terminal"
> {
  return {
    terminal: "",
    flightNumber: "",
    landingTime: "",
    collectionLocation: "",
    collectionArrangement: "flight_monitored",
    arrivalDate: "",
    fixedTimeAcknowledged: false,
  };
}

/** Build outbound airport field patch from pickup/destination addresses. */
export function syncOutboundAirportFromAddresses(
  pickup: string,
  destination: string,
  current: Partial<AirportLegPatch> & { airportCollection?: boolean; airportDropOff?: boolean; terminal?: string; collectionLocation?: string },
  options?: { manualOverride?: boolean }
): Partial<AirportLegPatch> {
  if (options?.manualOverride) return {};
  const mode = inferAirportMode(pickup, destination);
  if (mode === "none") {
    if (!current.airportCollection && !current.airportDropOff) return {};
    return {
      airportCollection: false,
      airportDropOff: false,
      ...emptyAirportCollectionFields(),
      collectionLocationKind: "terminal",
    };
  }
  if (mode === "dropoff") {
    return {
      airportCollection: false,
      airportDropOff: true,
      ...emptyAirportCollectionFields(),
      collectionLocationKind: "terminal",
    };
  }
  const known = parseKnownTerminal(pickup);
  const terminal = known?.terminal || current.terminal || "";
  const collectionLocation =
    known?.label ||
    String(current.collectionLocation || "").trim() ||
    String(pickup || "").trim();
  return {
    airportCollection: true,
    airportDropOff: false,
    terminal,
    collectionLocation,
    collectionLocationKind: current.collectionLocationKind === "hotel" ? "hotel" : "terminal",
    collectionArrangement: current.collectionArrangement || "flight_monitored",
    flightNumber: current.flightNumber || "",
    landingTime: current.landingTime || "",
    arrivalDate: current.arrivalDate || "",
    fixedTimeAcknowledged: current.fixedTimeAcknowledged === true,
  };
}

export function syncReturnAirportFromAddresses(
  returnPickup: string,
  returnDestination: string,
  current: {
    returnAirportCollection?: boolean;
    returnTerminal?: string;
    returnCollectionLocation?: string;
    returnCollectionLocationKind?: string;
    returnCollectionArrangement?: string;
    returnFlightNumber?: string;
    returnLandingTime?: string;
    returnArrivalDate?: string;
    returnFixedTimeAcknowledged?: boolean;
  },
  options?: { manualOverride?: boolean }
): Record<string, unknown> {
  if (options?.manualOverride) return {};
  const mode = inferAirportMode(returnPickup, returnDestination);
  if (mode === "none") {
    if (!current.returnAirportCollection) return {};
    return {
      returnAirportCollection: false,
      returnTerminal: "",
      returnFlightNumber: "",
      returnLandingTime: "",
      returnCollectionLocation: "",
      returnCollectionArrangement: "flight_monitored",
      returnArrivalDate: "",
      returnFixedTimeAcknowledged: false,
      returnCollectionLocationKind: "terminal",
    };
  }
  if (mode === "dropoff") {
    return {
      returnAirportCollection: false,
      returnTerminal: "",
      returnFlightNumber: "",
      returnLandingTime: "",
      returnCollectionLocation: "",
      returnCollectionArrangement: "flight_monitored",
      returnArrivalDate: "",
      returnFixedTimeAcknowledged: false,
      returnCollectionLocationKind: "terminal",
      returnAirportDropOff: true,
    };
  }
  const known = parseKnownTerminal(returnPickup);
  return {
    returnAirportCollection: true,
    returnAirportDropOff: false,
    returnTerminal: known?.terminal || current.returnTerminal || "",
    returnCollectionLocation: known?.label || current.returnCollectionLocation || returnPickup,
    returnCollectionLocationKind: current.returnCollectionLocationKind === "hotel" ? "hotel" : "terminal",
    returnCollectionArrangement: current.returnCollectionArrangement || "flight_monitored",
    returnFlightNumber: current.returnFlightNumber || "",
    returnLandingTime: current.returnLandingTime || "",
    returnArrivalDate: current.returnArrivalDate || "",
    returnFixedTimeAcknowledged: current.returnFixedTimeAcknowledged === true,
  };
}

export function airportModeLabel(mode: AirportMode, known?: KnownTerminal | null): string {
  if (mode === "none") return "No airport details";
  if (mode === "dropoff") return known ? `Airport drop off · ${known.label}` : "Airport drop off";
  return known ? `Airport collection · ${known.label}` : "Airport collection";
}
