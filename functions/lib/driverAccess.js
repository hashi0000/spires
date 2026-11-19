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
exports.unlockDriverJobs = exports.manageDriverAccess = void 0;
exports.requireDriver = requireDriver;
const admin = __importStar(require("firebase-admin"));
const functions = __importStar(require("firebase-functions/v1"));
const crypto_1 = require("crypto");
const quoteWorkflow_1 = require("./quotes/quoteWorkflow");
const hash = (value) => (0, crypto_1.createHash)("sha256").update(value).digest("hex");
const fail = (code, message) => { throw new functions.https.HttpsError(code, message); };
const id = (value) => {
    const result = String(value || "");
    if (!result || result.length > 128 || result.includes("/"))
        fail("invalid-argument", "A valid driver id is required.");
    return result;
};
/** Four digit codes establish a Firebase session; never use the code to read bookings. */
exports.manageDriverAccess = functions.https.onCall(async (data, context) => {
    if (!context.auth)
        fail("unauthenticated", "Sign in required.");
    if (!(0, quoteWorkflow_1.isQuoteAdmin)(context.auth.token.email))
        fail("permission-denied", "Office access required.");
    const driverId = id(data?.driverId);
    if (data?.action !== "reset" && data?.action !== "revoke")
        fail("invalid-argument", "Choose reset or revoke.");
    const db = admin.firestore();
    const access = db.collection("driverAccess").doc(driverId);
    // Prefer unique six digit enrolment codes; fall back across candidates if a hash collides.
    const candidates = Array.from({ length: 40 }, () => String((0, crypto_1.randomInt)(0, 1000000)).padStart(6, "0"));
    return db.runTransaction(async (tx) => {
        const driver = await tx.get(db.collection("drivers").doc(driverId));
        if (!driver.exists)
            fail("not-found", "Driver not found.");
        if (data.action === "reset" && driver.data()?.active === false)
            fail("failed-precondition", "Activate this driver first.");
        const previous = await tx.get(access);
        const old = previous.data() || {};
        const codes = await Promise.all(candidates.map(code => tx.get(db.collection("driverCodes").doc(hash(code)))));
        const index = codes.findIndex(snap => !snap.exists);
        if (data.action === "reset" && index < 0)
            fail("resource-exhausted", "Could not allocate a code. Try again.");
        const generation = (0, crypto_1.randomBytes)(16).toString("hex");
        if (old.codeHash)
            tx.set(db.collection("driverCodes").doc(old.codeHash), { revoked: true }, { merge: true });
        const code = data.action === "reset" ? candidates[index] : null;
        if (code)
            tx.create(db.collection("driverCodes").doc(hash(code)), { driverId, generation, consumed: false, revoked: false, expiresAtMs: Date.now() + 24 * 60 * 60 * 1000 });
        tx.set(access, { enabled: Boolean(code), generation, codeHash: code ? hash(code) : null,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: context.auth.uid });
        tx.create(db.collection("driverAccessAudit").doc(), { driverId, action: data.action,
            actorUid: context.auth.uid, at: admin.firestore.FieldValue.serverTimestamp() });
        return { code, driverId, message: code ? "Save this one use six digit code now and activate it within 24 hours. The device then stays signed in. Previous sessions are revoked." : "Access and previous sessions revoked." };
    });
});
exports.unlockDriverJobs = functions.https.onCall(async (data, context) => {
    const code = String(data?.pin || "").trim();
    // Accept legacy four digit codes still in flight and new six digit codes.
    if (!/^\d{4}$/.test(code) && !/^\d{6}$/.test(code))
        fail("invalid-argument", "Enter your driver access code.");
    const db = admin.firestore();
    const ip = context.rawRequest.ip || "unknown";
    const attempts = db.collection("driverUnlockAttempts").doc(hash(ip));
    // Reserve the attempt atomically before checking the code, including successful attempts.
    await db.runTransaction(async (tx) => {
        const snap = await tx.get(attempts);
        const previous = snap.data() || {};
        const now = Date.now();
        const fresh = now - Number(previous.windowStart || 0) >= 15 * 60000;
        const count = fresh ? 0 : Number(previous.count || 0);
        if (count >= 8)
            fail("resource-exhausted", "Too many attempts. Try again in 15 minutes.");
        tx.set(attempts, { count: count + 1, windowStart: fresh ? now : previous.windowStart });
    });
    const codeRef = db.collection("driverCodes").doc(hash(code));
    const lookup = await codeRef.get();
    const mapping = lookup.data();
    if (!mapping || mapping.consumed || mapping.revoked || Number(mapping.expiresAtMs) < Date.now())
        fail("permission-denied", "That code is not valid. Ask the office for a new access code.");
    const deviceId = `drv_${(0, crypto_1.randomBytes)(16).toString("hex")}`;
    const token = await admin.auth().createCustomToken(deviceId, { driverJobs: true });
    await db.runTransaction(async (tx) => {
        const current = (await tx.get(codeRef)).data();
        if (!current || current.consumed || current.revoked || Number(current.expiresAtMs) < Date.now())
            fail("permission-denied", "This code has already been used or expired.");
        const access = (await tx.get(db.collection("driverAccess").doc(current.driverId))).data();
        const driver = (await tx.get(db.collection("drivers").doc(current.driverId))).data();
        if (!access?.enabled || access.generation !== current.generation || !driver || driver.active === false)
            fail("permission-denied", "Driver access is unavailable.");
        tx.set(codeRef, { consumed: true }, { merge: true });
        tx.set(db.collection("driverSessions").doc(deviceId), { driverId: current.driverId,
            generation: access.generation, enabled: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
    });
    return { token };
});
async function requireDriver(context) {
    if (!context.auth)
        fail("unauthenticated", "Sign in required.");
    if (context.auth.token.driverJobs !== true)
        fail("permission-denied", "Driver access required.");
    const session = (await admin.firestore().collection("driverSessions").doc(context.auth.uid).get()).data();
    if (!session?.enabled)
        fail("permission-denied", "Sign in again with your driver code.");
    const access = (await admin.firestore().collection("driverAccess").doc(session.driverId).get()).data();
    const driver = (await admin.firestore().collection("drivers").doc(session.driverId).get()).data();
    if (!access?.enabled || access.generation !== session.generation || !driver || driver.active === false)
        fail("permission-denied", "Driver access has been revoked.");
    return session.driverId;
}
