"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledJourneyStats = exports.publicJourneyStats = exports.refreshJourneyStats = exports.getJourneyStats = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const quoteWorkflow_1 = require("../quotes/quoteWorkflow");
const journeyStats_1 = require("./journeyStats");
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
    const bookings = [];
    let cursor = null;
    do {
        let query = db().collection("bookings").select(...fields).limit(400);
        if (cursor)
            query = query.startAfter(cursor);
        const snap = await query.get();
        snap.docs.forEach((doc) => bookings.push({ id: doc.id, ...doc.data() }));
        cursor = snap.docs.length === 400 ? snap.docs[snap.docs.length - 1] : null;
    } while (cursor);
    const updatedAt = new Date().toISOString();
    const summary = (0, journeyStats_1.summariseJourneys)(bookings, new Date(), updatedAt);
    await db().collection("publicStats").doc("journeys").set(summary);
    return summary;
}
function requireStatsAdmin(context) {
    if (!context.auth)
        throw new functions.https.HttpsError("unauthenticated", "Sign in required.");
    if (!(0, quoteWorkflow_1.isQuoteAdmin)(String(context.auth.token.email || ""))) {
        throw new functions.https.HttpsError("permission-denied", "Admin access required.");
    }
}
exports.getJourneyStats = functions.https.onCall(async (_data, context) => {
    requireStatsAdmin(context);
    const snap = await db().collection("publicStats").doc("journeys").get();
    if (!snap.exists)
        return { ok: true, ready: false };
    return { ok: true, ready: true, ...(snap.data() || {}) };
});
exports.refreshJourneyStats = functions.https.onCall(async (_data, context) => {
    requireStatsAdmin(context);
    const summary = await buildSummary();
    return { ok: true, ...summary };
});
exports.publicJourneyStats = functions.https.onRequest(async (req, res) => {
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
    res.json((0, journeyStats_1.publicJourneyView)(snap.data()));
});
exports.scheduledJourneyStats = functions
    .runWith({ timeoutSeconds: 300, memory: "512MB" })
    .pubsub.schedule("every 24 hours")
    .timeZone("Europe/London")
    .onRun(async () => {
    await buildSummary();
});
