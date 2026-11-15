// components/BookingModal.tsx - FIXED CLEAN VERSION
import React, { useEffect, useRef, useState } from 'react';
import { Plus, Minus, Calculator, Receipt, Clock } from 'lucide-react';
import { ExtendedBooking, TripExpense, Driver, Vehicle } from '../types/types';
import { expenseTypes, paymentMethods } from '../utils/constants';
import { SPIRES_BANK_DETAILS, isBankTransferMethod } from '../utils/bankDetails';
import { VEHICLE_TYPE_OPTIONS } from '../utils/vehicleTypes';
import {
  airportWaitingWebsiteBody,
  calculateAirportWaitingCharge,
} from '../utils/airportWaitingPolicy';
import { effectiveWorkflowStatus } from '../utils/bookingWorkflow';
import { applyRequestedLegStatus, hasTimedReturn, proposedLegacyReturnCorrection } from '../utils/journeyLegs';
import { airportCollectionNotes, vehicleClassRequiredMessage } from '../utils/bookingOps';
import { paymentSummary } from '../utils/farePayment';
import { getExpiryStatus } from '../utils/driverExpiry';
import { generateSpiresBookingNumber } from '../utils/bookingNumber';
import { toDatetimeLocalValue, fromDatetimeLocalValue } from '../utils/bookingDateTime';
import {
  combineLocalDateTime,
  parseMoney,
  paymentScheduleValidationError,
  resolveBookingType,
  splitLocalDateTime,
} from '../utils/bookingJourney';
import { db, functions } from '../utils/firebase';
import { getCallableErrorMessage } from '../utils/callableErrorMessage';
import { httpsCallable } from 'firebase/functions';
import { collection, doc, setDoc, runTransaction, serverTimestamp, deleteField } from 'firebase/firestore';
import {
  accountLinkForBooking,
  customerSuggestionLabel,
  matchCustomerSuggestion,
  normaliseCustomerEmail,
  type CustomerProfile,
} from '../utils/customerSuggestions';
import QuoteEditor from './QuoteEditor';
import JourneyStopsEditor from './JourneyStopsEditor';
import { hasExtraStops, keepStoredItinerary, normaliseStops, OPEN_RETURN_NOTICE, validateStops } from '../utils/journeyStops';
import TermsAcceptance from './TermsAcceptance';

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

const HEARD_ABOUT_LABELS: Record<string, string> = {
  google: "Google",
  facebook: "Facebook",
  instagram: "Instagram",
  friend_or_family: "Friend or family",
  used_before: "Used us before",
  website: "Your website",
  other: "Other",
};

