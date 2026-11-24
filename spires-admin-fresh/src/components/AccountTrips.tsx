import React, { useMemo, useState } from 'react';
import { Booking } from '../types/types';
import { effectiveWorkflowStatus } from '../utils/bookingWorkflow';
import { getBookingPickupDate } from '../utils/bookingSchedule';

interface AccountTripsProps {
  bookings: Booking[];
  onUpdateBooking: (id: string, data: Partial<Booking> & Record<string, unknown>) => Promise<void>;
  onOpenBooking: (booking: Booking) => void;
}

function isAccountJob(booking: Booking): boolean {
  return (
    booking.paymentMethod === 'account' ||
    booking.jobKind === 'account' ||
    Boolean(booking.billingAccountId) ||
    Boolean(String(booking.billingAccountName || '').trim())
  );
}

function invoiceLabel(booking: Booking): string {
  return booking.invoiceStatus === 'invoiced' ? 'Invoiced' : 'Unbilled';
}

function routeSummary(booking: Booking): string {
  return [booking.pickupLocation, booking.destination].map((p) => String(p || '').trim()).filter(Boolean).join(' → ') || '—';
}

function formatJourneyDate(booking: Booking): string {
  const d = getBookingPickupDate(booking);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const AccountTrips: React.FC<AccountTripsProps> = ({ bookings, onUpdateBooking, onOpenBooking }) => {
  const [accountFilter, setAccountFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'unbilled' | 'invoiced'>('unbilled');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [invoiceReference, setInvoiceReference] = useState('');
  const [linkBookingId, setLinkBookingId] = useState<string | null>(null);
  const [linkAccountName, setLinkAccountName] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');

  const accountBookings = useMemo(() => {
    const seen = new Set<string>();
    const rows: Booking[] = [];
    for (const booking of bookings) {
      if (!isAccountJob(booking)) continue;
      const key = booking.id || booking.bookingNumber;
      if (!key || seen.has(key)) continue;
      seen.add(key);
      rows.push(booking);
    }
    return rows;
  }, [bookings]);

  const filtered = useMemo(() => {
    const accountQ = accountFilter.trim().toLowerCase();
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return accountBookings
      .filter((booking) => {
        if (accountQ) {
          const hay = `${booking.billingAccountName || ''} ${booking.billingAccountId || ''} ${booking.hirerName || ''}`.toLowerCase();
          if (!hay.includes(accountQ)) return false;
        }
        const pickup = getBookingPickupDate(booking);
        if (fromMs != null && (!pickup || pickup.getTime() < fromMs)) return false;
        if (toMs != null && (!pickup || pickup.getTime() > toMs)) return false;
        const invoiced = booking.invoiceStatus === 'invoiced';
        if (invoiceFilter === 'unbilled' && invoiced) return false;
        if (invoiceFilter === 'invoiced' && !invoiced) return false;
        return true;
      })
      .sort((a, b) => {
        const da = getBookingPickupDate(a)?.getTime() || 0;
        const db = getBookingPickupDate(b)?.getTime() || 0;
        return db - da;
      });
  }, [accountBookings, accountFilter, dateFrom, dateTo, invoiceFilter]);

  const readyToBill = useMemo(
    () => filtered.filter((b) => effectiveWorkflowStatus(b) === 'completed' && b.invoiceStatus !== 'invoiced'),
    [filtered]
  );

  const toggleSelected = (id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  };

  const markInvoiced = async () => {
    if (selectedIds.length === 0) return;
    setBusy(true);
    setMessage('');
    try {
      const ref = invoiceReference.trim();
      for (const id of selectedIds) {
        const booking = bookings.find((b) => b.id === id);
        if (!booking?.id) continue;
        await onUpdateBooking(booking.id, {
          invoiceStatus: 'invoiced',
          invoiceReference: ref || booking.invoiceReference || '',
          revision: Number(booking.revision || 0) + 1,
        });
      }
      setSelectedIds([]);
      setInvoiceReference('');
      setMessage(`Marked ${selectedIds.length} journey${selectedIds.length === 1 ? '' : 's'} invoiced. Payment status was not changed.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not mark invoiced.');
    } finally {
      setBusy(false);
    }
  };

  const saveBillingLink = async () => {
    if (!linkBookingId) return;
    const booking = bookings.find((b) => b.id === linkBookingId);
    if (!booking?.id) return;
    const name = linkAccountName.trim();
    if (!name) {
      window.alert('Enter a billing account name.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await onUpdateBooking(booking.id, {
        billingAccountName: name,
        jobKind: booking.jobKind || 'account',
        revision: Number(booking.revision || 0) + 1,
      });
      setLinkBookingId(null);
      setLinkAccountName('');
      setMessage('Billing account linked. Payment status was not changed.');
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not link billing account.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-600 mt-1">
          Account journeys ready to bill. Marking invoiced records the invoice only — it does not set payment status to paid.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-sm text-gray-700">
          Billing account
          <input
            type="search"
            className="form-input mt-1 w-full"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            placeholder="Account name or customer"
          />
        </label>
        <label className="text-sm text-gray-700">
          Journey from
          <input type="date" className="form-input mt-1 w-full" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Journey to
          <input type="date" className="form-input mt-1 w-full" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
        </label>
        <label className="text-sm text-gray-700">
          Invoice status
          <select
            className="form-input mt-1 w-full"
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value as 'all' | 'unbilled' | 'invoiced')}
          >
            <option value="unbilled">Unbilled</option>
            <option value="invoiced">Invoiced</option>
            <option value="all">All</option>
          </select>
        </label>
      </div>

      {readyToBill.length > 0 ? (
        <p className="text-sm text-gray-700">
          {readyToBill.length} completed journey{readyToBill.length === 1 ? '' : 's'} ready to bill in this list.
        </p>
      ) : null}

      {selectedIds.length > 0 ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 flex flex-col sm:flex-row sm:items-end gap-3">
          <label className="text-sm text-gray-700 flex-1">
            Invoice reference (optional)
            <input
              type="text"
              className="form-input mt-1 w-full"
              value={invoiceReference}
              onChange={(e) => setInvoiceReference(e.target.value)}
              placeholder="e.g. INV-1042"
            />
          </label>
          <button type="button" className="btn-primary" disabled={busy} onClick={() => void markInvoiced()}>
            Mark invoiced ({selectedIds.length})
          </button>
        </div>
      ) : null}

      {message ? <p className="text-sm text-gray-700" role="status">{message}</p> : null}

      {linkBookingId ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Link billing account</h3>
          <p className="text-xs text-gray-600">Attach an account name to this booking without recreating it.</p>
          <input
            type="text"
            className="form-input w-full"
            value={linkAccountName}
            onChange={(e) => setLinkAccountName(e.target.value)}
            placeholder="Billing account name"
          />
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveBillingLink()}>
              Save link
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setLinkBookingId(null);
                setLinkAccountName('');
              }}
            >
              Cancel
            </button>
          </div>
        </div>
      ) : null}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        {filtered.length === 0 ? (
          <p className="text-sm text-gray-600 px-4 py-6">No account journeys match these filters.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {filtered.map((booking) => {
              const id = booking.id || '';
              const completed = effectiveWorkflowStatus(booking) === 'completed';
              return (
                <li key={id || booking.bookingNumber} className="px-4 py-3 flex flex-col lg:flex-row lg:items-center gap-3">
                  <div className="flex items-start gap-3 flex-1 min-w-0">
                    {id && completed && booking.invoiceStatus !== 'invoiced' ? (
                      <input
                        type="checkbox"
                        className="mt-1"
                        checked={selectedIds.includes(id)}
                        onChange={() => toggleSelected(id)}
                        aria-label={`Select ${booking.bookingNumber}`}
                      />
                    ) : (
                      <span className="w-4" />
                    )}
                    <div className="min-w-0">
                      <button
                        type="button"
                        className="text-sm font-medium text-indigo-700 hover:underline text-left"
                        onClick={() => onOpenBooking(booking)}
                      >
                        {booking.bookingNumber}
                      </button>
                      <p className="text-xs text-gray-600 mt-0.5">{routeSummary(booking)}</p>
                      <p className="text-xs text-gray-500 mt-0.5">
                        {formatJourneyDate(booking)}
                        {' · '}
                        {booking.billingAccountName || booking.hirerName || 'No account name'}
                        {' · '}
                        {invoiceLabel(booking)}
                        {booking.invoiceReference ? ` · ${booking.invoiceReference}` : ''}
                        {' · Payment: '}
                        {booking.paymentStatus || 'pending'}
                      </p>
                    </div>
                  </div>
                  <div className="flex gap-2 flex-shrink-0">
                    <button type="button" className="text-sm text-indigo-700" onClick={() => onOpenBooking(booking)}>
                      Open
                    </button>
                    {id ? (
                      <button
                        type="button"
                        className="text-sm text-gray-700"
                        onClick={() => {
                          setLinkBookingId(id);
                          setLinkAccountName(booking.billingAccountName || '');
                        }}
                      >
                        Link account
                      </button>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </div>
    </div>
  );
};

export default AccountTrips;
