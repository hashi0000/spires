import React, { useState, useMemo } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Plus, Edit3, Trash2, Download, Calendar, DollarSign, Filter, X, Copy, AlertCircle, Mail, ArrowLeftRight, Send } from 'lucide-react';
import { Booking, Driver, Vehicle, ExtendedBooking } from '../types/types';
import { isCustomerBooking } from '../utils/bookingMapper';
import { functions } from '../utils/firebase';
import { generateBookingConfirmationPdfBlob } from '../utils/pdfGenerator';
import { blobToRawBase64 } from '../utils/blobToBase64';
import { getCallableErrorMessage } from '../utils/callableErrorMessage';

const sendDriverReminderManualCallable = httpsCallable(functions, 'sendDriverReminderManual');
const sendBookingPdfToCustomerCallable = httpsCallable(functions, 'sendBookingPdfToCustomer');

const resolvePdfTypeForEmail = (
  booking: Booking
): 'booking_confirmation' | 'payment_receipt' | 'payment_request' => {
  if (booking.paymentStatus === 'paid') return 'payment_receipt';
  if (booking.status === 'completed') return 'payment_request';
  return 'booking_confirmation';
};

interface BookingsProps {
  bookings: Booking[];
  drivers: Driver[];
  vehicles: Vehicle[];
  onAddBooking: () => void;
  onEditBooking: (booking: Booking) => void;
  onSaveBookingDirect: (booking: any) => Promise<void>;  // NEW
  onDeleteBooking: (id: string, bookingNumber: string) => void;
  onGeneratePDF: (booking: Booking) => void;
  onDuplicateBooking: (booking: Booking) => void;
  onCreateReturnBooking: (booking: Booking) => void;
}

