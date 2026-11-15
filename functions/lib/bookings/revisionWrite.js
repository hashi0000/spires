"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mergeBookingFields = mergeBookingFields;
const bookingRevision_1 = require("./bookingRevision");
/** Admin SDK booking patch. The revision moves in the same transaction as the other fields. */
async function mergeBookingFields(ref, patch) {
    await ref.firestore.runTransaction(async (tx) => {
        const snap = await tx.get(ref);
        if (!snap.exists)
            return;
        tx.update(ref, { ...patch, revision: (0, bookingRevision_1.nextBookingRevision)(snap.data()) });
    });
}
