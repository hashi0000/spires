/**
 * Route Performance for Advertising Results.
 * Aggregates existing ad-attributed bookings; does not write Firestore or invent spend by route.
 */
import type { AdvertisingBookingInput } from "./advertisingResults";
import { isSyntheticBooking, formatGbp } from "./advertisingResults";
import {
  bookedDate,
  isGoogleAdsAttributed,
  isGoogleAdsSourceValue,
  isManuallyAttributedGoogleAds,
} from "./googleAdsPeriod";
import { effectiveWorkflowStatus } from "./bookingWorkflow";
import { bookingMoney } from "./bookingMoney";
import { hasTimedReturn, journeyLegs, type JourneyLeg } from "./journeyLegs";
import type { Booking } from "../types/types";
import { sourceLabel } from "./advertisingResults";

export const ROUTE_PERFORMANCE_CATEGORIES = [
  "Heathrow Airport",
  "Gatwick Airport",
  "Stansted Airport",
  "Luton Airport",
  "Birmingham Airport",
  "London City Airport",
  "Bristol Airport",
  "Cotswolds Tours",
  "Other Airport Transfers",
  "Other Journeys",
] as const;

export type RoutePerformanceCategory = (typeof ROUTE_PERFORMANCE_CATEGORIES)[number];

export type AdsAttributionCategory = "verified" | "likely" | "other";

export type RoutePerformanceAttributionFilter = "all_ads" | "verified" | "likely";

export type RoutePerformanceDateBasis = "acquisition" | "journey";

export type RoutePerformanceBarMetric = "bookings" | "legs";

type AirportRule = {
  label: RoutePerformanceCategory;
  /** Matched against normalised journey text. Order is priority within this list. */
  test: (text: string) => boolean;
};

const AIRPORT_RULES: AirportRule[] = [
  {
    label: "Heathrow Airport",
    test: (text) => /\bheathrow\b/.test(text) || /\blhr\b/.test(text),
  },
  {
    label: "Gatwick Airport",
    test: (text) => /\bgatwick\b/.test(text) || /\blgw\b/.test(text),
  },
  {
    label: "Stansted Airport",
    test: (text) => /\bstansted\b/.test(text) || /\bstn\b/.test(text),
  },
  {
    label: "Luton Airport",
    // Prefer airport/terminal/LTN; bare "luton" still maps here for transfer destinations.
    test: (text) => /\bluton\s+airport\b/.test(text) || /\bluton\s+terminal\b/.test(text) || /\bltn\b/.test(text) || /\bluton\b/.test(text),
  },
  {
    label: "Birmingham Airport",
    test: (text) => /\bbirmingham\s+airport\b/.test(text) || /\bbhx\b/.test(text),
  },
  {
    label: "London City Airport",
    test: (text) => /\blondon\s+city\s+airport\b/.test(text) || /\bcity\s+airport\b/.test(text) || /\blcy\b/.test(text),
  },
  {
    label: "Bristol Airport",
    test: (text) => /\bbristol\s+airport\b/.test(text) || /\bbrs\b/.test(text),
  },
];

function journeyText(booking: AdvertisingBookingInput): string {
  return [
    booking.pickupLocation,
    booking.pickup,
    booking.destination,
    (booking as { returnPickupLocation?: string }).returnPickupLocation,
    (booking as { returnDestination?: string }).returnDestination,
  ]
    .map((part) => String(part || "").trim().toLowerCase())
    .filter(Boolean)
    .join(" | ");
}

function isCotswoldsTour(booking: AdvertisingBookingInput): boolean {
  const type = String((booking as { journeyType?: string }).journeyType || "").toLowerCase();
  if (type === "cotswolds" || type === "cotswold") return true;
  const text = journeyText(booking);
  if (/\bcotswolds?\b/.test(text) && /\b(tour|tours|hire|day)\b/.test(text)) return true;
  if (/\bcotswolds?\s+tour/.test(text) || /\bcotswolds?\s+hire/.test(text)) return true;
  if (/\bcotswolds?\b/.test(text)) return true;
  return false;
}

