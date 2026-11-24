import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { describe, it } from "node:test";
import {
  HALF_TERM_DISCOUNT_PENCE,
  decideHalfTermPromotion,
  isHalfTermRequestWindow,
  isHalloweenDecorWindow,
  poundsToPence,
  quoteTotals,
} from "./halfTerm";
import { londonYmd } from "./londonTime";
import { assignServerInvoiceNumbers, invoiceEmailState, invoicePaidDateLabel, invoicePaymentState, invoiceRevisionDecision, mergeInvoiceRecords, planInvoiceSave } from "./invoiceVault";
import { paymentLinkAllowlist, paymentStatusAfterCustomerAction, validatePaymentLinkUrl } from "./paymentLink";
import {
  bookingMatchesStatusFilter,
  canCustomerAccept,
  decideAcceptance,
  effectiveWorkflowStatus,
  emailEnqueueDecision,
  emailJobDocId,
  isQuoteAdmin,
  paymentBuckets,
  shouldMoveToConfirmedAfterPayment,
  shouldSendConfirmation,
} from "./quoteWorkflow";

const BST_24_OCT_2330 = Date.parse("2026-10-24T22:30:00.000Z");
const LONDON_25_OCT_0030 = Date.parse("2026-10-24T23:30:00.000Z");
const LONDON_2_NOV_2330 = Date.parse("2026-11-02T23:30:00.000Z");
const LONDON_3_NOV_0000 = Date.parse("2026-11-03T00:00:00.000Z");
const LONDON_31_OCT_2330 = Date.parse("2026-10-31T23:30:00.000Z");
const LONDON_1_NOV_0000 = Date.parse("2026-11-01T00:00:00.000Z");
const NEXT_YEAR = Date.parse("2027-10-26T12:00:00.000Z");

const airportReturn = {
  source: "website",
  bookingType: "return" as const,
  pickup: "Oxford",
  pickupLocation: "Oxford",
  destination: "Heathrow Airport",
  returnPickupLocation: "Heathrow Terminal 5",
  returnDestination: "Oxford",
  vehicleType: "standard",
};

describe("2026 half term and Halloween windows", () => {
  it("uses Europe/London calendar dates", () => {
    assert.equal(londonYmd(BST_24_OCT_2330), "2026-10-24");
    assert.equal(londonYmd(LONDON_25_OCT_0030), "2026-10-25");
    assert.equal(londonYmd(LONDON_3_NOV_0000), "2026-11-03");
  });

  it("includes 25 October through 2 November 2026 and stops at 3 November", () => {
    assert.equal(isHalfTermRequestWindow(BST_24_OCT_2330), false);
    assert.equal(isHalfTermRequestWindow(LONDON_25_OCT_0030), true);
    assert.equal(isHalfTermRequestWindow(LONDON_2_NOV_2330), true);
    assert.equal(isHalfTermRequestWindow(LONDON_3_NOV_0000), false);
    assert.equal(isHalfTermRequestWindow(NEXT_YEAR), false);
  });

  it("shows Halloween decorations only through 31 October 2026", () => {
    assert.equal(isHalloweenDecorWindow(LONDON_25_OCT_0030), true);
    assert.equal(isHalloweenDecorWindow(LONDON_31_OCT_2330), true);
    assert.equal(isHalloweenDecorWindow(LONDON_1_NOV_0000), false);
    assert.equal(isHalfTermRequestWindow(LONDON_1_NOV_0000), true);
    assert.equal(isHalloweenDecorWindow(NEXT_YEAR), false);
  });
});

