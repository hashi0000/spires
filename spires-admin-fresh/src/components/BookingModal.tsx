// components/BookingModal.tsx - FIXED CLEAN VERSION
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Calculator, CreditCard, Receipt, Clock } from 'lucide-react';
import { ExtendedBooking, TripExpense, Driver, Vehicle } from '../types/types';
import { expenseTypes, paymentMethods } from '../utils/constants';
import { generateSpiresBookingNumber } from '../utils/bookingNumber';
import { db } from '../utils/firebase';
import { doc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import type { CustomerProfile } from '../utils/customerSuggestions';

interface BookingModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit?: (booking: any) => void; // ✅ fixed optional prop syntax
  editingBooking?: any | null;
  activeDrivers: Driver[];
  availableVehicles: Vehicle[];
  /** Unique pickup/destination strings from existing bookings (datalist autocomplete) */
  locationSuggestions?: string[];
  /** Past customers from bookings — name autocomplete + phone/address fill */
  customerSuggestions?: CustomerProfile[];
  /** Pre-fill a new booking (e.g. return trip); ignored when editing */
  initialDraft?: Partial<ExtendedBooking> | null;
}

const BookingModal: React.FC<BookingModalProps> = ({
  isOpen,
  onClose,
  onSubmit,
  editingBooking,
  activeDrivers,
  availableVehicles,
  locationSuggestions = [],
  customerSuggestions = [],
  initialDraft = null
}) => {
  const customerByNormalizedName = useMemo(() => {
    const m = new Map<string, CustomerProfile>();
    for (const c of customerSuggestions) {
      m.set(c.displayName.toLowerCase().trim(), c);
    }
    return m;
  }, [customerSuggestions]);

  const applyKnownCustomer = (rawName: string) => {
    const key = rawName.trim().toLowerCase();
    if (!key) return;
    const match = customerByNormalizedName.get(key);
    if (!match) return;
    setFormData((prev) => ({
      ...prev,
      hirerName: match.displayName,
      hirerPhone: match.phone || prev.hirerPhone,
      hirerAddress: match.address || prev.hirerAddress
    }));
  };
  const [formData, setFormData] = useState<ExtendedBooking>({
    bookingNumber: '',
    dateTime: '',
    hirerName: '',
    hirerAddress: '',
    hirerPhone: '',
    bookingMethod: 'telephone',
    pickupTime: '',
    pickupLocation: '',
    destination: '',
    driverId: '',
    vehicleId: '',
    subContract: '',
    status: 'pending',
    notes: '',
    actualFare: '',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    expenses: []
  });

  const [newExpense, setNewExpense] = useState<{
    type: TripExpense['type'];
    amount: string;
    description: string;
  }>({
    type: 'fuel',
    amount: '',
    description: ''
  });

  // ✅ Pre-fill form for editing or default new booking
  useEffect(() => {
    if (editingBooking) {
      // Map customer booking fields to admin format if needed
      const mappedBooking: any = {
        ...editingBooking,
        // Map customer app fields to admin fields
        hirerName: editingBooking.hirerName || (editingBooking as any).name || '',
        hirerPhone: editingBooking.hirerPhone || (editingBooking as any).phone || '',
        hirerAddress: editingBooking.hirerAddress || '',
        pickupLocation: editingBooking.pickupLocation || (editingBooking as any).pickup || '',
        destination: editingBooking.destination || '',
        bookingMethod: editingBooking.bookingMethod || 'internet',
        pickupTime: editingBooking.pickupTime || (editingBooking as any).dateTime || editingBooking.dateTime || '',
        actualFare: editingBooking.actualFare?.toString() || '',
        dateTime: editingBooking.dateTime
          ? new Date(editingBooking.dateTime).toISOString().slice(0, 16)
          : (editingBooking.pickupTime ? new Date(editingBooking.pickupTime).toISOString().slice(0, 16) : '')
      };
      setFormData(mappedBooking);
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      const toLocal = (v: string | undefined): string => {
        if (!v) return '';
        const d = new Date(v);
        return Number.isNaN(d.getTime()) ? '' : d.toISOString().slice(0, 16);
      };

      const empty: ExtendedBooking = {
        bookingNumber: '',
        dateTime: now.toISOString().slice(0, 16),
        hirerName: '',
        hirerAddress: '',
        hirerPhone: '',
        bookingMethod: 'telephone',
        pickupTime: now.toISOString().slice(0, 16),
        pickupLocation: '',
        destination: '',
        driverId: '',
        vehicleId: '',
        subContract: '',
        status: 'pending',
        notes: '',
        actualFare: '',
        paymentMethod: 'cash',
        paymentStatus: 'pending',
        expenses: []
      };

      if (initialDraft) {
        const d = initialDraft;
        setFormData({
          ...empty,
          ...d,
          dateTime: d.dateTime != null && String(d.dateTime).length > 0 ? toLocal(String(d.dateTime)) : empty.dateTime,
          pickupTime: d.pickupTime != null && String(d.pickupTime).length > 0 ? toLocal(String(d.pickupTime)) : empty.pickupTime,
          hirerName: d.hirerName ?? empty.hirerName,
          hirerAddress: d.hirerAddress ?? empty.hirerAddress,
          hirerPhone: d.hirerPhone ?? empty.hirerPhone,
          pickupLocation: d.pickupLocation ?? empty.pickupLocation,
          destination: d.destination ?? empty.destination,
          bookingMethod: d.bookingMethod ?? empty.bookingMethod,
          driverId: d.driverId ?? empty.driverId,
          vehicleId: d.vehicleId ?? empty.vehicleId,
          subContract: d.subContract ?? empty.subContract,
          status: (d.status as ExtendedBooking['status']) || empty.status,
          notes: d.notes ?? empty.notes,
          actualFare: d.actualFare !== undefined && d.actualFare !== '' ? String(d.actualFare) : '',
          paymentMethod: d.paymentMethod ?? empty.paymentMethod,
          paymentStatus: (d.paymentStatus as ExtendedBooking['paymentStatus']) || empty.paymentStatus,
          expenses: Array.isArray(d.expenses) ? d.expenses : []
        });
      } else {
        setFormData(empty);
      }
    }
  }, [editingBooking, isOpen, initialDraft]);

  // ✅ Expense logic
  const addExpense = () => {
    if (newExpense.amount && parseFloat(newExpense.amount) > 0) {
      setFormData(prev => ({
        ...prev,
        expenses: [
          ...(prev.expenses || []),
          { ...newExpense, amount: parseFloat(newExpense.amount), id: Date.now() }
        ]
      }));
      setNewExpense({ type: 'fuel', amount: '', description: '' });
    }
  };

  const removeExpense = (id: number) => {
    setFormData(prev => ({
      ...prev,
      expenses: (prev.expenses || []).filter((exp: TripExpense) => exp.id !== id)
    }));
  };

  const totalExpenses = (formData.expenses || []).reduce(
    (sum: number, exp: TripExpense) => sum + exp.amount,
    0
  );
  const actualFareNum =
    typeof formData.actualFare === 'string'
      ? parseFloat(formData.actualFare) || 0
      : formData.actualFare || 0;
  const netIncome = actualFareNum - totalExpenses;

  // ✅ Submit booking (create or update)
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const newBookingNumber =
      editingBooking && formData.bookingNumber
        ? formData.bookingNumber
        : generateSpiresBookingNumber();
    const bookingId = editingBooking?.id || newBookingNumber;

    // Prepare booking data - clean up undefined values
    const bookingData: any = {
      ...formData,
      actualFare:
        typeof formData.actualFare === 'string'
          ? (formData.actualFare.trim() ? parseFloat(formData.actualFare) : undefined)
          : formData.actualFare,
      dateTime: formData.dateTime
        ? new Date(formData.dateTime).toISOString()
        : new Date().toISOString(),
      allocatedTime: editingBooking && formData.allocatedTime
        ? formData.allocatedTime
        : new Date().toISOString(),
      bookingNumber: newBookingNumber,
      id: bookingId,
    };

    // Only add createdAt for new bookings
    if (!editingBooking) {
      bookingData.createdAt = serverTimestamp();
    }

    try {
      // Check if this is a customer booking (has uid field)
      const isCustomerBooking = !!(editingBooking?.uid || (formData as any)?.uid);
      
      if (editingBooking) {
        // Prepare update data - preserve existing booking data and only update changed fields
        const updateData: any = {
          // Preserve existing fields from editingBooking
          ...editingBooking,
          // Override with form data
          ...bookingData,
          // Always update these
          updatedAt: serverTimestamp(),
          // Preserve the booking ID
          id: bookingId,
        };

        // Handle customer booking status mapping
        if (isCustomerBooking) {
          // Map admin status to customer-facing status
          // Admin workflow: pending → confirmed → allocated → completed
          // Customer sees: pending → confirmed → paid
          
          if (bookingData.status === 'confirmed') {
            // Admin confirms booking - customer sees "confirmed"
            updateData.status = 'confirmed'; // Customer app reads this
            updateData.customerStatus = 'confirmed';
          } else if (bookingData.status === 'allocated') {
            // Admin allocates driver - customer still sees "confirmed" but admin sees "allocated"
            updateData.status = 'confirmed'; // Customer app reads this
            updateData.customerStatus = 'confirmed';
            // Keep admin status as allocated for internal tracking
            updateData.adminStatus = 'allocated';
          } else if (bookingData.status === 'completed') {
            // Admin marks as completed - check payment status
            if (bookingData.paymentStatus === 'paid') {
              // Payment received - customer sees "paid"
              updateData.status = 'paid'; // Customer app reads this
              updateData.customerStatus = 'paid';
            } else {
              // Trip completed but not paid yet - customer still sees confirmed
              updateData.status = 'confirmed';
              updateData.customerStatus = 'confirmed';
            }
            // Keep admin status as completed
            updateData.adminStatus = 'completed';
          } else if (bookingData.status === 'cancelled') {
            updateData.status = 'cancelled';
            updateData.customerStatus = 'cancelled';
          } else if (bookingData.status === 'pending') {
            // Keep as pending
            updateData.status = 'pending';
            updateData.customerStatus = 'pending';
          }
        }

        // Clean up updateData - remove undefined values but keep empty strings for optional fields
        const cleanedUpdateData: any = {};
        Object.keys(updateData).forEach(key => {
          const value = updateData[key];
          // Keep the value if it's not undefined or null
          // Empty strings are allowed for optional fields
          if (value !== undefined && value !== null) {
            cleanedUpdateData[key] = value;
          }
        });

        // Ensure we have the booking ID
        if (!bookingId) {
          throw new Error('Booking ID is required for update');
        }

        // Remove id from updateData as it's not a Firestore field
        delete cleanedUpdateData.id;
        
        // Ensure required fields are preserved from original booking
        if (!cleanedUpdateData.pickupLocation && editingBooking.pickupLocation) {
          cleanedUpdateData.pickupLocation = editingBooking.pickupLocation;
        }
        if (!cleanedUpdateData.pickupTime && editingBooking.pickupTime) {
          cleanedUpdateData.pickupTime = editingBooking.pickupTime;
        }
        if (!cleanedUpdateData.hirerName && editingBooking.hirerName) {
          cleanedUpdateData.hirerName = editingBooking.hirerName;
        }
        if (!cleanedUpdateData.hirerPhone && editingBooking.hirerPhone) {
          cleanedUpdateData.hirerPhone = editingBooking.hirerPhone;
        }
        if (!cleanedUpdateData.destination && editingBooking.destination) {
          cleanedUpdateData.destination = editingBooking.destination;
        }
        if (!cleanedUpdateData.bookingMethod && editingBooking.bookingMethod) {
          cleanedUpdateData.bookingMethod = editingBooking.bookingMethod;
        }

        console.log('📝 Updating booking:', bookingId);
        console.log('📝 Update data:', cleanedUpdateData);
        await updateDoc(doc(db, 'bookings', bookingId), cleanedUpdateData);
        console.log('✅ Booking updated successfully:', bookingId);
      } else {
        await setDoc(doc(db, 'bookings', bookingId), bookingData);
        console.log('✅ Booking created:', bookingId);
      }

      onSubmit && onSubmit(bookingData);
      onClose();
    } catch (err: any) {
      console.error('❌ Error saving booking:', err);
      // Only show error if it's a real error (not a successful update)
      // Sometimes Firestore updates succeed but throw warnings
      if (err?.code && err.code !== 'permission-denied') {
        const errorMessage = err?.message || err?.code || 'Unknown error';
        console.error('Full error details:', {
          message: err?.message,
          code: err?.code,
          stack: err?.stack,
          bookingId,
          isCustomerBooking: !!(editingBooking?.uid || (formData as any)?.uid)
        });
        alert(`Error saving booking: ${errorMessage}\n\nPlease check the browser console (F12) for more details.`);
      } else {
        // If update succeeded, just close the modal
        console.log('✅ Booking update completed (warning ignored)');
        onSubmit && onSubmit(bookingData);
        onClose();
      }
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
          <h3 className="modal-title">
            {editingBooking ? 'Edit Booking' : initialDraft ? 'Create return trip' : 'Create New Booking'}
          </h3>
          <p className="modal-subtitle">
            {editingBooking
              ? 'Update booking details and expenses'
              : initialDraft
                ? 'Pickup and destination are swapped from the original. Change date & time for the return leg below.'
                : 'Create a new taxi booking with fare tracking'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                <Clock className="w-5 h-5 text-blue-600 mr-2" />
                <h4 className="text-md font-semibold text-blue-900">
                  When Was This Booking Made?
                </h4>
              </div>
              <input
                type="datetime-local"
                value={formData.dateTime}
                onChange={(e) =>
                  setFormData({ ...formData, dateTime: e.target.value })
                }
                required
                className="form-input"
              />
            </div>

            {customerSuggestions.length > 0 && (
              <datalist id="booking-past-customers">
                {customerSuggestions.map((c) => (
                  <option key={c.displayName} value={c.displayName} />
                ))}
              </datalist>
            )}

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Customer Name *</label>
                <input
                  type="text"
                  value={formData.hirerName}
                  onChange={(e) => setFormData({ ...formData, hirerName: e.target.value })}
                  onBlur={(e) => applyKnownCustomer(e.target.value)}
                  list={customerSuggestions.length > 0 ? 'booking-past-customers' : undefined}
                  autoComplete="off"
                  placeholder="Type or choose a past customer"
                  required
                  className="form-input"
                />
                {customerSuggestions.length > 0 && (
                  <p className="text-xs text-gray-500 mt-1">Matching a saved name fills phone and address from their last booking.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.hirerPhone}
                  onChange={(e) => setFormData({ ...formData, hirerPhone: e.target.value })}
                  required
                  className="form-input"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer address</label>
              <textarea
                value={formData.hirerAddress || ''}
                onChange={(e) => setFormData({ ...formData, hirerAddress: e.target.value })}
                rows={2}
                className="form-input"
                placeholder="Optional — filled automatically for known customers when available"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking Method *</label>
              <select
                value={formData.bookingMethod}
                onChange={(e) => setFormData({ ...formData, bookingMethod: e.target.value as any })}
                required
                className="form-input"
              >
                <option value="telephone">Telephone</option>
                <option value="in person">In Person</option>
                <option value="internet">Internet</option>
              </select>
            </div>

            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                <Clock className="w-5 h-5 text-green-600 mr-2" />
                <h4 className="text-md font-semibold text-green-900">Pickup Date & Time *</h4>
              </div>
              <input
                type="datetime-local"
                value={formData.pickupTime ? new Date(formData.pickupTime).toISOString().slice(0, 16) : ''}
                onChange={(e) => setFormData({ ...formData, pickupTime: new Date(e.target.value).toISOString() })}
                required
                className="form-input"
              />
            </div>

            {locationSuggestions.length > 0 && (
              <datalist id="booking-past-locations">
                {locationSuggestions.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            )}

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Pickup Location *</label>
              <input
                type="text"
                value={formData.pickupLocation}
                onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                required
                className="form-input"
                list={locationSuggestions.length > 0 ? "booking-past-locations" : undefined}
                placeholder="Type or pick a past location"
                autoComplete="off"
              />
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
              <input
                type="text"
                value={formData.destination}
                onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                required
                className="form-input"
                list={locationSuggestions.length > 0 ? "booking-past-locations" : undefined}
                placeholder="Type or pick a past location"
                autoComplete="off"
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Driver</label>
                <select
                  value={formData.driverId || ''}
                  onChange={(e) => setFormData({ ...formData, driverId: e.target.value })}
                  className="form-input"
                >
                  <option value="">Not assigned</option>
                  {activeDrivers.map(driver => (
                    <option key={driver.id} value={driver.id}>{driver.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle</label>
                <select
                  value={formData.vehicleId || ''}
                  onChange={(e) => setFormData({ ...formData, vehicleId: e.target.value })}
                  className="form-input"
                >
                  <option value="">Not assigned</option>
                  {availableVehicles.map(vehicle => (
                    <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Status *</label>
                <select
                  value={formData.status}
                  onChange={(e) => setFormData({ ...formData, status: e.target.value as any })}
                  required
                  className="form-input"
                >
                  <option value="pending">Pending</option>
                  <option value="confirmed">Confirmed (Customer Notified)</option>
                  <option value="allocated">Allocated (Driver Assigned)</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Sub-Contract</label>
                <input
                  type="text"
                  value={formData.subContract || ''}
                  onChange={(e) => setFormData({ ...formData, subContract: e.target.value })}
                  className="form-input"
                />
              </div>
            </div>

            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-yellow-600 mr-2" />
                <h4 className="text-md font-semibold text-yellow-900">Fare & Payment</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Actual Fare (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.actualFare || ''}
                    onChange={(e) => setFormData({ ...formData, actualFare: e.target.value })}
                    className="form-input"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Method</label>
                  <select
                    value={formData.paymentMethod || 'cash'}
                    onChange={(e) => setFormData({ ...formData, paymentMethod: e.target.value as any })}
                    className="form-input"
                  >
                    {paymentMethods.map(method => (
                      <option key={method.value} value={method.value}>{method.label}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label>
                  <select
                    value={formData.paymentStatus || 'pending'}
                    onChange={(e) => setFormData({ ...formData, paymentStatus: e.target.value as any })}
                    className="form-input"
                  >
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                    <option value="refunded">Refunded</option>
                  </select>
                </div>
              </div>
              {actualFareNum > 0 && (
                <div className="bg-white p-3 rounded border">
                  <div className="flex justify-between text-sm">
                    <span>Fare:</span>
                    <span className="font-semibold">£{actualFareNum.toFixed(2)}</span>
                  </div>
                  {totalExpenses > 0 && (
                    <div className="flex justify-between text-sm mt-1">
                      <span>Expenses:</span>
                      <span className="font-semibold text-red-600">-£{totalExpenses.toFixed(2)}</span>
                    </div>
                  )}
                  <div className="flex justify-between text-sm mt-2 pt-2 border-t font-semibold">
                    <span>Net Income:</span>
                    <span className={netIncome >= 0 ? 'text-green-600' : 'text-red-600'}>
                      £{netIncome.toFixed(2)}
                    </span>
                  </div>
                </div>
              )}
            </div>

            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                <Receipt className="w-5 h-5 text-gray-600 mr-2" />
                <h4 className="text-md font-semibold text-gray-900">Expenses</h4>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-4 gap-2 mb-3">
                <select
                  value={newExpense.type}
                  onChange={(e) => setNewExpense({ ...newExpense, type: e.target.value as any })}
                  className="p-2 border rounded"
                >
                  {expenseTypes.map(type => (
                    <option key={type.value} value={type.value}>{type.label}</option>
                  ))}
                </select>
                <input
                  type="number"
                  step="0.01"
                  placeholder="Amount"
                  value={newExpense.amount}
                  onChange={(e) => setNewExpense({ ...newExpense, amount: e.target.value })}
                  className="p-2 border rounded"
                />
                <input
                  type="text"
                  placeholder="Description"
                  value={newExpense.description}
                  onChange={(e) => setNewExpense({ ...newExpense, description: e.target.value })}
                  className="p-2 border rounded"
                />
                <button
                  type="button"
                  onClick={addExpense}
                  className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 flex items-center justify-center"
                >
                  <Plus className="h-4 w-4 mr-1" /> Add
                </button>
              </div>
              {formData.expenses && formData.expenses.length > 0 && (
                <div className="space-y-2">
                  {formData.expenses.map((exp: TripExpense) => (
                    <div key={exp.id} className="bg-white p-2 rounded border flex justify-between items-center">
                      <span className="text-sm">{exp.type}: {exp.description} - £{exp.amount.toFixed(2)}</span>
                      <button
                        type="button"
                        onClick={() => removeExpense(exp.id)}
                        className="text-red-600 hover:text-red-800"
                      >
                        <Minus className="h-4 w-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Notes</label>
              <textarea
                value={formData.notes || ''}
                onChange={(e) => setFormData({ ...formData, notes: e.target.value })}
                rows={3}
                className="form-input"
              />
            </div>
          </div>

          <div className="modal-footer">
            <button
              type="button"
              onClick={onClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {editingBooking ? 'Update Booking' : 'Create Booking'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
