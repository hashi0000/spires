"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatVehicleTypeLabel = formatVehicleTypeLabel;
exports.vehicleClassExamples = vehicleClassExamples;
function formatVehicleTypeLabel(type) {
    if (!type)
        return "Not specified";
    if (type === "8_seater" || type === "8-seater")
        return "8-Seater";
    if (type === "standard")
        return "Standard Car";
    return String(type).replace(/_/g, " ");
}
function vehicleClassExamples(type) {
    if (type === "standard")
        return "Toyota RAV4 / Corolla or similar";
    if (type === "8_seater" || type === "8-seater")
        return "Mercedes Vito or similar";
    return "";
}
