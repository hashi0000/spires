// types.ts - Put this in a separate file
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
  createdAt?: Date;
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
  driverId?: string;
  vehicleId?: string;
  subContract?: string;
  status: 'pending' | 'confirmed' | 'allocated' | 'completed' | 'cancelled';
  notes?: string;
  allocatedTime?: string;
  actualFare?: number;
  paymentMethod?: 'cash' | 'card' | 'bank transfer' | 'account';
  paymentStatus?: 'pending' | 'paid' | 'partial' | 'refunded';
  expenses?: TripExpense[];
  createdAt?: Date;
  updatedAt?: Date;
  customerId?: string; // Firestore ID of the customer document
  linkedAt?: Date; // Timestamp when booking was linked to customer
  linkedBy?: string; // Admin email/uid who linked the booking
}

// Extended booking interface for form handling
export interface ExtendedBooking extends Omit<Booking, 'actualFare'> {
  actualFare?: number | string;
  // Customer booking fields (from customer app)
  uid?: string;
  email?: string;
  passengers?: number;
  customerStatus?: 'pending' | 'confirmed' | 'paid' | 'cancelled';
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