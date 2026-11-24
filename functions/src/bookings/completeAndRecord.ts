import { agreedFarePence, effectiveReceivedPence } from "../paymentAmount";
import { nextReceivedPence, paymentPosition } from "../quotes/fareMath";

export type CompleteLeg = "outbound" | "return";

export type CompleteRecordPlan =
  | {
      mode: "complete_and_record";
      amountPence: number;
      outstandingPence: number;
      paymentMethod: string;
      methodKnown: boolean;
      label: string;
      reason: "";
    }
  | {
      mode: "complete_only";
      amountPence: 0;
      outstandingPence: number;
      paymentMethod: string;
      methodKnown: boolean;
      label: "Mark complete";
      reason: "paid" | "account" | "fare_unknown" | "charges_pending" | "no_leg_split" | "already_complete" | "cancelled";
    };

function text(value: unknown): string {
  return String(value || "").trim();
}

function moneyLabel(pence: number): string {
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function methodKey(booking: Record<string, unknown>): string {
  return text(booking.paymentMethod).toLowerCase();
}

function hasTimedReturn(booking: Record<string, unknown>): boolean {
  if (booking.openReturn === true && !text(booking.returnPickupTime) && !text(booking.returnDateTime)) return false;
  if (booking.bookingType === "return" || booking.returnTrip === true) return true;
  return Boolean(text(booking.returnPickupLocation) || text(booking.returnDestination) || text(booking.returnPickupTime) || text(booking.returnDateTime));
}

function schedulePounds(booking: Record<string, unknown>, leg: CompleteLeg): number | null {
  const key = leg === "return" ? "dueOnReturn" : "dueOnOutbound";
  const raw = booking[key];
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function explicitLeg(booking: Record<string, unknown>, leg: CompleteLeg): string {
  const field = leg === "return" ? "returnStatus" : "outboundStatus";
  const raw = text(booking[field]);
  if (raw) return raw === "paid" ? "needs_review" : raw;
  const overall = text(booking.status) || text(booking.adminStatus);
  if (leg === "return" && hasTimedReturn(booking)) {
    if (overall === "completed") return "needs_review";
    return overall || "confirmed";
  }
  return overall || "confirmed";
}

function chargesNeedReview(booking: Record<string, unknown>, leg: CompleteLeg): boolean {
  const finalised = Boolean(booking[`${leg}ChargesFinalisedAt`]);
  if (finalised) return false;
  if (booking.timedHire) return true;
  const airport = leg === "return" ? booking.returnAirportCollection : booking.airportCollection;
  return Boolean(airport);
}

function isLastOpenLeg(booking: Record<string, unknown>, leg: CompleteLeg): boolean {
  if (!hasTimedReturn(booking)) return true;
  if (leg === "return") return true;
  const returnStatus = explicitLeg(booking, "return");
  return returnStatus === "completed" || returnStatus === "cancelled";
}

/** Server-side balance for the selected journey, including agreed leg splits. */
export function completeRecordPlan(booking: Record<string, unknown>, leg: CompleteLeg): CompleteRecordPlan {
  const outstandingPence = Math.max(0, agreedFarePence(booking) - effectiveReceivedPence(booking));
  const method = text(booking.paymentMethod);
  const key = methodKey(booking);
  const methodKnown = Boolean(method);
  const current = explicitLeg(booking, leg);

  if (text(booking.status) === "cancelled" || current === "cancelled") {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method, methodKnown, label: "Mark complete", reason: "cancelled" };
  }
  if (current === "completed") {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method, methodKnown, label: "Mark complete", reason: "already_complete" };
  }
  if (key === "account" || key === "on account" || key === "invoice") {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method || "account", methodKnown: true, label: "Mark complete", reason: "account" };
  }
  if (outstandingPence <= 0 || String(booking.paymentStatus || "").toLowerCase() === "paid") {
    return { mode: "complete_only", amountPence: 0, outstandingPence: 0, paymentMethod: method, methodKnown, label: "Mark complete", reason: "paid" };
  }
  if (agreedFarePence(booking) <= 0) {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method, methodKnown, label: "Mark complete", reason: "fare_unknown" };
  }
  if (chargesNeedReview(booking, leg)) {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method, methodKnown, label: "Mark complete", reason: "charges_pending" };
  }

  const schedule = schedulePounds(booking, leg);
  const legExtras = (Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [])
    .filter((row: any) => row && (row.leg === leg || row.id === `trip-time-${leg}`))
    .reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);
  const legReceived = (Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [])
    .filter((row: any) => row && row.leg === leg && row.mode === "add")
    .reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);

  let amountPence = 0;
  if (schedule != null) {
    amountPence = Math.min(outstandingPence, Math.max(0, Math.round(schedule * 100) + legExtras - legReceived));
  } else if (!hasTimedReturn(booking) || isLastOpenLeg(booking, leg)) {
    amountPence = outstandingPence;
  } else {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method, methodKnown, label: "Mark complete", reason: "no_leg_split" };
  }

  if (amountPence <= 0) {
    return { mode: "complete_only", amountPence: 0, outstandingPence, paymentMethod: method, methodKnown, label: "Mark complete", reason: "paid" };
  }

  return {
    mode: "complete_and_record",
    amountPence,
    outstandingPence,
    paymentMethod: method,
    methodKnown,
    label: `Complete & record ${moneyLabel(amountPence)} received`,
    reason: "",
  };
}

