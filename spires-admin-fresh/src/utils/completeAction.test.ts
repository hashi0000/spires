import { describe, expect, it } from "vitest";
import { completeActionPlan } from "./completeAction";

describe("completeActionPlan", () => {
  it("shows Complete & record with the leg balance", () => {
    const plan = completeActionPlan(
      {
        status: "allocated",
        actualFare: 235,
        amountReceivedPence: 0,
        paymentMethod: "cash",
        dueOnOutbound: 176.25,
        dueOnReturn: 58.75,
        bookingType: "return",
        returnPickupTime: "2026-11-20T18:00:00Z",
      },
      "outbound"
    );
    expect(plan.mode).toBe("complete_and_record");
    expect(plan.amountPence).toBe(17625);
    expect(plan.primaryLabel).toBe("Complete & record £176.25 received");
  });

  it("shows Mark complete for account jobs", () => {
    const plan = completeActionPlan(
      { status: "allocated", actualFare: 120, paymentMethod: "account", amountReceivedPence: 0 },
      "outbound"
    );
    expect(plan.mode).toBe("complete_only");
    expect(plan.primaryLabel).toBe("Mark complete");
    expect(plan.reason).toBe("account");
  });
});
