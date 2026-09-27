// components/BookingModal.tsx - FIXED CLEAN VERSION
import React, { useState, useEffect, useMemo } from 'react';
import { Plus, Minus, Calculator, Receipt, Clock } from 'lucide-react';
import { ExtendedBooking, TripExpense, Driver, Vehicle } from '../types/types';
import { expenseTypes, paymentMethods } from '../utils/constants';
import { SPIRES_BANK_DETAILS, isBankTransferMethod } from '../utils/bankDetails';
import { VEHICLE_TYPE_OPTIONS } from '../utils/vehicleTypes';
import {
  airportWaitingWebsiteBody,
  calculateAirportWaitingCharge,
} from '../utils/airportWaitingPolicy';
import { generateSpiresBookingNumber } from '../utils/bookingNumber';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../utils/bookingDateTime';
import {
  combineLocalDateTime,
  parseMoney,
  paymentScheduleValidationError,
  resolveBookingType,
  splitLocalDateTime,
} from '../utils/bookingJourney';
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

const AirportWaitingAdminNote: React.FC = () => {
  const [minutes, setMinutes] = useState('');
  const parsed = Number(minutes);
  const charge = Number.isFinite(parsed) && minutes !== '' ? calculateAirportWaitingCharge(parsed) : null;
  return (
    <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-gray-800">
      <h4 className="mb-2 font-semibold text-gray-900">Airport collection waiting</h4>
      {airportWaitingWebsiteBody().split('\n\n').map((para) => (
        <p key={para.slice(0, 48)} className="mb-2">{para}</p>
      ))}
      <p className="mt-2">The standard airport pickup charge is included in the fare. Extra waiting is recorded manually. Do not change a confirmed fare automatically.</p>
      <label className="mt-3 block text-sm font-medium text-gray-700">Minutes after actual landing</label>
      <div className="mt-1 flex items-center gap-3">
        <input
          type="number"
          min="0"
          value={minutes}
          onChange={(e) => setMinutes(e.target.value)}
          className="form-input w-32"
          placeholder="e.g. 55"
        />
        {charge != null && (
          <span>Waiting charge: £{charge.toFixed(0)}</span>
        )}
      </div>
    </div>
  );
};

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
  const [formError, setFormError] = useState('');
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
    expenses: [],
    vehicleType: '',
    depositRequired: false,
    depositAmount: '',
    depositStatus: 'not_required',
    bookingType: 'one_way',
    airportCollection: false,
    flightNumber: '',
    returnPickupTime: '',
    returnPickupLocation: '',
    returnDestination: '',
    returnAirportCollection: false,
    returnFlightNumber: '',
    dueOnOutbound: '',
    dueOnReturn: '',
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
        pickupTime: toDatetimeLocalValue(
          editingBooking.pickupTime || (editingBooking as any).dateTime || editingBooking.dateTime || ''
        ),
        actualFare: editingBooking.actualFare?.toString() || '',
        dateTime: editingBooking.dateTime
          ? toDatetimeLocalValue(editingBooking.dateTime)
          : editingBooking.pickupTime
            ? toDatetimeLocalValue(editingBooking.pickupTime)
            : '',
        vehicleType: editingBooking.vehicleType || (editingBooking as any).vehicleType || '',
        depositRequired: editingBooking.depositRequired === true,
        depositAmount:
          editingBooking.depositAmount !== undefined && editingBooking.depositAmount !== null
            ? String(editingBooking.depositAmount)
            : '',
        depositStatus: editingBooking.depositStatus || (editingBooking.depositRequired ? 'pending' : 'not_required'),
        bookingType: resolveBookingType(editingBooking),
        airportCollection: editingBooking.airportCollection === true,
        flightNumber: editingBooking.flightNumber || '',
        returnPickupTime: toDatetimeLocalValue(editingBooking.returnPickupTime || ''),
        returnPickupLocation: editingBooking.returnPickupLocation || '',
        returnDestination: editingBooking.returnDestination || '',
        returnAirportCollection: editingBooking.returnAirportCollection === true,
        returnFlightNumber: editingBooking.returnFlightNumber || '',
        dueOnOutbound:
          editingBooking.dueOnOutbound !== undefined && editingBooking.dueOnOutbound !== null
            ? String(editingBooking.dueOnOutbound)
            : '',
        dueOnReturn:
          editingBooking.dueOnReturn !== undefined && editingBooking.dueOnReturn !== null
            ? String(editingBooking.dueOnReturn)
            : '',
      };
      setFormError('');
      setFormData(mappedBooking);
    } else {
      const now = new Date();
      now.setMinutes(now.getMinutes() + 30);
      const defaultLocal = toDatetimeLocalValue(now);

      const empty: ExtendedBooking = {
        bookingNumber: '',
        dateTime: defaultLocal,
        hirerName: '',
        hirerAddress: '',
        hirerPhone: '',
        bookingMethod: 'telephone',
        pickupTime: defaultLocal,
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
        expenses: [],
        vehicleType: '',
        depositRequired: false,
        depositAmount: '',
        depositStatus: 'not_required',
        bookingType: 'one_way',
        airportCollection: false,
        flightNumber: '',
        returnPickupTime: '',
        returnPickupLocation: '',
        returnDestination: '',
        returnAirportCollection: false,
        returnFlightNumber: '',
        dueOnOutbound: '',
        dueOnReturn: '',
      };

      if (initialDraft) {
        const d = initialDraft;
        setFormData({
          ...empty,
          ...d,
          dateTime: d.dateTime != null && String(d.dateTime).length > 0 ? toDatetimeLocalValue(String(d.dateTime)) : empty.dateTime,
          pickupTime: d.pickupTime != null && String(d.pickupTime).length > 0 ? toDatetimeLocalValue(String(d.pickupTime)) : empty.pickupTime,
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
          expenses: Array.isArray(d.expenses) ? d.expenses : [],
          vehicleType: (d as any).vehicleType ?? empty.vehicleType,
          depositRequired: (d as any).depositRequired === true,
          depositAmount: (d as any).depositAmount !== undefined && (d as any).depositAmount !== '' ? String((d as any).depositAmount) : '',
          depositStatus: (d as any).depositStatus || empty.depositStatus,
          bookingType: resolveBookingType(d as any),
          airportCollection: (d as any).airportCollection === true,
          flightNumber: (d as any).flightNumber || '',
          returnPickupTime: (d as any).returnPickupTime ? toDatetimeLocalValue(String((d as any).returnPickupTime)) : '',
          returnPickupLocation: (d as any).returnPickupLocation || '',
          returnDestination: (d as any).returnDestination || '',
          returnAirportCollection: (d as any).returnAirportCollection === true,
          returnFlightNumber: (d as any).returnFlightNumber || '',
          dueOnOutbound: (d as any).dueOnOutbound !== undefined && (d as any).dueOnOutbound !== '' ? String((d as any).dueOnOutbound) : '',
          dueOnReturn: (d as any).dueOnReturn !== undefined && (d as any).dueOnReturn !== '' ? String((d as any).dueOnReturn) : '',
        });
        setFormError('');
      } else {
        setFormData(empty);
        setFormError('');
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

    const pickupIso = fromDatetimeLocalValue(
      String(formData.pickupTime || formData.dateTime || '')
    );
    const dateTimeIso = fromDatetimeLocalValue(String(formData.dateTime || ''));
    const isReturn = formData.bookingType === 'return';
    const dueOnOutbound = parseMoney(formData.dueOnOutbound);
    const dueOnReturn = parseMoney(formData.dueOnReturn);
    const depositAmountNum = parseMoney(formData.depositAmount);
    const usingSchedule = dueOnOutbound != null || dueOnReturn != null;
    const scheduleError =
      isReturn && usingSchedule
        ? paymentScheduleValidationError(
            actualFareNum > 0 ? actualFareNum : null,
            depositAmountNum ?? 0,
            dueOnOutbound ?? 0,
            dueOnReturn ?? 0
          )
        : null;
    if (scheduleError) {
      setFormError(scheduleError);
      return;
    }
    if (isReturn && (!formData.returnPickupTime || !formData.returnPickupLocation?.trim() || !formData.returnDestination?.trim())) {
      setFormError('Return bookings need a return date, pickup time, pickup address and destination.');
      return;
    }
    setFormError('');

    const bookingData: any = {
      ...formData,
      actualFare:
        typeof formData.actualFare === 'string'
          ? (formData.actualFare.trim() ? parseFloat(formData.actualFare) : undefined)
          : formData.actualFare,
      depositRequired: formData.depositRequired === true,
      depositAmount:
        formData.depositRequired === true && formData.depositAmount !== undefined && formData.depositAmount !== ''
          ? (typeof formData.depositAmount === 'string'
              ? parseFloat(formData.depositAmount)
              : formData.depositAmount)
          : undefined,
      depositStatus:
        formData.depositRequired === true
          ? (formData.depositStatus === 'paid' ? 'paid' : 'pending')
          : 'not_required',
      dateTime: dateTimeIso,
      pickupTime: pickupIso,
      allocatedTime:
        editingBooking && formData.allocatedTime
          ? formData.allocatedTime
          : formData.status === 'allocated' || formData.driverId
            ? new Date().toISOString()
            : undefined,
      bookingNumber: newBookingNumber,
      bookingType: isReturn ? 'return' : 'one_way',
      returnTrip: isReturn,
      airportCollection: formData.airportCollection === true,
      flightNumber: formData.airportCollection === true ? String(formData.flightNumber || '').trim() : '',
      returnPickupTime: isReturn ? fromDatetimeLocalValue(String(formData.returnPickupTime || '')) : '',
      returnPickupLocation: isReturn ? String(formData.returnPickupLocation || '').trim() : '',
      returnDestination: isReturn ? String(formData.returnDestination || '').trim() : '',
      returnAirportCollection: isReturn && formData.returnAirportCollection === true,
      returnFlightNumber:
        isReturn && formData.returnAirportCollection === true
          ? String(formData.returnFlightNumber || '').trim()
          : '',
      returnDateTime: isReturn ? fromDatetimeLocalValue(String(formData.returnPickupTime || '')) : '',
      dueOnOutbound: isReturn && dueOnOutbound != null ? dueOnOutbound : '',
      dueOnReturn: isReturn && dueOnReturn != null ? dueOnReturn : '',
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

        // Drop empty optional assignment fields
        if (!cleanedUpdateData.driverId) delete cleanedUpdateData.driverId;
        if (!cleanedUpdateData.vehicleId) delete cleanedUpdateData.vehicleId;
        if (cleanedUpdateData.allocatedTime === undefined) delete cleanedUpdateData.allocatedTime;
        
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
        const createPayload: Record<string, unknown> = {};
        Object.entries(bookingData).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'id') {
            createPayload[key] = value;
          }
        });
        if (!createPayload.driverId) delete createPayload.driverId;
        if (!createPayload.vehicleId) delete createPayload.vehicleId;
        if (createPayload.allocatedTime === undefined) delete createPayload.allocatedTime;

        await setDoc(doc(db, 'bookings', bookingId), createPayload);
        console.log('✅ Booking created:', bookingId);
      }

      onSubmit && onSubmit({ ...bookingData, id: bookingId });
      onClose();
    } catch (err: any) {
      console.error('❌ Error saving booking:', err);
      const errorMessage = err?.message || err?.code || 'Unknown error';
      console.error('Full error details:', {
        message: err?.message,
        code: err?.code,
        stack: err?.stack,
        bookingId,
        isCustomerBooking: !!(editingBooking?.uid || (formData as any)?.uid),
      });
      alert(
        `Error saving booking: ${errorMessage}\n\nIf this says permission-denied, deploy the updated Firestore rules (firestore.rules) from the project root.`
      );
    }
  };

  if (!isOpen) return null;

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <button className="modal-close" onClick={onClose}>×</button>
          <h3 className="modal-title">
            {editingBooking ? 'Edit Booking' : 'Create New Booking'}
          </h3>
          <p className="modal-subtitle">
            {editingBooking
              ? 'Update booking details and expenses'
              : 'Choose One Way or Return. A return stays on this same booking.'}
          </p>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="modal-body">
            <div className="mb-6 p-4 rounded-lg border-2 border-blue-800 bg-blue-50">
              <label className="block text-sm font-semibold text-blue-900 mb-1">Booking type *</label>
              <select
                value={formData.bookingType === 'return' ? 'return' : 'one_way'}
                onChange={(e) => {
                  const nextType = e.target.value === 'return' ? 'return' : 'one_way';
                  setFormData((prev) => ({
                    ...prev,
                    bookingType: nextType,
                    returnTrip: nextType === 'return',
                    returnPickupLocation:
                      nextType === 'return'
                        ? (prev.returnPickupLocation || prev.destination)
                        : prev.returnPickupLocation,
                    returnDestination:
                      nextType === 'return'
                        ? (prev.returnDestination || prev.pickupLocation)
                        : prev.returnDestination,
                  }));
                }}
                className="form-input"
              >
                <option value="one_way">One Way</option>
                <option value="return">Return</option>
              </select>
              <p className="text-xs text-blue-900 mt-1">
                Return stays on this same booking confirmation. It does not create a second booking.
              </p>
            </div>

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

            {locationSuggestions.length > 0 && (
              <datalist id="booking-past-locations">
                {locationSuggestions.map((loc) => (
                  <option key={loc} value={loc} />
                ))}
              </datalist>
            )}

            {(() => {
              const outbound = splitLocalDateTime(toDatetimeLocalValue(formData.pickupTime || formData.dateTime));
              const ret = splitLocalDateTime(toDatetimeLocalValue(formData.returnPickupTime || ''));
              const listId = locationSuggestions.length > 0 ? 'booking-past-locations' : undefined;
              const setOutboundDateTime = (date: string, time: string) => {
                setFormData({ ...formData, pickupTime: combineLocalDateTime(date, time) });
              };
              const setReturnDateTime = (date: string, time: string) => {
                setFormData({ ...formData, returnPickupTime: combineLocalDateTime(date, time) });
              };
              return (
                <>
                  <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
                    <div className="flex items-center mb-3">
                      <Clock className="w-5 h-5 text-green-600 mr-2" />
                      <h4 className="text-md font-semibold text-green-900">
                        {formData.bookingType === 'return' ? 'Outbound journey' : 'Journey'} *
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                        <input
                          type="date"
                          value={outbound.date}
                          onChange={(e) => setOutboundDateTime(e.target.value, outbound.time || '00:00')}
                          required
                          className="form-input"
                        />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup time *</label>
                        <input
                          type="time"
                          value={outbound.time}
                          onChange={(e) => setOutboundDateTime(outbound.date, e.target.value)}
                          required
                          className="form-input"
                        />
                      </div>
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Pickup address *</label>
                      <input
                        type="text"
                        value={formData.pickupLocation}
                        onChange={(e) => setFormData({ ...formData, pickupLocation: e.target.value })}
                        required
                        className="form-input"
                        list={listId}
                        placeholder="Type or pick a past location"
                        autoComplete="off"
                      />
                    </div>
                    <div className="mb-4">
                      <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
                      <input
                        type="text"
                        value={formData.destination}
                        onChange={(e) => setFormData({ ...formData, destination: e.target.value })}
                        required
                        className="form-input"
                        list={listId}
                        placeholder="Type or pick a past location"
                        autoComplete="off"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-gray-800 mb-3">
                      <input
                        type="checkbox"
                        checked={formData.airportCollection === true}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            airportCollection: e.target.checked,
                            flightNumber: e.target.checked ? formData.flightNumber : '',
                          })
                        }
                      />
                      Airport collection
                    </label>
                    {formData.airportCollection && (
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Flight number</label>
                        <input
                          type="text"
                          value={formData.flightNumber || ''}
                          onChange={(e) => setFormData({ ...formData, flightNumber: e.target.value })}
                          className="form-input"
                          placeholder="e.g. BA123"
                        />
                      </div>
                    )}
                  </div>

                  {formData.bookingType === 'return' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center mb-3">
                        <Clock className="w-5 h-5 text-blue-700 mr-2" />
                        <h4 className="text-md font-semibold text-blue-900">Return journey *</h4>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                          <input
                            type="date"
                            value={ret.date}
                            onChange={(e) => setReturnDateTime(e.target.value, ret.time || '00:00')}
                            required
                            className="form-input"
                          />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Pickup time *</label>
                          <input
                            type="time"
                            value={ret.time}
                            onChange={(e) => setReturnDateTime(ret.date, e.target.value)}
                            required
                            className="form-input"
                          />
                        </div>
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Pickup address *</label>
                        <input
                          type="text"
                          value={formData.returnPickupLocation || ''}
                          onChange={(e) => setFormData({ ...formData, returnPickupLocation: e.target.value })}
                          required
                          className="form-input"
                          list={listId}
                          autoComplete="off"
                        />
                      </div>
                      <div className="mb-4">
                        <label className="block text-sm font-medium text-gray-700 mb-1">Destination *</label>
                        <input
                          type="text"
                          value={formData.returnDestination || ''}
                          onChange={(e) => setFormData({ ...formData, returnDestination: e.target.value })}
                          required
                          className="form-input"
                          list={listId}
                          autoComplete="off"
                        />
                      </div>
                      <label className="flex items-center gap-2 text-sm text-gray-800 mb-3">
                        <input
                          type="checkbox"
                          checked={formData.returnAirportCollection === true}
                          onChange={(e) =>
                            setFormData({
                              ...formData,
                              returnAirportCollection: e.target.checked,
                              returnFlightNumber: e.target.checked ? formData.returnFlightNumber : '',
                            })
                          }
                        />
                        Airport collection
                      </label>
                      {formData.returnAirportCollection && (
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Flight number</label>
                          <input
                            type="text"
                            value={formData.returnFlightNumber || ''}
                            onChange={(e) => setFormData({ ...formData, returnFlightNumber: e.target.value })}
                            className="form-input"
                            placeholder="e.g. BA123"
                          />
                        </div>
                      )}
                    </div>
                  )}
                </>
              );
            })()}

            {(formData.airportCollection || formData.returnAirportCollection) && (
              <AirportWaitingAdminNote />
            )}

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
                <label className="block text-sm font-medium text-gray-700 mb-1">Actual vehicle</label>
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
                  <p className="text-xs text-gray-500 mt-1">
                    Published airport card is Oxford only (Oxford to airport or airport to Oxford). Quote Abingdon, Kidlington, Witney, Bicester, Didcot and other towns separately. Those fares are subject to change. Do not change an already agreed fare.
                  </p>
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
              {isBankTransferMethod(formData.paymentMethod) && formData.paymentStatus !== 'paid' && (
                <div className="mb-4 p-3 rounded-md border border-amber-300 bg-amber-50 text-sm text-gray-800 leading-relaxed">
                  <div className="font-semibold text-gray-900 mb-1">Bank transfer details (shown on customer PDF)</div>
                  <div>{SPIRES_BANK_DETAILS.accountName}</div>
                  <div>Sort code: {SPIRES_BANK_DETAILS.sortCode}</div>
                  <div>Account: {SPIRES_BANK_DETAILS.accountNumber}</div>
                  <div className="mt-1 text-gray-600">Customer should use the booking number as the payment reference.</div>
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle class</label>
                  <select
                    value={formData.vehicleType || ''}
                    onChange={(e) => setFormData({ ...formData, vehicleType: e.target.value })}
                    className="form-input"
                  >
                    <option value="">Not specified</option>
                    {VEHICLE_TYPE_OPTIONS.map((opt) => (
                      <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                  </select>
                  {formData.vehicleType === 'standard' && (
                    <p className="text-xs text-gray-500 mt-1">Toyota RAV4 / Corolla or similar — customer-facing class only.</p>
                  )}
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deposit required?</label>
                  <select
                    value={formData.depositRequired ? 'yes' : 'no'}
                    onChange={(e) => {
                      const required = e.target.value === 'yes';
                      setFormData({
                        ...formData,
                        depositRequired: required,
                        depositStatus: required
                          ? (formData.depositStatus === 'paid' ? 'paid' : 'pending')
                          : 'not_required',
                        depositAmount: required ? formData.depositAmount : '',
                      });
                    }}
                    className="form-input"
                  >
                    <option value="no">No</option>
                    <option value="yes">Yes</option>
                  </select>
                </div>
                {formData.depositRequired && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Deposit status</label>
                    <select
                      value={formData.depositStatus === 'paid' ? 'paid' : 'pending'}
                      onChange={(e) => setFormData({ ...formData, depositStatus: e.target.value })}
                      className="form-input"
                    >
                      <option value="pending">Pending</option>
                      <option value="paid">Paid</option>
                    </select>
                  </div>
                )}
              </div>
              {formData.depositRequired && (
                <div className="mb-4 max-w-xs">
                  <label className="block text-sm font-medium text-gray-700 mb-1">Deposit amount (£)</label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={formData.depositAmount || ''}
                    onChange={(e) => setFormData({ ...formData, depositAmount: e.target.value })}
                    className="form-input"
                    placeholder="e.g. 50"
                  />
                </div>
              )}

              {formData.bookingType === 'return' && (
                <div className="mb-4 p-3 rounded-md border border-gray-200 bg-white">
                  <div className="font-semibold text-gray-900 mb-1">Payment schedule (optional)</div>
                  <p className="text-xs text-gray-500 mb-3">
                    Leave blank if the booking is paid in full. If used, deposit + outbound + return should equal the total fare.
                  </p>
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Deposit</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.depositAmount || ''}
                        onChange={(e) =>
                          setFormData({
                            ...formData,
                            depositAmount: e.target.value,
                            depositRequired: e.target.value !== '' ? true : formData.depositRequired,
                          })
                        }
                        className="form-input"
                        placeholder="e.g. 14"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due on outbound journey</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.dueOnOutbound || ''}
                        onChange={(e) => setFormData({ ...formData, dueOnOutbound: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 120"
                      />
                    </div>
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">Due on return journey</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={formData.dueOnReturn || ''}
                        onChange={(e) => setFormData({ ...formData, dueOnReturn: e.target.value })}
                        className="form-input"
                        placeholder="e.g. 40"
                      />
                    </div>
                  </div>
                </div>
              )}

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
            {formError ? (
              <p className="text-sm" style={{ color: '#b91c1c', marginRight: 'auto' }}>{formError}</p>
            ) : null}
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
