import { effectiveWorkflowStatus } from "./bookingWorkflow";

/** Pence. Null means the figure was not recorded. Never treat null as zero. */
export type Pence = number | null;

export const MONTHLY_ADVERTISING_BUDGET_PENCE = 13500;
export const ADVERTISING_BUDGET_LABEL = "Monthly advertising budget remains £135. This page does not change it.";
export const ADDITIONAL_BOOKINGS_NOTE = "This comparison does not claim that all additional bookings were caused by Google Ads. Only a booking with a consented Google click id is directly attributed to Google Ads.";
export const COMPARISON_OBJECTIVE = "See whether introducing Google Ads increased the number of bookings and the revenue recorded for Spires Taxis. Compare the stored booking records from before Google Ads with the records from after Google Ads started. A historical booking is not modified merely to produce a comparison.";
export const RESULTS_CONTEXT_NOTE = "Seasonality, repeat customers, referrals and other marketing activities may affect these results.";

export interface AttributionTouch {
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
}

export interface AttributionInput {
  consent?: string;
  gclid?: string;
  gbraid?: string;
  wbraid?: string;
  expiresAt?: number;
  first?: AttributionTouch;
  latest?: AttributionTouch;
}

export interface PaymentEntryInput {
  clientRequestId?: string;
  mode?: string;
  kind?: string;
  amountPence?: number;
}

export interface ExpenseInput {
  type?: string;
  amount?: number;
}

export interface JobCostInput {
  driverPaymentPence?: number | null;
  fuelPence?: number | null;
  parkingPence?: number | null;
  airportChargesPence?: number | null;
  paymentFeesPence?: number | null;
}

export interface AdvertisingBookingInput {
  id?: string;
  bookingNumber?: string;
  status?: string;
  adminStatus?: string;
  customerStatus?: string;
  dateTime?: string | Date | number;
  pickupTime?: string | Date | number;
  createdAt?: string | Date | number;
  updatedAt?: string | Date | number;
  pickup?: string;
  pickupLocation?: string;
  destination?: string;
  vehicleType?: string;
  bookingType?: string;
  returnTrip?: boolean;
  bookingMethod?: string;
  acceptanceMethod?: string;
  source?: string;
  enquiryChannel?: string;
  notes?: string;
  hirerName?: string;
  name?: string;
  hirerPhone?: string;
  email?: string;
  syntheticMeasurementTest?: boolean;
  actualFare?: number;
  finalFarePence?: number;
  issuedQuote?: { finalFarePence?: number } | null;
  amountReceivedPence?: number | null;
  amountRefundedPence?: number | null;
  paymentStatus?: string;
  paymentEntries?: PaymentEntryInput[];
  expenses?: ExpenseInput[];
  marketingAttribution?: AttributionInput | null;
  dueOnOutbound?: number;
  dueOnReturn?: number;
  returnOfBookingNumber?: string;
  staffReportedSource?: string;
  jobCosts?: JobCostInput | null;
}

export interface SpendEntryInput {
  id: string;
  date: string;
  amountPence: number;
  source: "manual" | "google_ads";
  label: string;
}

export interface AdvertisingReportOptions {
  from: string;
  to: string;
  dateBasis: "journey" | "enquiry";
  now?: Date;
  spend: SpendEntryInput[];
  /** Manual entries are the whole advertising spend for the period. Live Google Ads is separate. */
  manualSpendIsComplete: boolean;
  adsConnected: boolean;
  adsSpendPence?: Pence;
  /** A date the business has recorded. A stored click is never used here. */
  advertisingStartedOn?: string | null;
  /** True only after an administrator confirms the recorded date. */
  advertisingStartConfirmed?: boolean;
}

export interface MoneyRow {
  label: string;
  pence: Pence;
  detail: string;
}

export interface GrowthSide {
  from: string;
  to: string;
  days: number;
  total: number;
  confirmed: number;
  completed: number;
  bookingsPerDay: number | null;
  revenuePence: Pence;
  revenuePerDayPence: Pence;
  grossBookingRevenuePence: Pence;
  averageBookingPence: Pence;
  confirmedRate: number | null;
  enquiryVolume: number | null;
  enquiryConversionRate: number | null;
  returningCustomers: number | null;
  newCustomers: number | null;
  unidentifiedCustomers: number;
  summary: string;
}

export interface BusinessGrowth {
  label: string;
  text: string;
  detail: string;
  before: GrowthSide | null;
  after: GrowthSide | null;
  /** Gaps in the bookings used for the before and after comparison. Empty when that comparison is not calculated. */
  limitations: string[];
}

export interface RatioRow {
  label: string;
  /** Recorded payment pounds divided by advertising spend pounds. Null stays unknown. */
  ratio: number | null;
  detail: string;
}

export interface FrequencyPoint {
  date: string;
  bookings: number;
  confirmed: number;
  /** Daily bookings on this finished day and the six finished days before it, divided by 7. */
  rollingAverage: number | null;
  /** Quoted fare of confirmed, allocated and completed bookings. Null when a fare is missing. */
  grossBookingRevenuePence: number | null;
  /** Gross booking revenue on this finished day and the six finished days before it, divided by 7. */
  grossRollingAveragePence: number | null;
  /** Dated Google Ads spend for this finished day. Null means no daily figure was returned. */
  spendPence: number | null;
}

export interface PeriodPace {
  from: string;
  to: string;
  days: number;
  confirmed: number;
  included: number;
  bookingsPerDay: number | null;
  confirmedRate: number | null;
  revenuePerDayPence: Pence;
  averageBookingPence: Pence;
}

export type AdvertisingDatePreset = "today" | "last_7";

export interface BreakdownRow {
  label: string;
  enquiries: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  quotedPence: Pence;
  netPaymentsPence: Pence;
}

export interface SourcePrompt {
  id: string;
  bookingNumber: string;
  journeyDate: string;
  route: string;
  channel: "telephone" | "whatsapp";
  staffReportedSource: string;
}

export interface CostPrompt {
  id: string;
  bookingNumber: string;
  journeyDate: string;
  route: string;
  costs: Required<JobCostInput>;
}

export interface AdvertisingReport {
  from: string;
  to: string;
  dateBasis: "journey" | "enquiry";
  budgetLabel: string;
  enquiries: number;
  confirmed: number;
  completed: number;
  cancelled: number;
  confirmedForCost: number;
  completedPaid: number;
  completedPaymentUnknown: number;
  quoted: MoneyRow;
  netPayments: MoneyRow;
  costs: {
    driver: MoneyRow;
    fuel: MoneyRow;
    parking: MoneyRow;
    airport: MoneyRow;
    paymentFees: MoneyRow;
  };
  manualSpend: MoneyRow;
  adsSpend: MoneyRow;
  advertisingSpend: MoneyRow;
  contribution: MoneyRow;
  returnOnSpend: RatioRow;
  businessGrowth: BusinessGrowth;
  directAds: {
    label: string;
    confirmed: number;
    customerReported: number;
    cancelled: number;
    enquiries: number;
    detail: string;
  };
  otherSources: {
    label: string;
    confirmed: number;
    customerReportedAds: number;
    detail: string;
  };
  unknownAttribution: {
    label: string;
    confirmed: number;
    detail: string;
  };
  revenuePerDay: MoneyRow;
  averageBookingValue: MoneyRow;
  confirmedRateLabel: string;
  confirmedRate: number | null;
  earlierPace: PeriodPace;
  selectedPace: PeriodPace;
  /** Daily booking counts on each finished day in the selected range. The current day is omitted. */
  frequency: FrequencyPoint[];
  /** Change in daily bookings per finished day against the equal earlier period. */
  frequencyChange: string;
  /** Change in recorded revenue per finished day. A missing payment stays uncalculated. */
  revenuePerDayChange: string;
  /** Change in average quoted fare. A missing fare stays uncalculated. */
  averageBookingValueChange: string;
  /** Change in confirmed bookings among bookings that were not cancelled. */
  confirmedBookingRateChange: string;
  costPerConfirmed: MoneyRow;
  costPerCompletedPaid: MoneyRow;
  attribution: {
    trackedGoogleAds: number;
    customerReported: number;
    unknown: number;
    telephoneWithoutSource: number;
    whatsappWithoutSource: number;
    included: number;
  };
  byRoute: BreakdownRow[];
  byVehicle: BreakdownRow[];
  bySource: BreakdownRow[];
  byEnquiry: BreakdownRow[];
  unpaidConfirmed: number;
  sourcePrompts: SourcePrompt[];
  costPrompts: CostPrompt[];
  excluded: { synthetic: number; duplicate: number; returnLegs: number; missingCreationDate: number; missingJourneyDate: number };
  limitations: string[];
  reportingBasis: string;
  freshness: string;
}

const STATUS_RANK: Record<string, number> = {
  completed: 5,
  allocated: 4,
  confirmed: 3,
  awaiting_customer_confirmation: 2,
  pending: 1,
  cancelled: 0,
};

const REPORTED_LABELS: Record<string, string> = {
  google_ads: "Customer reported Google Ads",
  website: "Customer reported website",
  repeat: "Customer reported repeat booking",
  recommendation: "Customer reported recommendation",
  other: "Customer reported other",
};

