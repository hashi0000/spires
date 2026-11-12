export type ReturnReminderTarget = {
  status: "needs_review" | "active";
  pickupMs: number;
  driverId: string;
  pickup: string;
  dropoff: string;
};

function text(value: unknown): string {
  return String(value || "").trim();
}

function millis(value: unknown): number | null {
  if (value == null || value === "") return null;
  if (typeof value === "object" && value !== null && "toDate" in value && typeof (value as { toDate: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return Number.isNaN(date.getTime()) ? null : date.getTime();
  }
  const date = new Date(value as string | number | Date);
  return Number.isNaN(date.getTime()) ? null : date.getTime();
}

function storedStatus(value: unknown): string {
  if (value === "paid") return "completed";
  return text(value);
}

export function hasTimedReturn(data: Record<string, unknown>): boolean {
  const timed = Boolean(text(data.returnPickupTime) || text(data.returnDateTime));
  if (!timed) return false;
  if (data.openReturn === true && !text(data.returnPickupTime) && !text(data.returnDateTime)) return false;
  if (data.bookingType === "return" || data.returnTrip === true) return true;
  return Boolean(text(data.returnPickupLocation) || text(data.returnDestination));
}

/** Which return, if any, can send a reminder. This does not change the booking. */
export function returnReminderTarget(data: Record<string, unknown>): ReturnReminderTarget | null {
  if (!hasTimedReturn(data)) return null;
  const pickupMs = millis(data.returnPickupTime) || millis(data.returnDateTime);
  if (pickupMs == null) return null;
  const explicit = storedStatus(data.returnStatus);
  const overall = storedStatus(data.status) || storedStatus(data.adminStatus);
  if (explicit === "completed" || explicit === "cancelled") return null;
  if (!explicit && overall === "cancelled") return null;
  const needsReview = explicit === "needs_review" || (!explicit && (overall === "completed" || overall === "paid"));
  const pickup = text(data.returnPickupLocation) || text(data.destination) || "—";
  const dropoff = text(data.returnDestination) || text(data.pickupLocation) || text(data.pickup) || "—";
  if (needsReview) {
    return { status: "needs_review", pickupMs, driverId: "", pickup, dropoff };
  }
  return {
    status: "active",
    pickupMs,
    driverId: text(data.returnDriverId) || text(data.driverId),
    pickup,
    dropoff,
  };
}
