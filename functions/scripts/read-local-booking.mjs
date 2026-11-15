import admin from "firebase-admin";

const project = process.env.GCLOUD_PROJECT || "demo-spires";
if (!String(process.env.FIRESTORE_EMULATOR_HOST || "").startsWith("127.0.0.1")) {
  throw new Error("Refusing to read because Firestore is not the local emulator.");
}
admin.initializeApp({ projectId: project });
const db = admin.firestore();
const number = process.argv[2] || "SPMWHIP1MP30C6087F";

const jobs = await db.collection("emailJobs").get();
for (const doc of jobs.docs) {
  const data = doc.data();
  const html = String(data.html || "");
  const match = html.match(/[?&]t=([^"&\s]+)/);
  console.log(JSON.stringify({
    id: doc.id,
    kind: data.kind,
    status: data.status,
    to: data.to,
    token: match ? decodeURIComponent(match[1]) : null,
  }));
}

const bookings = await db.collection("bookings").where("bookingNumber", "==", number).get();
for (const doc of bookings.docs) {
  const data = doc.data();
  const issued = data.issuedQuote || {};
  console.log(JSON.stringify({
    id: doc.id,
    status: data.status,
    returnStatus: data.returnStatus || null,
    fare: data.actualFare,
    paymentStatus: data.paymentStatus,
    received: data.amountReceivedPence || 0,
    entries: Array.isArray(data.paymentEntries) ? data.paymentEntries.length : 0,
    adminStatus: data.adminStatus || null,
    customerStatus: data.customerStatus || null,
    revision: data.revision,
    entryIds: Array.isArray(data.paymentEntries) ? data.paymentEntries.map((entry) => ({
      id: entry.clientRequestId || null,
      amount: entry.amountPence || entry.amountReceivedPence || null,
    })) : [],
    requirement: issued.paymentRequirement || null,
    requested: issued.amountRequestedPence || null,
    depositRequired: data.depositRequired === true,
    depositAmount: data.depositAmount || null,
  }));
}
process.exit(0);
