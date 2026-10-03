import { createHash, randomInt, timingSafeEqual } from "crypto";
import { bookingHoldsSeat } from "./logic";
import { EventLeg, PassengerBoardStatus, ShareBooking, ShareJourney } from "./types";
import { eventBoardingEnabled, eventDriverManifest, verifyEventLeg } from "./eventJourneys";

export type BoardingDisplayStatus = "WAITING" | "VERIFIED" | "NO_SHOW" | "CANCELLED";

export function hashBoardingCode(journeyId: string, bookingId: string, code: string): string {
  return createHash("sha256").update(`${journeyId}:${bookingId}:${String(code).trim()}`).digest("hex");
}

export function generateBoardingCode(used: Set<string>): string {
  for (let attempt = 0; attempt < 80; attempt += 1) {
    const code = String(randomInt(1000, 10000));
    if (!used.has(code)) return code;
  }
  throw new Error("Could not allocate a boarding code.");
}

export function codeLooksDerivedFromPii(code: string, booking: Pick<ShareBooking, "email" | "mobile" | "name" | "id">): boolean {
  const digits = String(code || "");
  const haystack = `${booking.email || ""}${booking.mobile || ""}${booking.name || ""}${booking.id || ""}`.replace(/\D/g, "");
  return Boolean(digits) && haystack.includes(digits);
}

export function bookingEligibleForBoardingCode(
  journey: Pick<ShareJourney, "status">,
  booking: Pick<ShareBooking, "reservationStatus" | "hostedPaymentStatus" | "paymentStatus">
): boolean {
  if (journey.status !== "CONFIRMED") return false;
  const reservation = booking.reservationStatus || "";
  if (["CANCELLED", "LATE_CANCELLED", "NO_SHOW", "DROP_OFF_DECLINED", "PAYMENT_EXPIRED"].includes(reservation)) {
    return false;
  }
  const paid = reservation === "PAID" || booking.hostedPaymentStatus === "PAID";
  return paid && (bookingHoldsSeat(booking) || reservation === "PAID");
}

export function issueBoardingCodes(
  journey: ShareJourney,
  bookings: ShareBooking[],
  nowIso: string
): ShareBooking[] {
  if (journey.status !== "CONFIRMED") return bookings;
  const used = new Set(
    bookings.map((row) => String(row.boardingCode || "")).filter((code) => /^\d{4}$/.test(code))
  );
  for (const booking of bookings) {
    if (!bookingEligibleForBoardingCode(journey, booking)) continue;
    if (booking.boardingCode && booking.boardingCodeHash) continue;
    const code = generateBoardingCode(used);
    used.add(code);
    booking.boardingCode = code;
    booking.boardingCodeHash = hashBoardingCode(journey.id, booking.id, code);
    booking.boardingCodeCreatedAt = nowIso;
  }
  return bookings;
}

export function verifyBoardingCode(
  journey: ShareJourney,
  booking: ShareBooking,
  code: string,
  actor: string,
  nowIso: string,
  eventLeg: EventLeg = "OUTBOUND"
): { ok: true; alreadyVerified?: boolean } {
  if (journey.status !== "CONFIRMED") {
    throw new Error("Boarding codes are only used on confirmed journeys.");
  }
  if (booking.reservationStatus === "NO_SHOW") {
    throw new Error("This passenger is marked as a no show.");
  }
  if (booking.reservationStatus === "CANCELLED" || booking.reservationStatus === "LATE_CANCELLED") {
    throw new Error("This reservation is no longer active.");
  }
  if (!booking.boardingCodeHash) {
    throw new Error("No boarding code has been issued for this passenger.");
  }
  const entered = String(code || "").trim();
  if (!/^\d{4}$/.test(entered)) {
    throw new Error("Code does not match.");
  }
  const expected = Buffer.from(booking.boardingCodeHash, "hex");
  const actual = Buffer.from(hashBoardingCode(journey.id, booking.id, entered), "hex");
  if (expected.length !== actual.length || !timingSafeEqual(expected, actual)) {
    throw new Error("Code does not match.");
  }
  if (eventBoardingEnabled(journey) && eventLeg === "RETURN") {
    return verifyEventLeg(journey, booking, actor, nowIso, "RETURN");
  }
  if (booking.boardStatus === "BOARDED" && booking.boardingVerifiedAt) {
    return { ok: true, alreadyVerified: true };
  }
  booking.boardStatus = "BOARDED";
  booking.outboundBoardStatus = "BOARDED";
  booking.outboundBoardedAt = nowIso;
  booking.outboundBoardedBy = actor;
  booking.boardingVerifiedAt = nowIso;
  booking.boardingVerifiedBy = actor;
  return { ok: true };
}

