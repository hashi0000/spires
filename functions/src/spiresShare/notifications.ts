import { NotificationType, ShareBooking, ShareJourney, STRICT_DEPARTURE_NOTICE, UNCONFIRMED_WARNING, FLIGHT_DISCLAIMER, FILL_NOTICE, INTEREST_NOTICE, CONFIRMED_NOTICE } from "./types";
import { ShareConfig } from "./types";
import { penceToGbp } from "./logic";
import { formatLondonDateTime } from "./paymentDeadline";
import { FOUR_PASSENGER_FARE_PENCE, SUPPLEMENT_PENCE } from "./hostedPayment";

export type NotificationDraft = {
  type: NotificationType;
  to: string;
  subject: string;
  text: string;
  html?: string;
  journeyId?: string;
  bookingId?: string;
  dryRun: boolean;
};

export type NotificationExtra = {
  farePence?: number;
  manageHint?: string;
  proposedFarePence?: number;
  amountPence?: number;
  passengers?: number;
  paymentDeadlineAt?: string;
  paymentUrl?: string;
  dashboardHint?: string;
  offerMinutes?: number;
};

export function shareNotificationsEnabled(config: ShareConfig): boolean {
  return config.notificationsSend === true && String(process.env.SHARE_NOTIFICATIONS_SEND || "false").toLowerCase() === "true";
}

function journeyLine(journey: Pick<ShareJourney, "publicNumber" | "travelDate" | "departureTime" | "originLabel" | "departureLocation" | "destinationLabel"> | null): string {
  if (!journey) return "Your Spires Share booking";
  const origin = journey.departureLocation || journey.originLabel || "the departure location";
  const destination = journey.destinationLabel || "the shared destination";
  return `${origin} to ${destination}. Departure ${journey.publicNumber} on ${journey.travelDate} at ${journey.departureTime}`;
}

