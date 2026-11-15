/**
 * Proves a financial write and an operational write on the same booking both survive.
 * Emulator only.
 */
import admin from "firebase-admin";
import assert from "node:assert/strict";

if (!process.env.FIRESTORE_EMULATOR_HOST) {
  throw new Error("Refusing to run because the Firestore emulator is not set.");
}
const project = process.env.GCLOUD_PROJECT || "demo-spires";
if (project.includes("spires-taxis")) throw new Error("Refusing to run against the live project.");
admin.initializeApp({ projectId: project });
const db = admin.firestore();
const ref = db.collection("bookings").doc("race-booking");
await ref.set({
  bookingNumber: "SYN-RACE",
  hirerName: "Synthetic Customer",
  pickupLocation: "Race Street",
  destination: "Race Station",
  pickupTime: "2026-11-21T09:00:00.000Z",
  status: "confirmed",
  actualFare: 25,
  revision: 1,
});

async function patch(fields) {
  await db.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    tx.update(ref, { ...fields, revision: Number(snap.data().revision || 0) + 1 });
  });
}

await Promise.all([
  patch({ driverId: "driver-sam", vehicleId: "vehicle-out" }),
  patch({ amountReceivedPence: 1500, paymentStatus: "part_paid" }),
]);
const saved = (await ref.get()).data();
assert.equal(saved.driverId, "driver-sam");
assert.equal(saved.vehicleId, "vehicle-out");
assert.equal(saved.amountReceivedPence, 1500);
assert.equal(saved.paymentStatus, "part_paid");
assert.equal(saved.revision, 3);
assert.equal(saved.actualFare, 25);
console.log(JSON.stringify({
  concurrent: "driver, vehicle and payment all present",
  revision: saved.revision,
  path: "Admin SDK transaction",
  rulesNote: "These writes bypass security rules. A client write without the next revision is rejected by rules and is reported as an error, not an empty list.",
}));
process.exit(0);
