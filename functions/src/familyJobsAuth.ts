import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import {
  FAMILY_DEVICES,
  FAMILY_DEVICE_TTL_MS,
  FAMILY_UNLOCK_ATTEMPTS,
  FAMILY_UNLOCK_MAX_ATTEMPTS,
  FAMILY_UNLOCK_WINDOW_MS,
  attemptDocId,
  clientIpFromRequest,
  familyPinsMatch,
  isPlausibleFamilyPin,
  newFamilyDeviceId,
  normalizeFamilyPin,
} from "./familyJobsAuthLogic";

export {
  FAMILY_DEVICES,
  FAMILY_DEVICE_TTL_MS,
  familyPinsMatch,
  isPlausibleFamilyPin,
  normalizeFamilyPin,
} from "./familyJobsAuthLogic";

export function getConfiguredFamilyPin(): string {
  const fromEnv = (process.env.FAMILY_JOBS_PIN || "").trim();
  if (fromEnv) return fromEnv;
  try {
    const pin = functions.config().family?.pin;
    return typeof pin === "string" ? pin.trim() : "";
  } catch {
    return "";
  }
}

async function assertNotRateLimited(ip: string): Promise<void> {
  const ref = admin.firestore().collection(FAMILY_UNLOCK_ATTEMPTS).doc(attemptDocId(ip));
  const snap = await ref.get();
  const data = snap.data() || {};
  const count = Number(data.count || 0);
  const windowStart = data.windowStart?.toMillis?.() || 0;
  if (windowStart && Date.now() - windowStart < FAMILY_UNLOCK_WINDOW_MS && count >= FAMILY_UNLOCK_MAX_ATTEMPTS) {
    throw new functions.https.HttpsError(
      "resource-exhausted",
      "Too many PIN attempts. Try again in 15 minutes."
    );
  }
}

async function recordUnlockAttempt(ip: string, success: boolean): Promise<void> {
  const ref = admin.firestore().collection(FAMILY_UNLOCK_ATTEMPTS).doc(attemptDocId(ip));
  const now = admin.firestore.Timestamp.now();
  if (success) {
    await ref.delete().catch(() => undefined);
    return;
  }
  await admin.firestore().runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    const data = snap.data() || {};
    const windowStartMs = data.windowStart?.toMillis?.() || 0;
    const fresh = !windowStartMs || Date.now() - windowStartMs >= FAMILY_UNLOCK_WINDOW_MS;
    tx.set(ref, {
      count: fresh ? 1 : Number(data.count || 0) + 1,
      windowStart: fresh ? now : data.windowStart || now,
      updatedAt: now,
    });
  });
}

export const unlockFamilyJobs = functions.https.onCall(async (data, context) => {
  const pin = normalizeFamilyPin(data?.pin);
  const configured = getConfiguredFamilyPin();
  const ip = clientIpFromRequest(context.rawRequest);

  if (!configured) {
    throw new functions.https.HttpsError(
      "failed-precondition",
      "Family jobs PIN is not configured on the server."
    );
  }
  if (!isPlausibleFamilyPin(pin)) {
    throw new functions.https.HttpsError("invalid-argument", "Enter the 4 to 8 digit PIN.");
  }

  await assertNotRateLimited(ip);

  if (!familyPinsMatch(pin, configured)) {
    await recordUnlockAttempt(ip, false);
    throw new functions.https.HttpsError("permission-denied", "That PIN is not correct.");
  }

  await recordUnlockAttempt(ip, true);

  const deviceId = newFamilyDeviceId();
  const expiresAt = admin.firestore.Timestamp.fromMillis(Date.now() + FAMILY_DEVICE_TTL_MS);
  await admin.firestore().collection(FAMILY_DEVICES).doc(deviceId).set({
    enabled: true,
    createdAt: admin.firestore.FieldValue.serverTimestamp(),
    lastSeenAt: admin.firestore.FieldValue.serverTimestamp(),
    expiresAt,
    userAgent: String(data?.userAgent || "").slice(0, 180),
  });

  const token = await admin.auth().createCustomToken(deviceId, { familyJobs: true });
  return { token, deviceId, expiresAt: expiresAt.toDate().toISOString() };
});