const Bookings: React.FC<BookingsProps> = ({
  bookings,
  drivers,
  vehicles,
  onAddBooking,
  onEditBooking,
  onSaveBookingDirect,
  onDeleteBooking,
  onGeneratePDF,
  onDuplicateBooking,
  onCreateReturnBooking
}) => {
  const [sendingDriverReminderId, setSendingDriverReminderId] = useState<string | null>(null);
  const [sendingCustomerPdfId, setSendingCustomerPdfId] = useState<string | null>(null);
  const [showFilters, setShowFilters] = useState(false);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  /** Organise work: app sign-in bookings vs phone/admin entries */
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'customer_app' | 'other'>('all');

  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];
    if (dateFrom) {
      const fromDate = new Date(dateFrom);
      fromDate.setHours(0, 0, 0, 0);
      filtered = filtered.filter(b => new Date(b.pickupTime) >= fromDate);
    }
    if (dateTo) {
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      filtered = filtered.filter(b => new Date(b.pickupTime) <= toDate);
    }
    if (selectedMonth) {
      const [year, month] = selectedMonth.split('-');
      filtered = bookings.filter(b => {
        const bookingDate = new Date(b.pickupTime);
        return bookingDate.getFullYear() === parseInt(year) && bookingDate.getMonth() === parseInt(month) - 1;
      });
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => b.status === statusFilter);
    }
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(b => b.paymentStatus === paymentFilter);
    }
    if (audienceFilter === 'customer_app') {
      filtered = filtered.filter(b => isCustomerBooking(b));
    } else if (audienceFilter === 'other') {
      filtered = filtered.filter(b => !isCustomerBooking(b));
    }
    return filtered;
  }, [bookings, dateFrom, dateTo, selectedMonth, statusFilter, paymentFilter, audienceFilter]);

  const groupedBookings = useMemo(() => {
    // Sort bookings: pending customer bookings first, then by pickup time
    const sorted = [...filteredBookings].sort((a, b) => {
      const aIsPendingCustomer = isCustomerBooking(a) && a.status === 'pending';
      const bIsPendingCustomer = isCustomerBooking(b) && b.status === 'pending';
      
      // If one is pending customer and the other isn't, prioritize pending customer
      if (aIsPendingCustomer && !bIsPendingCustomer) return -1;
      if (!aIsPendingCustomer && bIsPendingCustomer) return 1;
      
      // If both are pending customer, sort by creation date (newest first)
      if (aIsPendingCustomer && bIsPendingCustomer) {
        const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
        const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
        return bCreated - aCreated;
      }
      
      // Otherwise sort by pickup time (most recent first)
      return new Date(b.pickupTime).getTime() - new Date(a.pickupTime).getTime();
    });
    
    const grouped = sorted.reduce((groups, booking) => {
      if (!booking.pickupTime) {
        // Fallback for bookings without pickupTime
        const fallbackDate = booking.dateTime ? new Date(booking.dateTime) : new Date();
        const dateKey = fallbackDate.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
        if (!groups[dateKey]) groups[dateKey] = [];
        groups[dateKey].push(booking);
        return groups;
      }
      const date = new Date(booking.pickupTime);
      if (isNaN(date.getTime())) {
        // Invalid date, skip or use fallback
        return groups;
      }
      const dateKey = date.toLocaleDateString('en-GB', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
      if (!groups[dateKey]) groups[dateKey] = [];
      groups[dateKey].push(booking);
      return groups;
    }, {} as Record<string, Booking[]>);
    
    // Sort date groups: put dates with pending customer bookings first
    const sortedGroups: Record<string, Booking[]> = {};
    const datesWithPendingCustomers: string[] = [];
    const otherDates: string[] = [];
    
    Object.keys(grouped).forEach(dateKey => {
      const hasPendingCustomer = grouped[dateKey].some(b => isCustomerBooking(b) && b.status === 'pending');
      if (hasPendingCustomer) {
        datesWithPendingCustomers.push(dateKey);
      } else {
        otherDates.push(dateKey);
      }
    });
    
    // Sort dates with pending customers by most recent pending booking
    datesWithPendingCustomers.sort((a, b) => {
      const aPending = grouped[a].find(b => isCustomerBooking(b) && b.status === 'pending');
      const bPending = grouped[b].find(b => isCustomerBooking(b) && b.status === 'pending');
      const aTime = aPending?.createdAt ? new Date(aPending.createdAt).getTime() : 0;
      const bTime = bPending?.createdAt ? new Date(bPending.createdAt).getTime() : 0;
      return bTime - aTime;
    });
    
    // Add dates with pending customers first, then others
    // Within each date group, sort pending customer bookings to the top
    datesWithPendingCustomers.forEach(date => {
      const dateBookings = grouped[date];
      const sortedDateBookings = [...dateBookings].sort((a, b) => {
        const aIsPendingCustomer = isCustomerBooking(a) && a.status === 'pending';
        const bIsPendingCustomer = isCustomerBooking(b) && b.status === 'pending';
        if (aIsPendingCustomer && !bIsPendingCustomer) return -1;
        if (!aIsPendingCustomer && bIsPendingCustomer) return 1;
        // If both are pending customer, newest first
        if (aIsPendingCustomer && bIsPendingCustomer) {
          const aCreated = a.createdAt ? new Date(a.createdAt).getTime() : 0;
          const bCreated = b.createdAt ? new Date(b.createdAt).getTime() : 0;
          return bCreated - aCreated;
        }
        return 0;
      });
      sortedGroups[date] = sortedDateBookings;
    });
    otherDates.forEach(date => {
      sortedGroups[date] = grouped[date];
    });
    
    return sortedGroups;
  }, [filteredBookings]);

  const accountingSummary = useMemo(() => {
    const completed = filteredBookings.filter(b => b.status === 'completed');
    const totalRevenue = completed.reduce((sum, b) => sum + (b.actualFare || 0), 0);
    const totalExpenses = completed.reduce((sum, b) => {
      const bookingExpenses = b.expenses?.reduce((eSum, e) => eSum + e.amount, 0) || 0;
      return sum + bookingExpenses;
    }, 0);
    const netProfit = totalRevenue - totalExpenses;
    const paidBookings = completed.filter(b => b.paymentStatus === 'paid');
    const unpaidBookings = completed.filter(b => b.paymentStatus === 'pending' || !b.paymentStatus);
    const paidAmount = paidBookings.reduce((sum, b) => sum + (b.actualFare || 0), 0);
    const unpaidAmount = unpaidBookings.reduce((sum, b) => sum + (b.actualFare || 0), 0);
    const driverRevenue = drivers.map(driver => {
      const driverBookings = completed.filter(b => b.driverId === driver.id);
      const revenue = driverBookings.reduce((sum, b) => sum + (b.actualFare || 0), 0);
      return { driver: driver.name, revenue, bookings: driverBookings.length };
    }).filter(d => d.bookings > 0);
    return { totalRevenue, totalExpenses, netProfit, totalBookings: completed.length, paidAmount, unpaidAmount, paidCount: paidBookings.length, unpaidCount: unpaidBookings.length, driverRevenue };
  }, [filteredBookings, drivers]);

  const exportToCSV = () => {
    const headers = ['Booking Number', 'Booking Created Date', 'Booking Created Time', 'Pickup Date', 'Pickup Time', 'Customer Name', 'Phone', 'Booking Method', 'Pickup Location', 'Destination', 'Fare', 'Fuel Expense', 'Parking Expense', 'Payment Method', 'Payment Status', 'Driver', 'Vehicle', 'Status', 'Notes'];
    const rows = filteredBookings.map(booking => {
      const driver = drivers.find(d => d.id === booking.driverId);
      const vehicle = vehicles.find(v => v.id === booking.vehicleId);
      const fuelExpense = booking.expenses?.find(e => e.type === 'fuel')?.amount || '';
      const parkingExpense = booking.expenses?.find(e => e.type === 'parking')?.amount || '';
      const bookingCreatedDate = booking.dateTime ? new Date(booking.dateTime).toLocaleDateString('en-GB') : '';
      const bookingCreatedTime = booking.dateTime ? new Date(booking.dateTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' }) : '';
      const pickupDate = new Date(booking.pickupTime).toLocaleDateString('en-GB');
      const pickupTime = new Date(booking.pickupTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' });
      return [booking.bookingNumber, bookingCreatedDate, bookingCreatedTime, pickupDate, pickupTime, booking.hirerName, booking.hirerPhone, booking.bookingMethod, `"${booking.pickupLocation.replace(/"/g, '""')}"`, `"${booking.destination.replace(/"/g, '""')}"`, booking.actualFare || '', fuelExpense, parkingExpense, booking.paymentMethod || '', booking.paymentStatus || '', driver?.name || '', vehicle?.registration || '', booking.status, `"${(booking.notes || '').replace(/"/g, '""')}"`].join(',');
    });
    const csv = [headers.join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    const filename = selectedMonth ? `bookings-${selectedMonth}.csv` : `bookings-${new Date().toISOString().split('T')[0]}.csv`;
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handleImportCSV = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    const lines = text.split('\n');
    const dataLines = lines.slice(1).filter(line => line.trim());
    let importCount = 0;
    let updateCount = 0;
    const errors: string[] = [];
    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      try {
        const values: string[] = [];
        let current = '';
        let inQuotes = false;
        for (let j = 0; j < line.length; j++) {
          const char = line[j];
          if (char === '"') {
            if (inQuotes && line[j + 1] === '"') {
              current += '"';
              j++;
            } else {
              inQuotes = !inQuotes;
            }
          } else if (char === ',' && !inQuotes) {
            values.push(current.trim());
            current = '';
          } else {
            current += char;
          }
        }
        values.push(current.trim());
        while (values.length < 19) values.push('');
        const [bookingNumber, bookingCreatedDate, bookingCreatedTime, pickupDate, pickupTime, hirerName, hirerPhone, bookingMethod, pickupLocation, destination, fareAmount, fuelExpense, parkingExpense, paymentMethod, paymentStatus, driverName, vehicleReg, status, notes] = values;
        if (!bookingNumber || !hirerName) continue;
        let bookingDateTime: Date;
        try {
          if (bookingCreatedDate && bookingCreatedDate.trim() && bookingCreatedDate.includes('/')) {
            const [day, month, year] = bookingCreatedDate.split('/');
            const time = bookingCreatedTime || '00:00';
            bookingDateTime = new Date(`${year}-${month}-${day}T${time}:00`);
          } else {
            bookingDateTime = new Date();
          }
          if (isNaN(bookingDateTime.getTime())) bookingDateTime = new Date();
        } catch (e) {
          bookingDateTime = new Date();
        }
        let parsedPickupDate: Date;
        try {
          if (!pickupDate || !pickupDate.includes('/')) {
            errors.push(`Row ${i + 2}: Missing pickup date`);
            continue;
          }
          const [day, month, year] = pickupDate.split('/');
          const time = pickupTime || '00:00';
          parsedPickupDate = new Date(`${year}-${month}-${day}T${time}:00`);
          if (isNaN(parsedPickupDate.getTime())) {
            errors.push(`Row ${i + 2}: Invalid pickup date`);
            continue;
          }
        } catch (e) {
          errors.push(`Row ${i + 2}: Could not parse pickup date`);
          continue;
        }
        const expenses = [];
        if (fuelExpense && !isNaN(parseFloat(fuelExpense)) && parseFloat(fuelExpense) > 0) {
          expenses.push({ id: Date.now() + Math.random(), type: 'fuel' as const, amount: parseFloat(fuelExpense), description: 'Fuel' });
        }
        if (parkingExpense && !isNaN(parseFloat(parkingExpense)) && parseFloat(parkingExpense) > 0) {
          expenses.push({ id: Date.now() + Math.random() + 1, type: 'parking' as const, amount: parseFloat(parkingExpense), description: 'Parking' });
        }
        const driver = drivers.find(d => d.name === driverName);
        const vehicle = vehicles.find(v => v.registration === vehicleReg);
        const existingBooking = bookings.find(b => b.bookingNumber === bookingNumber);
        const bookingData = {
          ...(existingBooking || {}),
          bookingNumber, hirerName, hirerPhone: hirerPhone || '', hirerAddress: existingBooking?.hirerAddress || '',
          bookingMethod: (bookingMethod || 'telephone') as any, pickupTime: parsedPickupDate.toISOString(),
          dateTime: bookingDateTime.toISOString(), pickupLocation: pickupLocation || '', destination: destination || '',
          driverId: driver?.id || '', vehicleId: vehicle?.id || '', status: (status || 'pending') as any,
          paymentStatus: (paymentStatus || 'pending') as any, paymentMethod: (paymentMethod || 'cash') as any,
          actualFare: fareAmount && !isNaN(parseFloat(fareAmount)) ? parseFloat(fareAmount) : undefined,
          notes: notes || '', expenses: expenses.length > 0 ? expenses : (existingBooking?.expenses || [])
        };
await onSaveBookingDirect(bookingData);        if (existingBooking) {
          updateCount++;
        } else {
          importCount++;
        }
      } catch (error) {
        errors.push(`Row ${i + 2}: ${error instanceof Error ? error.message : 'Unknown error'}`);
      }
    }
    if (errors.length > 0) {
      const errorMsg = errors.slice(0, 10).join('\n') + (errors.length > 10 ? `\n... and ${errors.length - 10} more errors` : '');
      alert(`Import complete!\n\nNew: ${importCount}\nUpdated: ${updateCount}\nErrors: ${errors.length}\n\nFirst errors:\n${errorMsg}`);
    } else {
      alert(`Import successful!\nNew bookings: ${importCount}\nUpdated: ${updateCount}`);
    }
    event.target.value = '';
  };

  const clearFilters = () => {
    setDateFrom('');
    setDateTo('');
    setSelectedMonth('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setAudienceFilter('all');
  };
  const setQuickMonth = (monthsAgo: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() - monthsAgo);
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    setSelectedMonth(`${year}-${month}`);
    setDateFrom(''); setDateTo('');
  };

  const MAX_EMAIL_PDF_BYTES = 4 * 1024 * 1024;

  const handleSendCustomerPdf = async (booking: Booking) => {
    if (!booking.id) return;
    const ext = booking as ExtendedBooking;
    const suggested =
      [ext.hirerEmail, ext.email].map((e) => (typeof e === 'string' ? e.trim() : '')).find(Boolean) || '';
    const toInput = window.prompt(
      'Send the styled PDF (same layout as Print / Download) to this address:',
      suggested
    );
    if (!toInput?.trim()) return;

    const driver = drivers.find((d) => d.id === booking.driverId);
    const vehicle = vehicles.find((v) => v.id === booking.vehicleId);
    const pdfType = resolvePdfTypeForEmail(booking);

    setSendingCustomerPdfId(booking.id);
    try {
      const blob = await generateBookingConfirmationPdfBlob(booking, driver, vehicle, pdfType);
      if (blob.size > MAX_EMAIL_PDF_BYTES) {
        window.alert(
          `This PDF is too large to email from the browser (${Math.round(blob.size / 1024)} KB). Use Download instead.`
        );
        return;
      }
      const pdfBase64 = await blobToRawBase64(blob);
      const result = await sendBookingPdfToCustomerCallable({
        pdfBase64,
        toEmail: toInput.trim(),
        pdfType,
        bookingNumber: booking.bookingNumber,
        hirerName: booking.hirerName,
      });
      const data = result.data as { success?: boolean; to?: string };
      if (data?.success) {
        window.alert(`PDF emailed to ${data.to || toInput.trim()}`);
      }
    } catch (e: unknown) {
      window.alert(getCallableErrorMessage(e));
    } finally {
      setSendingCustomerPdfId(null);
    }
  };

  const handleSendDriverReminder = async (booking: Booking) => {
    if (!booking.driverId) {
      window.alert('No driver assigned');
      return;
    }
    const driver = drivers.find(d => d.id === booking.driverId);
    if (!driver?.email?.trim()) {
      window.alert('Driver has no email');
      return;
    }
    if (!booking.id) return;
    setSendingDriverReminderId(booking.id);
    try {
      const result = await sendDriverReminderManualCallable({ bookingId: booking.id });
      const data = result.data as { success?: boolean };
      if (data?.success) {
        window.alert('Reminder sent successfully');
      }
    } catch (e: unknown) {
      const msg = e && typeof e === 'object' && 'message' in e && typeof (e as { message: string }).message === 'string'
        ? (e as { message: string }).message
        : 'Failed to send reminder';
      window.alert(msg);
    } finally {
      setSendingDriverReminderId(null);
    }
  };

  return (
    <div>
      {bookings.filter(b => isCustomerBooking(b) && b.status === 'pending').length > 0 && (
        <div className="alert alert-warning">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>
              {bookings.filter(b => isCustomerBooking(b) && b.status === 'pending').length} New Customer {bookings.filter(b => isCustomerBooking(b) && b.status === 'pending').length === 1 ? 'Booking' : 'Bookings'} Pending Review
            </h3>
            <p style={{ margin: 0, fontSize: '0.875rem' }}>
              Customer bookings are highlighted in orange. Please review and confirm with pricing.
            </p>
          </div>
        </div>
      )}
      <div className="card">
        <div className="card-header">
          <h2 className="card-title">Bookings</h2>
          <div className="flex flex-wrap gap-2">
            <button onClick={exportToCSV} className="btn btn-success btn-sm">
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <label className="btn btn-secondary btn-sm" style={{ cursor: 'pointer' }}>
              <Plus className="h-4 w-4" />
              Import CSV
              <input type="file" accept=".csv" onChange={handleImportCSV} className="hidden" />
            </label>
            <button onClick={() => setShowFilters(!showFilters)} className="btn btn-secondary btn-sm">
              <Filter className="h-4 w-4" />
              Filters
            </button>
            <button 
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('New Booking button clicked');
                onAddBooking();
              }} 
              className="btn btn-primary btn-sm"
            >
              <Plus className="h-4 w-4" />
              New Booking
            </button>
          </div>
        </div>
        {showFilters && (
        <div className="bg-white p-4 rounded-lg shadow border border-gray-200">
          <div className="flex justify-between items-center mb-4">
            <h3 className="font-semibold text-gray-900">Filter Bookings</h3>
            <button onClick={clearFilters} className="text-sm text-blue-600 hover:text-blue-800 flex items-center"><X className="h-4 w-4 mr-1" />Clear All</button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="col-span-full"><label className="block text-sm font-medium text-gray-700 mb-2">Quick Select</label><div className="flex gap-2 flex-wrap"><button onClick={() => setQuickMonth(0)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm">This Month</button><button onClick={() => setQuickMonth(1)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm">Last Month</button><button onClick={() => setQuickMonth(2)} className="px-3 py-1 bg-blue-100 text-blue-700 rounded hover:bg-blue-200 text-sm">2 Months Ago</button></div></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Select Month</label><input type="month" value={selectedMonth} onChange={(e) => { setSelectedMonth(e.target.value); setDateFrom(''); setDateTo(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date From</label><input type="date" value={dateFrom} onChange={(e) => { setDateFrom(e.target.value); setSelectedMonth(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Date To</label><input type="date" value={dateTo} onChange={(e) => { setDateTo(e.target.value); setSelectedMonth(''); }} className="w-full px-3 py-2 border border-gray-300 rounded-md" /></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="all">All Status</option><option value="pending">Pending</option><option value="confirmed">Confirmed</option><option value="allocated">Allocated</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Payment Status</label><select value={paymentFilter} onChange={(e) => setPaymentFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="all">All Payments</option><option value="paid">Paid</option><option value="pending">Pending</option><option value="partial">Partial</option></select></div>
            <div className="col-span-full md:col-span-1">
              <label className="block text-sm font-medium text-gray-700 mb-1">Booking source</label>
              <select
                value={audienceFilter}
                onChange={(e) => setAudienceFilter(e.target.value as 'all' | 'customer_app' | 'other')}
                className="w-full px-3 py-2 border border-gray-300 rounded-md"
              >
                <option value="all">All sources</option>
                <option value="customer_app">App / signed-in customers</option>
                <option value="other">Phone, walk-in, admin</option>
              </select>
            </div>
          </div>
        </div>
        )}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200" style={{ marginTop: '1.5rem' }}>
        <div className="flex items-center mb-4"><DollarSign className="h-6 w-6 text-green-600 mr-2" /><h3 className="text-lg font-semibold text-gray-900">Accounting Summary</h3><span className="ml-auto text-sm text-gray-600">{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}{selectedMonth && ` in ${new Date(selectedMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Total Revenue</p><p className="text-2xl font-bold text-green-600">£{accountingSummary.totalRevenue.toFixed(2)}</p></div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Total Expenses</p><p className="text-2xl font-bold text-red-600">£{accountingSummary.totalExpenses.toFixed(2)}</p></div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Net Profit</p><p className="text-2xl font-bold text-blue-600">£{accountingSummary.netProfit.toFixed(2)}</p></div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Completed Jobs</p><p className="text-2xl font-bold text-gray-900">{accountingSummary.totalBookings}</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm font-medium text-gray-700 mb-2">Payment Status</p><div className="space-y-2"><div className="flex justify-between"><span className="text-sm text-gray-600">Paid ({accountingSummary.paidCount})</span><span className="text-sm font-semibold text-green-600">£{accountingSummary.paidAmount.toFixed(2)}</span></div><div className="flex justify-between"><span className="text-sm text-gray-600">Unpaid ({accountingSummary.unpaidCount})</span><span className="text-sm font-semibold text-red-600">£{accountingSummary.unpaidAmount.toFixed(2)}</span></div></div></div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm font-medium text-gray-700 mb-2">Revenue by Driver</p><div className="space-y-2 max-h-24 overflow-y-auto">{accountingSummary.driverRevenue.length > 0 ? accountingSummary.driverRevenue.map((dr, idx) => (<div key={idx} className="flex justify-between"><span className="text-sm text-gray-600">{dr.driver} ({dr.bookings})</span><span className="text-sm font-semibold text-blue-600">£{dr.revenue.toFixed(2)}</span></div>)) : (<p className="text-sm text-gray-500">No completed bookings</p>)}</div></div>
        </div>
      </div>
      </div>
      <div className="card" style={{ marginTop: '1.5rem' }}>
        {filteredBookings.length === 0 ? (
          <div className="text-center" style={{ padding: '3rem 1rem' }}>
            <Calendar className="h-12 w-12" style={{ margin: '0 auto 1rem', color: '#9ca3af' }} />
            <h3 style={{ fontSize: '1.125rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
              {bookings.length === 0 ? 'No bookings yet' : 'No bookings match your filters'}
            </h3>
            {bookings.length === 0 ? (
              <button onClick={onAddBooking} className="btn btn-primary">
                Create Your First Booking
              </button>
            ) : (
              <button onClick={clearFilters} className="btn btn-secondary">
                Clear Filters
              </button>
            )}
          </div>
        ) : (
          <div>
            {Object.entries(groupedBookings).map(([date, dateBookings]) => (
              <div key={date}>
                <div style={{ 
                  background: 'linear-gradient(to right, #f9fafb, #eff6ff)', 
                  padding: '0.75rem 1.5rem', 
                  borderBottom: '2px solid #bfdbfe',
                  position: 'sticky',
                  top: '145px',
                  zIndex: 10
                }}>
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-5 w-5" style={{ color: '#1d3c74' }} />
                      <h3 style={{ fontSize: '1.125rem', fontWeight: 600, color: '#0b1c3d', margin: 0 }}>
                        {date}
                      </h3>
                    </div>
                    <span style={{ fontSize: '0.875rem', color: '#4b5563' }}>
                      {dateBookings.length} booking{dateBookings.length !== 1 ? 's' : ''}
                    </span>
                  </div>
                </div>
                {dateBookings.map((booking) => {
                  const driver = drivers.find(d => d.id === booking.driverId);
                  const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                  const totalExpenses = booking.expenses?.reduce((sum, e) => sum + e.amount, 0) || 0;
                  const isPendingCustomer = isCustomerBooking(booking) && booking.status === 'pending';
                  const ext = booking as ExtendedBooking;
                  const customerEmail = [ext.hirerEmail, ext.email].map((e) => (typeof e === 'string' ? e.trim() : '')).find(Boolean) || '';
                  return (
                    <div 
                      key={booking.id} 
                      className={`booking-card ${isPendingCustomer ? 'pending-customer' : ''}`}
                    >
                      <div className="booking-card-header">
                        <div className="flex items-center flex-wrap gap-2">
                          <h3 style={{ fontSize: '1.125rem', fontWeight: 500, margin: 0, color: '#0b1c3d' }}>
                            {booking.bookingNumber}
                          </h3>
                          {isPendingCustomer && <span className="badge badge-new-customer">NEW CUSTOMER</span>}
                          <span className={`badge badge-${booking.status}`}>{booking.status}</span>
                          {booking.paymentStatus && (
                            <span className={`badge ${booking.paymentStatus === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>
                              {booking.paymentStatus}
                            </span>
                          )}
                          {booking.actualFare && (
                            <span style={{ 
                              backgroundColor: '#d1fae5', 
                              color: '#065f46', 
                              padding: '0.25rem 0.75rem', 
                              borderRadius: '20px', 
                              fontSize: '0.75rem', 
                              fontWeight: 600 
                            }}>
                              £{booking.actualFare.toFixed(2)}
                              {totalExpenses > 0 && ` (£${totalExpenses.toFixed(2)} expenses)`}
                            </span>
                          )}
                        </div>
                      </div>
                      <div className="booking-card-body">
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                            <strong>Customer:</strong> {booking.hirerName}
                          </p>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                            <strong>Phone:</strong> {booking.hirerPhone}
                          </p>
                          {customerEmail ? (
                            <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                              <strong>Email:</strong> {customerEmail}
                            </p>
                          ) : null}
                          <p style={{ margin: 0, fontSize: '0.875rem' }}>
                            <strong>Method:</strong> {booking.bookingMethod.replace('_', ' ')}
                          </p>
                        </div>
                        <div>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                            <strong>From:</strong> {booking.pickupLocation}
                          </p>
                          <p style={{ margin: '0 0 0.5rem 0', fontSize: '0.875rem' }}>
                            <strong>To:</strong> {booking.destination}
                          </p>
                          <p style={{ margin: 0, fontSize: '0.875rem' }}>
                            <strong>Time:</strong> {new Date(booking.pickupTime).toLocaleTimeString('en-GB', { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                      <div style={{ marginTop: '0.75rem', fontSize: '0.875rem', color: '#4b5563' }}>
                        <strong>Driver:</strong> {driver?.name || 'Not assigned'} | <strong>Vehicle:</strong> {vehicle?.registration || 'Not assigned'}
                      </div>
                      <div className="booking-card-actions">
                        <button
                          type="button"
                          onClick={() => handleSendDriverReminder(booking)}
                          className="btn btn-secondary btn-sm"
                          title="Send Driver Reminder"
                          aria-label="Send Driver Reminder"
                          disabled={sendingDriverReminderId === booking.id}
                        >
                          <Mail className="h-4 w-4" style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                          {sendingDriverReminderId === booking.id ? 'Sending…' : 'Send Driver Reminder'}
                        </button>
                        <button
                          type="button"
                          onClick={() => onCreateReturnBooking(booking)}
                          className="btn btn-secondary btn-sm"
                          title="Create return trip (swap from/to, set date & time)"
                          aria-label="Create return trip"
                        >
                          <ArrowLeftRight className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDuplicateBooking(booking)} className="btn btn-secondary btn-sm" title="Duplicate Booking">
                          <Copy className="h-4 w-4" />
                        </button>
                        <button onClick={() => onGeneratePDF(booking)} className="btn btn-success btn-sm" title="Download PDF">
                          <Download className="h-4 w-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => void handleSendCustomerPdf(booking)}
                          className="btn btn-success btn-sm"
                          title="Email the same styled PDF as Print/Download (generated in your browser)"
                          disabled={sendingCustomerPdfId === booking.id}
                        >
                          <Send className="h-4 w-4" style={{ marginRight: '0.35rem', verticalAlign: 'middle' }} />
                          {sendingCustomerPdfId === booking.id ? 'Sending…' : 'Email PDF'}
                        </button>
                        <button onClick={() => onEditBooking(booking)} className="btn btn-primary btn-sm" title="Edit Booking">
                          <Edit3 className="h-4 w-4" />
                        </button>
                        <button onClick={() => onDeleteBooking(booking.id!, booking.bookingNumber)} className="btn btn-danger btn-sm" title="Delete Booking">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default Bookings;