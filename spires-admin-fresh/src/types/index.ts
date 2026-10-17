// types.ts - Add these to your existing types file

export interface Driver {
  id?: string;
  name: string;
  licenseNumber: string;
  phoneNumber: string;
  email: string;
  active: boolean;
  licenseExpiry: string;
  address: string;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface Vehicle {
  id?: string;
  registration: string;
  make: string;
  model: string;
  year: string;
  color: string;
  available: boolean;
  notes: string;
  createdAt?: Date;
  updatedAt?: Date;
}

// Updated Booking interface with new fields
export interface TripExpense {
  id: number;
  type: 'fuel' | 'parking' | 'tolls' | 'maintenance' | 'cleaning' | 'other';
  amount: number;
  description?: string;
}

export interface Booking {
  id?: string;
  bookingNumber: string;
  dateTime: string;
  hirerName: string;
  hirerAddress: string;
  hirerPhone: string;
  bookingMethod: 'telephone' | 'in_person' | 'internet';
  pickupTime: string;
  pickupLocation: string;
  destination: string;
  driverId?: string;
  vehicleId?: string;
  subContract?: string;
  status: 'pending' | 'allocated' | 'completed' | 'cancelled';
  notes?: string;
  allocatedTime?: string;
  
  // New fare and payment fields
  actualFare?: number;
  paymentMethod?: 'cash' | 'card' | 'bank_transfer' | 'account' | 'tbc' | 'undecided';
  paymentStatus?: 'pending' | 'paid' | 'partial' | 'refunded';
  expenses?: TripExpense[];
  
  createdAt?: Date;
  updatedAt?: Date;
}