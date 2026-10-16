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
exports.unlockFamilyJobs = exports.normalizeFamilyPin = exports.isPlausibleFamilyPin = exports.familyPinsMatch = exports.FAMILY_DEVICE_TTL_MS = exports.FAMILY_DEVICES = void 0;
exports.getConfiguredFamilyPin = getConfiguredFamilyPin;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const familyJobsAuthLogic_1 = require("./familyJobsAuthLogic");
var familyJobsAuthLogic_2 = require("./familyJobsAuthLogic");
Object.defineProperty(exports, "FAMILY_DEVICES", { enumerable: true, get: function () { return familyJobsAuthLogic_2.FAMILY_DEVICES; } });
Object.defineProperty(exports, "FAMILY_DEVICE_TTL_MS", { enumerable: true, get: function () { return familyJobsAuthLogic_2.FAMILY_DEVICE_TTL_MS; } });
Object.defineProperty(exports, "familyPinsMatch", { enumerable: true, get: function () { return familyJobsAuthLogic_2.familyPinsMatch; } });
Object.defineProperty(exports, "isPlausibleFamilyPin", { enumerable: true, get: function () { return familyJobsAuthLogic_2.isPlausibleFamilyPin; } });
Object.defineProperty(exports, "normalizeFamilyPin", { enumerable: true, get: function () { return familyJobsAuthLogic_2.normalizeFamilyPin; } });
function getConfiguredFamilyPin() {
    const fromEnv = (process.env.FAMILY_JOBS_PIN || "").trim();
    if (fromEnv)
        return fromEnv;
    try {
        const pin = functions.config().family?.pin;
        return typeof pin === "string" ? pin.trim() : "";
    }
    catch {
        return "";
    }
}
async function assertNotRateLimited(ip) {
    const ref = admin.firestore().collection(familyJobsAuthLogic_1.FAMILY_UNLOCK_ATTEMPTS).doc((0, familyJobsAuthLogic_1.attemptDocId)(ip));
    const snap = await ref.get();
    const data = snap.data() || {};
    const count = Number(data.count || 0);
    const windowStart = data.windowStart?.toMillis?.() || 0;
    if (windowStart && Date.now() - windowStart < familyJobsAuthLogic_1.FAMILY_UNLOCK_WINDOW_MS && count >= familyJobsAuthLogic_1.FAMILY_UNLOCK_MAX_ATTEMPTS) {
        throw new functions.https.HttpsError("resource-exhausted", "Too many PIN attempts. Try again in 15 minutes.");
    }
}
async function recordUnlockAttempt(ip, success) {
    const ref = admin.firestore().collection(familyJobsAuthLogic_1.FAMILY_UNLOCK_ATTEMPTS).doc((0, familyJobsAuthLogic_1.attemptDocId)(ip));
    const now = admin.firestore.Timestamp.now();
    if (success) {
        await ref.delete().catch(() => undefined);
        return;
    }
    await admin.firestore().runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        const data = snap.data() || {};
        const windowStartMs = data.windowStart?.toMillis?.() || 0;
        const fresh = !windowStartMs || Date.now() - windowStartMs >= familyJobsAuthLogic_1.FAMILY_UNLOCK_WINDOW_MS;
        tx.set(ref, {
            count: fresh ? 1 : Number(data.count || 0) + 1,
            windowStart: fresh ? now : data.windowStart || now,
            updatedAt: now,
        });
    });
}
exports.unlockFamilyJobs = functions
    .runWith({ secrets: ["FAMILY_JOBS_PIN"] })
    .https.onCall(async (data, context) => {
    const pin = (0, familyJobsAuthLogic_1.normalizeFamilyPin)(data?.pin);
    const configured = getConfiguredFamilyPin();
    const ip = (0, familyJobsAuthLogic_1.clientIpFromRequest)(context.rawRequest);
    if (!configured) {
        throw new functions.https.HttpsError("failed-precondition", "Family jobs PIN is not configured on the server.");
    }
    if (!(0, familyJobsAuthLogic_1.isPlausibleFamilyPin)(pin)) {
        throw new functions.https.HttpsError("invalid-argument", "Enter the 4 to 8 digit PIN.");
    }
    await assertNotRateLimited(ip);
    if (!(0, familyJobsAuthLogic_1.familyPinsMatch)(pin, configured)) {
        await recordUnlockAttempt(ip, false);
        throw new functions.https.HttpsError("permission-denied", "That PIN is not correct.");
    }
    await recordUnlockAttempt(ip, true);
    const deviceId = (0, familyJobsAuthLogic_1.newFamilyDeviceId)();
    const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + familyJobsAuthLogic_1.FAMILY_DEVICE_TTL_MS);
    await admin.firestore().collection(familyJobsAuthLogic_1.FAMILY_DEVICES).doc(deviceId).set({
        enabled: true,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
        expiresAt,
        userAgent: String(data?.userAgent || "").slice(0, 180),
    });
    const token = await admin.auth().createCustomToken(deviceId, { familyJobs: true });
    return { token, deviceId, expiresAt: expiresAt.toDate().toISOString() };
});
