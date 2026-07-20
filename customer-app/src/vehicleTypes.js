export const VEHICLE_TYPES = [
  {
    value: "standard",
    label: "Standard car (up to 4 passengers)",
    maxPassengers: 4,
  },
  {
    value: "8_seater",
    label: "8-seater (up to 8 passengers)",
    maxPassengers: 8,
  },
];

export function formatVehicleTypeLabel(type) {
  if (!type) return "Not specified";
  if (type === "8_seater" || type === "8-seater") return "8-seater";
  if (type === "standard") return "Standard car";
  return String(type).replace(/_/g, " ");
}

export function maxPassengersForVehicle(type) {
  if (type === "8_seater" || type === "8-seater") return 8;
  return 4;
}
