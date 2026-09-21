export type BookingType = "one_way" | "return";

export function parseMoney(value: unknown): number | null {
  if (value === undefined || value === null || String(value).trim() === "") return null;
  const n = typeof value === "number" ? value : Number.parseFloat(String(value));
  return Number.isFinite(n) ? n : null;
}

export function resolveBookingType(booking: { bookingType?: string; returnPickupLocation?: string; returnDestination?: string } | null | undefined): BookingType {
  if (!booking) return "one_way";
  if (booking.bookingType === "return") return "return";
  if ((booking.returnPickupLocation || "").trim() && (booking.returnDestination || "").trim()) {
    return "return";
  }
  return "one_way";
}

export function bookingHasAirportCollection(booking: {
  airportCollection?: boolean;
  returnAirportCollection?: boolean;
} | null | undefined): boolean {
  if (!booking) return false;
  return booking.airportCollection === true || booking.returnAirportCollection === true;
}

export function paymentScheduleValidationError(
  totalFare: number | null,
  deposit: number | null,
  dueOnOutbound: number | null,
  dueOnReturn: number | null
): string | null {
  const anyFilled = deposit != null || dueOnOutbound != null || dueOnReturn != null;
  if (!anyFilled) return null;
  if (totalFare == null || !Number.isFinite(totalFare)) return null;
  const sum = (deposit ?? 0) + (dueOnOutbound ?? 0) + (dueOnReturn ?? 0);
  if (Math.abs(sum - totalFare) > 0.009) {
    return `Payment schedule (£${sum.toFixed(2)}) must equal the total fare (£${totalFare.toFixed(2)}).`;
  }
  return null;
}

export function hasPaymentSchedule(booking: {
  dueOnOutbound?: number | string | null;
  dueOnReturn?: number | string | null;
} | null | undefined): boolean {
  if (!booking) return false;
  return parseMoney(booking.dueOnOutbound) != null || parseMoney(booking.dueOnReturn) != null;
}

export function splitLocalDateTime(value: string | undefined | null): { date: string; time: string } {
  const raw = String(value || "").trim();
  if (!raw) return { date: "", time: "" };
  if (raw.includes("T")) {
    const [date, rest] = raw.split("T");
    return { date: date || "", time: (rest || "").slice(0, 5) };
  }
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return { date: "", time: "" };
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

export function combineLocalDateTime(date: string, time: string): string {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}
