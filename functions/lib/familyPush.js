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
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.scheduledFamilyJobPush = exports.onFamilyJobPush = exports.saveFamilyPushSubscription = exports.familyPushPublicKey = void 0;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const web_push_1 = __importDefault(require("web-push"));
const familyJobsAuthLogic_1 = require("./familyJobsAuthLogic");
const familyPushLogic_1 = require("./familyPushLogic");
const PUSH_SECRETS = ["FAMILY_PUSH_PUBLIC_KEY", "FAMILY_PUSH_PRIVATE_KEY"];
const PUSH_SUBJECT = "mailto:bookings@spires-taxis.com";
function publicPushKey() {
    return String(process.env.FAMILY_PUSH_PUBLIC_KEY || "").trim();
}
function pushKeys() {
    const publicKey = publicPushKey();
    const privateKey = String(process.env.FAMILY_PUSH_PRIVATE_KEY || "").trim();
    if (!publicKey || !privateKey)
        return null;
    return { publicKey, privateKey };
}
async function assertFamilyDevice(context) {
    const uid = context.auth?.uid || "";
    if (!uid || context.auth?.token.familyJobs !== true) {
        throw new functions.https.HttpsError("permission-denied", "Sign in to Family jobs again.");
    }
    const snap = await admin.firestore().collection(familyJobsAuthLogic_1.FAMILY_DEVICES).doc(uid).get();
    const data = snap.data() || {};
    const expires = data.expiresAt?.toMillis?.() || 0;
    if (!snap.exists || data.enabled === false || !expires || expires <= Date.now()) {
        throw new functions.https.HttpsError("permission-denied", "This phone is no longer signed in.");
    }
    return uid;
}
async function deliverFamilyPush(notice) {
    const keys = pushKeys();
    if (!keys) {
        functions.logger.warn("Family push is not configured. No alert was sent.");
        return;
    }
    const sentRef = admin.firestore().collection(familyPushLogic_1.FAMILY_PUSH_SENT).doc(notice.dedupeId);
    if ((await sentRef.get()).exists)
        return;
    web_push_1.default.setVapidDetails(PUSH_SUBJECT, keys.publicKey, keys.privateKey);
    const devices = await admin.firestore().collection(familyJobsAuthLogic_1.FAMILY_DEVICES).where("enabled", "==", true).get();
    const payload = JSON.stringify({
        title: notice.title,
        body: notice.body,
        tag: notice.tag,
        url: notice.url,
    });
    let transient = false;
    const now = Date.now();
    for (const device of devices.docs) {
        const data = device.data();
        const expires = data.expiresAt?.toMillis?.() || 0;
        if (!expires || expires <= now)
            continue;
        const subscription = (0, familyPushLogic_1.familyPushSubscription)(data.pushSubscription);
        if (!subscription)
            continue;
        try {
            await web_push_1.default.sendNotification(subscription, payload);
        }
        catch (error) {
            const status = Number(error.statusCode || 0);
            if ((0, familyPushLogic_1.familyPushGone)(status)) {
                await device.ref.set({ pushSubscription: admin.firestore.FieldValue.delete() }, { merge: true });
            }
            else if (!status || status >= 500) {
                transient = true;
                functions.logger.error("Family push delivery failed", { status });
            }
            else {
                functions.logger.warn("Family push was rejected", { status });
            }
        }
    }
    if (transient)
        throw new Error("Family push delivery needs a retry");
    await sentRef.create({ at: admin.firestore.FieldValue.serverTimestamp(), title: notice.title });
}
exports.familyPushPublicKey = functions
    .runWith({ secrets: ["FAMILY_PUSH_PUBLIC_KEY"] })
    .https.onCall(async (_data, context) => {
    await assertFamilyDevice(context);
    return { publicKey: publicPushKey() };
});
exports.saveFamilyPushSubscription = functions.https.onCall(async (data, context) => {
    const uid = await assertFamilyDevice(context);
    const subscription = data?.subscription == null ? null : (0, familyPushLogic_1.familyPushSubscription)(data.subscription);
    if (data?.subscription != null && !subscription) {
        throw new functions.https.HttpsError("invalid-argument", "That notification subscription is not usable.");
    }
    await admin.firestore().collection(familyJobsAuthLogic_1.FAMILY_DEVICES).doc(uid).set({
        pushSubscription: subscription ? subscription : admin.firestore.FieldValue.delete(),
        pushUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { saved: true };
});
exports.onFamilyJobPush = functions
    .runWith({ secrets: PUSH_SECRETS })
    .firestore.document("bookings/{bookingId}")
    .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() || null : null;
    const after = change.after.exists ? change.after.data() || null : null;
    const notice = (0, familyPushLogic_1.familyJobChangeNotice)(before, after, String(context.params.bookingId || ""), Date.now());
    if (!notice)
        return;
    await deliverFamilyPush(notice);
});
exports.scheduledFamilyJobPush = functions
    .runWith({ timeoutSeconds: 120, secrets: PUSH_SECRETS })
    .pubsub.schedule("every 15 minutes")
    .timeZone("Europe/London")
    .onRun(async () => {
    if (!pushKeys()) {
        functions.logger.warn("Family push is not configured. Due alerts were left unsent.");
        return;
    }
    const db = admin.firestore();
    const now = Date.now();
    const lower = new Date(now + 40 * 60 * 1000).toISOString();
    const upper = new Date(now + 80 * 60 * 1000).toISOString();
    const [byPickup, byDate, byReturn] = await Promise.all([
        db.collection("bookings").where("pickupTime", ">", lower).where("pickupTime", "<", upper).get(),
        db.collection("bookings").where("dateTime", ">", lower).where("dateTime", "<", upper).get(),
        db.collection("bookings").where("returnPickupTime", ">", lower).where("returnPickupTime", "<", upper).get(),
    ]);
    const seen = new Set();
    for (const snap of [...byPickup.docs, ...byDate.docs, ...byReturn.docs]) {
        if (seen.has(snap.id))
            continue;
        seen.add(snap.id);
        for (const notice of (0, familyPushLogic_1.familyJobDueNotices)(snap.data(), snap.id, now)) {
            await deliverFamilyPush(notice);
        }
    }
});