export function londonDateKey(value: unknown): string | null {
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  if (typeof value === "string" && /^\d{4}-\d{2}-\d{2}T/.test(value) && !/(?:[zZ]|[+-]\d{2}:\d{2})$/.test(value)) {
    return value.slice(0, 10);
  }
  const date = coerceDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function londonDateTimeLabel(value: unknown): string {
  const date = coerceDate(value);
  if (!date) return "Unknown";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    dateStyle: "medium",
    timeStyle: "short",
  }).format(date);
}

export function formatGbp(pence: Pence): string {
  if (pence === null) return "Unknown";
  const pounds = pence / 100;
  return new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP" }).format(pounds);
}

export function formatPace(value: number | null): string {
  if (value === null) return "Unknown";
  const rounded = Math.round(value * 10) / 10;
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1);
}

export function formatRate(rate: number | null): string {
  if (rate === null) return "Unknown";
  const percent = Math.round(rate * 1000) / 10;
  return Number.isInteger(percent) ? `${percent}%` : `${percent.toFixed(1)}%`;
}

export function percentageChange(earlier: number | null, later: number | null, emptyLabel: string): string {
  if (earlier === null || later === null) return "Change: not calculated";
  if (earlier === 0 && later === 0) return `No change. Both periods had no ${emptyLabel}`;
  if (earlier === 0) return `Change: not calculated. The earlier period had no ${emptyLabel}`;
  const percent = Math.round(((later - earlier) / earlier) * 1000) / 10;
  const amount = Number.isInteger(Math.abs(percent)) ? `${Math.abs(percent)}%` : `${Math.abs(percent).toFixed(1)}%`;
  if (percent < 0) return `Decrease: ${amount}`;
  return `Increase: ${amount}`;
}

export function bookingPaceChange(earlier: number | null, selected: number | null): string {
  return percentageChange(earlier, selected, "confirmed bookings");
}

export function beforeAdsBookingsPerDay(days: number, bookingsPerDay: number | null): string {
  if (days === 0 || bookingsPerDay === null) return "Before ads: bookings per day are not calculated.";
  return `Before ads: ${formatPace(bookingsPerDay)} bookings per day.`;
}

export function afterAdsBookingsPerDay(days: number, bookingsPerDay: number | null): string {
  if (days === 0 || bookingsPerDay === null) return "After ads: bookings per day are not calculated.";
  return `After ads: ${formatPace(bookingsPerDay)} bookings per day.`;
}

export function bookingFrequencyChange(earlierBookings: number, earlierDays: number, laterBookings: number, laterDays: number): string {
  const rate = (bookings: number, days: number) => (days > 0 ? bookings / days : null);
  return percentageChange(rate(earlierBookings, earlierDays), rate(laterBookings, laterDays), "daily bookings");
}

export function revenuePerDayChange(earlier: number | null, later: number | null): string {
  return percentageChange(earlier, later, "recorded revenue");
}

export function averageBookingValueChange(earlier: number | null, later: number | null): string {
  return percentageChange(earlier, later, "average booking value");
}

export function confirmedBookingRateChange(earlier: number | null, later: number | null): string {
  return percentageChange(earlier, later, "confirmed booking rate");
}

export function inclusiveDays(from: string, to: string): number {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(from) || !/^\d{4}-\d{2}-\d{2}$/.test(to) || to < from) return 0;
  const [fromYear, fromMonth, fromDay] = from.split("-").map(Number);
  const [toYear, toMonth, toDay] = to.split("-").map(Number);
  const start = Date.UTC(fromYear, fromMonth - 1, fromDay);
  const end = Date.UTC(toYear, toMonth - 1, toDay);
  return Math.round((end - start) / 86400000) + 1;
}

export function previousDateRange(from: string, to: string): { from: string; to: string } {
  const days = Math.max(1, inclusiveDays(from, to));
  const end = shiftDateKey(from, -1);
  return { from: shiftDateKey(end, -(days - 1)), to: end };
}

export function interpretAttribution(input: {
  trackedGoogleAds: number;
  customerReported: number;
  unknown: number;
  included: number;
  telephoneWithoutSource: number;
  whatsappWithoutSource: number;
  earlierPerDay: number | null;
  selectedPerDay: number | null;
  finished?: boolean;
  leavesOutCurrentDay?: boolean;
}): string[] {
  if (input.finished === false) {
    return [
      "There is no finished day in this period, so attribution is not calculated. The current day is left out.",
      ADDITIONAL_BOOKINGS_NOTE,
      RESULTS_CONTEXT_NOTE,
    ];
  }
  const lines = [
    `${input.trackedGoogleAds} of ${input.included} included bookings have a tracked Google Ads click. ${input.customerReported} were reported by the customer. ${input.unknown} have no source and are not treated as advertising.`,
  ];
  if (input.trackedGoogleAds === 0) {
    lines.push("No booking in this period can be attributed to Google Ads from a stored click.");
  } else {
    lines.push("Only a booking with a consented Google click id is attributed to Google Ads. A customer saying the enquiry came from an advert is kept separate.");
  }
  if (input.earlierPerDay !== null && input.selectedPerDay !== null) {
    if (input.earlierPerDay === 0) {
      lines.push("The earlier period had no confirmed bookings, so the percentage change is not calculated. That is not treated as an increase caused by Google Ads.");
    } else {
      lines.push(`${bookingPaceChange(input.earlierPerDay, input.selectedPerDay)}. Confirmed bookings a day were ${formatPace(input.earlierPerDay)} in the earlier period and ${formatPace(input.selectedPerDay)} in the selected period. That change is not an attribution to Google Ads.`);
    }
  }
  const unrecorded = input.telephoneWithoutSource + input.whatsappWithoutSource;
  if (unrecorded > 0) {
    lines.push(`${input.telephoneWithoutSource} telephone and ${input.whatsappWithoutSource} WhatsApp bookings have no recorded source, so they stay unknown.`);
  }
  if (input.leavesOutCurrentDay) {
    lines.push("The current day is not finished, so it is left out of these counts.");
  }
  lines.push("A cancellation or an enquiry is not included in the confirmed attribution counts.");
  lines.push("A measurement marked submitted was accepted by the collection endpoint. It is not confirmed in a GA4 report and it is not confirmed as a Google Ads conversion.");
  lines.push(ADDITIONAL_BOOKINGS_NOTE);
  lines.push(RESULTS_CONTEXT_NOTE);
  return lines;
}

export function formatReturn(ratio: number | null): string {
  if (ratio === null) return "Unknown";
  const pounds = new Intl.NumberFormat("en-GB", { style: "currency", currency: "GBP", minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(ratio);
  return `${pounds} for each £1 spent`;
}

function shiftDateKey(ymd: string, days: number): string {
  const [year, month, day] = ymd.split("-").map(Number);
  return new Date(Date.UTC(year, month - 1, day + days)).toISOString().slice(0, 10);
}

/** The current London day, or the seven finished days ending yesterday. */
export function advertisingDateRange(preset: AdvertisingDatePreset, now = new Date()): { from: string; to: string } {
  const today = londonDateKey(now) || "1970-01-01";
  if (preset === "today") return { from: today, to: today };
  const yesterday = shiftDateKey(today, -1);
  return { from: shiftDateKey(yesterday, -6), to: yesterday };
}

export function currentLondonMonth(now = new Date()): { from: string; to: string } {
  const today = londonDateKey(now) || "1970-01-01";
  return { from: `${today.slice(0, 7)}-01`, to: today };
}

function coerceDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === "object" && "toDate" in (value as { toDate?: () => Date }) && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function finiteNumber(value: unknown): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim() && Number.isFinite(Number(value))) return Number(value);
  return null;
}

function workflow(booking: AdvertisingBookingInput): string {
  return effectiveWorkflowStatus(booking);
}

export function isSyntheticBooking(booking: AdvertisingBookingInput): boolean {
  const id = String(booking.id || "");
  const name = String(booking.hirerName || booking.name || "").trim().toLowerCase();
  const pickup = String(booking.pickupLocation || booking.pickup || "").trim().toLowerCase();
  return booking.syntheticMeasurementTest === true
    || id.startsWith("synthetic-measurement-")
    || name === "synthetic measurement test"
    || pickup === "synthetic test pickup";
}

function returnParentNumber(booking: AdvertisingBookingInput): string {
  if (booking.returnOfBookingNumber) return booking.returnOfBookingNumber.trim();
  const notes = String(booking.notes || "");
  const match = notes.match(/^Return for booking\s+([A-Za-z0-9-]+)/);
  return match ? match[1] : "";
}

function quotedPence(booking: AdvertisingBookingInput): Pence {
  const issued = finiteNumber(booking.issuedQuote?.finalFarePence);
  if (issued !== null) return Math.round(issued);
  const finalFare = finiteNumber(booking.finalFarePence);
  if (finalFare !== null) return Math.round(finalFare);
  const actual = finiteNumber(booking.actualFare);
  if (actual !== null) return Math.round(actual * 100);
  return null;
}

