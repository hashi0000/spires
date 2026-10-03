"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.shareNotificationsEnabled = shareNotificationsEnabled;
exports.buildNotification = buildNotification;
exports.recipientForBooking = recipientForBooking;
const types_1 = require("./types");
const logic_1 = require("./logic");
const paymentDeadline_1 = require("./paymentDeadline");
const hostedPayment_1 = require("./hostedPayment");
const shareProgress_1 = require("./shareProgress");
function shareNotificationsEnabled(config) {
    return config.notificationsSend === true && String(process.env.SHARE_NOTIFICATIONS_SEND || "false").toLowerCase() === "true";
}
function journeyLine(journey) {
    if (!journey)
        return "Your Spires Share booking";
    const origin = journey.departureLocation || journey.originLabel || "the departure location";
    const destination = journey.destinationLabel || "the shared destination";
    return `${origin} to ${destination}. Departure ${journey.publicNumber} on ${journey.travelDate} at ${journey.departureTime}`;
}
function buildNotification(type, to, journey, extra = {}) {
    const ref = journeyLine(journey);
    const amount = extra.amountPence != null ? (0, logic_1.penceToGbp)(extra.amountPence) : extra.farePence != null ? (0, logic_1.penceToGbp)(extra.farePence) : "the fare shown on your dashboard";
    const pax = extra.passengers || 1;
    const deadline = extra.paymentDeadlineAt ? (0, paymentDeadline_1.formatLondonDateTime)(extra.paymentDeadlineAt) : "the payment deadline";
    const payLine = extra.paymentUrl
        ? `Pay securely using the hosted payment page: ${extra.paymentUrl}`
        : "Open your Spires Share dashboard while signed in to pay.";
    const fourReminder = extra.fourPassengerFallbackEnabled
        ? "If five passengers travel, the fare is £35 per passenger. If only four passengers are available, you may be offered the option to proceed for an additional £8.75 per passenger, bringing the total fare to £43.75 per passenger. You will never be charged the additional amount without agreeing to proceed."
        : "";
    const terminalGuideLine = extra.terminalGuideUrl
        ? `\n\n${extra.terminalGuideLabel || "Terminal transfer instructions"}: ${extra.terminalGuideUrl}`
        : "";
    const eventLine = extra.eventName
        ? `\n\nEvent:\n${extra.eventName}${extra.venueName ? `\nVenue:\n${extra.venueName}` : ""}${extra.eventDate ? `\nEvent date:\n${extra.eventDate}` : ""}${extra.eventStartTime ? `\nEvent start:\n${extra.eventStartTime}` : ""}`
        : "";
    const templates = {
        BOOKING_RECEIVED: {
            subject: "Spires Share Pilot: interest registered (provisional place)",
            text: `${ref}. ${types_1.INTEREST_NOTICE} ${types_1.UNCONFIRMED_WARNING} This is not a confirmed airport transfer.`,
        },
        JOURNEY_FILLING: {
            subject: "Spires Share Pilot: more passengers have registered interest",
            text: `${ref} now has more places reserved. Your place is still provisional until payment is completed and the journey is confirmed.`,
        },
        JOURNEY_CONFIRMED: {
            subject: "Your Spires Share journey is confirmed",
            text: `JOURNEY CONFIRMED\n\n${extra.origin || journey?.originLabel || "Oxford"} → ${extra.destination || extra.sharedDropoff || journey?.destinationLabel || "Heathrow Terminal 3"}\n\nDate:\n${extra.travelDate || journey?.travelDate || ""}\n\nDeparture:\n${journey?.departureTime || ""}\n\nPickup:\n${extra.pickup || "Thornhill Park and Ride"}${eventLine}\n\nYOUR BOARDING CODE\n\n${extra.boardingCode || "See your signed in dashboard"}\n\nPlease give this code to your driver when boarding.\n\n${types_1.CONFIRMED_NOTICE} ${types_1.STRICT_DEPARTURE_NOTICE} ${types_1.FLIGHT_DISCLAIMER}${terminalGuideLine}`,
        },
        PAYMENT_PROBLEM: {
            subject: "Spires Share Pilot: payment still needs to be completed",
            text: `${ref}. Please complete payment from your signed in Spires Share dashboard. Payment received does not mean the journey is confirmed until all required passengers have paid.`,
        },
        PAYMENT_REQUIRED: {
            subject: "Payment required for your Spires Share journey",
            text: `Good news — enough passengers have registered for your proposed Spires Share journey.\n\nYour journey is NOT confirmed yet.\n\nAll required passengers must now pay before the payment deadline.\n\n${ref}\nShared drop off: ${extra.sharedDropoff || "the shared destination shown in your dashboard"}\nFare: ${amount}\nPayment deadline: ${deadline}\n\n${payLine}\n\n${shareProgress_1.PAYMENT_GUARANTEE_NOTICE}${fourReminder ? `\n\n${fourReminder}` : ""}`,
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
            text: `${ref}. All four passengers accepted the four passenger departure option. Please pay the additional ${(0, logic_1.penceToGbp)(hostedPayment_1.SUPPLEMENT_PENCE * pax)} (${(0, logic_1.penceToGbp)(hostedPayment_1.FOUR_PASSENGER_FARE_PENCE)} total per passenger) from your signed in dashboard. Spires Taxis will confirm the supplement before the journey is locked.`,
        },
        EARLY_DEPARTURE_OFFERED: {
            subject: "Spires Share Pilot: four passenger departure option",
            text: `We currently have four passengers ready to travel on ${ref}. The journey can still operate if all four passengers agree to a total fare of £43.75 each. You have already paid £35. If everyone accepts, an additional £8.75 payment will be required. This is never applied unless you accept. Every passenger must accept before this option can proceed.`,
        },
        DEPARTURE_TIME_CHANGED: {
            subject: "Spires Share Pilot: departure time updated",
            text: `${ref} has a new departure time. Please check your signed in dashboard. ${types_1.STRICT_DEPARTURE_NOTICE}`,
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
            text: `${ref}. ${types_1.STRICT_DEPARTURE_NOTICE} ${types_1.FLIGHT_DISCLAIMER}`,
        },
        JOURNEY_REMINDER_24H: {
            subject: "Spires Share Pilot: 24 hour journey reminder",
            text: `${ref} is tomorrow. ${types_1.STRICT_DEPARTURE_NOTICE}${terminalGuideLine}`,
        },
        DEPARTURE_REMINDER: {
            subject: "Spires Share Pilot: departure reminder",
            text: `${ref} leaves soon. Meeting point: Thornhill Park & Ride. ${types_1.STRICT_DEPARTURE_NOTICE}${terminalGuideLine}`,
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
            subject: "We've registered your Spires Share interest",
            text: `Hi ${extra.firstName || "there"},\n\nWe've registered your interest in:\n\n${extra.origin || "your origin"} → ${extra.destination || "your destination"}\n${extra.travelDate || ""}\nAround ${extra.preferredTime || "your preferred time"}${eventLine}\n\nThere are currently ${extra.interestedSeatCount ?? 0} of ${extra.requiredSeats ?? 0} places interested.\n\n${extra.remainingNeeded === 1 ? "1 more passenger is needed before payment can be requested." : extra.remainingNeeded && extra.remainingNeeded > 1 ? `${extra.remainingNeeded} more passengers are needed before payment can be requested.` : "Enough passengers have registered. Payment requests can now be sent."}\n\nRegistration closes: ${extra.interestDeadlineAt ? (0, paymentDeadline_1.formatLondonDateTime)(extra.interestDeadlineAt) : "the registration deadline"}\n\nYou have not been charged.\n\nWe'll email you if enough passengers register and payment becomes available.\n\nRegistering interest does not confirm the journey.\n\nView my Share journey: ${extra.customerDashboardUrl || shareProgress_1.SHARE_CUSTOMER_DASHBOARD_URL}`,
        },
        INTEREST_GROUP_READY: {
            subject: "Spires Share: Payment threshold reached — action required",
            text: `Enough passengers have registered. Review the journey and open the payment window.\n\nThis does not confirm the journey.`,
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
        ADMIN_NEW_INTEREST: {
            subject: `Spires Share: New interest — ${extra.origin || "Origin"} → ${extra.destination || "destination"}`,
            text: `New Spires Share interest registered.\n\nRoute: ${extra.origin || ""} → ${extra.destination || ""}\nDate: ${extra.travelDate || ""}\nPreferred time: ${extra.preferredTime || ""}\nSeats requested: ${extra.seatsRequested || 1}\nCurrent interest: ${extra.interestedSeatCount ?? 0} of ${extra.requiredSeats ?? 0}\nMore needed: ${extra.remainingNeeded ?? 0}\nInterest deadline: ${extra.interestDeadlineAt ? (0, paymentDeadline_1.formatLondonDateTime)(extra.interestDeadlineAt) : "not set"}\nAdmin dashboard: ${extra.adminDashboardUrl || shareProgress_1.SHARE_ADMIN_DASHBOARD_URL}`,
        },
        ADMIN_THRESHOLD_REACHED: {
            subject: "Spires Share: Payment threshold reached — action required",
            text: `Enough passengers have registered. Review the journey and open the payment window.\n\nRoute: ${extra.origin || ""} → ${extra.destination || ""}\nDate: ${extra.travelDate || ""}\nRequired passengers: ${extra.requiredSeats ?? 0}\nInterested passengers: ${extra.interestedSeatCount ?? 0}\nFare: ${extra.farePence != null ? (0, logic_1.penceToGbp)(extra.farePence) : "see dashboard"}\nPotential revenue: ${extra.potentialRevenuePence != null ? (0, logic_1.penceToGbp)(extra.potentialRevenuePence) : "see dashboard"}\nPayment link status: ${extra.paymentLinkStatus || "not added"}\n\nDo not mark the journey confirmed. Open the payment window after review.`,
        },
        ADMIN_ALL_PAYMENTS_RECEIVED: {
            subject: "Spires Share: All payments received — journey confirmed",
            text: `All required payments have been received and verified. The journey is confirmed.\n\n${ref}`,
        },
        ADMIN_PAYMENT_WINDOW_EXPIRED: {
            subject: "Spires Share: Payment deadline missed — action required",
            text: `Not all required passenger payments were received by the deadline. This Spires Share journey has not been confirmed.\n\n${ref}\n\nReview unpaid reservations, waitlist offers, and any payments already received. No automatic refund has been issued.`,
        },
        INTEREST_PROGRESS_ONE_MORE: {
            subject: "Spires Share: Just 1 more passenger needed",
            text: `Your shared journey now has ${extra.interestedSeatCount ?? 0} of ${extra.requiredSeats ?? 0} places interested.\n\nJust one more passenger is needed before the journey can move to payment.\n\nRegistration closes: ${extra.interestDeadlineAt ? (0, paymentDeadline_1.formatLondonDateTime)(extra.interestDeadlineAt) : "the registration deadline"}\n\nRegistering interest does not confirm the journey.`,
        },
        INTEREST_EXPIRED: {
            subject: "Update on your Spires Share request",
            text: `Unfortunately, we did not receive enough passenger interest before the registration deadline.\n\nThe shared journey will therefore not proceed to payment.\n\nNo payment was taken.\n\nView other Share journeys: ${extra.publicBoardUrl || shareProgress_1.SHARE_PUBLIC_BOARD_URL}`,
        },
        PAYMENT_RECEIVED: {
            subject: "We've received your Spires Share payment",
            text: `We've confirmed receipt of your ${amount} payment.\n\nYour individual payment has been received.\n\nThe shared journey is not yet confirmed unless all required passenger payments have also been received.\n\nPayments received: ${extra.paymentsReceived ?? 0} of ${extra.paymentsRequired ?? 0}\n${extra.remainingPayments ? `${extra.remainingPayments} payment${extra.remainingPayments === 1 ? " is" : "s are"} still outstanding.` : "All required payments have been received."}\n\n${shareProgress_1.PAYMENT_GUARANTEE_NOTICE}`,
        },
        PAYMENT_WINDOW_EXPIRED_CUSTOMER: {
            subject: "Update on your Spires Share journey",
            text: `Unfortunately, not all required passenger payments were received by the deadline, so this Spires Share journey has not yet been confirmed.\n\n${ref}\n\nIf you have already paid, Spires Taxis has recorded your payment and will contact you about the next steps. No automatic refund has been issued.\nPayment status: ${extra.refundStatus || "recorded, awaiting admin review"}`,
        },
        PAYMENT_DEADLINE_EXTENDED: {
            subject: "Spires Share: payment deadline updated",
            text: `${ref}. The payment deadline has been updated to ${deadline}. ${shareProgress_1.PAYMENT_GUARANTEE_NOTICE}`,
        },
        DRIVER_MANIFEST: {
            subject: `Spires Share driver manifest — ${journey?.publicNumber || "journey"} — ${extra.travelDate || journey?.travelDate || ""}`.trim(),
            text: `SPIRES SHARE DRIVER MANIFEST\n\nJourney:\n${journey?.publicNumber || ""}\n\n${extra.origin || journey?.originLabel || "Oxford"} → ${extra.destination || extra.sharedDropoff || "Heathrow Terminal 3"}\n\nDeparture:\n${journey?.departureTime || ""}\n\nPickup:\n${extra.pickup || "Thornhill Park and Ride"}${eventLine}\n\nPassengers:\n${extra.boardingPassengers || 0} seats\n\n${extra.driverManifestLines || ""}\n\nAsk each passenger for their boarding code before they board.\n${extra.driverBoardingUrl ? `\nOpen driver boarding: ${extra.driverBoardingUrl}` : ""}`,
        },
        DRIVER_MANIFEST_UPDATED: {
            subject: `UPDATED Spires Share driver manifest — ${journey?.publicNumber || "journey"}`,
            text: `UPDATED PASSENGER LIST\n\nThe confirmed Spires Share passenger list has changed. Use this current list, not an earlier email.\n\nJourney:\n${journey?.publicNumber || ""}\n\n${extra.origin || ""} → ${extra.destination || extra.sharedDropoff || ""}\nDeparture: ${journey?.departureTime || ""}\nPickup: ${extra.pickup || ""}\n\n${extra.driverManifestLines || ""}\n\n${extra.driverBoardingUrl ? `Open driver boarding: ${extra.driverBoardingUrl}` : "The signed in driver boarding view always uses the current passenger list."}`,
        },
        DRIVER_MANIFEST_REMINDER: {
            subject: `Spires Share driver reminder — ${journey?.publicNumber || "journey"}`,
            text: `Reminder: Spires Share journey ${journey?.publicNumber || ""} departs at ${journey?.departureTime || ""}. Use the current passenger list and boarding codes in your previous manifest email or signed in boarding view.`,
        },
    };
    const row = templates[type];
    const html = extra.paymentUrl
        ? `<p style="font-family:Arial,sans-serif;color:#002147;white-space:pre-wrap">${escapePlain(row.text)}</p><p><a href="${escapePlain(extra.paymentUrl)}" style="background:#002147;color:#fff;padding:12px 18px;text-decoration:none;border-radius:6px;display:inline-block">Pay ${escapePlain(amount)}</a></p>`
        : undefined;
    return { type, to, subject: row.subject, text: row.text, html, journeyId: journey?.publicNumber };
}
function escapePlain(value) {
    return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
}
function recipientForBooking(booking) {
    return booking.email;
}
