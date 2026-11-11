export function recordPortalLead(measurement, result) {
  if (!measurement || !result || result.ok !== true || result.duplicate === true || !result.bookingId) return;
  measurement.lead(result.bookingId, "portal", "booking_request");
}
