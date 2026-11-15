/**
 * Local Firestore checks for invoice numbers, card receipts, welcome mail,
 * and one booking through quote, payment, allocation, completion and invoice.
 * No Stripe API call and no customer message. The recipient is a test address.
 */
import assert from "node:assert/strict";
import admin from "firebase-admin";
import { planInvoiceSave } from "../lib/quotes/invoiceVault.js";
import { commitCardReceipt } from "../lib/payment.js";
import { paymentAttemptPlan } from "../lib/paymentAttempt.js";
import { serverPayablePence } from "../lib/paymentAmount.js";
import { deliverWelcomeEmail } from "../lib/sendWelcomeEmail.js";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("FIRESTORE_EMULATOR_HOST is not set. Run this with firebase emulators:exec.");
}

admin.initializeApp({ projectId: "spires-isolated-flows" });
const db = admin.firestore();

function intent(id, amount, bookingId) {
  return { id, amount, currency: "gbp", metadata: { bookingId, userId: "customer-1" } };
}

async function seed(id, data) {
  await db.collection("bookings").doc(id).set({
    uid: "customer-1",
    bookingNumber: id.toUpperCase(),
    status: "confirmed",
    customerStatus: "confirmed",
    adminStatus: "confirmed",
    actualFare: 80,
    amountReceivedPence: 0,
    revision: 1,
    hirerName: "Test Customer",
    hirerEmail: "review-booking@example.com",
    pickupLocation: "Oxford",
    destination: "Heathrow Terminal 5",
    ...data,
  });
}

const invoiceRef = db.collection("invoiceChecks").doc("general");
async function saveInvoices(incoming) {
  return db.runTransaction(async (tx) => {
    const snap = await tx.get(invoiceRef);
    const planned = planInvoiceSave(snap.exists ? snap.data() : null, incoming);
    if (!planned.ok) throw new Error(planned.reason);
    tx.set(invoiceRef, {
      revision: planned.revision,
      invoices: planned.invoices,
      seq: planned.seq,
    });
    return planned.assigned.map((row) => row.invoiceNumber);
  });
}

const pending = (id) => ({ id, invoiceNumber: "PENDING", needsServerNumber: true, numberPrefix: "ST-INV", numberPeriod: "2026-11", invoiceDate: "2026-11-14" });
const raced = await Promise.allSettled([
  saveInvoices({ revision: 0, invoices: [pending("draft-a")] }),
  saveInvoices({ revision: 0, invoices: [pending("draft-b")] }),
]);
assert.equal(raced.filter((row) => row.status === "fulfilled").length, 1);
assert.equal(raced.filter((row) => row.status === "rejected").length, 1);
const afterRace = (await invoiceRef.get()).data();
const winnerId = afterRace.invoices[0].id;
const missingId = winnerId === "draft-a" ? "draft-b" : "draft-a";
const secondSave = await saveInvoices({
  revision: afterRace.revision,
  invoices: [...afterRace.invoices, pending(missingId)],
});
assert.deepEqual(
  (await invoiceRef.get()).data().invoices.map((row) => row.invoiceNumber).sort(),
  ["ST-INV-202611-001", "ST-INV-202611-002"]
);
assert.equal(secondSave.at(-1), "ST-INV-202611-002");
const oldReaderDropsTheNewest = Array.from({ length: 101 }, (_, index) => ({ id: `row-${index}` })).slice(0, 100);
assert.equal(oldReaderDropsTheNewest.at(-1).id, "row-99");

await seed("cash-card", { depositRequired: true, depositAmount: 20 });
await db.collection("bookings").doc("cash-card").update({
  amountReceivedPence: 2000,
  paymentMethod: "cash",
  paymentStatus: "partial",
  revision: 2,
});
assert.equal(await commitCardReceipt(db, "cash-card", intent("pi_balance1", 6000, "cash-card")), "credited");
const cashCard = (await db.collection("bookings").doc("cash-card").get()).data();
assert.equal(cashCard.amountReceivedPence, 8000);
assert.equal(cashCard.paymentStatus, "paid");
assert.equal(cashCard.actualFare, 80);

