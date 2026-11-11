import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { isQuoteAdmin } from "../quotes/quoteWorkflow";
import { defaultMapMonth, draftJourneyMap, lookupOutcodePoints, materialiseJourneyMap, outcodesIn, publicJourneyMapView } from "./journeyMap";
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
    "syntheticMeasurementTest",
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
  try {
    const drafts = draftJourneyMap(bookings);
    const points = await lookupOutcodePoints(outcodesIn(drafts));
    const map = materialiseJourneyMap(drafts, points);
    const index = {
      updatedAt,
      latest: map.latest,
      months: map.months.map((month) => ({
        key: month.key,
        label: month.label,
        completedJourneys: month.completedJourneys,
        mappedJourneys: month.mappedJourneys,
        destinations: month.destinations,
        airports: month.airports,
      })),
    };
    const root = db().collection("publicStats").doc("journeyMap");
    await root.set(index);
    const existing = await root.collection("months").get();
    const keep = new Set(map.months.map((month) => month.key));
    await Promise.all(existing.docs.filter((doc) => !keep.has(doc.id)).map((doc) => doc.ref.delete()));
    await Promise.all(map.months.map((month) => root.collection("months").doc(month.key).set({
      completedJourneys: month.completedJourneys,
      mappedJourneys: month.mappedJourneys,
      destinations: month.destinations,
      airports: month.airports,
      routes: month.routes,
    })));
  } catch (error) {
    console.error("Journey map aggregation failed", error instanceof Error ? error.message : "unknown");
  }
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

export const publicJourneyMap = functions.https.onRequest(async (req, res) => {
  res.set("Access-Control-Allow-Origin", "*");
  res.set("Access-Control-Allow-Methods", "GET, OPTIONS");
  res.set("Cache-Control", "public, max-age=300");
  if (req.method === "OPTIONS") {
    res.status(204).send("");
    return;
  }
  if (req.method !== "GET") {
    res.status(405).json({ ok: false });
    return;
  }
  const requested = String(req.query.month || "");
  if (requested && !/^\d{4}-(0[1-9]|1[0-2])$/.test(requested)) {
    res.status(400).json({ ok: false });
    return;
  }
  const root = db().collection("publicStats").doc("journeyMap");
  const indexSnap = await root.get();
  if (!indexSnap.exists) {
    res.json({ ok: true, show: false });
    return;
  }
  const index = indexSnap.data() || {};
  const latest = typeof index.latest === "string" ? index.latest : null;
  const monthKeys = Array.isArray(index.months) ? index.months.map((month: { key?: string }) => String(month.key || "")) : [];
  const selected = requested || defaultMapMonth(monthKeys, new Date()) || latest;
  if (!selected) {
    res.json({ ok: true, show: false });
    return;
  }
  const monthSnap = await root.collection("months").doc(selected).get();
  const month = monthSnap.exists ? monthSnap.data() || null : null;
  res.json(publicJourneyMapView(
    {
      latest,
      updatedAt: String(index.updatedAt || ""),
      months: Array.isArray(index.months) ? index.months : [],
    },
    month && Array.isArray(month.routes) ? {
      key: selected,
      label: "",
      completedJourneys: Number(month.completedJourneys) || 0,
      mappedJourneys: Number(month.mappedJourneys) || 0,
      destinations: Array.isArray(month.destinations) ? month.destinations : [],
      airports: Array.isArray(month.airports) ? month.airports : [],
      routes: month.routes,
    } : null,
    selected
  ));
});

export const scheduledJourneyStats = functions
  .runWith({ timeoutSeconds: 300, memory: "512MB" })
  .pubsub.schedule("every 24 hours")
  .timeZone("Europe/London")
  .onRun(async () => {
    await buildSummary();
  });
