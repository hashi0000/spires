export const VEHICLE_TYPES = [
  {
    value: "standard",
    label: "Standard Car",
    examples: "Toyota RAV4 / Corolla or similar",
    capacity: "Up to 4 passengers",
    maxPassengers: 4,
  },
  {
    value: "8_seater",
    label: "8 Seater",
    examples: "Mercedes Vito or similar",
    capacity: "Up to 8 passengers",
    maxPassengers: 8,
  },
  {
    value: "executive",
    label: "Executive Car",
    examples: "Mercedes E Class or equivalent",
    capacity: "Suitability confirmed before acceptance",
    maxPassengers: 8,
  },
];

export const VEHICLE_ALLOCATION_DISCLAIMER =
  "Vehicle models are examples only and may vary depending on availability and booking requirements. Luggage capacity depends on passenger numbers. Please tell us about large or additional luggage when booking.";

export function formatVehicleTypeLabel(type) {
  if (!type) return "Not specified";
  if (type === "executive") return "Executive Car";
  if (type === "8_seater" || type === "8-seater") return "8 Seater";
  if (type === "standard") return "Standard Car";
  return String(type).replace(/_/g, " ");
}

export function vehicleClassExamples(type) {
  if (type === "executive") return "Mercedes E Class or equivalent";
  if (type === "standard") return "Toyota RAV4 / Corolla or similar";
  if (type === "8_seater" || type === "8-seater") return "Mercedes Vito or similar";
  return "";
}

export function maxPassengersForVehicle(type) {
  if (type === "8_seater" || type === "8-seater" || type === "executive") return 8;
  return 4;
}

export const EXECUTIVE_SERVICE_ENABLED = false;

export function executiveServicePublic() {
  if (EXECUTIVE_SERVICE_ENABLED) return true;
  if (typeof window === "undefined") return false;
  const host = window.location.hostname;
  if (host !== "localhost" && host !== "127.0.0.1" && host !== "[::1]") return false;
  return new URLSearchParams(window.location.search).get("executive") !== "0";
}