export function applyCompleteLegPatch(booking: Record<string, unknown>, leg: CompleteLeg): {
  ok: true;
  patch: Record<string, string>;
  completedAtField: "outboundCompletedAt" | "returnCompletedAt";
  nextStatus: string;
} | { ok: false; error: string } {
  if (text(booking.status) === "cancelled") return { ok: false, error: "This trip is cancelled." };
  const current = explicitLeg(booking, leg);
  if (current === "completed") return { ok: false, error: "This leg is already completed." };
  if (current === "cancelled") return { ok: false, error: "This leg is cancelled." };

  const outbound = leg === "outbound" ? "completed" : explicitLeg(booking, "outbound");
  const returnStatus = hasTimedReturn(booking)
    ? (leg === "return" ? "completed" : explicitLeg(booking, "return"))
    : "confirmed";

  const outboundDone = outbound === "completed" || outbound === "cancelled";
  const returnDone = !hasTimedReturn(booking) || returnStatus === "completed" || returnStatus === "cancelled";
  let status = text(booking.status) || "confirmed";
  if (!hasTimedReturn(booking)) {
    status = "completed";
  } else if (outboundDone && returnDone) {
    status = outbound === "cancelled" && returnStatus === "cancelled" ? "cancelled" : "completed";
  } else {
    const openStatus = outboundDone ? returnStatus : outbound;
    const driver = outboundDone ? text(booking.returnDriverId) : text(booking.driverId);
    status = openStatus === "allocated" || driver ? "allocated" : "confirmed";
  }

  const patch: Record<string, string> = {
    status,
    adminStatus: status,
    outboundStatus: outbound,
  };
  if (hasTimedReturn(booking)) patch.returnStatus = returnStatus;
  if (booking.customerStatus) patch.customerStatus = status;
  return {
    ok: true,
    patch,
    completedAtField: leg === "outbound" ? "outboundCompletedAt" : "returnCompletedAt",
    nextStatus: status,
  };
}

export function buildPaymentPatch(
  booking: Record<string, unknown>,
  amountPence: number,
  method: string,
  leg: CompleteLeg,
  clientRequestId: string,
  actor: string
): { ok: true; patch: Record<string, unknown>; entry: Record<string, unknown>; position: ReturnType<typeof paymentPosition> } | { ok: false; error: string } {
  const fare = agreedFarePence(booking);
  if (fare <= 0) return { ok: false, error: "Set the fare before recording payment." };
  const current = Number(booking.amountReceivedPence) || 0;
  const next = nextReceivedPence({ mode: "add", currentReceivedPence: current, amountPence });
  if (!next.ok) return { ok: false, error: next.error };
  const position = paymentPosition(fare, next.next, "");
  const entries = Array.isArray(booking.paymentEntries) ? [...booking.paymentEntries] : [];
  const entry = {
    clientRequestId,
    mode: "add",
    amountPence,
    method,
    paidOn: new Date().toISOString().slice(0, 10),
    note: "Complete and record from office",
    at: new Date().toISOString(),
    leg,
  };
  entries.push(entry);
  const patch: Record<string, unknown> = {
    amountReceivedPence: next.next,
    outstandingPence: position.outstandingPence,
    overpaymentPence: Math.max(0, next.next - fare),
    paymentStatus: position.stored,
    paymentVerified: position.stored === "paid",
    lastPaymentSource: "office",
    paymentEntries: entries.slice(-50),
    paymentRecordedBy: actor,
  };
  if (method) patch.paymentMethod = method;
  if (booking.depositRequired) {
    const depositPence = Math.round(Number(booking.depositAmount || 0) * 100);
    patch.depositStatus = next.next >= depositPence && depositPence > 0 ? "paid" : (booking.depositStatus || "pending");
  }
  return { ok: true, patch, entry, position };
}

export function poundsFromPence(pence: number): string {
  return (pence / 100).toFixed(2);
}
