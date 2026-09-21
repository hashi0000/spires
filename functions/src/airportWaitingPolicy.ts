/** Central airport collection waiting policy. Change here, not in PDF copy. */
export const AIRPORT_WAITING_POLICY = {
  complimentaryAirportWaitingMinutes: 50,
  airportWaitingChargePer15Minutes: 5,
} as const;

export type AirportWaitingPolicy = {
  complimentaryAirportWaitingMinutes: number;
  airportWaitingChargePer15Minutes: number;
};

export function airportWaitingDisclaimerTitle(): string {
  return "Airport Collection & Waiting Time";
}

export function airportWaitingDisclaimerBody(
  policy: AirportWaitingPolicy = AIRPORT_WAITING_POLICY
): string {
  const minutes = policy.complimentaryAirportWaitingMinutes;
  const charge = policy.airportWaitingChargePer15Minutes;
  return [
    `Airport collections include flight tracking and up to ${minutes} minutes of complimentary waiting time from the actual flight landing time. If your flight is delayed, the complimentary waiting period will begin from the actual landing time rather than the originally scheduled arrival time.`,
    `After the complimentary ${minutes} minute period, additional waiting time is charged at £${charge} per 15 minutes. Any additional airport parking charges incurred due to extended waiting may also be added to the final fare.`,
  ].join("\n\n");
}

export function bookingHasAirportCollection(booking: {
  airportCollection?: boolean;
  returnAirportCollection?: boolean;
} | null | undefined): boolean {
  if (!booking) return false;
  return booking.airportCollection === true || booking.returnAirportCollection === true;
}

export function isReturnBooking(booking: {
  bookingType?: string;
  returnPickupLocation?: string;
  returnDestination?: string;
} | null | undefined): boolean {
  if (!booking) return false;
  if (booking.bookingType === "return") return true;
  return Boolean((booking.returnPickupLocation || "").trim() && (booking.returnDestination || "").trim());
}