function refundFromEntries(booking: AdvertisingBookingInput): Pence {
  const entries = Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [];
  const seen = new Set<string>();
  let total = 0;
  let found = false;
  entries.forEach((entry, index) => {
    const mode = String(entry?.mode || entry?.kind || "").toLowerCase();
    if (mode !== "refund" && mode !== "refunded") return;
    const key = entry?.clientRequestId ? String(entry.clientRequestId) : `index-${index}`;
    if (seen.has(key)) return;
    seen.add(key);
    const amount = finiteNumber(entry?.amountPence);
    if (amount === null) return;
    found = true;
    total += Math.round(amount);
  });
  return found ? total : null;
}

function paymentPosition(booking: AdvertisingBookingInput): { net: Pence; unknownRefund: boolean } {
  const received = finiteNumber(booking.amountReceivedPence);
  if (received === null) return { net: null, unknownRefund: booking.paymentStatus === "refunded" };
  const explicit = finiteNumber(booking.amountRefundedPence);
  const fromEntries = explicit === null ? refundFromEntries(booking) : null;
  const refund = explicit !== null ? Math.round(explicit) : fromEntries;
  if (refund !== null) return { net: Math.round(received) - refund, unknownRefund: false };
  if (booking.paymentStatus === "refunded") return { net: null, unknownRefund: true };
  return { net: Math.round(received), unknownRefund: false };
}

function expensePence(booking: AdvertisingBookingInput, type: string): Pence {
  const rows = (booking.expenses || []).filter((row) => String(row?.type || "").toLowerCase() === type);
  if (!rows.length) return null;
  let total = 0;
  for (const row of rows) {
    const amount = finiteNumber(row.amount);
    if (amount === null) return null;
    total += Math.round(amount * 100);
  }
  return total;
}

function jobCosts(booking: AdvertisingBookingInput): Required<JobCostInput> {
  const recorded = booking.jobCosts || {};
  const pick = (recordedValue: number | null | undefined, expenseType?: string): Pence => {
    const explicit = finiteNumber(recordedValue);
    if (explicit !== null) return Math.round(explicit);
    if (recordedValue === null) return null;
    return expenseType ? expensePence(booking, expenseType) : null;
  };
  return {
    driverPaymentPence: pick(recorded.driverPaymentPence),
    fuelPence: pick(recorded.fuelPence, "fuel"),
    parkingPence: pick(recorded.parkingPence, "parking"),
    airportChargesPence: pick(recorded.airportChargesPence),
    paymentFeesPence: pick(recorded.paymentFeesPence),
  };
}

function clickValues(attribution: AttributionInput | null | undefined): string[] {
  if (!attribution) return [];
  const touches = [attribution, attribution.first, attribution.latest];
  return touches.flatMap((touch) => {
    if (!touch) return [];
    return [touch.gclid, touch.gbraid, touch.wbraid].filter((value): value is string => typeof value === "string");
  });
}

function hasTrackedGoogleAds(booking: AdvertisingBookingInput, at: Date | null): boolean {
  const attribution = booking.marketingAttribution;
  if (!attribution || attribution.consent !== "granted") return false;
  const click = clickValues(attribution).some((value) => typeof value === "string" && value.trim().length > 0);
  if (!click) return false;
  if (typeof attribution.expiresAt === "number" && at && attribution.expiresAt <= at.getTime()) return false;
  return true;
}

export function sourceLabel(booking: AdvertisingBookingInput, at: Date | null = null): string {
  if (hasTrackedGoogleAds(booking, at)) return "Tracked Google Ads";
  const reported = String(booking.staffReportedSource || "");
  return REPORTED_LABELS[reported] || "Unknown";
}

export function enquiryKind(booking: AdvertisingBookingInput): "quote" | "booking_request" | "telephone" | "whatsapp" | "unknown" {
  const channel = enquiryChannel(booking);
  if (channel) return channel;
  const source = String(booking.source || "").toLowerCase();
  if (source === "website") return "quote";
  if (source === "customer_app") return "booking_request";
  return "unknown";
}

export function enquiryChannel(booking: AdvertisingBookingInput): "telephone" | "whatsapp" | "" {
  const method = String(booking.bookingMethod || "").toLowerCase();
  const acceptance = String(booking.acceptanceMethod || "").toLowerCase();
  const source = String(booking.source || "").toLowerCase();
  const channel = String(booking.enquiryChannel || "").toLowerCase();
  if (channel === "whatsapp" || acceptance === "whatsapp" || source === "whatsapp" || method === "whatsapp") return "whatsapp";
  if (channel === "telephone" || method === "telephone" || method === "phone" || acceptance === "phone") return "telephone";
  return "";
}

export function routeLabel(booking: AdvertisingBookingInput): string {
  const text = `${booking.pickupLocation || ""} ${booking.pickup || ""} ${booking.destination || ""}`.toLowerCase();
  const airports: Array<[string, string]> = [
    ["heathrow", "Heathrow"],
    ["gatwick", "Gatwick"],
    ["luton", "Luton"],
    ["stansted", "Stansted"],
    ["birmingham airport", "Birmingham"],
    ["bristol", "Bristol"],
    ["london city", "London City"],
    ["city airport", "London City"],
  ];
  const airport = airports.find(([needle]) => text.includes(needle));
  if (!airport) return "No airport named";
  const other = text.includes("oxford") ? "Oxford" : "other";
  return `${airport[1]} and ${other}`;
}

export function vehicleLabel(booking: AdvertisingBookingInput): string {
  const value = String(booking.vehicleType || "").toLowerCase().replace(/[_-]+/g, " ").trim();
  if (!value) return "Unknown vehicle";
  if (value.includes("8") || value.includes("eight") || value.includes("mpv")) return "8 seater";
  if (value.includes("standard") || value.includes("saloon") || value === "car") return "Standard";
  return "Other vehicle";
}

function inRange(date: string | null, from: string, to: string): boolean {
  return !!date && date >= from && date <= to;
}

function sumPence(values: Pence[]): Pence {
  if (values.some((value) => value === null)) return null;
  return values.reduce<number>((total, value) => total + (value || 0), 0);
}

function moneyRow(label: string, pence: Pence, detail: string): MoneyRow {
  return { label, pence, detail };
}

interface Prepared {
  booking: AdvertisingBookingInput;
  status: string;
  journeyDate: string | null;
  when: Date | null;
  quoted: Pence;
  net: Pence;
  costs: Required<JobCostInput>;
  source: string;
  route: string;
  vehicle: string;
  channel: "telephone" | "whatsapp" | "";
}

function prepare(bookings: AdvertisingBookingInput[], options: AdvertisingReportOptions): { rows: Prepared[]; excluded: AdvertisingReport["excluded"] } {
  const excluded = { synthetic: 0, duplicate: 0, returnLegs: 0, missingCreationDate: 0, missingJourneyDate: 0 };
  const real = bookings.filter((booking) => {
    if (!isSyntheticBooking(booking)) return true;
    excluded.synthetic += 1;
    return false;
  });
  const grouped = new Map<string, AdvertisingBookingInput[]>();
  real.forEach((booking, index) => {
    const key = booking.bookingNumber ? `number:${booking.bookingNumber}` : `id:${booking.id || index}`;
    const list = grouped.get(key) || [];
    list.push(booking);
    grouped.set(key, list);
  });
  const deduped: AdvertisingBookingInput[] = [];
  grouped.forEach((list) => {
    const ranked = [...list].sort((left, right) => {
      const statusGap = (STATUS_RANK[workflow(right)] || 0) - (STATUS_RANK[workflow(left)] || 0);
      if (statusGap !== 0) return statusGap;
      return (coerceDate(right.updatedAt)?.getTime() || 0) - (coerceDate(left.updatedAt)?.getTime() || 0);
    });
    deduped.push(ranked[0]);
    excluded.duplicate += list.length - 1;
  });
  const numbers = new Set(deduped.map((booking) => booking.bookingNumber).filter(Boolean) as string[]);
  const kept = deduped.filter((booking) => {
    const parent = returnParentNumber(booking);
    if (!parent || !numbers.has(parent) || parent === booking.bookingNumber) return true;
    const original = deduped.find((row) => row.bookingNumber === parent);
    const originalIsPricedReturn = !!original && (original.bookingType === "return" || original.returnTrip === true) && quotedPence(original) !== null;
    if (!originalIsPricedReturn) return true;
    excluded.returnLegs += 1;
    return false;
  });
  const rows = kept.map((booking) => {
    const when = coerceDate(booking.pickupTime || booking.dateTime || booking.createdAt);
    const payment = paymentPosition(booking);
    return {
      booking,
      status: workflow(booking),
      journeyDate: londonDateKey(booking.pickupTime || booking.dateTime),
      when,
      quoted: quotedPence(booking),
      net: payment.net,
      costs: jobCosts(booking),
      source: sourceLabel(booking, when),
      route: routeLabel(booking),
      vehicle: vehicleLabel(booking),
      channel: enquiryChannel(booking),
    };
  }).filter((row) => {
    if (options.dateBasis !== "enquiry") {
      if (!row.journeyDate) {
        excluded.missingJourneyDate += 1;
        return false;
      }
      return inRange(row.journeyDate, options.from, options.to);
    }
    const created = creationDateKey(row.booking);
    if (!created) {
      excluded.missingCreationDate += 1;
      return false;
    }
    return inRange(created, options.from, options.to);
  });
  return { rows, excluded };
}

