"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const familyPushLogic_1 = require("./familyPushLogic");
const NOW = Date.parse("2026-11-12T18:00:00.000Z");
const FUTURE = "2026-11-13T09:00:00.000Z";
function booking(extra = {}) {
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
(0, node_test_1.describe)("family job push notices", () => {
    (0, node_test_1.it)("alerts for a new upcoming job without personal details", () => {
        const notice = (0, familyPushLogic_1.familyJobChangeNotice)(null, booking(), "booking-1", NOW);
        strict_1.default.ok(notice);
        strict_1.default.equal(notice?.title, "New job");
        strict_1.default.match(notice?.body || "", /SP100/);
        strict_1.default.match(notice?.body || "", /Heathrow Terminal 5 to Oxford/);
        strict_1.default.equal((notice?.body || "").includes("07700900000"), false);
        strict_1.default.equal((notice?.body || "").includes("Private Customer"), false);
        strict_1.default.equal((notice?.body || "").includes("private@example.com"), false);
        strict_1.default.equal((notice?.body || "").includes("Gate note"), false);
        strict_1.default.equal(notice?.url, "/office-jobs");
    });
    (0, node_test_1.it)("stays quiet for a past job, a note change, and a test record", () => {
        strict_1.default.equal((0, familyPushLogic_1.familyJobChangeNotice)(null, booking({ pickupTime: "2026-01-01T09:00:00.000Z" }), "booking-1", NOW), null);
        const before = booking();
        strict_1.default.equal((0, familyPushLogic_1.familyJobChangeNotice)(before, booking({ notes: "Changed note" }), "booking-1", NOW), null);
        strict_1.default.equal((0, familyPushLogic_1.familyJobChangeNotice)(null, booking({ bookingNumber: "TEST1" }), "booking-1", NOW), null);
        strict_1.default.equal((0, familyPushLogic_1.familyJobChangeNotice)(null, booking({ brand: "spires_international" }), "booking-1", NOW), null);
        strict_1.default.equal((0, familyPushLogic_1.familyJobChangeNotice)(booking({ pickupTime: "2026-01-01T09:00:00.000Z" }), booking({ pickupTime: "2026-01-01T09:00:00.000Z", status: "cancelled" }), "booking-1", NOW), null);
    });
    (0, node_test_1.it)("shows a London time across GMT and BST", () => {
        const winter = (0, familyPushLogic_1.familyJobChangeNotice)(null, booking({ pickupTime: "2026-01-15T09:00:00.000Z" }), "booking-1", Date.parse("2026-01-01T00:00:00.000Z"));
        const summer = (0, familyPushLogic_1.familyJobChangeNotice)(null, booking({ pickupTime: "2026-07-01T23:30:00.000Z" }), "booking-2", Date.parse("2026-07-01T00:00:00.000Z"));
        strict_1.default.match(winter?.body || "", /09:00/);
        strict_1.default.match(summer?.body || "", /00:30/);
        strict_1.default.match(summer?.body || "", /2 Jul/);
    });
    (0, node_test_1.it)("alerts once for a time change, a driver change, and a cancellation", () => {
        const before = booking();
        const moved = (0, familyPushLogic_1.familyJobChangeNotice)(before, booking({ pickupTime: "2026-11-13T11:00:00.000Z" }), "booking-1", NOW);
        const driver = (0, familyPushLogic_1.familyJobChangeNotice)(before, booking({ driverId: "driver-a" }), "booking-1", NOW);
        const cancelled = (0, familyPushLogic_1.familyJobChangeNotice)(before, booking({ status: "cancelled" }), "booking-1", NOW);
        strict_1.default.equal(moved?.title, "Job changed");
        strict_1.default.equal(driver?.title, "Driver changed");
        strict_1.default.equal(cancelled?.title, "Job cancelled");
        strict_1.default.notEqual(moved?.dedupeId, driver?.dedupeId);
        strict_1.default.equal((0, familyPushLogic_1.familyJobChangeNotice)(before, booking({ driverId: "driver-a" }), "booking-1", NOW)?.dedupeId, driver?.dedupeId);
    });
    (0, node_test_1.it)("sends the hour ahead alert for an active journey and leaves a completed job out", () => {
        const at = new Date(NOW + 60 * 60 * 1000).toISOString();
        const due = (0, familyPushLogic_1.familyJobDueNotices)(booking({ pickupTime: at, returnPickupTime: at, bookingType: "return", returnTrip: true }), "booking-1", NOW);
        strict_1.default.equal(due.length, 2);
        strict_1.default.equal(due[0].title, "Pickup in the next hour");
        strict_1.default.equal(due[1].title, "Return in the next hour");
        strict_1.default.equal((0, familyPushLogic_1.familyJobDueNotices)(booking({ pickupTime: at, status: "completed" }), "booking-1", NOW).length, 0);
        strict_1.default.equal((0, familyPushLogic_1.familyJobDueNotices)(booking({ pickupTime: at, status: "cancelled" }), "booking-1", NOW).length, 0);
    });
    (0, node_test_1.it)("keeps a real browser subscription and drops anything else", () => {
        const kept = (0, familyPushLogic_1.familyPushSubscription)({
            endpoint: "https://updates.push.services.mozilla.com/wpush/v2/abc",
            keys: { p256dh: "A".repeat(40), auth: "B".repeat(16) },
        });
        strict_1.default.equal(kept?.endpoint.startsWith("https://"), true);
        strict_1.default.equal((0, familyPushLogic_1.familyPushSubscription)({ endpoint: "http://example.com", keys: { p256dh: "A".repeat(40), auth: "B".repeat(16) } }), null);
        strict_1.default.equal((0, familyPushLogic_1.familyPushGone)(410), true);
        strict_1.default.equal((0, familyPushLogic_1.familyPushGone)(500), false);
    });
});
