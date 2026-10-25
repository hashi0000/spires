export const CURRENT_BOOKING_TERMS = {
  version: "2026-10-25",
  appliesToJourneysFrom: "2026-04-01",
  publishedOn: "2026-10-25",
  url: "https://www.spires-taxis.com/terms/2026-10-25",
};

export function termsUrlForVersion(version: string): string {
  if (version === CURRENT_BOOKING_TERMS.version) return CURRENT_BOOKING_TERMS.url;
  if (version === "previous-public") return "https://www.spires-taxis.com/terms/previous-public";
  return "";
}

export function acceptanceMethodLabel(method: string): string {
  switch (method) {
    case "customer_portal":
      return "Customer portal";
    case "website":
      return "Website";
    case "terms_link":
      return "Secure link";
    case "phone":
      return "Phone";
    case "email":
      return "Email";
    case "whatsapp":
      return "WhatsApp";
    case "in_person":
      return "In person";
    case "other":
      return "Other";
    default:
      return method || "";
  }
}

export function termsTimeToDate(value: unknown): Date | null {
  if (value == null || value === "") return null;
  if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
  if (typeof value === "object" && value !== null) {
    const row = value as { toDate?: () => Date; seconds?: number };
    if (typeof row.toDate === "function") {
      const date = row.toDate();
      return Number.isNaN(date.getTime()) ? null : date;
    }
    if (typeof row.seconds === "number") return new Date(row.seconds * 1000);
  }
  const parsed = new Date(String(value));
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

export function formatTermsWhen(value: unknown): string {
  const date = termsTimeToDate(value);
  if (!date) return "";
  return new Intl.DateTimeFormat("en-GB", {
    timeZone: "Europe/London",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).format(date);
}

export function confirmationTermsParagraph(booking: {
  termsAccepted?: unknown;
  termsVersion?: unknown;
  acceptanceMethod?: unknown;
  termsAcceptedAt?: unknown;
}): string {
  const version = typeof booking.termsVersion === "string" ? booking.termsVersion : "";
  if (booking.termsAccepted !== true || !version) {
    return `Acceptance not recorded. Current published terms version ${CURRENT_BOOKING_TERMS.version}: ${CURRENT_BOOKING_TERMS.url}`;
  }
  const when = formatTermsWhen(booking.termsAcceptedAt);
  const method = acceptanceMethodLabel(typeof booking.acceptanceMethod === "string" ? booking.acceptanceMethod : "");
  const url = termsUrlForVersion(version);
  const whenText = when ? `Accepted ${when} (London)` : "Acceptance time not recorded";
  const methodText = method ? ` via ${method}` : "";
  return `Terms version ${version}. ${whenText}${methodText}.${url ? ` ${url}` : ""}`.trim();
}