/** Classify a booking into a Route Performance category. Unmatched work becomes Other Journeys. */
export function classifyRouteService(booking: AdvertisingBookingInput): RoutePerformanceCategory {
  if (isCotswoldsTour(booking)) return "Cotswolds Tours";
  const text = journeyText(booking);
  for (const rule of AIRPORT_RULES) {
    if (rule.test(text)) return rule.label;
  }
  if (/\bairport\b/.test(text) || /\bterminal\s*[0-9a-z]\b/.test(text)) {
    return "Other Airport Transfers";
  }
  return "Other Journeys";
}

function hasTrackedClick(booking: AdvertisingBookingInput, at: Date | null): boolean {
  return sourceLabel(booking, at) === "Tracked Google Ads";
}

/**
 * Reporting categories for ads work.
 * Verified = consented click id on the booking. Likely = staff/customer said Google Ads without that evidence.
 * Does not upgrade manual tags to Verified.
 */
export function adsAttributionCategory(booking: AdvertisingBookingInput, at: Date | null = null): AdsAttributionCategory {
  if (hasTrackedClick(booking, at)) return "verified";
  if (isManuallyAttributedGoogleAds(booking) || isGoogleAdsSourceValue(booking.staffReportedSource)) return "likely";
  if (isGoogleAdsSourceValue(booking.customerReportedSource) || isGoogleAdsSourceValue(booking.heardAbout)) return "likely";
  return "other";
}

export function adsAttributionCategoryLabel(category: AdsAttributionCategory): string {
  if (category === "verified") return "Verified Google Ads";
  if (category === "likely") return "Likely Google Ads";
  return "Other / Unknown";
}

function returnParentNumber(booking: AdvertisingBookingInput): string {
  if (booking.returnOfBookingNumber) return String(booking.returnOfBookingNumber).trim();
  const notes = String(booking.notes || "");
  const match = notes.match(/^Return for booking\s+([A-Za-z0-9-]+)/i);
  return match ? match[1] : "";
}

function londonDateKey(value: unknown): string {
  if (!value) return "";
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value)) {
    return value.slice(0, 10);
  }
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

/**
 * Acquisition date for Route Performance — same basis as Advertising Results overview:
 * enquiry date, else booking creation (Europe/London).
 * confirmedAt is not used as the primary filter yet: many historic jobs lack a trustworthy
 * confirmation timestamp, and mixing bases would silently disagree with Overview totals.
 */
export function routePerformanceAcquisitionDate(booking: AdvertisingBookingInput): string {
  return bookedDate(booking);
}

export function routePerformanceJourneyDate(booking: AdvertisingBookingInput): string {
  return londonDateKey(booking.pickupTime || booking.dateTime);
}

function asLegBooking(booking: AdvertisingBookingInput): Booking {
  return booking as unknown as Booking;
}

export type RouteLegSummary = {
  legCount: number;
  completedLegs: number;
  upcomingLegs: number;
  cancelledLegs: number;
  /** True when every non-cancelled leg is completed. */
  bookingFullyCompleted: boolean;
  /** True when per-leg completion is only inferred from overall status on a one-way job. */
  completedLegsReliable: boolean;
  isReturn: boolean;
  legs: Array<{ leg: "outbound" | "return"; status: string; pickupDay: string }>;
};

/**
 * Count journey legs from the existing booking model (same-doc return, or one-way).
 * Does not invent a return from two similar separate bookings.
 * Completed legs require status === completed; needs_review is not completed.
 */
