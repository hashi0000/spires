import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

function repoRoot(): string {
  const starts = [process.cwd(), __dirname];
  for (const start of starts) {
    let dir = start;
    for (let i = 0; i < 8; i += 1) {
      if (existsSync(join(dir, "spires-website", "offer-terms.html"))) return dir;
      dir = join(dir, "..");
    }
  }
  throw new Error("Could not find the repository root from the test.");
}
import { CUSTOMER_OFFERS, claimFor, offerStatus } from "./catalog";
import { HALF_TERM_DISCOUNT_PENCE, HALF_TERM_LAST_YMD, HALF_TERM_START_YMD, decideHalfTermPromotion } from "../quotes/halfTerm";
import {
  CUSTOMER_LINKS,
  buildLoginDetailsEmail,
  buildWelcomeEmail,
  quoteCustomerTerms,
  decideWelcomeClaim,
  welcomeFailureShouldRetry,
  welcomeSendDecision,
  withoutExpiredSignupOffer,
} from "./messages";

const afterSignupOffer = Date.parse("2026-11-14T12:00:00Z");
const duringHalfTerm = Date.parse("2026-10-26T12:00:00Z");

describe("customer offer catalog", () => {
  it("does not claim the expired online signup discount", () => {
    const offer = CUSTOMER_OFFERS.find((row) => row.id === "online-airport-return");
    assert.ok(offer);
    assert.equal(offerStatus(offer, afterSignupOffer), "withdrawn");
    assert.equal(claimFor("online-airport-return", afterSignupOffer), null);
    assert.equal(claimFor("online-airport-return", Date.parse("2025-06-01T12:00:00Z")), null);
  });

  it("keeps the half term window on the shared catalog and excludes it after the end date", () => {
    assert.equal(HALF_TERM_START_YMD, "2026-10-25");
    assert.equal(HALF_TERM_LAST_YMD, "2026-11-02");
    assert.equal(HALF_TERM_DISCOUNT_PENCE, 500);
    assert.equal(offerStatus(CUSTOMER_OFFERS.find((row) => row.id === "half-term-2026")!, duringHalfTerm), "active");
    assert.equal(offerStatus(CUSTOMER_OFFERS.find((row) => row.id === "half-term-2026")!, afterSignupOffer), "expired");
    const later = decideHalfTermPromotion(
      {
        source: "website",
        bookingType: "return",
        pickup: "Oxford",
        destination: "Heathrow",
        returnPickupLocation: "Heathrow",
        returnDestination: "Oxford",
        vehicleType: "standard",
      },
      afterSignupOffer
    );
    assert.equal(later.eligible, false);
    assert.equal(later.discountPence, 0);
  });

  it("leaves a new welcome email without the signup discount and with working contact links", () => {
    const mail = buildWelcomeEmail({ fullName: "Alex <script>", email: "alex@example.com", nowMs: afterSignupOffer });
    assert.equal(mail.html.includes("£5 off"), false);
    assert.equal(mail.html.includes("December 31"), false);
    assert.equal(mail.html.includes("Special Offer"), false);
    assert.equal(mail.html.includes("<script>"), false);
    assert.equal(mail.html.includes(CUSTOMER_LINKS.PORTAL_URL), true);
    assert.equal(mail.html.includes(CUSTOMER_LINKS.SITE_URL), true);
    assert.equal(mail.html.includes(CUSTOMER_LINKS.PHONE_TEL), true);
    assert.equal(mail.html.includes(`mailto:${CUSTOMER_LINKS.EMAIL}`), true);
    assert.equal(mail.html.includes(CUSTOMER_LINKS.WHATSAPP), true);
    assert.match(mail.html, /does not confirm the booking/);
    assert.match(mail.html, /We do not email your password/);
    assert.match(mail.text, /Sign in with alex@example.com/);
    assert.equal(mail.text.includes("password is"), false);
    assert.equal(welcomeSendDecision("sent", 0), "already_sent");
    assert.equal(welcomeSendDecision("failed", 3), "stopped");
    assert.equal(welcomeSendDecision("failed", 2), "send");
    assert.equal(decideWelcomeClaim({ welcomeEmailStatus: "sending", welcomeEmailAttempts: 1 }, "id").action, "skip");
    assert.equal(decideWelcomeClaim({ welcomeEmailStatus: "failed", welcomeEmailAttempts: 1 }, "id").action, "send");
    assert.equal(welcomeFailureShouldRetry(1), true);
    assert.equal(welcomeFailureShouldRetry(3), false);
    const login = buildLoginDetailsEmail({ fullName: "Alex", email: "alex@example.com" });
    assert.equal(login.html.includes("£5"), false);
    assert.equal(login.html.includes(CUSTOMER_LINKS.PORTAL_URL), true);
  });

  it("strips a queued copy of the expired signup block and keeps a captured half term quote sentence", () => {
    const queued = `<p>Hello</p><div><h2>Special Offer</h2><p>Book an airport return trip and get <strong>£5 off the total</strong>. Valid until December 31st, 2025.</p></div><p>Account</p>`;
    const cleaned = withoutExpiredSignupOffer(queued, afterSignupOffer);
    assert.equal(cleaned.includes("£5 off the total"), false);
    assert.equal(cleaned.includes("Account"), true);
    const halfTerm = withoutExpiredSignupOffer(
      "<p>The half term offer is £5 off this complete airport return and is not combined with other offers.</p>",
      afterSignupOffer
    );
    assert.match(halfTerm, /£5 off this complete airport return/);
    const mail = buildWelcomeEmail({ fullName: "Alex Stone", nowMs: afterSignupOffer });
    assert.equal(mail.text.includes("£5"), false);
    assert.match(mail.text, /does not confirm the booking/);
    assert.equal(quoteCustomerTerms(0).includes("half term"), false);
    assert.match(quoteCustomerTerms(0), /not a confirmed booking/);
    assert.match(quoteCustomerTerms(500), /half term offer is £5 off/);
    assert.match(quoteCustomerTerms(500), /not a confirmed booking/);
  });

  it("matches the admin inventory to the same offer ids", () => {
    const admin = readFileSync(join(repoRoot(), "spires-admin-fresh/src/data/customerCommunications.ts"), "utf8");
    for (const offer of CUSTOMER_OFFERS) assert.match(admin, new RegExp(offer.id));
    assert.match(admin, /14 November 2026/);
    assert.match(admin, /Firebase Authentication templates/);
  });

  it("does not advertise the signup discount on the public offer page", () => {
    const page = readFileSync(join(repoRoot(), "spires-website/offer-terms.html"), "utf8");
    assert.match(page, /This offer has been withdrawn/i);
    assert.equal(/follow the earlier date/i.test(page), false);
    assert.equal(/Get £5 off your airport return/i.test(page), false);
    assert.equal(/save £5 on the total fare/i.test(page), false);
  });
});
