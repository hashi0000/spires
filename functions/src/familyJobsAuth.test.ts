import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  clientIpFromRequest,
  familyPinsMatch,
  isPlausibleFamilyPin,
  normalizeFamilyPin,
} from "./familyJobsAuthLogic";

describe("family jobs PIN helpers", () => {
  it("accepts 4 to 8 digit pins and strips spaces", () => {
    assert.equal(normalizeFamilyPin(" 12 34 "), "1234");
    assert.equal(isPlausibleFamilyPin("1234"), true);
    assert.equal(isPlausibleFamilyPin("12345678"), true);
    assert.equal(isPlausibleFamilyPin("123"), false);
    assert.equal(isPlausibleFamilyPin("abcdef"), false);
  });

  it("matches pins without leaking length via a cheap string compare", () => {
    assert.equal(familyPinsMatch("2468", "2468"), true);
    assert.equal(familyPinsMatch("2468", "2469"), false);
    assert.equal(familyPinsMatch("", "2468"), false);
  });

  it("reads the first forwarded IP", () => {
    assert.equal(
      clientIpFromRequest({
        ip: "10.0.0.1",
        headers: { "x-forwarded-for": "8.8.8.8, 1.1.1.1" },
      }),
      "8.8.8.8"
    );
  });
});
