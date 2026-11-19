export function depositAmountPence(value: unknown): number {
  const booking = (value || {}) as Record<string, any>;
  if (booking.depositRequired !== true) return 0;
  return Math.max(0, Math.round((Number(booking.depositAmount) || 0) * 100));
}

/** True when a paid deposit is already reflected in amountReceivedPence / paymentEntries. */
export function paidDepositAlreadyRecorded(value: unknown, depositPence = depositAmountPence(value)): boolean {
  const booking = (value || {}) as Record<string, any>;
  if (!(depositPence > 0)) return true;
  const entries = Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [];
  if (entries.some((entry: any) => entry && (entry.kind === "deposit" || String(entry.clientRequestId || "").startsWith("deposit-")))) {
    return true;
  }
  const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  return recorded >= depositPence;
}

/**
 * Payments received for display and balance due.
 * Pending deposits leave the total unchanged. A paid deposit missing from the payment history is counted once.
 */
export function effectiveReceivedPence(value: unknown): number {
  const booking = (value || {}) as Record<string, any>;
  const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  if (String(booking.depositStatus || "") !== "paid") return recorded;
  const depositPence = depositAmountPence(booking);
  if (!(depositPence > 0) || paidDepositAlreadyRecorded(booking, depositPence)) return recorded;
  return recorded + depositPence;
}

export function bookingMoney(value: unknown) {
  const booking = (value || {}) as Record<string, any>;
  const quote = booking.issuedQuote;
  const basePence = Math.max(0, Math.round(quote && Number.isFinite(Number(quote.finalFarePence)) ? Number(quote.finalFarePence) : (Number(booking.actualFare) || 0) * 100));
  const extrasPence = (Array.isArray(booking.additionalCharges) ? booking.additionalCharges : []).reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);
  const receivedPence = effectiveReceivedPence(booking);
  const totalPence = basePence + extrasPence;
  return { basePence, extrasPence, totalPence, receivedPence, outstandingPence: Math.max(0, totalPence - receivedPence) };
}

/** Build payment fields when staff mark a deposit paid without a separate payment record. */
export function paidDepositPaymentFields(
  value: unknown,
  bookingId: string,
  method = "bank transfer"
): Record<string, unknown> | null {
  const booking = (value || {}) as Record<string, any>;
  if (booking.depositRequired !== true || String(booking.depositStatus || "") !== "paid") return null;
  const depositPence = depositAmountPence(booking);
  if (!(depositPence > 0) || paidDepositAlreadyRecorded(booking, depositPence)) return null;
  const recorded = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  const nextReceived = recorded + depositPence;
  const entries = Array.isArray(booking.paymentEntries) ? [...booking.paymentEntries] : [];
  const requestId = `deposit-${String(bookingId || "new").replace(/[^a-zA-Z0-9_-]/g, "").slice(0, 40)}`;
  if (entries.some((entry: any) => entry && entry.clientRequestId === requestId)) return null;
  entries.push({
    clientRequestId: requestId,
    mode: "add",
    kind: "deposit",
    amountPence: depositPence,
    method: String(method || "bank transfer"),
    paidOn: new Date().toISOString().slice(0, 10),
    note: "Deposit",
    at: new Date().toISOString(),
  });
  const totalPence = bookingMoney({ ...booking, amountReceivedPence: nextReceived, paymentEntries: entries }).totalPence;
  return {
    amountReceivedPence: nextReceived,
    outstandingPence: Math.max(0, totalPence - nextReceived),
    paymentEntries: entries.slice(-50),
    paymentStatus: nextReceived >= totalPence && totalPence > 0 ? "paid" : "partial",
    depositStatus: "paid",
    lastPaymentSource: "office",
  };
}
