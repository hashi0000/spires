"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.poundsFromPence = poundsFromPence;
exports.penceFromPounds = penceFromPounds;
exports.formatUkDate = formatUkDate;
exports.formatUkDateShort = formatUkDateShort;
exports.routeLabel = routeLabel;
exports.humanInterestStatus = humanInterestStatus;
exports.paidVerifiedSeats = paidVerifiedSeats;
exports.humanJourneyStage = humanJourneyStage;
exports.journeyListSafeFields = journeyListSafeFields;
exports.listContainsPii = listContainsPii;
exports.buildNeedsAction = buildNeedsAction;
const shareProgress_1 = require("./shareProgress");
function pounds(pence) {
    return `£${((pence || 0) / 100).toFixed(2)}`;
}
function poundsFromPence(pence) {
    return pounds(pence);
}
function penceFromPounds(poundsValue) {
    const n = typeof poundsValue === "number" ? poundsValue : Number(String(poundsValue).replace(/£/g, "").trim());
    if (!Number.isFinite(n) || n <= 0)
        return 0;
    return Math.round(n * 100);
}
function formatUkDate(isoDate) {
    if (!isoDate)
        return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3)
        return isoDate;
    const months = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
    const month = months[Number(parts[1]) - 1];
    return `${Number(parts[2])} ${month}`;
}
function formatUkDateShort(isoDate) {
    if (!isoDate)
        return "";
    const parts = isoDate.split("-");
    if (parts.length !== 3)
        return isoDate;
    const months = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
    return `${Number(parts[2])} ${months[Number(parts[1]) - 1]}`;
}
function routeLabel(row) {
    const origin = row.originLabel || row.originCity || row.origin || "Oxford";
    const destination = row.destinationLabel || row.destinationCity || row.destinationRegion || "Heathrow T3";
    return `${origin} → ${destination}`;
}
function humanInterestStatus(status, enough) {
    if (status === "READY_FOR_REVIEW" || (enough && (status === "GATHERING_INTEREST" || status === "READY_FOR_REVIEW"))) {
        return "Ready to propose";
    }
    if (status === "EXPIRED")
        return "Did not fill";
    if (status === "CANCELLED")
        return "Cancelled";
    return "Collecting interest";
}
function paidVerifiedSeats(bookings) {
    let paid = 0;
    let verified = 0;
    for (const booking of bookings) {
        const seats = booking.passengers || 0;
        if (booking.reservationStatus === "PAID" || booking.hostedPaymentStatus === "PAID")
            paid += seats;
        if (booking.reservationStatus === "PAID")
            verified += seats;
    }
    return { paid, verified };
}
function humanJourneyStage(journey, bookings) {
    const status = journey.status;
    if (status === "CONFIRMED")
        return "Confirmed";
    if (status === "COMPLETED")
        return "Completed";
    if (status === "CANCELLED")
        return "Cancelled";
    if (status === "EXPIRED")
        return "Did not fill";
    const required = journey.minPassengerThreshold || journey.capacity || 5;
    const { verified } = paidVerifiedSeats(bookings);
    if (verified >= required && required > 0)
        return "Ready to confirm";
    if (journey.paymentStageStatus === "OPEN" || status === "PAYMENT_WINDOW_OPEN")
        return "Collecting payment";
    if (journey.paymentLinkUrl)
        return "Ready to open payment";
    const occupied = journey.occupiedSeats || 0;
    if (occupied >= required && !journey.paymentLinkUrl) {
        if (status === "PROPOSED" || status === "AWAITING_DROPOFF_ACCEPTANCE")
            return "Waiting for acceptances";
        return "Add payment link";
    }
    if (status === "PROPOSED" || status === "AWAITING_DROPOFF_SELECTION" || status === "AWAITING_DROPOFF_ACCEPTANCE") {
        return "Waiting for acceptances";
    }
    if (status === "READY_FOR_PAYMENT_SETUP")
        return journey.paymentLinkUrl ? "Ready to open payment" : "Add payment link";
    return "Collecting interest";
}
function journeyListSafeFields(journey) {
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
function listContainsPii(row) {
    return ["email", "mobile", "paymentLinkUrl", "boardingCode", "adminNotes"].some((key) => key in row && Boolean(row[key]));
}
function remainingMs(deadlineAt, nowIso) {
    if (!deadlineAt)
        return Number.POSITIVE_INFINITY;
    const ms = new Date(deadlineAt).getTime() - new Date(nowIso || Date.now()).getTime();
    return Number.isFinite(ms) ? ms : Number.POSITIVE_INFINITY;
}
function buildNeedsAction(input) {
    const nowIso = input.nowIso || new Date().toISOString();
    const items = [];
    const bookingsByJourney = new Map();
    for (const booking of input.bookings) {
        const list = bookingsByJourney.get(booking.journeyId) || [];
        list.push(booking);
        bookingsByJourney.set(booking.journeyId, list);
    }
    for (const group of input.interestGroups) {
        if (group.status === "CONVERTED_TO_JOURNEY" || group.status === "CANCELLED" || group.status === "EXPIRED")
            continue;
        const required = group.minPassengerThreshold || 5;
        const progress = (0, shareProgress_1.seatProgress)(group.interestedSeatCount || 0, required);
        const route = routeLabel(group);
        const when = `${formatUkDate(group.travelDate)} · Around ${group.timeWindowStart || ""}`.trim();
        if (progress.enough || group.status === "READY_FOR_REVIEW") {
            items.push({
                id: `propose-${group.id}`,
                kind: "ready_to_propose",
                priority: 60,
                title: route,
                route,
                when,
                detail: `${progress.placesLabel} interested`,
                extra: "Ready to propose journey",
                countdownAt: group.interestDeadlineAt,
                primaryLabel: "Review and propose",
                target: { type: "interest", id: group.id },
            });
            continue;
        }
        const ms = remainingMs(group.interestDeadlineAt, nowIso);
        if (group.interestDeadlineAt && ms <= 6 * 60 * 60 * 1000) {
            items.push({
                id: `interest-soon-${group.id}`,
                kind: "interest_deadline_soon",
                priority: 70,
                title: route,
                route,
                when,
                detail: `${progress.placesLabel} interested`,
                extra: progress.neededLabel,
                countdownAt: group.interestDeadlineAt,
                countdownLabel: "Registration closes in",
                primaryLabel: "View",
                target: { type: "interest", id: group.id },
                urgency: ms <= 60 * 60 * 1000 ? "now" : "soon",
            });
        }
    }
    for (const journey of input.journeys) {
        if (["COMPLETED", "CANCELLED", "EXPIRED"].includes(journey.status))
            continue;
        const bookings = bookingsByJourney.get(journey.id) || [];
        const stage = humanJourneyStage(journey, bookings);
        const route = routeLabel(journey);
        const when = `${formatUkDate(journey.travelDate)} · ${journey.departureTime}`;
        const pay = (0, shareProgress_1.paymentProgress)(bookings, journey.capacity);
        const outstandingOffer = (input.waitlist || []).some((row) => row.journeyId === journey.id && row.status === "OFFERED");
        if (outstandingOffer) {
            items.push({
                id: `waitlist-${journey.id}`,
                kind: "waitlist_offer",
                priority: 15,
                title: journey.publicNumber,
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
                title: journey.publicNumber,
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
                title: journey.publicNumber,
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
                title: journey.publicNumber,
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
                title: journey.publicNumber,
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
                title: journey.publicNumber,
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
