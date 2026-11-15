import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { bookingRevisionDecision } from "./bookingRevision";

describe("booking revision", () => {
  it("accepts the revision that was loaded and rejects an older session", () => {
    const first = bookingRevisionDecision({ revision: 0 }, 0);
    assert.equal(first.ok && first.revision, 1);
    const stale = bookingRevisionDecision({ revision: 1 }, 0);
    assert.equal(stale.ok, false);
    const missing = bookingRevisionDecision({}, 0);
    assert.equal(missing.ok && missing.revision, 1);
  });
});
