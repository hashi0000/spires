import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { londonDateTimeToUtcIso, slotKey, subtractHoursIso } from "./timezone";

describe("Europe/London timezone", () => {
  it("maps winter GMT wall time to UTC", () => {
    const iso = londonDateTimeToUtcIso("2026-01-15", "10:30");
    assert.equal(iso, "2026-01-15T10:30:00.000Z");
  });

  it("maps BST wall time to UTC minus one hour", () => {
    const iso = londonDateTimeToUtcIso("2026-10-13", "10:30");
    assert.equal(iso, "2026-10-13T09:30:00.000Z");
  });

  it("handles the autumn clock-change morning after GMT resumes", () => {
    const iso = londonDateTimeToUtcIso("2026-10-25", "01:30");
    assert.equal(iso, "2026-10-25T01:30:00.000Z");
  });

  it("subtracts confirmation hours from a UTC instant", () => {
    assert.equal(subtractHoursIso("2026-10-13T09:30:00.000Z", 24), "2026-10-12T09:30:00.000Z");
  });

  it("builds a unique slot key", () => {
    assert.equal(slotKey("heathrow", "2026-10-13", "10:30"), "heathrow_2026-10-13_1030");
  });
});