describe("half term discount", () => {
  it("applies £5 once to an eligible airport return and never to a one way", () => {
    const decision = decideHalfTermPromotion(airportReturn, LONDON_25_OCT_0030);
    assert.equal(decision.eligible, true);
    assert.equal(decision.code, "HALFTERM");
    const priced = quoteTotals({
      normalFarePence: poundsToPence("180"),
      promotionEligible: decision.eligible,
      stillQualifyingReturn: true,
    });
    assert.equal(priced.normalFarePence, 18000);
    assert.equal(priced.discountPence, HALF_TERM_DISCOUNT_PENCE);
    assert.equal(priced.finalFarePence, 17500);
    const again = quoteTotals({
      normalFarePence: priced.normalFarePence,
      promotionEligible: true,
      stillQualifyingReturn: true,
    });
    assert.equal(again.discountPence, 500);
    assert.equal(again.finalFarePence, 17500);

    const oneWay = quoteTotals({
      normalFarePence: 9200,
      promotionEligible: true,
      stillQualifyingReturn: false,
    });
    assert.equal(oneWay.discountPence, 0);
    assert.equal(oneWay.finalFarePence, 9200);
    assert.equal(
      decideHalfTermPromotion({ ...airportReturn, bookingType: "one_way", returnTrip: false }, LONDON_25_OCT_0030).eligible,
      false
    );
  });

  it("keeps a captured discount after the campaign ends and does not invent one for other fares", () => {
    const captured = decideHalfTermPromotion(airportReturn, LONDON_2_NOV_2330);
    assert.equal(captured.eligible, true);
    const later = quoteTotals({
      normalFarePence: poundsToPence("270.50"),
      promotionEligible: captured.eligible,
      stillQualifyingReturn: true,
    });
    assert.equal(later.discountPence, 500);
    assert.equal(later.finalFarePence, 26550);
    assert.equal(isHalfTermRequestWindow(LONDON_3_NOV_0000), false);
    assert.equal(decideHalfTermPromotion(airportReturn, LONDON_3_NOV_0000).eligible, false);
    assert.equal(decideHalfTermPromotion({ ...airportReturn, vehicleType: "executive" }, LONDON_25_OCT_0030).eligible, false);
    assert.equal(decideHalfTermPromotion({ ...airportReturn, vehicleType: "8_seater" }, LONDON_25_OCT_0030).eligible, true);
    assert.equal(decideHalfTermPromotion({ ...airportReturn, source: "admin" }, LONDON_25_OCT_0030).eligible, false);
    assert.equal(decideHalfTermPromotion({ ...airportReturn, otherOfferCode: "STUDENT" }, LONDON_25_OCT_0030).eligible, false);
  });
});

describe("quote acceptance and payment", () => {
  const base = {
    status: "awaiting_customer_confirmation",
    quoteIssuedVersion: 2,
    requestedVersion: 2,
    nowMs: LONDON_25_OCT_0030,
    authorised: true,
    paymentRequirement: "later",
  };

  it("accepts only an explicit authorised action for the issued version", () => {
    const accepted = decideAcceptance(base);
    assert.equal(accepted.ok, true);
    if (accepted.ok) {
      assert.equal(accepted.nextStatus, "confirmed");
      assert.equal(accepted.substatus, "");
    }
    const again = decideAcceptance({ ...base, quoteAcceptedVersion: 2, status: "confirmed" });
    assert.equal(again.ok && again.already, true);
    assert.equal(decideAcceptance({ ...base, requestedVersion: 1 }).ok, false);
    assert.equal(decideAcceptance({ ...base, status: "cancelled" }).ok, false);
    assert.equal(decideAcceptance({ ...base, validUntilMs: base.nowMs - 1 }).ok, false);
    assert.equal(decideAcceptance({ ...base, authorised: false }).ok, false);
  });

  it("keeps advance payment awaiting confirmation until payment is verified", () => {
    const waiting = decideAcceptance({ ...base, paymentRequirement: "advance" });
    assert.equal(waiting.ok, true);
    if (waiting.ok) assert.equal(waiting.substatus, "awaiting_payment");
    assert.equal(
      shouldMoveToConfirmedAfterPayment({
        acceptedVersion: 2,
        issuedVersion: 2,
        paymentVerified: false,
        status: "awaiting_customer_confirmation",
      }),
      false
    );
    assert.equal(
      shouldMoveToConfirmedAfterPayment({
        acceptedVersion: 2,
        issuedVersion: 2,
        paymentVerified: true,
        status: "awaiting_customer_confirmation",
      }),
      true
    );
    assert.equal(
      shouldMoveToConfirmedAfterPayment({
        acceptedVersion: null,
        issuedVersion: 2,
        paymentVerified: true,
        status: "awaiting_customer_confirmation",
      }),
      false
    );
  });

  it("does not mark a booking paid because a payment link was opened", () => {
    assert.equal(paymentStatusAfterCustomerAction("pending"), "pending");
    const deposit = paymentBuckets({
      finalFarePence: 18000,
      amountReceivedPence: 5000,
      paymentRequirement: "advance",
    });
    assert.equal(deposit.stored, "partial");
    assert.equal(deposit.label, "Part paid");
    assert.equal(deposit.outstandingPence, 13000);
    const paid = paymentBuckets({ finalFarePence: 18000, amountReceivedPence: 18000 });
    assert.equal(paid.stored, "paid");
  });

  it("rejects customer acceptance without a token or matching account", () => {
    assert.equal(canCustomerAccept({ authUid: "a", bookingUid: "b", tokenValid: false }), false);
    assert.equal(canCustomerAccept({ authUid: "a", bookingUid: "a", tokenValid: false }), true);
    assert.equal(canCustomerAccept({ tokenValid: true }), true);
    assert.equal(isQuoteAdmin("spirestaxis24@gmail.com"), true);
    assert.equal(isQuoteAdmin("customer@example.com"), false);
  });
});

