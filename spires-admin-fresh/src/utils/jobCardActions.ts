import { bookingMoney } from "./bookingMoney";
import { hasTimedReturn, type JourneyLegName } from "./journeyLegs";

export type JobCardLeg = JourneyLegName | "booking";

export type LegPaymentDue =
  | { ok: true; amountPence: number; outstandingPence: number; scheduleKnown: true; kind: "collect" | "paid" | "account" }
  | { ok: false; amountPence: null; outstandingPence: number; scheduleKnown: false; kind: "office"; reason: string };

function schedulePounds(booking: Record<string, unknown>, leg: JourneyLegName): number | null {
  const key = leg === "return" ? "dueOnReturn" : "dueOnOutbound";
  const raw = booking[key];
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function methodKey(booking: Record<string, unknown>): string {
  return String(booking.paymentMethod || "").trim().toLowerCase();
}

/** Amount to record for this card using the agreed split and shared money maths. */
export function legPaymentDue(booking: Record<string, unknown>, leg: JobCardLeg): LegPaymentDue {
  const money = bookingMoney(booking);
  const outstandingPence = money.outstandingPence;
  const key = methodKey(booking);
  if (key === "account" || key === "on account" || key === "invoice") {
    return { ok: true, amountPence: 0, outstandingPence, scheduleKnown: true, kind: "account" };
  }
  if (outstandingPence <= 0 || String(booking.paymentStatus || "").toLowerCase() === "paid") {
    return { ok: true, amountPence: 0, outstandingPence: 0, scheduleKnown: true, kind: "paid" };
  }

  const namedLeg: JourneyLegName = leg === "return" ? "return" : "outbound";
  const schedule = schedulePounds(booking, namedLeg);
  const legExtras = (Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [])
    .filter((row: any) => row && (row.leg === namedLeg || row.id === `trip-time-${namedLeg}`))
    .reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);
  const legReceived = (Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [])
    .filter((row: any) => row && row.leg === namedLeg && row.mode === "add")
    .reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);

  if (schedule != null) {
    const amount = Math.min(outstandingPence, Math.max(0, Math.round(schedule * 100) + legExtras - legReceived));
    return {
      ok: true,
      amountPence: amount,
      outstandingPence,
      scheduleKnown: true,
      kind: amount > 0 ? "collect" : "paid",
    };
  }

  if (leg === "booking" || !hasTimedReturn(booking as any)) {
    return { ok: true, amountPence: outstandingPence, outstandingPence, scheduleKnown: true, kind: "collect" };
  }

  return {
    ok: false,
    amountPence: null,
    outstandingPence,
    scheduleKnown: false,
    kind: "office",
    reason: "Amount due on this leg cannot be determined. Check the agreed payment split.",
  };
}

export function jobSelectionKey(bookingId: string, leg: JobCardLeg): string {
  return `${bookingId}|${leg}`;
}

export function parseJobSelectionKey(key: string): { bookingId: string; leg: JobCardLeg } | null {
  const split = key.indexOf("|");
  if (split <= 0) return null;
  const bookingId = key.slice(0, split);
  const leg = key.slice(split + 1);
  if (!bookingId || !["outbound", "return", "booking"].includes(leg)) return null;
  return { bookingId, leg: leg as JobCardLeg };
}

export function resolveJobCardLeg(leg?: { leg?: string } | JourneyLegName | null): JobCardLeg {
  if (!leg) return "booking";
  if (typeof leg === "string") return leg === "return" ? "return" : leg === "outbound" ? "outbound" : "booking";
  if (leg.leg === "return") return "return";
  if (leg.leg === "outbound") return "outbound";
  return "booking";
}

export type BulkPaymentLine = {
  key: string;
  bookingId: string;
  bookingNumber: string;
  leg: JobCardLeg;
  label: string;
  amountPence: number | null;
  outstandingPence: number;
  exception: string | null;
  skipPayment: boolean;
};

/** Preview lines for bulk Record as paid. Exceptions stay selected for manual follow up. */
export function planBulkPaymentLines(
  rows: Array<{ key: string; booking: Record<string, unknown> & { id?: string; bookingNumber?: string }; leg: JobCardLeg }>
): BulkPaymentLine[] {
  return rows.map((row) => {
    const due = legPaymentDue(row.booking, row.leg);
    const bookingNumber = String(row.booking.bookingNumber || row.booking.id || "Job");
    const legLabel = row.leg === "return" ? "return" : row.leg === "outbound" ? "outbound" : "journey";
    if (due.kind === "account") {
      return {
        key: row.key,
        bookingId: String(row.booking.id || ""),
        bookingNumber,
        leg: row.leg,
        label: `${bookingNumber} · ${legLabel}`,
        amountPence: 0,
        outstandingPence: due.outstandingPence,
        exception: "On account — no payment to collect",
        skipPayment: true,
      };
    }
    if (due.kind === "paid" || (due.ok && due.amountPence === 0)) {
      return {
        key: row.key,
        bookingId: String(row.booking.id || ""),
        bookingNumber,
        leg: row.leg,
        label: `${bookingNumber} · ${legLabel}`,
        amountPence: 0,
        outstandingPence: 0,
        exception: "Already paid",
        skipPayment: true,
      };
    }
    if (!due.ok) {
      return {
        key: row.key,
        bookingId: String(row.booking.id || ""),
        bookingNumber,
        leg: row.leg,
        label: `${bookingNumber} · ${legLabel}`,
        amountPence: null,
        outstandingPence: due.outstandingPence,
        exception: due.reason,
        skipPayment: true,
      };
    }
    return {
      key: row.key,
      bookingId: String(row.booking.id || ""),
      bookingNumber,
      leg: row.leg,
      label: `${bookingNumber} · ${legLabel}`,
      amountPence: due.amountPence,
      outstandingPence: due.outstandingPence,
      exception: null,
      skipPayment: false,
    };
  });
}

export function poundsFromPence(pence: number): string {
  return (pence / 100).toFixed(2);
}
