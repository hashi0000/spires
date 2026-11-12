import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import {
  extractTripDetailsFromBooking,
  formatPickupTimeLabel,
  getPickupMs,
  resolveDriver,
  reminderConfigOk,
  sendAdminDriverReminderEmail,
  sendNoDriverAssignedWarning,
  type DriverResolve,
} from "./driverReminderEmail";
import { returnReminderTarget } from "./bookings/journeyLegs";

const ACTIVE_STATUSES = new Set(["pending", "confirmed", "allocated"]);

const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** ±45m around T−24h so a job every 15m still hits once */
const DAY_WINDOW_HALF_MS = 45 * 60 * 1000;
/** ±15m around T−1h */
const HOUR_WINDOW_HALF_MS = 15 * 60 * 1000;

function reminderFlagExists(v: unknown): boolean {
  if (v == null) return false;
  if (typeof v === "string") return v.length > 0;
  return true;
}

/**
 * Admin driver trip reminders (T−24h / T−1h) with WhatsApp + call links.
 * Deduped with `reminderEmails.driverDayBeforeSentAt` / `reminderEmails.driverHourBeforeSentAt`.
 * Missing driver / phone: one-time admin warning via `reminderEmails.adminNoDriverWarningSentAt`.
 */
export async function processBookingReminders(logger: typeof functions.logger): Promise<void> {
  if (!reminderConfigOk()) {
    logger.warn("Skipping booking reminders: functions.config().email.pass is not set");
    return;
  }

  const db = admin.firestore();
  const now = Date.now();

  const lower = new Date(now + 20 * 60 * 1000).toISOString();
  const upper = new Date(now + 50 * 60 * 60 * 1000).toISOString();

  const [byPickup, byDateTime] = await Promise.all([
    db.collection("bookings").where("pickupTime", ">", lower).where("pickupTime", "<", upper).get(),
    db.collection("bookings").where("dateTime", ">", lower).where("dateTime", "<", upper).get(),
  ]);

  const seen = new Set<string>();
  const docs: admin.firestore.QueryDocumentSnapshot[] = [];
  for (const d of byPickup.docs) {
    seen.add(d.id);
    docs.push(d);
  }
  for (const d of byDateTime.docs) {
    if (!seen.has(d.id)) {
      seen.add(d.id);
      docs.push(d);
    }
  }

  const driverCache = new Map<string, DriverResolve>();

  let daySent = 0;
  let hourSent = 0;
  let warningsSent = 0;
  let skipped = 0;

  for (const doc of docs) {
    const data = doc.data();
    const status = data.status as string | undefined;
    if (!status || !ACTIVE_STATUSES.has(status)) continue;

    const pickupMs = getPickupMs(data);
    if (pickupMs == null) {
      skipped++;
      continue;
    }

    const msUntil = pickupMs - now;
    if (msUntil <= 0) continue;

    const trip = extractTripDetailsFromBooking(data, pickupMs);
    if (!trip) {
      skipped++;
      continue;
    }

    const re = (data.reminderEmails || {}) as {
      driverDayBeforeSentAt?: unknown;
      driverHourBeforeSentAt?: unknown;
      adminNoDriverWarningSentAt?: unknown;
    };

    const driverId = (data.driverId as string | undefined)?.trim();

    const maybeSendNoDriverWarning = async (headline: string) => {
      if (reminderFlagExists(re.adminNoDriverWarningSentAt)) return;
      await sendNoDriverAssignedWarning({
        pickupTime: trip.pickupTime,
        pickup: trip.pickup,
        dropoff: trip.dropoff,
        passengerName: trip.passengerName,
        headline,
        stops: trip.stops,
        returnSummary: trip.returnSummary,
      });
      await doc.ref.update({
        "reminderEmails.adminNoDriverWarningSentAt": new Date().toISOString(),
      });
      warningsSent++;
      logger.info(`Admin no-driver warning sent for ${data.bookingNumber || doc.id}`);
    };

    if (!driverId) {
      try {
        await maybeSendNoDriverWarning("Booking has NO DRIVER assigned:");
      } catch (err) {
        logger.error(`Failed no-driver warning for ${doc.id}`, err);
      }
      continue;
    }

    const resolved = await resolveDriver(db, driverCache, driverId);
    if (resolved.status === "not_found") {
      try {
        await maybeSendNoDriverWarning("Assigned driver was not found in the database:");
      } catch (err) {
        logger.error(`Failed no-driver warning (not found) for ${doc.id}`, err);
      }
      continue;
    }
    if (resolved.status === "no_phone") {
      try {
        await maybeSendNoDriverWarning(
          `Assigned driver (${resolved.name}) has no phone number on file:`
        );
      } catch (err) {
        logger.error(`Failed no-driver warning (no phone) for ${doc.id}`, err);
      }
      continue;
    }

    const driver = resolved.driver;

    const dayLow = DAY_MS - DAY_WINDOW_HALF_MS;
    const dayHigh = DAY_MS + DAY_WINDOW_HALF_MS;
    const inDayWindow = msUntil >= dayLow && msUntil <= dayHigh;
    const inHourWindow =
      msUntil >= HOUR_MS - HOUR_WINDOW_HALF_MS && msUntil <= HOUR_MS + HOUR_WINDOW_HALF_MS;

    if (inDayWindow && !reminderFlagExists(re.driverDayBeforeSentAt)) {
      try {
        await sendAdminDriverReminderEmail(driver, trip);
        await doc.ref.update({
          "reminderEmails.driverDayBeforeSentAt": new Date().toISOString(),
        });
        daySent++;
        logger.info(`Admin driver reminder (24h) sent for ${data.bookingNumber || doc.id}`);
      } catch (err) {
        logger.error(`Failed 24h driver reminder for ${doc.id}`, err);
      }
      continue;
    }

    if (inHourWindow && !reminderFlagExists(re.driverHourBeforeSentAt)) {
      try {
        await sendAdminDriverReminderEmail(driver, trip);
        await doc.ref.update({
          "reminderEmails.driverHourBeforeSentAt": new Date().toISOString(),
        });
        hourSent++;
        logger.info(`Admin driver reminder (1h) sent for ${data.bookingNumber || doc.id}`);
      } catch (err) {
        logger.error(`Failed 1h driver reminder for ${doc.id}`, err);
      }
    }
  }

  try {
    const returnResult = await processReturnReminders(db, driverCache, now, lower, upper, logger);
    daySent += returnResult.daySent;
    hourSent += returnResult.hourSent;
    warningsSent += returnResult.warningsSent;
  } catch (err) {
    logger.error("Return reminder query failed", err);
  }

  logger.info(
    `Driver booking reminders run: day_before=${daySent}, hour_before=${hourSent}, no_driver_warnings=${warningsSent}, skipped_bad_pickup=${skipped}, scanned=${docs.length}`
  );
}