describe("email jobs and status filters", () => {
  it("does not create a second job for the same event", () => {
    assert.equal(emailEnqueueDecision(null, "auto"), "create");
    assert.equal(emailEnqueueDecision({ status: "queued" }, "auto"), "skip");
    assert.equal(emailEnqueueDecision({ status: "sent" }, "auto"), "skip");
    assert.equal(emailEnqueueDecision({ status: "failed" }, "retry"), "requeue");
    assert.equal(emailEnqueueDecision({ status: "sent" }, "resend"), "create");
    assert.equal(emailJobDocId("b1", "quote", "3", 2), "b1__quote__3__resend_2");
    assert.equal(shouldSendConfirmation(null, { status: "confirmed" }), true);
    assert.equal(shouldSendConfirmation({ status: "confirmed", confirmationEmailSentAt: "x" }, { status: "confirmed", confirmationEmailSentAt: "x" }), false);
    assert.equal(shouldSendConfirmation({ status: "confirmed" }, { status: "confirmed" }), false);
    assert.equal(shouldSendConfirmation({ status: "awaiting_customer_confirmation" }, { status: "confirmed" }), true);
  });

  it("keeps allocated and legacy paid rows in the existing filters", () => {
    assert.equal(bookingMatchesStatusFilter({ status: "confirmed", adminStatus: "allocated" }, "allocated"), true);
    assert.equal(bookingMatchesStatusFilter({ status: "confirmed", adminStatus: "allocated" }, "confirmed"), false);
    assert.equal(bookingMatchesStatusFilter({ status: "paid" }, "completed"), false);
    assert.equal(bookingMatchesStatusFilter({ status: "paid" }, "needs_review"), true);
    assert.equal(bookingMatchesStatusFilter({ status: "awaiting_customer_confirmation" }, "pending"), false);
    assert.equal(bookingMatchesStatusFilter({ status: "awaiting_customer_confirmation" }, "awaiting_customer_confirmation"), true);
    assert.equal(bookingMatchesStatusFilter({ status: "pending" }, "all"), true);
  });
});

describe("payment links", () => {
  const hosts = paymentLinkAllowlist("pay.example.test");

  it("allows configured https hosts and rejects unsafe or lookalike urls", () => {
    assert.equal(
      validatePaymentLinkUrl("https://checkout.stripe.com/c/pay/cs_test_123", hosts).startsWith("https://checkout.stripe.com/"),
      true
    );
    assert.equal(validatePaymentLinkUrl("https://pay.example.test/hosted", hosts), "https://pay.example.test/hosted");
    assert.throws(() => validatePaymentLinkUrl("http://checkout.stripe.com/pay", hosts));
    assert.throws(() => validatePaymentLinkUrl("https://user:pass@checkout.stripe.com/pay", hosts));
    assert.throws(() => validatePaymentLinkUrl("https://checkout.stripe.com.evil.test/pay", hosts));
    assert.throws(() => validatePaymentLinkUrl("https://checkout-stripe.com/pay", hosts));
    assert.throws(() => validatePaymentLinkUrl("javascript:alert(1)", hosts));
  });
});

