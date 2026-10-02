import { bookingHoldsSeat } from "./logic";
import {
  CustomerShareStage,
  InterestGroupStatus,
  JourneyStatus,
  ShareBooking,
  ShareConfig,
  ShareInterestGroup,
  ShareJourney,
} from "./types";

export const PAYMENT_GUARANTEE_NOTICE =
  "Your journey is only confirmed once all required passenger payments have been received and verified by Spires Taxis.";

export const TRAVEL_PLANS_NOTICE =
  "Please do not make travel plans on the assumption that registering interest or making an individual payment confirms the journey.";

export const INTEREST_DEADLINE_NOTICE =
  "Enough passengers need to register before this timer reaches zero. If the required number of passengers is not reached, the journey will not proceed to payment.";

export const NO_PAYMENT_AT_INTEREST_NOTICE = "No payment was taken.";

export const ENOUGH_INTEREST_NOTICE = "Payment requests can now be sent.";

export const ENOUGH_INTEREST_NOT_CONFIRMED_NOTICE =
  "Everyone must now pay before the journey can be confirmed.";

export const PAYMENT_WINDOW_NOT_OPEN_NOTICE =
  "Payment has not opened yet. Spires Taxis will send a payment request when the payment window is ready.";

export const SHARE_CUSTOMER_DASHBOARD_URL = "https://customer.spires-taxis.com/dashboard?share=1";
export const SHARE_ADMIN_DASHBOARD_URL = "https://spires-taxis.web.app";
export const SHARE_PUBLIC_BOARD_URL = "https://www.spires-taxis.com/share";

export type SeatProgress = {
  interested: number;
  required: number;
  remaining: number;
  enough: boolean;
  placesLabel: string;
  neededLabel: string;
  neededHeadline: string;
  detail: string;
  filledSlots: number;
  emptySlots: number;
};

export type PaymentProgress = {
  paidSeats: number;
  verifiedSeats: number;
  requiredSeats: number;
  remainingPayments: number;
  enoughPaid: boolean;
  enoughVerified: boolean;
  placesLabel: string;
  neededLabel: string;
  ownPaid: boolean;
  ownVerified: boolean;
};

export type ConfirmationGuardResult = {
  ok: boolean;
  paidRequiredSeats: number;
  verifiedRequiredSeats: number;
  requiredSeats: number;
  acceptancesOk: boolean;
};

export type CountdownView = {
  label: string;
  expired: boolean;
  remainingMs: number;
};

export function requiredSeatsForGroup(group: Pick<ShareInterestGroup, "minPassengerThreshold">, fallback = 5): number {
  const required = Number(group.minPassengerThreshold || fallback);
  return required > 0 ? required : fallback;
}

export function seatProgress(interested: number, required: number): SeatProgress {
  const need = Math.max(0, Number(required) || 0);
  const have = Math.max(0, Number(interested) || 0);
  const remaining = Math.max(0, need - have);
  const enough = need > 0 && have >= need;
  const placesLabel = `${Math.min(have, need || have)} of ${need || have} places interested`;
  const neededLabel =
    remaining === 1 ? "1 more passenger needed" : remaining > 1 ? `${remaining} more passengers needed` : "Enough interest received";
  const neededHeadline = remaining === 1 ? "1 MORE PASSENGER NEEDED" : remaining > 1 ? `${remaining} MORE PASSENGERS NEEDED` : "ENOUGH INTEREST RECEIVED";
  const detail = enough
    ? "Payment requests can now be sent."
    : `Once ${need} places are registered, Spires Taxis can open payment for this journey.`;
  return {
    interested: have,
    required: need,
    remaining,
    enough,
    placesLabel,
    neededLabel,
    neededHeadline,
    detail,
    filledSlots: need > 0 ? Math.min(have, need) : have,
    emptySlots: remaining,
  };
}

export function occupancyDots(filled: number, total: number): Array<"filled" | "empty"> {
  const capacity = Math.max(0, Number(total) || 0);
  const taken = Math.max(0, Number(filled) || 0);
  return Array.from({ length: capacity }, (_, index) => (index < taken ? "filled" : "empty"));
}

