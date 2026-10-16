import { Booking, Driver } from "../types/types";
import { getBookingPickupDate, isActiveBookingStatus } from "./bookingSchedule";
import { addLocalDays, startOfLocalDay } from "./bookingDateTime";
import { formatVehicleTypeLabel } from "./vehicleTypes";
import { generateSpiresBookingNumber } from "./bookingNumber";

export const FAMILY_JOB_DRAFT_KEY = "spires_family_job_draft";
export const FAMILY_CONFLICT_WINDOW_MS = 90 * 60 * 1000;

export type FamilyJobView = "today" | "tomorrow" | "week" | "calendar";

export type FamilyVehicleRequired = "standard" | "8_seater" | "multiple";

export type FamilyJobDraft = {
  pickupLocation: string;
  destination: string;
  pickupDate: string;
  pickupTime: string;
  hirerName: string;
  hirerPhone: string;
  vehicleType: FamilyVehicleRequired;
  driverId: string;
  actualFare: string;
  paymentStatus: "" | "pending" | "paid" | "partial";
  flightNumber: string;
  notes: string;
};

export const FAMILY_VEHICLE_OPTIONS: { value: FamilyVehicleRequired; label: string }[] = [
  { value: "standard", label: "Standard car" },
  { value: "8_seater", label: "Mercedes Vito" },
  { value: "multiple", label: "Multiple vehicles" },
];

export const emptyFamilyJobDraft = (): FamilyJobDraft => ({
  pickupLocation: "",
  destination: "",
  pickupDate: "",
  pickupTime: "",
  hirerName: "",
  hirerPhone: "",
  vehicleType: "standard",
  driverId: "",
  actualFare: "",
  paymentStatus: "",
  flightNumber: "",
  notes: "",
});

const DRIVER_COLOURS = ["#002147", "#1d4e89", "#0f766e", "#7c3aed", "#9a3412", "#be185d", "#365314"];

export function driverColour(driverId?: string): string {
  if (!driverId) return "#b45309";
  let hash = 0;
  for (let i = 0; i < driverId.length; i += 1) {
    hash = (hash * 31 + driverId.charCodeAt(i)) >>> 0;
  }
  return DRIVER_COLOURS[hash % DRIVER_COLOURS.length];
}

export function isCancelledJob(booking: Booking): boolean {
  return booking.status === "cancelled" || (booking as { customerStatus?: string }).customerStatus === "cancelled";
}

export function isUnassignedJob(booking: Booking): boolean {
  return !String(booking.driverId || "").trim();
}

export function familyVehicleLabel(type?: string | null): string {
  if (type === "8_seater" || type === "8-seater") return "Mercedes Vito";
  if (type === "multiple") return "Multiple vehicles";
  if (type === "standard") return "Standard car";
  return formatVehicleTypeLabel(type);
}

export function whatsappHref(phone: string, message?: string): string {
  const digits = phone.replace(/\D/g, "");
  if (!digits) return "";
  const intl = digits.startsWith("0") ? `44${digits.slice(1)}` : digits;
  const text = message ? `?text=${encodeURIComponent(message)}` : "";
  return `https://wa.me/${intl}${text}`;
}

export function telHref(phone: string): string {
  const digits = phone.replace(/[^\d+]/g, "");
  return digits ? `tel:${digits}` : "";
}

export function validateFamilyJobDraft(draft: FamilyJobDraft): string | null {
  if (!draft.pickupLocation.trim()) return "Enter a pickup location.";
  if (!draft.destination.trim()) return "Enter a drop off location.";
  if (!draft.pickupDate) return "Choose a pickup date.";
  if (!draft.pickupTime) return "Choose a pickup time.";
  if (!draft.hirerName.trim()) return "Enter the customer name.";
  if (!draft.hirerPhone.trim()) return "Enter the customer phone number.";
  if (!FAMILY_VEHICLE_OPTIONS.some((option) => option.value === draft.vehicleType)) {
    return "Choose the vehicle required.";
  }
  return null;
}

export function loadFamilyJobDraft(): FamilyJobDraft {
  try {
    const raw = sessionStorage.getItem(FAMILY_JOB_DRAFT_KEY);
    if (!raw) return emptyFamilyJobDraft();
    return { ...emptyFamilyJobDraft(), ...(JSON.parse(raw) as Partial<FamilyJobDraft>) };
  } catch {
    return emptyFamilyJobDraft();
  }
}

export function saveFamilyJobDraft(draft: FamilyJobDraft): void {
  try {
    sessionStorage.setItem(FAMILY_JOB_DRAFT_KEY, JSON.stringify(draft));
  } catch {
    /* ignore quota */
  }
}

