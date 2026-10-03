import { ShareBooking, ShareInterestGroup, ShareJourney, ShareWaitlist } from "./types";

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

export type NeedsActionItem = {
  id: string;
  kind: string;
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

export function gbp(pence: number): string {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

export function penceFromPounds(value: string | number): number {
  const n = typeof value === "number" ? value : Number(String(value).replace(/£/g, "").trim());
  if (!Number.isFinite(n) || n <= 0) return 0;
  return Math.round(n * 100);
}

export function poundsFromPence(pence: number): string {
  return ((pence || 0) / 100).toFixed(2);
}

export function formatUkDate(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1]}`;
}

export function formatUkDateShort(isoDate: string): string {
  if (!isoDate) return "";
  const parts = isoDate.split("-");
  if (parts.length !== 3) return isoDate;
  const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  return `${Number(parts[2])} ${months[Number(parts[1]) - 1]}`;
}

export function routeLabel(row: { originLabel?: string; originCity?: string; origin?: string; destinationLabel?: string; destinationCity?: string; destinationRegion?: string; venueName?: string; journeyType?: string }): string {
  const destination = row.journeyType === "EVENT" && row.venueName
    ? row.venueName
    : row.destinationLabel || row.destinationCity || row.destinationRegion || "Heathrow T3";
  return `${row.originLabel || row.originCity || row.origin || "Oxford"} → ${destination}`;
}

function eventTitle(row: { journeyType?: string; venueName?: string; eventName?: string; publicNumber?: string }): string {
  if (row.journeyType === "EVENT") return row.venueName || row.eventName || row.publicNumber || "Event";
  return "";
}

export function formatCountdown(deadlineAt?: string, now = Date.now()): string {
  if (!deadlineAt) return "not set";
  const ms = new Date(deadlineAt).getTime() - now;
  if (!Number.isFinite(ms)) return "not set";
  if (ms <= 0) return "closed";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;
  const secs = Math.floor((ms % 60000) / 1000);
  const pad = (n: number) => String(Math.max(0, n)).padStart(2, "0");
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ${pad(hours)} hrs ${pad(mins)} mins remaining`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)} remaining`;
}

export function isoToLocalInput(iso?: string): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

export function localInputToIso(value: string): string {
  if (!value) return "";
  const d = new Date(value);
  return Number.isNaN(d.getTime()) ? "" : d.toISOString();
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

export function humanInterestStatus(status: string, enough: boolean): string {
  if (status === "READY_FOR_REVIEW" || (enough && status === "GATHERING_INTEREST")) return "Ready to propose";
  if (status === "EXPIRED") return "Did not fill";
  if (status === "CANCELLED") return "Cancelled";
  if (status === "CONVERTED_TO_JOURNEY") return "Converted";
  return "Collecting interest";
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
  if (journey.paymentLinkUrl && journey.paymentStageStatus !== "OPEN") return "Ready to open payment";
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

export function boardingLabel(booking: ShareBooking): string {
  if (booking.reservationStatus === "CANCELLED" || booking.reservationStatus === "LATE_CANCELLED") return "Cancelled";
  if (booking.boardStatus === "NO_SHOW" || booking.reservationStatus === "NO_SHOW") return "No show";
  if (booking.boardStatus === "BOARDED" || booking.boardStatus === "CHECKED_IN") return "Verified";
  return "Waiting";
}

export function reservationLabel(status?: string): string {
  if (status === "PAID") return "Paid";
  if (status === "PAYMENT_PENDING") return "Payment pending";
  if (status === "PROVISIONAL") return "Provisional";
  if (status === "NO_SHOW") return "No show";
  if (status === "CANCELLED" || status === "LATE_CANCELLED") return "Cancelled";
  return status ? status.replace(/_/g, " ").toLowerCase() : "Provisional";
}

function remainingMs(deadlineAt?: string, now = Date.now()): number {
  if (!deadlineAt) return Number.POSITIVE_INFINITY;
  const ms = new Date(deadlineAt).getTime() - now;
  return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}

export function buildNeedsAction(input: {
  journeys: ShareJourney[];
  bookings: ShareBooking[];
  interestGroups: ShareInterestGroup[];
  waitlist: ShareWaitlist[];
  now?: number;
}): NeedsActionItem[] {
  const now = input.now || Date.now();
  const items: NeedsActionItem[] = [];
  const bookingsByJourney = new Map<string, ShareBooking[]>();
  for (const booking of input.bookings) {
    const list = bookingsByJourney.get(booking.journeyId) || [];
    list.push(booking);
    bookingsByJourney.set(booking.journeyId, list);
  }

  for (const group of input.interestGroups) {
    if (["CONVERTED_TO_JOURNEY", "CANCELLED", "EXPIRED"].includes(group.status)) continue;
    const required = group.minPassengerThreshold || 5;
    const interested = group.interestedSeatCount || 0;
    const enough = interested >= required;
    const route = routeLabel(group);
    const when = `${formatUkDate(group.travelDate)} · Around ${group.timeWindowStart || ""}`.trim();
    const title = eventTitle(group) || route;
    if (enough || group.status === "READY_FOR_REVIEW") {
      items.push({
        id: `propose-${group.id}`,
        kind: "ready_to_propose",
        priority: 60,
        title,
        route,
        when,
        detail: `${interested} / ${required} interested`,
        extra: "Ready to propose",
        countdownAt: group.interestDeadlineAt,
        primaryLabel: "Review and propose",
        target: { type: "interest", id: group.id },
      });
      continue;
    }
    const ms = remainingMs(group.interestDeadlineAt, now);
    if (group.journeyType === "EVENT" || (group.interestDeadlineAt && ms <= 6 * 60 * 60 * 1000)) {
      items.push({
        id: `interest-soon-${group.id}`,
        kind: "interest_deadline_soon",
        priority: group.journeyType === "EVENT" && ms > 6 * 60 * 60 * 1000 ? 90 : 70,
        title,
        route,
        when,
        detail: `${interested} / ${required} interested`,
        extra: `${Math.max(0, required - interested)} more passenger${required - interested === 1 ? "" : "s"} needed`,
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
    const journeyTitle = eventTitle(journey) || journey.publicNumber;
    const required = journey.capacity || 5;
    const { verified } = paidVerifiedSeats(bookings);
    const remainingPayments = Math.max(0, required - verified);
    const outstandingOffer = input.waitlist.some((row) => row.journeyId === journey.id && row.status === "OFFERED");
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
        countdownAt: input.waitlist.find((row) => row.journeyId === journey.id && row.status === "OFFERED")?.offerExpiresAt,
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
    const payMs = remainingMs(journey.paymentDeadlineAt, now);
    if (journey.paymentStageStatus === "OPEN" && payMs <= 0 && remainingPayments > 0) {
      items.push({
        id: `pay-expired-${journey.id}`,
        kind: "payment_expired",
        priority: 10,
        title: journeyTitle,
        route,
        when,
        detail: `Payments: ${verified} / ${required} verified`,
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
        detail: `Payments: ${verified} / ${required} verified`,
        extra: `${remainingPayments} payment${remainingPayments === 1 ? "" : "s"} remaining`,
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

export const PAYMENT_GUARANTEE =
  "A journey runs only after required passenger places are reached, required acceptances are complete, all required fares are paid, and Spires Taxis has verified those payments.";
