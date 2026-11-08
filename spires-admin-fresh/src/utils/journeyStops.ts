export type JourneyStop = {
  id: string;
  type: "pickup" | "dropoff";
  address: string;
  notes?: string;
  place?: Record<string, unknown> | null;
};

export const OPEN_RETURN_NOTICE =
  "For a return pickup in Oxford, please give your driver at least 30 minutes' notice. For pickups outside Oxford, contact us to confirm the notice needed.";

function text(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function newStopId(): string {
  return `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normaliseStops(raw: unknown, pickup = "", destination = ""): JourneyStop[] {
  const fromRaw = Array.isArray(raw)
    ? raw.map((item, index) => {
        const row = item && typeof item === "object" ? (item as Record<string, unknown>) : {};
        const kind = text(row.type);
        return {
          id: text(row.id, 40) || `stop-${index + 1}`,
          type: kind === "dropoff" || kind === "drop_off" ? "dropoff" : "pickup",
          address: text(row.address),
          notes: text(row.notes, 400),
          place: row.place && typeof row.place === "object" ? (row.place as Record<string, unknown>) : null,
        } as JourneyStop;
      })
    : [];
  if (fromRaw.length > 0) return fromRaw;
  return [
    { id: "start", type: "pickup", address: text(pickup), notes: "", place: null },
    { id: "end", type: "dropoff", address: text(destination), notes: "", place: null },
  ];
}

export function validateStops(stops: JourneyStop[]): string | null {
  if (stops.length < 2) return "Add a pickup and a drop off.";
  if (stops.some((stop) => !stop.address.trim())) return "Every stop needs a full address.";
  if (stops[0].type !== "pickup") return "The journey needs to start with a pickup.";
  if (stops[stops.length - 1].type !== "dropoff") return "The journey needs to end with a drop off.";
  return null;
}

export function hasExtraStops(stops: JourneyStop[]): boolean {
  return stops.length > 2;
}

export function describeStops(stops: JourneyStop[]): string {
  return stops
    .map((stop, index) => `${index + 1}. ${stop.type === "pickup" ? "Pickup" : "Drop off"}: ${stop.address}${stop.notes ? ` (${stop.notes})` : ""}`)
    .join("; ");
}

export function openReturnSummary(booking: { openReturn?: boolean; returnDate?: string; returnPickupTime?: string; returnNoticeNote?: string }): string {
  if (booking.openReturn !== true) return "";
  const date = text(booking.returnDate, 10);
  const time = text(booking.returnPickupTime, 40);
  const note = text(booking.returnNoticeNote, 400);
  const parts = [
    date ? `Open return on ${date}.` : "Open return.",
    time ? `Pickup time now set for ${time}.` : "Return time to be confirmed.",
    OPEN_RETURN_NOTICE,
  ];
  if (note) parts.push(note);
  return parts.join(" ");
}