describe("invoice paid state", () => {
  it("issues the next invoice number from the stored counter and ignores a client number", () => {
    const first = assignServerInvoiceNumbers([], [{
      id: "draft-a",
      needsServerNumber: true,
      numberPrefix: "ST-INV",
      numberPeriod: "2026-11",
      invoiceNumber: "ST-INV-202611-999",
    }], {});
    assert.equal(first.assigned[0].invoiceNumber, "ST-INV-202611-001");
    assert.equal(first.invoices[0].needsServerNumber, undefined);
    const second = assignServerInvoiceNumbers(first.invoices, [...first.invoices, {
      id: "draft-b",
      needsServerNumber: true,
      numberPrefix: "ST-INV",
      numberPeriod: "2026-11",
    }], first.seq);
    assert.equal(second.assigned[0].invoiceNumber, "ST-INV-202611-002");
    const recovered = assignServerInvoiceNumbers(second.invoices, second.invoices.map((row) => (
      row.id === "draft-a" ? { ...row, invoiceNumber: "PENDING", needsServerNumber: true, numberPrefix: "ST-INV", numberPeriod: "2026-11" } : row
    )), second.seq);
    assert.equal(recovered.assigned.find((row) => row.id === "draft-a")?.invoiceNumber, "ST-INV-202611-001");
    assert.equal(recovered.seq["ST-INV-2026-11"], 2);
    const stale = planInvoiceSave({ invoices: first.invoices, seq: first.seq, revision: 1 }, {
      expectedRevision: 0,
      invoices: [{ id: "draft-c", needsServerNumber: true, numberPrefix: "ST-INV", numberPeriod: "2026-11" }],
    });
    assert.equal(stale.ok, false);
  });

  it("keeps a full invoice history and rejects a stale session", () => {
    const existing = Array.from({ length: 120 }, (_, index) => ({ id: `inv-${index}`, invoiceNumber: `ST-${index}` }));
    assert.equal(mergeInvoiceRecords(existing, existing).length, 120);
    const first = invoiceRevisionDecision(undefined, 0);
    assert.equal(first.ok && first.revision, 1);
    const explicitZero = invoiceRevisionDecision(0, 0);
    assert.equal(explicitZero.ok && explicitZero.revision, 1);
    const omitted = invoiceRevisionDecision(undefined, undefined);
    assert.equal(omitted.ok, false);
    const omittedOnZero = invoiceRevisionDecision(0, undefined);
    assert.equal(omittedOnZero.ok, false);
    const stale = invoiceRevisionDecision(1, 0);
    assert.equal(stale.ok, false);
    const reloaded = invoiceRevisionDecision(1, 1);
    assert.equal(reloaded.ok && reloaded.revision, 2);
    const root = path.resolve(__dirname, "../..");
    const server = fs.readFileSync(path.join(root, "src/schoolInvoiceVault.ts"), "utf8");
    const general = fs.readFileSync(path.join(root, "../spires-admin-fresh/src/utils/generalInvoiceStorage.ts"), "utf8");
    const school = fs.readFileSync(path.join(root, "../spires-admin-fresh/src/utils/schoolInvoiceStorage.ts"), "utf8");
    assert.equal(server.includes("slice(0, 100)"), false);
    assert.equal(general.includes("slice(0, 100)"), false);
    assert.equal(school.includes("slice(0, 100)"), false);
    assert.equal(general.includes("expectedRevision: Number.isInteger(vault.revision) ? vault.revision : 0"), true);
    assert.equal(school.includes("expectedRevision: Number.isInteger(vault.revision) ? vault.revision : 0"), true);
    const schoolLoad = school.slice(school.indexOf("export async function loadSchoolInvoiceVault"), school.indexOf("export async function persistSchoolInvoiceVault"));
    assert.equal(schoolLoad.includes("persistSchoolInvoiceVault"), false);
    assert.equal(schoolLoad.includes("saveVaultFn"), false);
    const saveFn = server.slice(server.indexOf("export const saveSchoolInvoiceVault"));
    const planAt = saveFn.indexOf("planInvoiceSave");
    const rejectAt = saveFn.indexOf("if (!planned.ok)");
    const writeAt = saveFn.indexOf("tx.set");
    assert.equal(planAt > 0 && rejectAt > planAt && writeAt > rejectAt, true);
  });

  it("rejects an old client on a vault with no revision and lets one first save win", async () => {
    const history = Array.from({ length: 120 }, (_, index) => ({ id: `inv-${index}`, invoiceNumber: `ST-${index}` }));
    const legacy = { invoices: history, seq: { "ST-INV-2026-11": 3 } };
    const before = JSON.stringify(legacy);
    const oldClient = planInvoiceSave(legacy, { invoices: history.slice(0, 100), seq: {} });
    assert.equal(oldClient.ok, false);
    if (!oldClient.ok) assert.match(oldClient.reason, /Reload before saving/);
    assert.equal(JSON.stringify(legacy), before);

    let stored: { invoices: typeof history; seq: Record<string, number>; revision?: number } = {
      invoices: history.map((row) => ({ ...row })),
      seq: { ...legacy.seq },
    };
    let tail = Promise.resolve();
    const save = (invoices: typeof history) => {
      const turn = tail.then(() => {
        const planned = planInvoiceSave(stored, { expectedRevision: 0, invoices, seq: stored.seq });
        if (!planned.ok) return planned;
        stored = {
          invoices: planned.invoices.map((row) => ({ id: String(row.id), invoiceNumber: String(row.invoiceNumber) })),
          seq: planned.seq,
          revision: planned.revision,
        };
        return planned;
      });
      tail = turn.then(() => undefined, () => undefined);
      return turn;
    };
    const [firstSession, secondSession] = await Promise.all([
      save([...history, { id: "draft-a", invoiceNumber: "ST-INV-202611-901" }]),
      save([...history, { id: "draft-b", invoiceNumber: "ST-INV-202611-902" }]),
    ]);
    const results = [firstSession, secondSession];
    assert.equal(results.filter((row) => row.ok).length, 1);
    assert.equal(results.filter((row) => !row.ok).length, 1);
    assert.equal(stored.revision, 1);
    assert.equal(stored.invoices.length, 121);
    assert.equal(stored.invoices.filter((row) => history.some((item) => item.id === row.id)).length, 120);
    assert.equal(stored.invoices.some((row) => row.id === "draft-a") === stored.invoices.some((row) => row.id === "draft-b"), false);
  });

  it("keeps paidAt when a later email write omits it", () => {
    const existing = [{ id: "ST-UKG-202610-002", invoiceNumber: "ST-UKG-202610-002", paidAt: "2026-10-20T12:00:00.000Z", lines: [] }];
    const staleEmail = [{ id: "ST-UKG-202610-002", invoiceNumber: "ST-UKG-202610-002", emailedAt: "2026-10-21T09:00:00.000Z", emailedTo: "a@example.com", emailStatus: "sent" }];
    const merged = mergeInvoiceRecords(existing, staleEmail);
    assert.equal(merged[0].paidAt, "2026-10-20T12:00:00.000Z");
    assert.equal(merged[0].emailedTo, "a@example.com");
    const cleared = mergeInvoiceRecords(merged, [{ id: "ST-UKG-202610-002", paidAt: null }]);
    assert.equal(cleared[0].paidAt, undefined);
    assert.equal(cleared[0].emailedTo, "a@example.com");
  });

  it("shows paid, unpaid or overdue without treating missing payment as paid", () => {
    const row = { id: "1", dueDate: "2026-10-01", lines: [{ quantity: 1, unitPrice: 10 }] };
    assert.equal(invoicePaymentState(row, "2026-10-20", 10), "overdue");
    assert.equal(invoicePaymentState({ ...row, paidAt: "2026-10-05" }, "2026-10-20", 10), "paid");
    assert.equal(invoicePaymentState({ ...row, dueDate: "" }, "2026-10-20", 10), "unpaid");
    assert.equal(invoicePaymentState(row, "2026-10-01", 10), "unpaid");
    assert.equal(invoicePaymentState(row, "2026-10-20", 0), "unpaid");
    assert.equal(invoiceEmailState({}), "not_sent");
    assert.equal(invoiceEmailState({ emailStatus: "queued" }), "queued");
    assert.equal(invoiceEmailState({ emailedAt: "2026-10-01" }), "sent");
    assert.equal(invoiceEmailState({ emailStatus: "failed", emailedAt: "2026-10-01" }), "failed");
    assert.equal(invoicePaidDateLabel("2026-10-20T12:00:00.000Z"), "2026-10-20");
    assert.equal(invoicePaidDateLabel(""), "");
  });
});

