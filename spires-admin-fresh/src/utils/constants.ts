// constants.ts - Put this in a separate file
import { Calendar, Car, FileText, Users, Link2, UserCircle, Receipt, DollarSign, Share2 } from 'lucide-react';

export const navigation = [
  { id: 'dashboard', name: 'Dashboard', icon: Calendar },
  { id: 'drivers', name: 'Drivers', icon: Users },
  { id: 'vehicles', name: 'Vehicles', icon: Car },
  { id: 'bookings', name: 'Bookings', icon: FileText },
  { id: 'customers', name: 'Customers', icon: UserCircle },
  { id: 'invoices', name: 'Invoices', icon: DollarSign },
  { id: 'school-invoices', name: 'School invoices', icon: Receipt },
  { id: 'spires-share', name: 'Spires Share', icon: Share2 },
  { id: 'link-bookings', name: 'Link Bookings', icon: Link2 },
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
  { value: 'account' as const, label: '📋 Account Customer' }
];

// Import the working PDF generator
export { generateBookingConfirmationPDF } from './pdfGenerator';