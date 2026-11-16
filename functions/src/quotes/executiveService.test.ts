import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";
import {
  EXECUTIVE_AREAS,
  EXECUTIVE_CUSTOMER_WORDING,
  EXECUTIVE_PARTNER_NOTE,
  EXECUTIVE_SERVICE_ENABLED,
  assessExecutiveBooking,
  classifyExecutiveJourney,
  executiveCommerceBlocked,
  executiveServiceEnabled,
  proposedExecutiveFare,
} from "./executiveService";
import { acceptanceCustomerHtml, guestRequestEmailHtml, quoteEmailHtml } from "./emails";

describe("executive Heathrow service", () => {
  it("is open and can still be switched off for a check", () => {
    const previous = process.env.EXECUTIVE_SERVICE_ENABLED;
    delete process.env.EXECUTIVE_SERVICE_ENABLED;
    assert.equal(EXECUTIVE_SERVICE_ENABLED, true);
    assert.equal(executiveServiceEnabled(), true);
    assert.equal(executiveServiceEnabled(false), false);
    process.env.EXECUTIVE_SERVICE_ENABLED = "true";
    assert.equal(executiveServiceEnabled(), true);
    if (previous === undefined) delete process.env.EXECUTIVE_SERVICE_ENABLED;
    else process.env.EXECUTIVE_SERVICE_ENABLED = previous;
  });

  it("publishes the five Heathrow areas and leaves other areas unpriced", () => {
    const oxford = classifyExecutiveJourney({ pickup: "Oxford", destination: "Heathrow" });
    assert.equal(oxford.ok, true);
    if (!oxford.ok) return;
    assert.equal(oxford.fareStatus, "published");
    assert.equal(proposedExecutiveFare(oxford, "one_way"), 150);
    assert.equal(proposedExecutiveFare(oxford, "return"), 290);
    assert.deepEqual(EXECUTIVE_AREAS.abingdon, { oneWay: 165, return: 320 });
    assert.deepEqual(EXECUTIVE_AREAS.didcot, { oneWay: 170, return: 330 });
    assert.deepEqual(EXECUTIVE_AREAS.bicester, { oneWay: 170, return: 330 });
    assert.deepEqual(EXECUTIVE_AREAS.witney, { oneWay: 170, return: 330 });

    const other = classifyExecutiveJourney({ pickup: "Banbury", destination: "LHR" });
    assert.equal(other.ok, true);
    if (!other.ok) return;
    assert.equal(other.fareStatus, "quote_required");
    assert.equal(proposedExecutiveFare(other, "one_way"), null);
  });

  it("allows Heathrow only and blocks commerce until acceptance", () => {
    assert.equal(classifyExecutiveJourney({ pickup: "Oxford", destination: "Gatwick" }).ok, false);
    const mixed = classifyExecutiveJourney({
      pickup: "Oxford",
      destination: "Heathrow",
      returnPickup: "Gatwick",
      returnDestination: "Oxford",
      bookingType: "return",
    });
    assert.equal(mixed.ok, true);
    if (mixed.ok) {
      assert.equal(mixed.fareStatus, "quote_required");
      assert.equal(proposedExecutiveFare(mixed, "return"), null);
    }
    const townToHeathrow = classifyExecutiveJourney({ pickup: "Heathrow Terminal 5", destination: "Oxford" });
    assert.equal(townToHeathrow.ok, true);
    if (townToHeathrow.ok) assert.equal(proposedExecutiveFare(townToHeathrow, "one_way"), 150);
    assert.equal(classifyExecutiveJourney({ pickup: "Oxford", destination: "Stansted Airport" }).ok, false);
    assert.equal(classifyExecutiveJourney({ pickup: "Oxford station", destination: "London" }).ok, false);
    const passengers = assessExecutiveBooking({ pickup: "Oxford", destination: "Heathrow", passengers: 0, enabled: true });
    assert.equal(passengers.ok, false);
    const ready = assessExecutiveBooking({ pickup: "Abingdon", destination: "Heathrow Terminal 5", passengers: 3, bookingType: "return", enabled: true });
    assert.equal(ready.ok, true);
    if (!ready.ok) return;
    assert.equal(ready.fields.proposedFarePounds, 320);
    assert.equal(ready.fields.executiveAvailability, "awaiting_confirmation");
    assert.equal(executiveCommerceBlocked({ vehicleType: "executive", executiveAvailability: "awaiting_confirmation" }), true);
    assert.equal(executiveCommerceBlocked({ vehicleType: "executive", executiveAvailability: "accepted" }), false);
    assert.equal(executiveCommerceBlocked({ vehicleType: "standard" }), false);
  });

  it("matches the website fare source", () => {
    const code = fs.readFileSync(path.join(__dirname, "../../../spires-website/js/airport-prices.js"), "utf8");
    const ctx = {
      window: {} as Record<string, unknown>,
      Event: function Event() {},
      document: {
        readyState: "complete",
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
        dispatchEvent: () => {},
      },
    };
    vm.runInNewContext(code, ctx);
    const website = ctx.window.SPIRES_classifyExecutive as (journey: { pickup: string; destination: string }) => {
      ok: boolean;
      oneWay?: number | null;
      returnFare?: number | null;
      fareStatus?: string;
    };
    const pairs = [
      ["Oxford", "Heathrow"],
      ["Abingdon", "Heathrow"],
      ["Didcot", "Heathrow"],
      ["Bicester", "Heathrow"],
      ["Witney", "Heathrow"],
      ["Kidlington", "Heathrow"],
      ["Oxford", "Gatwick"],
    ];
    for (const [pickup, destination] of pairs) {
      assert.deepEqual(
        JSON.parse(JSON.stringify(website({ pickup, destination }))),
        JSON.parse(JSON.stringify(classifyExecutiveJourney({ pickup, destination })))
      );
    }
    assert.equal(ctx.window.SPIRES_EXECUTIVE_SERVICE_ENABLED, true);
    assert.equal(code.includes("standardCar: { oneWay: 92, return: 180 }"), true);
    const servicePage = fs.readFileSync(path.join(__dirname, '../../../spires-website/executive-travel.html'), 'utf8');
    assert.match(servicePage, /Mercedes E Class or equivalent/);
    assert.match(servicePage, /Cotswolds/);
    assert.equal(code.includes("vito: { oneWay: 120, return: 235 }"), true);
  });

  it("walks a synthetic Executive request through confirmation", () => {
    assert.equal(EXECUTIVE_SERVICE_ENABLED, true);
    const closed = assessExecutiveBooking({
      pickup: "Oxford",
      destination: "Heathrow Terminal 5",
      passengers: 2,
      bookingType: "one_way",
      enabled: false,
    });
    assert.equal(closed.ok, false);
    const request = assessExecutiveBooking({
      pickup: "Oxford",
      destination: "Heathrow Terminal 5",
      passengers: 2,
      bookingType: "one_way",
      enabled: true,
    });
    assert.equal(request.ok, true);
    if (!request.ok) return;
    assert.equal(request.fields.executiveAvailability, "awaiting_confirmation");
    assert.equal(request.fields.proposedFarePounds, 150);
    assert.equal(executiveCommerceBlocked({ vehicleType: "executive", executiveAvailability: "awaiting_confirmation" }), true);
    const requestEmail = guestRequestEmailHtml({
      name: "Alex Example",
      bookingNumber: "SYN-EXEC-HEATHROW",
      claimUrl: "",
      hasPhone: true,
      executive: true,
      proposedFare: "£150.00",
    });
    assert.equal(requestEmail.includes(EXECUTIVE_CUSTOMER_WORDING), true);
    assert.equal(requestEmail.includes(EXECUTIVE_PARTNER_NOTE), true);
    assert.equal(requestEmail.includes("not a confirmed booking"), true);
    const quote = quoteEmailHtml({
      bookingNumber: "SYN-EXEC-HEATHROW",
      customerName: "Alex Example",
      vehicleLabel: "Executive Car",
      outbound: "Oxford to Heathrow Terminal 5",
      returnLeg: "",
      normalFare: "£150.00",
      discount: "£0.00",
      finalFare: "£150.00",
      validUntil: "",
      paymentRequirement: "later",
      paymentDescription: "",
      amountRequested: "£150.00",
      quoteUrl: "https://www.spires-taxis.com/quote?t=synthetic",
      paymentUrl: "",
      terms: "This quote is not a confirmed booking. The journeys are subject to availability.",
    });
    assert.equal(quote.includes("Vehicle category: Executive Car"), true);
    assert.equal(quote.includes("£92"), false);
    const confirmed = acceptanceCustomerHtml({
      bookingNumber: "SYN-EXEC-HEATHROW",
      customerName: "Alex Example",
      confirmed: true,
      finalFare: "£150.00",
      vehicleNote: `${EXECUTIVE_CUSTOMER_WORDING} ${EXECUTIVE_PARTNER_NOTE}`,
    });
    assert.equal(confirmed.includes("is confirmed"), true);
    assert.equal(confirmed.includes(EXECUTIVE_PARTNER_NOTE), true);
    assert.equal(executiveCommerceBlocked({ vehicleType: "executive", executiveAvailability: "accepted" }), false);
    assert.equal(executiveCommerceBlocked({ vehicleType: "standard" }), false);
  });
});
