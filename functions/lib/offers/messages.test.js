"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const node_fs_1 = require("node:fs");
const node_path_1 = require("node:path");
function repoRoot() {
    const starts = [process.cwd(), __dirname];
    for (const start of starts) {
        let dir = start;
        for (let i = 0; i < 8; i += 1) {
            if ((0, node_fs_1.existsSync)((0, node_path_1.join)(dir, "spires-website", "offer-terms.html")))
                return dir;
            dir = (0, node_path_1.join)(dir, "..");
        }
    }
    throw new Error("Could not find the repository root from the test.");
}
const catalog_1 = require("./catalog");
const halfTerm_1 = require("../quotes/halfTerm");
const messages_1 = require("./messages");
const afterSignupOffer = Date.parse("2026-11-14T12:00:00Z");
const duringHalfTerm = Date.parse("2026-10-26T12:00:00Z");
(0, node_test_1.describe)("customer offer catalog", () => {
    (0, node_test_1.it)("does not claim the expired online signup discount", () => {
        const offer = catalog_1.CUSTOMER_OFFERS.find((row) => row.id === "online-airport-return");
        strict_1.default.ok(offer);
        strict_1.default.equal((0, catalog_1.offerStatus)(offer, afterSignupOffer), "withdrawn");
        strict_1.default.equal((0, catalog_1.claimFor)("online-airport-return", afterSignupOffer), null);
        strict_1.default.equal((0, catalog_1.claimFor)("online-airport-return", Date.parse("2025-06-01T12:00:00Z")), null);
    });
    (0, node_test_1.it)("keeps the half term window on the shared catalog and excludes it after the end date", () => {
        strict_1.default.equal(halfTerm_1.HALF_TERM_START_YMD, "2026-10-25");
        strict_1.default.equal(halfTerm_1.HALF_TERM_LAST_YMD, "2026-11-02");
        strict_1.default.equal(halfTerm_1.HALF_TERM_DISCOUNT_PENCE, 500);
        strict_1.default.equal((0, catalog_1.offerStatus)(catalog_1.CUSTOMER_OFFERS.find((row) => row.id === "half-term-2026"), duringHalfTerm), "active");
        strict_1.default.equal((0, catalog_1.offerStatus)(catalog_1.CUSTOMER_OFFERS.find((row) => row.id === "half-term-2026"), afterSignupOffer), "expired");
        const later = (0, halfTerm_1.decideHalfTermPromotion)({
            source: "website",
            bookingType: "return",
            pickup: "Oxford",
            destination: "Heathrow",
            returnPickupLocation: "Heathrow",
            returnDestination: "Oxford",
            vehicleType: "standard",
        }, afterSignupOffer);
        strict_1.default.equal(later.eligible, false);
        strict_1.default.equal(later.discountPence, 0);
    });
    (0, node_test_1.it)("leaves a new welcome email without the signup discount and with working contact links", () => {
        const mail = (0, messages_1.buildWelcomeEmail)({ fullName: "Alex <script>", email: "alex@example.com", nowMs: afterSignupOffer });
        strict_1.default.equal(mail.html.includes("£5 off"), false);
        strict_1.default.equal(mail.html.includes("December 31"), false);
        strict_1.default.equal(mail.html.includes("Special Offer"), false);
        strict_1.default.equal(mail.html.includes("<script>"), false);
        strict_1.default.equal(mail.html.includes(messages_1.CUSTOMER_LINKS.PORTAL_URL), true);
        strict_1.default.equal(mail.html.includes(messages_1.CUSTOMER_LINKS.SITE_URL), true);
        strict_1.default.equal(mail.html.includes(messages_1.CUSTOMER_LINKS.PHONE_TEL), true);
        strict_1.default.equal(mail.html.includes(`mailto:${messages_1.CUSTOMER_LINKS.EMAIL}`), true);
        strict_1.default.equal(mail.html.includes(messages_1.CUSTOMER_LINKS.WHATSAPP), true);
        strict_1.default.match(mail.html, /does not confirm the booking/);
        strict_1.default.match(mail.html, /We do not email your password/);
        strict_1.default.match(mail.text, /Sign in with alex@example.com/);
        strict_1.default.equal(mail.text.includes("password is"), false);
        strict_1.default.equal((0, messages_1.welcomeSendDecision)("sent", 0), "already_sent");
        strict_1.default.equal((0, messages_1.welcomeSendDecision)("failed", 3), "stopped");
        strict_1.default.equal((0, messages_1.welcomeSendDecision)("failed", 2), "send");
        strict_1.default.equal((0, messages_1.decideWelcomeClaim)({ welcomeEmailStatus: "sending", welcomeEmailAttempts: 1 }, "id").action, "skip");
        strict_1.default.equal((0, messages_1.decideWelcomeClaim)({ welcomeEmailStatus: "failed", welcomeEmailAttempts: 1 }, "id").action, "send");
        strict_1.default.equal((0, messages_1.welcomeFailureShouldRetry)(1), true);
        strict_1.default.equal((0, messages_1.welcomeFailureShouldRetry)(3), false);
        const login = (0, messages_1.buildLoginDetailsEmail)({ fullName: "Alex", email: "alex@example.com" });
        strict_1.default.equal(login.html.includes("£5"), false);
        strict_1.default.equal(login.html.includes(messages_1.CUSTOMER_LINKS.PORTAL_URL), true);
    });
    (0, node_test_1.it)("strips a queued copy of the expired signup block and keeps a captured half term quote sentence", () => {
        const queued = `<p>Hello</p><div><h2>Special Offer</h2><p>Book an airport return trip and get <strong>£5 off the total</strong>. Valid until December 31st, 2025.</p></div><p>Account</p>`;
        const cleaned = (0, messages_1.withoutExpiredSignupOffer)(queued, afterSignupOffer);
        strict_1.default.equal(cleaned.includes("£5 off the total"), false);
        strict_1.default.equal(cleaned.includes("Account"), true);
        const halfTerm = (0, messages_1.withoutExpiredSignupOffer)("<p>The half term offer is £5 off this complete airport return and is not combined with other offers.</p>", afterSignupOffer);
        strict_1.default.match(halfTerm, /£5 off this complete airport return/);
        const mail = (0, messages_1.buildWelcomeEmail)({ fullName: "Alex Stone", nowMs: afterSignupOffer });
        strict_1.default.equal(mail.text.includes("£5"), false);
        strict_1.default.match(mail.text, /does not confirm the booking/);
        strict_1.default.equal((0, messages_1.quoteCustomerTerms)(0).includes("half term"), false);
        strict_1.default.match((0, messages_1.quoteCustomerTerms)(0), /not a confirmed booking/);
        strict_1.default.match((0, messages_1.quoteCustomerTerms)(500), /half term offer is £5 off/);
        strict_1.default.match((0, messages_1.quoteCustomerTerms)(500), /not a confirmed booking/);
    });
    (0, node_test_1.it)("matches the admin inventory to the same offer ids", () => {
        const admin = (0, node_fs_1.readFileSync)((0, node_path_1.join)(repoRoot(), "spires-admin-fresh/src/data/customerCommunications.ts"), "utf8");
        for (const offer of catalog_1.CUSTOMER_OFFERS)
            strict_1.default.match(admin, new RegExp(offer.id));
        strict_1.default.match(admin, /14 November 2026/);
        strict_1.default.match(admin, /Firebase Authentication templates/);
    });
    (0, node_test_1.it)("does not advertise the signup discount on the public offer page", () => {
        const page = (0, node_fs_1.readFileSync)((0, node_path_1.join)(repoRoot(), "spires-website/offer-terms.html"), "utf8");
        strict_1.default.match(page, /This offer has been withdrawn/i);
        strict_1.default.equal(/follow the earlier date/i.test(page), false);
        strict_1.default.equal(/Get £5 off your airport return/i.test(page), false);
        strict_1.default.equal(/save £5 on the total fare/i.test(page), false);
    });
});
