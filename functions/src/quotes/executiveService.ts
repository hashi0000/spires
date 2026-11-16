/**
 * Executive Heathrow transfers.
 *
 * EXECUTIVE_SERVICE_ENABLED is the launch switch. It is on.
 * Published fares use the existing airport inclusions:
 * - the standard airport pickup or drop-off charge, included in the published fare
 * - flight monitoring for airport collections
 * - 50 minutes waiting from the actual landing time, then £10 per additional
 *   30 minutes or part thereof
 *
 * Do not describe Executive as available for immediate dispatch.
 * Fares match spires-website/js/airport-prices.js. Do not keep a second price list.
 */

export const EXECUTIVE_SERVICE_ENABLED = true;

export const EXECUTIVE_CUSTOMER_WORDING =
  "Travel in a Mercedes E Class or equivalent for Heathrow transfers or a private Cotswolds trip. Advance booking required. Subject to availability and confirmation.";

export const EXECUTIVE_PARTNER_NOTE =
  "A partner operator may provide the car. Executive Car is the vehicle category. It is not an allocated car, and it does not promise a particular model, luggage space, or extra services.";

export const EXECUTIVE_COMMERCE_MESSAGE =
  "This Executive Heathrow request is awaiting availability confirmation. Accept the request before sending a quote, taking payment, or confirming the booking.";

export const EXECUTIVE_NOT_OPEN_MESSAGE = "Executive Car is not open for booking yet.";

export const EXECUTIVE_HEATHROW_ONLY_MESSAGE = "Executive Car is available for Heathrow transfers and Cotswolds private trips. Choose the Cotswolds journey type for timed hire.";

export const EXECUTIVE_PASSENGER_MESSAGE =
  "Enter the number of passengers travelling, from 1 to 8. We confirm that an Executive Car is suitable before we accept the booking.";

/** Form limit only. It is not a published seat or luggage capacity. */
export const EXECUTIVE_PASSENGER_LIMIT = 8;

export const EXECUTIVE_AREAS = {
  oxford: { oneWay: 150, return: 290 },
  abingdon: { oneWay: 165, return: 320 },
  didcot: { oneWay: 170, return: 330 },
  bicester: { oneWay: 170, return: 330 },
  witney: { oneWay: 170, return: 330 },
} as const;

export type ExecutiveAreaId = keyof typeof EXECUTIVE_AREAS;

const OTHER_AIRPORT =
  /\b(gatwick|stansted|luton|birmingham airport|bristol airport|london city(?: airport)?|east midlands|london oxford airport|lgw|stn|ltn|bhx|brs|lcy|ema)\b/i;
const HEATHROW = /\b(heathrow|lhr)\b/i;

const SPECIFIC_AREAS: Array<{ id: Exclude<ExecutiveAreaId, "oxford">; pattern: RegExp }> = [
  { id: "abingdon", pattern: /\babingdon\b/i },
  { id: "didcot", pattern: /\bdidcot\b/i },
  { id: "bicester", pattern: /\bbicester\b/i },
  { id: "witney", pattern: /\bwitney\b/i },
];

export type ExecutiveStop = { address?: string | null } | string | null | undefined;

export type ExecutiveJourneyInput = {
  pickup?: string | null;
  destination?: string | null;
  returnPickup?: string | null;
  returnDestination?: string | null;
  stops?: ExecutiveStop[] | null;
  returnStops?: ExecutiveStop[] | null;
  bookingType?: string | null;
  journeyType?: string | null;
};

export type ExecutiveClassification =
  | { ok: false; error: string }
  | {
      ok: true;
      airport: "heathrow" | "cotswolds";
      area: ExecutiveAreaId | null;
      fareStatus: "published" | "quote_required";
      oneWay: number | null;
      returnFare: number | null;
    };

export function executiveServiceEnabled(override?: boolean): boolean {
  if (typeof override === "boolean") return override;
  return EXECUTIVE_SERVICE_ENABLED || process.env.EXECUTIVE_SERVICE_ENABLED === "true";
}

