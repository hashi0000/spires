import {
  AdvertisingBookingInput,
  SpendEntryInput,
  formatGbp,
  isSyntheticBooking,
  sourceLabel,
} from "./advertisingResults";
import { effectiveWorkflowStatus } from "./bookingWorkflow";
import { bookingMoney } from "./bookingMoney";

export type SpendRangeEntry = SpendEntryInput & {
  dateEnd?: string;
  campaign?: string;
  note?: string;
  /** When true, manual spend for this entry’s dates replaces imported spend in the period total. */
  replacesImported?: boolean;
};

export type SpendOverlap = {
  leftId: string;
  rightId: string;
  campaign: string;
  detail: string;
};

export type PeriodSpendLine = {
  id: string;
  label: string;
  amountPence: number;
  from: string;
  to: string;
  campaign: string;
  inclusion: "full" | "partial" | "outside";
  detail: string;
  replacesImported?: boolean;
};

export type SpendSourceKind = "manual" | "imported" | "unavailable";

function dayKey(value: string | undefined): string {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value || "")) ? String(value) : "";
}

export function spendRange(entry: SpendRangeEntry): { from: string; to: string } | null {
  const from = dayKey(entry.date);
  if (!from) return null;
  const to = dayKey(entry.dateEnd) || from;
  return from <= to ? { from, to } : { from: to, to: from };
}

export function rangesOverlap(aFrom: string, aTo: string, bFrom: string, bTo: string): boolean {
  return aFrom <= bTo && bFrom <= aTo;
}

function campaignKey(entry: SpendRangeEntry): string {
  return String(entry.campaign || "").trim().toLowerCase() || "(no campaign name)";
}

/** Same campaign (or both unnamed) with overlapping date coverage. */
export function findSpendOverlaps(entries: SpendRangeEntry[]): SpendOverlap[] {
  const rows = entries
    .map((entry) => ({ entry, range: spendRange(entry) }))
    .filter((row): row is { entry: SpendRangeEntry; range: { from: string; to: string } } => Boolean(row.range));
  const overlaps: SpendOverlap[] = [];
  for (let i = 0; i < rows.length; i += 1) {
    for (let j = i + 1; j < rows.length; j += 1) {
      const left = rows[i];
      const right = rows[j];
      if (campaignKey(left.entry) !== campaignKey(right.entry)) continue;
      if (!rangesOverlap(left.range.from, left.range.to, right.range.from, right.range.to)) continue;
      const campaign = String(left.entry.campaign || right.entry.campaign || "").trim() || "Unnamed campaign";
      overlaps.push({
        leftId: left.entry.id,
        rightId: right.entry.id,
        campaign,
        detail: `${campaign}: ${left.range.from} to ${left.range.to} overlaps ${right.range.from} to ${right.range.to}. Check you have not entered both a weekly and a monthly total.`,
      });
    }
  }
  return overlaps;
}

export function classifySpendAgainstPeriod(entry: SpendRangeEntry, from: string, to: string): PeriodSpendLine | null {
  const range = spendRange(entry);
  if (!range) return null;
  const campaign = String(entry.campaign || "").trim();
  const label = campaign || entry.label || "Manual spend";
  const replacesImported = entry.replacesImported === true;
  if (range.to < from || range.from > to) {
    return {
      id: entry.id,
      label,
      amountPence: entry.amountPence,
      from: range.from,
      to: range.to,
      campaign,
      inclusion: "outside",
      detail: "Outside the selected period.",
      replacesImported,
    };
  }
  if (range.from >= from && range.to <= to) {
    return {
      id: entry.id,
      label,
      amountPence: entry.amountPence,
      from: range.from,
      to: range.to,
      campaign,
      inclusion: "full",
      detail: range.from === range.to ? `Spend on ${range.from}` : `Spend ${range.from} to ${range.to}`,
      replacesImported,
    };
  }
  return {
    id: entry.id,
    label,
    amountPence: entry.amountPence,
    from: range.from,
    to: range.to,
    campaign,
    inclusion: "partial",
    detail: `This entry covers ${range.from} to ${range.to}, which only partly overlaps ${from} to ${to}. It is not included in the period spend total.`,
    replacesImported,
  };
}

export function periodManualSpend(entries: SpendRangeEntry[], from: string, to: string): {
  includedPence: number;
  included: PeriodSpendLine[];
  partial: PeriodSpendLine[];
  overlaps: SpendOverlap[];
} {
  const lines = entries
    .map((entry) => classifySpendAgainstPeriod(entry, from, to))
    .filter((row): row is PeriodSpendLine => Boolean(row));
  const included = lines.filter((row) => row.inclusion === "full");
  const partial = lines.filter((row) => row.inclusion === "partial");
  const includedPence = included.reduce((sum, row) => sum + Math.max(0, row.amountPence), 0);
  return {
    includedPence,
    included,
    partial,
    overlaps: findSpendOverlaps(entries),
  };
}

