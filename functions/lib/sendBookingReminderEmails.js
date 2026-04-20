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
exports.processBookingReminders = processBookingReminders;
const admin = __importStar(require("firebase-admin"));
const driverReminderEmail_1 = require("./driverReminderEmail");
const ACTIVE_STATUSES = new Set(["pending", "confirmed", "allocated"]);
const DAY_MS = 24 * 60 * 60 * 1000;
const HOUR_MS = 60 * 60 * 1000;
/** ±45m around T−24h so a job every 15m still hits once */
const DAY_WINDOW_HALF_MS = 45 * 60 * 1000;
/** ±15m around T−1h */
const HOUR_WINDOW_HALF_MS = 15 * 60 * 1000;
function reminderFlagExists(v) {
    if (v == null)
        return false;
    if (typeof v === "string")
        return v.length > 0;
    return true;
}
/**
 * Admin driver trip reminders (T−24h / T−1h) with WhatsApp + call links.
 * Deduped with `reminderEmails.driverDayBeforeSentAt` / `reminderEmails.driverHourBeforeSentAt`.
 * Missing driver / phone: one-time admin warning via `reminderEmails.adminNoDriverWarningSentAt`.
 */
async function processBookingReminders(logger) {
    if (!(0, driverReminderEmail_1.reminderConfigOk)()) {
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
    const seen = new Set();
    const docs = [];
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
    const driverCache = new Map();
    let daySent = 0;
    let hourSent = 0;
    let warningsSent = 0;
    let skipped = 0;
    for (const doc of docs) {
        const data = doc.data();
        const status = data.status;
        if (!status || !ACTIVE_STATUSES.has(status))
            continue;
        const pickupMs = (0, driverReminderEmail_1.getPickupMs)(data);
        if (pickupMs == null) {
            skipped++;
            continue;
        }
        const msUntil = pickupMs - now;
        if (msUntil <= 0)
            continue;
        const trip = (0, driverReminderEmail_1.extractTripDetailsFromBooking)(data, pickupMs);
        if (!trip) {
            skipped++;
            continue;
        }
        const re = (data.reminderEmails || {});
        const driverId = data.driverId?.trim();
        const maybeSendNoDriverWarning = async (headline) => {
            if (reminderFlagExists(re.adminNoDriverWarningSentAt))
                return;
            await (0, driverReminderEmail_1.sendNoDriverAssignedWarning)({
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
            }
            catch (err) {
                logger.error(`Failed no-driver warning for ${doc.id}`, err);
            }
            continue;
        }
        const resolved = await (0, driverReminderEmail_1.resolveDriver)(db, driverCache, driverId);
        if (resolved.status === "not_found") {
            try {
                await maybeSendNoDriverWarning("Assigned driver was not found in the database:");
            }
            catch (err) {
                logger.error(`Failed no-driver warning (not found) for ${doc.id}`, err);
            }
            continue;
        }
        if (resolved.status === "no_phone") {
            try {
                await maybeSendNoDriverWarning(`Assigned driver (${resolved.name}) has no phone number on file:`);
            }
            catch (err) {
                logger.error(`Failed no-driver warning (no phone) for ${doc.id}`, err);
            }
            continue;
        }
        const driver = resolved.driver;
        const dayLow = DAY_MS - DAY_WINDOW_HALF_MS;
        const dayHigh = DAY_MS + DAY_WINDOW_HALF_MS;
        const inDayWindow = msUntil >= dayLow && msUntil <= dayHigh;
        const inHourWindow = msUntil >= HOUR_MS - HOUR_WINDOW_HALF_MS && msUntil <= HOUR_MS + HOUR_WINDOW_HALF_MS;
        if (inDayWindow && !reminderFlagExists(re.driverDayBeforeSentAt)) {
            try {
                await (0, driverReminderEmail_1.sendAdminDriverReminderEmail)(driver, trip);
                await doc.ref.update({
                    "reminderEmails.driverDayBeforeSentAt": new Date().toISOString(),
                });
                daySent++;
                logger.info(`Admin driver reminder (24h) sent for ${data.bookingNumber || doc.id}`);
            }
            catch (err) {
                logger.error(`Failed 24h driver reminder for ${doc.id}`, err);
            }
            continue;
        }
        if (inHourWindow && !reminderFlagExists(re.driverHourBeforeSentAt)) {
            try {
                await (0, driverReminderEmail_1.sendAdminDriverReminderEmail)(driver, trip);
                await doc.ref.update({
                    "reminderEmails.driverHourBeforeSentAt": new Date().toISOString(),
                });
                hourSent++;
                logger.info(`Admin driver reminder (1h) sent for ${data.bookingNumber || doc.id}`);
            }
            catch (err) {
                logger.error(`Failed 1h driver reminder for ${doc.id}`, err);
            }
        }
    }
    logger.info(`Driver booking reminders run: day_before=${daySent}, hour_before=${hourSent}, no_driver_warnings=${warningsSent}, skipped_bad_pickup=${skipped}, scanned=${docs.length}`);
}
