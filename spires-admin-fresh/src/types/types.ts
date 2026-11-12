// types.ts - Put this in a separate file

/** Stored under `documents` on the driver; extra keys reserved for insurance, MOT, etc. */
export interface DriverDocuments {
  driverLicenceUrl?: string;
  privateHireLicenceUrl?: string;
  motDocumentUrl?: string;
  [key: string]: string | undefined;
}

export interface DriverLicensing {
  badgeNumber?: string;
  badgeExpiry?: string;
}

export interface DriverCompliance {
  dbsExpiry?: string;
  safeguardingExpiry?: string;
  /** Subscribed to the DBS Update Service (annual subscription — status checked online). */
  dbsUpdateService?: boolean;
}

export interface Driver {
  id?: string;
  name: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  active: boolean;
  licenseExpiry: string;
  address?: string;
  notes?: string;
  createdAt?: Date;
  updatedAt?: Date;
  licensing?: DriverLicensing;
  compliance?: DriverCompliance;
  documents?: DriverDocuments;
  /** When absent in Firestore, treat as false in UI. */
  isSchoolApproved?: boolean;
}

export interface VehicleCompliance {
  motExpiry?: string;
  insuranceExpiry?: string;
  phLicenceExpiry?: string;
  taxExpiry?: string;
}

