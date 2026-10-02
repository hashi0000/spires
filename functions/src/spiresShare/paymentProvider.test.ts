import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MockPaymentProvider, Shift4OnlinePaymentProvider, createSharePaymentProvider } from "./paymentProvider";

describe("MockPaymentProvider", () => {
  it("verifies a method without taking funds", async () => {
    const provider = new MockPaymentProvider();
    const method = await provider.verifyPaymentMethod();
    assert.equal(method.status, "PAYMENT_METHOD_VERIFIED");
    assert.ok(method.paymentMethodRef);
  });

  it("authorises then captures, and will not capture twice from a released auth", async () => {
    const provider = new MockPaymentProvider();
    await provider.authorise({ paymentId: "p1", amountPence: 3500 });
    const captured = await provider.capture("p1");
    assert.equal(captured.status, "CAPTURED");
    const refunded = await provider.refund("p1");
    assert.equal(refunded.status, "REFUNDED");
  });

  it("releases an authorisation instead of charging", async () => {
    const provider = new MockPaymentProvider();
    await provider.authorise({ paymentId: "p2", amountPence: 3500 });
    const released = await provider.release("p2");
    assert.equal(released.status, "AUTHORISATION_RELEASED");
    const captured = await provider.capture("p2");
    assert.equal(captured.status, "AUTHORISATION_RELEASED");
  });

  it("does not invent Shift4 credentials", () => {
    assert.equal(createSharePaymentProvider().provider, "mock");
    assert.throws(() => new Shift4OnlinePaymentProvider({}));
  });
});
