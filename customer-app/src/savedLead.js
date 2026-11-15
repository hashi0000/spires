export function recordPortalLead(measurement, result) {
  if (!measurement || !result || result.ok !== true || result.duplicate === true || !result.bookingId) return;
  const extra = result.serviceType === "executive" && result.airport === "heathrow"
    ? { service_type: "executive", airport: "heathrow" }
    : null;
  measurement.lead(result.bookingId, "portal", "booking_request", extra);
}
