import { londonYmd } from "./londonTime";

/** 2026 half term only. Do not treat these dates as an annual rule. */
export const HALF_TERM_CODE = "HALFTERM";
export const HALF_TERM_DISCOUNT_PENCE = 500;
export const HALF_TERM_START_YMD = "2026-10-25";
export const HALF_TERM_LAST_YMD = "2026-11-02";

export type PromotionDecision = {
  code: string;
  eligible: boolean;
  discountPence: number;
  source: string;
  capturedAtMs: number;
  serverDecided: true;
  reasons: string[];
};

export type JourneyShape = {
  source?: string | null;
  bookingType?: string | null;
  returnTrip?: boolean | null;
  pickup?: string | null;
  pickupLocation?: string | null;
  destination?: string | null;
  returnPickupLocation?: string | null;
  returnDestination?: string | null;
  airportCollection?: boolean | null;
  returnAirportCollection?: boolean | null;
  vehicleType?: string | null;
  otherOfferCode?: string | null;
  service?: string | null;
};

const AIRPORT_TEXT =
  /\b(heathrow|gatwick|stansted|luton|birmingham airport|bristol airport|london city|lhr|lgw|stn|ltn|bhx|brs|lcy|airport)\b/i;

export function isHalfTermRequestWindow(ms: number): boolean {
  const ymd = londonYmd(ms);
  return ymd >= HALF_TERM_START_YMD && ymd <= HALF_TERM_LAST_YMD;
}

export function isHalloweenDecorWindow(ms: number): boolean {
  const ymd = londonYmd(ms);
  return ymd >= "2026-10-25" && ymd <= "2026-10-31";
}

export function normaliseVehicle(raw: string | null | undefined): "standard" | "8_seater" | "other" {
  const n = String(raw || "")
    .toLowerCase()
    .replace(/[_-]+/g, " ")
    .trim();
  if (n.includes("8") && n.includes("seat")) return "8_seater";
  if (n === "standard" || n === "car" || n.includes("standard car")) return "standard";
  return "other";
}

export function isOnlineQuoteSource(source: string | null | undefined): boolean {
  const n = String(source || "").toLowerCase();
  return n === "website" || n === "customer_app";
}

function textOf(journey: JourneyShape): string {
  return [
    journey.pickup,
    journey.pickupLocation,
    journey.destination,
    journey.returnPickupLocation,
    journey.returnDestination,
    journey.service,
  ]
    .filter(Boolean)
    .join(" ");
}

export function isAirportReturn(journey: JourneyShape): boolean {
  const isReturn = journey.bookingType === "return" || journey.returnTrip === true;
  if (!isReturn) return false;
  const outbound = String(journey.pickup || journey.pickupLocation || "").trim();
  const destination = String(journey.destination || "").trim();
  const returnFrom = String(journey.returnPickupLocation || "").trim();
  const returnTo = String(journey.returnDestination || "").trim();
  if (!outbound || !destination || !returnFrom || !returnTo) return false;
  if (journey.airportCollection === true || journey.returnAirportCollection === true) return true;
  if (String(journey.service || "").toLowerCase().includes("airport")) return true;
  return AIRPORT_TEXT.test(textOf(journey));
}

export function qualifyingReturnNow(journey: JourneyShape): boolean {
  if (!isAirportReturn(journey)) return false;
  if (normaliseVehicle(journey.vehicleType) === "other") return false;
  const other = String(journey.otherOfferCode || "").trim();
  if (other && other !== HALF_TERM_CODE) return false;
  return true;
}

/**
 * Decide eligibility from a trusted server timestamp.
 * The customer does not need to enter a code. Ineligible requests are stored as not eligible
 * so a later edit cannot invent the offer, and eligible requests keep it after the window closes.
 */
export function decideHalfTermPromotion(journey: JourneyShape, trustedMs: number): PromotionDecision {
  const reasons: string[] = [];
  const source = String(journey.source || "");
  if (!isOnlineQuoteSource(source)) reasons.push("not_website_or_customer_app");
  if (!isHalfTermRequestWindow(trustedMs)) reasons.push("outside_2026_window");
  if (!isAirportReturn(journey)) reasons.push("not_airport_return");
  if (normaliseVehicle(journey.vehicleType) === "other") reasons.push("vehicle_not_standard_or_8_seater");
  const other = String(journey.otherOfferCode || "").trim();
  if (other && other !== HALF_TERM_CODE) reasons.push("other_offer");
  const eligible = reasons.length === 0;
  return {
    code: eligible ? HALF_TERM_CODE : "",
    eligible,
    discountPence: eligible ? HALF_TERM_DISCOUNT_PENCE : 0,
    source,
    capturedAtMs: trustedMs,
    serverDecided: true,
    reasons,
  };
}

export function poundsToPence(raw: string | number): number {
  const s = String(raw)
    .trim()
    .replace(/£/g, "")
    .replace(/,/g, "");
  if (!/^\d+(\.\d{1,2})?$/.test(s)) {
    throw new Error("Enter the normal fare in pounds and pence.");
  }
  const [whole, frac = ""] = s.split(".");
  return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}

export function formatPence(pence: number): string {
  const safe = Number.isFinite(pence) ? Math.round(pence) : 0;
  const pounds = safe / 100;
  return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

/**
 * Apply the captured £5 once to the normal return total.
 * Pass the pre discount fare. Do not pass the already reduced total.
 */
export function quoteTotals(input: {
  normalFarePence: number;
  promotionEligible: boolean;
  stillQualifyingReturn: boolean;
}): { normalFarePence: number; discountPence: number; finalFarePence: number } {
  const normalFarePence = Math.max(0, Math.round(input.normalFarePence));
  const discountPence =
    input.promotionEligible && input.stillQualifyingReturn ? HALF_TERM_DISCOUNT_PENCE : 0;
  return {
    normalFarePence,
    discountPence,
    finalFarePence: Math.max(0, normalFarePence - discountPence),
  };
}
