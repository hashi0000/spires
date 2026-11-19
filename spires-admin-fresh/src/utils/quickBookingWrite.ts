import { doc, runTransaction, serverTimestamp, type Firestore, type UpdateData } from "firebase/firestore";
import { httpsCallable, type Functions } from "firebase/functions";
import type { Booking } from "../types/types";
import { completeJourneyLeg, setJourneyLegStatus, type JourneyLegName, type JourneyLegStatus } from "./journeyLegs";

export const BOOKING_CONFLICT_MESSAGE = "This booking was saved in another session. Your edits are still on this screen. Reload the saved booking, then apply your changes again.";
const ALLOCATION_WINDOW_MS = 90 * 60 * 1000;

export function allocationFields(leg: "outbound" | "return" | "booking", driverId: string, vehicleId: string): Record<string, string> {
  const fields: Record<string, string> = {};
  if (leg === "return") {
    fields.returnDriverId = driverId;
    if (vehicleId) fields.returnVehicleId = vehicleId;
  } else {
    fields.driverId = driverId;
    if (vehicleId) fields.vehicleId = vehicleId;
  }
  return fields;
}

function legMoments(booking: Booking): Array<{ driverId: string; vehicleId: string; at: number }> {
  const outbound = new Date(booking.pickupTime || booking.dateTime || "").getTime();
  const points = [{
    driverId: String(booking.driverId || ""),
    vehicleId: String(booking.vehicleId || ""),
    at: outbound,
  }];
  const returnAt = new Date(booking.returnPickupTime || booking.returnDateTime || "").getTime();
  if (booking.returnPickupTime || booking.returnDateTime) {
    points.push({
      driverId: String(booking.returnDriverId || ""),
      vehicleId: String(booking.returnVehicleId || ""),
      at: returnAt,
    });
  }
  return points.filter((point) => Number.isFinite(point.at));
}

export function allocationConflict(
  booking: Booking,
  leg: "outbound" | "return" | "booking",
  driverId: string,
  vehicleId: string,
  others: Booking[]
): string {
  const when = leg === "return" ? booking.returnPickupTime || booking.returnDateTime : booking.pickupTime || booking.dateTime;
  const at = new Date(when || "").getTime();
  if (!Number.isFinite(at)) return "";
  for (const other of others) {
    if (!other.id || other.id === booking.id || other.status === "cancelled" || other.status === "completed") continue;
    for (const point of legMoments(other)) {
      if (Math.abs(point.at - at) > ALLOCATION_WINDOW_MS) continue;
      if (driverId && point.driverId === driverId) return "That driver is already allocated to another journey within 90 minutes.";
      if (vehicleId && point.vehicleId === vehicleId) return "That vehicle is already allocated to another journey within 90 minutes.";
    }
  }
  return "";
}

export async function commitQuickAllocation(
  db: Firestore,
  booking: Booking,
  leg: "outbound" | "return" | "booking",
  driverId: string,
  vehicleId: string,
  others: Booking[] = []
): Promise<void> {
  if (!booking.id) throw new Error("This booking has no id.");
  const conflict = allocationConflict(booking, leg, driverId, vehicleId, others);
  if (conflict) throw new Error(conflict);
  const expected = Number(booking.revision || 0);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "bookings", booking.id as string);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This booking no longer exists.");
    const stored = Number(snap.data()?.revision || 0);
    if (stored !== expected) throw new Error(BOOKING_CONFLICT_MESSAGE);
    const fields = allocationFields(leg, driverId, vehicleId);
    const hasDriver = Boolean(driverId || (leg === "return" ? snap.data()?.driverId : driverId));
    tx.update(ref, {
      ...fields,
      revision: stored + 1,
      ...(hasDriver && snap.data()?.status !== "cancelled" && snap.data()?.status !== "completed"
        ? { status: "allocated", adminStatus: "allocated" }
        : {}),
    });
  });
}

export async function commitQuickPayment(
  functions: Functions,
  booking: Booking,
  amountPounds: string,
  method: string,
  options: { clientRequestId?: string; leg?: "outbound" | "return" | "booking"; note?: string } = {}
): Promise<{ duplicate?: boolean }> {
  if (!booking.id) throw new Error("This booking has no id.");
  const call = httpsCallable(functions, "recordManualPayment");
  const clientRequestId = options.clientRequestId || `quick_${booking.id}_${amountPounds}_${Date.now()}`;
  const result = await call({
    bookingId: booking.id,
    mode: "add",
    amountPounds,
    method,
    expectedRevision: Number(booking.revision || 0),
    clientRequestId,
    leg: options.leg && options.leg !== "booking" ? options.leg : undefined,
    note: options.note || "",
  });
  const data = (result.data || {}) as { duplicate?: boolean };
  return { duplicate: Boolean(data.duplicate) };
}

export async function commitQuickLegStatus(
  db: Firestore,
  booking: Booking,
  leg: JourneyLegName,
  nextStatus: JourneyLegStatus,
  actorUid = ""
): Promise<void> {
  if (!booking.id) throw new Error("This booking has no id.");
  const decision = setJourneyLegStatus(booking, leg, nextStatus);
  if (!decision.ok) throw new Error(decision.error);
  const expected = Number(booking.revision || 0);
  await runTransaction(db, async (tx) => {
    const ref = doc(db, "bookings", booking.id as string);
    const snap = await tx.get(ref);
    if (!snap.exists()) throw new Error("This booking no longer exists.");
    const stored = Number(snap.data()?.revision || 0);
    if (stored !== expected) throw new Error(BOOKING_CONFLICT_MESSAGE);
    const payload: Record<string, unknown> = {
      ...decision.patch,
      revision: stored + 1,
      updatedAt: serverTimestamp(),
    };
    if ("completedAtField" in decision && decision.completedAtField) {
      payload[decision.completedAtField] = new Date().toISOString();
      payload[`${leg}CompletedByUid`] = actorUid;
    }
    tx.update(ref, payload as UpdateData<Record<string, unknown>>);
    tx.set(doc(db, "bookings", booking.id as string, "audit", `status-${leg}-${stored + 1}`), {
      action: nextStatus === "completed" ? "leg_completed" : "leg_status_updated",
      leg,
      nextStatus,
      actorUid,
      at: serverTimestamp(),
      previousStatus: decision.previousStatus,
      bookingStatus: decision.nextStatus,
    });
  });
}

export async function commitQuickLegComplete(
  db: Firestore,
  booking: Booking,
  leg: JourneyLegName,
  actorUid = ""
): Promise<void> {
  const decision = completeJourneyLeg(booking, leg);
  if (!decision.ok) throw new Error(decision.error);
  await commitQuickLegStatus(db, booking, leg, "completed", actorUid);
}
