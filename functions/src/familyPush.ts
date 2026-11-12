import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import webpush from "web-push";
import { FAMILY_DEVICES } from "./familyJobsAuthLogic";
import {
  FAMILY_PUSH_SENT,
  FamilyPushNotice,
  familyJobChangeNotice,
  familyJobDueNotices,
  familyPushGone,
  familyPushSubscription,
} from "./familyPushLogic";

const PUSH_SECRETS = ["FAMILY_PUSH_PUBLIC_KEY", "FAMILY_PUSH_PRIVATE_KEY"];
const PUSH_SUBJECT = "mailto:bookings@spires-taxis.com";

function publicPushKey(): string {
  return String(process.env.FAMILY_PUSH_PUBLIC_KEY || "").trim();
}

function pushKeys(): { publicKey: string; privateKey: string } | null {
  const publicKey = publicPushKey();
  const privateKey = String(process.env.FAMILY_PUSH_PRIVATE_KEY || "").trim();
  if (!publicKey || !privateKey) return null;
  return { publicKey, privateKey };
}

async function assertFamilyDevice(context: functions.https.CallableContext): Promise<string> {
  const uid = context.auth?.uid || "";
  if (!uid || context.auth?.token.familyJobs !== true) {
    throw new functions.https.HttpsError("permission-denied", "Sign in to Family jobs again.");
  }
  const snap = await admin.firestore().collection(FAMILY_DEVICES).doc(uid).get();
  const data = snap.data() || {};
  const expires = data.expiresAt?.toMillis?.() || 0;
  if (!snap.exists || data.enabled === false || !expires || expires <= Date.now()) {
    throw new functions.https.HttpsError("permission-denied", "This phone is no longer signed in.");
  }
  return uid;
}

async function deliverFamilyPush(notice: FamilyPushNotice): Promise<void> {
  const keys = pushKeys();
  if (!keys) {
    functions.logger.warn("Family push is not configured. No alert was sent.");
    return;
  }
  const sentRef = admin.firestore().collection(FAMILY_PUSH_SENT).doc(notice.dedupeId);
  if ((await sentRef.get()).exists) return;

  webpush.setVapidDetails(PUSH_SUBJECT, keys.publicKey, keys.privateKey);
  const devices = await admin.firestore().collection(FAMILY_DEVICES).where("enabled", "==", true).get();
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
    if (!expires || expires <= now) continue;
    const subscription = familyPushSubscription(data.pushSubscription);
    if (!subscription) continue;
    try {
      await webpush.sendNotification(subscription, payload);
    } catch (error) {
      const status = Number((error as { statusCode?: number }).statusCode || 0);
      if (familyPushGone(status)) {
        await device.ref.set({ pushSubscription: admin.firestore.FieldValue.delete() }, { merge: true });
      } else if (!status || status >= 500) {
        transient = true;
        functions.logger.error("Family push delivery failed", { status });
      } else {
        functions.logger.warn("Family push was rejected", { status });
      }
    }
  }
  if (transient) throw new Error("Family push delivery needs a retry");
  await sentRef.create({ at: admin.firestore.FieldValue.serverTimestamp(), title: notice.title });
}

export const familyPushPublicKey = functions
  .runWith({ secrets: ["FAMILY_PUSH_PUBLIC_KEY"] })
  .https.onCall(async (_data, context) => {
    await assertFamilyDevice(context);
    return { publicKey: publicPushKey() };
  });

export const saveFamilyPushSubscription = functions.https.onCall(async (data, context) => {
    const uid = await assertFamilyDevice(context);
    const subscription = data?.subscription == null ? null : familyPushSubscription(data.subscription);
    if (data?.subscription != null && !subscription) {
      throw new functions.https.HttpsError("invalid-argument", "That notification subscription is not usable.");
    }
    await admin.firestore().collection(FAMILY_DEVICES).doc(uid).set({
      pushSubscription: subscription ? subscription : admin.firestore.FieldValue.delete(),
      pushUpdatedAt: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
    return { saved: true };
  });

export const onFamilyJobPush = functions
  .runWith({ secrets: PUSH_SECRETS })
  .firestore.document("bookings/{bookingId}")
  .onWrite(async (change, context) => {
    const before = change.before.exists ? change.before.data() || null : null;
    const after = change.after.exists ? change.after.data() || null : null;
    const notice = familyJobChangeNotice(before, after, String(context.params.bookingId || ""), Date.now());
    if (!notice) return;
    await deliverFamilyPush(notice);
  });

export const scheduledFamilyJobPush = functions
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
    const seen = new Set<string>();
    for (const snap of [...byPickup.docs, ...byDate.docs, ...byReturn.docs]) {
      if (seen.has(snap.id)) continue;
      seen.add(snap.id);
      for (const notice of familyJobDueNotices(snap.data(), snap.id, now)) {
        await deliverFamilyPush(notice);
      }
    }
  });
