import type { Booking } from "../types/types";
import { bookingMoney } from "./bookingMoney";
import { hasPaymentSchedule, parseMoney } from "./bookingJourney";
import { hasTimedReturn, journeyLegs } from "./journeyLegs";
import type { GeneralInvoiceLine, SavedInvoiceClient } from "./generalInvoiceTypes";
import { formatGbp, formatUkDate, todayIsoDate } from "./generalInvoiceTypes";

export type BillingBlockReason =
  | "not_account"
  | "missing_client"
  | "not_complete"
  | "missing_fare"
  | "combined_return_incomplete"
  | "already_invoiced"
  | "no_billable_amount";

export type BillableUnit = {
  key: string;
  bookingId: string;
  bookingNumber: string;
  clientId: string;
  clientName: string;
  passengerName: string;
  serviceDate: string;
  route: string;
  farePounds: number;
  receivedPounds: number;
  creditNote: string;
  legLabel: "Journey" | "Outbound" | "Return";
  bookingRevision: number;
};

export type BillingRowAssessment = {
  booking: Booking;
  clientId: string;
  clientName: string;
  passengerName: string;
  units: BillableUnit[];
  blockedUnits: Array<{ key: string; reason: BillingBlockReason; detail: string }>;
  ready: boolean;
};

export type AccountInvoiceDraftHandoff = {
  clientId: string;
  clientName: string;
  clientAddress: string;
  clientEmail: string;
  clientPhone: string;
  invoicePrefix: string;
  lines: GeneralInvoiceLine[];
  bookingNumber: string;
  travelDate: string;
  pickup: string;
  destination: string;
  notes: string;
  bookingIds: string[];
  billingLineKeys: string[];
  bookingRevisions: Record<string, number>;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function poundsFromPence(pence: number): number {
  return Math.round(pence) / 100;
}

function serviceDateIso(booking: Booking, leg: "outbound" | "return" | "all"): string {
  const legs = journeyLegs(booking);
  if (leg === "return") {
    const ret = legs.find((row) => row.leg === "return");
    if (ret?.pickupAt) return ret.pickupAt.toISOString().slice(0, 10);
  }
  const out = legs.find((row) => row.leg === "outbound") || legs[0];
  if (out?.pickupAt) return out.pickupAt.toISOString().slice(0, 10);
  const raw = text((booking as { pickupTime?: string }).pickupTime || booking.dateTime);
  return raw ? raw.slice(0, 10) : "";
}

function routeFor(booking: Booking, leg: "outbound" | "return" | "all"): string {
  const legs = journeyLegs(booking);
  if (leg === "return") {
    const ret = legs.find((row) => row.leg === "return");
    if (ret) return [ret.pickupLocation, ret.destination].filter(Boolean).join(" → ") || "—";
  }
  if (leg === "outbound") {
    const out = legs.find((row) => row.leg === "outbound");
    if (out) return [out.pickupLocation, out.destination].filter(Boolean).join(" → ") || "—";
  }
  return [booking.pickupLocation, booking.destination].map((p) => text(p)).filter(Boolean).join(" → ") || "—";
}

function alreadyInvoicedKeys(booking: Booking): Set<string> {
  const row = booking as Booking & {
    invoicedBillingKeys?: string[];
    invoiceLinks?: Array<{ key?: string }>;
  };
  const keys = new Set<string>();
  if (Array.isArray(row.invoicedBillingKeys)) {
    for (const key of row.invoicedBillingKeys) {
      if (text(key)) keys.add(text(key));
    }
  }
  if (Array.isArray(row.invoiceLinks)) {
    for (const link of row.invoiceLinks) {
      if (text(link?.key)) keys.add(text(link.key));
    }
  }
  const id = text(booking.id);
  if (booking.invoiceStatus === "invoiced" && id) {
    keys.add(id);
    keys.add(`${id}:outbound`);
    keys.add(`${id}:return`);
  }
  return keys;
}

export function isAccountJob(booking: Booking): boolean {
  return (
    booking.paymentMethod === "account" ||
    booking.jobKind === "account" ||
    Boolean(text(booking.billingAccountId)) ||
    Boolean(text(booking.billingAccountName))
  );
}

export function resolveSavedInvoiceClient(
  booking: Booking,
  clients: SavedInvoiceClient[]
): SavedInvoiceClient | null {
  const id = text(booking.billingAccountId);
  if (!id) return null;
  return clients.find((client) => client.id === id) || null;
}

export function blockReasonLabel(reason: BillingBlockReason): string {
  switch (reason) {
    case "not_account":
      return "Not an account job";
    case "missing_client":
      return "Link a saved invoice client";
    case "not_complete":
      return "Journey not completed";
    case "missing_fare":
      return "Fare missing";
    case "combined_return_incomplete":
      return "Return not finished (combined fare)";
    case "already_invoiced":
      return "Already invoiced";
    case "no_billable_amount":
      return "Nothing left to bill";
    default:
      return "Not ready";
  }
}

/**
 * Assess one booking for account invoicing.
 * Split fares (dueOnOutbound / dueOnReturn) can bill completed legs separately.
 * Combined return fares wait until every timed leg is completed.
 */
export function assessAccountBooking(
  booking: Booking,
  clients: SavedInvoiceClient[],
  now = new Date()
): BillingRowAssessment {
  const bookingId = text(booking.id);
  const bookingNumber = text(booking.bookingNumber) || bookingId || "—";
  const passengerName =
    text(booking.passengerName) || text(booking.hirerName) || "—";
  const client = resolveSavedInvoiceClient(booking, clients);
  const clientId = client?.id || "";
  const clientName = client?.name || text(booking.billingAccountName) || "—";
  const units: BillableUnit[] = [];
  const blockedUnits: BillingRowAssessment["blockedUnits"] = [];
  const invoiced = alreadyInvoicedKeys(booking);
  const money = bookingMoney(booking);
  const receivedPounds = poundsFromPence(money.receivedPence);
  const revision = Number(booking.revision || 0);

  if (!isAccountJob(booking)) {
    blockedUnits.push({
      key: bookingId || bookingNumber,
      reason: "not_account",
      detail: "This booking is not marked as an account job.",
    });
    return { booking, clientId, clientName, passengerName, units, blockedUnits, ready: false };
  }

  if (!client) {
    blockedUnits.push({
      key: bookingId || bookingNumber,
      reason: "missing_client",
      detail: text(booking.billingAccountName)
        ? `Legacy name “${text(booking.billingAccountName)}” is not linked to a saved invoice client.`
        : "Choose a saved invoice client before billing.",
    });
    return { booking, clientId, clientName, passengerName, units, blockedUnits, ready: false };
  }

  if (!bookingId) {
    blockedUnits.push({
      key: bookingNumber,
      reason: "missing_fare",
      detail: "Booking has no document id.",
    });
    return { booking, clientId, clientName, passengerName, units, blockedUnits, ready: false };
  }

  const legs = journeyLegs(booking, now);
  const timedReturn = hasTimedReturn(booking);
  const split = hasPaymentSchedule(booking);
  const outboundDue = parseMoney(booking.dueOnOutbound);
  const returnDue = parseMoney(booking.dueOnReturn);
  const totalPounds = poundsFromPence(money.totalPence);

  const creditNote =
    receivedPounds > 0
      ? `Payments already recorded: ${formatGbp(receivedPounds)} (shown for accounting; invoice still bills the fare).`
      : "";

  const pushUnit = (
    leg: "all" | "outbound" | "return",
    farePounds: number,
    legLabel: BillableUnit["legLabel"]
  ) => {
    const key = leg === "all" ? bookingId : `${bookingId}:${leg}`;
    if (invoiced.has(key) || (leg !== "all" && invoiced.has(bookingId))) {
      blockedUnits.push({
        key,
        reason: "already_invoiced",
        detail: `${bookingNumber} ${legLabel.toLowerCase()} is already linked to an invoice.`,
      });
      return;
    }
    if (!(farePounds > 0)) {
      blockedUnits.push({
        key,
        reason: "missing_fare",
        detail: `${bookingNumber} has no fare to invoice.`,
      });
      return;
    }
    units.push({
      key,
      bookingId,
      bookingNumber,
      clientId,
      clientName,
      passengerName,
      serviceDate: serviceDateIso(booking, leg === "all" ? "outbound" : leg),
      route: routeFor(booking, leg === "all" ? "outbound" : leg),
      farePounds,
      receivedPounds,
      creditNote,
      legLabel,
      bookingRevision: revision,
    });
  };

  if (timedReturn && split) {
    const outbound = legs.find((row) => row.leg === "outbound");
    const ret = legs.find((row) => row.leg === "return");
    if (outbound?.status === "completed") {
      pushUnit("outbound", outboundDue ?? 0, "Outbound");
    } else {
      blockedUnits.push({
        key: `${bookingId}:outbound`,
        reason: "not_complete",
        detail: `${bookingNumber} outbound is not completed yet.`,
      });
    }
    if (ret?.status === "completed") {
      pushUnit("return", returnDue ?? 0, "Return");
    } else if (ret) {
      blockedUnits.push({
        key: `${bookingId}:return`,
        reason: "not_complete",
        detail: `${bookingNumber} return is not completed yet.`,
      });
    }
  } else if (timedReturn) {
    const allDone = legs.every((leg) => leg.status === "completed" || leg.status === "cancelled");
    const anyOpen = legs.some((leg) => leg.status !== "completed" && leg.status !== "cancelled");
    if (anyOpen || !allDone) {
      blockedUnits.push({
        key: bookingId,
        reason: "combined_return_incomplete",
        detail: `${bookingNumber} uses a combined fare. Finish every leg, or add an outbound and return fare split, before invoicing.`,
      });
    } else if (!(totalPounds > 0)) {
      blockedUnits.push({
        key: bookingId,
        reason: "missing_fare",
        detail: `${bookingNumber} has no fare to invoice.`,
      });
    } else {
      pushUnit("all", totalPounds, "Journey");
    }
  } else {
    const overall = legs[0];
    if (overall?.status !== "completed") {
      blockedUnits.push({
        key: bookingId,
        reason: "not_complete",
        detail: `${bookingNumber} is not completed yet${
          overall?.pickupAt && overall.pickupAt.getTime() > now.getTime()
            ? " (journey date is still in the future)."
            : "."
        }`,
      });
    } else if (!(totalPounds > 0)) {
      blockedUnits.push({
        key: bookingId,
        reason: "missing_fare",
        detail: `${bookingNumber} has no fare to invoice.`,
      });
    } else {
      pushUnit("all", totalPounds, "Journey");
    }
  }

  if (units.length === 0 && blockedUnits.length === 0) {
    blockedUnits.push({
      key: bookingId,
      reason: "no_billable_amount",
      detail: `${bookingNumber} has nothing left to bill.`,
    });
  }

  return {
    booking,
    clientId,
    clientName,
    passengerName,
    units,
    blockedUnits,
    ready: units.length > 0,
  };
}

export function listReadyBillableUnits(
  bookings: Booking[],
  clients: SavedInvoiceClient[],
  now = new Date()
): BillableUnit[] {
  const units: BillableUnit[] = [];
  for (const booking of bookings) {
    if (!isAccountJob(booking)) continue;
    const assessment = assessAccountBooking(booking, clients, now);
    units.push(...assessment.units);
  }
  return units.sort((a, b) => String(b.serviceDate).localeCompare(String(a.serviceDate)));
}

export function lineDescription(unit: BillableUnit): string {
  const dateLabel = unit.serviceDate ? formatUkDate(unit.serviceDate) : "Date TBA";
  const legBit = unit.legLabel === "Journey" ? "" : ` (${unit.legLabel})`;
  const passenger = unit.passengerName && unit.passengerName !== "—" ? ` · ${unit.passengerName}` : "";
  return `${dateLabel}${legBit} · ${unit.bookingNumber}${passenger} · ${unit.route}`;
}

export function buildInvoiceLines(units: BillableUnit[]): GeneralInvoiceLine[] {
  return units.map((unit) => ({
    description: lineDescription(unit),
    quantity: 1,
    unitPrice: Math.round(unit.farePounds * 100) / 100,
    vatRatePercent: 0,
  }));
}

export function selectionTotalPounds(units: BillableUnit[]): number {
  return Math.round(units.reduce((sum, unit) => sum + unit.farePounds, 0) * 100) / 100;
}

export function buildAccountInvoiceDraft(
  client: SavedInvoiceClient,
  units: BillableUnit[]
): AccountInvoiceDraftHandoff {
  if (!units.length) {
    throw new Error("Select at least one eligible trip.");
  }
  const mismatched = units.find((unit) => unit.clientId !== client.id);
  if (mismatched) {
    throw new Error("Selected trips must all belong to the same saved invoice client.");
  }
  const bookingIds = Array.from(new Set(units.map((unit) => unit.bookingId)));
  const billingLineKeys = units.map((unit) => unit.key);
  const bookingRevisions: Record<string, number> = {};
  for (const unit of units) {
    bookingRevisions[unit.bookingId] = unit.bookingRevision;
  }
  const dates = units.map((unit) => unit.serviceDate).filter(Boolean).sort();
  const travelDate = dates[0] || todayIsoDate();
  const refs = Array.from(new Set(units.map((unit) => unit.bookingNumber))).join(", ");
  const creditNotes = Array.from(
    new Set(units.map((unit) => unit.creditNote).filter(Boolean))
  ).join(" ");

  return {
    clientId: client.id,
    clientName: client.name,
    clientAddress: client.address || "",
    clientEmail: client.email || "",
    clientPhone: client.phone || "",
    invoicePrefix: client.invoicePrefix || "",
    lines: buildInvoiceLines(units),
    bookingNumber: refs,
    travelDate,
    pickup: units.length === 1 ? units[0].route.split(" → ")[0] || "" : `${units.length} journeys`,
    destination: units.length === 1 ? units[0].route.split(" → ")[1] || "" : "",
    notes: creditNotes,
    bookingIds,
    billingLineKeys,
    bookingRevisions,
  };
}

/** Keys already claimed by issued invoices in the vault (excludes abandoned PENDING drafts). */
export function invoicedKeysFromHistory(
  invoices: Array<{
    invoiceNumber?: string;
    needsServerNumber?: boolean;
    billingLineKeys?: string[];
    bookingIds?: string[];
    bookingNumber?: string;
  }>
): Set<string> {
  const keys = new Set<string>();
  for (const invoice of invoices) {
    const number = text(invoice.invoiceNumber);
    if (!number || number === "PENDING" || invoice.needsServerNumber) continue;
    if (Array.isArray(invoice.billingLineKeys)) {
      for (const key of invoice.billingLineKeys) {
        if (text(key)) keys.add(text(key));
      }
    }
    if (Array.isArray(invoice.bookingIds)) {
      for (const id of invoice.bookingIds) {
        if (text(id)) keys.add(text(id));
      }
    }
  }
  return keys;
}

export function filterUnitsNotAlreadyInvoiced(
  units: BillableUnit[],
  claimedKeys: Set<string>
): { allowed: BillableUnit[]; blocked: BillableUnit[] } {
  const allowed: BillableUnit[] = [];
  const blocked: BillableUnit[] = [];
  for (const unit of units) {
    if (claimedKeys.has(unit.key) || claimedKeys.has(unit.bookingId)) blocked.push(unit);
    else allowed.push(unit);
  }
  return { allowed, blocked };
}
