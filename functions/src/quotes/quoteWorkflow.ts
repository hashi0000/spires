export const WORKFLOW_STATUSES = [
  "pending",
  "awaiting_customer_confirmation",
  "confirmed",
  "allocated",
  "completed",
  "cancelled",
] as const;

export type WorkflowStatus = (typeof WORKFLOW_STATUSES)[number];

export const ADMIN_EMAILS = ["spirestaxis24@gmail.com", "hashim@spires.com"];

export function isQuoteAdmin(email: string | null | undefined): boolean {
  return ADMIN_EMAILS.includes(String(email || "").trim().toLowerCase());
}

export function canCustomerAccept(input: {
  authUid?: string | null;
  bookingUid?: string | null;
  tokenValid: boolean;
}): boolean {
  if (input.tokenValid) return true;
  return Boolean(input.authUid && input.bookingUid && input.authUid === input.bookingUid);
}

export type AcceptDecision =
  | { ok: false; code: "cancelled" | "not_issued" | "stale" | "expired" | "forbidden" }
  | {
      ok: true;
      already: boolean;
      nextStatus: "confirmed" | "awaiting_customer_confirmation";
      substatus: "" | "awaiting_payment";
    };

export function decideAcceptance(input: {
  status?: string | null;
  customerStatus?: string | null;
  quoteIssuedVersion?: number | null;
  quoteAcceptedVersion?: number | null;
  validUntilMs?: number | null;
  nowMs: number;
  requestedVersion: number;
  paymentRequirement?: string | null;
  authorised: boolean;
  advancePaymentSatisfied?: boolean;
}): AcceptDecision {
  if (!input.authorised) return { ok: false, code: "forbidden" };
  if ((input.status || input.customerStatus) === "cancelled") return { ok: false, code: "cancelled" };
  if (!input.quoteIssuedVersion) return { ok: false, code: "not_issued" };
  if (input.requestedVersion !== input.quoteIssuedVersion) return { ok: false, code: "stale" };
  if (input.validUntilMs != null && input.nowMs > input.validUntilMs) return { ok: false, code: "expired" };
  const locked = input.status === "confirmed" || input.status === "allocated" || input.status === "completed";
  if (input.quoteAcceptedVersion === input.quoteIssuedVersion) {
    if (locked || input.paymentRequirement !== "advance" || input.advancePaymentSatisfied === true) {
      return { ok: true, already: true, nextStatus: "confirmed", substatus: "" };
    }
    return {
      ok: true,
      already: true,
      nextStatus: "awaiting_customer_confirmation",
      substatus: "awaiting_payment",
    };
  }
  if (locked) return { ok: false, code: "stale" };
  if (input.paymentRequirement === "advance" && input.advancePaymentSatisfied !== true) {
    return { ok: true, already: false, nextStatus: "awaiting_customer_confirmation", substatus: "awaiting_payment" };
  }
  return { ok: true, already: false, nextStatus: "confirmed", substatus: "" };
}

export function canIssueQuote(status: string | null | undefined, reissue: boolean): { ok: boolean; reason?: string } {
  if (status === "cancelled" || status === "completed" || status === "allocated" || status === "confirmed") {
    return { ok: false, reason: "This booking is already confirmed, allocated, completed or cancelled. It was not reset." };
  }
  if (status === "awaiting_customer_confirmation" && !reissue) {
    return { ok: false, reason: "This quote was already sent. Tick reissue to send a new version." };
  }
  return { ok: true };
}