function bucket(status: string): "enquiries" | "confirmed" | "completed" | "cancelled" | "other" {
  if (status === "pending" || status === "awaiting_customer_confirmation") return "enquiries";
  if (status === "confirmed" || status === "allocated") return "confirmed";
  if (status === "completed") return "completed";
  if (status === "cancelled") return "cancelled";
  return "other";
}

function breakdown(rows: Prepared[], labelFor: (row: Prepared) => string): BreakdownRow[] {
  const groups = new Map<string, Prepared[]>();
  rows.forEach((row) => {
    const label = labelFor(row);
    const list = groups.get(label) || [];
    list.push(row);
    groups.set(label, list);
  });
  return Array.from(groups.entries()).map(([label, list]) => {
    const quotedValues = list.map((row) => row.quoted);
    const paymentValues = list.map((row) => row.net);
    return {
      label,
      enquiries: list.filter((row) => bucket(row.status) === "enquiries").length,
      confirmed: list.filter((row) => bucket(row.status) === "confirmed").length,
      completed: list.filter((row) => bucket(row.status) === "completed").length,
      cancelled: list.filter((row) => bucket(row.status) === "cancelled").length,
      quotedPence: quotedValues.some((value) => value === null) ? null : sumPence(quotedValues),
      netPaymentsPence: paymentValues.some((value) => value === null) ? null : sumPence(paymentValues),
    };
  }).sort((left, right) => right.completed - left.completed || left.label.localeCompare(right.label));
}

function creationDateKey(booking: AdvertisingBookingInput): string | null {
  return londonDateKey(booking.createdAt);
}

function rowDateKey(row: Prepared, basis: "journey" | "enquiry"): string | null {
  if (basis === "enquiry") return creationDateKey(row.booking);
  return row.journeyDate;
}

/** Finished London days inside the selected range. Today and later dates are left out. */
function finishedRange(from: string, to: string, now: Date): { from: string; to: string } | null {
  if (inclusiveDays(from, to) === 0) return null;
  const today = londonDateKey(now);
  if (!today || to < today) return { from, to };
  if (from > today) return null;
  const yesterday = shiftDateKey(today, -1);
  if (from > yesterday) return null;
  return { from, to: yesterday };
}

function bookingFrequency(rows: Prepared[], from: string, to: string, basis: "journey" | "enquiry"): FrequencyPoint[] {
  const bookings = new Map<string, number>();
  const confirmed = new Map<string, number>();
  const grossRows = new Map<string, Prepared[]>();
  rows.forEach((row) => {
    const key = rowDateKey(row, basis);
    if (!key) return;
    bookings.set(key, (bookings.get(key) || 0) + 1);
    const status = bucket(row.status);
    if (status === "confirmed" || status === "completed") {
      confirmed.set(key, (confirmed.get(key) || 0) + 1);
      const list = grossRows.get(key) || [];
      list.push(row);
      grossRows.set(key, list);
    }
  });
  const dayGross = (date: string): Pence => grossBookingRevenue(grossRows.get(date) || []);
  const points: FrequencyPoint[] = [];
  const days = inclusiveDays(from, to);
  for (let index = 0; index < days; index += 1) {
    const date = shiftDateKey(from, index);
    let sum = 0;
    let grossSum = 0;
    let grossKnown = true;
    for (let back = 0; back < 7; back += 1) {
      const earlier = shiftDateKey(date, -back);
      sum += bookings.get(earlier) || 0;
      const part = dayGross(earlier);
      if (part === null) grossKnown = false;
      else grossSum += part;
    }
    points.push({
      date,
      bookings: bookings.get(date) || 0,
      confirmed: confirmed.get(date) || 0,
      rollingAverage: sum / 7,
      grossBookingRevenuePence: dayGross(date),
      grossRollingAveragePence: grossKnown ? grossSum / 7 : null,
      spendPence: null,
    });
  }
  return points;
}

function withGoogleAdsSpend(points: FrequencyPoint[], spend: SpendEntryInput[]): FrequencyPoint[] {
  const totals = new Map<string, number>();
  spend.forEach((entry) => {
    if (entry.source !== "google_ads" || !/^\d{4}-\d{2}-\d{2}$/.test(entry.date) || !Number.isFinite(entry.amountPence)) return;
    totals.set(entry.date, (totals.get(entry.date) || 0) + Math.round(entry.amountPence));
  });
  return points.map((point) => ({ ...point, spendPence: totals.has(point.date) ? totals.get(point.date) ?? 0 : null }));
}

function rowsOnDates(rows: Prepared[], from: string, to: string, basis: "journey" | "enquiry"): Prepared[] {
  return rows.filter((row) => {
    const key = rowDateKey(row, basis);
    return key !== null && key >= from && key <= to;
  });
}

function recordedRevenue(rows: Prepared[]): Pence {
  const awaitingPayment = rows.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed");
  if (awaitingPayment.some((row) => row.net === null)) return null;
  const recorded = rows.filter((row) => row.net !== null);
  if (!recorded.length) return null;
  return sumPence(recorded.map((row) => row.net));
}

function emptyPace(): PeriodPace {
  return { from: "", to: "", days: 0, confirmed: 0, included: 0, bookingsPerDay: null, confirmedRate: null, revenuePerDayPence: null, averageBookingPence: null };
}

function revenuePerDayDetail(pace: PeriodPace, rows: Prepared[]): string {
  if (pace.days === 0) return "This period has no finished day, so revenue per day is not calculated.";
  const awaiting = rows.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed");
  const missing = awaiting.filter((row) => row.net === null).length;
  if (missing > 0) return `${missing} confirmed ${missing === 1 ? "booking has" : "bookings have"} no recorded payment on the finished days. Those are not counted as zero.`;
  if (pace.revenuePerDayPence === null) return "No payment was recorded on the finished days, so revenue per day is not calculated.";
  if (pace.revenuePerDayPence === 0) return "Recorded payments on the finished days come to zero. A cancellation or enquiry with no payment is left out.";
  return "Recorded payments on finished days, less refunds, divided by those days. A cancellation or enquiry with no payment is left out. Quoted fares are not used.";
}

function confirmedValueRows(rows: Prepared[]): Prepared[] {
  return rows.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed");
}

function averageBookingPence(rows: Prepared[]): Pence {
  const confirmed = confirmedValueRows(rows);
  if (!confirmed.length || confirmed.some((row) => row.quoted === null)) return null;
  return Math.round((sumPence(confirmed.map((row) => row.quoted)) || 0) / confirmed.length);
}

function averageBookingDetail(rows: Prepared[]): string {
  const confirmed = confirmedValueRows(rows);
  if (!confirmed.length) return "No confirmed, allocated or completed bookings in this period. Cancellations are not included.";
  if (confirmed.some((row) => row.quoted === null)) return "A confirmed booking has no quoted fare. That missing fare is not counted as zero.";
  return "Average quoted fare of confirmed, allocated and completed bookings. Cancellations are not included. This is not money received.";
}

function confirmedRateLabel(rows: Prepared[], confirmed: number, openCount: number, options: AdvertisingReportOptions, now: Date): string {
  const cancelled = rows.filter((row) => bucket(row.status) === "cancelled").length;
  const today = londonDateKey(now);
  const unfinished = Boolean(today && options.from <= today && options.to >= today);
  const tail = unfinished ? " The current day is not finished, so it is left out of this comparison." : "";
  if (!rows.length) return `No bookings in this period.${tail}`;
  if (openCount === 0) return `Every booking in this period is cancelled, so the confirmed booking rate is not calculated.${tail}`;
  const cancellationText = `${cancelled} ${cancelled === 1 ? "cancellation is" : "cancellations are"} counted separately.`;
  return `${confirmed} of ${openCount} bookings that were not cancelled are confirmed, allocated or completed. ${cancellationText}${tail}`;
}

function periodPace(rows: Prepared[], from: string, to: string): PeriodPace {
  const days = inclusiveDays(from, to);
  const confirmedRows = rows.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed");
  const fareValues = confirmedRows.map((row) => row.quoted);
  const stillOpen = rows.filter((row) => bucket(row.status) !== "cancelled");
  const revenue = recordedRevenue(rows);
  const average = !confirmedRows.length || fareValues.some((value) => value === null) ? null : Math.round((sumPence(fareValues) || 0) / confirmedRows.length);
  return {
    from,
    to,
    days,
    confirmed: confirmedRows.length,
    included: rows.length,
    bookingsPerDay: days === 0 ? null : confirmedRows.length / days,
    confirmedRate: stillOpen.length === 0 ? null : confirmedRows.length / stillOpen.length,
    revenuePerDayPence: revenue === null || days === 0 ? null : Math.round(revenue / days),
    averageBookingPence: average,
  };
}

function reportingBasis(options: AdvertisingReportOptions): string {
  const ads = options.adsConnected
    ? (options.adsSpendPence === undefined || options.adsSpendPence === null
      ? "Google Ads is connected, but no spend total was returned for this period."
      : "Google Ads spend for this period is included.")
    : "Google Ads reporting is not available. No campaign report was read, and no budget was changed.";
  const manual = options.spend.length
    ? "Dated manual spend entries are stored separately from the bookings."
    : "No advertising spend is stored.";
  return `${ads} ${manual} This comparison uses the stored bookings.`;
}