export function boardingDisplayStatus(booking: Pick<ShareBooking, "boardStatus" | "reservationStatus">): BoardingDisplayStatus {
  if (booking.reservationStatus === "CANCELLED" || booking.reservationStatus === "LATE_CANCELLED") return "CANCELLED";
  if (booking.boardStatus === "NO_SHOW" || booking.reservationStatus === "NO_SHOW") return "NO_SHOW";
  if (booking.boardStatus === "BOARDED" || booking.boardStatus === "CHECKED_IN") return "VERIFIED";
  return "WAITING";
}

export function boardingProgress(bookings: ShareBooking[]): { verifiedSeats: number; totalSeats: number; remainingSeats: number } {
  const active = bookings.filter((row) => boardingDisplayStatus(row) !== "CANCELLED");
  const totalSeats = active.reduce((sum, row) => sum + (row.passengers || 0), 0);
  const verifiedSeats = active
    .filter((row) => boardingDisplayStatus(row) === "VERIFIED")
    .reduce((sum, row) => sum + (row.passengers || 0), 0);
  return { verifiedSeats, totalSeats, remainingSeats: Math.max(0, totalSeats - verifiedSeats) };
}

export function driverManifestFingerprint(bookings: ShareBooking[]): string {
  return bookings
    .filter((row) => boardingDisplayStatus(row) !== "CANCELLED")
    .map((row) => `${row.id}:${row.passengers}:${row.boardingCode || ""}`)
    .sort()
    .join("|");
}

export function shouldSendDriverManifest(
  journey: Pick<ShareJourney, "status" | "assignedDriverEmail" | "driverManifestSentAt" | "driverManifestFingerprint">,
  bookings: ShareBooking[]
): { send: boolean; updated: boolean } {
  if (journey.status !== "CONFIRMED") return { send: false, updated: false };
  if (!String(journey.assignedDriverEmail || "").trim()) return { send: false, updated: false };
  const fingerprint = driverManifestFingerprint(bookings);
  if (!journey.driverManifestSentAt) return { send: true, updated: false };
  if (journey.driverManifestFingerprint !== fingerprint) return { send: true, updated: true };
  return { send: false, updated: false };
}

export function driverManifestLines(bookings: ShareBooking[], journey?: ShareJourney): string {
  if (journey?.journeyType === "EVENT") return eventDriverManifest(journey, bookings);
  return bookings
    .filter((row) => boardingDisplayStatus(row) !== "CANCELLED")
    .map((row) => `${row.name}\nCode: ${row.boardingCode || "not issued"}\n${row.passengers} passenger${row.passengers === 1 ? "" : "s"}`)
    .join("\n\n");
}

export function publicDtoHasBoardingSecrets(row: Record<string, unknown>): boolean {
  return ["boardingCode", "boardingCodeHash", "boardingVerifiedBy"].some((key) => key in row && row[key] != null && row[key] !== "");
}

export function customerBoardingCodeForView(
  journey: Pick<ShareJourney, "status">,
  booking: Pick<ShareBooking, "boardingCode" | "reservationStatus" | "hostedPaymentStatus" | "paymentStatus">
): string | undefined {
  if (journey.status !== "CONFIRMED") return undefined;
  if (!bookingEligibleForBoardingCode(journey, booking)) return undefined;
  return booking.boardingCode || undefined;
}
