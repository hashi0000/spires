export function formatVehicleTypeLabel(type?: string | null): string {
  if (!type) return "Not specified";
  if (type === "8_seater" || type === "8-seater") return "8-seater";
  if (type === "standard") return "Standard Car";
  return String(type).replace(/_/g, " ");
}

export function vehicleClassExamples(type?: string | null): string {
  if (type === "standard") return "Toyota RAV4 / Corolla or similar";
  if (type === "8_seater" || type === "8-seater") return "Mercedes Vito or similar";
  return "";
}
