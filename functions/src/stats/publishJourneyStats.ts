import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { isQuoteAdmin } from "../quotes/quoteWorkflow";
import { JourneyBooking, publicJourneyView, summariseJourneys } from "./journeyStats";

const db = () => admin.firestore();

async function buildSummary() {
  const fields = [
    "status",
    "adminStatus",
    "customerStatus",
    "source",
    "bookingNumber",
    "notes",
    "test",
    "bookingType",
    "returnTrip",
    "pickupTime",
    "dateTime",
    "returnPickupTime",
    "returnDateTime",
    "pickup",
    "pickupLocation",
    "destination",
    "returnPickupLocation",
    "returnDestination",
    "pickupPlace",
    "destinationPlace",
  ];
  const bookings: JourneyBooking[] = [];
  let cursor: FirebaseFirestore.QueryDocumentSnapshot | null = null;
  do {
    let query = db().collection("bookings").select(...fields).limit(400);
    if (cursor) query = query.startAfter(cursor);
    const snap = await query.get();
    snap.docs.forEach((doc) => bookings.push({ id: doc.id, ...(doc.data() as JourneyBooking) }));
    cursor = snap.docs.length === 400 ? snap.docs[snap.docs.length - 1] : null;
  } while (cursor);
  const updatedAt = new Date().toISOString();
  const summary = summariseJourneys(bookings, new Date(), updatedAt);
  await db().collection("publicStats").doc("journeys").set(summary);
  return summary;
}

function requireStatsAdmin(context: functions.https.CallableContext) {
  if (!context.auth) throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
  if (!isQuoteAdmin(String(context.auth.token.email || ""))) {
    throw new functions.https.HttpsError("permission-denied", "Admin access required.");
  }
}

export const getJourneyStats = functions.https.onCall(async (_data, context) => {
  requireStatsAdmin(context);
  const snap = await db().collection("publicStats").doc("journeys").get();
  if (!snap.exists) return { ok: true, ready: false };
  return { ok: true, ready: true, ...(snap.data() || {}) };
});

export const refreshJourneyStats = functions.https.onCall(async (_data, context) => {
  requireStatsAdmin(context);
  const summary = await buildSummary();
  return { ok: true, ...summary };
});

export const publicJourneyStats = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false });
    return;
  }
  const snap = await db().collection("publicStats").doc("journeys").get();
  if (!snap.exists) {
    res.json({ ok: true, show: false });
    return;
  }
  res.json(publicJourneyView(snap.data() as ReturnType<typeof summariseJourneys>));
});

export const scheduledJourneyStats = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 24 hours")
  .timeZone("Europe/London")
  .onRun(async () => {
    await buildSummary();
  });
