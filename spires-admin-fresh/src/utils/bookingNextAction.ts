import { Booking } from "../types/types";
import { effectiveWorkflowStatus } from "./bookingWorkflow";
import { completeActionPlan } from "./completeAction";

export type BookingNextAction = {
  code: "send_quote" | "confirm" | "assign_driver" | "record_payment" | "complete" | "invoice" | "review" | "none";
  label: string;
};

function hasFare(booking: Booking): boolean {
  return Number(booking.actualFare) > 0;
}

function hasEmail(booking: Booking): boolean {
  const row = booking as Booking & { email?: string; hirerEmail?: string };
  return Boolean(String(row.email || row.hirerEmail || "").trim());
}

function isAccountJob(booking: Booking): boolean {
  const row = booking as Booking & { jobKind?: string; billingAccountId?: string };
  return booking.paymentMethod === "account" || row.jobKind === "account" || Boolean(row.billingAccountId);
}

/** One obvious next step for office dispatch. */
export function bookingNextAction(booking: Booking): BookingNextAction {
  const status = effectiveWorkflowStatus(booking);
  if (status === "cancelled") return { code: "none", label: "Cancelled" };
  if (status === "pending" || status === "awaiting_customer_confirmation") {
    if (!hasFare(booking) && !isAccountJob(booking)) return { code: "send_quote", label: "Send quote" };
    if (status === "pending") return { code: "confirm", label: "Confirm booking" };
    return { code: "review", label: "Awaiting customer" };
  }
  if ((status === "confirmed" || status === "allocated") && !booking.driverId) {
    return { code: "assign_driver", label: "Assign driver" };
  }
  if (status === "allocated" || status === "confirmed") {
    const plan = completeActionPlan(booking as unknown as Record<string, unknown>, "outbound");
    if (plan.mode === "complete_and_record") {
      return { code: "complete", label: plan.primaryLabel };
    }
    const paymentStatus = booking.paymentStatus || "pending";
    if (!isAccountJob(booking) && paymentStatus !== "paid" && hasFare(booking) && hasEmail(booking) && plan.reason === "charges_pending") {
      return { code: "record_payment", label: "Record payment" };
    }
    return { code: "complete", label: plan.primaryLabel === "Mark complete" ? "Mark completed" : plan.primaryLabel };
  }
  if (status === "completed") {
    const row = booking as Booking & { invoiceStatus?: string };
    if (isAccountJob(booking) && row.invoiceStatus !== "invoiced") {
      return { code: "invoice", label: "Mark invoiced" };
    }
    return { code: "none", label: "Done" };
  }
  return { code: "review", label: "Review" };
}
