import { bookingMoney } from "./bookingMoney";
import { hasTimedReturn, type JourneyLegName } from "./journeyLegs";
import { legPaymentDue, poundsFromPence, type JobCardLeg } from "./jobCardActions";

export type CompleteActionPlan = {
  mode: "complete_and_record" | "complete_only";
  amountPence: number;
  outstandingPence: number;
  paymentMethod: string;
  methodKnown: boolean;
  primaryLabel: string;
  reason: string;
};

function methodKey(booking: Record<string, unknown>): string {
  return String(booking.paymentMethod || "").trim().toLowerCase();
}

function chargesNeedReview(booking: Record<string, unknown>, leg: JourneyLegName): boolean {
  if (booking[`${leg}ChargesFinalisedAt`]) return false;
  if (booking.timedHire) return true;
  const airport = leg === "return" ? booking.returnAirportCollection : booking.airportCollection;
  return Boolean(airport);
}

function namedLeg(leg: JobCardLeg): JourneyLegName {
  return leg === "return" ? "return" : "outbound";
}

/** Labels and amount for the one-click complete control. Balance maths match the server plan. */
export function completeActionPlan(booking: Record<string, unknown>, leg: JobCardLeg = "outbound"): CompleteActionPlan {
  const journey = namedLeg(leg);
  const money = bookingMoney(booking);
  const method = String(booking.paymentMethod || "").trim();
  const methodKnown = Boolean(method);
  const key = methodKey(booking);
  const due = legPaymentDue(booking, leg);

  if (key === "account" || key === "on account" || key === "invoice") {
    return {
      mode: "complete_only",
      amountPence: 0,
      outstandingPence: money.outstandingPence,
      paymentMethod: method || "account",
      methodKnown: true,
      primaryLabel: "Mark complete",
      reason: "account",
    };
  }
  if (due.kind === "paid" || money.outstandingPence <= 0) {
    return {
      mode: "complete_only",
      amountPence: 0,
      outstandingPence: 0,
      paymentMethod: method,
      methodKnown,
      primaryLabel: "Mark complete",
      reason: "paid",
    };
  }
  if (money.totalPence <= 0) {
    return {
      mode: "complete_only",
      amountPence: 0,
      outstandingPence: money.outstandingPence,
      paymentMethod: method,
      methodKnown,
      primaryLabel: "Mark complete",
      reason: "fare_unknown",
    };
  }
  if (chargesNeedReview(booking, journey)) {
    return {
      mode: "complete_only",
      amountPence: 0,
      outstandingPence: money.outstandingPence,
      paymentMethod: method,
      methodKnown,
      primaryLabel: "Mark complete",
      reason: "charges_pending",
    };
  }
  if (!due.ok) {
    const lastLeg = !hasTimedReturn(booking as any) || journey === "return";
    if (lastLeg && money.outstandingPence > 0) {
      return {
        mode: "complete_and_record",
        amountPence: money.outstandingPence,
        outstandingPence: money.outstandingPence,
        paymentMethod: method,
        methodKnown,
        primaryLabel: `Complete & record £${poundsFromPence(money.outstandingPence)} received`,
        reason: "",
      };
    }
    return {
      mode: "complete_only",
      amountPence: 0,
      outstandingPence: money.outstandingPence,
      paymentMethod: method,
      methodKnown,
      primaryLabel: "Mark complete",
      reason: "no_leg_split",
    };
  }
  if (due.amountPence > 0) {
    return {
      mode: "complete_and_record",
      amountPence: due.amountPence,
      outstandingPence: due.outstandingPence,
      paymentMethod: method,
      methodKnown,
      primaryLabel: `Complete & record £${poundsFromPence(due.amountPence)} received`,
      reason: "",
    };
  }
  return {
    mode: "complete_only",
    amountPence: 0,
    outstandingPence: due.outstandingPence,
    paymentMethod: method,
    methodKnown,
    primaryLabel: "Mark complete",
    reason: "paid",
  };
}
