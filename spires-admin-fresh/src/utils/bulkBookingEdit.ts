import { effectiveWorkflowStatus } from './bookingWorkflow';

export type BulkJobChanges = {
  driver?: '' | 'clear' | string;
  vehicle?: '' | 'clear' | string;
  status?: '' | 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'cancelled';
  payment?: '' | 'pending' | 'partial' | 'paid' | 'refunded';
  note?: string;
};

export type BulkJobRecord = {
  driverId?: string;
  vehicleId?: string;
  notes?: string;
  status?: string | null;
  adminStatus?: string | null;
  customerStatus?: string | null;
  quoteIssuedVersion?: number | null;
  quoteAcceptedVersion?: number | null;
  paymentStatus?: string | null;
  amountReceivedPence?: number | null;
  amountRequestedPence?: number | null;
  issuedQuote?: { amountRequestedPence?: number; paymentRequirement?: string } | null;
  paymentRequirement?: string | null;
};

/** null clears the stored field. Absent means leave it alone. */
export type BulkPatch = {
  driverId?: string | null;
  vehicleId?: string | null;
  status?: BulkJobChanges['status'];
  adminStatus?: BulkJobChanges['status'];
  customerStatus?: BulkJobChanges['status'];
  allocatedTime?: string;
  notes?: string;
  paymentStatus?: 'pending' | 'partial' | 'paid' | 'refunded';
};

export type BulkJobPlan =
  | { ok: true; patch: BulkPatch }
  | { ok: false; reason: string };

export function planBulkJobUpdate(booking: BulkJobRecord, changes: BulkJobChanges, nowIso: string): BulkJobPlan {
  const driver = changes.driver || '';
  const vehicle = changes.vehicle || '';
  const status = changes.status || '';
  const payment = changes.payment || '';
  const note = (changes.note || '').trim();
  const workflow = effectiveWorkflowStatus(booking);
  const nextDriver = driver === 'clear' ? '' : driver || booking.driverId || '';
  const patch: BulkPatch = {};

  if (driver === 'clear') {
    if (booking.driverId) patch.driverId = null;
  } else if (driver && driver !== booking.driverId) {
    patch.driverId = driver;
    patch.allocatedTime = nowIso;
  }

  if (vehicle === 'clear') {
    if (booking.vehicleId) patch.vehicleId = null;
  } else if (vehicle && vehicle !== booking.vehicleId) {
    patch.vehicleId = vehicle;
  }

  if (status && status !== workflow) {
    if (status === 'confirmed' && booking.quoteIssuedVersion) {
      const accepted = booking.quoteAcceptedVersion === booking.quoteIssuedVersion;
      const required = Number(booking.issuedQuote?.amountRequestedPence || booking.amountRequestedPence || 0);
      const advance = (booking.issuedQuote?.paymentRequirement || booking.paymentRequirement) === 'advance';
      const paidEnough = !advance || (required > 0 && Number(booking.amountReceivedPence || 0) >= required);
      if (!accepted || !paidEnough) {
        return { ok: false, reason: 'Open the booking and set the status to Confirmed. That records the acceptance. Record the required payment first when the quote asks for payment in advance.' };
      }
    }
    if (status === 'allocated' && !nextDriver) {
      return { ok: false, reason: 'Choose a driver before marking the job allocated.' };
    }
    patch.status = status;
    patch.adminStatus = status;
    patch.customerStatus = status;
    if (status === 'allocated' && !patch.allocatedTime) patch.allocatedTime = nowIso;
  }

  if (payment && payment !== (booking.paymentStatus || 'pending')) {
    patch.paymentStatus = payment;
  }

  if (note) {
    const existing = (booking.notes || '').trim();
    patch.notes = existing ? `${existing}\n${note}` : note;
  }

  if (Object.keys(patch).length === 0) {
    return { ok: false, reason: 'Nothing to change on this job.' };
  }
  return { ok: true, patch };
}