export function summariseRouteLegs(booking: AdvertisingBookingInput, now: Date = new Date()): RouteLegSummary {
  const isReturn = hasTimedReturn(asLegBooking(booking) as Parameters<typeof hasTimedReturn>[0]);
  const legs = journeyLegs(asLegBooking(booking), now);
  const active = legs.filter((leg) => leg.status !== "cancelled");
  const completedLegs = legs.filter((leg) => leg.status === "completed").length;
  const cancelledLegs = legs.filter((leg) => leg.status === "cancelled").length;
  const upcomingLegs = legs.filter((leg) => {
    if (leg.status === "completed" || leg.status === "cancelled") return false;
    if (leg.status === "needs_review") return false;
    const day = leg.pickupAt ? londonDateKey(leg.pickupAt) : "";
    const today = londonDateKey(now);
    if (day && today && day < today) return false;
    return true;
  }).length;
  const bookingFullyCompleted = active.length > 0 && active.every((leg) => leg.status === "completed");
  const explicitOutbound = Boolean((booking as { outboundStatus?: string }).outboundStatus);
  const explicitReturn = Boolean((booking as { returnStatus?: string }).returnStatus);
  const completedLegsReliable = isReturn
    ? Boolean(explicitOutbound || explicitReturn || completedLegs > 0)
    : true;

  return {
    legCount: legs.length,
    completedLegs,
    upcomingLegs,
    cancelledLegs,
    bookingFullyCompleted,
    completedLegsReliable,
    isReturn,
    legs: legs.map((leg: JourneyLeg) => ({
      leg: leg.leg,
      status: leg.status,
      pickupDay: leg.pickupAt ? londonDateKey(leg.pickupAt) : "",
    })),
  };
}

export type RoutePerformanceJob = {
  id: string;
  bookingNumber: string;
  hirerName: string;
  pickup: string;
  destination: string;
  outboundDate: string;
  returnDate: string;
  status: string;
  cancelled: boolean;
  confirmedEligible: boolean;
  routeCategory: RoutePerformanceCategory;
  attributionCategory: AdsAttributionCategory;
  attributionLabel: string;
  isReturn: boolean;
  oneWay: boolean;
  journeyLegs: number;
  completedLegs: number;
  upcomingLegs: number;
  bookingFullyCompleted: boolean;
  completedLegsReliable: boolean;
  journeyCompletionLabel: string;
  farePence: number | null;
  receivedPence: number;
  outstandingPence: number | null;
  acquisitionDate: string;
  journeyDate: string;
};

export type RoutePerformanceRow = {
  route: RoutePerformanceCategory | "All routes";
  bookings: number;
  oneWay: number;
  returns: number;
  journeyLegs: number;
  completedLegs: number;
  completedLegsKnown: boolean;
  agreedFarePence: number | null;
  averageFarePence: number | null;
  paymentsReceivedPence: number;
  outstandingPence: number | null;
  confirmedBookings: number;
  completedBookings: number;
  cancelledBookings: number;
  upcomingLegs: number;
};

export type RoutePerformanceReport = {
  dateBasis: RoutePerformanceDateBasis;
  dateBasisLabel: string;
  from: string;
  to: string;
  attributionFilter: RoutePerformanceAttributionFilter;
  jobs: RoutePerformanceJob[];
  rows: RoutePerformanceRow[];
  totals: RoutePerformanceRow;
  /** Period-level spend ratios only — not allocated to routes. */
  periodSpendNote: string;
};

function agreedFarePence(booking: AdvertisingBookingInput): number | null {
  const money = bookingMoney(booking);
  return money.totalPence > 0 ? money.totalPence : null;
}

function moneyParts(booking: AdvertisingBookingInput): { receivedPence: number; outstandingPence: number | null; farePence: number | null } {
  const money = bookingMoney(booking);
  const farePence = money.totalPence > 0 ? money.totalPence : null;
  return {
    farePence,
    receivedPence: money.receivedPence,
    outstandingPence: farePence == null ? null : money.outstandingPence,
  };
}

function journeyCompletionLabel(summary: RouteLegSummary, status: string): string {
  if (status === "cancelled") return "Cancelled";
  if (summary.bookingFullyCompleted) return "Fully completed";
  if (summary.completedLegs > 0 && summary.upcomingLegs > 0) return "Partially completed";
  if (summary.completedLegs > 0 && summary.isReturn && !summary.bookingFullyCompleted) {
    return summary.completedLegsReliable
      ? "Outbound completed · return not completed"
      : "Partial · return completion needs review";
  }
  if (summary.upcomingLegs > 0) return "Upcoming";
  if (status === "completed") return "Completed";
  return status ? status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, " ") : "Unknown";
}

