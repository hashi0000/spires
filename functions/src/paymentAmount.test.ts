import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { clientAmountMatchesPayable, paymentClaimAllows, serverPayablePence } from "./paymentAmount";

describe("server payable amount", () => {
  it("uses the deposit that is still due, then the remaining balance", () => {
    const deposit = serverPayablePence({ actualFare: 92, amountReceivedPence: 0, depositRequired: true, depositAmount: 20 });
    assert.equal(deposit.ok && deposit.pence, 2000);
    const balance = serverPayablePence({ actualFare: 92, amountReceivedPence: 2000, depositRequired: true, depositAmount: 20 });
    assert.equal(balance.ok && balance.pence, 7200);
  });

  it("rejects a cancelled booking, a missing fare, and a stale browser amount", () => {
    assert.equal(serverPayablePence({ status: "cancelled", actualFare: 40 }).ok, false);
    assert.equal(serverPayablePence({ status: "confirmed", actualFare: 0 }).ok, false);
    assert.equal(serverPayablePence({ status: "completed", actualFare: 40, amountReceivedPence: 4000 }).ok, false);
    const due = serverPayablePence({ status: "confirmed", actualFare: 40 });
    assert.equal(due.ok && clientAmountMatchesPayable(due.ok ? due.pence : 0, "39.00"), false);
    assert.equal(due.ok && clientAmountMatchesPayable(due.ok ? due.pence : 0, "£40.00"), true);
    assert.equal(paymentClaimAllows("booking-a", "booking-b"), false);
    assert.equal(paymentClaimAllows("booking-a", "booking-a"), true);
    assert.equal(paymentClaimAllows("", "booking-b"), true);
  });
});
