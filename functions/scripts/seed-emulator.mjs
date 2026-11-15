/**
 * Synthetic local data only. Refuses to run unless both emulators are set and the project is not live.
 */
import admin from "firebase-admin";

const project = process.env.GCLOUD_PROJECT || process.env.GOOGLE_CLOUD_PROJECT || "demo-spires";
if (!process.env.FIRESTORE_EMULATOR_HOST || !process.env.FIREBASE_AUTH_EMULATOR_HOST) {
  throw new Error("Refusing to seed because the Firestore or Auth emulator is not set.");
}
if (project === "spires-taxis" || project.includes("spires-taxis")) {
  throw new Error("Refusing to seed because the project is the live Firebase project.");
}
if (!process.env.FIRESTORE_EMULATOR_HOST.startsWith("127.0.0.1") && !process.env.FIRESTORE_EMULATOR_HOST.startsWith("localhost")) {
  throw new Error("Refusing to seed because Firestore is not on this machine.");
}

admin.initializeApp({ projectId: project });
const db = admin.firestore();
const auth = admin.auth();

async function ensureUser(email, password) {
  try {
    const existing = await auth.getUserByEmail(email);
    await auth.updateUser(existing.uid, { password, emailVerified: true });
    return existing.uid;
  } catch (err) {
    if (err.code !== "auth/user-not-found") throw err;
    const created = await auth.createUser({ email, password, emailVerified: true });
    return created.uid;
  }
}

const staffId = await ensureUser("hashim@spires.com", "Local-test-only-1");
const customerId = await ensureUser("synthetic.customer@example.com", "Local-test-only-1");

await db.collection("drivers").doc("driver-sam").set({
  name: "Sam Test",
  phone: "07000000001",
  active: true,
  email: "sam.test@example.com",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
await db.collection("drivers").doc("driver-alex").set({
  name: "Alex Test",
  phone: "07000000002",
  active: true,
  email: "alex.test@example.com",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
await db.collection("vehicles").doc("vehicle-out").set({
  registration: "TE57 OUT",
  type: "standard",
  active: true,
  available: true,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
await db.collection("vehicles").doc("vehicle-ret").set({
  registration: "TE57 RET",
  type: "standard",
  active: true,
  available: true,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});

const later = "2026-11-20T10:00:00.000Z";
const returnAt = "2026-11-20T18:00:00.000Z";
await db.collection("bookings").doc("seed-pay-later").set({
  bookingNumber: "SYN-LATER",
  hirerName: "Synthetic Customer",
  hirerEmail: "synthetic.customer@example.com",
  hirerPhone: "07000000999",
  pickupLocation: "1 Test Street, Oxford OX1 1AA",
  destination: "Oxford Station",
  pickupTime: later,
  dateTime: later,
  bookingType: "one_way",
  vehicleType: "standard",
  status: "confirmed",
  adminStatus: "confirmed",
  customerStatus: "confirmed",
  actualFare: 40,
  paymentStatus: "pending",
  amountReceivedPence: 0,
  revision: 1,
  source: "office",
  uid: customerId,
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
await db.collection("bookings").doc("seed-return").set({
  bookingNumber: "SYN-RETURN",
  hirerName: "Synthetic Customer",
  hirerEmail: "synthetic.customer@example.com",
  pickupLocation: "2 Test Street, Oxford OX1 1AB",
  destination: "Heathrow Terminal 5",
  pickupTime: later,
  dateTime: later,
  returnPickupTime: returnAt,
  returnDateTime: returnAt,
  bookingType: "return",
  vehicleType: "standard",
  status: "confirmed",
  adminStatus: "confirmed",
  actualFare: 120,
  paymentStatus: "pending",
  amountReceivedPence: 0,
  revision: 1,
  source: "office",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
await db.collection("bookings").doc("seed-open-return").set({
  bookingNumber: "SYN-OPEN",
  hirerName: "Synthetic Customer",
  hirerEmail: "synthetic.customer@example.com",
  pickupLocation: "3 Test Street, Oxford OX1 1AC",
  destination: "London Paddington",
  pickupTime: later,
  dateTime: later,
  bookingType: "return",
  returnTrip: true,
  vehicleType: "standard",
  status: "confirmed",
  adminStatus: "confirmed",
  actualFare: 90,
  paymentStatus: "pending",
  revision: 1,
  source: "office",
  createdAt: admin.firestore.FieldValue.serverTimestamp(),
});
await db.collection("customers").doc("review-welcome").set({
  email: "review.welcome@example.com",
  firstName: "Review",
  lastName: "Welcome",
  welcomeEmailStatus: "needs_review",
  welcomeEmailReviewReason: "A previous attempt is still marked sending. Check the inbox before sending another copy.",
  welcomeEmailAttempts: 1,
});
await db.collection("customers").doc("review-send").set({
  email: "send.once.welcome@example.com",
  firstName: "Send",
  lastName: "Once",
  welcomeEmailStatus: "needs_review",
  welcomeEmailReviewReason: "The previous copy was rejected. Check the inbox before sending another copy.",
  welcomeEmailAttempts: 1,
});
await db.collection("customers").doc("review-fail").set({
  email: "reject.welcome@example.com",
  firstName: "Reject",
  lastName: "Welcome",
  welcomeEmailStatus: "needs_review",
  welcomeEmailReviewReason: "The previous copy was rejected. Check the inbox before sending another copy.",
  welcomeEmailAttempts: 1,
});
await db.collection("customers").doc(customerId).set({
  email: "synthetic.customer@example.com",
  firstName: "Synthetic",
  lastName: "Customer",
  welcomeEmailStatus: "sent",
}, { merge: true });

console.log(JSON.stringify({ project, staffId, customerId, seeded: ["seed-pay-later", "seed-return", "seed-open-return", "review-welcome", "review-send", "review-fail"] }));
process.exit(0);
