/** Keep in step with functions/src/quotes/quoteWorkflow.ts */

export function bookingMatchesStatusFilter(
  booking: { status?: string | null; adminStatus?: string | null; customerStatus?: string | null },
  filter: string
): boolean {
  if (!filter || filter === "all") return true;
  const status = booking.status || "";
  const admin = booking.adminStatus || "";
  const customer = booking.customerStatus || "";
  if (filter === "allocated") return status === "allocated" || admin === "allocated";
  if (filter === "completed") {
    return status === "completed" || admin === "completed" || status === "paid" || customer === "paid";
  }
  if (filter === "confirmed") {
    const allocated = status === "allocated" || admin === "allocated";
    const completed = status === "completed" || admin === "completed" || status === "paid" || customer === "paid";
    if (allocated || completed) return false;
    return status === "confirmed" || admin === "confirmed";
  }
  if (filter === "awaiting_customer_confirmation") {
    return status === "awaiting_customer_confirmation" || admin === "awaiting_customer_confirmation";
  }
  return status === filter || admin === filter || customer === filter;
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