describe("booking reliability regressions", () => {
  it("confirms when a sufficient deposit was recorded before acceptance", () => {
    const result = decideAcceptance({ status: "awaiting_customer_confirmation", quoteIssuedVersion: 3,
      requestedVersion: 3, nowMs: Date.now(), authorised: true, paymentRequirement: "advance", advancePaymentSatisfied: true });
    assert.equal(result.ok && result.nextStatus, "confirmed");
    assert.equal(result.ok && result.substatus, "");
    const insufficient = decideAcceptance({ status: "awaiting_customer_confirmation", quoteIssuedVersion: 3,
      requestedVersion: 3, nowMs: Date.now(), authorised: true, paymentRequirement: "advance", advancePaymentSatisfied: false });
    assert.equal(insufficient.ok && insufficient.substatus, "awaiting_payment");
  });

  it("does not confirm a pending or cancelled job from stale legacy fields", () => {
    for (const status of ["pending", "awaiting_customer_confirmation", "cancelled"]) {
      assert.equal(shouldSendConfirmation(null, { status, adminStatus: "confirmed", customerStatus: "confirmed" }), false);
      assert.equal(effectiveWorkflowStatus({ status, adminStatus: "confirmed" }), status);
      assert.equal(bookingMatchesStatusFilter({ status, customerStatus: "confirmed" }, "confirmed"), false);
    }
  });

  it("stays silent when contact is added to an already confirmed booking, and never resends a sent confirmation", () => {
    // Profile merge / contact correction on an old confirmed job must not queue mail.
    assert.equal(shouldSendConfirmation({ status: "confirmed" }, { status: "confirmed", email: "test@example.com" }), false);
    assert.equal(shouldSendConfirmation({ status: "confirmed", email: "test@example.com" }, { status: "confirmed", email: "test@example.com" }), false);
    assert.equal(shouldSendConfirmation({ status: "confirmed" }, { status: "confirmed", email: "test@example.com", confirmationEmailSentAt: "sent" }), false);
    // A genuine new confirmation still sends.
    assert.equal(shouldSendConfirmation({ status: "pending" }, { status: "confirmed", email: "test@example.com" }), true);
    assert.equal(shouldSendConfirmation(null, { status: "confirmed", email: "test@example.com" }), true);
  });

  it("allows the actual Shift4 payment host and rejects lookalikes", () => {
    const hosts = paymentLinkAllowlist();
    assert.equal(validatePaymentLinkUrl("https://pay.shift4.com/link_example", hosts), "https://pay.shift4.com/link_example");
    assert.throws(() => validatePaymentLinkUrl("https://pay.shift4.com.evil.test/link_example", hosts));
    assert.throws(() => validatePaymentLinkUrl("https://pay-shift4.com/link_example", hosts));
  });

  it("keeps a 12.50 deposit against a 42.50 fare part paid with 30 outstanding", () => {
    assert.deepEqual(paymentBuckets({ finalFarePence: 4250, amountReceivedPence: 1250 }), {
      stored: "partial", label: "Part paid", outstandingPence: 3000,
    });
    assert.equal(shouldMoveToConfirmedAfterPayment({ acceptedVersion: 2, issuedVersion: 3, paymentVerified: true, status: "pending" }), false);
  });
});
