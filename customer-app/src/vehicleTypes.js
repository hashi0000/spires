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
    label: "8-Seater",
    examples: "Mercedes Vito or similar",
    capacity: "Up to 8 passengers",
    maxPassengers: 8,
  },
];

export const VEHICLE_ALLOCATION_DISCLAIMER =
  "Vehicle models are examples only and may vary depending on availability and booking requirements. Luggage capacity depends on passenger numbers. Please tell us about large or additional luggage when booking.";

export function formatVehicleTypeLabel(type) {
  if (!type) return "Not specified";
  if (type === "8_seater" || type === "8-seater") return "8-Seater";
  if (type === "standard") return "Standard Car";
  return String(type).replace(/_/g, " ");
}

export function vehicleClassExamples(type) {
  if (type === "standard") return "Toyota RAV4 / Corolla or similar";
  if (type === "8_seater" || type === "8-seater") return "Mercedes Vito or similar";
  return "";
}

export function maxPassengersForVehicle(type) {
  if (type === "8_seater" || type === "8-seater") return 8;
  return 4;
}
