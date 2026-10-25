import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CURRENT_BOOKING_TERMS,
  PREVIOUS_PUBLIC_TERMS,
  acceptanceSummary,
  confirmationTermsParagraph,
  londonWallTimeToUtcMs,
  onlineTermsAcceptance,
  validateStaffTermsReport,
} from "./bookingTerms";

describe("booking terms version", () => {
  it("keeps the journey date separate from the publication date", () => {
    assert.equal(CURRENT_BOOKING_TERMS.appliesToJourneysFrom, "2026-04-01");
    assert.equal(CURRENT_BOOKING_TERMS.publishedOn, "2026-10-25");
    assert.equal(CURRENT_BOOKING_TERMS.version, "2026-10-25");
    assert.equal(PREVIOUS_PUBLIC_TERMS.publicationDateRecorded, false);
    assert.notEqual(PREVIOUS_PUBLIC_TERMS.id, "2026-04-01");
  });
});

describe("online terms agreement", () => {
  it("rejects a booking submitted without agreement", () => {
    const result = onlineTermsAcceptance({
      termsAccepted: false,
      termsVersion: CURRENT_BOOKING_TERMS.version,
      channel: "customer_portal",
    });
    assert.equal(result.ok, false);
  });

  it("rejects a missing or old version", () => {
    assert.equal(
      onlineTermsAcceptance({ termsAccepted: true, termsVersion: "", channel: "website" }).ok,
      false
    );
    assert.equal(
      onlineTermsAcceptance({ termsAccepted: true, termsVersion: "2026-04-01", channel: "website" }).ok,
      false
    );
  });

  it("accepts the published version for the customer portal and the website", () => {
    const portal = onlineTermsAcceptance({
      termsAccepted: true,
      termsVersion: "2026-10-25",
      channel: "customer_portal",
    });
    const website = onlineTermsAcceptance({
      termsAccepted: true,
      termsVersion: "2026-10-25",
      channel: "website",
    });
    assert.equal(portal.ok && portal.method, "customer_portal");
    assert.equal(website.ok && website.version, "2026-10-25");
  });
});

describe("staff reported acceptance", () => {
  it("keeps the reported London time separate from the moment it is checked", () => {
    const nowMs = Date.parse("2026-10-25T18:00:00.000Z");
    const result = validateStaffTermsReport({
      acceptanceMethod: "phone",
      acceptedAtLocal: "2026-10-20T09:15",
      note: "Call with the customer, reference 20 Oct morning",
      nowMs,
    });
    assert.equal(result.ok, true);
    if (result.ok) {
      assert.equal(result.acceptedAtMs, Date.parse("2026-10-20T08:15:00.000Z"));
      assert.notEqual(result.acceptedAtMs, nowMs);
    }
  });

  it("reads London wall time across the October clock change", () => {
    assert.equal(londonWallTimeToUtcMs("2026-10-25T00:30"), Date.parse("2026-10-24T23:30:00.000Z"));
    assert.equal(londonWallTimeToUtcMs("2026-10-25T18:00"), Date.parse("2026-10-25T18:00:00.000Z"));
  });

  it("requires a note and refuses a future time", () => {
    const nowMs = Date.parse("2026-10-25T18:00:00.000Z");
    assert.equal(
      validateStaffTermsReport({
        acceptanceMethod: "email",
        acceptedAtLocal: "2026-10-25T17:00",
        note: " ",
        nowMs,
      }).ok,
      false
    );
    assert.equal(
      validateStaffTermsReport({
        acceptanceMethod: "whatsapp",
        acceptedAtLocal: "2026-10-26T09:00",
        note: "Message on file",
        nowMs,
      }).ok,
      false
    );
  });
});

describe("acceptance display", () => {
  it("does not treat a historical booking as accepted", () => {
    const summary = acceptanceSummary({});
    assert.equal(summary.recorded, false);
    assert.equal(summary.text, "Acceptance not recorded.");
    assert.doesNotMatch(confirmationTermsParagraph({}), /Accepted /);
    assert.match(confirmationTermsParagraph({}), /Acceptance not recorded/);
    assert.match(confirmationTermsParagraph({}), /2026-10-25/);
  });

  it("shows the version that was actually stored", () => {
    const summary = acceptanceSummary({
      termsAccepted: true,
      termsVersion: "2026-10-25",
      acceptanceMethod: "customer_portal",
      termsAcceptedAt: "2026-10-25T18:05:00.000Z",
    });
    assert.equal(summary.recorded, true);
    if (summary.recorded) {
      assert.equal(summary.url, CURRENT_BOOKING_TERMS.url);
      assert.match(summary.text, /Customer portal/);
      assert.match(summary.text, /25 Oct 2026/);
    }
  });
});