export function buildNotification(
  type: NotificationType,
  to: string,
  journey: Pick<ShareJourney, "publicNumber" | "travelDate" | "departureTime"> | null,
  extra: NotificationExtra = {}
): Omit<NotificationDraft, "dryRun"> {
  const ref = journeyLine(journey);
  const amount = extra.amountPence != null ? penceToGbp(extra.amountPence) : extra.farePence != null ? penceToGbp(extra.farePence) : "£35.00";
  const pax = extra.passengers || 1;
  const deadline = extra.paymentDeadlineAt ? formatLondonDateTime(extra.paymentDeadlineAt) : "the payment deadline";
  const payLine = extra.paymentUrl
    ? `Pay securely using the hosted payment page: ${extra.paymentUrl}`
    : "Open your Spires Share dashboard while signed in to pay.";
  const fourReminder =
    "If five passengers travel, the fare is £35 per passenger. If only four passengers are available, you may be offered the option to proceed for an additional £8.75 per passenger, bringing the total fare to £43.75 per passenger. You will never be charged the additional amount without agreeing to proceed.";

  const templates: Record<NotificationType, { subject: string; text: string }> = {
    BOOKING_RECEIVED: {
      subject: "Spires Share Pilot: interest registered (provisional place)",
      text: `${ref}. ${INTEREST_NOTICE} ${UNCONFIRMED_WARNING} This is not a confirmed airport transfer.`,
    },
    JOURNEY_FILLING: {
      subject: "Spires Share Pilot: more passengers have registered interest",
      text: `${ref} now has more places reserved. Your place is still provisional until payment is completed and the journey is confirmed.`,
    },
    JOURNEY_CONFIRMED: {
      subject: "Spires Share Pilot: your airport transfer is confirmed",
      text: `${ref} is confirmed. ${CONFIRMED_NOTICE} Meeting point: Thornhill Park & Ride. ${STRICT_DEPARTURE_NOTICE} ${FLIGHT_DISCLAIMER}`,
    },
    PAYMENT_PROBLEM: {
      subject: "Spires Share Pilot: payment still needs to be completed",
      text: `${ref}. Please complete payment from your signed in Spires Share dashboard. Payment received does not mean the journey is confirmed until all required passengers have paid.`,
    },
    PAYMENT_REQUIRED: {
      subject: "Spires Share Pilot: payment required to secure your place",
      text: `Your proposed Spires Share journey has reached the payment stage.\n\n${ref}\nMeeting point: Thornhill Park & Ride\nPassengers on your reservation: ${pax}\nAmount due: ${amount}\nPay by: ${deadline}\n\n${payLine}\n\n${FILL_NOTICE}\n\nPayment secures your place. Returning from the payment page does not mean payment has been confirmed. If you do not pay by the deadline, your provisional place may be released.\n\n${fourReminder}`,
    },
    PAYMENT_DEADLINE_APPROACHING: {
      subject: "Spires Share Pilot: payment deadline approaching",
      text: `${ref}. Please pay ${amount} by ${deadline} to keep your provisional place. ${payLine}`,
    },
    PAYMENT_EXPIRED: {
      subject: "Spires Share Pilot: reservation released for non payment",
      text: `${ref}. Your provisional place was released because payment was not confirmed before the deadline. The place may be offered to someone else.`,
    },
    SUPPLEMENT_PAYMENT_REQUIRED: {
      subject: "Spires Share Pilot: additional £8.75 payment required",
      text: `${ref}. All four passengers accepted the four passenger departure option. Please pay the additional ${penceToGbp(SUPPLEMENT_PENCE * pax)} (${penceToGbp(FOUR_PASSENGER_FARE_PENCE)} total per passenger) from your signed in dashboard. Spires Taxis will confirm the supplement before the journey is locked.`,
    },
    EARLY_DEPARTURE_OFFERED: {
      subject: "Spires Share Pilot: four passenger departure option",
      text: `We currently have four passengers ready to travel on ${ref}. The journey can still operate if all four passengers agree to a total fare of £43.75 each. You have already paid £35. If everyone accepts, an additional £8.75 payment will be required. This is never applied unless you accept. Every passenger must accept before this option can proceed.`,
    },
    DEPARTURE_TIME_CHANGED: {
      subject: "Spires Share Pilot: departure time updated",
      text: `${ref} has a new departure time. Please check your signed in dashboard. ${STRICT_DEPARTURE_NOTICE}`,
    },
    JOURNEY_DID_NOT_FILL: {
      subject: "Spires Share Pilot: this departure did not fill",
      text: `${ref} did not reach the required number of passengers and will not operate. Affected passengers will be contacted regarding their payment. Refund handling is completed by Spires Taxis.`,
    },
    JOURNEY_CANCELLED: {
      subject: "Spires Share Pilot: departure cancelled",
      text: `${ref} has been cancelled by Spires Taxis. Any refund or retention is decided by Spires according to the circumstances.`,
    },
    TRAVEL_REMINDER: {
      subject: "Spires Share Pilot: travel reminder",
      text: `${ref}. ${STRICT_DEPARTURE_NOTICE} ${FLIGHT_DISCLAIMER}`,
    },
    JOURNEY_REMINDER_24H: {
      subject: "Spires Share Pilot: 24 hour journey reminder",
      text: `${ref} is tomorrow. ${STRICT_DEPARTURE_NOTICE}`,
    },
    DEPARTURE_REMINDER: {
      subject: "Spires Share Pilot: departure reminder",
      text: `${ref} leaves soon. Meeting point: Thornhill Park & Ride. ${STRICT_DEPARTURE_NOTICE}`,
    },
    WAITLIST_OFFERED: {
      subject: "Spires Share Pilot: a place is available",
      text: `A place is available on ${ref}. This is an offer only. Sign in to complete a provisional reservation. The offer expires shortly.`,
    },
    WAITLIST_PLACE_AVAILABLE: {
      subject: "Spires Share: a place has become available",
      text: `A place has become available on your Spires Share journey.\n\nYou have ${extra.offerMinutes || 60} minutes to claim the place before it is offered to the next passenger.\n\n${ref}\n\nSign in to claim or decline. Claiming a place does not skip payment, shared drop off acceptance, or the Spires Share terms.`,
    },
    INTEREST_RECEIVED: {
      subject: "Spires Share: interest registered",
      text: `We have recorded your interest in a shared journey. This is not a booking and no payment has been taken. You will be asked to accept a proposed departure time before any payment is requested.`,
    },
    INTEREST_GROUP_READY: {
      subject: "Spires Share: enough interest to review a shared journey",
      text: `Enough compatible passengers have registered interest for a shared journey. Spires Taxis will review this and may propose an exact departure. No payment has been taken.`,
    },
    JOURNEY_PROPOSED_FROM_INTEREST: {
      subject: "Spires Share: please review the proposed shared journey",
      text: `A shared journey has been proposed from your registered interest.\n\n${ref}\n\nYou must accept this proposed departure. Registering interest at an approximate time does not commit you to a different departure time. No payment is taken until you accept and payment opens.`,
    },
    PLACE_RELEASED: {
      subject: "Spires Share Pilot: your place was released",
      text: `${ref}: your provisional place was released.`,
    },
    CANCELLATION_CONFIRMED: {
      subject: "Spires Share Pilot: reservation cancelled",
      text: `${ref}. Your reservation has been cancelled. Any refund or amount retained will be decided by Spires Taxis according to the cancellation terms and the circumstances.`,
    },
    SHARED_DROPOFF_PROPOSED: {
      subject: "Spires Share: please review the proposed shared drop off",
      text: `${ref}. A proposed shared drop off has been selected. Sign in to review it. Your intended destination is not necessarily where the shared vehicle will drop you. Payment is not requested until you accept the proposed shared drop off.`,
    },
    SHARED_DROPOFF_CHANGED: {
      subject: "Spires Share: the proposed shared drop off has changed",
      text: `${ref}. The proposed shared drop off has changed. Previous acceptance no longer applies. Sign in to review and accept or decline the new shared drop off.`,
    },
  };
  const row = templates[type];
  const html = extra.paymentUrl
    ? `<p style="font-family:Arial,sans-serif;color:#002147;white-space:pre-wrap">${escapePlain(row.text)}</p><p><a href="${escapePlain(extra.paymentUrl)}" style="background:#002147;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block">Pay ${escapePlain(amount)}</a></p>`
    : undefined;
  return { type, to, subject: row.subject, text: row.text, html, journeyId: journey?.publicNumber };
}

function escapePlain(value: string): string {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}

export function recipientForBooking(booking: Pick<ShareBooking, "email">): string {
  return booking.email;
}