function emptyRow(route: RoutePerformanceCategory | "All routes"): RoutePerformanceRow {
  return {
    route,
    bookings: 0,
    oneWay: 0,
    returns: 0,
    journeyLegs: 0,
    completedLegs: 0,
    completedLegsKnown: true,
    agreedFarePence: 0,
    averageFarePence: null,
    paymentsReceivedPence: 0,
    outstandingPence: 0,
    confirmedBookings: 0,
    completedBookings: 0,
    cancelledBookings: 0,
    upcomingLegs: 0,
  };
}

function accumulate(row: RoutePerformanceRow, job: RoutePerformanceJob): void {
  row.bookings += 1;
  if (job.isReturn) row.returns += 1;
  else row.oneWay += 1;
  row.journeyLegs += job.journeyLegs;
  row.completedLegs += job.completedLegs;
  if (!job.completedLegsReliable) row.completedLegsKnown = false;
  row.upcomingLegs += job.upcomingLegs;
  if (job.cancelled) row.cancelledBookings += 1;
  if (job.confirmedEligible) row.confirmedBookings += 1;
  if (job.bookingFullyCompleted) row.completedBookings += 1;
}

function finaliseRow(row: RoutePerformanceRow): RoutePerformanceRow {
  if (row.agreedFarePence != null && row.bookings > 0) {
    row.averageFarePence = Math.round(row.agreedFarePence / row.bookings);
  } else {
    row.averageFarePence = null;
  }
  return row;
}

function matchesAttributionFilter(
  category: AdsAttributionCategory,
  filter: RoutePerformanceAttributionFilter
): boolean {
  if (filter === "all_ads") return category === "verified" || category === "likely";
  if (filter === "verified") return category === "verified";
  return category === "likely";
}

/**
 * Build Route Performance from the same booking list and period as Advertising Results.
 * Linked separate return docs are skipped when the parent is present (count once).
 */