export function paymentBuckets(input: {
  finalFarePence: number;
  amountReceivedPence: number;
  paymentRequirement?: string | null;
  substatus?: string | null;
  hasPaymentLink?: boolean;
}): { stored: "pending" | "partial" | "paid"; label: "Unpaid" | "Awaiting payment" | "Part paid" | "Paid"; outstandingPence: number } {
  const finalFare = Math.max(0, Math.round(input.finalFarePence || 0));
  const received = Math.max(0, Math.round(input.amountReceivedPence || 0));
  const outstandingPence = Math.max(0, finalFare - received);
  if (finalFare > 0 && received >= finalFare) {
    return { stored: "paid", label: "Paid", outstandingPence: 0 };
  }
  if (received > 0) {
    return { stored: "partial", label: "Part paid", outstandingPence };
  }
  const awaiting =
    input.paymentRequirement === "advance" ||
    input.substatus === "awaiting_payment" ||
    input.hasPaymentLink === true;
  return {
    stored: "pending",
    label: awaiting ? "Awaiting payment" : "Unpaid",
    outstandingPence,
  };
}

export function shouldMoveToConfirmedAfterPayment(input: {
  acceptedVersion?: number | null;
  issuedVersion?: number | null;
  paymentVerified: boolean;
  status?: string | null;
}): boolean {
  if (!input.paymentVerified) return false;
  if (!input.acceptedVersion || input.acceptedVersion !== input.issuedVersion) return false;
  return input.status === "awaiting_customer_confirmation" || input.status === "pending";
}

type BookingWorkflow = { status?: string | null; adminStatus?: string | null; customerStatus?: string | null };

/** Main status wins. Preserve the historical confirmed/admin-allocated representation. */
export function effectiveWorkflowStatus(data: BookingWorkflow): string {
  const primary = data.status || data.adminStatus || data.customerStatus || "pending";
  if (primary === "paid") return "completed";
  if (primary === "confirmed" && ["allocated", "completed"].includes(data.adminStatus || "")) {
    return data.adminStatus!;
  }
  return primary;
}

export function isWorkflowConfirmed(data: BookingWorkflow): boolean {
  return ["confirmed", "allocated", "completed"].includes(effectiveWorkflowStatus(data));
}

type ConfirmationBooking = BookingWorkflow & {
  confirmationEmailSentAt?: unknown;
  hirerEmail?: string | null;
  email?: string | null;
};

export function shouldSendConfirmation(before: ConfirmationBooking | null, after: ConfirmationBooking): boolean {
  if (after.confirmationEmailSentAt || !isWorkflowConfirmed(after)) return false;
  if (!before || !isWorkflowConfirmed(before)) return true;
  // A confirmed booking that previously had no recipient can now receive its first confirmation.
  const recipient = (row: ConfirmationBooking) => String(row.hirerEmail || row.email || "").trim();
  return !recipient(before) && Boolean(recipient(after));
}

export function bookingMatchesStatusFilter(booking: BookingWorkflow, filter: string): boolean {
  return !filter || filter === "all" || effectiveWorkflowStatus(booking) === filter;
}

export function workflowStatusLabel(status: string | null | undefined): string {
  switch (status) {
    case "pending":
      return "Pending";
    case "awaiting_customer_confirmation":
      return "Awaiting customer confirmation";
    case "confirmed":
      return "Confirmed";
    case "allocated":
      return "Allocated";
    case "completed":
      return "Completed";
    case "cancelled":
      return "Cancelled";
    case "paid":
      return "Paid";
    default:
      return status ? status.charAt(0).toUpperCase() + status.slice(1) : "Pending";
  }
}

export type EmailEnqueueMode = "auto" | "retry" | "resend";

export function emailEnqueueDecision(
  existing: { status?: string | null } | null,
  mode: EmailEnqueueMode
): "create" | "requeue" | "skip" {
  if (mode === "resend") return "create";
  if (!existing) return "create";
  if (mode === "retry" && existing.status === "failed") return "requeue";
  return "skip";
}

export function emailJobDocId(bookingId: string, event: string, version: string, resend = 0): string {
  const base = `${bookingId}__${event}__${version}`.replace(/[^a-zA-Z0-9_-]+/g, "_");
  return resend > 0 ? `${base}__resend_${resend}` : base;
}
