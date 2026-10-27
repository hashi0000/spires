import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  BUSINESS_ENQUIRY_SUBJECT,
  businessEnquiryHtml,
  organisationTypeLabel,
  validateBusinessEnquiry,
} from "./enquiry";

const valid = {
  organisation: "Oxford Example Ltd",
  name: "Alex Stone",
  email: "alex@example.com",
  phone: "07700 900000",
  organisationType: "business",
  travelNeeds: "Airport runs for visiting staff, usually Heathrow.",
  message: "",
};

describe("business account enquiry", () => {
  it("uses the agreed email subject", () => {
    assert.equal(BUSINESS_ENQUIRY_SUBJECT, "New Business Account Enquiry");
  });

  it("accepts a complete enquiry and keeps the organisation type label", () => {
    const result = validateBusinessEnquiry(valid);
    assert.equal(result.ok, true);
    if (!result.ok || result.spam) return;
    assert.equal(result.value.organisation, "Oxford Example Ltd");
    assert.equal(organisationTypeLabel(result.value.organisationType), "Business");
  });

  it("rejects a missing organisation, a bad email and a short travel note", () => {
    assert.equal(validateBusinessEnquiry({ ...valid, organisation: "A" }).ok, false);
    const email = validateBusinessEnquiry({ ...valid, email: "not-an-email" });
    assert.equal(email.ok, false);
    const needs = validateBusinessEnquiry({ ...valid, travelNeeds: "Airport" });
    assert.equal(needs.ok, false);
  });

  it("does not treat an optional organisation type as required", () => {
    const result = validateBusinessEnquiry({ ...valid, organisationType: "" });
    assert.equal(result.ok, true);
  });

  it("ignores a honeypot submission without building an enquiry", () => {
    const result = validateBusinessEnquiry({ ...valid, _gotcha: "bot" });
    assert.deepEqual(result, { ok: true, spam: true });
  });

  it("escapes the enquiry email so a name cannot change the message", () => {
    const html = businessEnquiryHtml({
      ...valid,
      organisation: `<script>alert("x")</script>`,
    });
    assert.equal(html.includes("<script>"), false);
    assert.equal(html.includes("does not open an account"), true);
  });
});
