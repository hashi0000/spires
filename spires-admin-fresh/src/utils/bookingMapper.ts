import { effectiveWorkflowStatus } from './bookingWorkflow';
// bookingMapper.ts - Maps between customer app and admin app booking formats
import { Booking } from '../types/types';

/**
 * Customer app booking format (from customer-app)
 */
export interface CustomerBooking {
  id?: string;
  uid?: string;
  name?: string;
  email?: string;
  phone?: string;
  pickup?: string;
  destination?: string;
  dateTime?: string | Date | any; // Can be Firestore Timestamp, string, or Date
  date?: string;
  time?: string;
  passengers?: number;
  notes?: string;
  status?: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'paid' | 'cancelled';
  customerStatus?: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'paid' | 'cancelled';
  createdAt?: any;
  updatedAt?: any;
  actualFare?: number;
  paymentStatus?: string;
  paymentMethod?: string;
  expenses?: any[];
  returnTrip?: boolean;
  returnDateTime?: string;
  flightNumber?: string;
  terminal?: string;
  vehicleType?: string;
  depositRequired?: boolean;
  depositAmount?: number;
  depositStatus?: string;
  luggage?: number;
}

/**
 * Converts a customer booking to admin booking format
 */
export const mapCustomerToAdminBooking = (customerBooking: CustomerBooking): Partial<Booking> => {
  // Extract date/time from dateTime or separate date/time fields
  let pickupTime = '';
  let dateTime = '';

  if (customerBooking.dateTime) {
    // Handle Firestore Timestamp
    if (customerBooking.dateTime.toDate) {
      const dt = customerBooking.dateTime.toDate();
      pickupTime = dt.toISOString();
      dateTime = dt.toISOString();
    } else if (typeof customerBooking.dateTime === 'string') {
      pickupTime = customerBooking.dateTime;
      dateTime = customerBooking.dateTime;
    } else if (customerBooking.dateTime instanceof Date) {
      pickupTime = customerBooking.dateTime.toISOString();
      dateTime = customerBooking.dateTime.toISOString();
    }
  } else if (customerBooking.date && customerBooking.time) {
    // Fallback to separate date/time
    const combined = `${customerBooking.date}T${customerBooking.time}`;
    pickupTime = new Date(combined).toISOString();
    dateTime = new Date(combined).toISOString();
  } else {
    // Use createdAt as fallback
    const fallbackDate = customerBooking.createdAt?.toDate 
      ? customerBooking.createdAt.toDate() 
      : new Date();
    pickupTime = fallbackDate.toISOString();
    dateTime = fallbackDate.toISOString();
  }

  // Keep pending as pending - admin will confirm it
  // Customer-facing status is mapped separately below to adminStatus.

  // Generate booking number if missing
  const bookingNumber = customerBooking.id 
    ? `CUST${customerBooking.id.slice(0, 6).toUpperCase()}`
    : `CUST${Date.now().toString().slice(-6)}`;

  // Map customer status to admin status, but preserve customer status
  let customerStatus = customerBooking.customerStatus || customerBooking.status || 'pending';
  const direct = effectiveWorkflowStatus(customerBooking);
  let adminStatus: Booking['status'] = 'pending';
  if (
    direct === 'pending' ||
    direct === 'awaiting_customer_confirmation' ||
    direct === 'confirmed' ||
    direct === 'allocated' ||
    direct === 'completed' ||
    direct === 'cancelled'
  ) {
    adminStatus = direct;
    if (customerStatus === 'confirmed' && (direct === 'allocated' || direct === 'completed')) {
      adminStatus = direct;
    }
  } else if (customerStatus === 'paid') {
    adminStatus = 'completed';
  } else if (customerStatus === 'cancelled') {
    adminStatus = 'cancelled';
  }

  return {
    id: customerBooking.id,
    bookingNumber,
    dateTime,
    hirerName: customerBooking.name || 'Customer',
    hirerAddress: '', // Customer app doesn't collect address
    hirerPhone: customerBooking.phone || '',
    bookingMethod: 'internet', // Customer bookings are always from internet
    pickupTime,
    pickupLocation: customerBooking.pickup || '',
    destination: customerBooking.destination || '',
    status: adminStatus,
    notes: customerBooking.notes || '',
    actualFare: customerBooking.actualFare,
    paymentMethod: customerBooking.paymentMethod as any,
    paymentStatus: customerBooking.paymentStatus as any,
    expenses: customerBooking.expenses || [],
    createdAt: customerBooking.createdAt?.toDate 
      ? customerBooking.createdAt.toDate() 
      : (customerBooking.createdAt || new Date()),
    updatedAt: customerBooking.updatedAt?.toDate 
      ? customerBooking.updatedAt.toDate() 
      : (customerBooking.updatedAt || new Date()),
    // Preserve customer info
    uid: customerBooking.uid,
    email: customerBooking.email,
    passengers: customerBooking.passengers,
    returnTrip: customerBooking.returnTrip,
    returnDateTime: customerBooking.returnDateTime,
    flightNumber: customerBooking.flightNumber,
    terminal: customerBooking.terminal,
    vehicleType: customerBooking.vehicleType,
    depositRequired: customerBooking.depositRequired === true,
    depositAmount: customerBooking.depositAmount,
    depositStatus: customerBooking.depositStatus,
    bookingType: (customerBooking as any).bookingType,
    airportCollection: (customerBooking as any).airportCollection === true,
    returnPickupTime: (customerBooking as any).returnPickupTime,
    returnPickupLocation: (customerBooking as any).returnPickupLocation,
    returnDestination: (customerBooking as any).returnDestination,
    returnAirportCollection: (customerBooking as any).returnAirportCollection === true,
    returnFlightNumber: (customerBooking as any).returnFlightNumber,
    dueOnOutbound: (customerBooking as any).dueOnOutbound,
    dueOnReturn: (customerBooking as any).dueOnReturn,
    customerStatus: customerStatus,
    adminStatus,
    promotion: (customerBooking as any).promotion,
    issuedQuote: (customerBooking as any).issuedQuote,
    quoteIssuedVersion: (customerBooking as any).quoteIssuedVersion,
    quoteAcceptedVersion: (customerBooking as any).quoteAcceptedVersion,
    quoteAcceptanceSubstatus: (customerBooking as any).quoteAcceptanceSubstatus,
    paymentLinkUrl: (customerBooking as any).paymentLinkUrl,
    paymentLinkEmailStatus: (customerBooking as any).paymentLinkEmailStatus,
    quoteEmailStatus: (customerBooking as any).quoteEmailStatus,
    amountRequestedPence: (customerBooking as any).amountRequestedPence,
    amountReceivedPence: (customerBooking as any).amountReceivedPence,
    paymentRequirement: (customerBooking as any).paymentRequirement,
    paymentDescription: (customerBooking as any).paymentDescription,
    normalFarePence: (customerBooking as any).normalFarePence,
    discountPence: (customerBooking as any).discountPence,
    finalFarePence: (customerBooking as any).finalFarePence,
    emailError: (customerBooking as any).emailError,
    quoteDraft: (customerBooking as any).quoteDraft,
    quoteEmailSentAt: (customerBooking as any).quoteEmailSentAt,
    paymentLinkSentAt: (customerBooking as any).paymentLinkSentAt,
    confirmationEmailStatus: (customerBooking as any).confirmationEmailStatus,
    confirmationEmailSentAt: (customerBooking as any).confirmationEmailSentAt,
    paymentReceiptEmailStatus: (customerBooking as any).paymentReceiptEmailStatus,
    outstandingPence: (customerBooking as any).outstandingPence,
    termsAccepted: (customerBooking as any).termsAccepted === true,
    termsVersion: (customerBooking as any).termsVersion,
    termsAcceptedAt: (customerBooking as any).termsAcceptedAt,
    acceptanceMethod: (customerBooking as any).acceptanceMethod,
    termsAcceptanceRecordedAt: (customerBooking as any).termsAcceptanceRecordedAt,
    termsAcceptanceRecordedBy: (customerBooking as any).termsAcceptanceRecordedBy,
    termsAcceptanceNote: (customerBooking as any).termsAcceptanceNote,
  } as Partial<Booking>;
};