function plural(count: number, one: string, many: string): string {
  return `${count} ${count === 1 ? one : many}`;
}

function historicalLimitations(rows: Prepared[], earlierRows: Prepared[], excluded: AdvertisingReport["excluded"], basis: "journey" | "enquiry"): string[] {
  const considered = [...rows, ...earlierRows];
  const confirmed = considered.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed");
  const lines: string[] = [];
  const missingPayment = confirmed.filter((row) => row.net === null).length;
  if (missingPayment > 0) {
    lines.push(`${plural(missingPayment, "confirmed booking has", "confirmed bookings have")} no recorded payment. Revenue from ${missingPayment === 1 ? "that booking" : "those bookings"} stays unknown, and the missing payment is not treated as zero.`);
  }
  const missingFare = confirmed.filter((row) => row.quoted === null).length;
  if (missingFare > 0) {
    lines.push(`${plural(missingFare, "confirmed booking has", "confirmed bookings have")} no quoted fare. Average booking value stays unknown, and the missing fare is not treated as zero.`);
  }
  const missingSource = confirmed.filter((row) => row.source === "Unknown").length;
  if (missingSource > 0) {
    lines.push(`${plural(missingSource, "confirmed booking has", "confirmed bookings have")} no recorded source. Attribution for ${missingSource === 1 ? "that booking" : "those bookings"} stays unknown.`);
  }
  const missingCost = considered.filter((row) => bucket(row.status) === "completed" && Object.values(row.costs).some((value) => value === null)).length;
  if (missingCost > 0) {
    lines.push(`${plural(missingCost, "completed job has", "completed jobs have")} a journey cost that was not recorded. Profit stays unknown while ${missingCost === 1 ? "that cost is" : "those costs are"} missing.`);
  }
  if (basis === "enquiry" && excluded.missingCreationDate > 0) {
    lines.push(`${plural(excluded.missingCreationDate, "booking has", "bookings have")} no creation time. ${excluded.missingCreationDate === 1 ? "It is" : "They are"} left out of this enquiry date comparison. A journey date is not substituted for ${excluded.missingCreationDate === 1 ? "the booking creation date" : "a booking creation date"}.`);
  }
  const noCreation = basis === "journey" ? considered.filter((row) => creationDateKey(row.booking) === null).length : 0;
  if (noCreation > 0) {
    lines.push(`${plural(noCreation, "booking in this comparison has", "bookings in this comparison have")} no creation time. An enquiry date comparison leaves ${noCreation === 1 ? "it" : "them"} out. A journey date is not substituted for ${noCreation === 1 ? "the booking creation date" : "a booking creation date"}.`);
  }
  if (basis === "journey" && excluded.missingJourneyDate > 0) {
    lines.push(`${plural(excluded.missingJourneyDate, "booking has", "bookings have")} no journey date. ${excluded.missingJourneyDate === 1 ? "It is" : "They are"} left out of this journey date comparison. The creation time is not used in ${excluded.missingJourneyDate === 1 ? "its" : "their"} place.`);
  }
  const noJourney = basis === "enquiry" ? considered.filter((row) => row.journeyDate === null).length : 0;
  if (noJourney > 0) {
    lines.push(`${plural(noJourney, "booking in this comparison has", "bookings in this comparison have")} no journey date. A journey date comparison leaves ${noJourney === 1 ? "it" : "them"} out. The creation time is not used in ${noJourney === 1 ? "its" : "their"} place.`);
  }
  const savedAfterJourney = considered.filter((row) => {
    const created = coerceDate(row.booking.createdAt);
    const journey = coerceDate(row.booking.pickupTime || row.booking.dateTime);
    return created !== null && journey !== null && created.getTime() > journey.getTime();
  }).length;
  if (savedAfterJourney > 0) {
    lines.push(`${plural(savedAfterJourney, "booking was", "bookings were")} saved after the journey. The creation time is the time the record was stored. It is not treated as the customer enquiry time, and it is not used as the journey date.`);
  }
  return lines;
}

function categoryRow(label: string, rows: Prepared[], key: keyof Required<JobCostInput>): MoneyRow {
  const missing = rows.filter((row) => row.costs[key] === null).length;
  if (!rows.length) {
    return moneyRow(label, 0, "No completed jobs in this period.");
  }
  if (missing > 0) {
    return moneyRow(label, null, `${missing} completed ${missing === 1 ? "job has" : "jobs have"} no recorded ${label.toLowerCase()}. Missing costs stay unknown.`);
  }
  return moneyRow(label, sumPence(rows.map((row) => row.costs[key])), "Recorded on every completed job in this period.");
}

function grossBookingRevenue(rows: Prepared[]): Pence {
  if (!rows.length) return 0;
  if (rows.some((row) => row.quoted === null)) return null;
  return sumPence(rows.map((row) => row.quoted));
}

function confirmedRevenue(rows: Prepared[]): Pence {
  if (!rows.length) return 0;
  if (rows.some((row) => row.net === null)) return null;
  return sumPence(rows.map((row) => row.net));
}

function revenueChange(earlier: Pence, selected: Pence): string {
  if (earlier === null || selected === null) return "Revenue change: not calculated";
  if (earlier === 0 && selected === 0) return "No change. Both periods had no recorded revenue";
  if (earlier === 0) return "Revenue change: not calculated. The earlier period had no recorded revenue";
  const percent = Math.round(((selected - earlier) / earlier) * 1000) / 10;
  const amount = Number.isInteger(Math.abs(percent)) ? `${Math.abs(percent)}%` : `${Math.abs(percent).toFixed(1)}%`;
  if (percent < 0) return `Revenue decrease: ${amount}`;
  return `Revenue increase: ${amount}`;
}

function customerKey(booking: AdvertisingBookingInput): string | null {
  let phone = String(booking.hirerPhone || "").replace(/\D/g, "");
  if (phone.startsWith("0044")) phone = `0${phone.slice(4)}`;
  else if (phone.startsWith("44") && phone.length > 10) phone = `0${phone.slice(2)}`;
  if (phone.length >= 10) return `phone:${phone}`;
  const email = String(booking.email || "").trim().toLowerCase();
  if (email.includes("@")) return `email:${email}`;
  return null;
}

function classifyCustomers(sideRows: Prepared[], earlierRows: Prepared[]): { returning: number | null; newer: number | null; unknown: number } {
  const confirmedSide = sideRows.filter((row) => {
    const kind = bucket(row.status);
    return kind === "confirmed" || kind === "completed";
  });
  const unknown = confirmedSide.filter((row) => customerKey(row.booking) === null).length;
  const keys = new Set<string>();
  confirmedSide.forEach((row) => {
    const key = customerKey(row.booking);
    if (key) keys.add(key);
  });
  if (keys.size === 0) return { returning: null, newer: null, unknown };
  const earlierKeys = new Set<string>();
  earlierRows.forEach((row) => {
    const key = customerKey(row.booking);
    if (key) earlierKeys.add(key);
  });
  let returning = 0;
  let newer = 0;
  keys.forEach((key) => {
    if (earlierKeys.has(key)) returning += 1;
    else newer += 1;
  });
  return { returning, newer, unknown };
}

function customerLabel(split: { returning: number | null; newer: number | null; unknown: number }): string {
  if (split.returning === null || split.newer === null) return "Returning customers: not identifiable. New customers: not identifiable.";
  const unknown = split.unknown > 0 ? ` Not identifiable: ${split.unknown}.` : "";
  return `Returning customers: ${split.returning}. New customers: ${split.newer}.${unknown}`;
}