export function paymentProgress(
  bookings: Array<Pick<ShareBooking, "passengers" | "reservationStatus" | "hostedPaymentStatus" | "paymentSubmittedAt">>,
  requiredSeats: number,
  current?: Pick<ShareBooking, "reservationStatus" | "hostedPaymentStatus" | "paymentSubmittedAt">
): PaymentProgress {
  const holding = bookings.filter((row) => bookingHoldsSeat(row as ShareBooking));
  const paidSeats = paidPassengerPlacesLocal(holding);
  const verifiedSeats = verifiedPassengerPlaces(holding);
  const remainingPayments = Math.max(0, requiredSeats - verifiedSeats);
  const ownVerified = Boolean(current && isVerifiedPayment(current));
  const ownPaid = Boolean(current && (ownVerified || current.reservationStatus === "PAID" || current.hostedPaymentStatus === "PAID"));
  return {
    paidSeats,
    verifiedSeats,
    requiredSeats,
    remainingPayments,
    enoughPaid: requiredSeats > 0 && paidSeats >= requiredSeats,
    enoughVerified: requiredSeats > 0 && verifiedSeats >= requiredSeats,
    placesLabel: `${verifiedSeats} of ${requiredSeats} passengers paid`,
    neededLabel:
      remainingPayments === 1 ? "1 payment still needed" : remainingPayments > 1 ? `${remainingPayments} payments still needed` : "All required payments received",
    ownPaid,
    ownVerified,
  };
}

function paidPassengerPlacesLocal(
  bookings: Array<Pick<ShareBooking, "passengers" | "reservationStatus" | "hostedPaymentStatus">>
): number {
  return bookings
    .filter((row) => row.reservationStatus === "PAID" || row.hostedPaymentStatus === "PAID")
    .reduce((sum, row) => sum + (row.passengers || 0), 0);
}

export function isVerifiedPayment(
  booking: Pick<ShareBooking, "reservationStatus" | "hostedPaymentStatus">
): boolean {
  return booking.reservationStatus === "PAID" && (booking.hostedPaymentStatus === "PAID" || !booking.hostedPaymentStatus);
}

export function verifiedPassengerPlaces(
  bookings: Array<Pick<ShareBooking, "passengers" | "reservationStatus" | "hostedPaymentStatus">>
): number {
  return bookings.filter(isVerifiedPayment).reduce((sum, row) => sum + (row.passengers || 0), 0);
}

export function confirmationGuard(
  bookings: ShareBooking[],
  journey: Pick<ShareJourney, "capacity" | "status" | "locked">,
  config: Pick<ShareConfig, "earlyDepartureThreshold">
): ConfirmationGuardResult {
  const requiredSeats = journey.capacity;
  const holding = bookings.filter((row) => bookingHoldsSeat(row));
  const paidRequiredSeats = paidPassengerPlacesLocal(holding);
  const verifiedRequiredSeats = verifiedPassengerPlaces(holding);
  const occupied = holding.reduce((sum, row) => sum + (row.passengers || 0), 0);
  const allHoldingVerified = holding.length > 0 && holding.every(isVerifiedPayment);
  const fiveOk =
    occupied >= requiredSeats &&
    paidRequiredSeats >= requiredSeats &&
    verifiedRequiredSeats >= requiredSeats &&
    allHoldingVerified;
  const threshold = config.earlyDepartureThreshold || 4;
  const accepted = holding.filter((row) => row.fourPassengerAccepted).reduce((sum, row) => sum + row.passengers, 0);
  const supplementsPaid = holding
    .filter((row) => (row.supplementPaidPence || 0) >= 875 * row.passengers)
    .reduce((sum, row) => sum + row.passengers, 0);
  const fourOk =
    occupied === threshold &&
    paidRequiredSeats === threshold &&
    verifiedRequiredSeats === threshold &&
    accepted === threshold &&
    supplementsPaid === threshold;
  return {
    ok: fiveOk || fourOk,
    paidRequiredSeats,
    verifiedRequiredSeats,
    requiredSeats,
    acceptancesOk: fiveOk || fourOk,
  };
}

export function remainingMs(deadlineAt: string | undefined, nowIso: string): number {
  if (!deadlineAt) return 0;
  const ms = new Date(deadlineAt).getTime() - new Date(nowIso).getTime();
  return Number.isFinite(ms) ? Math.max(0, ms) : 0;
}

