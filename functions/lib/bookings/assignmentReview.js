"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.assignmentReview = assignmentReview;
function assignmentReview(vehicle, now = new Date()) {
    if (!vehicle)
        return { block: false, notes: [] };
    const notes = [];
    if (vehicle.available === false)
        notes.push("This vehicle is off the fleet.");
    if (vehicle.motExpiry) {
        const expiry = new Date(vehicle.motExpiry);
        if (!Number.isNaN(expiry.getTime())) {
            const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
            const day = new Date(expiry.getFullYear(), expiry.getMonth(), expiry.getDate());
            if (day < today)
                notes.push("Stored MOT date needs review. This is the date on file.");
        }
    }
    return { block: vehicle.available === false, notes };
}