async function processReturnReminders(
  db: admin.firestore.Firestore,
  driverCache: Map<string, DriverResolve>,
  now: number,
  lower: string,
  upper: string,
  logger: typeof functions.logger
): Promise<{ daySent: number; hourSent: number; warningsSent: number }> {
  const [byReturn, byReturnDate] = await Promise.all([
    db.collection("bookings").where("returnPickupTime", ">", lower).where("returnPickupTime", "<", upper).get(),
    db.collection("bookings").where("returnDateTime", ">", lower).where("returnDateTime", "<", upper).get(),
  ]);
  const seen = new Set<string>();
  const docs: admin.firestore.QueryDocumentSnapshot[] = [];
  for (const doc of [...byReturn.docs, ...byReturnDate.docs]) {
    if (seen.has(doc.id)) continue;
    seen.add(doc.id);
    docs.push(doc);
  }

  let daySent = 0;
  let hourSent = 0;
  let warningsSent = 0;
  const dayLow = DAY_MS - DAY_WINDOW_HALF_MS;
  const dayHigh = DAY_MS + DAY_WINDOW_HALF_MS;

  for (const doc of docs) {
    const data = doc.data();
    const target = returnReminderTarget(data);
    if (!target) continue;
    const msUntil = target.pickupMs - now;
    if (msUntil <= 0) continue;
    const inDayWindow = msUntil >= dayLow && msUntil <= dayHigh;
    const inHourWindow = msUntil >= HOUR_MS - HOUR_WINDOW_HALF_MS && msUntil <= HOUR_MS + HOUR_WINDOW_HALF_MS;
    if (!inDayWindow && !inHourWindow) continue;

    const re = (data.reminderEmails || {}) as {
      returnDriverDayBeforeSentAt?: unknown;
      returnDriverHourBeforeSentAt?: unknown;
      returnNoDriverWarningSentAt?: unknown;
    };
    const trip = {
      pickupTime: formatPickupTimeLabel(target.pickupMs),
      pickup: target.pickup,
      dropoff: target.dropoff,
      passengerName: String(data.hirerName || data.name || "—"),
      stops: "",
      returnSummary: "Return. The fare is for the whole booking.",
    };

    const warn = async (headline: string) => {
      if (reminderFlagExists(re.returnNoDriverWarningSentAt)) return;
      await sendNoDriverAssignedWarning({
        pickupTime: trip.pickupTime,
        pickup: trip.pickup,
        dropoff: trip.dropoff,
        passengerName: trip.passengerName,
        headline,
        stops: trip.stops,
        returnSummary: trip.returnSummary,
      });
      await doc.ref.update({ "reminderEmails.returnNoDriverWarningSentAt": new Date().toISOString() });
      warningsSent++;
      logger.info(`Return has no confirmed driver for ${data.bookingNumber || doc.id}`);
    };

    if (target.status === "needs_review" || !target.driverId) {
      try {
        await warn(target.status === "needs_review" ? "Return needs review and has no confirmed driver:" : "Return has NO DRIVER assigned:");
      } catch (err) {
        logger.error(`Failed return no-driver warning for ${doc.id}`, err);
      }
      continue;
    }

    const resolved = await resolveDriver(db, driverCache, target.driverId);
    if (resolved.status !== "ok") {
      try {
        await warn("Return driver was not found or has no phone number:");
      } catch (err) {
        logger.error(`Failed return driver warning for ${doc.id}`, err);
      }
      continue;
    }

    if (inDayWindow && !reminderFlagExists(re.returnDriverDayBeforeSentAt)) {
      try {
        await sendAdminDriverReminderEmail(resolved.driver, trip);
        await doc.ref.update({ "reminderEmails.returnDriverDayBeforeSentAt": new Date().toISOString() });
        daySent++;
      } catch (err) {
        logger.error(`Failed return 24h reminder for ${doc.id}`, err);
      }
      continue;
    }
    if (inHourWindow && !reminderFlagExists(re.returnDriverHourBeforeSentAt)) {
      try {
        await sendAdminDriverReminderEmail(resolved.driver, trip);
        await doc.ref.update({ "reminderEmails.returnDriverHourBeforeSentAt": new Date().toISOString() });
        hourSent++;
      } catch (err) {
        logger.error(`Failed return 1h reminder for ${doc.id}`, err);
      }
    }
  }

  return { daySent, hourSent, warningsSent };
}