/**
 * Checks if a booking is from customer app (has uid field)
 */
export const isCustomerBooking = (booking: any): boolean => {
  return !!(booking.uid || (!booking.bookingNumber && booking.pickup && !booking.pickupLocation));
};

/**
 * Normalizes a booking to admin format (handles both customer and admin formats)
 */
export const normalizeBooking = (booking: any): Booking => {
  // If it's already in admin format (has bookingNumber, pickupLocation, hirerName)
  // but might be a customer booking that was already mapped
  if (booking.bookingNumber && booking.pickupLocation && booking.hirerName) {
    // Check if it's a customer booking - if so, preserve customer status fields
    if (isCustomerBooking(booking)) {
      // Preserve customer status and admin status separately
      const normalized = booking as Booking;
      // Keep customerStatus if it exists
      (normalized as any).customerStatus = booking.customerStatus || booking.status;
      return normalized;
    }
    return booking as Booking;
  }

  // If it's a customer booking, map it
  if (isCustomerBooking(booking)) {
    return mapCustomerToAdminBooking(booking) as Booking;
  }

  // Fallback: try to construct admin format from available data
  return {
    ...booking,
    bookingNumber: booking.bookingNumber || `UNK${Date.now().toString().slice(-6)}`,
    pickupLocation: booking.pickupLocation || booking.pickup || '',
    hirerName: booking.hirerName || booking.name || 'Unknown',
    hirerPhone: booking.hirerPhone || booking.phone || '',
    status: booking.status || 'pending',
  } as Booking;
};