function growthSide(from: string, to: string, days: number, rows: Prepared[], confirmedRows: Prepared[], emptyNote: string, enquiryVolume: number | null, enquiryConversionRate: number | null, customers: { returning: number | null; newer: number | null; unknown: number }): GrowthSide {
  const completed = confirmedRows.filter((row) => bucket(row.status) === "completed").length;
  const revenuePence = confirmedRevenue(confirmedRows);
  const grossBookingRevenuePence = grossBookingRevenue(confirmedRows);
  const averageBookingPence = days === 0 || !confirmedRows.length || confirmedRows.some((row) => row.quoted === null)
    ? null
    : Math.round((sumPence(confirmedRows.map((row) => row.quoted)) || 0) / confirmedRows.length);
  const averageLabel = days === 0 || confirmedRows.length === 0 ? "not calculated" : formatGbp(averageBookingPence);
  const bookingsPerDay = days === 0 ? null : confirmedRows.length / days;
  const stillOpen = rows.filter((row) => bucket(row.status) !== "cancelled");
  const confirmedRate = days === 0 || stillOpen.length === 0 ? null : confirmedRows.length / stillOpen.length;
  const revenuePerDayPence = revenuePence === null || days === 0 ? null : Math.round(revenuePence / days);
  const grossForPeriod = days === 0 ? null : grossBookingRevenuePence;
  const paceLabel = bookingsPerDay === null ? "not calculated" : formatPace(bookingsPerDay);
  const weekLabel = bookingsPerDay === null ? "not calculated" : formatPace(bookingsPerDay * 7);
  const rateLabel = confirmedRate === null ? "not calculated" : formatRate(confirmedRate);
  const confirmedLabel = days === 0 ? "not calculated" : String(confirmedRows.length);
  const completedLabel = days === 0 ? "not calculated" : String(completed);
  const grossLabel = days === 0 ? "not calculated" : formatGbp(grossForPeriod);
  const counts = `Total bookings: ${rows.length}. Confirmed bookings: ${confirmedLabel}. Completed bookings: ${completedLabel}. Bookings per day: ${paceLabel}. Bookings per week: ${weekLabel}. Gross booking revenue: ${grossLabel}. Average booking value: ${averageLabel}. Confirmed booking rate: ${rateLabel}. Enquiry volume: ${enquiryVolume === null ? "no enquiry records" : enquiryVolume}. Enquiry to booking conversion rate: ${enquiryConversionRate === null ? "not measurable" : formatRate(enquiryConversionRate)}. ${customerLabel(customers)}`;
  const summary = days === 0
    ? `${counts} ${emptyNote}`
    : `${counts} Finished days ${from} to ${to}. Recorded revenue: ${formatGbp(revenuePence)}. Revenue per day: ${formatGbp(revenuePerDayPence)}.`;
  return { from, to, days, total: rows.length, confirmed: days === 0 ? 0 : confirmedRows.length, completed, bookingsPerDay, revenuePence: days === 0 ? null : revenuePence, revenuePerDayPence, grossBookingRevenuePence: grossForPeriod, averageBookingPence, confirmedRate, enquiryVolume, enquiryConversionRate, returningCustomers: customers.returning, newCustomers: customers.newer, unidentifiedCustomers: customers.unknown, summary };
}

export function overallBusinessGrowth(bookings: AdvertisingBookingInput[], startedOn: string | null, now = new Date(), confirmed = false): BusinessGrowth {
  const label = "Spires Taxis — before and after Google Ads performance comparison";
  const empty = { before: null, after: null };
  if (!startedOn || !/^\d{4}-\d{2}-\d{2}$/.test(startedOn)) {
    return {
      label,
      text: "Not calculated",
      ...empty,
      limitations: [],
      detail: "No Google Ads start date is recorded, so an increase in bookings or revenue after Google Ads cannot be shown. A stored Google click is not used as that date, the dates selected on this page are not used as that date, and a campaign creation date is not used as that date. Google Ads reporting is not available. Where a confirmed booking has no recorded payment, revenue stays unknown and is not treated as zero.",
    };
  }
  if (!confirmed) {
    return {
      label,
      text: "Not calculated",
      ...empty,
      limitations: [],
      detail: "An administrator has not confirmed the Google Ads start date, so the before and after comparison is not calculated. A stored Google click is not used as that date, the dates selected on this page are not used as that date, and a campaign creation date is not used as that date.",
    };
  }
  const today = londonDateKey(now);
  if (!today || startedOn >= today) {
    return { label, text: "Not calculated", ...empty, limitations: [], detail: "There is no finished day after the Google Ads start date." };
  }
  const history = prepare(bookings, {
    from: "1970-01-01",
    to: "2999-12-31",
    dateBasis: "journey",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now,
  }).rows;
  const finished = history.filter((row) => row.journeyDate !== null && (row.journeyDate || "") < today);
  const confirmedRows = (rows: Prepared[]) => rows.filter((row) => {
    const kind = bucket(row.status);
    return kind === "confirmed" || kind === "completed";
  });
  const yesterday = shiftDateKey(today, -1);
  const firstThirtyEnd = shiftDateKey(startedOn, 29);
  const afterFrom = startedOn;
  const afterTo = firstThirtyEnd < yesterday ? firstThirtyEnd : yesterday;
  const equalBefore = previousDateRange(afterFrom, afterTo);
  const beforeFrom = equalBefore.from;
  const beforeTo = equalBefore.to;
  const beforeDays = inclusiveDays(beforeFrom, beforeTo);
  const afterDays = inclusiveDays(afterFrom, afterTo);
  const inWindow = (day: string, from: string, to: string) => day >= from && day <= to;
  const beforeRows = finished.filter((row) => inWindow(row.journeyDate || "", beforeFrom, beforeTo));
  const afterRows = finished.filter((row) => inWindow(row.journeyDate || "", afterFrom, afterTo));
  const beforeConfirmed = confirmedRows(beforeRows);
  const afterConfirmed = confirmedRows(afterRows);
  const enquiryBookings = bookings.filter((booking) => bucket(workflow(booking)) === "enquiries");
  const enquiryRows = prepare(enquiryBookings, {
    from: "1970-01-01",
    to: "2999-12-31",
    dateBasis: "enquiry",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now,
  });
  const placedEnquiries = enquiryRows.rows.filter((row) => {
    const day = creationDateKey(row.booking);
    return day !== null && day < today;
  });
  const volume = (rows: Prepared[]) => rows.length > 0 ? rows.length : null;
  const beforeEnquiries = volume(placedEnquiries.filter((row) => inWindow(creationDateKey(row.booking) || "", beforeFrom, beforeTo)));
  const afterEnquiries = volume(placedEnquiries.filter((row) => inWindow(creationDateKey(row.booking) || "", afterFrom, afterTo)));
  const missingEnquiryCreation = enquiryRows.excluded.missingCreationDate;
  const createdConfirmed = prepare(bookings.filter((booking) => {
    const kind = bucket(workflow(booking));
    return kind === "confirmed" || kind === "completed";
  }), {
    from: "1970-01-01",
    to: "2999-12-31",
    dateBasis: "enquiry",
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    now,
  });
  const placedConfirmed = createdConfirmed.rows.filter((row) => {
    const day = creationDateKey(row.booking);
    return day !== null && day < today;
  });
  const beforeCreatedConfirmed = placedConfirmed.filter((row) => inWindow(creationDateKey(row.booking) || "", beforeFrom, beforeTo)).length;
  const afterCreatedConfirmed = placedConfirmed.filter((row) => inWindow(creationDateKey(row.booking) || "", afterFrom, afterTo)).length;
  const conversionMeasurable = missingEnquiryCreation === 0 && createdConfirmed.excluded.missingCreationDate === 0;
  const conversionRate = (enquiryCount: number | null, bookingCount: number): number | null => {
    if (!conversionMeasurable || enquiryCount === null) return null;
    const denominator = enquiryCount + bookingCount;
    return denominator === 0 ? null : bookingCount / denominator;
  };
  const enquiryGap = missingEnquiryCreation > 0
    ? ` ${plural(missingEnquiryCreation, "enquiry record has", "enquiry records have")} no creation time. ${missingEnquiryCreation === 1 ? "It is" : "They are"} left out. The journey date is not used in ${missingEnquiryCreation === 1 ? "its" : "their"} place.`
    : "";
  const beforeCustomers = classifyCustomers(beforeConfirmed, beforeFrom ? finished.filter((row) => (row.journeyDate || "") < beforeFrom) : []);
  const afterCustomers = classifyCustomers(afterConfirmed, finished.filter((row) => (row.journeyDate || "") < startedOn));
  const before = growthSide(beforeFrom, beforeTo, beforeDays, beforeRows, beforeConfirmed, `No confirmed booking has a journey date before ${startedOn}. Recorded revenue: ${formatGbp(0)}.`, beforeEnquiries, conversionRate(beforeEnquiries, beforeCreatedConfirmed), beforeCustomers);
  const after = growthSide(afterFrom, afterTo, afterDays, afterRows, afterConfirmed, `There is no finished day from ${startedOn} to ${yesterday}.`, afterEnquiries, conversionRate(afterEnquiries, afterCreatedConfirmed), afterCustomers);
  return {
    label,
    text: bookingPaceChange(before.bookingsPerDay, after.bookingsPerDay),
    before,
    after,
    limitations: historicalLimitations(beforeRows.concat(afterRows), [], { synthetic: 0, duplicate: 0, returnLegs: 0, missingCreationDate: 0, missingJourneyDate: 0 }, "journey"),
    detail: `The current day is not finished, so it is left out of this comparison. The before period, ${before.from} to ${before.to}, is the ${before.days} ${before.days === 1 ? "day" : "days"} immediately before the Google Ads start date. The after period, ${after.from} to ${after.to}, is the first ${after.days} ${after.days === 1 ? "day" : "days"} after it.${after.days < 30 ? " Fewer than 30 days after advertising started are finished. This compares those finished days with the same number of days immediately before advertising started." : ""} Confirmed bookings a day were ${formatPace(before.bookingsPerDay)} before ${startedOn} and ${formatPace(after.bookingsPerDay)} from ${after.from} to ${after.to}. Bookings per week is that daily figure multiplied by 7. Gross booking revenue was ${formatGbp(before.grossBookingRevenuePence)} before ${startedOn} and ${formatGbp(after.grossBookingRevenuePence)} from ${after.from} to ${after.to}. Average booking value was ${before.averageBookingPence === null && before.confirmed === 0 ? "not calculated" : formatGbp(before.averageBookingPence)} before ${startedOn} and ${after.averageBookingPence === null && after.confirmed === 0 ? "not calculated" : formatGbp(after.averageBookingPence)} from ${after.from} to ${after.to}. Recorded revenue was ${formatGbp(before.revenuePence)} before ${startedOn} and ${formatGbp(after.revenuePence)} from ${after.from} to ${after.to}. ${revenueChange(before.revenuePence, after.revenuePence)}. Confirmed bookings are confirmed, allocated and completed bookings on the journey date. Completed bookings are the jobs already completed, and they are included in confirmed bookings. A cancellation or an enquiry stays in the total and is not a confirmed booking. Gross booking revenue is the quoted fare of those confirmed bookings. Average booking value is the average quoted fare of those confirmed bookings. A missing fare stays unknown and is not treated as zero. This is not money received. Recorded revenue is money received after refunds. A missing payment stays unknown. Quoted fares are not used as recorded revenue. Enquiry volume counts stored enquiries by their creation time in these same periods. A journey date is not used as the enquiry date. Where no enquiry record exists, the volume is not shown as zero. The enquiry to booking conversion rate counts confirmed bookings with a creation time divided by those bookings plus stored enquiry records with a creation time. A journey date is not used. Where no enquiry record exists, or a record has no creation time, the rate is not measurable. Returning and new customers are counted only when the same phone number or email address is stored. A name is not used. A customer with an earlier journey is returning. A customer whose first stored journey is in the period is new. Where no phone number or email address is stored, the customer is not identifiable and is not counted as new.${enquiryGap} ${ADDITIONAL_BOOKINGS_NOTE}`,
  };
}

