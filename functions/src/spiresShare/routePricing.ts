import { JourneyType, ShareConfig, ShareJourney } from "./types";
import { isHeathrowShare } from "./terminalGuide";

const HEATHROW_FARE_PENCE = 3500;
const HEATHROW_TARGET_REVENUE_PENCE = 17500;

export type ShareRoutePricing = {
  routeKey: string;
  farePerPassengerPence?: number;
  minimumPassengers?: number;
  capacity?: number;
  targetRevenuePence?: number;
  fourPassengerFallbackEnabled?: boolean;
  fallbackFarePerPassengerPence?: number;
};

export function heathrowRoutePricing(): ShareRoutePricing {
  return {
    routeKey: "heathrow",
    farePerPassengerPence: HEATHROW_FARE_PENCE,
    minimumPassengers: 4,
    capacity: 5,
    targetRevenuePence: HEATHROW_TARGET_REVENUE_PENCE,
    fourPassengerFallbackEnabled: true,
    fallbackFarePerPassengerPence: 4375,
  };
}

export function fourPassengerFallbackEnabled(journey: Pick<ShareJourney, "airportId" | "destinationLabel" | "destinationCity" | "fourPassengerFallbackEnabled" | "journeyType">): boolean {
  if (journey.fourPassengerFallbackEnabled === true) return true;
  if (journey.fourPassengerFallbackEnabled === false) return false;
  return isHeathrowShare(journey);
}

export function resolveJourneyFarePence(
  journey: Pick<ShareJourney, "farePence" | "airportId" | "destinationLabel" | "destinationCity">,
  config?: Pick<ShareConfig, "pilotDefaults" | "airports">
): number {
  if (Number.isFinite(Number(journey.farePence)) && Number(journey.farePence) > 0) {
    return Number(journey.farePence);
  }
  if (isHeathrowShare(journey)) {
    return config?.pilotDefaults.farePence || HEATHROW_FARE_PENCE;
  }
  throw new Error("Set a fare per passenger for this route. This journey does not use the Heathrow fare.");
}

export function cityJourneyRequiresOwnFare(farePence: number | undefined): number {
  if (farePence == null || !Number.isFinite(Number(farePence)) || Number(farePence) <= 0) {
    throw new Error("Set a fare per passenger for this route. City and event journeys do not use the Heathrow fare.");
  }
  return Number(farePence);
}

export function fillNoticeForJourney(journey: Pick<ShareJourney, "airportId" | "destinationLabel" | "destinationCity" | "fourPassengerFallbackEnabled" | "journeyType">): string {
  if (fourPassengerFallbackEnabled(journey)) {
    return "We aim to confirm the journey with five passengers. If five passengers are not secured, Spires Taxis may offer the four passenger departure option. If the required passenger numbers are not reached, the shared journey will not operate and affected passengers will be contacted regarding their payment.";
  }
  return "The journey is confirmed when enough passengers have paid. If the required passenger numbers are not reached, the shared journey will not operate and affected passengers will be contacted regarding their payment.";
}

export function journeyTypeLabel(type: JourneyType | string | undefined): string {
  if (type === "AIRPORT") return "Airport";
  if (type === "CITY") return "City";
  if (type === "EVENT") return "Event";
  return "Other";
}
