import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import { createHash, randomInt, randomBytes } from "crypto";
import { isQuoteAdmin } from "./quotes/quoteWorkflow";

const hash = (value: string) => createHash("sha256").update(value).digest("hex");
const fail = (code: functions.https.FunctionsErrorCode, message: string): never => { throw new functions.https.HttpsError(code, message); };
const id = (value: unknown) => {
  const result = String(value || "");
  if (!result || result.length > 128 || result.includes("/")) fail("invalid-argument", "A valid driver id is required.");
  return result;
};

/** Four digit codes establish a Firebase session; never use the code to read bookings. */
export const manageDriverAccess = functions.https.onCall(async (data, context) => {
  if (!context.auth) fail("unauthenticated", "Sign in required.");
  if (!isQuoteAdmin(context.auth!.token.email as string)) fail("permission-denied", "Office access required.");
  const driverId = id(data?.driverId);
  if (data?.action !== "reset" && data?.action !== "revoke") fail("invalid-argument", "Choose reset or revoke.");
  const db = admin.firestore();
  const access = db.collection("driverAccess").doc(driverId);
  const candidates = Array.from({ length: 30 }, () => String(randomInt(0, 10000)).padStart(4, "0"));
  return db.runTransaction(async tx => {
    const driver = await tx.get(db.collection("drivers").doc(driverId));
    if (!driver.exists) fail("not-found", "Driver not found.");
    if (data.action === "reset" && driver.data()?.active === false) fail("failed-precondition", "Activate this driver first.");
    const previous = await tx.get(access);
    const old = previous.data() || {};
    const codes = await Promise.all(candidates.map(code => tx.get(db.collection("driverCodes").doc(hash(code)))));
    const index = codes.findIndex(snap => !snap.exists);
    if (data.action === "reset" && index < 0) fail("resource-exhausted", "Could not allocate a code. Try again.");
    const generation = randomBytes(16).toString("hex");
    if (old.codeHash) tx.set(db.collection("driverCodes").doc(old.codeHash), { revoked: true }, { merge: true });
    const code = data.action === "reset" ? candidates[index] : null;
    if (code) tx.create(db.collection("driverCodes").doc(hash(code)), { driverId, generation, consumed: false, revoked: false, expiresAtMs: Date.now() + 24 * 60 * 60 * 1000 });
    tx.set(access, { enabled: Boolean(code), generation, codeHash: code ? hash(code) : null,
      updatedAt: admin.firestore.FieldValue.serverTimestamp(), updatedBy: context.auth!.uid });
    tx.create(db.collection("driverAccessAudit").doc(), { driverId, action: data.action,
      actorUid: context.auth!.uid, at: admin.firestore.FieldValue.serverTimestamp() });
    return { code, driverId, message: code ? "Save this one use code now and activate it within 24 hours. The device then stays signed in. Previous sessions are revoked." : "Access and previous sessions revoked." };
  });
});

export const unlockDriverJobs = functions.https.onCall(async (data, context) => {
  const code = String(data?.pin || "").trim();
  if (!/^\d{4}$/.test(code)) fail("invalid-argument", "Enter your four digit code.");
  const db = admin.firestore();
  const ip = context.rawRequest.ip || "unknown";
  const attempts = db.collection("driverUnlockAttempts").doc(hash(ip));
  // Reserve the attempt atomically before checking the code, including successful attempts.
  await db.runTransaction(async tx => {
    const snap = await tx.get(attempts);
    const previous = snap.data() || {};
    const now = Date.now();
    const fresh = now - Number(previous.windowStart || 0) >= 15 * 60000;
    const count = fresh ? 0 : Number(previous.count || 0);
    if (count >= 8) fail("resource-exhausted", "Too many attempts. Try again in 15 minutes.");
    tx.set(attempts, { count: count + 1, windowStart: fresh ? now : previous.windowStart });
  });
  const codeRef = db.collection("driverCodes").doc(hash(code));
  const lookup = await codeRef.get();
  const mapping = lookup.data();
  if (!mapping || mapping.consumed || mapping.revoked || Number(mapping.expiresAtMs) < Date.now()) fail("permission-denied", "That code is not valid. Ask the office for a new access code.");
  const deviceId = `drv_${randomBytes(16).toString("hex")}`;
  const token = await admin.auth().createCustomToken(deviceId, { driverJobs: true });
  await db.runTransaction(async tx => {
    const current = (await tx.get(codeRef)).data();
    if (!current || current.consumed || current.revoked || Number(current.expiresAtMs) < Date.now()) fail("permission-denied", "This code has already been used or expired.");
    const access = (await tx.get(db.collection("driverAccess").doc(current!.driverId))).data();
    const driver = (await tx.get(db.collection("drivers").doc(current!.driverId))).data();
    if (!access?.enabled || access.generation !== current!.generation || !driver || driver.active === false) fail("permission-denied", "Driver access is unavailable.");
    tx.set(codeRef, { consumed: true }, { merge: true });
    tx.set(db.collection("driverSessions").doc(deviceId), { driverId: current!.driverId,
      generation: access!.generation, enabled: true, createdAt: admin.firestore.FieldValue.serverTimestamp() });
  });
  return { token };
});

export async function requireDriver(context: functions.https.CallableContext): Promise<string> {
  if (!context.auth) fail("unauthenticated", "Sign in required.");
  if (context.auth!.token.driverJobs !== true) fail("permission-denied", "Driver access required.");
  const session = (await admin.firestore().collection("driverSessions").doc(context.auth!.uid).get()).data();
  if (!session?.enabled) fail("permission-denied", "Sign in again with your driver code.");
  const access = (await admin.firestore().collection("driverAccess").doc(session!.driverId).get()).data();
  const driver = (await admin.firestore().collection("drivers").doc(session!.driverId).get()).data();
  if (!access?.enabled || access.generation !== session!.generation || !driver || driver.active === false) fail("permission-denied", "Driver access has been revoked.");
  return session!.driverId;
}
