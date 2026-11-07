// constants.ts - Put this in a separate file
import { Calendar, Car, FileText, Users, Link2, UserCircle, Receipt, DollarSign, Share2 } from 'lucide-react';

export const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: Calendar, quiet: false },
  { id: 'bookings', name: 'Bookings', icon: FileText, quiet: false },
  { id: 'customers', name: 'Customers', icon: UserCircle, quiet: false },
  { id: 'drivers', name: 'Drivers', icon: Users, quiet: false },
  { id: 'vehicles', name: 'Vehicles', icon: Car, quiet: false },
  { id: 'invoices', name: 'Invoices', icon: DollarSign, quiet: true },
  { id: 'school-invoices', name: 'School invoices', icon: Receipt, quiet: true },
  { id: 'spires-share', name: 'Spires Share', icon: Share2, quiet: true },
  { id: 'link-bookings', name: 'Link Bookings', icon: Link2, quiet: true },
];

export const expenseTypes = [
  { value: 'fuel' as const, label: '⛽ Fuel' },
  { value: 'parking' as const, label: '🅿️ Parking' },
  { value: 'tolls' as const, label: '🛣️ Tolls' },
  { value: 'maintenance' as const, label: '🔧 Vehicle Maintenance' },
  { value: 'cleaning' as const, label: '🧽 Vehicle Cleaning' },
  { value: 'other' as const, label: '📋 Other' }
];

export const paymentMethods = [
  { value: 'cash' as const, label: '💵 Cash' },
  { value: 'card' as const, label: '💳 Card' },
  { value: 'bank transfer' as const, label: '🏦 Bank Transfer' },
  { value: 'account' as const, label: '📋 Account Customer' },
  { value: 'tbc' as const, label: 'TBC' },
  { value: 'undecided' as const, label: 'Not decided yet' }
];

// Import the working PDF generator
export { generateBookingConfirmationPDF } from './pdfGenerator';