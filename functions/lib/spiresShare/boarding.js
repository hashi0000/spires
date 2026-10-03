"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.hashBoardingCode = hashBoardingCode;
exports.generateBoardingCode = generateBoardingCode;
exports.codeLooksDerivedFromPii = codeLooksDerivedFromPii;
exports.bookingEligibleForBoardingCode = bookingEligibleForBoardingCode;
exports.issueBoardingCodes = issueBoardingCodes;
exports.verifyBoardingCode = verifyBoardingCode;
exports.boardingDisplayStatus = boardingDisplayStatus;
exports.boardingProgress = boardingProgress;
exports.driverManifestFingerprint = driverManifestFingerprint;
exports.shouldSendDriverManifest = shouldSendDriverManifest;
exports.driverManifestLines = driverManifestLines;
exports.publicDtoHasBoardingSecrets = publicDtoHasBoardingSecrets;
exports.customerBoardingCodeForView = customerBoardingCodeForView;
const crypto_1 = require("crypto");
const logic_1 = require("./logic");
const eventJourneys_1 = require("./eventJourneys");
function hashBoardingCode(journeyId, bookingId, code) {
    return (0, crypto_1.createHash)("sha256").update(`${journeyId}:${bookingId}:${String(code).trim()}`).digest("hex");
}
function generateBoardingCode(used) {
    for (let attempt = 0; attempt < 80; attempt += 1) {
        const code = String((0, crypto_1.randomInt)(1000, 10000));
        if (!used.has(code))
            return code;
    }
    throw new Error("Could not allocate a boarding code.");
}
function codeLooksDerivedFromPii(code, booking) {
    const digits = String(code || "");
    const haystack = `${booking.email || ""}${booking.mobile || ""}${booking.name || ""}${booking.id || ""}`.replace(/\D/g, "");
    return Boolean(digits) && haystack.includes(digits);
}
function bookingEligibleForBoardingCode(journey, booking) {
    if (journey.status !== "CONFIRMED")
        return false;
    const reservation = booking.reservationStatus || "";
    if (["CANCELLED", "LATE_CANCELLED", "NO_SHOW", "DROP_OFF_DECLINED", "PAYMENT_EXPIRED"].includes(reservation)) {
        return false;
    }
    const paid = reservation === "PAID" || booking.hostedPaymentStatus === "PAID";
    return paid && ((0, logic_1.bookingHoldsSeat)(booking) || reservation === "PAID");
}
function issueBoardingCodes(journey, bookings, nowIso) {
    if (journey.status !== "CONFIRMED")
        return bookings;
    const used = new Set(bookings.map((row) => String(row.boardingCode || "")).filter((code) => /^\d{4}$/.test(code)));
    for (const booking of bookings) {
        if (!bookingEligibleForBoardingCode(journey, booking))
            continue;
        if (booking.boardingCode && booking.boardingCodeHash)
            continue;
        const code = generateBoardingCode(used);
        used.add(code);
        booking.boardingCode = code;
        booking.boardingCodeHash = hashBoardingCode(journey.id, booking.id, code);
        booking.boardingCodeCreatedAt = nowIso;
    }
    return bookings;
}
function verifyBoardingCode(journey, booking, code, actor, nowIso, eventLeg = "OUTBOUND") {
    if (journey.status !== "CONFIRMED") {
        throw new Error("Boarding codes are only used on confirmed journeys.");
    }
    if (booking.reservationStatus === "NO_SHOW") {
        throw new Error("This passenger is marked as a no show.");
    }
    if (booking.reservationStatus === "CANCELLED" || booking.reservationStatus === "LATE_CANCELLED") {
        throw new Error("This reservation is no longer active.");
    }
    if (!booking.boardingCodeHash) {
        throw new Error("No boarding code has been issued for this passenger.");
    }
    const entered = String(code || "").trim();
    if (!/^\d{4}$/.test(entered)) {
        throw new Error("Code does not match.");
    }
    const expected = Buffer.from(booking.boardingCodeHash, "hex");
    const actual = Buffer.from(hashBoardingCode(journey.id, booking.id, entered), "hex");
    if (expected.length !== actual.length || !(0, crypto_1.timingSafeEqual)(expected, actual)) {
        throw new Error("Code does not match.");
    }
    if ((0, eventJourneys_1.eventBoardingEnabled)(journey) && eventLeg === "RETURN") {
        return (0, eventJourneys_1.verifyEventLeg)(journey, booking, actor, nowIso, "RETURN");
    }
    if (booking.boardStatus === "BOARDED" && booking.boardingVerifiedAt) {
        return { ok: true, alreadyVerified: true };
    }
    booking.boardStatus = "BOARDED";
    booking.outboundBoardStatus = "BOARDED";
    booking.outboundBoardedAt = nowIso;
    booking.outboundBoardedBy = actor;
    booking.boardingVerifiedAt = nowIso;
    booking.boardingVerifiedBy = actor;
    return { ok: true };
}
function boardingDisplayStatus(booking) {
    if (booking.reservationStatus === "CANCELLED" || booking.reservationStatus === "LATE_CANCELLED")
        return "CANCELLED";
    if (booking.boardStatus === "NO_SHOW" || booking.reservationStatus === "NO_SHOW")
        return "NO_SHOW";
    if (booking.boardStatus === "BOARDED" || booking.boardStatus === "CHECKED_IN")
        return "VERIFIED";
    return "WAITING";
}
function boardingProgress(bookings) {
    const active = bookings.filter((row) => boardingDisplayStatus(row) !== "CANCELLED");
    const totalSeats = active.reduce((sum, row) => sum + (row.passengers || 0), 0);
    const verifiedSeats = active
        .filter((row) => boardingDisplayStatus(row) === "VERIFIED")
        .reduce((sum, row) => sum + (row.passengers || 0), 0);
    return { verifiedSeats, totalSeats, remainingSeats: Math.max(0, totalSeats - verifiedSeats) };
}
function driverManifestFingerprint(bookings) {
    return bookings
        .filter((row) => boardingDisplayStatus(row) !== "CANCELLED")
        .map((row) => `${row.id}:${row.passengers}:${row.boardingCode || ""}`)
        .sort()
        .join("|");
}
function shouldSendDriverManifest(journey, bookings) {
    if (journey.status !== "CONFIRMED")
        return { send: false, updated: false };
    if (!String(journey.assignedDriverEmail || "").trim())
        return { send: false, updated: false };
    const fingerprint = driverManifestFingerprint(bookings);
    if (!journey.driverManifestSentAt)
        return { send: true, updated: false };
    if (journey.driverManifestFingerprint !== fingerprint)
        return { send: true, updated: true };
    return { send: false, updated: false };
}
function driverManifestLines(bookings, journey) {
    if (journey?.journeyType === "EVENT")
        return (0, eventJourneys_1.eventDriverManifest)(journey, bookings);
    return bookings
        .filter((row) => boardingDisplayStatus(row) !== "CANCELLED")
        .map((row) => `${row.name}\nCode: ${row.boardingCode || "not issued"}\n${row.passengers} passenger${row.passengers === 1 ? "" : "s"}`)
        .join("\n\n");
}
function publicDtoHasBoardingSecrets(row) {
    return ["boardingCode", "boardingCodeHash", "boardingVerifiedBy"].some((key) => key in row && row[key] != null && row[key] !== "");
}
function customerBoardingCodeForView(journey, booking) {
    if (journey.status !== "CONFIRMED")
        return undefined;
    if (!bookingEligibleForBoardingCode(journey, booking))
        return undefined;
    return booking.boardingCode || undefined;
}
