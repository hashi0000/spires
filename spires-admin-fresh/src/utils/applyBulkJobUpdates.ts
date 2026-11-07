import { deleteField, doc, serverTimestamp, writeBatch, type Firestore, type UpdateData } from 'firebase/firestore';
import type { BulkPatch } from './bulkBookingEdit';

export async function applyBulkJobUpdates(
  db: Firestore,
  updates: { id: string; patch: BulkPatch }[]
): Promise<void> {
  const chunkSize = 400;
  for (let start = 0; start < updates.length; start += chunkSize) {
    const batch = writeBatch(db);
    updates.slice(start, start + chunkSize).forEach((item) => {
      const data: Record<string, unknown> = { updatedAt: serverTimestamp() };
      if (item.patch.driverId === null) data.driverId = deleteField();
      else if (item.patch.driverId) data.driverId = item.patch.driverId;
      if (item.patch.vehicleId === null) data.vehicleId = deleteField();
      else if (item.patch.vehicleId) data.vehicleId = item.patch.vehicleId;
      if (item.patch.status) {
        data.status = item.patch.status;
        data.adminStatus = item.patch.adminStatus;
        data.customerStatus = item.patch.customerStatus;
      }
      if (item.patch.allocatedTime) data.allocatedTime = item.patch.allocatedTime;
      if (item.patch.notes !== undefined) data.notes = item.patch.notes;
      batch.update(doc(db, 'bookings', item.id), data as UpdateData<Record<string, unknown>>);
    });
    await batch.commit();
  }
}
