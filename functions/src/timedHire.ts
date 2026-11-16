export type TimedHire = {
  startAt?: string;
  includedMinutes?: number;
  itinerary?: string;
  extraRatePounds?: number;
  extraIntervalMinutes?: number;
  acceptedAt?: string;
};

export function timedHireIssueError(booking: { timedHire?: TimedHire | null } | null | undefined): string | null {
  const hire = booking && booking.timedHire;
  if (!hire) return null;
  const minutes = Number(hire.includedMinutes);
  const rate = Number(hire.extraRatePounds);
  const interval = Number(hire.extraIntervalMinutes);
  if (!hire.startAt || !Number.isFinite(new Date(hire.startAt).getTime()) || !Number.isFinite(minutes) || minutes <= 0 || !String(hire.itinerary || "").trim()) {
    return "A timed hire quote needs the pickup time, included duration and itinerary.";
  }
  if (!Number.isFinite(rate) || rate <= 0 || !Number.isFinite(interval) || interval <= 0) {
    return "Enter the additional time rate and billing interval before issuing timed hire terms. No rate has been approved for publication.";
  }
  return null;
}

export function timedHireAcknowledgement(hire: TimedHire): string {
  const start = new Date(String(hire.startAt));
  const clock = Number.isNaN(start.getTime())
    ? "the agreed start"
    : new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(start);
  const hours = Number(hire.includedMinutes) / 60;
  const duration = Number.isInteger(hours) ? `${hours} hours` : `${hire.includedMinutes} minutes`;
  return `I understand this booking includes ${duration} from ${clock}. Additional time is charged at £${hire.extraRatePounds} per started ${hire.extraIntervalMinutes} minutes.`;
}

export function proposeTimedHireCharge(input: {
  startAt?: string | null;
  includedMinutes?: number | null;
  driverArrivedAt?: string | null;
  passengerOnboardAt?: string | null;
  completedAt?: string | null;
  delayCause?: string | null;
  extraRatePounds?: number | null;
  extraIntervalMinutes?: number | null;
  excludedMinutes?: number | null;
  now?: number;
}): {
  finishAt: string | null;
  customerFinishAt: string | null;
  extraMinutes: number;
  blocks: number;
  proposedPounds: number;
  warning: boolean;
  preview: string;
} {
  const start = input.startAt ? new Date(input.startAt).getTime() : NaN;
  const included = Number(input.includedMinutes);
  const rate = Number(input.extraRatePounds);
  const interval = Number(input.extraIntervalMinutes);
  if (!Number.isFinite(start) || !Number.isFinite(included) || included <= 0) {
    return { finishAt: null, customerFinishAt: null, extraMinutes: 0, blocks: 0, proposedPounds: 0, warning: false, preview: "Timed hire needs an agreed start and included duration." };
  }
  const planned = start + included * 60000;
  const arrived = input.driverArrivedAt ? new Date(input.driverArrivedAt).getTime() : NaN;
  const late = Number.isFinite(arrived) ? Math.max(0, arrived - start) : 0;
  const customerFinish = planned + late;
  const end = input.completedAt ? new Date(input.completedAt).getTime() : NaN;
  const cause = String(input.delayCause || "");
  const overrun = Number.isFinite(end) ? Math.max(0, end - customerFinish) : 0;
  const excluded = Math.max(0, Number(input.excludedMinutes) || 0) * 60000;
  const chargeable = cause === "driver" ? 0 : Math.max(0, overrun - excluded);
  const blocks = !Number.isFinite(interval) || interval <= 0 || chargeable === 0 ? 0 : Math.ceil(chargeable / (interval * 60000));
  const proposed = Number.isFinite(rate) && rate > 0 ? blocks * rate : 0;
  const now = input.now || Date.now();
  const warning = !Number.isFinite(end) && now >= customerFinish - 30 * 60000;
  const finishLabel = new Intl.DateTimeFormat("en-GB", { timeZone: "Europe/London", hour: "2-digit", minute: "2-digit", hourCycle: "h23" }).format(new Date(customerFinish));
  return {
    finishAt: new Date(planned).toISOString(),
    customerFinishAt: new Date(customerFinish).toISOString(),
    extraMinutes: Math.ceil(chargeable / 60000),
    blocks,
    proposedPounds: proposed,
    warning,
    preview: `Included time ends at ${finishLabel} UK time. ${Number.isFinite(rate) && Number.isFinite(interval) ? `Additional time is charged at £${rate} per started ${interval} minutes.` : "The additional time rate is not agreed yet."} Proposed additional charge £${proposed}. This reminder is not a new request for permission.`,
  };
}
