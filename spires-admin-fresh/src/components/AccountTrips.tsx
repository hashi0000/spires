import React, { useEffect, useMemo, useState } from 'react';
import { Booking } from '../types/types';
import {
  assessAccountBooking,
  blockReasonLabel,
  buildAccountInvoiceDraft,
  filterUnitsNotAlreadyInvoiced,
  invoicedKeysFromHistory,
  isAccountJob,
  selectionTotalPounds,
  type AccountInvoiceDraftHandoff,
  type BillableUnit,
} from '../utils/accountBilling';
import { formatGbp } from '../utils/generalInvoiceTypes';
import { loadGeneralInvoiceVault } from '../utils/generalInvoiceStorage';
import type { SavedInvoiceClient } from '../utils/generalInvoiceTypes';
import { getBookingPickupDate } from '../utils/bookingSchedule';

interface AccountTripsProps {
  bookings: Booking[];
  onUpdateBooking: (id: string, data: Partial<Booking> & Record<string, unknown>) => Promise<void>;
  onOpenBooking: (booking: Booking) => void;
  onCreateInvoiceDraft: (draft: AccountInvoiceDraftHandoff) => void;
}

function routeSummary(booking: Booking): string {
  return [booking.pickupLocation, booking.destination].map((p) => String(p || '').trim()).filter(Boolean).join(' → ') || '—';
}

