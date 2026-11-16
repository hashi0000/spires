export function bookingMoney(value: unknown) {
  const booking = (value || {}) as Record<string, any>;
  const quote = booking.issuedQuote;
  const basePence = Math.max(0, Math.round(quote && Number.isFinite(Number(quote.finalFarePence)) ? Number(quote.finalFarePence) : (Number(booking.actualFare) || 0) * 100));
  const extrasPence = (Array.isArray(booking.additionalCharges) ? booking.additionalCharges : []).reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);
  const receivedPence = Math.max(0, Math.round(Number(booking.amountReceivedPence) || 0));
  const totalPence = basePence + extrasPence;
  return { basePence, extrasPence, totalPence, receivedPence, outstandingPence: Math.max(0, totalPence - receivedPence) };
}
