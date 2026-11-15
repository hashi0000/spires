"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.formatVehicleTypeLabel = formatVehicleTypeLabel;
exports.vehicleClassExamples = vehicleClassExamples;
exports.executiveRequestNote = executiveRequestNote;
function formatVehicleTypeLabel(type) {
    if (!type)
        return "Not specified";
    if (type === "executive")
        return "Executive Car";
    if (type === "8_seater" || type === "8-seater")
        return "8 Seater";
    if (type === "standard")
        return "Standard Car";
    return String(type).replace(/_/g, " ");
}
function vehicleClassExamples(type) {
    if (type === "executive")
        return "Mercedes E Class or equivalent";
    if (type === "standard")
        return "Toyota RAV4 / Corolla or similar";
    if (type === "8_seater" || type === "8-seater")
        return "Mercedes Vito or similar";
    return "";
}
function executiveRequestNote(booking) {
    if (booking.vehicleType !== "executive")
        return "";
    const partner = "A partner operator may provide the car. Executive Car is the vehicle category, not an allocated car.";
    if (booking.executiveAvailability === "accepted") {
        return `Executive Car. Availability has been accepted. This document follows the booking status shown. ${partner}`;
    }
    return `Executive Car request. Awaiting availability confirmation. This is not a confirmed booking and no vehicle is reserved. ${partner}`;
}
