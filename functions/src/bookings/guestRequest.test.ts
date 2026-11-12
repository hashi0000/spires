import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  CONTACT_REQUIRED_MESSAGE,
  commitGuestBooking,
  decideGuestClaim,
  guestClaimPatch,
  GuestDb,
  nextGuestRate,
  prepareGuestBooking,
} from "./guestRequest";

const today = "2026-11-02";
const now = Date.parse("2026-11-02T12:00:00Z");

function body(overrides: Record<string, unknown> = {}): Record<string, unknown> {
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
    termsVersion: "2026-10-25",
    submissionId: "submission-00000001",
    ...overrides,
  };
}

function prepare(overrides: Record<string, unknown> = {}, claim = true) {
  return prepareGuestBooking(body(overrides), {
    now,
    todayYmd: today,
    bookingNumber: "SPTEST1234",
    claimToken: claim ? { token: "claim-token", hash: "claim-hash" } : null,
  });
}

class MemoryGuestDb implements GuestDb {
  bookings = new Map<string, Record<string, unknown>>();
  submissions = new Map<string, { bookingId: string; bookingNumber: string }>();
  rates = new Map<string, { count: number; windowStart: number }>();
  claims: { hash: string; bookingId: string; email: string }[] = [];

  async getSubmission(id: string) {
    return this.submissions.get(id) || null;
  }

  async getRate(key: string) {
    return this.rates.get(key) || null;
  }

  async insert(input: Parameters<GuestDb["insert"]>[0]) {
    if (input.submissionId && this.submissions.has(input.submissionId)) {
      const existing = this.submissions.get(input.submissionId)!;
      return { duplicate: true, ...existing };
    }
    this.bookings.set(input.bookingId, input.record);
    if (input.submissionId) {
      this.submissions.set(input.submissionId, { bookingId: input.bookingId, bookingNumber: input.bookingNumber });
    }
    this.rates.set(`ip:${input.ipHash}`, input.ipRate);
    this.rates.set(`contact:${input.contactHash}`, input.contactRate);
    if (input.claim) this.claims.push(input.claim);
    return { duplicate: false, bookingId: input.bookingId, bookingNumber: input.bookingNumber };
  }
}

