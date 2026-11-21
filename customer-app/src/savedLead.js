function routeCategoryFromText(text) {
  const value = String(text || "").toLowerCase();
  if (/heathrow|\blhr\b|8-seater|8_seater/.test(value)) return "heathrow";
  if (/gatwick|\blgw\b/.test(value)) return "gatwick";
  if (/stansted|\bstn\b/.test(value)) return "stansted";
  if (/luton|\bltn\b/.test(value)) return "luton";
  if (/birmingham|\bbhx\b/.test(value)) return "birmingham";
  if (/london city|\blcy\b/.test(value)) return "london_city";
  if (/bristol|\bbrs\b/.test(value)) return "bristol";
  if (/cotswolds?/.test(value)) return "cotswolds";
  if (/airport|terminal/.test(value)) return "other_airport";
  return "other";
}

export function recordPortalLead(measurement, result, details = {}) {
  if (!measurement || !result || result.ok !== true || result.duplicate === true || !result.bookingId) return;
  const vehicle = String(details.vehicleType || result.vehicleType || "").trim();
  const journey = String(details.journeyType || result.journeyType || "").trim().toLowerCase();
  const extras = {};
  if (vehicle === "standard" || vehicle === "8_seater" || vehicle === "executive") extras.vehicle_type = vehicle;
  if (journey === "return") extras.journey_type = "return";
  else if (journey === "cotswolds" || journey === "cotswold") extras.journey_type = "cotswolds";
  else extras.journey_type = "one_way";
  extras.route_category = routeCategoryFromText(
    [details.pickupLocation, details.destination, details.returnPickupLocation, details.returnDestination].filter(Boolean).join(" "),
  );
  if (result.serviceType === "executive" && result.airport === "heathrow") {
    extras.service_type = "executive";
    extras.airport = "heathrow";
  }
  measurement.lead(result.bookingId, "portal", "booking_request", extras);
}
