import { nextBookingRevision } from "./bookingRevision";

/** Admin SDK booking patch. The revision moves in the same transaction as the other fields. */
export async function mergeBookingFields(
  ref: FirebaseFirestore.DocumentReference,
  patch: FirebaseFirestore.UpdateData<FirebaseFirestore.DocumentData>
): Promise<void> {
  await ref.firestore.runTransaction(async (tx) => {
    const snap = await tx.get(ref);
    if (!snap.exists) return;
    tx.update(ref, { ...patch, revision: nextBookingRevision(snap.data()) });
  });
}
