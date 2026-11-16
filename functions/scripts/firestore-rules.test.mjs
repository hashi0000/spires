/**
 * Permitted and rejected access against the working-copy Firestore rules.
 *
 * Requires Java and @firebase/rules-unit-testing. The emulator is local only.
 * From the repository root, after installing the test package in functions:
 *   node functions/scripts/firestore-rules.test.mjs
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, Timestamp, updateDoc, serverTimestamp } from "firebase/firestore";

const root = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const rules = readFileSync(resolve(root, "firestore.rules"), "utf8");

const testEnv = await initializeTestEnvironment({
  projectId: "spires-rules-test",
  firestore: { rules },
});

const later = Timestamp.fromDate(new Date("2099-01-01T00:00:00Z"));
const familyJob = {
  bookingNumber: "SP900001",
  dateTime: "2026-11-14T10:00:00Z",
  pickupTime: "2026-11-14T10:00:00Z",
  pickupLocation: "Oxford",
  destination: "Heathrow",
  hirerName: "Alex Stone",
  hirerPhone: "07700900000",
  hirerAddress: "",
  bookingMethod: "telephone",
  bookingType: "one_way",
  vehicleType: "saloon",
  status: "confirmed",
  flightNumber: "",
  notes: "",
  source: "family",
  createdByEmail: "family@example.com",
  createdByUid: "family-1",
  updatedByEmail: "family@example.com",
  updatedByUid: "family-1",
  actualFare: 40,
  revision: 1,
};

await testEnv.withSecurityRulesDisabled(async (context) => {
  const db = context.firestore();
  await setDoc(doc(db, "familyDevices/family-1"), { enabled: true, expiresAt: later });
  await setDoc(doc(db, "bookings/customer-job"), {
    uid: "customer-1",
    status: "pending",
    source: "website",
    phone: "07700900001",
    actualFare: 40,
    amountReceivedPence: 1000,
  });
  await setDoc(doc(db, "bookings/family-existing"), { ...familyJob, bookingNumber: "SP900002" });
  await setDoc(doc(db, "bookings/assigned-job"), {
    ...familyJob,
    bookingNumber: "SP900010",
    status: "confirmed",
    driverId: "driver-1",
    actualFare: 92,
    paymentStatus: "pending",
    pickupLocation: "Oxford",
    destination: "Heathrow",
    revision: 1,
  });
  await setDoc(doc(db, "bookings/cancelled-job"), {
    ...familyJob,
    bookingNumber: "SP900011",
    status: "cancelled",
    customerStatus: "cancelled",
    driverId: "driver-1",
    revision: 1,
  });
  await setDoc(doc(db, "drivers/driver-1"), { name: "Driver" });
  await setDoc(doc(db, "vehicles/vehicle-1"), { registration: "AB12 CDE" });
  await setDoc(doc(db, "stripePaymentClaims/pi_test"), { bookingId: "customer-job" });
});

const customer = testEnv.authenticatedContext("customer-1", { email: "customer@example.com" }).firestore();
const other = testEnv.authenticatedContext("customer-2", { email: "other@example.com" }).firestore();
const staff = testEnv.authenticatedContext("staff-1", { email: "hashim@spires.com" }).firestore();
const family = testEnv.authenticatedContext("family-1", { email: "family@example.com", familyJobs: true }).firestore();
const claimOnly = testEnv.authenticatedContext("family-2", { email: "family@example.com", familyJobs: true }).firestore();
const signedOut = testEnv.unauthenticatedContext().firestore();

await assertSucceeds(getDoc(doc(customer, "bookings/customer-job")));
await assertSucceeds(updateDoc(doc(customer, "bookings/customer-job"), { phone: "07700900002", revision: 1 }));
await assertFails(updateDoc(doc(customer, "bookings/customer-job"), { phone: "07700900003" }));
await assertFails(updateDoc(doc(customer, "bookings/customer-job"), { amountReceivedPence: 0 }));
await assertFails(updateDoc(doc(customer, "bookings/customer-job"), { uid: "customer-2" }));
await assertFails(getDoc(doc(customer, "drivers/driver-1")));
await assertFails(getDoc(doc(customer, "vehicles/vehicle-1")));
await assertFails(getDoc(doc(customer, "bookings/customer-job/audit/event-1")));

await assertFails(getDoc(doc(other, "bookings/customer-job")));
await assertFails(getDoc(doc(other, "drivers/driver-1")));
await assertFails(getDoc(doc(other, "vehicles/vehicle-1")));
await assertFails(getDoc(doc(signedOut, "drivers/driver-1")));
await assertFails(getDoc(doc(signedOut, "bookings/customer-job")));

await assertSucceeds(setDoc(doc(staff, "bookings/staff-job"), { status: "pending", revision: 1 }));
await assertFails(updateDoc(doc(staff, "bookings/staff-job"), { status: "confirmed" }));
await assertSucceeds(updateDoc(doc(staff, "bookings/staff-job"), { status: "confirmed", revision: 2 }));
await assertSucceeds(getDoc(doc(staff, "drivers/driver-1")));
await assertSucceeds(getDoc(doc(staff, "vehicles/vehicle-1")));
await assertFails(getDoc(doc(staff, "stripePaymentClaims/pi_test")));
await assertFails(getDoc(doc(staff, "bookings/customer-job/audit/event-1")));

await assertFails(getDoc(doc(claimOnly, "drivers/driver-1")));
await assertSucceeds(getDoc(doc(family, "drivers/driver-1")));
await assertSucceeds(getDoc(doc(family, "vehicles/vehicle-1")));
await assertSucceeds(setDoc(doc(family, "bookings/family-new"), familyJob));
await assertFails(setDoc(doc(family, "bookings/family-stale"), { ...familyJob, bookingNumber: "SP900004", revision: 0 }));
await assertSucceeds(updateDoc(doc(family, "bookings/family-new"), { notes: "Terminal 5", revision: 2 }));
await assertFails(updateDoc(doc(family, "bookings/family-new"), { notes: "Lost update", revision: 2 }));
await assertSucceeds(updateDoc(doc(family, "bookings/family-existing"), { actualFare: 45, revision: 2 }));
await assertFails(updateDoc(doc(family, "bookings/customer-job"), { actualFare: 1 }));
await assertFails(updateDoc(doc(family, "bookings/customer-job"), { amountReceivedPence: 0 }));
await assertFails(updateDoc(doc(family, "bookings/customer-job"), { issuedQuote: { finalFarePence: 1 } }));
await assertFails(updateDoc(doc(family, "bookings/customer-job"), { uid: "family-1" }));
await assertFails(setDoc(doc(family, "bookings/family-money"), { ...familyJob, bookingNumber: "SP900003", amountReceivedPence: 4000 }));
await assertFails(deleteDoc(doc(family, "bookings/family-new")));

const completion = {
  status: "completed",
  adminStatus: "completed",
  outboundStatus: "completed",
  outboundCompletedAt: serverTimestamp(),
  outboundCompletedByUid: "family-1",
  updatedByUid: "family-1",
  updatedAt: serverTimestamp(),
  revision: 2,
};
await assertFails(updateDoc(doc(family, "bookings/assigned-job"), { ...completion, actualFare: 1 }));
await assertFails(updateDoc(doc(family, "bookings/cancelled-job"), completion));
await assertFails(updateDoc(doc(customer, "bookings/assigned-job"), completion));
await assertSucceeds(updateDoc(doc(family, "bookings/assigned-job"), completion));
const saved = await getDoc(doc(family, "bookings/assigned-job"));
assert.equal(saved.data().status, "completed");
assert.equal(saved.data().actualFare, 92);
assert.equal(saved.data().paymentStatus, "pending");
assert.equal(saved.data().pickupLocation, "Oxford");
assert.equal(saved.data().destination, "Heathrow");
assert.equal(saved.data().driverId, "driver-1");
await assertFails(updateDoc(doc(family, "bookings/assigned-job"), {
  status: "allocated",
  adminStatus: "allocated",
  outboundStatus: "allocated",
  revision: 3,
}));
await assertSucceeds(updateDoc(doc(staff, "bookings/assigned-job"), {
  status: "allocated",
  adminStatus: "allocated",
  outboundStatus: "allocated",
  revision: 3,
}));
await assertSucceeds(setDoc(doc(staff, "bookings/assigned-job/audit/undo-outbound-3"), {
  action: "leg_completion_undone",
  leg: "outbound",
  actorUid: "staff-1",
  at: serverTimestamp(),
}));
await assertFails(setDoc(doc(family, "bookings/assigned-job/audit/undo-outbound-4"), {
  action: "leg_completion_undone",
  leg: "outbound",
  actorUid: "family-1",
  at: serverTimestamp(),
}));

await testEnv.cleanup();

const previousStaffRules = `
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    function isStaff() {
      return request.auth != null
        && request.auth.token.email in ['hashim@spires.com', 'spirestaxis24@gmail.com'];
    }
    match /bookings/{id} {
      allow read, create, update, delete: if isStaff();
    }
  }
}
`;
const oldEnv = await initializeTestEnvironment({
  projectId: "spires-rules-previous",
  firestore: { rules: previousStaffRules },
});
const oldStaff = oldEnv.authenticatedContext("staff-1", { email: "hashim@spires.com" }).firestore();
await assertSucceeds(setDoc(doc(oldStaff, "bookings/new-tab"), {
  status: "pending",
  revision: 1,
  actualFare: 40,
}));
await assertSucceeds(updateDoc(doc(oldStaff, "bookings/new-tab"), { notes: "Saved by the new screen", revision: 2 }));
await oldEnv.cleanup();

assert.equal(true, true);
console.log("firestore rules: permitted and rejected access passed");
