import { agreedFarePence, effectiveReceivedPence } from "./paymentAmount";
import { proposeTimedHireCharge } from "./timedHire";
import { proposeWaitingCharge } from "./airportWaitingPolicy";

export function assignedLegs(booking: Record<string, any>, driverId: string): string[] {
  return [booking.driverId === driverId ? "outbound" : "", booking.returnDriverId === driverId ? "return" : ""].filter(Boolean);
}

/** An explicit allowlist: never send quote tokens, audit, ledger or other customer records. */
export function driverBooking(booking: Record<string, any>, driverId: string, bookingId: string): Record<string, any> {
  booking = { ...booking, ...(booking.acceptedServiceTerms || {}) };
  const legs = assignedLegs(booking, driverId);
  if (!legs.length) throw new Error("This trip is not assigned to this driver.");
  const output: Record<string, any> = { id: bookingId, assignedLegs: legs };
  const common = ["bookingNumber", "bookingType", "returnTrip", "openReturn", "status", "adminStatus", "revision", "hirerName", "hirerPhone", "vehicleType", "passengers", "luggage", "luggagePieces", "executiveAvailability", "waitingPolicyVersion", "paymentStatus", "amountReceivedPence", "outstandingPence", "actualFare", "additionalCharges", "timedHire"];
  const outbound = ["dateTime", "pickupTime", "pickupLocation", "pickup", "destination", "stops", "driverId", "vehicleId", "flightNumber", "terminal", "airportCollection", "collectionArrangement", "collectionLocationKind", "collectionLocation", "assistanceNote", "landingStatus", "verifiedLandingAt", "verifiedLandingSource", "outboundStatus", "outboundCompletedAt", "outboundDriverReadyAt", "outboundPassengerReadyAt", "outboundPassengerOnboardAt", "outboundDepartedAt"];
  const returning = ["returnDateTime", "returnPickupTime", "returnPickupLocation", "returnDestination", "returnStops", "returnDriverId", "returnVehicleId", "returnFlightNumber", "returnTerminal", "returnAirportCollection", "returnCollectionArrangement", "returnCollectionLocationKind", "returnCollectionLocation", "returnAssistanceNote", "returnLandingStatus", "returnVerifiedLandingAt", "returnVerifiedLandingSource", "returnStatus", "returnCompletedAt", "returnDriverReadyAt", "returnPassengerReadyAt", "returnPassengerOnboardAt", "returnDepartedAt"];
  for (const key of common.concat(legs.includes("outbound") ? outbound : [], legs.includes("return") ? returning : [])) {
    if (booking[key] !== undefined) output[key] = booking[key];
  }
  if (legs.includes('return') && !output.returnAssistanceNote && booking.assistanceNote) output.returnAssistanceNote = booking.assistanceNote;
  output.finalFarePence = agreedFarePence(booking);
  for (const leg of legs) {
    output[leg + "ChargesFinalisedAt"] = booking[leg + "ChargesFinalisedAt"] || null;
    output[leg + "ExcludedMinutes"] = booking[leg + "ExcludedMinutes"] || 0;
  }
  for (const leg of legs) {
    const key = leg === 'return' ? 'dueOnReturn' : 'dueOnOutbound';
    if (booking[key] !== undefined && booking[key] !== '') output[key] = booking[key];
    const balance = Math.max(0, agreedFarePence(booking) - effectiveReceivedPence(booking));
    const schedule = booking[key];
    const legExtras = (booking.additionalCharges || []).filter((row: any) => row.leg === leg || row.id === 'trip-time-' + leg).reduce((sum: number,row: any) => sum + Math.max(0, Number(row.amountPence)||0),0);
    const legReceived = (booking.paymentEntries || []).filter((row: any) => row.leg === leg && row.mode === 'add').reduce((sum: number,row: any) => sum + Math.max(0,Number(row.amountPence)||0),0);
    output[leg+'AmountToCollectPence'] = schedule != null && schedule !== '' && Number.isFinite(Number(schedule)) ? Math.min(balance,Math.max(0,Math.round(Number(schedule)*100)+legExtras-legReceived)) : balance;
  }
  return output;
}

export function tripCharge(booking: Record<string, any>, leg: string): number {
  booking = { ...booking, ...(booking.acceptedServiceTerms || {}) };
  if (booking.timedHire) {
    return proposeTimedHireCharge({ ...booking.timedHire, driverArrivedAt: booking[leg + "DriverReadyAt"],
      completedAt: booking[leg + "CompletedAt"], excludedMinutes: booking[leg + "ExcludedMinutes"] }).proposedPounds;
  }
  if (!(leg === "return" ? booking.returnAirportCollection : booking.airportCollection)) return 0;
  const prefix = leg === "return" ? "return" : "";
  const prop = (name: string) => booking[prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name];
  return proposeWaitingCharge({ waitingPolicyVersion: booking.waitingPolicyVersion,
    collectionArrangement: prop("collectionArrangement"), collectionLocationKind: prop("collectionLocationKind"),
    landingStatus: prop("landingStatus"), verifiedLandingAt: prop("verifiedLandingAt"),
    bookedCollectionAt: leg === "return" ? booking.returnPickupTime || booking.returnDateTime : booking.pickupTime || booking.dateTime,
    driverReadyAt: booking[leg + "DriverReadyAt"], passengerReadyAt: booking[leg + "PassengerReadyAt"] }).proposedPounds;
}
