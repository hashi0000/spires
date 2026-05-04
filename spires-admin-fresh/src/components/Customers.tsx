import React, { useMemo, useState, useCallback } from 'react';
import { Search, User, Mail, Phone, MapPin, Calendar, Edit3, GitMerge, ChevronUp, ChevronDown, RotateCcw } from 'lucide-react';
import { Booking } from '../types/types';
import { isCustomerBooking } from '../utils/bookingMapper';
import {
  deriveCustomerProfilesFromBookings,
  CustomerProfileFromBookings,
  type CustomerProfileSource,
} from '../utils/customerProfilesFromBookings';
import { buildBulkContactPatch } from '../utils/customerContactPatch';
import {
  sortCustomerProfiles,
  defaultSortDirForColumn,
  type CustomerSortKey,
  type CustomerSortDir,
} from '../utils/customerProfileSort';

function formatWhen(v: Date | null): string {
  if (!v) return '—';
  if (Number.isNaN(v.getTime())) return '—';
  return v.toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

function sourceLabel(s: CustomerProfileFromBookings['source']): string {
  switch (s) {
    case 'app_uid':
      return 'App account';
    case 'email':
      return 'Email';
    case 'phone':
      return 'Phone';
    default:
      return 'One-off';
  }
}

const SORT_KEY_LABEL: Record<CustomerSortKey, string> = {
  source: 'Source',
  displayName: 'Name',
  email: 'Email',
  phone: 'Phone',
  firstSeen: 'First seen',
  lastSeen: 'Last activity',
  bookingCount: 'Bookings',
};

function SortTh(props: {
  label: string;
  colKey: CustomerSortKey;
  sortKey: CustomerSortKey;
  sortDir: CustomerSortDir;
  onSort: (k: CustomerSortKey) => void;
}) {
  const { label, colKey, sortKey, sortDir, onSort } = props;
  const active = sortKey === colKey;
  return (
    <th
      scope="col"
      aria-sort={active ? (sortDir === 'asc' ? 'ascending' : 'descending') : undefined}
      style={{ padding: '0.5rem 0.65rem', fontWeight: 600, whiteSpace: 'nowrap' }}
    >
      <button
        type="button"
        onClick={() => onSort(colKey)}
        style={{
          background: 'none',
          border: 'none',
          padding: '0.15rem 0',
          margin: 0,
          font: 'inherit',
          fontWeight: 600,
          cursor: 'pointer',
          display: 'inline-flex',
          alignItems: 'center',
          gap: '0.2rem',
          color: active ? '#1d3c74' : '#374151',
          textAlign: 'left',
        }}
        title={`Sort by ${label}`}
      >
        {label}
        {active ? (
          sortDir === 'asc' ? (
            <ChevronUp className="h-4 w-4 shrink-0" aria-hidden />
          ) : (
            <ChevronDown className="h-4 w-4 shrink-0" aria-hidden />
          )
        ) : (
          <span style={{ opacity: 0.25, fontSize: '0.65rem', marginLeft: '0.1rem' }} title="Sort">
            ↕
          </span>
        )}
      </button>
    </th>
  );
}

interface CustomersProps {
  bookings: Booking[];
  onUpdateBooking: (id: string, data: Record<string, unknown>) => Promise<void>;
  onOpenBookingEditor: (booking: Booking) => void;
}

const Customers: React.FC<CustomersProps> = ({ bookings, onUpdateBooking, onOpenBookingEditor }) => {
  const profiles = useMemo(() => deriveCustomerProfilesFromBookings(bookings), [bookings]);
  const [query, setQuery] = useState('');
  const [sourceFilter, setSourceFilter] = useState<'all' | CustomerProfileSource>('all');
  const [sortKey, setSortKey] = useState<CustomerSortKey>('lastSeen');
  const [sortDir, setSortDir] = useState<CustomerSortDir>('desc');
  const [selected, setSelected] = useState<CustomerProfileFromBookings | null>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [mergePrimaryId, setMergePrimaryId] = useState<string | null>(null);
  const [mergeBusy, setMergeBusy] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editEmail, setEditEmail] = useState('');
  const [editBusy, setEditBusy] = useState(false);

  const toggleSelectId = useCallback((id: string) => {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectedProfiles = useMemo(
    () => profiles.filter((p) => selectedIds.includes(p.id)),
    [profiles, selectedIds]
  );

  const filtered = useMemo(() => {
    let list = profiles;
    if (sourceFilter !== 'all') {
      list = list.filter((p) => p.source === sourceFilter);
    }
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((p) => {
      const blob = [
        p.displayName,
        p.email,
        p.phone,
        p.uid || '',
        p.id,
        sourceLabel(p.source),
        ...p.bookings.map((b) => b.bookingNumber),
      ]
        .join(' ')
        .toLowerCase();
      return blob.includes(q);
    });
  }, [profiles, query, sourceFilter]);

  const sortedRows = useMemo(
    () => sortCustomerProfiles(filtered, sortKey, sortDir),
    [filtered, sortKey, sortDir]
  );

  const handleSortClick = useCallback((k: CustomerSortKey) => {
    setSortKey((prev) => {
      if (prev === k) {
        setSortDir((d) => (d === 'asc' ? 'desc' : 'asc'));
        return prev;
      }
      setSortDir(defaultSortDirForColumn(k));
      return k;
    });
  }, []);

  const resetListControls = useCallback(() => {
    setQuery('');
    setSourceFilter('all');
    setSortKey('lastSeen');
    setSortDir('desc');
  }, []);

  const pendingAppBookings = useMemo(
    () => bookings.filter((b) => isCustomerBooking(b) && b.status === 'pending'),
    [bookings]
  );

  const latestAddress = selected?.bookings[0]?.hirerAddress?.trim();

  const openEditContact = () => {
    if (!selected) return;
    setEditName(selected.displayName);
    const ref = selected.bookings[0];
    setEditPhone(ref?.hirerPhone || selected.phone || '');
    setEditEmail(selected.email || (selected.bookings[0] as { hirerEmail?: string }).hirerEmail || '');
    setEditOpen(true);
  };

  const saveEditContact = async () => {
    if (!selected) return;
    setEditBusy(true);
    try {
      for (const b of selected.bookings) {
        if (!b.id) continue;
        const patch = buildBulkContactPatch(editName, editPhone, editEmail, b);
        await onUpdateBooking(b.id, patch);
      }
      setEditOpen(false);
      setSelected(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Update failed');
    } finally {
      setEditBusy(false);
    }
  };

  const openMergeModal = () => {
    if (selectedProfiles.length < 2) return;
    setMergePrimaryId(selectedProfiles[0]?.id ?? null);
    setMergeOpen(true);
  };

  const runMerge = async () => {
    if (!mergePrimaryId || selectedProfiles.length < 2) return;
    const primary = selectedProfiles.find((p) => p.id === mergePrimaryId);
    if (!primary) return;
    const others = selectedProfiles.filter((p) => p.id !== mergePrimaryId);
    const allToUpdate = others.flatMap((p) => p.bookings).filter((b) => b.id);
    if (allToUpdate.length === 0) {
      setMergeOpen(false);
      setSelectedIds([]);
      return;
    }
    setMergeBusy(true);
    try {
      for (const b of allToUpdate) {
        if (!b.id) continue;
        const patch = buildBulkContactPatch(
          primary.displayName,
          primary.bookings[0]?.hirerPhone || primary.phone || b.hirerPhone,
          primary.email,
          b
        );
        await onUpdateBooking(b.id, patch);
      }
      setMergeOpen(false);
      setSelectedIds([]);
      setSelected(null);
    } catch (err) {
      window.alert(err instanceof Error ? err.message : 'Merge failed');
    } finally {
      setMergeBusy(false);
    }
  };

  return (
    <div>
      <div className="card">
        <div className="card-header" style={{ flexWrap: 'wrap', gap: '0.75rem' }}>
          <h2 className="card-title">Customers</h2>
          {selectedIds.length >= 2 && (
            <button type="button" className="btn btn-primary btn-sm" onClick={openMergeModal}>
              <GitMerge className="h-4 w-4" style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
              Merge {selectedIds.length} profiles…
            </button>
          )}
        </div>
        <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#4b5563' }}>
          Profiles come from <strong>bookings</strong> (uid → email → phone). <strong>Click column headers</strong> to
          sort (source order: App → Email → Phone → One-off). Filter by source, then tick rows to{' '}
          <strong>Merge</strong> when the same person split across rows. Open a row to edit contacts for the whole group
          or edit a single booking in the full editor.
        </p>

        {pendingAppBookings.length > 0 && (
          <div className="alert alert-warning" style={{ marginBottom: '1rem' }}>
            <Calendar className="h-5 w-5" />
            <div>
              <strong style={{ fontSize: '0.875rem' }}>{pendingAppBookings.length} pending app booking(s)</strong>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8125rem' }}>
                Confirm these in Bookings. They appear here once saved.
              </p>
              <ul style={{ margin: '0.5rem 0 0', paddingLeft: '1.25rem', fontSize: '0.8125rem' }}>
                {pendingAppBookings.slice(0, 8).map((b) => (
                  <li key={b.id}>
                    <strong>{b.bookingNumber}</strong> — {b.hirerName}
                    {b.pickupTime ? ` · ${new Date(b.pickupTime).toLocaleString('en-GB')}` : ''}
                  </li>
                ))}
              </ul>
              {pendingAppBookings.length > 8 && (
                <p style={{ margin: '0.35rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}>
                  And {pendingAppBookings.length - 8} more — filter Bookings by source.
                </p>
              )}
            </div>
          </div>
        )}

        <div
          style={{
            marginBottom: '1rem',
            display: 'flex',
            gap: '0.75rem',
            alignItems: 'center',
            flexWrap: 'wrap',
            justifyContent: 'space-between',
          }}
        >
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', flex: '1 1 280px' }}>
            <Search className="h-4 w-4 shrink-0" style={{ color: '#6b7280' }} />
            <input
              type="search"
              placeholder="Search name, email, phone, booking ref, source…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="w-full max-w-md px-3 py-2 border border-gray-300 rounded-md text-sm"
              aria-label="Search customers"
            />
          </div>
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.35rem', fontSize: '0.8125rem', color: '#374151' }}>
              <span>Source</span>
              <select
                value={sourceFilter}
                onChange={(e) => setSourceFilter(e.target.value as 'all' | CustomerProfileSource)}
                className="px-2 py-1.5 border border-gray-300 rounded-md text-sm"
                aria-label="Filter by source"
              >
                <option value="all">All sources</option>
                <option value="app_uid">App account</option>
                <option value="email">Email</option>
                <option value="phone">Phone</option>
                <option value="single_booking">One-off</option>
              </select>
            </label>
            <button type="button" className="btn btn-secondary btn-sm" onClick={resetListControls} title="Clear search, source filter, and sort">
              <RotateCcw className="h-4 w-4" style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
              Reset
            </button>
          </div>
        </div>

        {sortedRows.length === 0 ? (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            {profiles.length === 0 ? 'No bookings yet — add bookings to see customer profiles here.' : 'No matches.'}
          </p>
        ) : (
          <p style={{ margin: '0 0 0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}>
            Showing <strong>{sortedRows.length}</strong> profile{sortedRows.length !== 1 ? 's' : ''}
            {sourceFilter !== 'all' || query.trim() ? ' (filtered)' : ''}
            {' · '}
            sort: <strong>{SORT_KEY_LABEL[sortKey]}</strong> (
            {sortDir === 'asc' ? 'ascending · A→Z / oldest first' : 'descending · Z→A / newest first'})
          </p>
        )}

        {sortedRows.length > 0 && (
          <div style={{ overflowX: 'auto', border: '1px solid #e5e7eb', borderRadius: '8px' }}>
            <table className="w-full text-sm" style={{ borderCollapse: 'collapse', minWidth: '680px' }}>
              <thead>
                <tr style={{ background: '#f9fafb', textAlign: 'left' }}>
                  <th style={{ padding: '0.65rem 0.5rem', width: '44px' }} aria-label="Select" />
                  <SortTh label="Source" colKey="source" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                  <SortTh label="Name" colKey="displayName" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                  <SortTh label="Email" colKey="email" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                  <SortTh label="Phone" colKey="phone" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                  <SortTh label="First seen" colKey="firstSeen" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                  <SortTh label="Last activity" colKey="lastSeen" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                  <SortTh label="Bookings" colKey="bookingCount" sortKey={sortKey} sortDir={sortDir} onSort={handleSortClick} />
                </tr>
              </thead>
              <tbody>
                {sortedRows.map((p) => (
                  <tr
                    key={p.id}
                    onClick={(e) => {
                      if ((e.target as HTMLElement).closest('[data-profile-checkbox]')) return;
                      setSelected(p);
                    }}
                    style={{
                      borderTop: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      background: selected?.id === p.id ? '#eff6ff' : undefined,
                    }}
                  >
                    <td
                      data-profile-checkbox
                      style={{ padding: '0.5rem', verticalAlign: 'middle' }}
                      onClick={(e) => e.stopPropagation()}
                    >
                      <input
                        type="checkbox"
                        checked={selectedIds.includes(p.id)}
                        onChange={() => toggleSelectId(p.id)}
                        aria-label={`Select ${p.displayName}`}
                        onClick={(e) => e.stopPropagation()}
                      />
                    </td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{sourceLabel(p.source)}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{p.displayName}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{p.email || '—'}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{p.phone || '—'}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{formatWhen(p.firstSeen)}</td>
                    <td style={{ padding: '0.6rem 0.75rem', whiteSpace: 'nowrap' }}>{formatWhen(p.lastSeen)}</td>
                    <td style={{ padding: '0.6rem 0.75rem' }}>{p.bookingCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {mergeOpen && selectedProfiles.length >= 2 && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="merge-title"
          onClick={() => !mergeBusy && setMergeOpen(false)}
          style={{ zIndex: 1100 }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '520px' }}>
            <div className="modal-body">
              <h2 id="merge-title" style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#0b1c3d' }}>
                Merge customer profiles
              </h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.875rem', color: '#4b5563' }}>
                All bookings in the <strong>other</strong> selected rows will get the same name, phone, and email as
                the <strong>primary</strong> row (so they group together). App user ids are not changed.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.65rem', marginBottom: '1.25rem' }}>
                {selectedProfiles.map((p) => (
                  <label
                    key={p.id}
                    style={{
                      display: 'flex',
                      gap: '0.5rem',
                      alignItems: 'flex-start',
                      padding: '0.65rem',
                      border: '1px solid #e5e7eb',
                      borderRadius: '8px',
                      cursor: 'pointer',
                      background: mergePrimaryId === p.id ? '#eff6ff' : '#fff',
                    }}
                  >
                    <input
                      type="radio"
                      name="mergePrimary"
                      checked={mergePrimaryId === p.id}
                      onChange={() => setMergePrimaryId(p.id)}
                    />
                    <span style={{ fontSize: '0.875rem' }}>
                      <strong>{p.displayName}</strong> · {p.phone || 'no phone'} · {p.bookingCount} booking(s)
                      {p.email ? ` · ${p.email}` : ''}
                    </span>
                  </label>
                ))}
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={mergeBusy} onClick={() => setMergeOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={mergeBusy || !mergePrimaryId} onClick={() => void runMerge()}>
                  {mergeBusy ? 'Merging…' : 'Apply merge'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {editOpen && selected && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="edit-contact-title"
          onClick={() => !editBusy && setEditOpen(false)}
          style={{ zIndex: 1100 }}
        >
          <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '480px' }}>
            <div className="modal-body">
              <h2 id="edit-contact-title" style={{ margin: '0 0 0.75rem', fontSize: '1.15rem', color: '#0b1c3d' }}>
                Edit contact (all {selected.bookingCount} bookings)
              </h2>
              <p style={{ margin: '0 0 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                Updates hirer name/phone (and email when filled) on every booking in this group. Customer-app bookings
                also get <code>name</code> / <code>phone</code> where applicable.
              </p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: '0.75rem' }}>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={editName}
                    onChange={(e) => setEditName(e.target.value)}
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Phone</label>
                  <input
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={editPhone}
                    onChange={(e) => setEditPhone(e.target.value)}
                    placeholder="Use one consistent format (e.g. 07776 897772)"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Email (optional)</label>
                  <input
                    type="email"
                    className="w-full px-3 py-2 border border-gray-300 rounded-md text-sm"
                    value={editEmail}
                    onChange={(e) => setEditEmail(e.target.value)}
                    placeholder="Leave blank to leave existing emails unchanged"
                  />
                </div>
              </div>
              <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end', marginTop: '1.25rem' }}>
                <button type="button" className="btn btn-secondary btn-sm" disabled={editBusy} onClick={() => setEditOpen(false)}>
                  Cancel
                </button>
                <button type="button" className="btn btn-primary btn-sm" disabled={editBusy} onClick={() => void saveEditContact()}>
                  {editBusy ? 'Saving…' : 'Save to all bookings'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {selected && (
        <div
          className="modal-overlay"
          role="dialog"
          aria-modal="true"
          aria-labelledby="customer-profile-title"
          onClick={() => setSelected(null)}
          style={{ zIndex: 1000 }}
        >
          <div
            className="modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: '640px' }}
          >
            <div className="modal-body">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: '1rem', flexWrap: 'wrap' }}>
                <h2 id="customer-profile-title" style={{ margin: 0, fontSize: '1.25rem', color: '#0b1c3d' }}>
                  {selected.displayName}
                </h2>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button type="button" className="btn btn-primary btn-sm" onClick={openEditContact}>
                    <Edit3 className="h-4 w-4" style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                    Edit contact (all)
                  </button>
                  <button type="button" className="btn btn-secondary btn-sm" onClick={() => setSelected(null)}>
                    Close
                  </button>
                </div>
              </div>
              <p style={{ margin: '0.35rem 0 1rem', fontSize: '0.8125rem', color: '#6b7280' }}>
                Grouped by: <strong>{sourceLabel(selected.source)}</strong>
                {selected.uid ? (
                  <>
                    {' '}
                    · App uid: <code style={{ fontSize: '0.75rem' }}>{selected.uid}</code>
                  </>
                ) : null}
              </p>

              <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1.25rem' }}>
                <div className="flex items-start gap-2 text-sm">
                  <Mail className="h-4 w-4 shrink-0" style={{ marginTop: '2px', color: '#1d3c74' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#374151' }}>Email (from bookings)</div>
                    <div>{selected.email || '—'}</div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <Phone className="h-4 w-4 shrink-0" style={{ marginTop: '2px', color: '#1d3c74' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#374151' }}>Phone</div>
                    <div>{selected.phone || '—'}</div>
                  </div>
                </div>
                {latestAddress ? (
                  <div className="flex items-start gap-2 text-sm">
                    <MapPin className="h-4 w-4 shrink-0" style={{ marginTop: '2px', color: '#1d3c74' }} />
                    <div>
                      <div style={{ fontWeight: 600, color: '#374151' }}>Address (latest booking)</div>
                      <div>{latestAddress}</div>
                    </div>
                  </div>
                ) : null}
                <div className="flex items-start gap-2 text-sm">
                  <Calendar className="h-4 w-4 shrink-0" style={{ marginTop: '2px', color: '#1d3c74' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#374151' }}>First / last booking record</div>
                    <div>
                      {formatWhen(selected.firstSeen)} → {formatWhen(selected.lastSeen)}
                    </div>
                  </div>
                </div>
                <div className="flex items-start gap-2 text-sm">
                  <User className="h-4 w-4 shrink-0" style={{ marginTop: '2px', color: '#1d3c74' }} />
                  <div>
                    <div style={{ fontWeight: 600, color: '#374151' }}>Total bookings in this group</div>
                    <div>{selected.bookingCount}</div>
                  </div>
                </div>
              </div>

              <h3 style={{ fontSize: '0.95rem', margin: '0 0 0.5rem', color: '#0b1c3d' }}>Bookings</h3>
              <ul
                style={{
                  margin: 0,
                  paddingLeft: 0,
                  listStyle: 'none',
                  fontSize: '0.875rem',
                  maxHeight: '320px',
                  overflowY: 'auto',
                }}
              >
                {selected.bookings.map((b) => (
                  <li
                    key={b.id}
                    style={{
                      marginBottom: '0.65rem',
                      paddingBottom: '0.65rem',
                      borderBottom: '1px solid #f3f4f6',
                      display: 'flex',
                      gap: '0.75rem',
                      alignItems: 'flex-start',
                      flexWrap: 'wrap',
                    }}
                  >
                    <div style={{ flex: '1 1 200px', minWidth: 0 }}>
                      <strong>{b.bookingNumber}</strong> — {b.status}
                      {b.paymentStatus ? ` · ${b.paymentStatus}` : ''}
                      {b.pickupTime ? ` · ${new Date(b.pickupTime).toLocaleString('en-GB')}` : ''}
                      <div style={{ color: '#6b7280', fontSize: '0.8125rem' }}>
                        {b.pickupLocation} → {b.destination}
                      </div>
                    </div>
                    <button
                      type="button"
                      className="btn btn-primary btn-sm shrink-0"
                      onClick={() => {
                        onOpenBookingEditor(b);
                        setSelected(null);
                      }}
                    >
                      <Edit3 className="h-4 w-4" style={{ marginRight: '0.25rem', verticalAlign: 'middle' }} />
                      Edit booking
                    </button>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Customers;