export function buildRoutePerformanceReport(
  bookings: AdvertisingBookingInput[],
  options: {
    from: string;
    to: string;
    attributionFilter?: RoutePerformanceAttributionFilter;
    dateBasis?: RoutePerformanceDateBasis;
    now?: Date;
  }
): RoutePerformanceReport {
  const now = options.now || new Date();
  const attributionFilter = options.attributionFilter || "all_ads";
  const dateBasis = options.dateBasis || "acquisition";
  const dateBasisLabel = dateBasis === "journey"
    ? "Route Performance counts by outbound journey date (Europe/London)."
    : "Route Performance uses enquiry date, falling back to booking creation (Europe/London) — the same acquisition basis as Advertising Results. Confirmation timestamps are not used as the period filter because many historic jobs lack a trustworthy confirmedAt.";

  const inPeriod = bookings.filter((booking) => {
    if (isSyntheticBooking(booking)) return false;
    const day = dateBasis === "journey"
      ? routePerformanceJourneyDate(booking)
      : routePerformanceAcquisitionDate(booking);
    return Boolean(day) && day >= options.from && day <= options.to;
  });

  const parents = new Set(
    inPeriod.map((booking) => String(booking.bookingNumber || "").trim()).filter(Boolean)
  );
  const seen = new Set<string>();
  const jobs: RoutePerformanceJob[] = [];

  inPeriod.forEach((booking) => {
    const category = adsAttributionCategory(booking, now);
    if (!matchesAttributionFilter(category, attributionFilter)) return;
    // Keep alignment with Overview: only ad-related jobs (verified + likely) enter all_ads.
    if (attributionFilter === "all_ads" && !isGoogleAdsAttributed(booking, now)) return;

    const parent = returnParentNumber(booking);
    if (parent && parents.has(parent)) return;
    const number = String(booking.bookingNumber || booking.id || "").trim();
    if (number && seen.has(number)) return;
    if (number) seen.add(number);

    const status = effectiveWorkflowStatus(booking);
    const cancelled = status === "cancelled";
    const confirmedEligible = !cancelled && ["confirmed", "allocated", "completed"].includes(status);
    const legs = summariseRouteLegs(booking, now);
    const money = moneyParts(booking);
    const pickup = String(booking.pickupLocation || booking.pickup || "").trim() || "Pickup not recorded";
    const destination = String(booking.destination || "").trim() || "Destination not recorded";

    jobs.push({
      id: String(booking.id || number),
      bookingNumber: number || "Unknown",
      hirerName: String(booking.hirerName || booking.name || "").trim() || "Name not recorded",
      pickup,
      destination,
      outboundDate: londonDateKey(booking.pickupTime || booking.dateTime) || "—",
      returnDate: legs.isReturn
        ? londonDateKey((booking as { returnPickupTime?: unknown; returnDateTime?: unknown }).returnPickupTime
          || (booking as { returnDateTime?: unknown }).returnDateTime) || "—"
        : "",
      status,
      cancelled,
      confirmedEligible,
      routeCategory: classifyRouteService(booking),
      attributionCategory: category,
      attributionLabel: adsAttributionCategoryLabel(category),
      isReturn: legs.isReturn,
      oneWay: !legs.isReturn,
      journeyLegs: legs.legCount,
      completedLegs: legs.completedLegs,
      upcomingLegs: legs.upcomingLegs,
      bookingFullyCompleted: legs.bookingFullyCompleted,
      completedLegsReliable: legs.completedLegsReliable,
      journeyCompletionLabel: journeyCompletionLabel(legs, status),
      farePence: money.farePence,
      receivedPence: money.receivedPence,
      outstandingPence: money.outstandingPence,
      acquisitionDate: routePerformanceAcquisitionDate(booking),
      journeyDate: routePerformanceJourneyDate(booking),
    });
  });

  const byRoute = new Map<RoutePerformanceCategory, RoutePerformanceRow>();
  ROUTE_PERFORMANCE_CATEGORIES.forEach((route) => byRoute.set(route, emptyRow(route)));
  const totals = emptyRow("All routes");

  jobs.forEach((job) => {
    const row = byRoute.get(job.routeCategory) || emptyRow(job.routeCategory);
    accumulate(row, job);
    byRoute.set(job.routeCategory, row);
    accumulate(totals, job);
  });

  // Financial columns for the table: agreed fares on confirmed-eligible jobs only (align Overview).
  const fareScoped = (rowJobs: RoutePerformanceJob[]): Pick<RoutePerformanceRow, "agreedFarePence" | "averageFarePence" | "paymentsReceivedPence" | "outstandingPence"> => {
    const confirmed = rowJobs.filter((job) => job.confirmedEligible);
    let agreed: number | null = 0;
    let received = 0;
    let outstanding: number | null = 0;
    for (const job of confirmed) {
      if (job.farePence == null) agreed = null;
      else if (agreed != null) agreed += job.farePence;
      received += job.receivedPence;
      if (job.outstandingPence == null) outstanding = null;
      else if (outstanding != null) outstanding += job.outstandingPence;
    }
    return {
      agreedFarePence: agreed,
      averageFarePence: agreed != null && confirmed.length > 0 ? Math.round(agreed / confirmed.length) : null,
      paymentsReceivedPence: received,
      outstandingPence: outstanding,
    };
  };

  const rows = ROUTE_PERFORMANCE_CATEGORIES.map((route) => {
    const base = finaliseRow(byRoute.get(route) || emptyRow(route));
    const money = fareScoped(jobs.filter((job) => job.routeCategory === route));
    return { ...base, ...money, route };
  }).filter((row) => row.bookings > 0)
    .sort((a, b) => b.bookings - a.bookings || a.route.localeCompare(b.route));

  const totalMoney = fareScoped(jobs);

  return {
    dateBasis,
    dateBasisLabel,
    from: options.from,
    to: options.to,
    attributionFilter,
    jobs: jobs.sort((a, b) => a.acquisitionDate.localeCompare(b.acquisitionDate) || a.bookingNumber.localeCompare(b.bookingNumber)),
    rows,
    totals: finaliseRow({
      ...totals,
      ...totalMoney,
      route: "All routes",
      bookings: jobs.length,
    }),
    periodSpendNote: "Google Ads spend stays at account level for the selected period. Route rows show revenue and frequency only — spend is not allocated to routes.",
  };
}

export function formatRouteFare(pence: number | null): string {
  return formatGbp(pence);
}

export function routeBarWidth(value: number, max: number): string {
  if (!(max > 0) || !(value > 0)) return "0%";
  return `${Math.max(4, Math.round((value / max) * 100))}%`;
}