export function clearFamilyJobDraft(): void {
  try {
    sessionStorage.removeItem(FAMILY_JOB_DRAFT_KEY);
  } catch {
    /* ignore */
  }
}

export function bookingInView(booking: Booking, view: FamilyJobView, now: Date, calendarDay?: Date): boolean {
  const pickup = getBookingPickupDate(booking);
  if (!pickup) return false;
  const startToday = startOfLocalDay(now);
  const startTomorrow = addLocalDays(startToday, 1);
  const startWeekEnd = addLocalDays(startToday, 7);
  if (view === "today") return pickup >= startToday && pickup < startTomorrow;
  if (view === "tomorrow") return pickup >= startTomorrow && pickup < addLocalDays(startTomorrow, 1);
  if (view === "week") return pickup >= startToday && pickup < startWeekEnd;
  if (!calendarDay) return true;
  const dayStart = startOfLocalDay(calendarDay);
  return pickup >= dayStart && pickup < addLocalDays(dayStart, 1);
}

export function sortJobsChronologically(bookings: Booking[]): Booking[] {
  return [...bookings].sort((a, b) => {
    const aTime = getBookingPickupDate(a)?.getTime() ?? 0;
    const bTime = getBookingPickupDate(b)?.getTime() ?? 0;
    return aTime - bTime;
  });
}

export type JobConflict = {
  bookingId: string;
  otherId: string;
  reason: "driver" | "vehicle";
};

export function findJobConflicts(bookings: Booking[]): JobConflict[] {
  const active = bookings.filter((row) => row.id && isActiveBookingStatus(row.status) && !isCancelledJob(row));
  const conflicts: JobConflict[] = [];
  for (let i = 0; i < active.length; i += 1) {
    const left = active[i];
    const leftPickup = getBookingPickupDate(left);
    if (!leftPickup || !left.id) continue;
    for (let j = i + 1; j < active.length; j += 1) {
      const right = active[j];
      const rightPickup = getBookingPickupDate(right);
      if (!rightPickup || !right.id) continue;
      const gap = Math.abs(leftPickup.getTime() - rightPickup.getTime());
      if (gap > FAMILY_CONFLICT_WINDOW_MS) continue;
      if (left.driverId && right.driverId && left.driverId === right.driverId) {
        conflicts.push({ bookingId: left.id, otherId: right.id, reason: "driver" });
      }
      if (left.vehicleId && right.vehicleId && left.vehicleId === right.vehicleId) {
        conflicts.push({ bookingId: left.id, otherId: right.id, reason: "vehicle" });
      } else {
        const leftVehicle = String(left.vehicleType || "").replace("-", "_");
        const rightVehicle = String(right.vehicleType || "").replace("-", "_");
        if (
          leftVehicle &&
          leftVehicle === rightVehicle &&
          (leftVehicle === "8_seater" || leftVehicle === "multiple")
        ) {
          conflicts.push({ bookingId: left.id, otherId: right.id, reason: "vehicle" });
        }
      }
    }
  }
  return conflicts;
}

export function conflictsFor(bookingId: string, conflicts: JobConflict[]): JobConflict[] {
  return conflicts.filter((row) => row.bookingId === bookingId || row.otherId === bookingId);
}

export function matchesJobSearch(booking: Booking, query: string): boolean {
  const needle = query.trim().toLowerCase();
  if (!needle) return true;
  const haystack = [
    booking.hirerName,
    booking.hirerPhone,
    booking.pickupLocation,
    booking.destination,
    booking.bookingNumber,
    booking.flightNumber,
    booking.notes,
  ]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
  return haystack.includes(needle);
}

export function filterFamilyJobs(
  bookings: Booking[],
  filters: {
    view: FamilyJobView;
    now: Date;
    calendarDay?: Date;
    driverId?: string;
    vehicleType?: string;
    query?: string;
    includeCancelled?: boolean;
  }
): Booking[] {
  return sortJobsChronologically(
    bookings.filter((booking) => {
      if (!filters.includeCancelled && isCancelledJob(booking)) return false;
      if (!bookingInView(booking, filters.view, filters.now, filters.calendarDay)) return false;
      if (filters.driverId === "unassigned" && !isUnassignedJob(booking)) return false;
      if (filters.driverId && filters.driverId !== "unassigned" && booking.driverId !== filters.driverId) {
        return false;
      }
      if (filters.vehicleType && booking.vehicleType !== filters.vehicleType) return false;
      if (!matchesJobSearch(booking, filters.query || "")) return false;
      return true;
    })
  );
}

export type FamilyActor = { uid: string; email: string };

