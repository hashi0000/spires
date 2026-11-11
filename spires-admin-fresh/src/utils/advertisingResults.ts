import { effectiveWorkflowStatus } from "./bookingWorkflow";

/** Pence. Null means the figure was not recorded. Never treat null as zero. */
export type Pence = number | null;

export const MONTHLY_ADVERTISING_BUDGET_PENCE = 13500;
export const ADVERTISING_BUDGET_LABEL = "Monthly advertising budget remains £135. This page does not change it.";

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
}

export interface MoneyRow {
  label: string;
  pence: Pence;
  detail: string;
}

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
  excluded: { synthetic: number; duplicate: number; returnLegs: number };
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
  const excluded = { synthetic: 0, duplicate: 0, returnLegs: 0 };
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
  }).filter((row) => inRange(options.dateBasis === "enquiry" ? londonDateKey(row.booking.createdAt || row.booking.dateTime) : row.journeyDate, options.from, options.to));
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

export function buildAdvertisingReport(bookings: AdvertisingBookingInput[], options: AdvertisingReportOptions): AdvertisingReport {
  const { rows, excluded } = prepare(bookings, options);
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
  const tracked = rows.filter((row) => row.source === "Tracked Google Ads").length;
  const reported = rows.filter((row) => row.source.startsWith("Customer reported")).length;
  const unknown = rows.length - tracked - reported;
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
      "Contribution before overheads",
      contributionPence,
      "Payments on completed jobs, less job costs and advertising spend. Overheads are not included. Unknown costs, payments or spend keep this unknown."
    ),
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
      trackedGoogleAds: tracked,
      customerReported: reported,
      unknown,
      telephoneWithoutSource: rows.filter((row) => row.channel === "telephone" && row.source === "Unknown").length,
      whatsappWithoutSource: rows.filter((row) => row.channel === "whatsapp" && row.source === "Unknown").length,
      included: rows.length,
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
    freshness: latest ? `Newest included booking update: ${londonDateTimeLabel(new Date(latest))} Europe/London.` : "No included bookings have an update time.",
  };
}

/** Labelled sample used only for the local admin preview. Not live bookings. */
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
