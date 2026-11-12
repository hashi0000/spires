/** Europe/London display helpers. A missing timestamp stays blank. */

export function asDate(value: unknown): Date | null {
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (value && typeof value === "object" && "toDate" in (value as { toDate?: () => Date }) && typeof (value as { toDate?: () => Date }).toDate === "function") {
    const date = (value as { toDate: () => Date }).toDate();
    return date instanceof Date && !Number.isNaN(date.getTime()) ? date : null;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  if (typeof value === "string" && value.trim()) {
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? null : date;
  }
  return null;
}

function londonParts(value: unknown): Intl.DateTimeFormatPart[] | null {
  const date = asDate(value);
  if (!date) return null;
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);
}

function part(parts: Intl.DateTimeFormatPart[], type: Intl.DateTimeFormatPartTypes): string {
  return parts.find((item) => item.type === type)?.value || "";
}

/** dd/mm/yyyy in Europe/London. Blank when the timestamp is missing or invalid. */
export function londonExportDate(value: unknown): string {
  const parts = londonParts(value);
  if (!parts) return "";
  return `${part(parts, "day")}/${part(parts, "month")}/${part(parts, "year")}`;
}

/** HH:mm in Europe/London. Blank when the timestamp is missing or invalid. */
export function londonExportTime(value: unknown): string {
  const parts = londonParts(value);
  if (!parts) return "";
  return `${part(parts, "hour")}:${part(parts, "minute")}`;
}

/** Sortable Europe/London local time, without a timezone suffix. Blank when missing. */
export function londonStamp(value: unknown): string {
  const parts = londonParts(value);
  if (!parts) return "";
  return `${part(parts, "year")}-${part(parts, "month")}-${part(parts, "day")}T${part(parts, "hour")}:${part(parts, "minute")}:${part(parts, "second")}`;
}
