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
  flightNumber?: string;
  driverId?: string;
  vehicleId?: string;
  subContract?: string;
  status: 'pending' | 'confirmed' | 'allocated' | 'completed' | 'cancelled';
  notes?: string;
  allocatedTime?: string;
  actualFare?: number;
  paymentMethod?: 'cash' | 'card' | 'bank transfer' | 'account';
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
  linkedAt?: Date; // Timestamp when booking was linked to customer
  linkedBy?: string; // Admin email/uid who linked the booking
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
  customerStatus?: 'pending' | 'confirmed' | 'paid' | 'cancelled';
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