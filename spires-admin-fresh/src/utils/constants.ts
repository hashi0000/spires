// constants.ts - Put this in a separate file
import { Calendar, FileText, Users, Link2, UserCircle, Receipt, DollarSign, Share2, TrendingUp, Mail, MapPin } from 'lucide-react';

export const navigation = [
  { id: 'dashboard', name: 'Today', icon: Calendar, quiet: false, adminOnly: false },
  { id: 'bookings', name: 'Bookings', icon: FileText, quiet: false, adminOnly: false },
  { id: 'customers', name: 'Customers', icon: UserCircle, quiet: false, adminOnly: false },
  { id: 'account-trips', name: 'Billing', icon: DollarSign, quiet: false, adminOnly: false },
  { id: 'fleet', name: 'Fleet', icon: Users, quiet: false, adminOnly: false },
  { id: 'advertising', name: 'Advertising results', icon: TrendingUp, quiet: true, adminOnly: true },
  { id: 'communications', name: 'Offers and Messages', icon: Mail, quiet: true, adminOnly: true },
  { id: 'invoices', name: 'Invoices', icon: Receipt, quiet: true, adminOnly: false },
  { id: 'school-invoices', name: 'School invoices', icon: Receipt, quiet: true },
  { id: 'spires-share', name: 'Spires Share', icon: Share2, quiet: true },
  { id: 'link-bookings', name: 'Maintenance: link bookings', icon: Link2, quiet: true },
  { id: 'company-places', name: 'Company places', icon: MapPin, quiet: true },
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
  { value: 'undecided' as const, label: 'Not yet agreed' }
];

// Import the working PDF generator
export { generateBookingConfirmationPDF } from './pdfGenerator';
