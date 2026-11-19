import { agreedFarePence, effectiveReceivedPence } from "./paymentAmount";
import { proposeTimedHireCharge } from "./timedHire";
import { proposeWaitingCharge } from "./airportWaitingPolicy";

export function assignedLegs(booking: Record<string, any>, driverId: string): string[] {
  return [booking.driverId === driverId ? "outbound" : "", booking.returnDriverId === driverId ? "return" : ""].filter(Boolean);
}

export function hasReturnLeg(booking: Record<string, any>): boolean {
  if (booking.bookingType === "return" || booking.returnTrip === true || booking.openReturn === true) return true;
  if (booking.returnPickupLocation && booking.returnDestination) return true;
  return Boolean(booking.returnPickupTime || booking.returnDateTime);
}

export type DriverPaymentSummary = {
  kind: "collect" | "paid" | "account" | "office";
  amountToCollectPence: number | null;
  outstandingPence: number;
  paymentMethod: string;
  title: string;
  detail: string;
  scheduleKnown: boolean;
};

function schedulePounds(booking: Record<string, any>, leg: string): number | null {
  const key = leg === "return" ? "dueOnReturn" : "dueOnOutbound";
  const raw = booking[key];
  if (raw === undefined || raw === null || String(raw).trim() === "") return null;
  const n = Number(raw);
  return Number.isFinite(n) ? n : null;
}

function moneyLabel(pence: number): string {
  return "£" + (pence / 100).toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

/** Leg payment summary shared by Driver Hub and Family Jobs. */
export function driverPaymentSummary(booking: Record<string, any>, leg: "outbound" | "return"): DriverPaymentSummary {
  booking = { ...booking, ...(booking.acceptedServiceTerms || {}) };
  const method = String(booking.paymentMethod || "").trim();
  const methodKey = method.toLowerCase();
  const outstandingPence = Math.max(0, agreedFarePence(booking) - effectiveReceivedPence(booking));
  const paid = outstandingPence <= 0 || String(booking.paymentStatus || "").toLowerCase() === "paid";

  if (methodKey === "account" || methodKey === "on account" || methodKey === "invoice") {
    return {
      kind: "account",
      amountToCollectPence: 0,
      outstandingPence,
      paymentMethod: method || "account",
      title: "On account — no payment to collect",
      detail: "This is an invoiced job. Complete the journey without collecting payment.",
      scheduleKnown: true,
    };
  }

  if (paid) {
    return {
      kind: "paid",
      amountToCollectPence: 0,
      outstandingPence: 0,
      paymentMethod: method,
      title: "Already paid",
      detail: "Nothing remains due on this booking.",
      scheduleKnown: true,
    };
  }

  const schedule = schedulePounds(booking, leg);
  const legExtras = (Array.isArray(booking.additionalCharges) ? booking.additionalCharges : [])
    .filter((row: any) => row && (row.leg === leg || row.id === "trip-time-" + leg))
    .reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);
  const legReceived = (Array.isArray(booking.paymentEntries) ? booking.paymentEntries : [])
    .filter((row: any) => row && row.leg === leg && row.mode === "add")
    .reduce((sum: number, row: any) => sum + Math.max(0, Math.round(Number(row.amountPence) || 0)), 0);

  if (schedule != null) {
    const amount = Math.min(outstandingPence, Math.max(0, Math.round(schedule * 100) + legExtras - legReceived));
    return {
      kind: amount > 0 ? "collect" : "paid",
      amountToCollectPence: amount,
      outstandingPence,
      paymentMethod: method,
      title: amount > 0 ? ("Amount to collect on this leg: " + moneyLabel(amount)) : "Already paid",
      detail: [
        method ? ("Agreed payment method: " + method) : "Payment method not recorded.",
        outstandingPence > amount ? ("Booking balance due overall: " + moneyLabel(outstandingPence) + ".") : "",
      ].filter(Boolean).join(" "),
      scheduleKnown: true,
    };
  }

  // One-way with no schedule: the full outstanding is the collect amount.
  if (!hasReturnLeg(booking)) {
    return {
      kind: "collect",
      amountToCollectPence: outstandingPence,
      outstandingPence,
      paymentMethod: method,
      title: "Amount to collect on this leg: " + moneyLabel(outstandingPence),
      detail: method ? ("Agreed payment method: " + method) : "Payment method not recorded.",
      scheduleKnown: true,
    };
  }

  // Return booking without an explicit leg schedule — do not invent a split.
  return {
    kind: "office",
    amountToCollectPence: null,
    outstandingPence,
    paymentMethod: method,
    title: "Check with the office",
    detail: "This return booking has no agreed amount for this leg. Booking balance due overall: " +
      moneyLabel(outstandingPence) + ". You can still complete the journey.",
    scheduleKnown: false,
  };
}

