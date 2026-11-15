"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.CUSTOMER_OFFERS = exports.OFFER_CATALOG_REVIEWED_ON = void 0;
exports.offerById = offerById;
exports.offerStatus = offerStatus;
exports.claimFor = claimFor;
const londonTime_1 = require("../quotes/londonTime");
exports.OFFER_CATALOG_REVIEWED_ON = "2026-11-14";
exports.CUSTOMER_OFFERS = [
    {
        id: "online-airport-return",
        name: "Online airport return",
        customerClaim: "£5 off an airport return booked online",
        discountPence: 500,
        startsOn: null,
        endsOn: null,
        eligibility: "Previously advertised to new customers for an airport return booked online.",
        active: false,
        usedIn: [
            "Signup welcome email (withdrawn)",
            "spires-website/offer-terms.html (withdrawn notice)",
        ],
        note: "Withdrawn by instruction. It must not appear in a new signup, welcome or login email. Old advertised end dates are not used to decide this.",
    },
    {
        id: "half-term-2026",
        name: "Half term 2026",
        customerClaim: "£5 off one complete airport return booked online during the 2026 half term window",
        discountPence: 500,
        startsOn: "2026-10-25",
        endsOn: "2026-11-02",
        eligibility: "Website or customer portal request for a Standard Car or 8 Seater airport return, with no other offer code. Captured on the booking at request time.",
        active: true,
        usedIn: ["Quote email and quote record, only when that booking already has the captured discount"],
        note: "This is one dated campaign, not an annual rule. A booking that captured the discount keeps it after the window closes. A new request outside the window does not receive it.",
    },
    {
        id: "student-id",
        name: "Student discount",
        customerClaim: "",
        discountPence: null,
        startsOn: null,
        endsOn: null,
        eligibility: "The website says Oxford University and Oxford Brookes students can mention a student discount and show ID. No amount or dates are stored here.",
        active: false,
        usedIn: ["Website pages only. Not inserted into emails or PDFs from this repository."],
        note: "Do not invent an amount in a message. Confirm the current student discount before describing it as a fixed offer.",
    },
];
function offerById(id) {
    const found = exports.CUSTOMER_OFFERS.find((offer) => offer.id === id);
    if (!found)
        throw new Error(`Unknown offer ${id}`);
    return found;
}
function offerStatus(offer, nowMs) {
    if (!offer.active)
        return "withdrawn";
    const ymd = (0, londonTime_1.londonYmd)(nowMs);
    if (!offer.startsOn || !offer.endsOn || offer.discountPence == null)
        return "not_configured";
    if (ymd > offer.endsOn)
        return "expired";
    if (ymd < offer.startsOn)
        return "scheduled";
    return "active";
}
/** A promotional sentence may be generated only for an offer that is active on this date. */
function claimFor(id, nowMs) {
    const offer = offerById(id);
    return offerStatus(offer, nowMs) === "active" ? offer : null;
}