export function formatCountdown(deadlineAt: string | undefined, nowIso: string): CountdownView {
  if (!deadlineAt) return { label: "No deadline set", expired: false, remainingMs: 0 };
  const ms = new Date(deadlineAt).getTime() - new Date(nowIso).getTime();
  if (!Number.isFinite(ms)) return { label: "No deadline set", expired: false, remainingMs: 0 };
  if (ms <= 0) return { label: "Closed", expired: true, remainingMs: 0 };
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;
  const secs = Math.floor((ms % 60000) / 1000);
  if (days >= 1) {
    return {
      label: `${days} day${days === 1 ? "" : "s"} ${pad2(hours)} hrs ${pad2(mins)} mins`,
      expired: false,
      remainingMs: ms,
    };
  }
  return {
    label: `${pad2(hours)}:${pad2(mins)}:${pad2(secs)}`,
    expired: false,
    remainingMs: ms,
  };
}

function pad2(value: number): string {
  return String(Math.max(0, value)).padStart(2, "0");
}

export function customerStageLabel(stage: CustomerShareStage): string {
  switch (stage) {
    case "REGISTERING_INTEREST":
      return "Registering interest";
    case "ENOUGH_INTEREST":
      return "Enough interest received";
    case "PAYMENT_REQUIRED":
      return "Payment required";
    case "AWAITING_ALL_PAYMENTS":
      return "Awaiting all payments";
    case "JOURNEY_CONFIRMED":
      return "Journey confirmed";
    case "NOT_ENOUGH_INTEREST":
      return "Not enough interest";
    case "EXPIRED":
      return "Expired";
    case "CANCELLED":
      return "Cancelled";
    case "COMPLETED":
      return "Completed";
  }
}

export function interestCustomerStage(group: Pick<ShareInterestGroup, "status" | "interestedSeatCount" | "minPassengerThreshold">): CustomerShareStage {
  if (group.status === "EXPIRED") return "NOT_ENOUGH_INTEREST";
  if (group.status === "CANCELLED") return "CANCELLED";
  if (group.status === "READY_FOR_REVIEW" || group.status === "CONVERTED_TO_JOURNEY") return "ENOUGH_INTEREST";
  const progress = seatProgress(group.interestedSeatCount, requiredSeatsForGroup(group));
  return progress.enough ? "ENOUGH_INTEREST" : "REGISTERING_INTEREST";
}

export function bookingCustomerStage(
  journey: Pick<ShareJourney, "status" | "paymentStageStatus">,
  booking: Pick<ShareBooking, "reservationStatus" | "hostedPaymentStatus">
): CustomerShareStage {
  if (journey.status === "CONFIRMED") return "JOURNEY_CONFIRMED";
  if (journey.status === "CANCELLED") return "CANCELLED";
  if (journey.status === "COMPLETED") return "COMPLETED";
  if (journey.status === "EXPIRED") return "EXPIRED";
  const verified = isVerifiedPayment(booking);
  if (journey.paymentStageStatus === "OPEN") {
    if (verified || booking.reservationStatus === "PAID") return "AWAITING_ALL_PAYMENTS";
    return "PAYMENT_REQUIRED";
  }
  if (journey.status === "READY_FOR_PAYMENT_SETUP" || journey.status === "PROPOSED") return "ENOUGH_INTEREST";
  return "REGISTERING_INTEREST";
}

export function paymentWindowMayOpen(group: Pick<ShareInterestGroup, "status" | "interestedSeatCount" | "minPassengerThreshold">): boolean {
  if (group.status === "EXPIRED" || group.status === "CANCELLED") return false;
  return seatProgress(group.interestedSeatCount, requiredSeatsForGroup(group)).enough;
}

export function notificationDedupeKey(parts: Array<string | number | undefined | null>): string {
  return parts.map((part) => String(part || "")).join(":");
}

export function recordShareNotification(
  notifications: Array<Record<string, unknown>>,
  payload: Record<string, unknown> & { deduplicationKey: string }
): boolean {
  if (notifications.some((row) => row.deduplicationKey === payload.deduplicationKey)) return false;
  notifications.push({
    status: "DRY_RUN",
    createdAt: new Date().toISOString(),
    ...payload,
  });
  return true;
}