export function buildAdvertisingReport(bookings: AdvertisingBookingInput[], options: AdvertisingReportOptions): AdvertisingReport {
  const { rows, excluded } = prepare(bookings, options);
  const now = options.now ?? new Date();
  const elapsed = finishedRange(options.from, options.to, now);
  const earlierRange = elapsed ? previousDateRange(elapsed.from, elapsed.to) : null;
  const earlierRows = earlierRange ? rowsOnDates(prepare(bookings, { ...options, ...earlierRange }).rows, earlierRange.from, earlierRange.to, options.dateBasis) : [];
  const earlier = earlierRange ? periodPace(earlierRows, earlierRange.from, earlierRange.to) : emptyPace();
  const finishedRows = elapsed ? rowsOnDates(rows, elapsed.from, elapsed.to, options.dateBasis) : [];
  const selected = elapsed ? periodPace(finishedRows, elapsed.from, elapsed.to) : emptyPace();
  const todayKey = londonDateKey(now);
  const includesCurrentDay = Boolean(todayKey && options.from <= todayKey && options.to >= todayKey);
  const comparisonRows = includesCurrentDay ? finishedRows : rows;
  const rateRows = comparisonRows.filter((row) => bucket(row.status) !== "cancelled");
  const rateConfirmed = comparisonRows.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed").length;
  const confirmedRate = rateRows.length === 0 ? null : rateConfirmed / rateRows.length;
  const enquiries = rows.filter((row) => bucket(row.status) === "enquiries");
  const confirmedOpen = rows.filter((row) => bucket(row.status) === "confirmed");
  const completed = rows.filter((row) => bucket(row.status) === "completed");
  const cancelled = rows.filter((row) => bucket(row.status) === "cancelled");
  const confirmedForCost = confirmedOpen.length + completed.length;
  const completedPaid = completed.filter((row) => row.net !== null && row.net > 0).length;
  const completedPaymentUnknown = completed.filter((row) => row.net === null).length;
  const quotedKnown = rows.filter((row) => row.quoted !== null);
  const quotedMissing = rows.length - quotedKnown.length;
  const paymentKnown = rows.filter((row) => row.net !== null);
  const paymentMissing = rows.length - paymentKnown.length;
  const manualEntries = options.spend.filter((entry) => entry.source === "manual" && inRange(entry.date, options.from, options.to));
  const manualPence: Pence = manualEntries.length
    ? manualEntries.reduce((total, entry) => total + Math.round(entry.amountPence || 0), 0)
    : null;
  const adsPence: Pence = options.adsConnected ? (options.adsSpendPence === undefined ? null : options.adsSpendPence) : null;
  const advertisingSpend: Pence = options.adsConnected
    ? (adsPence === null ? null : adsPence + (manualPence || 0))
    : (options.manualSpendIsComplete && manualPence !== null ? manualPence : null);
  const costs = {
    driver: categoryRow("Driver payment", completed, "driverPaymentPence"),
    fuel: categoryRow("Fuel", completed, "fuelPence"),
    parking: categoryRow("Parking", completed, "parkingPence"),
    airport: categoryRow("Airport charges", completed, "airportChargesPence"),
    paymentFees: categoryRow("Payment fees", completed, "paymentFeesPence"),
  };
  const costValues = [costs.driver.pence, costs.fuel.pence, costs.parking.pence, costs.airport.pence, costs.paymentFees.pence];
  const completedNets = completed.map((row) => row.net);
  const contributionPence = advertisingSpend === null || costValues.some((value) => value === null) || completedNets.some((value) => value === null)
    ? null
    : (sumPence(completedNets) || 0) - (sumPence(costValues) || 0) - advertisingSpend;
  const trackedRows = rows.filter((row) => row.source === "Tracked Google Ads");
  const trackedNets = trackedRows.map((row) => row.net);
  const returnOnSpend: RatioRow = (() => {
    const label = "Advertising return on spend";
    if (!trackedRows.length) {
      return { label, ratio: null, detail: "No tracked Google Ads bookings in this period." };
    }
    if (advertisingSpend === null) {
      return { label, ratio: null, detail: "Advertising spend is unknown, so return on spend is unknown." };
    }
    if (advertisingSpend === 0) {
      return { label, ratio: null, detail: "Advertising spend for this period is zero, so return on spend is not calculated." };
    }
    if (trackedNets.some((value) => value === null)) {
      return { label, ratio: null, detail: "A tracked booking has an unrecorded payment or refund. Return on spend is not calculated." };
    }
    return {
      label,
      ratio: (sumPence(trackedNets) || 0) / advertisingSpend,
      detail: "Recorded payments on tracked Google Ads bookings, divided by advertising spend. Quoted fares are not used. Customer reported adverts are not included.",
    };
  })();
  const attributionRows = elapsed ? rowsOnDates(rows, elapsed.from, elapsed.to, options.dateBasis) : [];
  const attributionTracked = attributionRows.filter((row) => row.source === "Tracked Google Ads");
  const reported = attributionRows.filter((row) => row.source.startsWith("Customer reported")).length;
  const directConfirmed = attributionTracked.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed").length;
  const directCancelled = attributionTracked.filter((row) => bucket(row.status) === "cancelled").length;
  const directEnquiries = attributionTracked.filter((row) => bucket(row.status) === "enquiries").length;
  const reportedAds = attributionRows.filter((row) => row.source === "Customer reported Google Ads").length;
  const directAds = {
    label: "Bookings directly attributed to Google Ads",
    confirmed: directConfirmed,
    customerReported: reportedAds,
    cancelled: directCancelled,
    enquiries: directEnquiries,
    detail: `${directConfirmed} confirmed, allocated or completed ${directConfirmed === 1 ? "booking has" : "bookings have"} a consented Google click id that has not expired. ${directCancelled} ${directCancelled === 1 ? "cancellation has" : "cancellations have"} a stored click. ${directEnquiries} ${directEnquiries === 1 ? "enquiry has" : "enquiries have"} a stored click. A customer report is not included here. Each of these counts is kept on its own. Overall business growth is a separate figure.`,
  };
  const confirmedRows = attributionRows.filter((row) => bucket(row.status) === "confirmed" || bucket(row.status) === "completed");
  const otherConfirmedRows = confirmedRows.filter((row) => row.source.startsWith("Customer reported"));
  const unknownConfirmedRows = confirmedRows.filter((row) => row.source === "Unknown");
  const otherSaidAds = otherConfirmedRows.filter((row) => row.source === "Customer reported Google Ads").length;
  const otherSources = {
    label: "Bookings from other sources",
    confirmed: otherConfirmedRows.length,
    customerReportedAds: otherSaidAds,
    detail: `${otherConfirmedRows.length} confirmed, allocated or completed ${otherConfirmedRows.length === 1 ? "booking has" : "bookings have"} a source reported by the customer. ${otherSaidAds} ${otherSaidAds === 1 ? "was" : "were"} reported as Google Ads. A customer report stays separate from a stored click.`,
  };
  const unknownAttribution = {
    label: "Bookings with unknown attribution",
    confirmed: unknownConfirmedRows.length,
    detail: `${unknownConfirmedRows.length} confirmed, allocated or completed ${unknownConfirmedRows.length === 1 ? "booking has" : "bookings have"} unknown attribution. No source was recorded. This count is separate from bookings directly attributed to Google Ads and from bookings with a source reported by the customer.`,
  };
  const unknown = attributionRows.length - attributionTracked.length - reported;
  const latest = rows.reduce<number>((max, row) => Math.max(max, coerceDate(row.booking.updatedAt)?.getTime() || 0), 0);
  const spendIsFull = options.adsConnected || options.manualSpendIsComplete;
  return {
    from: options.from,
    to: options.to,
    dateBasis: options.dateBasis,
    budgetLabel: ADVERTISING_BUDGET_LABEL,
    enquiries: enquiries.length,
    confirmed: confirmedOpen.length,
    completed: completed.length,
    cancelled: cancelled.length,
    confirmedForCost,
    completedPaid,
    completedPaymentUnknown,
    quoted: moneyRow(
      "Quoted fares",
      quotedMissing ? null : sumPence(quotedKnown.map((row) => row.quoted)),
      quotedMissing
        ? `${quotedMissing} ${quotedMissing === 1 ? "booking has" : "bookings have"} no quoted fare. Those are not counted as zero.`
        : "Quoted fares are separate from money received."
    ),
    netPayments: moneyRow(
      "Payments received less refunds",
      paymentMissing ? null : sumPence(paymentKnown.map((row) => row.net)),
      paymentMissing
        ? `${paymentMissing} ${paymentMissing === 1 ? "booking has" : "bookings have"} an unrecorded payment or refund. Those are not counted as zero.`
        : "This is money recorded as received, after recorded refunds. It is not the quoted fare."
    ),
    costs,
    manualSpend: moneyRow(
      "Manual advertising spend",
      manualPence,
      manualEntries.length
        ? "Dated manual entries inside this period. This is not a live Google Ads download."
        : "No manual spend has been entered for this period."
    ),
    adsSpend: moneyRow(
      "Google Ads spend",
      adsPence,
      options.adsConnected ? "Read only server total for this period." : "Google Ads is not connected. No campaign or budget was changed."
    ),
    advertisingSpend: moneyRow(
      "Advertising spend",
      advertisingSpend,
      spendIsFull
        ? (options.adsConnected ? "Google Ads spend plus dated manual entries." : "Using manual entries because they were marked as the full spend for this period.")
        : "Unknown until Google Ads is connected, or the manual entries are marked as the full spend for this period."
    ),
    contribution: moneyRow(
      "Profit after advertising and recorded journey costs",
      contributionPence,
      "Recorded payments on completed jobs, minus recorded journey costs and advertising spend. Other business overheads are not included. An unknown cost, payment or spend keeps this unknown."
    ),
    returnOnSpend,
    businessGrowth: overallBusinessGrowth(bookings, options.advertisingStartedOn || null, now, options.advertisingStartConfirmed === true),
    directAds,
    otherSources,
    unknownAttribution,
    revenuePerDay: moneyRow(
      "Revenue per day",
      selected.revenuePerDayPence,
      revenuePerDayDetail(selected, finishedRows)
    ),
    averageBookingValue: moneyRow(
      "Average booking value",
      averageBookingPence(comparisonRows),
      `${averageBookingDetail(comparisonRows)}${includesCurrentDay ? " The current day is not finished, so it is left out of this comparison." : ""}`
    ),
    confirmedRateLabel: confirmedRateLabel(rows, rateConfirmed, rateRows.length, options, now),
    confirmedRate,
    earlierPace: earlier,
    selectedPace: selected,
    frequency: elapsed ? withGoogleAdsSpend(bookingFrequency(rowsOnDates(prepare(bookings, { ...options, from: shiftDateKey(elapsed.from, -6) }).rows, shiftDateKey(elapsed.from, -6), elapsed.to, options.dateBasis), elapsed.from, elapsed.to, options.dateBasis), options.spend) : [],
    frequencyChange: bookingFrequencyChange(earlier.included, earlier.days, selected.included, selected.days),
    revenuePerDayChange: revenuePerDayChange(earlier.revenuePerDayPence, selected.revenuePerDayPence),
    averageBookingValueChange: averageBookingValueChange(earlier.averageBookingPence, selected.averageBookingPence),
    confirmedBookingRateChange: confirmedBookingRateChange(earlier.confirmedRate, selected.confirmedRate),
    costPerConfirmed: moneyRow(
      "Cost per confirmed booking",
      advertisingSpend === null || confirmedForCost === 0 ? null : Math.round(advertisingSpend / confirmedForCost),
      confirmedForCost === 0 ? "No confirmed, allocated or completed bookings in this period." : "Advertising spend divided by confirmed, allocated and completed bookings. Cancelled bookings are not included."
    ),
    costPerCompletedPaid: moneyRow(
      "Cost per completed paid booking",
      advertisingSpend === null || completedPaid === 0 ? null : Math.round(advertisingSpend / completedPaid),
      completedPaid === 0
        ? "No completed booking has a recorded payment above zero."
        : `Completed bookings with a recorded payment above zero. ${completedPaymentUnknown} completed ${completedPaymentUnknown === 1 ? "booking has" : "bookings have"} an unknown payment and ${completedPaymentUnknown === 1 ? "is" : "are"} not treated as unpaid or paid.`
    ),
    attribution: {
      trackedGoogleAds: attributionTracked.length,
      customerReported: reported,
      unknown,
      telephoneWithoutSource: attributionRows.filter((row) => row.channel === "telephone" && row.source === "Unknown").length,
      whatsappWithoutSource: attributionRows.filter((row) => row.channel === "whatsapp" && row.source === "Unknown").length,
      included: attributionRows.length,
    },
    byRoute: breakdown(rows, (row) => row.route),
    byVehicle: breakdown(rows, (row) => row.vehicle),
    bySource: breakdown(rows, (row) => row.source),
    byEnquiry: breakdown(rows, (row) => {
      const kind = enquiryKind(row.booking);
      if (kind === "quote") return "Website quote";
      if (kind === "booking_request") return "Portal booking request";
      if (kind === "telephone") return "Telephone";
      if (kind === "whatsapp") return "WhatsApp";
      return "Unknown";
    }),
    unpaidConfirmed: rows.filter((row) => (row.status === "confirmed" || row.status === "allocated") && finiteNumber(row.booking.amountReceivedPence) === 0).length,
    sourcePrompts: rows.filter((row) => row.channel).map((row) => ({
      id: String(row.booking.id || ""),
      bookingNumber: row.booking.bookingNumber || "No booking number",
      journeyDate: row.journeyDate || "Unknown",
      route: row.route,
      channel: row.channel as "telephone" | "whatsapp",
      staffReportedSource: String(row.booking.staffReportedSource || ""),
    })),
    costPrompts: completed.filter((row) => Object.values(row.costs).some((value) => value === null)).map((row) => ({
      id: String(row.booking.id || ""),
      bookingNumber: row.booking.bookingNumber || "No booking number",
      journeyDate: row.journeyDate || "Unknown",
      route: row.route,
      costs: row.costs,
    })),
    excluded,
    limitations: historicalLimitations(rows, earlierRows, excluded, options.dateBasis),
    reportingBasis: reportingBasis(options),
    freshness: latest ? `Newest included booking update: ${londonDateTimeLabel(new Date(latest))} Europe/London.` : "No included bookings have an update time.",
  };
}