describe("guest booking requests", () => {
  it("stores only validated consented attribution without copying contact data", () => {
    const result = prepare({ marketingAttribution: {
      consent: "granted", consentAt: now, capturedAt: now, expiresAt: now + 86400000,
      clientId: "123.456", gclid: "test-click", email: "private@example.com",
    } });
    assert.ok(result.ok && !result.spam);
    if (!result.ok || result.spam) return;
    const attribution = result.record.marketingAttribution as Record<string, unknown>;
    assert.equal(attribution.gclid, "test-click");
    assert.equal(attribution.email, undefined);
    const rejected = prepare({ marketingAttribution: { consent: "denied", gclid: "test-click" } });
    assert.ok(rejected.ok && !rejected.spam);
    if (rejected.ok && !rejected.spam) assert.equal(rejected.record.marketingAttribution, null);
  });

  it("accepts email only, mobile only, landline only, and both", () => {
    const emailOnly = prepare({ phone: "" });
    const mobile = prepare({ email: "", phone: "07776 897772" }, false);
    const landline = prepare({ email: "", phone: "01865 249000" }, false);
    const both = prepare({ phone: "+44 1865 249000" });
    for (const result of [emailOnly, mobile, landline, both]) {
      assert.equal(result.ok, true);
      if (!result.ok || result.spam) return;
      assert.equal(result.record.status, "pending");
      assert.equal(result.record.guestRequest, true);
      assert.equal(result.record.uid, undefined);
      assert.equal("uid" in result.record, false);
    }
    if (!emailOnly.ok || emailOnly.spam || !mobile.ok || mobile.spam || !landline.ok || landline.spam || !both.ok || both.spam) {
      return;
    }
    assert.equal(emailOnly.record.contactBy, "email");
    assert.equal(emailOnly.claim?.email, "alex@example.com");
    assert.equal(mobile.record.contactBy, "phone");
    assert.equal(mobile.claim, null);
    assert.equal(landline.record.phone, "01865249000");
    assert.equal(both.record.contactBy, "both");
    assert.equal(both.record.phone, "+441865249000");
  });

  it("explains that a phone number or email is required and shows the office number", () => {
    const result = prepare({ email: "", phone: "" });
    assert.equal(result.ok, false);
    if (result.ok) return;
    assert.equal(result.error, CONTACT_REQUIRED_MESSAGE);
    assert.match(result.error, /07776 897772/);
  });

  it("stores how the customer heard about us and ignores an unknown answer", () => {
    const chosen = prepare({ heardAbout: "google", heardAboutDetail: "should not be kept" });
    assert.equal(chosen.ok, true);
    if (!chosen.ok || chosen.spam) return;
    assert.equal(chosen.record.heardAbout, "google");
    assert.equal(chosen.record.heardAboutDetail, "");
    const other = prepare({ heardAbout: "other", heardAboutDetail: "  Hotel card  " });
    assert.equal(other.ok, true);
    if (!other.ok || other.spam) return;
    assert.equal(other.record.heardAbout, "other");
    assert.equal(other.record.heardAboutDetail, "Hotel card");
    const blank = prepare({ heardAbout: "billboard" });
    assert.equal(blank.ok, true);
    if (!blank.ok || blank.spam) return;
    assert.equal(blank.record.heardAbout, undefined);
  });

  it("keeps a request pending and does not invent a login", () => {
    const result = prepare({ vehicleType: "8_seater", passengers: "6", luggage: "4" });
    assert.equal(result.ok, true);
    if (!result.ok || result.spam) return;
    assert.equal(result.record.vehicleType, "8_seater");
    assert.equal(result.record.passengers, 6);
    assert.equal(result.record.paymentStatus, "pending");
    assert.equal(result.record.adminStatus, "pending");
    assert.equal(result.record.accountLinked, false);
    assert.equal(result.record.source, "website");
  });

  it("returns the same booking when the same submission is sent again", async () => {
    const db = new MemoryGuestDb();
    const prepared = prepare();
    assert.equal(prepared.ok, true);
    if (!prepared.ok || prepared.spam) return;
    const first = await commitGuestBooking(db, prepared, { now, ipHash: "ip", bookingId: "booking-1" });
    const second = await commitGuestBooking(db, prepared, { now, ipHash: "ip", bookingId: "booking-2" });
    assert.equal(first.ok && second.ok, true);
    if (!first.ok || !second.ok) return;
    assert.equal(second.duplicate, true);
    assert.equal(second.bookingId, "booking-1");
    assert.equal(second.claimToken, "");
    assert.equal(db.bookings.size, 1);
  });

  it("stops a burst of requests without losing the ones already saved", async () => {
    const db = new MemoryGuestDb();
    let saved = 0;
    for (let i = 0; i < 9; i += 1) {
      const prepared = prepare({ submissionId: `submission-${String(i).padStart(8, "0")}` });
      if (!prepared.ok || prepared.spam) throw new Error("prepare failed");
      const result = await commitGuestBooking(db, prepared, { now, ipHash: "same-ip", bookingId: `booking-${i}` });
      if (result.ok) saved += 1;
      else assert.equal(result.status, 429);
    }
    assert.equal(saved, 8);
    assert.equal(db.bookings.size, 8);
  });

  it("links only the booking on the claim and requires the same email", () => {
    const own = decideGuestClaim({
      claim: { bookingId: "booking-1", email: "alex@example.com", used: false, expiresAt: now + 1000 },
      accountEmail: "Alex@Example.com",
      now,
    });
    const other = decideGuestClaim({
      claim: { bookingId: "booking-2", email: "sam@example.com", used: false, expiresAt: now + 1000 },
      accountEmail: "alex@example.com",
      now,
    });
    const used = decideGuestClaim({
      claim: { bookingId: "booking-1", email: "alex@example.com", used: true, expiresAt: now + 1000 },
      accountEmail: "alex@example.com",
      now,
    });
    assert.deepEqual(own, { ok: true, bookingId: "booking-1" });
    assert.equal(other.ok, false);
    assert.equal(used.ok, false);
    assert.deepEqual(guestClaimPatch("user-1"), { uid: "user-1", accountLinked: true });
    assert.equal(Object.keys(guestClaimPatch("user-1")).includes("email"), false);
  });
});

describe("stops and open returns", () => {
  it("keeps an open return pending without a made up time", () => {
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
    assert.equal(result.ok, true);
    if (!result.ok || result.spam) return;
    assert.equal(result.record.status, "pending");
    assert.equal(result.record.openReturn, true);
    assert.equal(result.record.returnPickupTime, "");
    assert.equal(result.record.returnDateTime, "");
    assert.equal(result.record.returnDate, "2026-11-12");
    assert.equal(result.record.extraStops, true);
    assert.equal(String(result.record.openReturnNotice).includes("outside Oxford"), true);
    assert.equal(String(result.record.returnPickupTime).includes("00:00"), false);
  });
});

describe("guest request rate window", () => {
  it("resets after the window", () => {
    const first = nextGuestRate(null, now);
    const blocked = nextGuestRate({ count: 8, windowStart: now }, now + 1000);
    const reset = nextGuestRate({ count: 8, windowStart: now }, now + 60 * 60 * 1000);
    assert.equal(first.allowed, true);
    assert.equal(blocked.allowed, false);
    assert.equal(reset.allowed, true);
    assert.equal(reset.next.count, 1);
  });
});