export function firstNameFrom(name: string | undefined): string {
  const token = String(name || "")
    .trim()
    .split(/\s+/)[0];
  return token || "there";
}

export function morePassengersNeededCopy(remaining: number): string {
  if (remaining === 1) return "1 more passenger is needed before payment can be requested.";
  if (remaining > 1) return `${remaining} more passengers are needed before payment can be requested.`;
  return "Enough passengers have registered. Payment requests can now be sent.";
}

export function publicInterestSafeFields(group: ShareInterestGroup) {
  const required = requiredSeatsForGroup(group);
  const progress = seatProgress(group.interestedSeatCount, required);
  const stage = interestCustomerStage(group);
  return {
    requiredSeats: required,
    remainingSeatsNeeded: progress.remaining,
    enoughInterest: progress.enough,
    interestDeadlineAt: group.interestDeadlineAt,
    customerStage: stage,
    customerStageLabel: customerStageLabel(stage),
    placesLabel: progress.placesLabel,
    neededLabel: progress.neededLabel,
    neededHeadline: progress.neededHeadline,
    preferredDepartureTime: group.preferredDepartureTime || "",
  };
}

export function adminInterestCounters(group: ShareInterestGroup) {
  const progress = seatProgress(group.interestedSeatCount, requiredSeatsForGroup(group));
  return {
    ...progress,
    paymentOpen: false,
    paymentNotOpen: group.status === "READY_FOR_REVIEW",
    confirmed: false,
  };
}

export function adminJourneyPaymentCounters(
  journey: Pick<ShareJourney, "capacity" | "status" | "paymentStageStatus" | "paymentDeadlineAt" | "paymentLinkUrl">,
  bookings: ShareBooking[]
) {
  const progress = paymentProgress(bookings, journey.capacity);
  return {
    ...progress,
    paymentOpen: journey.paymentStageStatus === "OPEN",
    paymentNotOpen: journey.paymentStageStatus !== "OPEN" && journey.status !== "CONFIRMED",
    hasPaymentLink: Boolean(journey.paymentLinkUrl),
    confirmed: journey.status === "CONFIRMED",
    paymentDeadlineAt: journey.paymentDeadlineAt,
  };
}

export function materialDeadlineChange(previousIso: string | undefined, nextIso: string, minimumMinutes = 5): boolean {
  if (!previousIso) return true;
  const delta = Math.abs(new Date(nextIso).getTime() - new Date(previousIso).getTime());
  return delta >= minimumMinutes * 60 * 1000;
}

export function reminderDue(
  deadlineAt: string | undefined,
  nowIso: string,
  minutesBefore: number,
  alreadySentAt?: string,
  quietNow?: boolean
): boolean {
  if (!deadlineAt || alreadySentAt || quietNow) return false;
  const remaining = remainingMs(deadlineAt, nowIso);
  const windowMs = minutesBefore * 60 * 1000;
  return remaining > 0 && remaining <= windowMs;
}

export function customerPaymentViewSafe(view: Record<string, unknown>): boolean {
  const json = JSON.stringify(view);
  return !["name", "email", "mobile", "uid", "intendedDestinationText"].some((key) => json.includes(`"${key}":`));
}

export function isTerminalInterestStatus(status: InterestGroupStatus): boolean {
  return status === "EXPIRED" || status === "CANCELLED" || status === "CONVERTED_TO_JOURNEY";
}

export function isTerminalJourneyStatus(status: JourneyStatus): boolean {
  return status === "EXPIRED" || status === "CANCELLED" || status === "COMPLETED" || status === "CONFIRMED";
}

export type OwnPaymentState = "REQUIRED" | "SUBMITTED" | "RECEIVED";

export function ownPaymentState(
  booking: Pick<ShareBooking, "reservationStatus" | "hostedPaymentStatus" | "paymentSubmittedAt">
): OwnPaymentState {
  if (isVerifiedPayment(booking)) return "RECEIVED";
  if (booking.paymentSubmittedAt) return "SUBMITTED";
  return "REQUIRED";
}
