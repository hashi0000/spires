export type JourneyStop = {
  id: string;
  type: "pickup" | "dropoff";
  address: string;
  notes: string;
  place: Record<string, unknown> | null;
};

export const OPEN_RETURN_NOTICE =
  "For a return pickup in Oxford, please give your driver at least 30 minutes' notice. For pickups outside Oxford, contact us to confirm the notice needed.";

type Loose = Record<string, unknown>;

function text(value: unknown, max = 240): string {
  return String(value ?? "").trim().slice(0, max);
}

export function newStopId(): string {
  return `stop-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normaliseStops(raw: unknown, pickup = "", destination = ""): JourneyStop[] {
  const fromRaw = Array.isArray(raw)
    ? raw.map((item, index) => {
        const row = item && typeof item === "object" ? (item as Loose) : {};
        const kind = text(row.type);
        return {
          id: text(row.id, 40) || `stop-${index + 1}`,
          type: kind === "dropoff" || kind === "drop_off" ? "dropoff" : "pickup",
          address: text(row.address),
          notes: text(row.notes, 400),
          place: row.place && typeof row.place === "object" ? (row.place as Record<string, unknown>) : null,
        } as JourneyStop;
      }).filter((stop) => stop.address)
    : [];
  if (fromRaw.length > 0) return fromRaw;
  const start = text(pickup);
  const end = text(destination);
  if (!start && !end) return [];
  return [
    { id: "start", type: "pickup", address: start, notes: "", place: null },
    { id: "end", type: "dropoff", address: end, notes: "", place: null },
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

export function routeSentence(stops: JourneyStop[], when = ""): string {
  const clock = when.trim();
  if (stops.length === 2 && stops.every((stop) => !stop.notes)) {
    return `${stops[0].address} to ${stops[1].address}${clock ? ` at ${clock}` : ""}`;
  }
  return `${describeStops(stops)}${clock ? `. ${clock}` : ""}`;
}

export function emailJourneyText(booking: Loose): string {
  const outbound = normaliseStops(
    booking.stops,
    text(booking.pickupLocation) || text(booking.pickup),
    text(booking.destination)
  );
  const lines: string[] = [];
  if (hasExtraStops(outbound)) {
    lines.push(`Stops: ${describeStops(outbound)}. Extra stops. Agree the fare.`);
  } else if (outbound.length >= 2 && outbound[0].address && outbound[outbound.length - 1].address) {
    lines.push(`${outbound[0].address} to ${outbound[outbound.length - 1].address}`);
  }
  const returning = normaliseStops(booking.returnStops, text(booking.returnPickupLocation), text(booking.returnDestination));
  const isReturn = text(booking.bookingType) === "return" || Boolean(text(booking.returnPickupLocation)) || booking.openReturn === true;
  if (isReturn && booking.openReturn === true) lines.push(openReturnSummary(booking));
  if (hasExtraStops(returning)) {
    lines.push(`Return stops: ${describeStops(returning)}. Extra stops. Agree the fare.`);
  } else if (isReturn && booking.openReturn !== true && returning.length >= 2 && returning[0].address && returning[returning.length - 1].address) {
    lines.push(`Return: ${returning[0].address} to ${returning[returning.length - 1].address}`);
  }
  return lines.filter(Boolean).join("\n");
}

export function describeStops(stops: JourneyStop[]): string {
  return stops
    .map((stop, index) => {
      const kind = stop.type === "pickup" ? "Pickup" : "Drop off";
      return `${index + 1}. ${kind}: ${stop.address}${stop.notes ? ` (${stop.notes})` : ""}`;
    })
    .join("; ");
}

export function openReturnSummary(booking: Loose): string {
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

export function readStops(body: Loose, key: string, pickup: string, destination: string): JourneyStop[] {
  return normaliseStops(body[key], pickup, destination).slice(0, 12);
}

export function applyStopEnds(stops: JourneyStop[]): { pickup: string; destination: string; pickupPlace: Record<string, unknown> | null; destinationPlace: Record<string, unknown> | null } {
  const first = stops[0];
  const last = stops[stops.length - 1];
  return {
    pickup: first?.address || "",
    destination: last?.address || "",
    pickupPlace: first?.place || null,
    destinationPlace: last?.place || null,
  };
}