/** An explicit allowlist: never send quote tokens, audit, ledger or other customer records. */
export function driverBooking(booking: Record<string, any>, driverId: string, bookingId: string): Record<string, any> {
  booking = { ...booking, ...(booking.acceptedServiceTerms || {}) };
  const legs = assignedLegs(booking, driverId);
  if (!legs.length) throw new Error("This trip is not assigned to this driver.");
  const output: Record<string, any> = { id: bookingId, assignedLegs: legs };
  const common = [
    "bookingNumber", "bookingType", "returnTrip", "openReturn", "status", "adminStatus", "revision",
    "hirerName", "hirerPhone", "vehicleType", "passengers", "luggage", "luggagePieces",
    "executiveAvailability", "waitingPolicyVersion", "paymentStatus", "paymentMethod",
    "amountReceivedPence", "outstandingPence", "actualFare", "additionalCharges", "timedHire",
    "dueOnOutbound", "dueOnReturn",
  ];
  const outbound = [
    "dateTime", "pickupTime", "pickupLocation", "pickup", "destination", "stops", "driverId", "vehicleId",
    "flightNumber", "terminal", "airportCollection", "collectionArrangement", "collectionLocationKind",
    "collectionLocation", "assistanceNote", "landingStatus", "verifiedLandingAt", "verifiedLandingSource",
    "outboundStatus", "outboundCompletedAt", "outboundDriverReadyAt", "outboundPassengerReadyAt",
    "outboundPassengerOnboardAt", "outboundDepartedAt", "outboundJobStartedAt", "outboundPaymentOutcome",
  ];
  const returning = [
    "returnDateTime", "returnPickupTime", "returnPickupLocation", "returnDestination", "returnStops",
    "returnDriverId", "returnVehicleId", "returnFlightNumber", "returnTerminal", "returnAirportCollection",
    "returnCollectionArrangement", "returnCollectionLocationKind", "returnCollectionLocation",
    "returnAssistanceNote", "returnLandingStatus", "returnVerifiedLandingAt", "returnVerifiedLandingSource",
    "returnStatus", "returnCompletedAt", "returnDriverReadyAt", "returnPassengerReadyAt",
    "returnPassengerOnboardAt", "returnDepartedAt", "returnJobStartedAt", "returnPaymentOutcome",
  ];
  for (const key of common.concat(legs.includes("outbound") ? outbound : [], legs.includes("return") ? returning : [])) {
    if (booking[key] !== undefined) output[key] = booking[key];
  }
  if (legs.includes("return") && !output.returnAssistanceNote && booking.assistanceNote) {
    output.returnAssistanceNote = booking.assistanceNote;
  }
  output.finalFarePence = agreedFarePence(booking);
  output.receivedPence = effectiveReceivedPence(booking);
  output.outstandingPence = Math.max(0, output.finalFarePence - output.receivedPence);
  for (const leg of legs) {
    output[leg + "ChargesFinalisedAt"] = booking[leg + "ChargesFinalisedAt"] || null;
    output[leg + "ExcludedMinutes"] = booking[leg + "ExcludedMinutes"] || 0;
    const summary = driverPaymentSummary(booking, leg as "outbound" | "return");
    output[leg + "PaymentSummary"] = summary;
    output[leg + "AmountToCollectPence"] = summary.amountToCollectPence;
    output[leg + "CollectUnknown"] = summary.kind === "office";
  }
  return output;
}

export function tripCharge(booking: Record<string, any>, leg: string): number {
  booking = { ...booking, ...(booking.acceptedServiceTerms || {}) };
  if (booking.timedHire) {
    return proposeTimedHireCharge({
      ...booking.timedHire,
      driverArrivedAt: booking[leg + "DriverReadyAt"],
      completedAt: booking[leg + "CompletedAt"],
      excludedMinutes: booking[leg + "ExcludedMinutes"],
    }).proposedPounds;
  }
  if (!(leg === "return" ? booking.returnAirportCollection : booking.airportCollection)) return 0;
  const prefix = leg === "return" ? "return" : "";
  const prop = (name: string) => booking[prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name];
  return proposeWaitingCharge({
    waitingPolicyVersion: booking.waitingPolicyVersion,
    collectionArrangement: prop("collectionArrangement"),
    collectionLocationKind: prop("collectionLocationKind"),
    landingStatus: prop("landingStatus"),
    verifiedLandingAt: prop("verifiedLandingAt"),
    bookedCollectionAt: leg === "return" ? booking.returnPickupTime || booking.returnDateTime : booking.pickupTime || booking.dateTime,
    driverReadyAt: booking[leg + "DriverReadyAt"],
    passengerReadyAt: booking[leg + "PassengerReadyAt"],
  }).proposedPounds;
}
