import { paymentProgress, seatProgress } from "./shareProgress";
import { ShareBooking, ShareInterestGroup, ShareJourney } from "./types";

export type OperatorStage =
  | "Collecting interest"
  | "Ready to propose"
  | "Waiting for acceptances"
  | "Add payment link"
  | "Ready to open payment"
  | "Collecting payment"
  | "Ready to confirm"
  | "Confirmed"
  | "Did not fill"
  | "Cancelled"
  | "Completed";

export type NeedsActionKind =
  | "payment_deadline_soon"
  | "waitlist_offer"
  | "payment_expired"
  | "ready_to_confirm"
  | "ready_to_open_payment"
  | "add_payment_link"
  | "ready_to_propose"
  | "interest_deadline_soon"
  | "collecting_payment";

export type NeedsActionItem = {
  id: string;
  kind: NeedsActionKind;
  priority: number;
  title: string;
  route: string;
  when: string;
  detail: string;
  extra?: string;
  countdownAt?: string;
  countdownLabel?: string;
  primaryLabel: string;
  target: { type: "interest" | "journey"; id: string };
  urgency?: "soon" | "now";
};

function pounds(pence: number): string {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

export function poundsFromPence(pence: number): string {
  return pounds(pence);
}

export function penceFromPounds(poundsValue: string | number): number {
  const n = typeof poundsValue === "number" ? poundsValue : Number(String(poundsValue).replace(/£/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function formatUkDate(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  const month = months[Number(parts[1]) - 1];
  return `${Number(parts[2])} ${month}`;
}

export function formatUkDateShort(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1]}`;
}

export function routeLabel(row: { originLabel?: string; originCity?: string; origin?: string; destinationLabel?: string; destinationCity?: string; destinationRegion?: string; venueName?: string; journeyType?: string }): string {
  const origin = row.originLabel || row.originCity || row.origin || "Oxford";
  const destination = row.venueName && row.journeyType === "EVENT"
    ? row.venueName
    : row.destinationLabel || row.destinationCity || row.destinationRegion || "Heathrow T3";
  return `${origin} → ${destination}`;
}

function eventNeedsTitle(row: { journeyType?: string; venueName?: string; eventName?: string; publicNumber?: string }): string {
  if (row.journeyType === "EVENT") return row.venueName || row.eventName || row.publicNumber || "Event";
  return "";
}

export function humanInterestStatus(status: string, enough: boolean): OperatorStage | "Collecting interest" | "Ready to propose" {
  if (status === "READY_FOR_REVIEW" || (enough && (status === "GATHERING_INTEREST" || status === "READY_FOR_REVIEW"))) {
    return "Ready to propose";
  }
  if (status === "EXPIRED") return "Did not fill";
  if (status === "CANCELLED") return "Cancelled";
  return "Collecting interest";
}

export function paidVerifiedSeats(bookings: ShareBooking[]): { paid: number; verified: number } {
  let paid = 0;
  let verified = 0;
  for (const booking of bookings) {
    const seats = booking.passengers || 0;
    if (booking.reservationStatus === "PAID" || booking.hostedPaymentStatus === "PAID") paid += seats;
    if (booking.reservationStatus === "PAID") verified += seats;
  }
  return { paid, verified };
}

export function humanJourneyStage(journey: ShareJourney, bookings: ShareBooking[]): OperatorStage {
  const status = journey.status;
  if (status === "CONFIRMED") return "Confirmed";
  if (status === "COMPLETED") return "Completed";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "EXPIRED") return "Did not fill";
  const required = journey.minPassengerThreshold || journey.capacity || 5;
  const { verified } = paidVerifiedSeats(bookings);
  if (verified >= required && required > 0) return "Ready to confirm";
  if (journey.paymentStageStatus === "OPEN" || status === "PAYMENT_WINDOW_OPEN") return "Collecting payment";
  if (journey.paymentLinkUrl) return "Ready to open payment";
  const occupied = journey.occupiedSeats || 0;
  if (occupied >= required && !journey.paymentLinkUrl) {
    if (status === "PROPOSED" || status === "AWAITING_DROPOFF_ACCEPTANCE") return "Waiting for acceptances";
    return "Add payment link";
  }
  if (status === "PROPOSED" || status === "AWAITING_DROPOFF_SELECTION" || status === "AWAITING_DROPOFF_ACCEPTANCE") {
    return "Waiting for acceptances";
  }
  if (status === "READY_FOR_PAYMENT_SETUP") return journey.paymentLinkUrl ? "Ready to open payment" : "Add payment link";
  return "Collecting interest";
}

export function journeyListSafeFields(journey: ShareJourney): string[] {
  return [
    "id",
    "publicNumber",
    "originLabel",
    "destinationLabel",
    "travelDate",
    "departureTime",
    "status",
    "capacity",
    "occupiedSeats",
    "customerVisible",
  ];
}

export function listContainsPii(row: Record<string, unknown>): boolean {
  return ["email", "mobile", "paymentLinkUrl", "boardingCode", "adminNotes"].some((key) => key in row && Boolean(row[key]));
}

function remainingMs(deadlineAt?: string, nowIso?: string): number {
  if (!deadlineAt) return Number.POSITIVE_INFINITY;
  const ms = new Date(deadlineAt).getTime() - new Date(nowIso || Date.now()).getTime();
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function buildNeedsAction(input: {
  journeys: ShareJourney[];
  bookings: ShareBooking[];
  interestGroups: ShareInterestGroup[];
  waitlist?: Array<{ journeyId: string; status: string; offerExpiresAt?: string }>;
  nowIso?: string;
}): NeedsActionItem[] {
  const nowIso = input.nowIso || new Date().toISOString();
  const items: NeedsActionItem[] = [];
  const bookingsByJourney = new Map<string, ShareBooking[]>();
  for (const booking of input.bookings) {
    const list = bookingsByJourney.get(booking.journeyId) || [];
    list.push(booking);
    bookingsByJourney.set(booking.journeyId, list);
  }

  for (const group of input.interestGroups) {
    if (group.status === "CONVERTED_TO_JOURNEY" || group.status === "CANCELLED" || group.status === "EXPIRED") continue;
    const required = group.minPassengerThreshold || 5;
    const progress = seatProgress(group.interestedSeatCount || 0, required);
    const route = routeLabel(group);
    const when = `${formatUkDate(group.travelDate)} · Around ${group.timeWindowStart || ""}`.trim();
    const title = eventNeedsTitle(group) || route;
    if (progress.enough || group.status === "READY_FOR_REVIEW") {
      items.push({
        id: `propose-${group.id}`,
        kind: "ready_to_propose",
        priority: 60,
        title,
        route,
        when,
        detail: `${progress.placesLabel} interested`,
        extra: group.journeyType === "EVENT" ? "Ready to propose" : "Ready to propose journey",
        countdownAt: group.interestDeadlineAt,
        primaryLabel: "Review and propose",
        target: { type: "interest", id: group.id },
      });
      continue;
    }
    const ms = remainingMs(group.interestDeadlineAt, nowIso);
    if (group.journeyType === "EVENT" || (group.interestDeadlineAt && ms <= 6 * 60 * 60 * 1000)) {
      items.push({
        id: `interest-soon-${group.id}`,
        kind: "interest_deadline_soon",
        priority: group.journeyType === "EVENT" && ms > 6 * 60 * 60 * 1000 ? 90 : 70,
        title,
        route,
        when,
        detail: `${progress.placesLabel} interested`,
        extra: progress.neededLabel,
        countdownAt: group.interestDeadlineAt,
        countdownLabel: "Registration closes in",
        primaryLabel: "View",
        target: { type: "interest", id: group.id },
        urgency: ms <= 60 * 60 * 1000 ? "now" : ms <= 6 * 60 * 60 * 1000 ? "soon" : undefined,
      });
    }
  }

  for (const journey of input.journeys) {
    if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(journey.status)) continue;
    const bookings = bookingsByJourney.get(journey.id) || [];
    const stage = humanJourneyStage(journey, bookings);
    const route = routeLabel(journey);
    const when = `${formatUkDate(journey.travelDate)} · ${journey.departureTime}`;
    const pay = paymentProgress(bookings, journey.capacity);
    const journeyTitle = eventNeedsTitle(journey) || journey.publicNumber;
    const outstandingOffer = (input.waitlist || []).some((row) => row.journeyId === journey.id && row.status === "OFFERED");

    if (outstandingOffer) {
      items.push({
        id: `waitlist-${journey.id}`,
        kind: "waitlist_offer",
        priority: 15,
        title: journeyTitle,
        route,
        when,
        detail: "Waitlist offer outstanding",
        primaryLabel: "Open journey",
        target: { type: "journey", id: journey.id },
        urgency: "now",
        countdownAt: (input.waitlist || []).find((row) => row.journeyId === journey.id && row.status === "OFFERED")?.offerExpiresAt,
        countdownLabel: "Offer expires in",
      });
    }

    if (stage === "Ready to confirm") {
      items.push({
        id: `confirm-${journey.id}`,
        kind: "ready_to_confirm",
        priority: 20,
        title: journeyTitle,
        route,
        when,
        detail: "All required payments verified",
        extra: "Ready to confirm",
        primaryLabel: "Open journey",
        target: { type: "journey", id: journey.id },
      });
      continue;
    }

    const payMs = remainingMs(journey.paymentDeadlineAt, nowIso);
    if (journey.paymentStageStatus === "OPEN" && payMs <= 0 && pay.remainingPayments > 0) {
      items.push({
        id: `pay-expired-${journey.id}`,
        kind: "payment_expired",
        priority: 10,
        title: journeyTitle,
        route,
        when,
        detail: `Payments: ${pay.placesLabel} verified`,
        extra: "Payment deadline expired",
        primaryLabel: "Open journey",
        target: { type: "journey", id: journey.id },
        urgency: "now",
      });
      continue;
    }

    if (stage === "Collecting payment") {
      const soon = payMs <= 2 * 60 * 60 * 1000;
      items.push({
        id: `pay-${journey.id}`,
        kind: soon ? "payment_deadline_soon" : "collecting_payment",
        priority: soon ? 12 : 80,
        title: journeyTitle,
        route,
        when,
        detail: `Payments: ${pay.placesLabel} verified`,
        extra: pay.neededLabel,
        countdownAt: journey.paymentDeadlineAt,
        countdownLabel: "Payment closes in",
        primaryLabel: "Open journey",
        target: { type: "journey", id: journey.id },
        urgency: soon ? "soon" : undefined,
      });
      continue;
    }

    if (stage === "Ready to open payment") {
      items.push({
        id: `open-pay-${journey.id}`,
        kind: "ready_to_open_payment",
        priority: 40,
        title: journeyTitle,
        route,
        when,
        detail: "Payment link added",
        extra: "Ready to open payment",
        primaryLabel: "Open journey",
        target: { type: "journey", id: journey.id },
      });
      continue;
    }

    if (stage === "Add payment link") {
      items.push({
        id: `add-link-${journey.id}`,
        kind: "add_payment_link",
        priority: 50,
        title: journeyTitle,
        route,
        when,
        detail: `${journey.occupiedSeats} / ${journey.capacity} interested`,
        extra: "Add payment link",
        primaryLabel: "Open journey",
        target: { type: "journey", id: journey.id },
      });
    }
  }

  return items.sort((a, b) => a.priority - b.priority || a.title.localeCompare(b.title));
}
