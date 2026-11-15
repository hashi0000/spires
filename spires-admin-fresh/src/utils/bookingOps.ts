export function bookingTotalLabel(fare: number | null | undefined): string {
  const amount = Number(fare);
  if (fare == null || !Number.isFinite(amount)) return "Booking total not set";
  return `Booking total £${amount.toFixed(2)}`;
}

export function extraStopsNeedAgreement(hasExtra: boolean, includedInAgreedFare?: boolean | null): boolean {
  return hasExtra && includedInAgreedFare !== true;
}

function looksLikeAirport(value?: string | null): boolean {
  return /\b(heathrow|gatwick|stansted|luton|birmingham|bristol|east midlands|london city|southampton|bournemouth|airport)\b/i.test(String(value || ""));
}

export function airportCollectionNotes(input: {
  airportCollection?: boolean | null;
  returnAirportCollection?: boolean | null;
  pickupLocation?: string | null;
  destination?: string | null;
  returnPickupLocation?: string | null;
  returnDestination?: string | null;
  hasReturn?: boolean;
}): string[] {
  const notes: string[] = [];
  const check = (leg: string, collection: boolean, pickup?: string | null, destination?: string | null) => {
    const pickupAirport = looksLikeAirport(pickup);
    const destinationAirport = looksLikeAirport(destination);
    if (collection && !pickupAirport && destinationAirport) {
      notes.push(`${leg} has airport collection checked on a journey that ends at an airport. Review this leg. The stored flag is left as it is.`);
    } else if (collection && !pickupAirport && !destinationAirport) {
      notes.push(`${leg} has airport collection checked, and neither address names an airport. Review this leg. The stored flag is left as it is.`);
    } else if (!collection && pickupAirport) {
      notes.push(`${leg} starts at an airport and airport collection is not checked. Review this leg. The stored flag is left as it is.`);
    }
  };
  check("Outbound", Boolean(input.airportCollection), input.pickupLocation, input.destination);
  if (input.hasReturn) {
    check("Return", Boolean(input.returnAirportCollection), input.returnPickupLocation, input.returnDestination);
  }
  return notes;
}

export function vehicleClassRequiredMessage(status?: string | null, vehicleType?: string | null, alreadyConfirmed = false): string {
  const confirming = status === "confirmed" || status === "allocated" || status === "completed";
  if (confirming && !alreadyConfirmed && !String(vehicleType || "").trim()) {
    return "Choose a vehicle class before confirming this booking.";
  }
  return "";
}

export function legacyPaidWithoutAmount(status?: string | null, receivedPence?: number | null): boolean {
  return (status === "paid" || status === "partial") && !(Number(receivedPence) > 0);
}

export const PAYMENT_STATUS_ONLY_REASON = "Payment status follows recorded payments. Open the booking and record a payment, refund, or reconciliation. The amount already received stays as it is.";

export type ReconciliationItem = {
  bookingNumber: string;
  kind: "fare" | "payment" | "cost" | "source";
  detail: string;
};

type ReconciliationBooking = {
  bookingNumber?: string;
  status?: string | null;
  adminStatus?: string | null;
  actualFare?: number | null;
  paymentStatus?: string | null;
  amountReceivedPence?: number | null;
  subcontractOperator?: string | null;
  supplierCostPence?: number | null;
  source?: string | null;
  heardAbout?: string | null;
  bookingMethod?: string | null;
};

export function reconciliationItems(bookings: ReconciliationBooking[]): ReconciliationItem[] {
  const items: ReconciliationItem[] = [];
  bookings.forEach((booking) => {
    const ref = String(booking.bookingNumber || "").trim() || "No reference";
    const workflow = String(booking.adminStatus || booking.status || "");
    const open = workflow !== "cancelled";
    if (open && !(Number(booking.actualFare) > 0)) {
      items.push({ bookingNumber: ref, kind: "fare", detail: "Agreed fare is missing." });
    }
    if (legacyPaidWithoutAmount(booking.paymentStatus, booking.amountReceivedPence)) {
      items.push({ bookingNumber: ref, kind: "payment", detail: "Paid or part paid is stored without a received amount." });
    }
    if (String(booking.subcontractOperator || "").trim() && !(Number(booking.supplierCostPence) > 0)) {
      items.push({ bookingNumber: ref, kind: "cost", detail: "A subcontract operator is recorded without a supplier cost." });
    }
    const confirmed = workflow === "confirmed" || workflow === "allocated" || workflow === "completed" || workflow === "paid";
    if (confirmed && !String(booking.source || "").trim() && !String(booking.heardAbout || "").trim() && !String(booking.bookingMethod || "").trim()) {
      items.push({ bookingNumber: ref, kind: "source", detail: "No source was recorded." });
    }
  });
  return items.slice(0, 40);
}

export function invoiceSupplierForReprint<T>(issued: T | null | undefined, current: T): T {
  return issued || current;
}
