export function agreedFarePence(booking: Record<string, unknown>): number {
  const extras = Array.isArray(booking.additionalCharges)
    ? (booking.additionalCharges as Array<{ amountPence?: number }>).reduce((sum, row) => sum + Math.max(0, Math.round(Number(row && row.amountPence) || 0)), 0)
    : 0;
  const quote = booking.issuedQuote && typeof booking.issuedQuote === "object" ? booking.issuedQuote as Record<string, unknown> : null;
  const base = quote && Number.isFinite(Number(quote.finalFarePence))
    ? Math.max(0, Math.round(Number(quote.finalFarePence)))
    : (Number.isFinite(Number(booking.actualFare)) ? Math.max(0, Math.round(Number(booking.actualFare) * 100)) : 0);
  return base + extras;
}

export function depositAmountPence(booking: Record<string, unknown>): number {
  if (booking.depositRequired !== true) return 0;
  return Math.max(0, Math.round((Number(booking.depositAmount) || 0) * 100));
}

/** True when a paid deposit is already reflected in amountReceivedPence / paymentEntries. */
export function paidDepositAlreadyRecorded(booking: Record<string, unknown>, depositPence = depositAmountPence(booking)): boolean {
  if (!(depositPence > 0)) return true;
  const entries = Array.isArray(booking.paymentEntries) ? booking.paymentEntries as Array<Record<string, unknown>> : [];
  if (entries.some((entry) => entry && (entry.kind === "deposit" || String(entry.clientRequestId || "").startsWith("deposit-")))) {
    return true;
  }
  const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  return recorded >= depositPence;
}

/**
 * Payments received for display and balance due.
 * Pending deposits leave the total unchanged. A paid deposit missing from the payment history is counted once.
 */
export function effectiveReceivedPence(booking: Record<string, unknown>): number {
  const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  if (String(booking.depositStatus || "") !== "paid") return recorded;
  const depositPence = depositAmountPence(booking);
  if (!(depositPence > 0) || paidDepositAlreadyRecorded(booking, depositPence)) return recorded;
  return recorded + depositPence;
}

export type Payable =
  | { ok: true; pence: number; farePence: number; receivedPence: number }
  | { ok: false; reason: string };

/** The amount a card payment may take. The browser amount is not used. */
export function serverPayablePence(booking: Record<string, unknown>): Payable {
  const status = String(booking.status || "");
  if (status === "cancelled") return { ok: false, reason: "This booking is cancelled." };
  if (booking.brand === "spires_international") {
    return { ok: false, reason: "Spires International payments are not taken through this payment call." };
  }
  const farePence = agreedFarePence(booking);
  if (!(farePence > 0)) return { ok: false, reason: "This booking has no agreed fare." };
  const receivedPence = effectiveReceivedPence(booking);
  const outstanding = Math.max(0, farePence - receivedPence);
  if (outstanding <= 0) return { ok: false, reason: "This booking has no outstanding balance." };
  const depositPence = depositAmountPence(booking);
  const depositStillDue = booking.depositRequired === true && String(booking.depositStatus || "") !== "paid" && depositPence > receivedPence;
  const pence = depositStillDue ? Math.min(outstanding, depositPence - receivedPence) : outstanding;
  if (pence < 50) return { ok: false, reason: "The outstanding amount is below the card minimum." };
  return { ok: true, pence, farePence, receivedPence };
}

export function paymentClaimAllows(existingBookingId: string, bookingId: string): boolean {
  return !existingBookingId || existingBookingId === bookingId;
}

export function clientAmountMatchesPayable(payablePence: number, amount: unknown): boolean {
  const parsed = Number(String(amount ?? "").replace(/[£$€,\s]/g, ""));
  return Number.isFinite(parsed) && Math.round(parsed * 100) === payablePence;
}