/** Normalise google_ads / google_advert style values for reporting comparisons. */
export function isGoogleAdsSourceValue(value: unknown): boolean {
  const raw = String(value || "").trim().toLowerCase().replace(/\s+/g, "_");
  return raw === "google_ads" || raw === "google_advert" || raw === "googleadvert";
}

function hasTrackedGoogleAds(booking: AdvertisingBookingInput, at: Date | null): boolean {
  return sourceLabel(booking, at) === "Tracked Google Ads";
}

export function isManuallyAttributedGoogleAds(booking: AdvertisingBookingInput): boolean {
  return isGoogleAdsSourceValue(booking.staffReportedSource)
    || isGoogleAdsSourceValue(booking.customerReportedSource)
    || isGoogleAdsSourceValue(booking.heardAbout);
}

/** Tracked clicks, customer reported Google Ads, or staff tagged Google Ads. */
export function isGoogleAdsAttributed(booking: AdvertisingBookingInput, at: Date | null = null): boolean {
  return hasTrackedGoogleAds(booking, at) || isManuallyAttributedGoogleAds(booking);
}

/** Clear label for the jobs list. Does not change stored source fields. */
export function googleAdsAttributionLabel(booking: AdvertisingBookingInput, at: Date | null = null): string {
  const tracked = hasTrackedGoogleAds(booking, at);
  const staff = isGoogleAdsSourceValue(booking.staffReportedSource);
  const customer = isGoogleAdsSourceValue(booking.customerReportedSource) || isGoogleAdsSourceValue(booking.heardAbout);
  if (tracked && (staff || customer)) return "Tracked Google Ads and manual tag";
  if (tracked) return "Tracked Google Ads";
  if (staff) return "Manually attributed Google Ads";
  if (customer) return "Customer said Google Ads";
  return sourceLabel(booking, at);
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

/** Enquiry date, falling back to booking creation date (Europe/London). */
export function bookedDate(booking: AdvertisingBookingInput): string {
  return londonDateKey(booking.enquiryAt) || londonDateKey(booking.createdAt);
}

function returnParentNumber(booking: AdvertisingBookingInput): string {
  if (booking.returnOfBookingNumber) return String(booking.returnOfBookingNumber).trim();
  const notes = String(booking.notes || "");
  const match = notes.match(/^Return for booking\s+([A-Za-z0-9-]+)/i);
  return match ? match[1] : "";
}

export type GoogleAdsJobRow = {
  id: string;
  bookingNumber: string;
  bookedDate: string;
  route: string;
  vehicle: string;
  status: string;
  farePence: number | null;
  receivedPence: number;
  cancelled: boolean;
  pending: boolean;
  confirmedEligible: boolean;
  attribution: string;
};

export type GoogleAdsPeriodReport = {
  dateBasisLabel: string;
  reportingDatesLabel: string;
  from: string;
  to: string;
  /** Manual spend fully inside the period. */
  spendPence: number;
  hasManualSpend: boolean;
  /** Value shown in the main spend figure, or null when nothing is recorded / unavailable. */
  displaySpendPence: number | null;
  spendSource: SpendSourceKind;
  spendSourceLabel: string;
  spendPartialFlags: PeriodSpendLine[];
  spendOverlaps: SpendOverlap[];
  spendImportedConflict: string | null;
  adsApiSpendPence: number | null;
  confirmedCount: number;
  confirmedFarePence: number | null;
  /** Spend ÷ confirmed ad bookings, or null when unknown. */
  costPerConfirmedPence: number | null;
  /** Agreed fares per £1 spent, as pence-of-fare per pound (e.g. 569 → £5.69). */
  bookedFarePerPoundPence: number | null;
  completedCount: number;
  completedFarePence: number | null;
  /** Payments received on confirmed ad bookings (not used as the booked-fare return). */
  paymentsReceivedPence: number;
  paymentsReturnLabel: string;
  cancelledCount: number;
  /** Active (incl. pending) and cancelled ad jobs in one list. */
  jobs: GoogleAdsJobRow[];
  cancelledJobs: GoogleAdsJobRow[];
};

function agreedFarePence(booking: AdvertisingBookingInput): number | null {
  const money = bookingMoney(booking);
  return money.totalPence > 0 ? money.totalPence : null;
}

function receivedPence(booking: AdvertisingBookingInput): number {
  return bookingMoney(booking).receivedPence;
}

function vehicleLabel(booking: AdvertisingBookingInput): string {
  return String(booking.vehicleType || booking.vehicle || "Vehicle not recorded").trim() || "Vehicle not recorded";
}

function routeLabel(booking: AdvertisingBookingInput): string {
  return `${booking.pickupLocation || booking.pickup || "Pickup not recorded"} → ${booking.destination || "Destination not recorded"}`;
}

export function resolvePeriodSpend(options: {
  from: string;
  to: string;
  spend: SpendRangeEntry[];
  adsSpendPence?: number | null;
}): {
  displaySpendPence: number | null;
  spendSource: SpendSourceKind;
  spendSourceLabel: string;
  spendPence: number;
  hasManualSpend: boolean;
  spendPartialFlags: PeriodSpendLine[];
  spendOverlaps: SpendOverlap[];
  spendImportedConflict: string | null;
  adsApiSpendPence: number | null;
} {
  const spend = periodManualSpend(options.spend, options.from, options.to);
  const adsApiSpendPence = options.adsSpendPence != null && Number.isFinite(options.adsSpendPence)
    ? Number(options.adsSpendPence)
    : null;
  const hasManualSpend = spend.included.length > 0;
  const replacesImported = spend.included.some((row) => row.replacesImported);
  let displaySpendPence: number | null = null;
  let spendSource: SpendSourceKind = "unavailable";
  let spendSourceLabel = "Unavailable";
  let spendImportedConflict: string | null = null;

  if (replacesImported && hasManualSpend) {
    displaySpendPence = spend.includedPence;
    spendSource = "manual";
    spendSourceLabel = spend.includedPence === 0
      ? "Manual · £0.00 (replaces imported for this period)"
      : `Manual · ${formatGbp(spend.includedPence)} (replaces imported for this period)`;
    if (adsApiSpendPence != null) {
      spendImportedConflict = `Imported spend ${formatGbp(adsApiSpendPence)} is available for this period but manual replacement is in use.`;
    }
  } else if (adsApiSpendPence != null) {
    displaySpendPence = adsApiSpendPence;
    spendSource = "imported";
    spendSourceLabel = adsApiSpendPence === 0
      ? "Imported · £0.00"
      : `Imported · ${formatGbp(adsApiSpendPence)}`;
    if (hasManualSpend) {
      spendImportedConflict = `Manual spend ${formatGbp(spend.includedPence)} also sits fully inside this period. Imported spend is shown. Tick “Replace imported spend for these dates” on a manual entry to use the manual total instead.`;
    }
  } else if (hasManualSpend) {
    displaySpendPence = spend.includedPence;
    spendSource = "manual";
    spendSourceLabel = spend.includedPence === 0
      ? "Manual · £0.00"
      : `Manual · ${formatGbp(spend.includedPence)}`;
  } else {
    displaySpendPence = null;
    spendSource = "unavailable";
    spendSourceLabel = "No ad spend recorded";
  }

  return {
    displaySpendPence,
    spendSource,
    spendSourceLabel,
    spendPence: spend.includedPence,
    hasManualSpend,
    spendPartialFlags: spend.partial,
    spendOverlaps: spend.overlaps,
    spendImportedConflict,
    adsApiSpendPence,
  };
}

/**
 * Google Ads jobs for the selected period by enquiry / booking date.
 * A linked return booking is counted once with its parent.
 * Tracked + manual attribution both count once; test / organic / repeat stay out of ad totals.
 */
export function buildGoogleAdsPeriodReport(
  bookings: AdvertisingBookingInput[],
  options: {
    from: string;
    to: string;
    spend: SpendRangeEntry[];
    adsSpendPence?: number | null;
    now?: Date;
  }
): GoogleAdsPeriodReport {
  const now = options.now || new Date();
  const resolved = resolvePeriodSpend(options);
  const inPeriod = bookings.filter((booking) => {
    if (isSyntheticBooking(booking)) return false;
    const day = bookedDate(booking);
    return day && day >= options.from && day <= options.to;
  });

  const parents = new Set(
    inPeriod
      .map((booking) => String(booking.bookingNumber || "").trim())
      .filter(Boolean)
  );
  const seenParents = new Set<string>();
  const adsJobs: GoogleAdsJobRow[] = [];

  inPeriod.forEach((booking) => {
    if (!isGoogleAdsAttributed(booking, now)) return;
    const parent = returnParentNumber(booking);
    if (parent && parents.has(parent)) return;
    const number = String(booking.bookingNumber || booking.id || "").trim();
    if (number && seenParents.has(number)) return;
    if (number) seenParents.add(number);

    const status = effectiveWorkflowStatus(booking);
    const cancelled = status === "cancelled";
    const pending = status === "pending" || status === "awaiting_customer_confirmation";
    const confirmedEligible = !cancelled && ["confirmed", "allocated", "completed"].includes(status);
    adsJobs.push({
      id: String(booking.id || number),
      bookingNumber: number || "Unknown",
      bookedDate: bookedDate(booking),
      route: routeLabel(booking),
      vehicle: vehicleLabel(booking),
      status,
      farePence: agreedFarePence(booking),
      receivedPence: receivedPence(booking),
      cancelled,
      pending,
      confirmedEligible,
      attribution: googleAdsAttributionLabel(booking, now),
    });
  });

  const cancelledJobs = adsJobs.filter((job) => job.cancelled);
  const confirmed = adsJobs.filter((job) => job.confirmedEligible);
  const completed = adsJobs.filter((job) => job.status === "completed");

  const sumFares = (rows: GoogleAdsJobRow[]): number | null => {
    if (rows.length === 0) return 0;
    if (rows.some((row) => row.farePence === null)) return null;
    return rows.reduce((sum, row) => sum + (row.farePence || 0), 0);
  };

  const confirmedFarePence = sumFares(confirmed);
  const displaySpendPence = resolved.displaySpendPence;
  let costPerConfirmedPence: number | null = null;
  let bookedFarePerPoundPence: number | null = null;
  if (displaySpendPence != null && confirmed.length > 0) {
    costPerConfirmedPence = Math.round(displaySpendPence / confirmed.length);
  }
  if (displaySpendPence != null && displaySpendPence > 0 && confirmedFarePence != null) {
    bookedFarePerPoundPence = Math.round((confirmedFarePence * 100) / displaySpendPence);
  } else if (displaySpendPence === 0 && confirmedFarePence != null && confirmedFarePence > 0) {
    bookedFarePerPoundPence = null;
  }

  const paymentsReceivedPence = confirmed.reduce((sum, row) => sum + row.receivedPence, 0);
  const jobs = [...adsJobs].sort(
    (a, b) => a.bookedDate.localeCompare(b.bookedDate) || a.bookingNumber.localeCompare(b.bookingNumber)
  );

  return {
    dateBasisLabel: "Jobs are counted by enquiry date, falling back to the booking creation date. A trip that travels later still appears in this period.",
    reportingDatesLabel: `Reporting ${options.from} to ${options.to} (Europe/London).`,
    from: options.from,
    to: options.to,
    spendPence: resolved.spendPence,
    hasManualSpend: resolved.hasManualSpend,
    displaySpendPence,
    spendSource: resolved.spendSource,
    spendSourceLabel: resolved.spendSourceLabel,
    spendPartialFlags: resolved.spendPartialFlags,
    spendOverlaps: resolved.spendOverlaps,
    spendImportedConflict: resolved.spendImportedConflict,
    adsApiSpendPence: resolved.adsApiSpendPence,
    confirmedCount: confirmed.length,
    confirmedFarePence,
    costPerConfirmedPence,
    bookedFarePerPoundPence,
    completedCount: completed.length,
    completedFarePence: sumFares(completed),
    paymentsReceivedPence,
    paymentsReturnLabel: "Payments received on confirmed ad bookings (not the booked fare return).",
    cancelledCount: cancelledJobs.length,
    jobs,
    cancelledJobs: cancelledJobs.sort((a, b) => a.bookedDate.localeCompare(b.bookedDate)),
  };
}

/** Filter the jobs list only. Headline spend and ratios stay on the unfiltered report. */
export function filterGoogleAdsJobs(
  jobs: GoogleAdsJobRow[],
  filters: { status?: string; route?: string; vehicle?: string; source?: string }
): GoogleAdsJobRow[] {
  return jobs.filter((job) => {
    if (filters.status && filters.status !== "all" && job.status !== filters.status) return false;
    if (filters.route && filters.route !== "all" && job.route !== filters.route) return false;
    if (filters.vehicle && filters.vehicle !== "all" && job.vehicle !== filters.vehicle) return false;
    if (filters.source && filters.source !== "all" && job.attribution !== filters.source) return false;
    return true;
  });
}

export function spendEntrySummary(entry: SpendRangeEntry): string {
  const range = spendRange(entry);
  const when = !range ? "Date not recorded" : range.from === range.to ? range.from : `${range.from} to ${range.to}`;
  const campaign = String(entry.campaign || "").trim();
  const replace = entry.replacesImported ? " · replaces imported" : "";
  return `${when} · ${formatGbp(entry.amountPence)}${campaign ? ` · ${campaign}` : ""}${replace}`;
}
