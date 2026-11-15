import { londonYmd } from "../quotes/londonTime";

/**
 * Promotions that may appear in new customer messages.
 * A claim is included only when status is "active" at send time.
 * Return fare savings on the rate card are not promotions.
 * A discount already stored on a quote or booking is not recalculated from this list.
 */
export type CustomerOffer = {
  id: string;
  name: string;
  customerClaim: string;
  discountPence: number | null;
  /** Inclusive London calendar date. Null means the date was not recorded. */
  startsOn: string | null;
  endsOn: string | null;
  eligibility: string;
  /** Extra switch. An end date that has passed blocks a claim even when this is true. */
  active: boolean;
  usedIn: string[];
  note: string;
};

export const OFFER_CATALOG_REVIEWED_ON = "2026-11-14";

export const CUSTOMER_OFFERS: CustomerOffer[] = [
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

export type OfferStatus = "active" | "scheduled" | "expired" | "withdrawn" | "not_configured";

export function offerById(id: string): CustomerOffer {
  const found = CUSTOMER_OFFERS.find((offer) => offer.id === id);
  if (!found) throw new Error(`Unknown offer ${id}`);
  return found;
}

export function offerStatus(offer: CustomerOffer, nowMs: number): OfferStatus {
  if (!offer.active) return "withdrawn";
  const ymd = londonYmd(nowMs);
  if (!offer.startsOn || !offer.endsOn || offer.discountPence == null) return "not_configured";
  if (ymd > offer.endsOn) return "expired";
  if (ymd < offer.startsOn) return "scheduled";
  return "active";
}

/** A promotional sentence may be generated only for an offer that is active on this date. */
export function claimFor(id: string, nowMs: number): CustomerOffer | null {
  const offer = offerById(id);
  return offerStatus(offer, nowMs) === "active" ? offer : null;
}