export function isExecutiveVehicle(type?: string | null): boolean {
  return String(type || "").trim().toLowerCase() === "executive";
}

export function executiveCommerceBlocked(booking: {
  vehicleType?: string | null;
  executiveAvailability?: string | null;
}): boolean {
  return isExecutiveVehicle(booking.vehicleType) && booking.executiveAvailability !== "accepted";
}

function stopText(stop: ExecutiveStop): string {
  if (!stop) return "";
  if (typeof stop === "string") return stop;
  return String(stop.address || "");
}

export function executiveJourneyText(input: ExecutiveJourneyInput): string {
  return [
    input.pickup,
    input.destination,
    input.returnPickup,
    input.returnDestination,
    ...(input.stops || []).map(stopText),
    ...(input.returnStops || []).map(stopText),
  ]
    .map((part) => String(part || "").trim())
    .filter(Boolean)
    .join("\n");
}

export function classifyExecutiveJourney(input: ExecutiveJourneyInput): ExecutiveClassification {
  const text = executiveJourneyText(input);
  if (input.journeyType === "cotswolds" && !OTHER_AIRPORT.test(text) && !HEATHROW.test(text)) return { ok: true, airport: "cotswolds", area: null, fareStatus: "quote_required", oneWay: null, returnFare: null };
  if (!HEATHROW.test(text)) {
    return { ok: false, error: EXECUTIVE_HEATHROW_ONLY_MESSAGE };
  }
  if (OTHER_AIRPORT.test(text)) {
    return {
      ok: true,
      airport: "heathrow",
      area: null,
      fareStatus: "quote_required",
      oneWay: null,
      returnFare: null,
    };
  }
  const specific = SPECIFIC_AREAS.filter((area) => area.pattern.test(text)).map((area) => area.id);
  const area: ExecutiveAreaId | null =
    specific.length === 1 ? specific[0] : specific.length === 0 && /\boxford\b/i.test(text) ? "oxford" : null;
  if (!area) {
    return {
      ok: true,
      airport: "heathrow",
      area: null,
      fareStatus: "quote_required",
      oneWay: null,
      returnFare: null,
    };
  }
  const prices = EXECUTIVE_AREAS[area];
  return {
    ok: true,
    airport: "heathrow",
    area,
    fareStatus: "published",
    oneWay: prices.oneWay,
    returnFare: prices.return,
  };
}

export function proposedExecutiveFare(classification: Extract<ExecutiveClassification, { ok: true }>, bookingType?: string | null): number | null {
  if (classification.fareStatus !== "published") return null;
  return bookingType === "return" ? classification.returnFare : classification.oneWay;
}

export function assessExecutiveBooking(input: ExecutiveJourneyInput & {
  passengers: number;
  enabled?: boolean;
}): { ok: false; error: string } | { ok: true; fields: Record<string, unknown> } {
  if (!executiveServiceEnabled(input.enabled)) {
    return { ok: false, error: EXECUTIVE_NOT_OPEN_MESSAGE };
  }
  if (!Number.isInteger(input.passengers) || input.passengers < 1 || input.passengers > EXECUTIVE_PASSENGER_LIMIT) {
    return { ok: false, error: EXECUTIVE_PASSENGER_MESSAGE };
  }
  const classification = classifyExecutiveJourney(input);
  if (!classification.ok) return classification;
  const bookingType = input.bookingType === "return" ? "return" : "one_way";
  const proposed = proposedExecutiveFare(classification, bookingType);
  return {
    ok: true,
    fields: {
      serviceType: "executive",
      airport: classification.airport,
      executiveAvailability: "awaiting_confirmation",
      executiveFareStatus: classification.fareStatus,
      executiveArea: classification.area || "",
      ...(proposed == null ? {} : { proposedFarePounds: proposed }),
      executiveSuitability: "pending",
      customerStatus: "awaiting_availability",
      adminStatus: "awaiting_availability",
    },
  };
}
