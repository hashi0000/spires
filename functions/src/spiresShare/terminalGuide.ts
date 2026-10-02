import { HeathrowTerminal, ShareBooking, ShareJourney } from "./types";

export type FlightTerminal = HeathrowTerminal | "UNSURE";

export const TERMINAL_GUIDE_PATH = "/share/heathrow-terminal-transfer";
export const TERMINAL_GUIDE_FLAT_PATH = "/share-heathrow-terminal-transfer";
export const TERMINAL_GUIDE_URL = "https://www.spires-taxis.com/share/heathrow-terminal-transfer";
export const HEATHROW_TRAVEL_BETWEEN_TERMINALS_URL =
  "https://www.heathrow.com/at-the-airport/airport-maps/travel-between-terminals";
export const HEATHROW_MAPS_URL = "https://www.heathrow.com/at-the-airport/airport-maps";

export const HEATHROW_T3_DROPOFF_NOTICE =
  "Your Spires Share drop off is Terminal 3. If your flight departs from another terminal, you will need to make your own way from Terminal 3 to your departure terminal.";

export function isHeathrowShare(
  journey: Pick<ShareJourney, "airportId" | "destinationLabel" | "destinationCity" | "destinationTerminal" | "originLabel">
): boolean {
  const airport = String(journey.airportId || "").toLowerCase();
  const destination = `${journey.destinationLabel || ""} ${journey.destinationCity || ""}`.toLowerCase();
  return airport === "heathrow" || destination.includes("heathrow");
}

export function parseFlightTerminal(value: unknown): FlightTerminal | undefined {
  const raw = String(value || "")
    .trim()
    .toUpperCase()
    .replace("TERMINAL ", "T")
    .replace("NOT SURE", "UNSURE");
  if (!raw) return undefined;
  if (raw === "T2" || raw === "T3" || raw === "T4" || raw === "T5" || raw === "UNSURE") return raw;
  return undefined;
}

export function flightTerminalOf(booking: Pick<ShareBooking, "departureTerminal" | "dropoffTerminal">): FlightTerminal | undefined {
  return parseFlightTerminal(booking.departureTerminal) || parseFlightTerminal(booking.dropoffTerminal);
}

export function terminalTransferRequired(terminal?: FlightTerminal | string): boolean {
  const parsed = parseFlightTerminal(terminal);
  return parsed === "T2" || parsed === "T4" || parsed === "T5";
}

export function terminalGuideAnchor(terminal?: FlightTerminal | string): string {
  const parsed = parseFlightTerminal(terminal);
  if (parsed === "T2") return "t2";
  if (parsed === "T4") return "t4";
  if (parsed === "T5") return "t5";
  return "t3";
}

export function terminalGuideHref(terminal?: FlightTerminal | string): string {
  return `${TERMINAL_GUIDE_URL}#${terminalGuideAnchor(terminal)}`;
}

export function terminalGuideLinkText(terminal?: FlightTerminal | string): string {
  const parsed = parseFlightTerminal(terminal);
  if (parsed === "T2") return "How to get from T3 to T2";
  if (parsed === "T4") return "How to get from T3 to T4";
  if (parsed === "T5") return "How to get from T3 to T5";
  return "Terminal transfer instructions";
}

export function terminalTransferWarning(terminal?: FlightTerminal | string): string | null {
  const parsed = parseFlightTerminal(terminal);
  if (parsed === "T3") {
    return "Your flight departs from Terminal 3. No terminal transfer is required after Spires Share drops you at Terminal 3.";
  }
  if (parsed === "T2") {
    return "Your flight departs from Terminal 2. Spires Share drops you at Terminal 3. You will need to transfer from Terminal 3 to Terminal 2 after we drop you off. Please allow additional time.";
  }
  if (parsed === "T4") {
    return "Your flight departs from Terminal 4. Spires Share drops you at Terminal 3. You will need to transfer from Terminal 3 to Terminal 4 after we drop you off. Please allow additional time.";
  }
  if (parsed === "T5") {
    return "Your flight departs from Terminal 5. Spires Share drops you at Terminal 3. You will need to transfer from Terminal 3 to Terminal 5 after we drop you off. Please allow additional time.";
  }
  if (parsed === "UNSURE") {
    return "If your flight departs from a terminal other than Terminal 3, you will need to transfer from Terminal 3 after we drop you off. Please allow additional time.";
  }
  return null;
}
