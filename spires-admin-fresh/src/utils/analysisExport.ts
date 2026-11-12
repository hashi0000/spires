import { londonStamp } from "./bookingDates";
import { routeLabel, sourceLabel, vehicleLabel, type AdvertisingBookingInput } from "./advertisingResults";

export interface AnalysisBooking extends AdvertisingBookingInput {
  enquiryAt?: string | Date | number;
  confirmedAt?: string | Date | number;
  completedAt?: string | Date | number;
  heardAbout?: string;
  customerReportedSource?: string;
  websiteEnquiryRef?: string;
  guestRequest?: boolean;
  bookingType?: string;
  returnTrip?: boolean;
}

const HEARD_LABELS: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  friend_or_family: "Friend or family",
  used_before: "Used us before",
  website: "Your website",
  other: "Other",
};

const REPORTED_LABELS: Record<string, string> = {
  google_advert: "Google advert",
  google_ads: "Google advert",
  google_search: "Google search",
  recommendation: "Recommendation",
  repeat: "Repeat customer",
  website: "Website",
  other: "Other",
};

export function csvCell(value: string | number | null | undefined): string {
  if (value === null || value === undefined) return "";
  const text = String(value);
  if (text === "") return "";
  if (/[",\n\r]/.test(text)) return `"${text.replace(/"/g, '""')}"`;
  return text;
}

function pounds(value: unknown): string {
  if (typeof value === "number" && Number.isFinite(value)) return value.toFixed(2);
  if (typeof value === "string" && value.trim() !== "" && Number.isFinite(Number(value))) return Number(value).toFixed(2);
  return "";
}

function poundsFromPence(value: unknown): string {
  if (typeof value !== "number" || !Number.isFinite(value)) return "";
  return (value / 100).toFixed(2);
}

function reportedLabel(booking: AnalysisBooking): string {
  const chosen = REPORTED_LABELS[String(booking.customerReportedSource || "")] || REPORTED_LABELS[String(booking.staffReportedSource || "")];
  if (chosen) return chosen;
  const heard = HEARD_LABELS[String(booking.heardAbout || "")];
  if (!heard) return "";
  const detail = String(booking.heardAboutDetail || "").trim();
  return booking.heardAbout === "other" && detail ? `Other: ${detail}` : heard;
}

function trackedLabel(booking: AnalysisBooking): string {
  return sourceLabel(booking) === "Tracked Google Ads" ? "Tracked Google Ads" : "";
}

function directCosts(booking: AnalysisBooking): { text: string; incomplete: boolean } {
  const costs = booking.jobCosts;
  if (!costs) return { text: "", incomplete: true };
  const values = [costs.driverPaymentPence, costs.fuelPence, costs.parkingPence, costs.airportChargesPence, costs.paymentFeesPence];
  if (values.some((value) => typeof value !== "number" || !Number.isFinite(value))) return { text: "", incomplete: true };
  const pence = values.reduce<number>((total, value) => total + Math.round(value || 0), 0);
  return { text: (pence / 100).toFixed(2), incomplete: false };
}

export function buildAnalysisCsv(bookings: AnalysisBooking[]): string {
  const headers = [
    "bookingId",
    "bookingNumber",
    "enquiryOrSubmissionAtLondon",
    "recordCreatedAtLondon",
    "confirmedAtLondon",
    "journeyAtLondon",
    "completedAtLondon",
    "status",
    "bookingChannel",
    "trackedAcquisitionSource",
    "customerReportedSource",
    "campaign",
    "routeCategory",
    "vehicleCategory",
    "quotedFarePounds",
    "paymentsReceivedPounds",
    "refundsPounds",
    "balancePounds",
    "directCostsPounds",
    "timeZone",
    "dataQuality",
  ];
  const lines = [headers.join(",")];
  bookings.forEach((booking) => {
    const online = booking.source === "website" || booking.source === "customer_app" || booking.guestRequest === true;
    const enquiry = booking.enquiryAt || (online ? booking.createdAt : undefined);
    const fare = pounds(booking.actualFare);
    const received = poundsFromPence(booking.amountReceivedPence);
    const refund = poundsFromPence(booking.amountRefundedPence);
    const costs = directCosts(booking);
    const flags: string[] = [];
    if (!londonStamp(booking.createdAt)) flags.push("creation time unknown");
    if (!booking.enquiryAt && !online) flags.push("enquiry time not recorded");
    if (booking.enquiryAt && booking.createdAt && londonStamp(booking.createdAt) && londonStamp(booking.enquiryAt) && londonStamp(booking.createdAt) < londonStamp(booking.enquiryAt)) {
      flags.push("record saved before the entered enquiry time");
    }
    const journey = londonStamp(booking.pickupTime || booking.dateTime);
    const created = londonStamp(booking.createdAt);
    if (journey && created && created > journey) flags.push("record saved after the journey");
    if (!fare) flags.push("fare missing");
    if (!received) flags.push("payment missing");
    if (!refund) flags.push(booking.paymentStatus === "refunded" ? "refund missing" : "refund amount not stored; balance assumes no refund");
    if (costs.incomplete) flags.push("direct costs missing");
    if (!trackedLabel(booking) && !reportedLabel(booking)) flags.push("acquisition source unknown");
    flags.push("campaign not stored");
    if (booking.bookingType === "return" || booking.returnTrip) flags.push("fare is for the whole booking");
    let balance = "";
    if (fare && received && !(booking.paymentStatus === "refunded" && !refund)) {
      const refundPounds = refund ? Number(refund) : 0;
      balance = (Number(fare) - Number(received) + refundPounds).toFixed(2);
    }
    const row = [
      booking.id || "",
      booking.bookingNumber || "",
      londonStamp(enquiry),
      londonStamp(booking.createdAt),
      londonStamp(booking.confirmedAt),
      journey,
      londonStamp(booking.completedAt),
      booking.status || "",
      booking.bookingMethod || booking.enquiryChannel || "",
      trackedLabel(booking),
      reportedLabel(booking),
      "",
      routeLabel(booking),
      vehicleLabel(booking),
      fare,
      received,
      refund,
      balance,
      costs.text,
      "Europe/London",
      flags.join("; "),
    ];
    lines.push(row.map((value) => csvCell(value)).join(","));
  });
  return lines.join("\n");
}
