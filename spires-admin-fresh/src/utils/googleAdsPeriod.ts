import {
  AdvertisingBookingInput,
  SpendEntryInput,
  formatGbp,
  routeLabel,
  sourceLabel,
} from "./advertisingResults";
import { effectiveWorkflowStatus } from "./bookingWorkflow";
import { bookingMoney } from "./bookingMoney";

export type SpendRangeEntry = SpendEntryInput & {
  dateEnd?: string;
  campaign?: string;
  note?: string;
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
};

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

function londonDateKey(value: unknown): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(String(value));
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/London", year: "numeric", month: "2-digit", day: "2-digit" }).format(date);
}

function bookedDate(booking: AdvertisingBookingInput): string {
  return londonDateKey(booking.enquiryAt) || londonDateKey(booking.createdAt);
}

function returnParentNumber(booking: AdvertisingBookingInput): string {
  if (booking.returnOfBookingNumber) return String(booking.returnOfBookingNumber).trim();
  const notes = String(booking.notes || "");
  const match = notes.match(/^Return for booking\s+([A-Za-z0-9-]+)/i);
  return match ? match[1] : "";
}

/** Tracked clicks, customer reported Google Ads, or staff tagged Google Ads. */
export function isGoogleAdsAttributed(booking: AdvertisingBookingInput, at: Date | null = null): boolean {
  if (sourceLabel(booking, at) === "Tracked Google Ads") return true;
  const customer = String(booking.customerReportedSource || "").toLowerCase();
  if (customer === "google_advert" || customer === "google_ads") return true;
  const staff = String(booking.staffReportedSource || "").toLowerCase();
  if (staff === "google_ads" || staff === "google_advert") return true;
  const heard = String(booking.heardAbout || "").toLowerCase();
  return heard === "google_ads" || heard === "google advert" || heard === "google_advert";
}

export type GoogleAdsJobRow = {
  id: string;
  bookingNumber: string;
  bookedDate: string;
  route: string;
  status: string;
  farePence: number | null;
  receivedPence: number;
  cancelled: boolean;
  attribution: string;
};

export type GoogleAdsPeriodReport = {
  dateBasisLabel: string;
  from: string;
  to: string;
  /** Manual spend fully inside the period. */
  spendPence: number;
  hasManualSpend: boolean;
  /** Value shown in the main spend figure, or null when nothing is recorded. */
  displaySpendPence: number | null;
  spendPartialFlags: PeriodSpendLine[];
  spendOverlaps: SpendOverlap[];
  adsApiSpendPence: number | null;
  confirmedCount: number;
  confirmedFarePence: number | null;
  completedCount: number;
  completedFarePence: number | null;
  paymentsReceivedPence: number;
  cancelledCount: number;
  /** Active and cancelled ad jobs in one list. */
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

/**
 * Google Ads jobs for the selected period by the date they were booked.
 * A linked return booking is counted once with its parent.
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
  const spend = periodManualSpend(options.spend, options.from, options.to);
  const inPeriod = bookings.filter((booking) => {
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
    adsJobs.push({
      id: String(booking.id || number),
      bookingNumber: number || "Unknown",
      bookedDate: bookedDate(booking),
      route: `${booking.pickupLocation || booking.pickup || "Pickup not recorded"} → ${booking.destination || "Destination not recorded"}`,
      status,
      farePence: agreedFarePence(booking),
      receivedPence: receivedPence(booking),
      cancelled: status === "cancelled",
      attribution: sourceLabel(booking, now),
    });
  });

  const active = adsJobs.filter((job) => !job.cancelled);
  const cancelledJobs = adsJobs.filter((job) => job.cancelled);
  const confirmed = active.filter((job) => ["confirmed", "allocated", "completed"].includes(job.status));
  const completed = active.filter((job) => job.status === "completed");

  const sumFares = (rows: GoogleAdsJobRow[]): number | null => {
    if (rows.some((row) => row.farePence === null)) return null;
    return rows.reduce((sum, row) => sum + (row.farePence || 0), 0);
  };

  const adsApiSpendPence = options.adsSpendPence != null && Number.isFinite(options.adsSpendPence)
    ? Number(options.adsSpendPence)
    : null;
  const hasManualSpend = spend.included.length > 0;
  const displaySpendPence = hasManualSpend
    ? spend.includedPence
    : (adsApiSpendPence != null ? adsApiSpendPence : null);
  const jobs = [...active, ...cancelledJobs].sort(
    (a, b) => a.bookedDate.localeCompare(b.bookedDate) || a.bookingNumber.localeCompare(b.bookingNumber)
  );

  return {
    dateBasisLabel: "Jobs are counted by the date they were booked. A trip that travels later still appears in this period.",
    from: options.from,
    to: options.to,
    spendPence: spend.includedPence,
    hasManualSpend,
    displaySpendPence,
    spendPartialFlags: spend.partial,
    spendOverlaps: spend.overlaps,
    adsApiSpendPence,
    confirmedCount: confirmed.length,
    confirmedFarePence: sumFares(confirmed),
    completedCount: completed.length,
    completedFarePence: sumFares(completed),
    paymentsReceivedPence: active.reduce((sum, row) => sum + row.receivedPence, 0),
    cancelledCount: cancelledJobs.length,
    jobs,
    cancelledJobs: cancelledJobs.sort((a, b) => a.bookedDate.localeCompare(b.bookedDate)),
  };
}

export function spendEntrySummary(entry: SpendRangeEntry): string {
  const range = spendRange(entry);
  const when = !range ? "Date not recorded" : range.from === range.to ? range.from : `${range.from} to ${range.to}`;
  const campaign = String(entry.campaign || "").trim();
  return `${when} · ${formatGbp(entry.amountPence)}${campaign ? ` · ${campaign}` : ""}`;
}
