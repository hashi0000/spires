"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TARGET_REVENUE_PENCE = exports.SUPPLEMENT_PENCE = exports.FOUR_PASSENGER_FARE_PENCE = exports.STANDARD_FARE_PENCE = void 0;
exports.reservationHoldsSeat = reservationHoldsSeat;
exports.hostedFromReservation = hostedFromReservation;
exports.paymentStatusFromReservation = paymentStatusFromReservation;
exports.occupiedFromBookings = occupiedFromBookings;
exports.paidPassengerPlaces = paidPassengerPlaces;
exports.receivedPence = receivedPence;
exports.journeyStatusFromOccupancy = journeyStatusFromOccupancy;
exports.validateHostedPaymentUrl = validateHostedPaymentUrl;
exports.fivePassengerConfirmReady = fivePassengerConfirmReady;
exports.fourPassengerConfirmReady = fourPassengerConfirmReady;
exports.bookingAmountDuePence = bookingAmountDuePence;
exports.supplementDuePence = supplementDuePence;
exports.cancellationCategoryFor = cancellationCategoryFor;
exports.hoursBeforeIso = hoursBeforeIso;
exports.recommendedArrivalHm = recommendedArrivalHm;
exports.graceUntilHm = graceUntilHm;
exports.customerStatusLabel = customerStatusLabel;
exports.hostedPaymentUrlForCustomer = hostedPaymentUrlForCustomer;
exports.canCustomerAccessBooking = canCustomerAccessBooking;
exports.toCustomerBookingView = toCustomerBookingView;
exports.adminPaymentSummary = adminPaymentSummary;
exports.stripPaymentSecrets = stripPaymentSecrets;
const types_1 = require("./types");
const logic_1 = require("./logic");
const destinationMatching_1 = require("./destinationMatching");
function reservationHoldsSeat(booking) {
    return (0, logic_1.bookingHoldsSeat)(booking);
}
exports.STANDARD_FARE_PENCE = 3500;
exports.FOUR_PASSENGER_FARE_PENCE = 4375;
exports.SUPPLEMENT_PENCE = 875;
exports.TARGET_REVENUE_PENCE = 17500;
function hostedFromReservation(status) {
    if (status === "PAID")
        return "PAID";
    if (status === "PAYMENT_PENDING")
        return "PAYMENT_PENDING";
    if (status === "PAYMENT_EXPIRED")
        return "EXPIRED";
    return "UNPAID";
}
function paymentStatusFromReservation(status) {
    if (status === "PAID")
        return "HOSTED_PAID";
    if (status === "PAYMENT_PENDING")
        return "HOSTED_PENDING";
    if (status === "PAYMENT_EXPIRED")
        return "HOSTED_EXPIRED";
    if (status === "CANCELLED" || status === "LATE_CANCELLED" || status === "NO_SHOW")
        return "HOSTED_EXPIRED";
    if (status === "DROP_OFF_DECLINED")
        return "HOSTED_UNPAID";
    return "HOSTED_UNPAID";
}
function occupiedFromBookings(bookings) {
    return bookings.filter(reservationHoldsSeat).reduce((sum, row) => sum + (row.passengers || 0), 0);
}
function paidPassengerPlaces(bookings) {
    return bookings
        .filter((row) => row.reservationStatus === "PAID" || row.hostedPaymentStatus === "PAID")
        .reduce((sum, row) => sum + (row.passengers || 0), 0);
}
function receivedPence(bookings) {
    return bookings.reduce((sum, row) => {
        if (row.reservationStatus === "PAYMENT_EXPIRED" && !row.paidAmountPence)
            return sum;
        return sum + (row.paidAmountPence || 0) + (row.supplementPaidPence || 0);
    }, 0);
}
function journeyStatusFromOccupancy(occupied, capacity, current, paymentStageStatus = "NOT_CREATED", matching) {
    return (0, destinationMatching_1.matchingAwareJourneyStatus)(occupied, capacity, current, paymentStageStatus, matching, (occ, cap, cur, stage) => occupancyWithoutMatching(occ, cap, cur, stage));
}
function occupancyWithoutMatching(occupied, capacity, current, paymentStageStatus) {
    if (current === "CANCELLED" || current === "EXPIRED" || current === "COMPLETED" || current === "CONFIRMED") {
        return current;
    }
    if (current === "FOUR_PASSENGER_OPTION" || current === "SUPPLEMENT_PAYMENT") {
        if (occupied >= 5 && (paymentStageStatus === "OPEN" || paymentStageStatus === "LINK_SAVED")) {
            return "PAYMENT_WINDOW_OPEN";
        }
        if (occupied < 4) {
            return paymentStageStatus === "OPEN" ? "PAYMENT_WINDOW_OPEN" : occupied <= 0 ? "GATHERING_INTEREST" : "GATHERING_INTEREST";
        }
        return current;
    }
    if (occupied <= 0)
        return "GATHERING_INTEREST";
    if (paymentStageStatus === "OPEN") {
        if (occupied === capacity - 1)
            return "AWAITING_FINAL_PASSENGER";
        return "PAYMENT_WINDOW_OPEN";
    }
    if (occupied >= capacity - 1)
        return "READY_FOR_PAYMENT_SETUP";
    return "GATHERING_INTEREST";
}
function validateHostedPaymentUrl(raw) {
    const url = String(raw || "").trim();
    if (!url)
        throw new Error("Paste a hosted payment link first.");
    if (url.length > 2048)
        throw new Error("That payment link is too long.");
    let parsed;
    try {
        parsed = new URL(url);
    }
    catch {
        throw new Error("The payment link must be a valid https URL.");
    }
    if (parsed.protocol !== "https:")
        throw new Error("The payment link must use https.");
    if (!parsed.hostname || !parsed.hostname.includes("."))
        throw new Error("The payment link hostname is not valid.");
    if (parsed.username || parsed.password)
        throw new Error("The payment link must not contain credentials.");
    return parsed.toString();
}
function fivePassengerConfirmReady(bookings, capacity) {
    const holding = bookings.filter(reservationHoldsSeat);
    const occupied = holding.reduce((sum, row) => sum + row.passengers, 0);
    const paid = paidPassengerPlaces(holding);
    return { ok: occupied >= capacity && paid >= capacity && holding.every((row) => row.reservationStatus === "PAID"), occupied, paid };
}
function fourPassengerConfirmReady(bookings, threshold = 4) {
    const holding = bookings.filter(reservationHoldsSeat);
    const occupied = holding.reduce((sum, row) => sum + row.passengers, 0);
    const paid = paidPassengerPlaces(holding);
    const accepted = holding.filter((row) => row.fourPassengerAccepted).reduce((sum, row) => sum + row.passengers, 0);
    const supplementsPaid = holding.filter((row) => (row.supplementPaidPence || 0) >= exports.SUPPLEMENT_PENCE * row.passengers).reduce((sum, row) => sum + row.passengers, 0);
    return {
        ok: occupied === threshold && paid === threshold && accepted === threshold && supplementsPaid === threshold,
        occupied,
        paid,
        accepted,
        supplementsPaid,
    };
}
function bookingAmountDuePence(booking, farePence) {
    return farePence * booking.passengers;
}
function supplementDuePence(booking) {
    return exports.SUPPLEMENT_PENCE * booking.passengers;
}
function cancellationCategoryFor(hoursBeforeDeparture, journeyConfirmed) {
    if (hoursBeforeDeparture > 24)
        return "FREE";
    return "LATE_CANCELLATION";
}
function hoursBeforeIso(departureAt, nowIso) {
    return (new Date(departureAt).getTime() - new Date(nowIso).getTime()) / (60 * 60 * 1000);
}
function recommendedArrivalHm(departureHm, minutesBefore) {
    const start = (0, logic_1.parseHmToMinutes)(departureHm);
    if (start == null)
        return "";
    return (0, logic_1.minutesToHm)(start - minutesBefore);
}
function graceUntilHm(departureHm, graceMinutes) {
    const start = (0, logic_1.parseHmToMinutes)(departureHm);
    if (start == null)
        return "";
    return (0, logic_1.minutesToHm)(start + graceMinutes);
}
function customerStatusLabel(journey, booking) {
    if (journey.status === "CONFIRMED")
        return "Journey confirmed";
    if (booking.reservationStatus === "PAID" || booking.hostedPaymentStatus === "PAID") {
        return types_1.PAID_AWAITING_CONFIRMATION;
    }
    if ((0, destinationMatching_1.destinationMatchingEnabled)(journey)) {
        const dropoff = (0, destinationMatching_1.passengerSharedDropoffStatus)(journey, booking);
        if (dropoff === "DECLINED")
            return types_1.DROPOFF_DECLINED_LABEL;
        if (dropoff === "PROPOSED")
            return types_1.REVIEW_PROPOSED_DROPOFF_LABEL;
        if (dropoff === "ACCEPTED" && journey.paymentStageStatus !== "OPEN")
            return types_1.DROPOFF_ACCEPTED_WAITING_PAYMENT_LABEL;
        if (dropoff === "NOT_SELECTED")
            return types_1.WAITING_FOR_MATCHING_LABEL;
    }
    return types_1.PROVISIONAL_PLACE_LABEL;
}
function hostedPaymentUrlForCustomer(journey, booking) {
    const supplement = journey.status === "SUPPLEMENT_PAYMENT" &&
        booking.fourPassengerAccepted &&
        (booking.supplementPaidPence || 0) < supplementDuePence(booking);
    if (supplement) {
        if (!(0, destinationMatching_1.canPassengerEnterPayment)(journey, booking))
            return null;
        if (!journey.supplementPaymentLinkUrl)
            return null;
        return {
            url: journey.supplementPaymentLinkUrl,
            kind: "supplement",
            amountPence: supplementDuePence(booking),
        };
    }
    if (!(0, destinationMatching_1.canPassengerEnterPayment)(journey, booking))
        return null;
    if (journey.paymentStageStatus !== "OPEN" || booking.reservationStatus !== "PAYMENT_PENDING" || !journey.paymentLinkUrl) {
        return null;
    }
    return {
        url: journey.paymentLinkUrl,
        kind: "fare",
        amountPence: bookingAmountDuePence(booking, journey.farePence),
    };
}
function canCustomerAccessBooking(booking, actor) {
    if (actor.isAdmin)
        return true;
    if (booking.uid && actor.uid && booking.uid === actor.uid)
        return true;
    return false;
}
function toCustomerBookingView(journey, booking, allBookings, config) {
    const pub = (0, logic_1.toPublicJourney)(journey, config);
    const holding = allBookings.filter(reservationHoldsSeat);
    const paidPlaces = paidPassengerPlaces(holding);
    const reservationStatus = booking.reservationStatus || "PROVISIONAL";
    const hostedPaymentStatus = booking.hostedPaymentStatus || hostedFromReservation(reservationStatus);
    const amountDue = bookingAmountDuePence(booking, journey.farePence);
    const fourAvailable = journey.status === "FOUR_PASSENGER_OPTION" || journey.status === "SUPPLEMENT_PAYMENT";
    const canPay = Boolean(hostedPaymentUrlForCustomer(journey, booking));
    const confirmed = journey.status === "CONFIRMED";
    const paidAwaiting = !confirmed && (reservationStatus === "PAID" || hostedPaymentStatus === "PAID");
    const matching = (0, destinationMatching_1.destinationMatchingEnabled)(journey);
    const dropoffStatus = matching ? (0, destinationMatching_1.passengerSharedDropoffStatus)(journey, booking) : undefined;
    const confirmedNotice = confirmed
        ? (0, destinationMatching_1.journeyTypeOf)(journey) === "AIRPORT"
            ? types_1.CONFIRMED_NOTICE
            : types_1.SHARED_JOURNEY_CONFIRMED_NOTICE
        : undefined;
    const paidAwaitingLine = matching
        ? `${types_1.PAID_AWAITING_CONFIRMATION}. Your shared journey is not confirmed until all required passengers have paid.`
        : `${types_1.PAID_AWAITING_CONFIRMATION}. Your airport transfer is not confirmed until all required passengers have paid.`;
    return {
        publicNumber: pub.publicNumber,
        travelDate: pub.travelDate,
        departureTime: pub.departureTime,
        recommendedArrivalTime: recommendedArrivalHm(journey.departureTime, config.arriveBeforeDepartureMinutes),
        graceUntilTime: graceUntilHm(journey.departureTime, config.boardingClosesMinutesBeforeDeparture),
        meetingPointName: pub.meetingPointName,
        destinationLabel: pub.destinationLabel,
        originLabel: pub.originLabel,
        dropoffTerminal: booking.dropoffTerminal,
        passengers: booking.passengers,
        farePence: journey.farePence,
        amountDuePence: amountDue,
        paidAmountPence: booking.paidAmountPence || 0,
        reservationStatus,
        hostedPaymentStatus,
        publicStatus: pub.publicStatus,
        journeyStatus: journey.status,
        guarantee: pub.guarantee,
        occupiedSeats: journey.occupiedSeats,
        remainingSeats: (0, logic_1.remainingSeats)(journey.occupiedSeats, journey.capacity),
        capacity: journey.capacity,
        paidPassengerPlaces: paidPlaces,
        requiredPaidPlaces: Math.min(journey.occupiedSeats, journey.capacity),
        paymentDeadlineAt: booking.paymentDeadlineAt || journey.paymentDeadlineAt,
        paymentLinkAvailable: canPay,
        fourPassengerOffer: fourAvailable
            ? {
                available: true,
                currentPaidPence: booking.paidAmountPence || amountDue,
                additionalPence: supplementDuePence(booking),
                totalPence: exports.FOUR_PASSENGER_FARE_PENCE * booking.passengers,
                accepted: Boolean(booking.fourPassengerAccepted),
            }
            : undefined,
        cancellationDeadlineAt: journey.departureAt,
        customerStatusLabel: customerStatusLabel(journey, booking),
        fillNotice: confirmed ? undefined : types_1.FILL_NOTICE,
        confirmedNotice,
        warning: confirmed
            ? `${confirmedNotice} ${types_1.STRICT_DEPARTURE_NOTICE}`
            : paidAwaiting
                ? paidAwaitingLine
                : types_1.UNCONFIRMED_WARNING,
        paymentSubmittedNotice: booking.paymentSubmittedAt
            ? "Payment submitted? Payments are currently verified by Spires Taxis. Your booking will show as paid once your payment has been confirmed."
            : undefined,
        journeyType: (0, destinationMatching_1.journeyTypeOf)(journey),
        destinationMatchingEnabled: matching,
        destinationCity: journey.destinationCity,
        intendedDestinationText: matching ? booking.intendedDestinationText : undefined,
        intendedDestinationPostcode: matching ? booking.intendedDestinationPostcode : undefined,
        proposedSharedDropoffDisplayName: matching ? journey.proposedSharedDropoffDisplayName : undefined,
        sharedDropoffStatus: dropoffStatus,
        canAcceptSharedDropoff: matching && dropoffStatus === "PROPOSED",
        canDeclineSharedDropoff: matching && dropoffStatus === "PROPOSED",
        sharedDropoffNotice: matching && dropoffStatus === "PROPOSED"
            ? (0, destinationMatching_1.proposedDropoffCustomerNotice)(journey, booking.intendedDestinationText)
            : matching && dropoffStatus === "NOT_SELECTED"
                ? "Shared drop off: Not selected yet"
                : undefined,
    };
}
function adminPaymentSummary(journey, bookings) {
    const reserved = occupiedFromBookings(bookings);
    const paidPlaces = paidPassengerPlaces(bookings);
    return {
        reserved,
        paidPlaces,
        outstandingPlaces: Math.max(0, reserved - paidPlaces),
        receivedPence: receivedPence(bookings),
        paymentLinkState: journey.paymentLinkUrl ? "ADDED" : "NOT CREATED",
        paymentWindowState: journey.paymentStageStatus === "OPEN" ? "OPEN" : "CLOSED",
    };
}
function stripPaymentSecrets(row) {
    const out = { ...row };
    delete out.paymentLinkUrl;
    delete out.supplementPaymentLinkUrl;
    delete out.paymentMethodRef;
    delete out.paymentId;
    delete out.manageTokenHash;
    delete out.idempotencyKey;
    return out;
}
