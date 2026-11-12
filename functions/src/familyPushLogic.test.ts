import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  familyJobChangeNotice,
  familyJobDueNotices,
  familyPushGone,
  familyPushSubscription,
} from "./familyPushLogic";

const NOW = Date.parse("2026-11-12T18:00:00.000Z");
const FUTURE = "2026-11-13T09:00:00.000Z";

function booking(extra: Record<string, unknown> = {}) {
  return {
    bookingNumber: "SP100",
    status: "confirmed",
    pickupTime: FUTURE,
    pickupLocation: "Heathrow Terminal 5",
    destination: "Oxford",
    hirerName: "Private Customer",
    hirerPhone: "07700900000",
    hirerEmail: "private@example.com",
    notes: "Gate note",
    ...extra,
  };
}

describe("family job push notices", () => {
  it("alerts for a new upcoming job without personal details", () => {
    const notice = familyJobChangeNotice(null, booking(), "booking-1", NOW);
    assert.ok(notice);
    assert.equal(notice?.title, "New job");
    assert.match(notice?.body || "", /SP100/);
    assert.match(notice?.body || "", /Heathrow Terminal 5 to Oxford/);
    assert.equal((notice?.body || "").includes("07700900000"), false);
    assert.equal((notice?.body || "").includes("Private Customer"), false);
    assert.equal((notice?.body || "").includes("private@example.com"), false);
    assert.equal((notice?.body || "").includes("Gate note"), false);
    assert.equal(notice?.url, "/office-jobs");
  });

  it("stays quiet for a past job, a note change, and a test record", () => {
    assert.equal(familyJobChangeNotice(null, booking({ pickupTime: "2026-01-01T09:00:00.000Z" }), "booking-1", NOW), null);
    const before = booking();
    assert.equal(familyJobChangeNotice(before, booking({ notes: "Changed note" }), "booking-1", NOW), null);
    assert.equal(familyJobChangeNotice(null, booking({ bookingNumber: "TEST1" }), "booking-1", NOW), null);
    assert.equal(familyJobChangeNotice(null, booking({ brand: "spires_international" }), "booking-1", NOW), null);
    assert.equal(familyJobChangeNotice(booking({ pickupTime: "2026-01-01T09:00:00.000Z" }), booking({ pickupTime: "2026-01-01T09:00:00.000Z", status: "cancelled" }), "booking-1", NOW), null);
  });

  it("shows a London time across GMT and BST", () => {
    const winter = familyJobChangeNotice(null, booking({ pickupTime: "2026-01-15T09:00:00.000Z" }), "booking-1", Date.parse("2026-01-01T00:00:00.000Z"));
    const summer = familyJobChangeNotice(null, booking({ pickupTime: "2026-07-01T23:30:00.000Z" }), "booking-2", Date.parse("2026-07-01T00:00:00.000Z"));
    assert.match(winter?.body || "", /09:00/);
    assert.match(summer?.body || "", /00:30/);
    assert.match(summer?.body || "", /2 Jul/);
  });

  it("alerts once for a time change, a driver change, and a cancellation", () => {
    const before = booking();
    const moved = familyJobChangeNotice(before, booking({ pickupTime: "2026-11-13T11:00:00.000Z" }), "booking-1", NOW);
    const driver = familyJobChangeNotice(before, booking({ driverId: "driver-a" }), "booking-1", NOW);
    const cancelled = familyJobChangeNotice(before, booking({ status: "cancelled" }), "booking-1", NOW);
    assert.equal(moved?.title, "Job changed");
    assert.equal(driver?.title, "Driver changed");
    assert.equal(cancelled?.title, "Job cancelled");
    assert.notEqual(moved?.dedupeId, driver?.dedupeId);
    assert.equal(familyJobChangeNotice(before, booking({ driverId: "driver-a" }), "booking-1", NOW)?.dedupeId, driver?.dedupeId);
  });

  it("sends the hour ahead alert for an active journey and leaves a completed job out", () => {
    const at = new Date(NOW + 60 * 60 * 1000).toISOString();
    const due = familyJobDueNotices(booking({ pickupTime: at, returnPickupTime: at, bookingType: "return", returnTrip: true }), "booking-1", NOW);
    assert.equal(due.length, 2);
    assert.equal(due[0].title, "Pickup in the next hour");
    assert.equal(due[1].title, "Return in the next hour");
    assert.equal(familyJobDueNotices(booking({ pickupTime: at, status: "completed" }), "booking-1", NOW).length, 0);
    assert.equal(familyJobDueNotices(booking({ pickupTime: at, status: "cancelled" }), "booking-1", NOW).length, 0);
  });

  it("keeps a real browser subscription and drops anything else", () => {
    const kept = familyPushSubscription({
      endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc",
      keys: { p256dh: "A".repeat(40), auth: "B".repeat(16) },
    });
    assert.equal(kept?.endpoint.startsWith("https://"), true);
    assert.equal(familyPushSubscription({ endpoint: "http://example.com", keys: { p256dh: "A".repeat(40), auth: "B".repeat(16) } }), null);
    assert.equal(familyPushGone(410), true);
    assert.equal(familyPushGone(500), false);
  });
});
