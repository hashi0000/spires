import * as admin from "firebase-admin";
import * as functions from "firebase-functions/v1";
import {
  extractTripDetailsFromBooking,
  getPickupMs,
  resolveDriver,
  reminderConfigOk,
  sendAdminDriverReminderEmail,
  sendNoDriverAssignedWarning,
  type DriverResolve,
} from "./driverReminderEmail";

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

  logger.info(
    `Driver booking reminders run: day_before=${daySent}, hour_before=${hourSent}, no_driver_warnings=${warningsSent}, skipped_bad_pickup=${skipped}, scanned=${docs.length}`
  );
}
