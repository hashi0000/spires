import { Booking } from "../types/types";
import { effectiveWorkflowStatus, workflowStatusLabel } from "./bookingWorkflow";

export type JourneyLegName = "outbound" | "return";

export type JourneyLegStatus =
  | "pending"
  | "awaiting_customer_confirmation"
  | "confirmed"
  | "allocated"
  | "completed"
  | "cancelled"
  | "needs_review";

export interface JourneyLeg {
  leg: JourneyLegName;
  label: "Outbound" | "Return";
  pickupAt: Date | null;
  pickupLocation: string;
  destination: string;
  status: JourneyLegStatus;
  driverId: string;
  needsReview: boolean;
}

export type JourneyQuickView = "today" | "tomorrow" | "upcoming" | "unassigned";

type LegBooking = Booking & {
  outboundStatus?: string;
  returnStatus?: string;
  returnDriverId?: string;
  returnDateTime?: string;
  returnTrip?: boolean;
  customerStatus?: string;
};

const LEG_STATUSES = new Set<JourneyLegStatus>([
  "pending",
  "awaiting_customer_confirmation",
  "confirmed",
  "allocated",
  "completed",
  "cancelled",
  "needs_review",
]);

export function londonDayKey(value?: string | Date | null): string {
  if (!value) return "";
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export function shiftLondonDay(day: string, days: number): string {
  const [year, month, date] = day.split("-").map(Number);
  const next = new Date(Date.UTC(year, month - 1, date + days));
  return next.toISOString().slice(0, 10);
}

function parseWhen(value?: string | null): Date | null {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function readLegStatus(value: unknown): JourneyLegStatus | null {
  if (value === "paid") return "completed";
  if (typeof value === "string" && LEG_STATUSES.has(value as JourneyLegStatus)) {
    return value as JourneyLegStatus;
  }
  return null;
}

type TimedReturnFields = {
  returnPickupTime?: string | null;
  returnDateTime?: string | null;
  openReturn?: boolean;
  bookingType?: string | null;
  returnTrip?: boolean;
  returnPickupLocation?: string | null;
  returnDestination?: string | null;
};

export function hasTimedReturn(booking: TimedReturnFields): boolean {
  const timed = Boolean(booking.returnPickupTime || booking.returnDateTime);
  if (!timed) return false;
  if (booking.openReturn === true && !booking.returnPickupTime && !booking.returnDateTime) return false;
  if (booking.bookingType === "return" || booking.returnTrip === true) return true;
  return Boolean(booking.returnPickupLocation || booking.returnDestination);
}

function overallStatus(booking: LegBooking): JourneyLegStatus {
  return readLegStatus(effectiveWorkflowStatus(booking)) || "pending";
}

function text(value?: string | null): string {
  return String(value || "").trim();
}

export function journeyLegs(booking: Booking, now: Date = new Date()): JourneyLeg[] {
  const row = booking as LegBooking;
  const overall = overallStatus(row);
  const explicitOutbound = readLegStatus(row.outboundStatus);
  const outboundDone = overall === "completed" || overall === "cancelled";
  const outbound: JourneyLeg = {
    leg: "outbound",
    label: "Outbound",
    pickupAt: parseWhen(row.pickupTime || row.dateTime),
    pickupLocation: text(row.pickupLocation),
    destination: text(row.destination),
    status: explicitOutbound || overall,
    driverId: text(row.driverId),
    needsReview: false,
  };
  if (!hasTimedReturn(row)) return [outbound];

  const returnAt = parseWhen(row.returnPickupTime || row.returnDateTime);
  const explicitReturn = readLegStatus(row.returnStatus);
  const explicitReturnDriver = text(row.returnDriverId);
  let returnStatus = explicitReturn || overall;
  let needsReview = explicitReturn === "needs_review";
  let driverId = explicitReturnDriver || text(row.driverId);

  if (!explicitReturn && overall === "cancelled") {
    returnStatus = "cancelled";
    needsReview = false;
  } else if (!explicitReturn && overall === "completed") {
    returnStatus = "needs_review";
    needsReview = true;
    driverId = "";
    if (!explicitOutbound) outbound.status = "completed";
  } else if (explicitReturn === "needs_review") {
    driverId = explicitReturnDriver;
  }

  if (outboundDone && !explicitOutbound && overall === "completed") outbound.status = "completed";

  return [
    outbound,
    {
      leg: "return",
      label: "Return",
      pickupAt: returnAt,
      pickupLocation: text(row.returnPickupLocation) || text(row.destination),
      destination: text(row.returnDestination) || text(row.pickupLocation),
      status: returnStatus,
      driverId,
      needsReview,
    },
  ];
}

export function openJourneyLegs(booking: Booking, now: Date = new Date()): JourneyLeg[] {
  return journeyLegs(booking, now).filter(
    (leg) => leg.pickupAt && leg.status !== "completed" && leg.status !== "cancelled"
  );
}

export function legsForQuickView(booking: Booking, view: JourneyQuickView, now: Date): JourneyLeg[] {
  const today = londonDayKey(now);
  const tomorrow = shiftLondonDay(today, 1);
  return journeyLegs(booking, now).filter((leg) => {
    const day = londonDayKey(leg.pickupAt);
    if (view === "today") return day === today && leg.status !== "cancelled";
    if (view === "tomorrow") return day === tomorrow && leg.status !== "cancelled";
    if (view === "unassigned") {
      return leg.status !== "cancelled" && leg.status !== "completed" && !leg.driverId;
    }
    return Boolean(day) && day >= today && leg.status !== "cancelled" && leg.status !== "completed";
  });
}

export function legStatusLabel(leg: JourneyLeg): string {
  if (leg.needsReview || leg.status === "needs_review") return "Needs review";
  return workflowStatusLabel(leg.status);
}

function resolved(status: JourneyLegStatus): boolean {
  return status === "completed" || status === "cancelled";
}

/**
 * Completing the outbound writes the outbound leg only.
 * The booking stays open until the return is completed or cancelled.
 * An already completed historical booking is left unchanged unless a return status is chosen.
 * Fare and payment fields are not modified.
 */
export function applyRequestedLegStatus<T extends LegBooking>(previous: Booking | null, next: T): T {
  if (!hasTimedReturn(next)) return next;
  const returnChoice = readLegStatus(next.returnStatus);
  const outboundChoice = readLegStatus(next.outboundStatus);
  const previousStatus = previous ? String(previous.status || "") : "";
  const nextStatus = String(next.status || "");
  const wasCompleted = previous
    ? effectiveWorkflowStatus(previous) === "completed" || previousStatus === "completed" || previousStatus === "paid"
    : false;
  const markingCompleted = (nextStatus === "completed" || nextStatus === "paid") && !wasCompleted;
  if (!markingCompleted && !returnChoice && !outboundChoice) return next;

  const outboundStatus: JourneyLegStatus = markingCompleted
    ? "completed"
    : outboundChoice || (wasCompleted ? "completed" : readLegStatus(nextStatus) || "confirmed");
  const returnStatus: JourneyLegStatus = returnChoice || (markingCompleted ? "needs_review" : readLegStatus(nextStatus) || "confirmed");
  let status: Booking["status"] = nextStatus === "paid" ? "completed" : next.status;
  if (resolved(outboundStatus) && resolved(returnStatus)) {
    status = outboundStatus === "cancelled" && returnStatus === "cancelled" ? "cancelled" : "completed";
  } else if (markingCompleted || nextStatus === "completed" || nextStatus === "paid") {
    status = text(next.driverId) || text(next.returnDriverId) ? "allocated" : "confirmed";
  }
  const customerStatus = next.customerStatus === "completed" || next.customerStatus === "paid" ? status : next.customerStatus;
  return {
    ...next,
    outboundStatus,
    returnStatus,
    status,
    adminStatus: status,
    ...(customerStatus ? { customerStatus } : {}),
  };
}

export interface LegacyReturnCorrection {
  bookingNumber: string;
  storedStatus: string;
  apply: false;
  proposed: {
    outboundStatus: "completed";
    returnStatus: "needs_review";
    status: "confirmed" | "allocated";
    adminStatus: "confirmed" | "allocated";
    returnDriverId: "";
  };
  unchanged: Array<"actualFare" | "amountReceivedPence" | "paymentStatus" | "driverId">;
}

/** Prepared for review. This does not write the booking. */
export function proposedLegacyReturnCorrection(booking: Booking, now: Date = new Date()): LegacyReturnCorrection | null {
  const ret = journeyLegs(booking, now).find((leg) => leg.leg === "return");
  if (!ret?.needsReview) return null;
  const next = text(booking.driverId) ? "allocated" : "confirmed";
  return {
    bookingNumber: booking.bookingNumber,
    storedStatus: booking.status,
    apply: false,
    proposed: {
      outboundStatus: "completed",
      returnStatus: "needs_review",
      status: next,
      adminStatus: next,
      returnDriverId: "",
    },
    unchanged: ["actualFare", "amountReceivedPence", "paymentStatus", "driverId"],
  };
}
