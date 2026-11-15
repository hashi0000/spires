import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import vm from "node:vm";
import {
  EXECUTIVE_AREAS,
  EXECUTIVE_SERVICE_ENABLED,
  assessExecutiveBooking,
  classifyExecutiveJourney,
  executiveCommerceBlocked,
  executiveServiceEnabled,
  proposedExecutiveFare,
} from "./executiveService";

describe("executive Heathrow service", () => {
  it("stays disabled unless a caller or the local emulator turns it on", () => {
    const previous = process.env.EXECUTIVE_SERVICE_ENABLED;
    delete process.env.EXECUTIVE_SERVICE_ENABLED;
    assert.equal(EXECUTIVE_SERVICE_ENABLED, false);
    assert.equal(executiveServiceEnabled(), false);
    assert.equal(executiveServiceEnabled(true), true);
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
      document: {
        readyState: "complete",
        querySelectorAll: () => [],
        getElementById: () => null,
        addEventListener: () => {},
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
    assert.equal(ctx.window.SPIRES_EXECUTIVE_SERVICE_ENABLED, false);
  });
});
