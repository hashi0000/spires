"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const strict_1 = __importDefault(require("node:assert/strict"));
const node_test_1 = require("node:test");
const bookingTerms_1 = require("../terms/bookingTerms");
const guestRequest_1 = require("./guestRequest");
const today = "2026-11-02";
const now = Date.parse("2026-11-02T12:00:00Z");
function body(overrides = {}) {
    return {
        name: "Alex Stone",
        email: "alex@example.com",
        phone: "",
        pickup: "1 High Street, Oxford",
        destination: "Heathrow Terminal 5",
        date: "2026-11-10",
        time: "09:30",
        vehicleType: "standard",
        passengers: "2",
        luggage: "1",
        bookingType: "one_way",
        termsAccepted: true,
        termsVersion: bookingTerms_1.CURRENT_BOOKING_TERMS.version,
        submissionId: "submission-00000001",
        ...overrides,
    };
}
function prepare(overrides = {}, claim = true) {
    return (0, guestRequest_1.prepareGuestBooking)(body(overrides), {
        now,
        todayYmd: today,
        bookingNumber: "SPTEST1234",
        claimToken: claim ? { token: "claim-token", hash: "claim-hash" } : null,
    });
}
class MemoryGuestDb {
    constructor() {
        this.bookings = new Map();
        this.submissions = new Map();
        this.rates = new Map();
        this.claims = [];
    }
    async getSubmission(id) {
        return this.submissions.get(id) || null;
    }
    async getRate(key) {
        return this.rates.get(key) || null;
    }
    async insert(input) {
        if (input.submissionId && this.submissions.has(input.submissionId)) {
            const existing = this.submissions.get(input.submissionId);
            return { duplicate: true, ...existing };
        }
        this.bookings.set(input.bookingId, input.record);
        if (input.submissionId) {
            this.submissions.set(input.submissionId, { bookingId: input.bookingId, bookingNumber: input.bookingNumber });
        }
        this.rates.set(`ip:${input.ipHash}`, input.ipRate);
        this.rates.set(`contact:${input.contactHash}`, input.contactRate);
        if (input.claim)
            this.claims.push(input.claim);
        return { duplicate: false, bookingId: input.bookingId, bookingNumber: input.bookingNumber };
    }
}
(0, node_test_1.describe)("guest booking requests", () => {
    (0, node_test_1.it)("stores only validated consented attribution without copying contact data", () => {
        const result = prepare({ marketingAttribution: {
                consent: "granted", consentAt: now, capturedAt: now, expiresAt: now + 86400000,
                clientId: "123.456", gclid: "test-click", email: "private@example.com",
            } });
        strict_1.default.ok(result.ok && !result.spam);
        if (!result.ok || result.spam)
            return;
        const attribution = result.record.marketingAttribution;
        strict_1.default.equal(attribution.gclid, "test-click");
        strict_1.default.equal(attribution.email, undefined);
        const rejected = prepare({ marketingAttribution: { consent: "denied", gclid: "test-click" } });
        strict_1.default.ok(rejected.ok && !rejected.spam);
        if (rejected.ok && !rejected.spam)
            strict_1.default.equal(rejected.record.marketingAttribution, null);
    });
    (0, node_test_1.it)("accepts email only, mobile only, landline only, and both", () => {
        const emailOnly = prepare({ phone: "" });
        const mobile = prepare({ email: "", phone: "07776 897772" }, false);
        const landline = prepare({ email: "", phone: "01865 249000" }, false);
        const both = prepare({ phone: "+44 1865 249000" });
        for (const result of [emailOnly, mobile, landline, both]) {
            strict_1.default.equal(result.ok, true);
            if (!result.ok || result.spam)
                return;
            strict_1.default.equal(result.record.status, "pending");
            strict_1.default.equal(result.record.guestRequest, true);
            strict_1.default.equal(result.record.uid, undefined);
            strict_1.default.equal("uid" in result.record, false);
        }
        if (!emailOnly.ok || emailOnly.spam || !mobile.ok || mobile.spam || !landline.ok || landline.spam || !both.ok || both.spam) {
            return;
        }
        strict_1.default.equal(emailOnly.record.contactBy, "email");
        strict_1.default.equal(emailOnly.claim?.email, "alex@example.com");
        strict_1.default.equal(mobile.record.contactBy, "phone");
        strict_1.default.equal(mobile.claim, null);
        strict_1.default.equal(landline.record.phone, "01865249000");
        strict_1.default.equal(both.record.contactBy, "both");
        strict_1.default.equal(both.record.phone, "+441865249000");
    });
    (0, node_test_1.it)("explains that a phone number or email is required and shows the office number", () => {
        const result = prepare({ email: "", phone: "" });
        strict_1.default.equal(result.ok, false);
        if (result.ok)
            return;
        strict_1.default.equal(result.error, guestRequest_1.CONTACT_REQUIRED_MESSAGE);
        strict_1.default.match(result.error, /07776 897772/);
    });
    (0, node_test_1.it)("stores how the customer heard about us and ignores an unknown answer", () => {
        const chosen = prepare({ heardAbout: "google", heardAboutDetail: "should not be kept" });
        strict_1.default.equal(chosen.ok, true);
        if (!chosen.ok || chosen.spam)
            return;
        strict_1.default.equal(chosen.record.heardAbout, "google");
        strict_1.default.equal(chosen.record.heardAboutDetail, "");
        const other = prepare({ heardAbout: "other", heardAboutDetail: "  Hotel card  " });
        strict_1.default.equal(other.ok, true);
        if (!other.ok || other.spam)
            return;
        strict_1.default.equal(other.record.heardAbout, "other");
        strict_1.default.equal(other.record.heardAboutDetail, "Hotel card");
        const blank = prepare({ heardAbout: "billboard" });
        strict_1.default.equal(blank.ok, true);
        if (!blank.ok || blank.spam)
            return;
        strict_1.default.equal(blank.record.heardAbout, undefined);
    });
    (0, node_test_1.it)("keeps a request pending and does not invent a login", () => {
        const result = prepare({ vehicleType: "8_seater", passengers: "6", luggage: "4" });
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.record.vehicleType, "8_seater");
        strict_1.default.equal(result.record.passengers, 6);
        strict_1.default.equal(result.record.paymentStatus, "pending");
        strict_1.default.equal(result.record.adminStatus, "pending");
        strict_1.default.equal(result.record.accountLinked, false);
        strict_1.default.equal(result.record.source, "website");
    });
    (0, node_test_1.it)("returns the same booking when the same submission is sent again", async () => {
        const db = new MemoryGuestDb();
        const prepared = prepare();
        strict_1.default.equal(prepared.ok, true);
        if (!prepared.ok || prepared.spam)
            return;
        const first = await (0, guestRequest_1.commitGuestBooking)(db, prepared, { now, ipHash: "ip", bookingId: "booking-1" });
        const second = await (0, guestRequest_1.commitGuestBooking)(db, prepared, { now, ipHash: "ip", bookingId: "booking-2" });
        strict_1.default.equal(first.ok && second.ok, true);
        if (!first.ok || !second.ok)
            return;
        strict_1.default.equal(second.duplicate, true);
        strict_1.default.equal(second.bookingId, "booking-1");
        strict_1.default.equal(second.claimToken, "");
        strict_1.default.equal(db.bookings.size, 1);
    });
    (0, node_test_1.it)("stops a burst of requests without losing the ones already saved", async () => {
        const db = new MemoryGuestDb();
        let saved = 0;
        for (let i = 0; i < 9; i += 1) {
            const prepared = prepare({ submissionId: `submission-${String(i).padStart(8, "0")}` });
            if (!prepared.ok || prepared.spam)
                throw new Error("prepare failed");
            const result = await (0, guestRequest_1.commitGuestBooking)(db, prepared, { now, ipHash: "same-ip", bookingId: `booking-${i}` });
            if (result.ok)
                saved += 1;
            else
                strict_1.default.equal(result.status, 429);
        }
        strict_1.default.equal(saved, 8);
        strict_1.default.equal(db.bookings.size, 8);
    });
    (0, node_test_1.it)("links only the booking on the claim and requires the same email", () => {
        const own = (0, guestRequest_1.decideGuestClaim)({
            claim: { bookingId: "booking-1", email: "alex@example.com", used: false, expiresAt: now + 1000 },
            accountEmail: "Alex@Example.com",
            now,
        });
        const other = (0, guestRequest_1.decideGuestClaim)({
            claim: { bookingId: "booking-2", email: "sam@example.com", used: false, expiresAt: now + 1000 },
            accountEmail: "alex@example.com",
            now,
        });
        const used = (0, guestRequest_1.decideGuestClaim)({
            claim: { bookingId: "booking-1", email: "alex@example.com", used: true, expiresAt: now + 1000 },
            accountEmail: "alex@example.com",
            now,
        });
        strict_1.default.deepEqual(own, { ok: true, bookingId: "booking-1" });
        strict_1.default.equal(other.ok, false);
        strict_1.default.equal(used.ok, false);
        strict_1.default.deepEqual((0, guestRequest_1.guestClaimPatch)("user-1"), { uid: "user-1", accountLinked: true });
        strict_1.default.equal(Object.keys((0, guestRequest_1.guestClaimPatch)("user-1")).includes("email"), false);
    });
});
(0, node_test_1.describe)("stops and open returns", () => {
    (0, node_test_1.it)("keeps an open return pending without a made up time", () => {
        const result = prepare({
            bookingType: "return",
            openReturn: true,
            returnDate: "2026-11-12",
            returnTime: "00:00",
            returnPickupLocation: "Heathrow Terminal 5",
            returnDestination: "1 High Street, Oxford",
            returnNoticeNote: "Customer will contact the driver when ready",
            stops: [
                { type: "pickup", address: "1 High Street, Oxford" },
                { type: "dropoff", address: "Headington, Oxford" },
                { type: "dropoff", address: "Heathrow Terminal 5" },
            ],
        });
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.record.status, "pending");
        strict_1.default.equal(result.record.openReturn, true);
        strict_1.default.equal(result.record.returnPickupTime, "");
        strict_1.default.equal(result.record.returnDateTime, "");
        strict_1.default.equal(result.record.returnDate, "2026-11-12");
        strict_1.default.equal(result.record.extraStops, true);
        strict_1.default.equal(String(result.record.openReturnNotice).includes("outside Oxford"), true);
        strict_1.default.equal(String(result.record.returnPickupTime).includes("00:00"), false);
    });
    (0, node_test_1.it)("stores an opaque website reference and drops anything else", () => {
        const kept = prepare({ websiteEnquiryRef: "ST-AB23CD" });
        strict_1.default.equal(kept.ok, true);
        if (!kept.ok || kept.spam)
            return;
        strict_1.default.equal(kept.record.websiteEnquiryRef, "ST-AB23CD");
        const dropped = prepare({ websiteEnquiryRef: "gclid=abc" });
        strict_1.default.equal(dropped.ok, true);
        if (!dropped.ok || dropped.spam)
            return;
        strict_1.default.equal(dropped.record.websiteEnquiryRef, undefined);
    });
});
(0, node_test_1.describe)("executive Heathrow requests", () => {
    function prepareExecutive(overrides = {}, enabled = true) {
        return (0, guestRequest_1.prepareGuestBooking)(body({ vehicleType: "executive", passengers: "2", ...overrides }), {
            now,
            todayYmd: today,
            bookingNumber: "SPTEST1234",
            claimToken: { token: "claim-token", hash: "claim-hash" },
            executiveEnabled: enabled,
        });
    }
    (0, node_test_1.it)("stays closed unless the service is explicitly enabled", () => {
        const closed = prepareExecutive({}, false);
        strict_1.default.equal(closed.ok, false);
        if (closed.ok)
            return;
        strict_1.default.match(closed.error, /not open for booking/);
    });
    (0, node_test_1.it)("stores a published Oxford one way fare as a request, not a confirmed fare", () => {
        const result = prepareExecutive();
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.record.status, "pending");
        strict_1.default.equal(result.record.customerStatus, "awaiting_availability");
        strict_1.default.equal(result.record.adminStatus, "awaiting_availability");
        strict_1.default.equal(result.record.vehicleType, "executive");
        strict_1.default.equal(result.record.serviceType, "executive");
        strict_1.default.equal(result.record.airport, "heathrow");
        strict_1.default.equal(result.record.executiveAvailability, "awaiting_confirmation");
        strict_1.default.equal(result.record.executiveFareStatus, "published");
        strict_1.default.equal(result.record.executiveArea, "oxford");
        strict_1.default.equal(result.record.proposedFarePounds, 150);
        strict_1.default.equal(result.record.actualFare, undefined);
        strict_1.default.equal(result.record.paymentStatus, "pending");
        strict_1.default.equal(result.record.marketingAttribution, null);
    });
    (0, node_test_1.it)("uses the published return total and keeps attribution", () => {
        const result = prepareExecutive({
            bookingType: "return",
            returnDate: "2026-11-12",
            returnTime: "16:00",
            returnPickupLocation: "Heathrow Terminal 5",
            returnDestination: "1 High Street, Oxford",
            marketingAttribution: {
                consent: "granted",
                consentAt: now,
                capturedAt: now,
                expiresAt: now + 86400000,
                gclid: "exec-click",
                email: "private@example.com",
            },
        });
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.record.proposedFarePounds, 290);
        strict_1.default.equal(result.record.bookingType, "return");
        const attribution = result.record.marketingAttribution;
        strict_1.default.equal(attribution.gclid, "exec-click");
        strict_1.default.equal(attribution.email, undefined);
    });
    (0, node_test_1.it)("quotes other Heathrow areas without inventing a fare", () => {
        const result = prepareExecutive({ pickup: "Kidlington, Oxfordshire", destination: "Heathrow Terminal 2" });
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.record.executiveFareStatus, "quote_required");
        strict_1.default.equal(result.record.executiveArea, "");
        strict_1.default.equal("proposedFarePounds" in result.record, false);
        strict_1.default.equal(result.record.actualFare, undefined);
    });
    (0, node_test_1.it)("rejects other airports and an oversized passenger count", () => {
        const gatwick = prepareExecutive({ destination: "Gatwick Airport" });
        strict_1.default.equal(gatwick.ok, false);
        if (!gatwick.ok)
            strict_1.default.match(gatwick.error, /Heathrow/);
        const tooMany = prepareExecutive({ passengers: "9" });
        strict_1.default.equal(tooMany.ok, false);
    });
    (0, node_test_1.it)("leaves a Standard Car booking unchanged", () => {
        const result = prepare({ vehicleType: "standard", passengers: "2" });
        strict_1.default.equal(result.ok, true);
        if (!result.ok || result.spam)
            return;
        strict_1.default.equal(result.record.vehicleType, "standard");
        strict_1.default.equal(result.record.adminStatus, "pending");
        strict_1.default.equal(result.record.serviceType, undefined);
        strict_1.default.equal(result.record.proposedFarePounds, undefined);
    });
});
(0, node_test_1.describe)("guest request rate window", () => {
    (0, node_test_1.it)("resets after the window", () => {
        const first = (0, guestRequest_1.nextGuestRate)(null, now);
        const blocked = (0, guestRequest_1.nextGuestRate)({ count: 8, windowStart: now }, now + 1000);
        const reset = (0, guestRequest_1.nextGuestRate)({ count: 8, windowStart: now }, now + 60 * 60 * 1000);
        strict_1.default.equal(first.allowed, true);
        strict_1.default.equal(blocked.allowed, false);
        strict_1.default.equal(reset.allowed, true);
        strict_1.default.equal(reset.next.count, 1);
    });
});
