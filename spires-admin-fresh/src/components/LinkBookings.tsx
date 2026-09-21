// LinkBookings.tsx - Manual linking tool for connecting bookings to customers
import React, { useState, useEffect } from 'react';
import { auth } from '../utils/firebase';
import { searchCustomers, searchBookings, linkBookingsToCustomer, getLinkedBookings, getCustomerById } from '../utils/linkBookingsHelpers';
import { Customer, Booking } from '../types/types';

const LinkBookings: React.FC = () => {
  const [customerSearchTerm, setCustomerSearchTerm] = useState('');
  const [customerSearchResults, setCustomerSearchResults] = useState<Customer[]>([]);
  const [selectedCustomer, setSelectedCustomer] = useState<Customer | null>(null);
  const [customerSearchLoading, setCustomerSearchLoading] = useState(false);
  const [customerSearchError, setCustomerSearchError] = useState('');

  const [bookingSearchEmail, setBookingSearchEmail] = useState('');
  const [bookingSearchPhone, setBookingSearchPhone] = useState('');
  const [bookingSearchRef, setBookingSearchRef] = useState('');
  const [bookingSearchResults, setBookingSearchResults] = useState<Booking[]>([]);
  const [selectedBookingIds, setSelectedBookingIds] = useState<Set<string>>(new Set());
  const [bookingSearchLoading, setBookingSearchLoading] = useState(false);
  const [bookingSearchError, setBookingSearchError] = useState('');

  const [linking, setLinking] = useState(false);
  const [linkSuccess, setLinkSuccess] = useState('');
  const [linkError, setLinkError] = useState('');
  const [showConfirmModal, setShowConfirmModal] = useState(false);

  // Linked bookings view
  const [linkedBookings, setLinkedBookings] = useState<Booking[]>([]);
  const [linkedBookingsLoading, setLinkedBookingsLoading] = useState(false);
  const [linkedBookingsError, setLinkedBookingsError] = useState('');
  const [customerMap, setCustomerMap] = useState<Map<string, Customer>>(new Map());
  const [showLinkedBookings, setShowLinkedBookings] = useState(false);

  // Search customers when search term changes (debounced)
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (customerSearchTerm.trim().length >= 2) {
        handleCustomerSearch();
      } else {
        setCustomerSearchResults([]);
      }
    }, 500);

    return () => clearTimeout(timeoutId);
    // Debounced search on the current term only.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customerSearchTerm]);

  const handleCustomerSearch = async () => {
    if (!customerSearchTerm.trim()) {
      setCustomerSearchResults([]);
      return;
    }

    setCustomerSearchLoading(true);
    setCustomerSearchError('');

    try {
      const results = await searchCustomers(customerSearchTerm);
      setCustomerSearchResults(results);
    } catch (error: any) {
      setCustomerSearchError(error.message || 'Failed to search customers');
      setCustomerSearchResults([]);
    } finally {
      setCustomerSearchLoading(false);
    }
  };

  const handleSelectCustomer = (customer: Customer) => {
    setSelectedCustomer(customer);
    setCustomerSearchTerm('');
    setCustomerSearchResults([]);
    // Clear booking selections when customer changes
    setSelectedBookingIds(new Set());
    setBookingSearchResults([]);
  };

  const handleBookingSearch = async () => {
    if (!bookingSearchEmail.trim() && !bookingSearchPhone.trim() && !bookingSearchRef.trim()) {
      setBookingSearchError('Please enter at least one search criteria (email, phone, or booking reference)');
      return;
    }

    setBookingSearchLoading(true);
    setBookingSearchError('');
    setSelectedBookingIds(new Set());

    try {
      const results = await searchBookings({
        email: bookingSearchEmail.trim() || undefined,
        phone: bookingSearchPhone.trim() || undefined,
        bookingRef: bookingSearchRef.trim() || undefined,
      });
      setBookingSearchResults(results);
      if (results.length === 0) {
        setBookingSearchError('No bookings found matching the search criteria');
      }
    } catch (error: any) {
      setBookingSearchError(error.message || 'Failed to search bookings');
      setBookingSearchResults([]);
    } finally {
      setBookingSearchLoading(false);
    }
  };

  const handleToggleBookingSelection = (bookingId: string) => {
    const newSelection = new Set(selectedBookingIds);
    if (newSelection.has(bookingId)) {
      newSelection.delete(bookingId);
    } else {
      newSelection.add(bookingId);
    }
    setSelectedBookingIds(newSelection);
  };

  const handleLinkBookings = async () => {
    if (!selectedCustomer) {
      setLinkError('Please select a customer first');
      return;
    }

    if (selectedBookingIds.size === 0) {
      setLinkError('Please select at least one booking to link');
      return;
    }

    // Check for bookings already linked to different customers
    const alreadyLinkedBookings = bookingSearchResults.filter(
      (b) => b.id && b.customerId && b.customerId !== selectedCustomer.id && selectedBookingIds.has(b.id!)
    );

    if (alreadyLinkedBookings.length > 0) {
      const confirmMessage = `${alreadyLinkedBookings.length} booking(s) are already linked to different customers. Do you want to relink them to this customer?`;
      if (!window.confirm(confirmMessage)) {
        return;
      }
    }

    setShowConfirmModal(true);
  };

  const confirmLinkBookings = async () => {
    if (!selectedCustomer) return;

    setLinking(true);
    setLinkError('');
    setLinkSuccess('');
    setShowConfirmModal(false);

    const user = auth.currentUser;
    const linkedBy = user?.email || user?.uid || 'unknown';

    try {
      const bookingIds = Array.from(selectedBookingIds);
      const result = await linkBookingsToCustomer(bookingIds, selectedCustomer.id, linkedBy);

      if (result.success > 0) {
        setLinkSuccess(`Successfully linked ${result.success} booking(s) to ${selectedCustomer.firstName} ${selectedCustomer.lastName}`);
        
        // Update local state to reflect the new customerId
        setBookingSearchResults((prev) =>
          prev.map((b) =>
            selectedBookingIds.has(b.id!) ? { ...b, customerId: selectedCustomer.id } : b
          )
        );

        // Clear selections
        setSelectedBookingIds(new Set());

        // Refresh linked bookings view if it's open
        if (showLinkedBookings) {
          loadLinkedBookings();
        }
      }

      if (result.failed > 0) {
        setLinkError(`Failed to link ${result.failed} booking(s). ${result.errors.join('; ')}`);
      }
    } catch (error: any) {
      setLinkError(error.message || 'Failed to link bookings');
    } finally {
      setLinking(false);
    }
  };

  const loadLinkedBookings = async () => {
    setLinkedBookingsLoading(true);
    setLinkedBookingsError('');

    try {
      const bookings = await getLinkedBookings(200);
      setLinkedBookings(bookings);

      // Fetch customer info for all linked bookings
      const customerIds = new Set<string>();
      bookings.forEach(booking => {
        if (booking.customerId) {
          customerIds.add(booking.customerId);
        }
      });

      const customerData = new Map<string, Customer>();
      for (const customerId of Array.from(customerIds)) {
        const customer = await getCustomerById(customerId);
        if (customer) {
          customerData.set(customerId, customer);
        }
      }
      setCustomerMap(customerData);
    } catch (error: any) {
      setLinkedBookingsError(error.message || 'Failed to load linked bookings');
    } finally {
      setLinkedBookingsLoading(false);
    }
  };

  const formatDate = (date: string | Date | undefined) => {
    if (!date) return 'N/A';
    try {
      const d = typeof date === 'string' ? new Date(date) : date;
      return d.toLocaleDateString('en-GB', {
        day: '2-digit',
        month: 'short',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
      });
    } catch {
      return 'Invalid date';
    }
  };

  return (
    <div className="link-bookings-container">
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Link Bookings to Customers</h2>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            Manually link bookings to customer profiles. No changes are made until you click the link button.
          </p>
        </div>

        {/* View Linked Bookings Section */}
        <div style={{ marginBottom: '2rem', paddingBottom: '2rem', borderBottom: '2px solid #e5e7eb' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#0b1c3d', margin: 0 }}>
              View Linked Bookings
            </h3>
            <button
              className="btn btn-secondary"
              onClick={() => {
                if (!showLinkedBookings) {
                  loadLinkedBookings();
                }
                setShowLinkedBookings(!showLinkedBookings);
              }}
            >
              {showLinkedBookings ? 'Hide' : 'Show'} Linked Bookings
            </button>
          </div>
          <p style={{ fontSize: '0.875rem', color: '#6b7280', margin: 0 }}>
            View all bookings that are already linked to customers to double-check allocations.
          </p>

          {showLinkedBookings && (
            <div style={{ marginTop: '1rem' }}>
              {linkedBookingsLoading && (
                <p style={{ fontSize: '0.875rem', color: '#6b7280' }}>Loading linked bookings...</p>
              )}
              {linkedBookingsError && (
                <div className="alert alert-error">
                  {linkedBookingsError}
                </div>
              )}
              {!linkedBookingsLoading && !linkedBookingsError && linkedBookings.length === 0 && (
                <div className="alert alert-info">
                  No bookings are currently linked to customers.
                </div>
              )}
              {!linkedBookingsLoading && !linkedBookingsError && linkedBookings.length > 0 && (
                <div style={{ 
                  border: '1px solid #e5e7eb', 
                  borderRadius: '8px', 
                  maxHeight: '600px', 
                  overflowY: 'auto',
                  backgroundColor: '#fff'
                }}>
                  <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                    <thead style={{ backgroundColor: '#f7f9fc', position: 'sticky', top: 0, zIndex: 10 }}>
                      <tr>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Booking Ref</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Date/Time</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Customer</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Email</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Phone</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Pickup → Destination</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Status</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Linked At</th>
                        <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Linked By</th>
                      </tr>
                    </thead>
                    <tbody>
                      {linkedBookings.map((booking) => {
                        const customer = booking.customerId ? customerMap.get(booking.customerId) : null;
                        return (
                          <tr
                            key={booking.id}
                            style={{
                              borderBottom: '1px solid #e5e7eb',
                            }}
                          >
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{booking.bookingNumber}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{formatDate(booking.pickupTime || booking.dateTime)}</td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {customer ? (
                                <div>
                                  <div style={{ fontWeight: 500 }}>{customer.firstName} {customer.lastName}</div>
                                  <div style={{ fontSize: '0.75rem', color: '#6b7280' }}>ID: {booking.customerId?.slice(0, 8)}...</div>
                                </div>
                              ) : (
                                <span style={{ color: '#6b7280' }}>Loading...</span>
                              )}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {customer?.email || (booking as any).email || 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {customer?.phone || booking.hirerPhone || 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {booking.pickupLocation} → {booking.destination}
                            </td>
                            <td style={{ padding: '0.75rem' }}>
                              <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                              {booking.linkedAt ? formatDate(booking.linkedAt) : 'N/A'}
                            </td>
                            <td style={{ padding: '0.75rem', fontSize: '0.875rem', color: '#6b7280' }}>
                              {booking.linkedBy || 'N/A'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Customer Selection Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#0b1c3d' }}>
            1. Select Customer
          </h3>
          <div className="form-group">
            <label className="form-label">Search Customer (by name, email, or phone)</label>
            <input
              type="text"
              className="form-input"
              placeholder="Type to search..."
              value={customerSearchTerm}
              onChange={(e) => setCustomerSearchTerm(e.target.value)}
            />
            {customerSearchLoading && <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>Searching...</p>}
            {customerSearchError && (
              <div className="alert alert-error" style={{ marginTop: '0.5rem' }}>
                {customerSearchError}
              </div>
            )}
          </div>

          {/* Customer Search Results */}
          {customerSearchResults.length > 0 && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{ 
                border: '1px solid #e5e7eb', 
                borderRadius: '8px', 
                maxHeight: '300px', 
                overflowY: 'auto',
                backgroundColor: '#fff'
              }}>
                {customerSearchResults.map((customer) => (
                  <div
                    key={customer.id}
                    onClick={() => handleSelectCustomer(customer)}
                    style={{
                      padding: '1rem',
                      borderBottom: '1px solid #e5e7eb',
                      cursor: 'pointer',
                      transition: 'background-color 0.2s',
                      backgroundColor: selectedCustomer?.id === customer.id ? '#f0f7ff' : '#fff',
                    }}
                    onMouseEnter={(e) => {
                      if (selectedCustomer?.id !== customer.id) {
                        e.currentTarget.style.backgroundColor = '#f7f9fc';
                      }
                    }}
                    onMouseLeave={(e) => {
                      if (selectedCustomer?.id !== customer.id) {
                        e.currentTarget.style.backgroundColor = '#fff';
                      }
                    }}
                  >
                    <div style={{ fontWeight: 600, color: '#0b1c3d' }}>
                      {customer.firstName} {customer.lastName}
                    </div>
                    <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                      {customer.email} • {customer.phone}
                    </div>
                    {selectedCustomer?.id === customer.id && (
                      <div style={{ fontSize: '0.75rem', color: '#1d3c74', marginTop: '0.5rem', fontWeight: 500 }}>
                        ✓ Selected
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Selected Customer Display */}
          {selectedCustomer && (
            <div style={{
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#f0f7ff',
              borderRadius: '8px',
              border: '1px solid #1d3c74',
            }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontWeight: 600, color: '#0b1c3d', marginBottom: '0.5rem' }}>
                    Selected Customer
                  </div>
                  <div style={{ fontSize: '0.95rem', color: '#0b1c3d' }}>
                    <strong>{selectedCustomer.firstName} {selectedCustomer.lastName}</strong>
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.25rem' }}>
                    Email: {selectedCustomer.email}
                  </div>
                  <div style={{ fontSize: '0.875rem', color: '#6b7280' }}>
                    Phone: {selectedCustomer.phone}
                  </div>
                  <div style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
                    Customer ID: {selectedCustomer.id}
                  </div>
                </div>
                <button
                  className="btn btn-secondary btn-sm"
                  onClick={() => {
                    setSelectedCustomer(null);
                    setSelectedBookingIds(new Set());
                    setBookingSearchResults([]);
                  }}
                >
                  Clear
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Booking Search Section */}
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#0b1c3d' }}>
            2. Search Bookings
          </h3>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '1rem', marginBottom: '1rem' }}>
            <div className="form-group">
              <label className="form-label">Email</label>
              <input
                type="email"
                className="form-input"
                placeholder="customer@example.com"
                value={bookingSearchEmail}
                onChange={(e) => setBookingSearchEmail(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Phone</label>
              <input
                type="tel"
                className="form-input"
                placeholder="+44 123 456 7890"
                value={bookingSearchPhone}
                onChange={(e) => setBookingSearchPhone(e.target.value)}
              />
            </div>
            <div className="form-group">
              <label className="form-label">Booking Reference</label>
              <input
                type="text"
                className="form-input"
                placeholder="SP123456"
                value={bookingSearchRef}
                onChange={(e) => setBookingSearchRef(e.target.value.toUpperCase())}
              />
            </div>
          </div>
          <button
            className="btn btn-primary"
            onClick={handleBookingSearch}
            disabled={bookingSearchLoading}
          >
            {bookingSearchLoading ? 'Searching...' : 'Search Bookings'}
          </button>
          {bookingSearchError && (
            <div className="alert alert-error" style={{ marginTop: '1rem' }}>
              {bookingSearchError}
            </div>
          )}
        </div>

        {/* Booking Results Section */}
        {bookingSearchResults.length > 0 && (
          <div style={{ marginBottom: '2rem' }}>
            <h3 style={{ fontSize: '1.125rem', fontWeight: 600, marginBottom: '1rem', color: '#0b1c3d' }}>
              3. Select Bookings to Link ({selectedBookingIds.size} selected)
            </h3>
            <div style={{ 
              border: '1px solid #e5e7eb', 
              borderRadius: '8px', 
              maxHeight: '500px', 
              overflowY: 'auto',
              backgroundColor: '#fff'
            }}>
              <table style={{ width: '100%', borderCollapse: 'collapse' }}>
                <thead style={{ backgroundColor: '#f7f9fc', position: 'sticky', top: 0, zIndex: 10 }}>
                  <tr>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>
                      <input
                        type="checkbox"
                        checked={selectedBookingIds.size === bookingSearchResults.length && bookingSearchResults.length > 0}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedBookingIds(new Set(bookingSearchResults.map(b => b.id!).filter(Boolean)));
                          } else {
                            setSelectedBookingIds(new Set());
                          }
                        }}
                        style={{ marginRight: '0.5rem' }}
                      />
                      Select All
                    </th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Booking Ref</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Date/Time</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Name</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Email</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Phone</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Pickup → Destination</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Status</th>
                    <th style={{ padding: '0.75rem', textAlign: 'left', fontSize: '0.875rem', fontWeight: 600, borderBottom: '2px solid #e5e7eb' }}>Linked To</th>
                  </tr>
                </thead>
                <tbody>
                  {bookingSearchResults.map((booking) => {
                    const isSelected = booking.id ? selectedBookingIds.has(booking.id) : false;
                    const isAlreadyLinked = booking.customerId && booking.customerId !== selectedCustomer?.id;
                    return (
                      <tr
                        key={booking.id}
                        style={{
                          backgroundColor: isSelected ? '#f0f7ff' : '#fff',
                          borderBottom: '1px solid #e5e7eb',
                        }}
                      >
                        <td style={{ padding: '0.75rem' }}>
                          <input
                            type="checkbox"
                            checked={isSelected}
                            onChange={() => booking.id && handleToggleBookingSelection(booking.id)}
                          />
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{booking.bookingNumber}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{formatDate(booking.pickupTime || booking.dateTime)}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{booking.hirerName}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{(booking as any).email || 'N/A'}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>{booking.hirerPhone}</td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                          {booking.pickupLocation} → {booking.destination}
                        </td>
                        <td style={{ padding: '0.75rem' }}>
                          <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                        </td>
                        <td style={{ padding: '0.75rem', fontSize: '0.875rem' }}>
                          {booking.customerId ? (
                            <span style={{ 
                              color: isAlreadyLinked ? '#dc2626' : '#16a34a',
                              fontWeight: 500 
                            }}>
                              {isAlreadyLinked ? `⚠️ ${booking.customerId.slice(0, 8)}...` : `✓ ${booking.customerId.slice(0, 8)}...`}
                            </span>
                          ) : (
                            <span style={{ color: '#6b7280' }}>Not linked</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* Link Button */}
        {selectedCustomer && selectedBookingIds.size > 0 && (
          <div>
            <button
              className="btn btn-success"
              onClick={handleLinkBookings}
              disabled={linking}
              style={{ fontSize: '1rem', padding: '0.75rem 2rem' }}
            >
              {linking ? 'Linking...' : `Link ${selectedBookingIds.size} Selected Booking(s) to Customer`}
            </button>
          </div>
        )}

        {/* Success/Error Messages */}
        {linkSuccess && (
          <div className="alert alert-success" style={{ marginTop: '1rem' }}>
            {linkSuccess}
          </div>
        )}
        {linkError && (
          <div className="alert alert-error" style={{ marginTop: '1rem' }}>
            {linkError}
          </div>
        )}

        {/* Confirmation Modal */}
        {showConfirmModal && (
          <div className="modal-overlay" onClick={() => setShowConfirmModal(false)}>
            <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: '500px' }}>
              <div className="modal-header">
                <h3 className="modal-title">Confirm Link Bookings</h3>
              </div>
              <div className="modal-body">
                <p>
                  Are you sure you want to link <strong>{selectedBookingIds.size}</strong> booking(s) to{' '}
                  <strong>{selectedCustomer?.firstName} {selectedCustomer?.lastName}</strong>?
                </p>
                <p style={{ fontSize: '0.875rem', color: '#6b7280', marginTop: '0.5rem' }}>
                  This action will update the customerId field on the selected bookings.
                </p>
              </div>
              <div className="modal-footer">
                <button
                  className="btn btn-secondary"
                  onClick={() => setShowConfirmModal(false)}
                >
                  Cancel
                </button>
                <button
                  className="btn btn-primary"
                  onClick={confirmLinkBookings}
                >
                  Confirm Link
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default LinkBookings;