function heardAboutText(code?: string, detail?: string): string {
  const label = HEARD_ABOUT_LABELS[code || ""] || "";
  if (!label) return "";
  const extra = String(detail || "").trim();
  return code === "other" && extra ? `${label}: ${extra}` : label;
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
  const applyKnownCustomer = (rawName: string) => {
    const match = matchCustomerSuggestion(rawName, customerSuggestions);
    if (!match) return;
    const existingUid = String(editingBooking?.uid || '');
    if (existingUid && match.uid && match.uid !== existingUid) return;
    setFormData((prev) => ({
      ...prev,
      hirerName: match.displayName,
      hirerPhone: match.phone || prev.hirerPhone,
      hirerAddress: match.address || prev.hirerAddress,
      email: match.email || prev.email || '',
      hirerEmail: match.email || prev.hirerEmail || '',
      uid: match.uid || prev.uid || '',
    }));
  };
  const [formError, setFormError] = useState('');
  const [dirty, setDirty] = useState(false);
  const panelRef = useRef<HTMLDivElement>(null);
  const [formData, setFormData] = useState<ExtendedBooking>({
    bookingNumber: '',
    dateTime: '',
    hirerName: '',
    hirerAddress: '',
    hirerPhone: '',
    bookingMethod: 'telephone',
    enquiryAt: '',
    customerReportedSource: '',
    pickupTime: '',
    pickupLocation: '',
    destination: '',
    driverId: '',
    returnDriverId: '',
    vehicleId: '',
    subContract: '',
    status: 'pending',
    notes: '',
    actualFare: '',
    paymentMethod: 'cash',
    paymentStatus: 'pending',
    executiveAvailability: '',
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
    stops: normaliseStops(undefined, '', ''),
    returnStops: normaliseStops(undefined, '', ''),
    openReturn: false,
    returnDate: '',
    returnNoticeNote: '',
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
    setDirty(false);
    if (editingBooking) {
      // Map customer booking fields to admin format if needed
      const mappedBooking: any = {
        ...editingBooking,
        // Map customer app fields to admin fields
        hirerName: editingBooking.hirerName || (editingBooking as any).name || '',
        hirerPhone: editingBooking.hirerPhone || (editingBooking as any).phone || '',
        status: effectiveWorkflowStatus(editingBooking),
        returnDriverId: editingBooking.returnDriverId || '',
        returnStatus: editingBooking.returnStatus || '',
        outboundStatus: editingBooking.outboundStatus || '',
        hirerAddress: editingBooking.hirerAddress || '',
        pickupLocation: editingBooking.pickupLocation || (editingBooking as any).pickup || '',
        destination: editingBooking.destination || '',
        bookingMethod: editingBooking.bookingMethod || 'internet',
        enquiryAt: toDatetimeLocalValue(editingBooking.enquiryAt || ''),
        customerReportedSource: editingBooking.customerReportedSource || '',
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
        executiveAvailability: (editingBooking as { executiveAvailability?: string }).executiveAvailability
          || ((editingBooking.vehicleType === 'executive') ? 'awaiting_confirmation' : ''),
        depositRequired: editingBooking.depositRequired === true,
        depositAmount:
          editingBooking.depositAmount !== undefined && editingBooking.depositAmount !== null
            ? String(editingBooking.depositAmount)
            : '',
        depositStatus: editingBooking.depositStatus || (editingBooking.depositRequired ? 'pending' : 'not_required'),
        bookingType: resolveBookingType(editingBooking),
        airportCollection: editingBooking.airportCollection === true,
        airportDropOff: (editingBooking as { airportDropOff?: boolean }).airportDropOff === true,
        flightNumber: editingBooking.flightNumber || '',
        terminal: editingBooking.terminal || '',
        landingTime: (editingBooking as { landingTime?: string }).landingTime || '',
        returnPickupTime: toDatetimeLocalValue(editingBooking.returnPickupTime || ''),
        returnPickupLocation: editingBooking.returnPickupLocation || '',
        returnDestination: editingBooking.returnDestination || '',
        returnAirportCollection: editingBooking.returnAirportCollection === true,
        returnFlightNumber: editingBooking.returnFlightNumber || '',
        returnTerminal: (editingBooking as { returnTerminal?: string }).returnTerminal || '',
        returnLandingTime: (editingBooking as { returnLandingTime?: string }).returnLandingTime || '',
        passengers: editingBooking.passengers,
        luggage: (editingBooking as { luggage?: number | string }).luggage ?? '',
        stops: normaliseStops((editingBooking as any).stops, editingBooking.pickupLocation || (editingBooking as any).pickup || '', editingBooking.destination || ''),
        returnStops: normaliseStops((editingBooking as any).returnStops, editingBooking.returnPickupLocation || '', editingBooking.returnDestination || ''),
        openReturn: (editingBooking as any).openReturn === true,
        returnDate: (editingBooking as any).returnDate || String(editingBooking.returnPickupTime || '').slice(0, 10),
        returnNoticeNote: (editingBooking as any).returnNoticeNote || '',
        dueOnOutbound:
          editingBooking.dueOnOutbound !== undefined && editingBooking.dueOnOutbound !== null
            ? String(editingBooking.dueOnOutbound)
            : '',
        dueOnReturn:
          editingBooking.dueOnReturn !== undefined && editingBooking.dueOnReturn !== null
            ? String(editingBooking.dueOnReturn)
            : '',
        email: (editingBooking as any).email || (editingBooking as any).hirerEmail || '',
        hirerEmail: (editingBooking as any).hirerEmail || (editingBooking as any).email || '',
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
        paymentMethod: 'undecided',
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
        stops: normaliseStops(undefined, '', ''),
        returnStops: normaliseStops(undefined, '', ''),
        openReturn: false,
        returnDate: '',
        returnNoticeNote: '',
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
          stops: normaliseStops((d as any).stops, d.pickupLocation || '', d.destination || ''),
          returnStops: normaliseStops((d as any).returnStops, (d as any).returnPickupLocation || '', (d as any).returnDestination || ''),
          openReturn: (d as any).openReturn === true,
          returnDate: (d as any).returnDate || String((d as any).returnPickupTime || '').slice(0, 10),
          returnNoticeNote: (d as any).returnNoticeNote || '',
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

  useEffect(() => {
    if (!isOpen) return;
    panelRef.current?.focus();
  }, [isOpen, editingBooking]);

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
    const bookingId = editingBooking?.id || doc(collection(db, 'bookings')).id;

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
    const cancellingSavedBooking = Boolean(editingBooking) && (
      formData.status === 'cancelled' || formData.returnStatus === 'cancelled' || formData.outboundStatus === 'cancelled'
    );
    const outboundStops = normaliseStops(formData.stops, formData.pickupLocation, formData.destination || '');
    const outboundStopError = cancellingSavedBooking ? null : validateStops(outboundStops);
    if (outboundStopError) {
      setFormError(outboundStopError);
      return;
    }
    const returnStops = isReturn ? normaliseStops(formData.returnStops, formData.returnPickupLocation || '', formData.returnDestination || '') : [];
    if (isReturn && !cancellingSavedBooking) {
      const returnStopError = validateStops(returnStops);
      if (returnStopError) {
        setFormError(`Return: ${returnStopError}`);
        return;
      }
      const returnDate = String(formData.returnDate || '').slice(0, 10) || String(formData.returnPickupTime || '').slice(0, 10);
      if (!returnDate) {
        setFormError('Return bookings need a return date.');
        return;
      }
      if (!formData.openReturn && !formData.returnPickupTime) {
        setFormError('Enter the return pickup time, or choose return time to be confirmed.');
        return;
      }
    }
    const typedEmail = String(formData.email || formData.hirerEmail || '').trim();
    if (typedEmail && !normaliseCustomerEmail(typedEmail)) {
      setFormError('Enter a valid customer email, or leave it blank.');
      return;
    }
    const guestUnclaimed = (editingBooking as { guestRequest?: boolean } | null)?.guestRequest === true && !editingBooking?.uid;
    if (guestUnclaimed && !String(formData.hirerPhone || '').trim() && !normaliseCustomerEmail(typedEmail)) {
      setFormError('Add a phone number or email address before saving this guest request.');
      return;
    }
    const alreadyConfirmed = Boolean(editingBooking && ['confirmed', 'allocated', 'completed', 'paid'].includes(effectiveWorkflowStatus(editingBooking)));
    const classError = vehicleClassRequiredMessage(String(formData.status || ''), String(formData.vehicleType || ''), alreadyConfirmed);
    if (classError) {
      setFormError(classError);
      return;
    }
    setFormError('');

    const picked = matchCustomerSuggestion(String(formData.hirerName || ''), customerSuggestions);
    const hirerName = picked?.displayName || String(formData.hirerName || '').trim();
    const link = accountLinkForBooking({
      typedEmail,
      picked: guestUnclaimed ? null : picked,
      existingUid: editingBooking?.uid,
      existingEmail: editingBooking?.email || editingBooking?.hirerEmail,
      suggestions: customerSuggestions,
      skipAutomaticEmailMatch: guestUnclaimed,
    });

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
      returnPickupTime: isReturn && !formData.openReturn ? fromDatetimeLocalValue(String(formData.returnPickupTime || '')) : (isReturn && formData.returnPickupTime ? fromDatetimeLocalValue(String(formData.returnPickupTime || '')) : ''),
      returnDate: isReturn ? (String(formData.returnDate || '').slice(0, 10) || String(formData.returnPickupTime || '').slice(0, 10)) : '',
      openReturn: isReturn && formData.openReturn === true,
      returnNoticeNote: isReturn ? String(formData.returnNoticeNote || '').trim() : '',
      openReturnNotice: isReturn && formData.openReturn === true ? OPEN_RETURN_NOTICE : '',
      stops: outboundStops,
      returnStops: isReturn ? returnStops : [],
      extraStops: hasExtraStops(outboundStops) || hasExtraStops(returnStops),
      pickupLocation: outboundStops[0]?.address || formData.pickupLocation,
      destination: outboundStops[outboundStops.length - 1]?.address || formData.destination,
      returnPickupLocation: isReturn ? (returnStops[0]?.address || '') : '',
      returnDestination: isReturn ? (returnStops[returnStops.length - 1]?.address || '') : '',
      returnAirportCollection: isReturn && formData.returnAirportCollection === true,
      returnFlightNumber:
        isReturn && formData.returnAirportCollection === true
          ? String(formData.returnFlightNumber || '').trim()
          : '',
      returnDateTime: isReturn && formData.returnPickupTime ? fromDatetimeLocalValue(String(formData.returnPickupTime || '')) : '',
      dueOnOutbound: isReturn && dueOnOutbound != null ? dueOnOutbound : '',
      dueOnReturn: isReturn && dueOnReturn != null ? dueOnReturn : '',
      hirerName,
    };
    if (link.email) {
      bookingData.email = link.email;
      bookingData.hirerEmail = link.email;
    } else {
      delete bookingData.email;
      delete bookingData.hirerEmail;
    }
    if (link.uid) {
      bookingData.uid = link.uid;
      bookingData.name = hirerName;
      bookingData.phone = bookingData.hirerPhone;
      bookingData.pickup = bookingData.pickupLocation;
      bookingData.customerStatus = bookingData.status || 'pending';
    } else {
      delete bookingData.uid;
    }
    if ((editingBooking as { guestRequest?: boolean } | null)?.guestRequest) {
      bookingData.guestRequest = true;
      bookingData.name = hirerName;
      bookingData.phone = bookingData.hirerPhone || '';
      bookingData.pickup = bookingData.pickupLocation;
    }
    if (bookingData.vehicleType === 'executive' && bookingData.executiveAvailability !== 'accepted') {
      if (['confirmed', 'allocated', 'completed'].includes(String(bookingData.status || ''))) {
        bookingData.status = 'pending';
        bookingData._executiveHold = 'Executive request kept as a request. Accept availability before confirming, allocating, or completing it.';
      }
      if (bookingData.paymentStatus === 'paid' || bookingData.paymentStatus === 'partial') {
        bookingData.paymentStatus = editingBooking?.paymentStatus === 'paid' || editingBooking?.paymentStatus === 'partial'
          ? editingBooking.paymentStatus
          : 'pending';
        bookingData._executiveHold = 'Payment was not recorded. Accept Executive availability first.';
      }
      if (bookingData.driverId || bookingData.vehicleId) {
        bookingData.driverId = '';
        bookingData.vehicleId = '';
        bookingData._executiveHold = `${bookingData._executiveHold || ''} No vehicle was assigned.`.trim();
      }
    }
    if (!bookingData.returnStatus) delete bookingData.returnStatus;
    if (!bookingData.outboundStatus) delete bookingData.outboundStatus;
    if (!bookingData.returnDriverId) delete bookingData.returnDriverId;
    Object.assign(bookingData, applyRequestedLegStatus(editingBooking || null, bookingData));

    const reportedSource = String(formData.customerReportedSource || '');
    if (['google_advert', 'google_search', 'recommendation', 'repeat', 'other'].includes(reportedSource)) {
      bookingData.customerReportedSource = reportedSource as ExtendedBooking['customerReportedSource'];
    } else {
      delete bookingData.customerReportedSource;
    }
    const enquiryLocal = typeof formData.enquiryAt === "string" ? formData.enquiryAt.trim() : "";
    if (enquiryLocal) {
      bookingData.enquiryAt = fromDatetimeLocalValue(enquiryLocal);
    } else {
      delete bookingData.enquiryAt;
    }

    // Only add createdAt for new bookings
    if (!editingBooking) {
      bookingData.createdAt = serverTimestamp();
      if (!bookingData.source) bookingData.source = 'admin';
    }

    const executiveHold = String(bookingData._executiveHold || '');
    delete bookingData._executiveHold;
    try {
      if (executiveHold) window.alert(executiveHold);
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

        // Keep the workflow status the customer should see. Payment stays on paymentStatus.
        if (isCustomerBooking) {
          const workflow = bookingData.status;
          updateData.status = workflow;
          updateData.customerStatus = workflow;
          updateData.adminStatus = workflow;
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

        // Quote/payment functions own these fields. A stale open form must never write them back.
        for (const key of Object.keys(cleanedUpdateData)) {
          if (/^(quote|issuedQuote|quotes$|paymentLink|amountReceived|amountRequested|outstanding|paymentVerified|paymentRecorded|paymentReceipt|paymentEntries|confirmationEmail|normalFarePence|discountPence|finalFarePence|paidAt$|terms)/.test(key)) {
            delete cleanedUpdateData[key];
          }
        }
        const originalStatus = effectiveWorkflowStatus(editingBooking);
        if (bookingData.status === originalStatus) {
          delete cleanedUpdateData.status;
          delete cleanedUpdateData.adminStatus;
          delete cleanedUpdateData.customerStatus;
        } else {
          cleanedUpdateData.adminStatus = bookingData.status;
          cleanedUpdateData.customerStatus = bookingData.status;
        }
        if (String(formData.actualFare || '') === String(editingBooking.actualFare || '')) delete cleanedUpdateData.actualFare;
        if (formData.paymentStatus === editingBooking.paymentStatus || editingBooking.quoteIssuedVersion) delete cleanedUpdateData.paymentStatus;
        if (formData.paymentMethod === editingBooking.paymentMethod) delete cleanedUpdateData.paymentMethod;
        cleanedUpdateData.name = hirerName;
        cleanedUpdateData.phone = bookingData.hirerPhone;
        cleanedUpdateData.pickup = bookingData.pickupLocation;
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
        let fareNote = '';
        let confirmNote = '';
        const needsPhoneAcceptance = Boolean(editingBooking.quoteIssuedVersion)
          && bookingData.status === 'confirmed'
          && editingBooking.quoteAcceptedVersion !== editingBooking.quoteIssuedVersion;
        if (needsPhoneAcceptance) {
          delete cleanedUpdateData.status;
          delete cleanedUpdateData.adminStatus;
          delete cleanedUpdateData.customerStatus;
        }
        await runTransaction(db, async transaction => {
          const ref = doc(db, 'bookings', bookingId);
          const latest = await transaction.get(ref);
          if (!latest.exists()) throw new Error('This booking no longer exists.');
          const current = latest.data() || {};
          const expectedRevision = Number((editingBooking as { revision?: number }).revision || 0);
          const storedRevision = Number(current.revision || 0);
          if (storedRevision !== expectedRevision) {
            throw new Error('This booking was saved in another session. Your edits are still on this screen. Reload the saved booking, then apply your changes again.');
          }
          const safeUpdate = { ...cleanedUpdateData, revision: storedRevision + 1 };
          if (current.quoteIssuedVersion) {
            for (const key of ['depositRequired', 'depositAmount', 'depositStatus', 'paymentStatus', 'paymentMethod']) delete safeUpdate[key];
            if (safeUpdate.actualFare !== undefined && Number(safeUpdate.actualFare) !== Number(current.actualFare)) {
              delete safeUpdate.actualFare;
              fareNote = 'Other details were saved. Use Save draft or Send quote to change the agreed fare on a quote that was already sent.';
            } else {
              delete safeUpdate.actualFare;
            }
            if (safeUpdate.status === 'confirmed') {
              const accepted = current.quoteAcceptedVersion === current.quoteIssuedVersion;
              const required = Number(current.issuedQuote?.amountRequestedPence || current.amountRequestedPence || 0);
              const advance = (current.issuedQuote?.paymentRequirement || current.paymentRequirement) === 'advance';
              const paidEnough = !advance || (required > 0 && Number(current.amountReceivedPence || 0) >= required);
              if (!accepted || !paidEnough) {
                delete safeUpdate.status;
                delete safeUpdate.adminStatus;
                delete safeUpdate.customerStatus;
                confirmNote = !accepted
                  ? 'The other details were saved. This booking was not confirmed. Set the status to Confirmed and save again so the customer acceptance is recorded.'
                  : 'The other details were saved. The customer acceptance is recorded. Record the required payment in Quote and payment before this booking can be confirmed.';
              }
            }
          }
          delete safeUpdate.createdAt;
          delete safeUpdate.confirmedAt;
          delete safeUpdate.completedAt;
          if (!formData.enquiryAt && current?.enquiryAt) safeUpdate.enquiryAt = deleteField();
          if (!reportedSource && current?.customerReportedSource) safeUpdate.customerReportedSource = deleteField();
          if (current?.websiteEnquiryRef) safeUpdate.websiteEnquiryRef = current.websiteEnquiryRef;
          const previousStatus = String(current?.status || '');
          if (safeUpdate.status && safeUpdate.status !== previousStatus) {
            if (['confirmed', 'allocated', 'completed'].includes(String(safeUpdate.status)) && !current?.confirmedAt) {
              safeUpdate.confirmedAt = serverTimestamp();
            }
            if (safeUpdate.status === 'completed' && !current?.completedAt) {
              safeUpdate.completedAt = serverTimestamp();
            }
          }
          if (cancellingSavedBooking) keepStoredItinerary(safeUpdate, current);
          if (!formData.pickupPlace) safeUpdate.pickupPlace = deleteField();
          if (!formData.destinationPlace) safeUpdate.destinationPlace = deleteField();
          transaction.update(ref, safeUpdate);
        });
        if (needsPhoneAcceptance && !confirmNote) {
          try {
            const recordManualAcceptance = httpsCallable(functions, 'recordManualAcceptance');
            const res = await recordManualAcceptance({ bookingId });
            const data = res.data as { status?: string; substatus?: string };
            if (data.substatus === 'awaiting_payment' || data.status !== 'confirmed') {
              confirmNote = 'The other details were saved and the customer acceptance is recorded. Record the required payment in Quote and payment before this booking can be confirmed.';
            }
          } catch (acceptError) {
            confirmNote = `The other details were saved. This booking was not confirmed. ${getCallableErrorMessage(acceptError)}`;
          }
        }
        if (confirmNote) setFormData((prev) => ({ ...prev, status: originalStatus as ExtendedBooking['status'] }));
        if (fareNote || confirmNote) window.alert([fareNote, confirmNote].filter(Boolean).join('\n\n'));
        console.log('✅ Booking updated successfully:', bookingId);
      } else {
        const createPayload: Record<string, unknown> = {};
        Object.entries(bookingData).forEach(([key, value]) => {
          if (value !== undefined && value !== null && key !== 'id') {
            createPayload[key] = value;
          }
        });
        createPayload.revision = 1;
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
      if (String(errorMessage).includes('saved in another session')) {
        alert(errorMessage);
        return;
      }
      alert(
        `Error saving booking: ${errorMessage}\n\nIf this says permission-denied, deploy the updated Firestore rules (firestore.rules) from the project root.`
      );
    }
  };

  if (!isOpen) return null;

  const requestClose = () => {
    if (dirty && !window.confirm('You have unsaved changes. Close without saving?')) return;
    onClose();
  };

  const showSection = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ block: 'start' });
  };
  const money = paymentSummary(Number(formData.actualFare) || 0, Number((editingBooking as { amountReceivedPence?: number } | null)?.amountReceivedPence) || 0, editingBooking?.paymentStatus);
  const airportNotes = airportCollectionNotes({
    airportCollection: Boolean(formData.airportCollection),
    returnAirportCollection: Boolean(formData.returnAirportCollection),
    pickupLocation: formData.pickupLocation,
    destination: formData.destination,
    returnPickupLocation: formData.returnPickupLocation,
    returnDestination: formData.returnDestination,
    hasReturn: formData.bookingType === 'return',
  });
  const selectedVehicle = availableVehicles.find((vehicle) => vehicle.id === formData.vehicleId);
  const vehicleDateNotes = selectedVehicle
    ? ([['MOT', selectedVehicle.compliance?.motExpiry], ['insurance', selectedVehicle.compliance?.insuranceExpiry], ['PH licence', selectedVehicle.compliance?.phLicenceExpiry], ['road tax', selectedVehicle.compliance?.taxExpiry]] as const)
      .filter(([, value]) => getExpiryStatus(value) === 'expired')
      .map(([label]) => `Stored ${label} date needs review. This is the date on file.`)
    : [];

  return (
    <div
      className="modal-overlay booking-drawer"
      onClick={requestClose}
      onKeyDown={(event) => {
        if (event.key === 'Escape') {
          event.preventDefault();
          requestClose();
        }
      }}
    >
      <div
        className="modal-content"
        role="dialog"
        aria-modal="true"
        aria-labelledby="booking-panel-title"
        ref={panelRef}
        tabIndex={-1}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="modal-header">
          <button className="modal-close" type="button" onClick={requestClose} aria-label="Close booking">×</button>
          <h3 className="modal-title" id="booking-panel-title">
            {editingBooking ? 'Edit Booking' : 'Create New Booking'}
          </h3>
          <p className="modal-subtitle">
            {editingBooking ? editingBooking.bookingNumber : 'New booking'}
            {' · '}
            {formData.pickupLocation || 'Pickup not set'} to {formData.destination || 'destination not set'}
          </p>
            <p className="booking-summary">{editingBooking ? `Outstanding £${(money.outstandingPence / 100).toFixed(2)}. ` : ''}Save draft does not email the customer or confirm the journey.</p>
          <nav className="booking-section-nav" aria-label="Booking sections">
            <button type="button" onClick={() => showSection('booking-section-customer')}>Customer</button>
            <button type="button" onClick={() => showSection('booking-section-journey')}>Journey</button>
            <button type="button" onClick={() => showSection('booking-section-fare')}>Fare</button>
            {editingBooking ? <button type="button" onClick={() => showSection('booking-section-documents')}>Communications</button> : null}
            {editingBooking ? <button type="button" onClick={() => showSection('booking-section-history')}>History</button> : null}
          </nav>
        </div>

        <form onSubmit={handleSubmit} onChange={() => setDirty(true)}>
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
                A return stays on this booking. It does not create a second booking.
              </p>
            </div>

            {customerSuggestions.length > 0 && (
              <datalist id="booking-past-customers">
                {customerSuggestions.map((c) => (
                  <option key={`${c.uid || c.email || c.phone}-${c.displayName}`} value={customerSuggestionLabel(c)} />
                ))}
              </datalist>
            )}

            <h4 id="booking-section-customer" className="text-md font-semibold text-gray-900 mb-3">Customer</h4>
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
                  <p className="text-xs text-gray-500 mt-1">Choose the customer row that shows their email. That fills the phone, address and email, and puts the job on their account when they have one.</p>
                )}
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number *</label>
                <input
                  type="tel"
                  value={formData.hirerPhone}
                  onChange={(e) => setFormData({ ...formData, hirerPhone: e.target.value })}
                  required={!(editingBooking as { guestRequest?: boolean } | null)?.guestRequest}
                  className="form-input"
                  autoComplete="tel"
                />
              </div>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Customer email</label>
              <input
                type="email"
                value={formData.email || ''}
                onChange={(e) => setFormData({ ...formData, email: e.target.value, hirerEmail: e.target.value })}
                className="form-input"
                autoComplete="email"
                placeholder="name@example.com"
              />
              {(editingBooking as { guestRequest?: boolean } | null)?.guestRequest && !editingBooking?.uid ? (
                <p className="text-xs text-gray-500 mt-1">This is a guest website request. Saving it does not add it to a customer account. The customer can claim this request after creating an account with this email. You can quote and confirm it without an account. Leave the email blank if they only gave a phone number.</p>
              ) : (
                <p className="text-xs text-gray-500 mt-1">The job is added to this email. If it matches an existing account, they will see it when they sign in. A confirmation is emailed here when the job is confirmed.</p>
              )}
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

            <details className="mb-6">
              <summary className="text-sm font-semibold text-gray-900">Booking source and dates</summary>
            <div className="mb-6 mt-3">
              <label className="block text-sm font-medium text-gray-700 mb-1">Recorded booking time</label>
              <input type="datetime-local" value={formData.dateTime} onChange={(e) => setFormData({ ...formData, dateTime: e.target.value })} className="form-input" />
            </div>
            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking source</label>
              <select
                value={formData.bookingMethod}
                onChange={(e) => setFormData({ ...formData, bookingMethod: e.target.value as any })}
                className="form-input"
              >
                <option value="telephone">Telephone</option>
                <option value="in person">In Person</option>
                <option value="internet">Internet</option>
              </select>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">Enquiry date and time</label>
              <input
                type="datetime-local"
                value={typeof formData.enquiryAt === "string" ? formData.enquiryAt : ""}
                onChange={(e) => setFormData({ ...formData, enquiryAt: e.target.value })}
                className="form-input"
              />
              <p className="text-xs text-gray-500 mt-1">When the customer first asked, if you know it. Leave this blank when you do not. This does not change the time the record was created.</p>
            </div>

            <div className="mb-6">
              <label className="block text-sm font-medium text-gray-700 mb-1">How the customer said they heard about us</label>
              <select
                value={formData.customerReportedSource || ''}
                onChange={(e) => setFormData({ ...formData, customerReportedSource: e.target.value as ExtendedBooking['customerReportedSource'] })}
                className="form-input"
              >
                <option value="">Not recorded</option>
                <option value="google_advert">Google advert</option>
                <option value="google_search">Google search</option>
                <option value="recommendation">Recommendation</option>
                <option value="repeat">Repeat customer</option>
                <option value="other">Other</option>
              </select>
              <p className="text-xs text-gray-500 mt-1">This is what the customer told you. It is not tracked advertising. The booking method above is the channel, such as telephone or WhatsApp.</p>
              {editingBooking?.websiteEnquiryRef ? <p className="text-xs text-gray-500 mt-1">Website reference: {editingBooking.websiteEnquiryRef}</p> : null}
            </div>
            </details>

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
              const setOutboundDateTime = (date: string, time: string) => {
                setFormData({ ...formData, pickupTime: combineLocalDateTime(date, time) });
              };
              const setReturnDateTime = (date: string, time: string) => {
                setFormData({ ...formData, returnPickupTime: combineLocalDateTime(date, time) });
              };
              return (
                <>
                  <div id="booking-section-journey" className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6">
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
                    <JourneyStopsEditor
                      addressesRequired={formData.status !== 'cancelled'}
                      extraStopsIncluded={Boolean((formData as { extraStopsIncludedInFare?: boolean }).extraStopsIncludedInFare)}
                      onExtraStopsIncluded={(included) => setFormData((prev) => ({ ...prev, extraStopsIncludedInFare: included }))}
                      stops={formData.stops?.length ? formData.stops : normaliseStops(undefined, formData.pickupLocation, formData.destination || '')}
                      onChange={(stops) => setFormData((prev) => ({
                        ...prev,
                        stops,
                        pickupLocation: stops[0]?.address || '',
                        destination: stops[stops.length - 1]?.address || '',
                        pickupPlace: (stops[0]?.place as ExtendedBooking['pickupPlace']) || null,
                        destinationPlace: (stops[stops.length - 1]?.place as ExtendedBooking['destinationPlace']) || null,
                      }))}
                    />
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Vehicle category</label>
                        <select
                          value={formData.vehicleType || ''}
                          onChange={(e) => setFormData({
                            ...formData,
                            vehicleType: e.target.value,
                            executiveAvailability: e.target.value === 'executive'
                              ? ((formData as { executiveAvailability?: string }).executiveAvailability || 'awaiting_confirmation')
                              : '',
                          })}
                          className="form-input"
                        >
                          <option value="">Choose a category</option>
                          {VEHICLE_TYPE_OPTIONS.filter((opt) => ['standard', 'executive', '8_seater'].includes(opt.value)).map((opt) => (
                            <option key={opt.value} value={opt.value}>{opt.label}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Passengers</label>
                        <input className="form-input" inputMode="numeric" value={formData.passengers ?? ''} onChange={(e) => setFormData({ ...formData, passengers: e.target.value === '' ? undefined : Number(e.target.value) })} />
                      </div>
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Luggage</label>
                        <input className="form-input" inputMode="numeric" value={formData.luggage ?? ''} onChange={(e) => setFormData({ ...formData, luggage: e.target.value })} />
                      </div>
                    </div>
                    {formData.vehicleType === 'executive' ? (
                      <p className="text-sm text-gray-700 mb-3">Mercedes E Class or equivalent. Heathrow only. A partner operator may provide the car. This is a request until availability is accepted.</p>
                    ) : null}
                    <label className="block text-sm font-medium text-gray-700 mb-1">Airport</label>
                    <select
                      className="form-input mb-3"
                      value={formData.airportCollection ? 'collection' : formData.airportDropOff ? 'dropoff' : 'none'}
                      onChange={(e) => setFormData({
                        ...formData,
                        airportCollection: e.target.value === 'collection',
                        airportDropOff: e.target.value === 'dropoff',
                        flightNumber: e.target.value === 'collection' ? formData.flightNumber : '',
                        terminal: e.target.value === 'collection' ? formData.terminal : '',
                        landingTime: e.target.value === 'collection' ? formData.landingTime : '',
                      })}
                    >
                      <option value="none">No airport details</option>
                      <option value="dropoff">Airport drop off</option>
                      <option value="collection">Airport collection</option>
                    </select>
                    {formData.airportCollection && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-3">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Flight number</label>
                          <input type="text" value={formData.flightNumber || ''} onChange={(e) => setFormData({ ...formData, flightNumber: e.target.value })} className="form-input" placeholder="BA123" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Terminal</label>
                          <input type="text" value={formData.terminal || ''} onChange={(e) => setFormData({ ...formData, terminal: e.target.value })} className="form-input" />
                        </div>
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled landing time</label>
                          <input type="time" value={formData.landingTime || ''} onChange={(e) => setFormData({ ...formData, landingTime: e.target.value })} className="form-input" />
                          <p className="text-xs text-gray-600 mt-1">Scheduled landing time. The pickup time above is when the driver should arrive.</p>
                        </div>
                      </div>
                    )}
                  </div>

                  {formData.bookingType === 'return' && (
                    <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-6">
                      <div className="flex items-center mb-3">
                        <Clock className="w-5 h-5 text-blue-700 mr-2" />
                        <h4 className="text-md font-semibold text-blue-900">Return journey *</h4>
                      </div>
                      <div className="flex flex-wrap gap-4 mb-4">
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                          <input type="radio" name="return-time-choice" checked={formData.openReturn !== true} onChange={() => setFormData({ ...formData, openReturn: false })} />
                          Set return pickup time
                        </label>
                        <label className="flex items-center gap-2 text-sm text-gray-800">
                          <input type="radio" name="return-time-choice" checked={formData.openReturn === true} onChange={() => setFormData({ ...formData, openReturn: true, returnDate: formData.returnDate || ret.date, returnPickupTime: '' })} />
                          Return time to be confirmed
                        </label>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-4">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Date *</label>
                          <input
                            type="date"
                            value={formData.openReturn ? (formData.returnDate || ret.date) : ret.date}
                            onChange={(e) => setFormData({ ...formData, returnDate: e.target.value, returnPickupTime: formData.openReturn || !ret.time ? '' : combineLocalDateTime(e.target.value, ret.time) })}
                            required
                            className="form-input"
                          />
                        </div>
                        {formData.openReturn !== true ? (
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
                        ) : (
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Pickup time, if now known</label>
                            <input
                              type="time"
                              value={ret.time}
                              onChange={(e) => setFormData({ ...formData, returnPickupTime: e.target.value ? combineLocalDateTime(formData.returnDate || ret.date, e.target.value) : '' })}
                              className="form-input"
                            />
                          </div>
                        )}
                      </div>
                      {formData.openReturn === true ? (
                        <>
                          <p className="text-sm text-blue-900 mb-3">{OPEN_RETURN_NOTICE}</p>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Notice note, optional</label>
                          <input className="form-input mb-4" value={formData.returnNoticeNote || ''} placeholder="Customer will contact the driver when ready" onChange={(e) => setFormData({ ...formData, returnNoticeNote: e.target.value })} />
                        </>
                      ) : null}
                      <JourneyStopsEditor
                        addressesRequired={formData.status !== 'cancelled' && formData.returnStatus !== 'cancelled'}
                        extraStopsIncluded={Boolean((formData as { returnExtraStopsIncludedInFare?: boolean }).returnExtraStopsIncludedInFare)}
                        onExtraStopsIncluded={(included) => setFormData((prev) => ({ ...prev, returnExtraStopsIncludedInFare: included }))}
                        stops={formData.returnStops?.length ? formData.returnStops : normaliseStops(undefined, formData.returnPickupLocation || '', formData.returnDestination || '')}
                        onChange={(stops) => setFormData((prev) => ({
                          ...prev,
                          returnStops: stops,
                          returnPickupLocation: stops[0]?.address || '',
                          returnDestination: stops[stops.length - 1]?.address || '',
                        }))}
                      />
                      <label className="block text-sm font-medium text-gray-700 mb-1">Airport</label>
                      <select
                        className="form-input mb-3"
                        value={formData.returnAirportCollection ? 'collection' : 'none'}
                        onChange={(e) => setFormData({
                          ...formData,
                          returnAirportCollection: e.target.value === 'collection',
                          returnFlightNumber: e.target.value === 'collection' ? formData.returnFlightNumber : '',
                          returnTerminal: e.target.value === 'collection' ? formData.returnTerminal : '',
                          returnLandingTime: e.target.value === 'collection' ? formData.returnLandingTime : '',
                        })}
                      >
                        <option value="none">Airport drop off or no flight</option>
                        <option value="collection">Airport collection</option>
                      </select>
                      {formData.returnAirportCollection && (
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Flight number</label>
                            <input type="text" value={formData.returnFlightNumber || ''} onChange={(e) => setFormData({ ...formData, returnFlightNumber: e.target.value })} className="form-input" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Terminal</label>
                            <input type="text" value={formData.returnTerminal || ''} onChange={(e) => setFormData({ ...formData, returnTerminal: e.target.value })} className="form-input" />
                          </div>
                          <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Scheduled landing time</label>
                            <input type="time" value={formData.returnLandingTime || ''} onChange={(e) => setFormData({ ...formData, returnLandingTime: e.target.value })} className="form-input" />
                          </div>
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
            {airportNotes.map((note) => <p key={note} className="text-sm text-amber-800 mb-2">{note}</p>)}

            <details id="booking-section-allocation" className="mb-6">
              <summary className="text-md font-semibold text-gray-900">Additional details</summary>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6 mt-3">
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
                {vehicleDateNotes.map((note) => <p key={note} className="text-xs text-amber-800 mt-1">{note}</p>)}
              </div>
              {hasTimedReturn({ ...formData, returnPickupTime: formData.openReturn ? '' : formData.returnPickupTime }) ? (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Return driver</label>
                  <select
                    value={formData.returnDriverId || ''}
                    onChange={(e) => setFormData({ ...formData, returnDriverId: e.target.value })}
                    className="form-input"
                  >
                    <option value="">Driver not confirmed</option>
                    {activeDrivers.map(driver => (
                      <option key={`return-${driver.id}`} value={driver.id}>{driver.name}</option>
                    ))}
                  </select>
                  <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Return status</label>
                  <select
                    value={formData.returnStatus || ''}
                    onChange={(e) => setFormData({ ...formData, returnStatus: e.target.value as ExtendedBooking['returnStatus'] })}
                    className="form-input"
                  >
                    <option value="">Not recorded</option>
                    <option value="confirmed">Confirmed</option>
                    <option value="allocated">Allocated</option>
                    <option value="needs_review">Needs review</option>
                    <option value="completed">Completed</option>
                    <option value="cancelled">Cancelled</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">Completing the outbound does not complete the return. The fare stays on this booking.</p>
                  {editingBooking && proposedLegacyReturnCorrection(editingBooking) ? (
                    <p className="text-xs text-amber-700 mt-1">This return was not marked completed. Saving other details does not change the stored status until a return status is chosen.</p>
                  ) : null}
                </div>
              ) : null}
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
                  <option value="awaiting_customer_confirmation">Awaiting customer confirmation</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="allocated">Allocated</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
                <p className="text-sm text-gray-600 mt-1">Confirmed records that the customer accepted, including by phone.</p>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Subcontract operator</label>
                <input
                  type="text"
                  value={formData.subContract || ''}
                  onChange={(e) => setFormData({ ...formData, subContract: e.target.value })}
                  className="form-input"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Agreed supplier cost (£)</label>
                <input
                  type="number"
                  step="0.01"
                  value={(formData as { supplierCostPence?: number }).supplierCostPence ? ((formData as { supplierCostPence?: number }).supplierCostPence || 0) / 100 : ''}
                  onChange={(e) => setFormData({ ...formData, supplierCostPence: e.target.value === '' ? 0 : Math.round(Number(e.target.value) * 100) } as ExtendedBooking)}
                  className="form-input"
                />
                <label className="block text-sm font-medium text-gray-700 mb-1 mt-3">Supplier reference</label>
                <input
                  type="text"
                  value={(formData as { subcontractReference?: string }).subcontractReference || ''}
                  onChange={(e) => setFormData({ ...formData, subcontractReference: e.target.value } as ExtendedBooking)}
                  className="form-input"
                />
                <label className="flex items-center gap-2 text-sm text-gray-800 mt-3">
                  <input type="checkbox" checked={Boolean((formData as { subcontractAccepted?: boolean }).subcontractAccepted)} onChange={(e) => setFormData({ ...formData, subcontractAccepted: e.target.checked } as ExtendedBooking)} />
                  Supplier accepted
                </label>
              </div>
              <div className="md:col-span-2">
                <label className="block text-sm font-medium text-gray-700 mb-1">Pickup and driver instructions</label>
                <textarea value={formData.notes || ''} onChange={(e) => setFormData({ ...formData, notes: e.target.value })} rows={3} className="form-input" />
              </div>
            </div>
            </details>

            <div id="booking-section-fare" className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 mb-6">
              <div className="flex items-center mb-3">
                <Calculator className="w-5 h-5 text-yellow-600 mr-2" />
                <h4 className="text-md font-semibold text-yellow-900">Fare</h4>
              </div>
              {editingBooking?.id ? (
                <QuoteEditor
                  bookingId={editingBooking.id}
                  form={{
                    actualFare: String(formData.actualFare || ''),
                    vehicleType: formData.vehicleType || '',
                    paymentMethod: formData.paymentMethod || 'cash',
                    depositRequired: formData.depositRequired === true,
                    depositAmount: String(formData.depositAmount || ''),
                    pickupLocation: formData.pickupLocation || '',
                    destination: formData.destination || '',
                    pickupTime: formData.pickupTime || formData.dateTime || '',
                    bookingType: formData.bookingType || 'one_way',
                    returnPickupLocation: formData.returnPickupLocation || '',
                    returnDestination: formData.returnDestination || '',
                    returnPickupTime: formData.returnPickupTime || '',
                    passengers: (formData as { passengers?: number }).passengers,
                    status: formData.status,
                  }}
                  onChange={(patch) => setFormData((prev) => ({ ...prev, ...patch }) as ExtendedBooking)}
                  onWorkflowStatus={(status) => setFormData((prev) => ({ ...prev, status: status as ExtendedBooking['status'] }))}
                />
              ) : (
              <>
              <p className="text-sm text-gray-800 mb-3">This agreed total covers {formData.bookingType === 'return' ? 'both journeys.' : 'the one way journey.'}</p>
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
                  <details className="text-xs text-gray-500 mt-1">
                    <summary>Fare guidance</summary>
                    {formData.vehicleType === 'executive' ? (
                      <p>Executive Heathrow fares are per vehicle, either direction. Oxford £150 one way or £290 return. Abingdon £165 or £320. Didcot, Bicester and Witney £170 or £330. Other areas are an individual fixed quote. Other airports are not available. The fare stays a proposal until availability is accepted. Do not change a fare that has already been agreed.</p>
                    ) : (
                      <p>Published airport prices are for Oxford only. Quote Abingdon, Kidlington, Witney, Bicester, Didcot and other towns separately. Do not change a fare that has already been agreed.</p>
                    )}
                  </details>
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
                    <option value="pending">Unpaid</option>
                    <option value="partial">Part paid</option>
                    <option value="paid">Paid</option>
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

              <label className="block text-sm font-medium text-gray-700 mb-1">Shift4 payment link, optional</label>
              <input className="form-input mb-4" value={(formData as { paymentLinkUrl?: string }).paymentLinkUrl || ''} placeholder="https://" onChange={(e) => setFormData({ ...formData, paymentLinkUrl: e.target.value } as ExtendedBooking)} />
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4">
                {formData.vehicleType === 'executive' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Executive availability</label>
                  <select
                    value={(formData as { executiveAvailability?: string }).executiveAvailability || 'awaiting_confirmation'}
                    onChange={(e) => setFormData({ ...formData, executiveAvailability: e.target.value } as ExtendedBooking)}
                    className="form-input"
                  >
                    <option value="awaiting_confirmation">Awaiting availability confirmation</option>
                    <option value="accepted">Accepted</option>
                  </select>
                  <p className="text-xs text-gray-500 mt-1">
                    {(formData as { executiveFareStatus?: string }).executiveFareStatus === 'quote_required'
                      ? 'No published Executive fare. Quote this journey individually after acceptance.'
                      : (formData as { proposedFarePounds?: number }).proposedFarePounds
                        ? `Published fare £${Number((formData as { proposedFarePounds?: number }).proposedFarePounds).toFixed(0)}. Not agreed until you accept availability.`
                        : 'A request until you accept availability. Do not take payment before then.'}
                  </p>
                </div>
                )}
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
              </>
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

            {editingBooking ? <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-6">
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
            </div> : null}

            {editingBooking ? <div id="booking-section-history" className="mb-6">
              <h4 className="text-md font-semibold text-gray-900 mb-2">History</h4>
              <p className="text-sm text-gray-600">Status {effectiveWorkflowStatus(editingBooking)}. Payment {editingBooking.paymentStatus || 'not recorded'}.</p>
            </div> : null}

            {editingBooking ? <div id="booking-section-documents" className="mb-6">
              <h4 className="text-md font-semibold text-gray-900 mb-2">Communications</h4>
              <p className="text-sm text-gray-600 mb-3">Saving does not send a quote, confirmation, payment request, or reminder. The recipient is {formData.email || formData.hirerEmail || 'not recorded yet'}.</p>
              <button type="button" className="btn btn-secondary btn-sm mb-3" onClick={() => showSection('booking-section-fare')}>Open fare and message actions</button>
              {editingBooking?.heardAbout ? (
                <p className="text-sm text-gray-700 mb-3">How they heard about us: {heardAboutText(editingBooking.heardAbout, editingBooking.heardAboutDetail)}. This is what the customer chose on the website form.</p>
              ) : null}
            </div> : null}
          </div>

          <TermsAcceptance booking={editingBooking || {}} />

          <div className="modal-footer">
            {formError ? (
              <p className="text-sm" style={{ color: '#b91c1c', marginRight: 'auto' }}>{formError}</p>
            ) : null}
            {dirty ? <p className="text-sm" style={{ marginRight: 'auto' }}>Unsaved changes</p> : null}
            <button
              type="button"
              onClick={requestClose}
              className="btn btn-secondary"
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
            >
              {editingBooking ? 'Update Booking' : 'Save draft'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BookingModal;
