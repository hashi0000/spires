"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.HALF_TERM_LAST_YMD = exports.HALF_TERM_START_YMD = exports.HALF_TERM_DISCOUNT_PENCE = exports.HALF_TERM_CODE = void 0;
exports.isHalfTermRequestWindow = isHalfTermRequestWindow;
exports.isHalloweenDecorWindow = isHalloweenDecorWindow;
exports.normaliseVehicle = normaliseVehicle;
exports.isOnlineQuoteSource = isOnlineQuoteSource;
exports.isAirportReturn = isAirportReturn;
exports.qualifyingReturnNow = qualifyingReturnNow;
exports.decideHalfTermPromotion = decideHalfTermPromotion;
exports.poundsToPence = poundsToPence;
exports.formatPence = formatPence;
exports.quoteTotals = quoteTotals;
const londonTime_1 = require("./londonTime");
/** 2026 half term only. Do not treat these dates as an annual rule. */
exports.HALF_TERM_CODE = "HALFTERM";
exports.HALF_TERM_DISCOUNT_PENCE = 500;
exports.HALF_TERM_START_YMD = "2026-10-25";
exports.HALF_TERM_LAST_YMD = "2026-11-02";
const AIRPORT_TEXT = /\b(heathrow|gatwick|stansted|luton|birmingham airport|bristol airport|london city|lhr|lgw|stn|ltn|bhx|brs|lcy|airport)\b/i;
function isHalfTermRequestWindow(ms) {
    const ymd = (0, londonTime_1.londonYmd)(ms);
    return ymd >= exports.HALF_TERM_START_YMD && ymd <= exports.HALF_TERM_LAST_YMD;
}
function isHalloweenDecorWindow(ms) {
    const ymd = (0, londonTime_1.londonYmd)(ms);
    return ymd >= "2026-10-25" && ymd <= "2026-10-31";
}
function normaliseVehicle(raw) {
    const n = String(raw || "")
        .toLowerCase()
        .replace(/[_-]+/g, " ")
        .trim();
    if (n.includes("8") && n.includes("seat"))
        return "8_seater";
    if (n === "standard" || n === "car" || n.includes("standard car"))
        return "standard";
    return "other";
}
function isOnlineQuoteSource(source) {
    const n = String(source || "").toLowerCase();
    return n === "website" || n === "customer_app";
}
function textOf(journey) {
    return [
        journey.pickup,
        journey.pickupLocation,
        journey.destination,
        journey.returnPickupLocation,
        journey.returnDestination,
        journey.service,
    ]
        .filter(Boolean)
        .join(" ");
}
function isAirportReturn(journey) {
    const isReturn = journey.bookingType === "return" || journey.returnTrip === true;
    if (!isReturn)
        return false;
    const outbound = String(journey.pickup || journey.pickupLocation || "").trim();
    const destination = String(journey.destination || "").trim();
    const returnFrom = String(journey.returnPickupLocation || "").trim();
    const returnTo = String(journey.returnDestination || "").trim();
    if (!outbound || !destination || !returnFrom || !returnTo)
        return false;
    if (journey.airportCollection === true || journey.returnAirportCollection === true)
        return true;
    if (String(journey.service || "").toLowerCase().includes("airport"))
        return true;
    return AIRPORT_TEXT.test(textOf(journey));
}
function qualifyingReturnNow(journey) {
    if (!isAirportReturn(journey))
        return false;
    if (normaliseVehicle(journey.vehicleType) === "other")
        return false;
    const other = String(journey.otherOfferCode || "").trim();
    if (other && other !== exports.HALF_TERM_CODE)
        return false;
    return true;
}
/**
 * Decide eligibility from a trusted server timestamp.
 * The customer does not need to enter a code. Ineligible requests are stored as not eligible
 * so a later edit cannot invent the offer, and eligible requests keep it after the window closes.
 */
function decideHalfTermPromotion(journey, trustedMs) {
    const reasons = [];
    const source = String(journey.source || "");
    if (!isOnlineQuoteSource(source))
        reasons.push("not_website_or_customer_app");
    if (!isHalfTermRequestWindow(trustedMs))
        reasons.push("outside_2026_window");
    if (!isAirportReturn(journey))
        reasons.push("not_airport_return");
    if (normaliseVehicle(journey.vehicleType) === "other")
        reasons.push("vehicle_not_standard_or_8_seater");
    const other = String(journey.otherOfferCode || "").trim();
    if (other && other !== exports.HALF_TERM_CODE)
        reasons.push("other_offer");
    const eligible = reasons.length === 0;
    return {
        code: eligible ? exports.HALF_TERM_CODE : "",
        eligible,
        discountPence: eligible ? exports.HALF_TERM_DISCOUNT_PENCE : 0,
        source,
        capturedAtMs: trustedMs,
        serverDecided: true,
        reasons,
    };
}
function poundsToPence(raw) {
    const s = String(raw)
        .trim()
        .replace(/£/g, "")
        .replace(/,/g, "");
    if (!/^\d+(\.\d{1,2})?$/.test(s)) {
        throw new Error("Enter the normal fare in pounds and pence.");
    }
    const [whole, frac = ""] = s.split(".");
    return Number(whole) * 100 + Number(frac.padEnd(2, "0"));
}
function formatPence(pence) {
    const safe = Number.isFinite(pence) ? Math.round(pence) : 0;
    const pounds = safe / 100;
    return `£${pounds.toLocaleString("en-GB", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}
/**
 * Apply the captured £5 once to the normal return total.
 * Pass the pre discount fare. Do not pass the already reduced total.
 */
function quoteTotals(input) {
    const normalFarePence = Math.max(0, Math.round(input.normalFarePence));
    const discountPence = input.promotionEligible && input.stillQualifyingReturn ? exports.HALF_TERM_DISCOUNT_PENCE : 0;
    return {
        normalFarePence,
        discountPence,
        finalFarePence: Math.max(0, normalFarePence - discountPence),
    };
}
