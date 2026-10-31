/** Keep in step with functions/src/quotes/quoteWorkflow.ts */

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

export function workflowBadgeClass(status: string | null | undefined): string {
  if (status === "awaiting_customer_confirmation") return "badge-awaiting";
  if (status === "paid") return "badge-completed";
  return `badge-${status || "pending"}`;
}