export function buildFamilyCreatePayload(
  draft: FamilyJobDraft,
  pickupIso: string,
  actor: FamilyActor
): Record<string, unknown> {
  const bookingNumber = generateSpiresBookingNumber();
  const driverId = draft.driverId.trim();
  const fare = Number(draft.actualFare);
  return {
    bookingNumber,
    dateTime: pickupIso,
    pickupTime: pickupIso,
    pickupLocation: draft.pickupLocation.trim(),
    destination: draft.destination.trim(),
    hirerName: draft.hirerName.trim(),
    hirerPhone: draft.hirerPhone.trim(),
    hirerAddress: "",
    bookingMethod: "telephone",
    bookingType: "one_way",
    vehicleType: draft.vehicleType,
    status: driverId ? "allocated" : "confirmed",
    paymentStatus: draft.paymentStatus || "pending",
    flightNumber: draft.flightNumber.trim(),
    notes: draft.notes.trim(),
    source: "family",
    createdByEmail: actor.email,
    createdByUid: actor.uid,
    updatedByEmail: actor.email,
    updatedByUid: actor.uid,
    ...(driverId ? { driverId, allocatedTime: new Date().toISOString() } : {}),
    ...(Number.isFinite(fare) && draft.actualFare.trim() ? { actualFare: fare } : {}),
  };
}

export function buildFamilyUpdatePayload(
  existing: Booking,
  draft: FamilyJobDraft,
  pickupIso: string,
  actor: FamilyActor
): Record<string, unknown> {
  const driverId = draft.driverId.trim();
  const fare = Number(draft.actualFare);
  let nextStatus: Booking["status"] = "confirmed";
  if (existing.status === "cancelled") nextStatus = "cancelled";
  else if (existing.status === "completed") nextStatus = "completed";
  else if (existing.status === "pending" && !driverId) nextStatus = "pending";
  else if (driverId) nextStatus = "allocated";
  return {
    pickupTime: pickupIso,
    dateTime: pickupIso,
    pickupLocation: draft.pickupLocation.trim(),
    destination: draft.destination.trim(),
    hirerName: draft.hirerName.trim(),
    hirerPhone: draft.hirerPhone.trim(),
    vehicleType: draft.vehicleType,
    status: nextStatus,
    paymentStatus: draft.paymentStatus || existing.paymentStatus || "pending",
    flightNumber: draft.flightNumber.trim(),
    notes: draft.notes.trim(),
    updatedByEmail: actor.email,
    updatedByUid: actor.uid,
    ...(driverId ? { driverId } : { driverId: "" }),
    ...(Number.isFinite(fare) && draft.actualFare.trim() ? { actualFare: fare } : {}),
  };
}

export function buildFamilyCancelPayload(existing: Booking, actor: FamilyActor): Record<string, unknown> {
  const payload: Record<string, unknown> = {
    status: "cancelled",
    cancelledAt: new Date().toISOString(),
    cancelledByEmail: actor.email,
    cancelledByUid: actor.uid,
    updatedByEmail: actor.email,
    updatedByUid: actor.uid,
  };
  if (existing.uid) payload.customerStatus = "cancelled";
  return payload;
}

export function draftFromBooking(booking: Booking): FamilyJobDraft {
  const pickup = getBookingPickupDate(booking);
  const pad = (n: number) => String(n).padStart(2, "0");
  const pickupDate = pickup
    ? `${pickup.getFullYear()}-${pad(pickup.getMonth() + 1)}-${pad(pickup.getDate())}`
    : "";
  const pickupTime = pickup ? `${pad(pickup.getHours())}:${pad(pickup.getMinutes())}` : "";
  const vehicleType: FamilyVehicleRequired =
    booking.vehicleType === "8_seater" || booking.vehicleType === "8-seater"
      ? "8_seater"
      : booking.vehicleType === "multiple"
        ? "multiple"
        : "standard";
  return {
    pickupLocation: booking.pickupLocation || "",
    destination: booking.destination || "",
    pickupDate,
    pickupTime,
    hirerName: booking.hirerName || "",
    hirerPhone: booking.hirerPhone || "",
    vehicleType,
    driverId: booking.driverId || "",
    actualFare: booking.actualFare != null ? String(booking.actualFare) : "",
    paymentStatus: (booking.paymentStatus as FamilyJobDraft["paymentStatus"]) || "",
    flightNumber: booking.flightNumber || "",
    notes: booking.notes || "",
  };
}

export function driverName(drivers: Driver[], driverId?: string): string {
  if (!driverId) return "Unassigned";
  return drivers.find((row) => row.id === driverId)?.name || "Unassigned";
}