/** Labelled records for the view test only. The admin page reads the Firebase bookings collection. */
export const advertisingPreviewBookings: AdvertisingBookingInput[] = [
  {
    id: "preview-enquiry",
    bookingNumber: "SP100",
    status: "pending",
    bookingMethod: "telephone",
    pickupTime: "2026-11-04T10:00:00Z",
    createdAt: "2026-11-02T10:00:00Z",
    updatedAt: "2026-11-02T10:00:00Z",
    pickupLocation: "Oxford",
    destination: "Gatwick",
    hirerPhone: "07000000000",
    notes: "Do not show this note",
  },
  {
    id: "preview-ads",
    bookingNumber: "SP101",
    status: "completed",
    pickupTime: "2026-11-08T09:00:00Z",
    createdAt: "2026-11-03T09:00:00Z",
    updatedAt: "2026-11-08T20:00:00Z",
    pickupLocation: "Oxford",
    destination: "Heathrow",
    vehicleType: "8_seater",
    actualFare: 140,
    amountReceivedPence: 14000,
    marketingAttribution: { consent: "granted", gclid: "preview-click", expiresAt: Date.parse("2026-12-01T00:00:00Z") },
    jobCosts: { driverPaymentPence: 6000, fuelPence: 1800, parkingPence: 700, airportChargesPence: 500, paymentFeesPence: 200 },
  },
  {
    id: "preview-missing",
    bookingNumber: "SP103",
    status: "completed",
    pickupTime: "2026-11-06T09:00:00Z",
    updatedAt: "2026-11-06T18:00:00Z",
    pickupLocation: "Oxford",
    destination: "Stansted",
    vehicleType: "standard",
    actualFare: 150,
    amountReceivedPence: 15000,
    jobCosts: { driverPaymentPence: 7000, fuelPence: 2000, parkingPence: 0 },
  },
  {
    id: "preview-cancelled",
    bookingNumber: "SP102",
    status: "cancelled",
    pickupTime: "2026-11-09T09:00:00Z",
    updatedAt: "2026-11-09T12:00:00Z",
    pickupLocation: "Oxford",
    destination: "Luton",
    actualFare: 110,
    amountReceivedPence: 0,
  },
];
