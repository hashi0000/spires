"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingTerms_1 = require("./bookingTerms");
(0, node_test_1.describe)("booking terms version", () => {
    (0, node_test_1.it)("keeps the journey date separate from the publication date", () => {
        strict_1.default.equal(bookingTerms_1.CURRENT_BOOKING_TERMS.appliesToJourneysFrom, "2026-04-01");
        strict_1.default.equal(bookingTerms_1.CURRENT_BOOKING_TERMS.publishedOn, "2026-10-25");
        strict_1.default.equal(bookingTerms_1.CURRENT_BOOKING_TERMS.version, "2026-10-25");
        strict_1.default.equal(bookingTerms_1.PREVIOUS_PUBLIC_TERMS.publicationDateRecorded, false);
        strict_1.default.notEqual(bookingTerms_1.PREVIOUS_PUBLIC_TERMS.id, "2026-04-01");
    });
});
(0, node_test_1.describe)("online terms agreement", () => {
    (0, node_test_1.it)("rejects a booking submitted without agreement", () => {
        const result = (0, bookingTerms_1.onlineTermsAcceptance)({
            termsAccepted: false,
            termsVersion: bookingTerms_1.CURRENT_BOOKING_TERMS.version,
            channel: "customer_portal",
        });
        strict_1.default.equal(result.ok, false);
    });
    (0, node_test_1.it)("rejects a missing or old version", () => {
        strict_1.default.equal((0, bookingTerms_1.onlineTermsAcceptance)({ termsAccepted: true, termsVersion: "", channel: "website" }).ok, false);
        strict_1.default.equal((0, bookingTerms_1.onlineTermsAcceptance)({ termsAccepted: true, termsVersion: "2026-04-01", channel: "website" }).ok, false);
    });
    (0, node_test_1.it)("accepts the published version for the customer portal and the website", () => {
        const portal = (0, bookingTerms_1.onlineTermsAcceptance)({
            termsAccepted: true,
            termsVersion: "2026-10-25",
            channel: "customer_portal",
        });
        const website = (0, bookingTerms_1.onlineTermsAcceptance)({
            termsAccepted: true,
            termsVersion: "2026-10-25",
            channel: "website",
        });
        strict_1.default.equal(portal.ok && portal.method, "customer_portal");
        strict_1.default.equal(website.ok && website.version, "2026-10-25");
    });
});
(0, node_test_1.describe)("staff reported acceptance", () => {
    (0, node_test_1.it)("keeps the reported London time separate from the moment it is checked", () => {
        const nowMs = Date.parse("2026-10-25T18:00:00.000Z");
        const result = (0, bookingTerms_1.validateStaffTermsReport)({
            acceptanceMethod: "phone",
            acceptedAtLocal: "2026-10-20T09:15",
            note: "Call with the customer, reference 20 Oct morning",
            nowMs,
        });
        strict_1.default.equal(result.ok, true);
        if (result.ok) {
            strict_1.default.equal(result.acceptedAtMs, Date.parse("2026-10-20T08:15:00.000Z"));
            strict_1.default.notEqual(result.acceptedAtMs, nowMs);
        }
    });
    (0, node_test_1.it)("reads London wall time across the October clock change", () => {
        strict_1.default.equal((0, bookingTerms_1.londonWallTimeToUtcMs)("2026-10-25T00:30"), Date.parse("2026-10-24T23:30:00.000Z"));
        strict_1.default.equal((0, bookingTerms_1.londonWallTimeToUtcMs)("2026-10-25T18:00"), Date.parse("2026-10-25T18:00:00.000Z"));
    });
    (0, node_test_1.it)("requires a note and refuses a future time", () => {
        const nowMs = Date.parse("2026-10-25T18:00:00.000Z");
        strict_1.default.equal((0, bookingTerms_1.validateStaffTermsReport)({
            acceptanceMethod: "email",
            acceptedAtLocal: "2026-10-25T17:00",
            note: " ",
            nowMs,
        }).ok, false);
        strict_1.default.equal((0, bookingTerms_1.validateStaffTermsReport)({
            acceptanceMethod: "whatsapp",
            acceptedAtLocal: "2026-10-26T09:00",
            note: "Message on file",
            nowMs,
        }).ok, false);
    });
});
(0, node_test_1.describe)("acceptance display", () => {
    (0, node_test_1.it)("does not treat a historical booking as accepted", () => {
        const summary = (0, bookingTerms_1.acceptanceSummary)({});
        strict_1.default.equal(summary.recorded, false);
        strict_1.default.equal(summary.text, "Acceptance not recorded.");
        strict_1.default.doesNotMatch((0, bookingTerms_1.confirmationTermsParagraph)({}), /Accepted /);
        strict_1.default.match((0, bookingTerms_1.confirmationTermsParagraph)({}), /Acceptance not recorded/);
        strict_1.default.match((0, bookingTerms_1.confirmationTermsParagraph)({}), /2026-10-25/);
    });
    (0, node_test_1.it)("shows the version that was actually stored", () => {
        const summary = (0, bookingTerms_1.acceptanceSummary)({
            termsAccepted: true,
            termsVersion: "2026-10-25",
            acceptanceMethod: "customer_portal",
            termsAcceptedAt: "2026-10-25T18:05:00.000Z",
        });
        strict_1.default.equal(summary.recorded, true);
        if (summary.recorded) {
            strict_1.default.equal(summary.url, bookingTerms_1.CURRENT_BOOKING_TERMS.url);
            strict_1.default.match(summary.text, /Customer portal/);
            strict_1.default.match(summary.text, /25 Oct 2026/);
        }
    });
});
