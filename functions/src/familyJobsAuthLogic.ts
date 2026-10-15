import * as crypto from "crypto";

export const FAMILY_DEVICES = "familyDevices";
export const FAMILY_UNLOCK_ATTEMPTS = "familyJobsUnlockAttempts";
export const FAMILY_DEVICE_TTL_MS = 90 * 24 * 60 * 60 * 1000;
export const FAMILY_UNLOCK_WINDOW_MS = 15 * 60 * 1000;
export const FAMILY_UNLOCK_MAX_ATTEMPTS = 8;

export function normalizeFamilyPin(input: unknown): string {
  return String(input || "").replace(/\s+/g, "");
}

export function isPlausibleFamilyPin(pin: string): boolean {
  return /^\d{4,8}$/.test(pin);
}

export function familyPinsMatch(provided: string, configured: string): boolean {
  if (!provided || !configured) return false;
  const left = crypto.createHash("sha256").update(provided).digest();
  const right = crypto.createHash("sha256").update(configured).digest();
  return crypto.timingSafeEqual(left, right);
}

export function newFamilyDeviceId(): string {
  return `fam_${crypto.randomBytes(16).toString("hex")}`;
}

export function clientIpFromRequest(rawRequest: {
  ip?: string;
  headers?: Record<string, unknown>;
} | undefined): string {
  const forwarded = rawRequest?.headers?.["x-forwarded-for"];
  const headerValue = Array.isArray(forwarded) ? forwarded[0] : String(forwarded || "");
  const first = headerValue.split(",")[0].trim();
  return first || rawRequest?.ip || "unknown";
}

export function attemptDocId(ip: string): string {
  return crypto.createHash("sha256").update(ip).digest("hex").slice(0, 32);
}
