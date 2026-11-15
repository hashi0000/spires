import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { assignmentReview } from "./assignmentReview";

describe("assignment review", () => {
  it("warns on a stored MOT date and does not treat that date as a live expiry", () => {
    const review = assignmentReview(
      { available: true, registration: "AB12 CDE", motExpiry: "2020-01-01" },
      new Date("2026-11-14T12:00:00Z")
    );
    assert.equal(review.block, false);
    assert.match(review.notes.join(" "), /Stored MOT date needs review/);
    assert.match(review.notes.join(" "), /date on file/);
  });

  it("blocks a vehicle that is off the fleet", () => {
    const review = assignmentReview({ available: false, registration: "AB12 CDE" }, new Date("2026-11-14T12:00:00Z"));
    assert.equal(review.block, true);
    assert.match(review.notes.join(" "), /off the fleet/);
  });
});