function formatJourneyDate(booking: Booking): string {
  const d = getBookingPickupDate(booking);
  if (!d) return '—';
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

function invoiceStateLabel(booking: Booking): string {
  if (booking.invoiceStatus === 'invoiced') {
    return booking.invoiceReference ? `Invoiced · ${booking.invoiceReference}` : 'Invoiced';
  }
  if (booking.invoiceStatus === 'partial') {
    return booking.invoiceReference ? `Part invoiced · ${booking.invoiceReference}` : 'Part invoiced';
  }
  return 'Unbilled';
}

const AccountTrips: React.FC<AccountTripsProps> = ({
  bookings,
  onUpdateBooking,
  onOpenBooking,
  onCreateInvoiceDraft,
}) => {
  const [clientFilter, setClientFilter] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [invoiceFilter, setInvoiceFilter] = useState<'all' | 'ready' | 'blocked' | 'invoiced'>('ready');
  const [selectedKeys, setSelectedKeys] = useState<string[]>([]);
  const [invoiceReference, setInvoiceReference] = useState('');
  const [linkBookingId, setLinkBookingId] = useState<string | null>(null);
  const [linkClientId, setLinkClientId] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [invoiceClients, setInvoiceClients] = useState<SavedInvoiceClient[]>([]);
  const [claimedKeys, setClaimedKeys] = useState<Set<string>>(new Set());

  useEffect(() => {
    let cancelled = false;
    loadGeneralInvoiceVault()
      .then((vault) => {
        if (cancelled) return;
        setInvoiceClients(vault.clients || []);
        setClaimedKeys(invoicedKeysFromHistory(vault.invoices || []));
      })
      .catch(() => {
        if (!cancelled) {
          setInvoiceClients([]);
          setClaimedKeys(new Set());
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

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

  const assessments = useMemo(
    () => accountBookings.map((booking) => assessAccountBooking(booking, invoiceClients)),
    [accountBookings, invoiceClients]
  );

  const filtered = useMemo(() => {
    const fromMs = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
    const toMs = dateTo ? new Date(`${dateTo}T23:59:59`).getTime() : null;

    return assessments
      .filter((row) => {
        if (clientFilter) {
          if (row.clientId !== clientFilter) return false;
        }
        const pickup = getBookingPickupDate(row.booking);
        if (fromMs != null && (!pickup || pickup.getTime() < fromMs)) return false;
        if (toMs != null && (!pickup || pickup.getTime() > toMs)) return false;
        const invoiced = row.booking.invoiceStatus === 'invoiced';
        if (invoiceFilter === 'invoiced') return invoiced;
        if (invoiceFilter === 'ready') return row.ready && !invoiced;
        if (invoiceFilter === 'blocked') return !row.ready && !invoiced;
        return true;
      })
      .sort((a, b) => {
        const da = getBookingPickupDate(a.booking)?.getTime() || 0;
        const db = getBookingPickupDate(b.booking)?.getTime() || 0;
        return db - da;
      });
  }, [assessments, clientFilter, dateFrom, dateTo, invoiceFilter]);

  const readyUnits = useMemo(() => {
    const units: BillableUnit[] = [];
    for (const row of filtered) {
      units.push(...row.units);
    }
    return filterUnitsNotAlreadyInvoiced(units, claimedKeys).allowed;
  }, [filtered, claimedKeys]);

  const selectedUnits = useMemo(
    () => readyUnits.filter((unit) => selectedKeys.includes(unit.key)),
    [readyUnits, selectedKeys]
  );

  const selectedClientId = selectedUnits[0]?.clientId || clientFilter || '';
  const selectedClient = invoiceClients.find((client) => client.id === selectedClientId) || null;
  const runningTotal = selectionTotalPounds(selectedUnits);

  const toggleSelected = (unit: BillableUnit) => {
    if (selectedKeys.length > 0 && selectedUnits[0] && selectedUnits[0].clientId !== unit.clientId) {
      setMessage(`Selected trips must all bill to ${selectedUnits[0].clientName}. Clear the selection to switch account.`);
      return;
    }
    setSelectedKeys((prev) => (prev.includes(unit.key) ? prev.filter((x) => x !== unit.key) : [...prev, unit.key]));
    setMessage('');
  };

  const selectAllReadyForClient = () => {
    if (!selectedClientId) {
      setMessage('Choose a billing client filter first, or select one ready trip.');
      return;
    }
    const keys = readyUnits.filter((unit) => unit.clientId === selectedClientId).map((unit) => unit.key);
    setSelectedKeys(keys);
    setMessage(keys.length ? `Selected ${keys.length} ready trip${keys.length === 1 ? '' : 's'}.` : 'No ready trips for that client.');
  };

  const markInvoicedElsewhere = async () => {
    if (selectedUnits.length === 0) return;
    setBusy(true);
    setMessage('');
    try {
      const ref = invoiceReference.trim();
      const byBooking = new Map<string, BillableUnit[]>();
      for (const unit of selectedUnits) {
        const list = byBooking.get(unit.bookingId) || [];
        list.push(unit);
        byBooking.set(unit.bookingId, list);
      }
      for (const [bookingId, units] of Array.from(byBooking.entries())) {
        const booking = bookings.find((b) => b.id === bookingId);
        if (!booking?.id) continue;
        const prevKeys = Array.isArray(booking.invoicedBillingKeys) ? [...booking.invoicedBillingKeys] : [];
        const nextKeys = Array.from(new Set([...prevKeys, ...units.map((unit) => unit.key)]));
        await onUpdateBooking(booking.id, {
          invoiceStatus: 'invoiced',
          invoiceReference: ref || booking.invoiceReference || '',
          invoicedBillingKeys: nextKeys,
          revision: Number(booking.revision || 0) + 1,
        });
      }
      setSelectedKeys([]);
      setInvoiceReference('');
      setMessage(
        `Marked ${selectedUnits.length} trip${selectedUnits.length === 1 ? '' : 's'} invoiced elsewhere. Payment status was not changed.`
      );
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
    const client = invoiceClients.find((row) => row.id === linkClientId);
    if (!client) {
      window.alert('Choose a saved invoice client. Add clients under Invoices if needed.');
      return;
    }
    setBusy(true);
    setMessage('');
    try {
      await onUpdateBooking(booking.id, {
        billingAccountId: client.id,
        billingAccountName: client.name,
        jobKind: booking.jobKind || 'account',
        paymentMethod: booking.paymentMethod || 'account',
        revision: Number(booking.revision || 0) + 1,
      });
      setLinkBookingId(null);
      setLinkClientId('');
      setMessage(`Linked to ${client.name}. Passenger name was left unchanged.`);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not link billing account.');
    } finally {
      setBusy(false);
    }
  };

  const createInvoice = () => {
    if (!selectedClient) {
      setMessage('Select trips for one saved invoice client first.');
      return;
    }
    try {
      const draft = buildAccountInvoiceDraft(selectedClient, selectedUnits);
      onCreateInvoiceDraft(draft);
      setMessage('Opening Invoices with a draft. Save or download there to issue — trips stay unbilled until then.');
      setSelectedKeys([]);
    } catch (err) {
      setMessage(err instanceof Error ? err.message : 'Could not build the invoice draft.');
    }
  };

  const linkBooking = linkBookingId ? bookings.find((b) => b.id === linkBookingId) : null;

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Billing</h2>
        <p className="text-sm text-gray-600 mt-1">
          Select completed account trips for one saved invoice client, then create one draft invoice. Issuing an invoice does not mark trips paid.
        </p>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg p-4 grid grid-cols-1 md:grid-cols-4 gap-3">
        <label className="text-sm text-gray-700">
          Billing client
          <select
            className="form-input mt-1 w-full"
            value={clientFilter}
            onChange={(e) => {
              setClientFilter(e.target.value);
              setSelectedKeys([]);
            }}
          >
            <option value="">All clients</option>
            {invoiceClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
              </option>
            ))}
          </select>
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
          Queue
          <select
            className="form-input mt-1 w-full"
            value={invoiceFilter}
            onChange={(e) => setInvoiceFilter(e.target.value as typeof invoiceFilter)}
          >
            <option value="ready">Ready to invoice</option>
            <option value="blocked">Blocked</option>
            <option value="invoiced">Invoiced</option>
            <option value="all">All account trips</option>
          </select>
        </label>
      </div>

      <div className="flex flex-wrap items-center gap-3 text-sm text-gray-700">
        <span>
          {readyUnits.length} completed trip{readyUnits.length === 1 ? '' : 's'} ready to invoice in this list.
        </span>
        <button type="button" className="text-indigo-700 underline" onClick={selectAllReadyForClient}>
          Select all ready for current client
        </button>
      </div>

      {selectedKeys.length > 0 ? (
        <div className="bg-indigo-50 border border-indigo-200 rounded-lg p-4 space-y-3">
          <p className="text-sm text-gray-800">
            {selectedUnits.length} selected
            {selectedClient ? ` · ${selectedClient.name}` : ''}
            {' · '}
            Running total {formatGbp(runningTotal)}
          </p>
          <div className="flex flex-col lg:flex-row lg:items-end gap-3">
            <button type="button" className="btn-primary" disabled={busy || !selectedClient} onClick={createInvoice}>
              Create invoice from selected trips
            </button>
            <label className="text-sm text-gray-700 flex-1">
              External invoice reference (optional)
              <input
                type="text"
                className="form-input mt-1 w-full"
                value={invoiceReference}
                onChange={(e) => setInvoiceReference(e.target.value)}
                placeholder="e.g. INV-1042"
              />
            </label>
            <button type="button" className="btn" disabled={busy} onClick={() => void markInvoicedElsewhere()}>
              Mark invoiced elsewhere ({selectedUnits.length})
            </button>
            <button type="button" className="btn" onClick={() => setSelectedKeys([])}>
              Clear selection
            </button>
          </div>
          <p className="text-xs text-gray-600">
            Use Mark invoiced elsewhere only when the invoice was raised outside this Invoices screen. Creating a draft does not mark trips invoiced until you issue it.
          </p>
        </div>
      ) : null}

      {message ? <p className="text-sm text-gray-700" role="status">{message}</p> : null}

      {linkBooking ? (
        <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-3">
          <h3 className="text-sm font-semibold text-gray-900">Link billing account</h3>
          <p className="text-xs text-gray-600">
            Match {linkBooking.bookingNumber} to a saved invoice client. Passenger stays separate from the bill to customer.
            {linkBooking.billingAccountName
              ? ` Current legacy name: ${linkBooking.billingAccountName}.`
              : ''}
          </p>
          <select
            className="form-input w-full"
            value={linkClientId}
            onChange={(e) => setLinkClientId(e.target.value)}
          >
            <option value="">Choose saved invoice client</option>
            {invoiceClients.map((client) => (
              <option key={client.id} value={client.id}>
                {client.name}
                {client.invoicePrefix ? ` · ${client.invoicePrefix}` : ''}
              </option>
            ))}
          </select>
          <div className="flex gap-2">
            <button type="button" className="btn-primary" disabled={busy} onClick={() => void saveBillingLink()}>
              Save link
            </button>
            <button
              type="button"
              className="btn"
              onClick={() => {
                setLinkBookingId(null);
                setLinkClientId('');
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
            {filtered.map((row) => {
              const booking = row.booking;
              const id = booking.id || '';
              return (
                <li key={id || booking.bookingNumber} className="px-4 py-3 space-y-2">
                  <div className="flex flex-col lg:flex-row lg:items-start gap-3">
                    <div className="flex-1 min-w-0">
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
                        {' · Bill to '}
                        {row.clientName}
                        {' · Passenger '}
                        {row.passengerName}
                        {' · '}
                        {invoiceStateLabel(booking)}
                        {' · Payment: '}
                        {booking.paymentStatus || 'pending'}
                      </p>
                      {row.ready ? (
                        <ul className="mt-2 space-y-1">
                          {row.units.map((unit) => {
                            const claimed = claimedKeys.has(unit.key) || claimedKeys.has(unit.bookingId);
                            const selectable = !claimed;
                            return (
                              <li key={unit.key} className="flex items-start gap-2 text-xs text-gray-700">
                                {selectable ? (
                                  <input
                                    type="checkbox"
                                    className="mt-0.5"
                                    checked={selectedKeys.includes(unit.key)}
                                    onChange={() => toggleSelected(unit)}
                                    aria-label={`Select ${unit.bookingNumber} ${unit.legLabel}`}
                                  />
                                ) : (
                                  <span className="w-4" />
                                )}
                                <span>
                                  Ready · {unit.legLabel} · {formatGbp(unit.farePounds)}
                                  {unit.receivedPounds > 0 ? ` · recorded payments ${formatGbp(unit.receivedPounds)}` : ''}
                                  {claimed ? ' · already on an issued invoice' : ''}
                                </span>
                              </li>
                            );
                          })}
                        </ul>
                      ) : (
                        <ul className="mt-2 space-y-1">
                          {row.blockedUnits.map((blocked) => (
                            <li key={`${blocked.key}-${blocked.reason}`} className="text-xs text-amber-800">
                              Blocked · {blockReasonLabel(blocked.reason)} — {blocked.detail}
                            </li>
                          ))}
                        </ul>
                      )}
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
                            setLinkClientId(booking.billingAccountId || '');
                          }}
                        >
                          Link client
                        </button>
                      ) : null}
                    </div>
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