export interface Vehicle {
  id?: string;
  registration: string;
  make: string;
  model: string;
  year: string;
  color: string;
  available: boolean;
  notes?: string;
  seats?: number;
  compliance?: VehicleCompliance;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface TripExpense {
  id: number;
  type: 'fuel' | 'parking' | 'tolls' | 'maintenance' | 'cleaning' | 'other';
  amount: number;
  description: string;
}

export interface Booking {
  id?: string;
  bookingNumber: string;
  dateTime: string;
  hirerName: string;
  hirerAddress: string;
  hirerPhone: string;
  bookingMethod: 'telephone' | 'in person' | 'internet';
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  pickupPlace?: { label: string; placeId?: string; postcode?: string; latitude?: number | null; longitude?: number | null; premise?: string } | null;
  stops?: { id: string; type: 'pickup' | 'dropoff'; address: string; notes?: string; place?: Record<string, unknown> | null }[];
  returnStops?: { id: string; type: 'pickup' | 'dropoff'; address: string; notes?: string; place?: Record<string, unknown> | null }[];
  extraStops?: boolean;
  openReturn?: boolean;
  returnDate?: string;
  returnNoticeNote?: string;
  destinationPlace?: { label: string; placeId?: string; postcode?: string; latitude?: number | null; longitude?: number | null; premise?: string } | null;
  flightNumber?: string;
  driverId?: string;
  /** Driver for the return leg. Empty means the return driver is not confirmed. */
  returnDriverId?: string;
  vehicleId?: string;
  subContract?: string;
  status: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'cancelled';
  /** Workflow status shown to staff when it differs from the stored customer status. */
  adminStatus?: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'cancelled';
  /** Set when the outbound is completed separately from the return. Missing on older records. */
  outboundStatus?: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'cancelled' | 'needs_review';
  /** Set when the return is confirmed separately from the outbound. Missing means it still follows the booking status. */
  returnStatus?: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'cancelled' | 'needs_review';
  quoteAcceptanceSubstatus?: '' | 'awaiting_payment';
  notes?: string;
  allocatedTime?: string;
  actualFare?: number;
  paymentMethod?: 'cash' | 'card' | 'bank transfer' | 'account' | 'tbc' | 'undecided';
  amountReceivedPence?: number;
  amountRequestedPence?: number;
  outstandingPence?: number;
  quoteEmailStatus?: string;
  paymentLinkEmailStatus?: string;
  quoteIssuedVersion?: number;
  paymentStatus?: 'pending' | 'paid' | 'partial' | 'refunded';
  vehicleType?: 'standard' | '8_seater' | string;
  depositRequired?: boolean;
  depositAmount?: number;
  depositStatus?: 'not_required' | 'pending' | 'paid' | string;
  /** Same-booking return. Missing on older records = one_way. */
  bookingType?: 'one_way' | 'return';
  /** Outbound/primary leg is an airport collection (not merely an airport drop-off). */
  airportCollection?: boolean;
  returnPickupTime?: string;
  returnDateTime?: string;
  returnTrip?: boolean;
  returnPickupLocation?: string;
  returnDestination?: string;
  returnAirportCollection?: boolean;
  returnFlightNumber?: string;
  dueOnOutbound?: number;
  dueOnReturn?: number;
  expenses?: TripExpense[];
  createdAt?: Date;
  updatedAt?: Date;
  customerId?: string; // Firestore ID of the customer document
  /** Present on website / customer-app bookings. Family jobs omit this. */
  uid?: string;
  linkedAt?: Date; // Timestamp when booking was linked to customer
  linkedBy?: string; // Admin email/uid who linked the booking
  /** family = added from Family Job Manager. Website bookings omit this. */
  source?: 'family' | 'admin' | 'website' | string;
  createdByEmail?: string;
  createdByUid?: string;
  updatedByEmail?: string;
  updatedByUid?: string;
  cancelledAt?: string;
  cancelledByEmail?: string;
  cancelledByUid?: string;
  termsAccepted?: boolean;
  termsVersion?: string;
  termsAcceptedAt?: Date | string | { toDate?: () => Date; seconds?: number };
  acceptanceMethod?: string;
  termsAcceptanceRecordedAt?: Date | string | { toDate?: () => Date; seconds?: number };
  termsAcceptanceRecordedBy?: string;
  termsAcceptanceNote?: string;
  /** Answer from the website booking form. Missing when the customer left it blank. */
  heardAbout?: string;
  heardAboutDetail?: string;
  /** When the customer first enquired, if the office knows it. This is not the record creation time. */
  enquiryAt?: Date | string;
  /** Set once, when the booking first becomes confirmed, allocated or completed. */
  confirmedAt?: Date | string;
  /** Set once, when the booking first becomes completed. */
  completedAt?: Date | string;
  /** Opaque website reference from a WhatsApp prefill. Not a click id. */
  websiteEnquiryRef?: string;
  /** What the customer told the office. This is not tracked advertising. */
  customerReportedSource?: '' | 'google_advert' | 'google_search' | 'recommendation' | 'repeat' | 'other';
}

// Extended booking interface for form handling
export interface ExtendedBooking extends Omit<Booking, 'actualFare' | 'depositAmount' | 'dueOnOutbound' | 'dueOnReturn'> {
  actualFare?: number | string;
  // Customer booking fields (from customer app)
  uid?: string;
  email?: string;
  /** When set (e.g. admin-entered), used for emailing PDFs alongside `email`. */
  hirerEmail?: string;
  passengers?: number;
  customerStatus?: 'pending' | 'awaiting_customer_confirmation' | 'confirmed' | 'allocated' | 'completed' | 'paid' | 'cancelled';
  returnTrip?: boolean;
  returnDateTime?: string;
  flightNumber?: string;
  terminal?: string;
  vehicleType?: 'standard' | '8_seater' | string;
  depositRequired?: boolean;
  depositAmount?: number | string;
  depositStatus?: 'not_required' | 'pending' | 'paid' | string;
  bookingType?: 'one_way' | 'return';
  airportCollection?: boolean;
  returnPickupTime?: string;
  returnPickupLocation?: string;
  returnDestination?: string;
  returnAirportCollection?: boolean;
  returnFlightNumber?: string;
  dueOnOutbound?: number | string;
  dueOnReturn?: number | string;
}

// Customer interface (from customers collection)
export interface Customer {
  id: string; // Firestore document ID (user uid)
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  dateOfBirth?: string;
  addresses?: Array<{
    firstLine: string;
    postcode?: string;
    county?: string;
    nickname: string;
    createdAt?: Date;
  }>;
  createdAt?: Date;
  updatedAt?: Date;
}