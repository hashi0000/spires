"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const enquiry_1 = require("./enquiry");
const valid = {
    organisation: "Oxford Example Ltd",
    name: "Alex Stone",
    email: "alex@example.com",
    phone: "07700 900000",
    organisationType: "business",
    travelNeeds: "Airport runs for visiting staff, usually Heathrow.",
    message: "",
};
(0, node_test_1.describe)("business account enquiry", () => {
    (0, node_test_1.it)("uses the agreed email subject", () => {
        strict_1.default.equal(enquiry_1.BUSINESS_ENQUIRY_SUBJECT, "New Business Account Enquiry");
    });
    (0, node_test_1.it)("accepts a complete enquiry and keeps the organisation type label", () => {
        const result = (0, enquiry_1.validateBusinessEnquiry)(valid);
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.value.organisation, "Oxford Example Ltd");
        strict_1.default.equal((0, enquiry_1.organisationTypeLabel)(result.value.organisationType), "Business");
    });
    (0, node_test_1.it)("rejects a missing organisation, a bad email and a short travel note", () => {
        strict_1.default.equal((0, enquiry_1.validateBusinessEnquiry)({ ...valid, organisation: "A" }).ok, false);
        const email = (0, enquiry_1.validateBusinessEnquiry)({ ...valid, email: "not-an-email" });
        strict_1.default.equal(email.ok, false);
        const needs = (0, enquiry_1.validateBusinessEnquiry)({ ...valid, travelNeeds: "Airport" });
        strict_1.default.equal(needs.ok, false);
    });
    (0, node_test_1.it)("does not treat an optional organisation type as required", () => {
        const result = (0, enquiry_1.validateBusinessEnquiry)({ ...valid, organisationType: "" });
        strict_1.default.equal(result.ok, true);
    });
    (0, node_test_1.it)("ignores a honeypot submission without building an enquiry", () => {
        const result = (0, enquiry_1.validateBusinessEnquiry)({ ...valid, _gotcha: "bot" });
        strict_1.default.deepEqual(result, { ok: true, spam: true });
    });
    (0, node_test_1.it)("escapes the enquiry email so a name cannot change the message", () => {
        const html = (0, enquiry_1.businessEnquiryHtml)({
            ...valid,
            organisation: `<script>alert("x")</script>`,
        });
        strict_1.default.equal(html.includes("<script>"), false);
        strict_1.default.equal(html.includes("does not open an account"), true);
    });
});
