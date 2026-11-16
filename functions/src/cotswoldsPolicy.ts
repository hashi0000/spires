import policy from "./servicePolicy.json";
import { londonWallTimeToUtcMs } from "./terms/bookingTerms";
export const COTSWOLDS_POLICY = policy.cotswolds;
export function cotswoldsRequest(input: Record<string, unknown>, startAt: string, vehicle: string, now: number): { ok: true; fields: Record<string, unknown> } | { ok: false; error: string } {
  if (input.journeyType !== "cotswolds") return { ok: true, fields: {} };
  if (input.bookingType === 'return') return { ok: false, error: "A Cotswolds hire is one timed itinerary. Include the return to Oxford in the itinerary and final drop off, rather than a separate return leg." };
  const hours = Number(input.hireHours);
  const index = COTSWOLDS_POLICY.durationsHours.indexOf(hours);
  if (index < 0) return { ok: false, error: "Choose four, six or eight hours for your Cotswolds trip." };
  const itinerary = String(input.hireItinerary || "").trim().slice(0, 2000);
  if (!itinerary) return { ok: false, error: "Tell us the places you would like to visit and your final drop off." };
  if (input.timedHireAccepted !== true && input.timedHireAccepted !== "yes") return { ok: false, error: "Please acknowledge the total hire duration and additional time charges." };
  const prices = COTSWOLDS_POLICY.prices[vehicle as keyof typeof COTSWOLDS_POLICY.prices];
  if (!prices) return { ok: false, error: "Choose a valid vehicle." };
  const start = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(startAt) ? londonWallTimeToUtcMs(startAt) : Date.parse(startAt);
  if (start == null || !Number.isFinite(start)) return { ok: false, error: "Enter a valid pickup time." };
  return { ok: true, fields: { journeyType: "cotswolds", proposedFarePounds: prices[index], timedHire: {
    policyVersion: policy.version, startAt: new Date(start).toISOString(), includedMinutes: hours * 60, itinerary,
    extraRatePounds: COTSWOLDS_POLICY.extraRatePounds, extraIntervalMinutes: COTSWOLDS_POLICY.extraIntervalMinutes,
    acceptedAt: new Date(now).toISOString(),
  } } };
}