await seed("two-cards", { depositRequired: true, depositAmount: 20 });
assert.equal(await commitCardReceipt(db, "two-cards", intent("pi_deposit1", 2000, "two-cards")), "credited");
assert.equal(await commitCardReceipt(db, "two-cards", intent("pi_balance2", 6000, "two-cards")), "credited");
const twoCards = (await db.collection("bookings").doc("two-cards").get()).data();
assert.equal(twoCards.amountReceivedPence, 8000);
assert.deepEqual(twoCards.appliedStripePaymentIntentIds.sort(), ["pi_balance2", "pi_deposit1"]);

await seed("equal-a");
await seed("equal-b");
assert.equal(await commitCardReceipt(db, "equal-a", intent("pi_equalA", 2000, "equal-a")), "credited");
assert.equal(await commitCardReceipt(db, "equal-b", intent("pi_equalB", 2000, "equal-b")), "credited");
assert.equal((await db.collection("bookings").doc("equal-a").get()).data().amountReceivedPence, 2000);
assert.equal((await db.collection("bookings").doc("equal-b").get()).data().amountReceivedPence, 2000);

await seed("shared-intent");
await seed("shared-other");
const shared = intent("pi_shared1", 2000, "shared-intent");
const [sharedFirst, sharedSecond] = await Promise.all([
  commitCardReceipt(db, "shared-intent", shared),
  commitCardReceipt(db, "shared-intent", shared),
]);
assert.deepEqual([sharedFirst, sharedSecond].sort(), ["credited", "duplicate"]);
assert.equal((await db.collection("bookings").doc("shared-intent").get()).data().amountReceivedPence, 2000);
assert.equal(await commitCardReceipt(db, "shared-other", { ...shared, metadata: { bookingId: "shared-other", userId: "customer-1" } }), "rejected");
assert.equal((await db.collection("bookings").doc("shared-other").get()).data().amountReceivedPence, 0);

await seed("open-intent", { openStripePaymentIntentId: "pi_openfare", openStripePaymentAmountPence: 8000, openStripePaymentNonce: "nonce-a" });
const reused = paymentAttemptPlan((await db.collection("bookings").doc("open-intent").get()).data(), 8000, "nonce-b");
assert.equal(reused.action, "reuse");
await db.collection("bookings").doc("open-intent").update({ actualFare: 90 });
const changed = paymentAttemptPlan({ ...(await db.collection("bookings").doc("open-intent").get()).data(), id: "open-intent" }, 9000, "nonce-c");
assert.equal(changed.action, "create");
assert.equal(changed.idempotencyKey, "spires_open-intent_nonce-c");
assert.equal(await commitCardReceipt(db, "open-intent", intent("pi_openfare", 8000, "open-intent")), "credited");
assert.equal(await commitCardReceipt(db, "open-intent", intent("pi_openfare", 8000, "open-intent")), "duplicate");
assert.equal((await db.collection("bookings").doc("open-intent").get()).data().amountReceivedPence, 8000);

await seed("cancelled", { status: "cancelled" });
assert.equal(serverPayablePence((await db.collection("bookings").doc("cancelled").get()).data()).ok, false);
assert.equal(await commitCardReceipt(db, "cancelled", { id: "pi_bad", amount: 1000, currency: "usd", metadata: { bookingId: "cancelled" } }), "rejected");
assert.equal((await db.collection("bookings").doc("cancelled").get()).data().amountReceivedPence, 0);

