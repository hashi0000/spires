export type PaymentLabel = "Unpaid" | "Part paid" | "Paid" | "Refunded";

export function paymentSummary(farePounds: number, receivedPence: number, storedStatus?: string | null) {
  const farePence = Math.max(0, Math.round((Number(farePounds) || 0) * 100));
  const received = Math.max(0, Math.round(Number(receivedPence) || 0));
  const outstandingPence = Math.max(0, farePence - received);
  const overpaymentPence = Math.max(0, received - farePence);
  if (storedStatus === "refunded") {
    return { farePence, receivedPence: received, outstandingPence, overpaymentPence, label: "Refunded" as PaymentLabel };
  }
  if (farePence > 0 && received >= farePence) {
    return { farePence, receivedPence: received, outstandingPence: 0, overpaymentPence, label: "Paid" as PaymentLabel };
  }
  if (received > 0) {
    return { farePence, receivedPence: received, outstandingPence, overpaymentPence: 0, label: "Part paid" as PaymentLabel };
  }
  return { farePence, receivedPence: received, outstandingPence, overpaymentPence: 0, label: "Unpaid" as PaymentLabel };
}

export function depositStillDuePence(depositPounds: number, receivedPence: number): number {
  return Math.max(0, Math.round((Number(depositPounds) || 0) * 100) - Math.max(0, Math.round(receivedPence || 0)));
}

export function quoteSendState(status: string | null | undefined): { send: boolean; reissue: boolean; reason: string } {
  if (status === "cancelled") {
    return { send: false, reissue: false, reason: "This booking is cancelled. Review its payments before making changes." };
  }
  if (status === "completed" || status === "allocated" || status === "confirmed") {
    return {
      send: false,
      reissue: false,
      reason: `This booking is ${status}. Payment can still be requested or recorded. A new quote is not sent at this stage.`,
    };
  }
  if (status === "awaiting_customer_confirmation") {
    return {
      send: false,
      reissue: true,
      reason: "A quote has already been sent. Send an updated quote only if the price or journey has changed.",
    };
  }
  return { send: true, reissue: false, reason: "" };
}

export function money(pence: number): string {
  return (Math.max(0, Math.round(pence)) / 100).toFixed(2);
}
