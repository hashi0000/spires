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
    label: "8-seater",
    examples: "Mercedes Vito or similar",
    capacity: "Up to 8 passengers",
    maxPassengers: 8,
  },
];

export const VEHICLE_ALLOCATION_DISCLAIMER =
  "Vehicle models shown are examples of the type of vehicle normally provided. The exact make and model may vary depending on availability. We will provide a suitable vehicle for the passenger and luggage requirements confirmed at the time of booking.";

export function formatVehicleTypeLabel(type) {
  if (!type) return "Not specified";
  if (type === "8_seater" || type === "8-seater") return "8-seater";
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