await seed("journey", {
  bookingType: "return",
  openReturn: true,
  returnNoticeNote: "Customer will call with the return time.",
  status: "awaiting_customer_confirmation",
  customerStatus: "awaiting_customer_confirmation",
  adminStatus: "awaiting_customer_confirmation",
  actualFare: 120,
});
await db.collection("bookings").doc("journey").update({
  status: "confirmed",
  customerStatus: "confirmed",
  adminStatus: "confirmed",
  quoteAcceptedVersion: 1,
  revision: admin.firestore.FieldValue.increment(1),
});
assert.equal(await commitCardReceipt(db, "journey", intent("pi_journeyDeposit", 3000, "journey")), "credited");
await db.collection("bookings").doc("journey").update({
  driverId: "driver-1",
  returnDriverId: "driver-2",
  vehicleId: "vehicle-1",
  status: "allocated",
  adminStatus: "allocated",
  revision: admin.firestore.FieldValue.increment(1),
});
await db.collection("bookings").doc("journey").update({
  status: "completed",
  adminStatus: "completed",
  revision: admin.firestore.FieldValue.increment(1),
});
assert.equal(await commitCardReceipt(db, "journey", intent("pi_journeyBalance", 9000, "journey")), "credited");
const journey = (await db.collection("bookings").doc("journey").get()).data();
assert.equal(journey.amountReceivedPence, 12000);
assert.equal(journey.paymentStatus, "paid");
assert.equal(journey.returnDriverId, "driver-2");
assert.equal(journey.openReturn, true);
assert.ok(journey.revision > 1);
const currentVault = (await invoiceRef.get()).data();
const receipt = await saveInvoices({
  revision: currentVault.revision,
  invoices: [
    ...currentVault.invoices,
    pending("draft-journey"),
  ],
});
assert.equal(receipt.at(-1), "ST-INV-202611-003");

const welcomeSent = [];
const [welcomeA, welcomeB] = await Promise.all([
  deliverWelcomeEmail(db, "welcome-1", { email: "review-welcome@example.com", firstName: "Review" }, async (message) => {
    welcomeSent.push(message.to);
  }),
  deliverWelcomeEmail(db, "welcome-1", { email: "review-welcome@example.com", firstName: "Review" }, async (message) => {
    welcomeSent.push(message.to);
  }),
]);
assert.equal(welcomeSent.length, 1);
assert.equal(welcomeSent[0], "review-welcome@example.com");
assert.equal([welcomeA, welcomeB].includes("sent"), true);
assert.equal([welcomeA, welcomeB].every((row) => row === "sent" || row === "needs_review" || row === "already_sent"), true);
const welcome = (await db.collection("customers").doc("welcome-1").get()).data();
assert.equal(welcome.welcomeEmailStatus === "sent" || welcome.welcomeEmailStatus === "needs_review", true);
const stuck = [];
await db.collection("customers").doc("welcome-stuck").set({
  email: "review-welcome@example.com",
  welcomeEmailStatus: "sending",
  welcomeEmailAttempts: 1,
});
const reviewed = await deliverWelcomeEmail(db, "welcome-stuck", { email: "review-welcome@example.com", firstName: "Review" }, async () => {
  stuck.push("duplicate");
});
assert.equal(reviewed, "needs_review");
assert.deepEqual(stuck, []);
assert.equal((await db.collection("customers").doc("welcome-stuck").get()).data().welcomeEmailStatus, "needs_review");

const claim = (await db.collection("stripePaymentClaims").doc("pi_shared1").get()).data();
assert.equal(claim.bookingId, "shared-intent");
const rollbackReader = {
  amountReceivedPence: journey.amountReceivedPence,
  invoices: (await invoiceRef.get()).data().invoices.length,
  claimIgnored: claim.paymentIntentId,
};
assert.equal(rollbackReader.amountReceivedPence, 12000);
assert.equal(rollbackReader.invoices, 3);
assert.equal(rollbackReader.claimIgnored, "pi_shared1");

console.log(JSON.stringify({
  invoiceNumbers: ["ST-INV-202611-001", "ST-INV-202611-002", "ST-INV-202611-003"],
  payments: "credited once, duplicate retry, second booking rejected, cash then card, two cards, two equal amounts",
  welcome: "one message to review-welcome@example.com",
  journey: "open return allocated, completed, paid, invoiced",
}, null, 2));
