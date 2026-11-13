import React, { useEffect, useMemo, useRef, useState } from 'react';
import { httpsCallable } from 'firebase/functions';
import { Plus, Edit3, Trash2, Download, Calendar, DollarSign, Filter, X, Copy, AlertCircle, Mail, ArrowLeftRight, Send } from 'lucide-react';
import { Booking, Driver, Vehicle, ExtendedBooking } from '../types/types';
import { effectiveWorkflowStatus, bookingMatchesStatusFilter, workflowBadgeClass, workflowStatusLabel } from '../utils/bookingWorkflow';
import { formatVehicleTypeLabel } from '../utils/vehicleTypes';
import { isCustomerBooking, isPendingIncomingRequest } from '../utils/bookingMapper';
import { brandOf } from '../utils/brand';
import { db, functions } from '../utils/firebase';
import { planBulkJobUpdate, type BulkJobChanges } from '../utils/bulkBookingEdit';
import { describeStops, hasExtraStops, normaliseStops, openReturnSummary } from '../utils/journeyStops';
import { journeyLegs, legsForQuickView, type JourneyLeg } from '../utils/journeyLegs';
import { londonExportDate, londonExportTime } from '../utils/bookingDates';
import { buildAnalysisCsv, type AnalysisBooking } from '../utils/analysisExport';
import { buildAccountingSummary } from '../utils/accountingSummary';
import { applyBulkJobUpdates } from '../utils/applyBulkJobUpdates';
import { generateBookingConfirmationPdfBlob } from '../utils/pdfGenerator';
import { blobToRawBase64 } from '../utils/blobToBase64';
import { getCallableErrorMessage } from '../utils/callableErrorMessage';
import JourneyStatsCard from './JourneyStatsCard';

type QuickView = 'all' | 'today' | 'tomorrow' | 'upcoming' | 'past' | 'unassigned' | 'awaiting_payment';
const FILTER_KEY = 'spires_admin_booking_filters';
const SCROLL_KEY = 'spires_admin_bookings_scroll';

function londonDay(value?: string | Date | null): string {
  if (!value) return '';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'Europe/London', year: 'numeric', month: '2-digit', day: '2-digit' }).format(date);
}

function gbp(value: number | null): string {
  return value === null ? "Unknown" : `£${value.toFixed(2)}`;
}

function missingCount(count: number, reason: string): string {
  return count === 1 ? `1 completed job has ${reason}.` : `${count} completed jobs have ${reason}.`;
}

function londonWhen(value?: string | Date | null): string {
  if (!value) return 'Time not recorded';
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return 'Time not recorded';
  return date.toLocaleString('en-GB', { timeZone: 'Europe/London', weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
}

function paymentLabel(booking: Booking): string {
  if (booking.quoteAcceptanceSubstatus === 'awaiting_payment' && booking.paymentStatus !== 'paid') return 'Awaiting payment';
  if (booking.paymentStatus === 'paid') return 'Paid';
  if (booking.paymentStatus === 'partial') return 'Part paid';
  if (booking.paymentStatus === 'refunded') return 'Refunded';
  return 'Unpaid';
}

function isReturnBooking(booking: Booking): boolean {
  const row = booking as ExtendedBooking;
  return row.bookingType === 'return' || Boolean(row.returnPickupLocation && row.returnDestination);
}

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
  const [search, setSearch] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  /** Organise work: app sign-in bookings vs phone/admin entries */
  const [audienceFilter, setAudienceFilter] = useState<'all' | 'customer_app' | 'other'>('all');
  const [brandFilter, setBrandFilter] = useState<'all' | 'spires_taxis' | 'spires_international'>('all');
  const [quickView, setQuickView] = useState<QuickView>('upcoming');
  const [openRouteId, setOpenRouteId] = useState<string | null>(null);
  const [compactList, setCompactList] = useState(false);
  const listRef = useRef<HTMLDivElement>(null);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDriver, setBulkDriver] = useState('');
  const [bulkVehicle, setBulkVehicle] = useState('');
  const [bulkStatus, setBulkStatus] = useState<BulkJobChanges['status']>('');
  const [bulkPayment, setBulkPayment] = useState<BulkJobChanges['payment']>('');
  const [bulkNote, setBulkNote] = useState('');
  const [bulkSaving, setBulkSaving] = useState(false);
  const [bulkMessage, setBulkMessage] = useState('');
  const [paymentSavingId, setPaymentSavingId] = useState<string | null>(null);
  const [paymentMessage, setPaymentMessage] = useState('');

  useEffect(() => {
    const node = listRef.current;
    if (node && typeof ResizeObserver !== 'undefined') {
      const observer = new ResizeObserver((entries) => {
        const width = entries[0]?.contentRect.width ?? 0;
        if (width > 0) setCompactList(width < 680);
      });
      observer.observe(node);
      return () => observer.disconnect();
    }
    if (typeof window.matchMedia !== 'function') return;
    const media = window.matchMedia('(max-width: 900px)');
    const apply = () => setCompactList(media.matches);
    apply();
    media.addEventListener?.('change', apply);
    return () => media.removeEventListener?.('change', apply);
  }, []);

  useEffect(() => {
    const saved = sessionStorage.getItem(FILTER_KEY);
    if (!saved) return;
    try {
      const parsed = JSON.parse(saved) as { search?: string; quickView?: QuickView; statusFilter?: string; paymentFilter?: string; brandFilter?: 'all' | 'spires_taxis' | 'spires_international' };
      if (parsed.search) setSearch(parsed.search);
      if (parsed.quickView) setQuickView(parsed.quickView);
      if (parsed.statusFilter) setStatusFilter(parsed.statusFilter);
      if (parsed.paymentFilter) setPaymentFilter(parsed.paymentFilter);
      if (parsed.brandFilter) setBrandFilter(parsed.brandFilter);
    } catch {
      sessionStorage.removeItem(FILTER_KEY);
    }
    const y = Number(sessionStorage.getItem(SCROLL_KEY) || 0);
    if (y) window.setTimeout(() => window.scrollTo(0, y), 0);
  }, []);

  useEffect(() => {
    sessionStorage.setItem(FILTER_KEY, JSON.stringify({ search, quickView, statusFilter, paymentFilter, brandFilter }));
  }, [search, quickView, statusFilter, paymentFilter, brandFilter]);

  const filteredBookings = useMemo(() => {
    let filtered = [...bookings];
    const query = search.trim().toLowerCase();
    if (query) filtered = filtered.filter(b => {
      const row = b as ExtendedBooking;
      return [b.bookingNumber, b.hirerName, b.hirerPhone, row.hirerEmail, row.email, b.pickupLocation, b.destination]
        .some(value => String(value || '').toLowerCase().includes(query));
    });
    if (dateFrom || dateTo || selectedMonth) {
      const fromDate = dateFrom ? new Date(dateFrom) : null;
      if (fromDate) fromDate.setHours(0, 0, 0, 0);
      const toDate = dateTo ? new Date(dateTo) : null;
      if (toDate) toDate.setHours(23, 59, 59, 999);
      const [year, month] = selectedMonth ? selectedMonth.split('-').map(Number) : [];
      filtered = filtered.filter((booking) => {
        const times = journeyLegs(booking)
          .map((leg) => leg.pickupAt)
          .filter((value): value is Date => value instanceof Date);
        const instants = times.length ? times : [new Date(booking.pickupTime || booking.dateTime)].filter((value) => !Number.isNaN(value.getTime()));
        return instants.some((instant) => {
          if (fromDate && instant < fromDate) return false;
          if (toDate && instant > toDate) return false;
          if (selectedMonth && (instant.getFullYear() !== year || instant.getMonth() !== month - 1)) return false;
          return true;
        });
      });
    }
    if (statusFilter !== 'all') {
      filtered = filtered.filter(b => bookingMatchesStatusFilter(b, statusFilter));
    }
    if (paymentFilter !== 'all') {
      filtered = filtered.filter(b => b.paymentStatus === paymentFilter);
    }
    if (audienceFilter === 'customer_app') {
      filtered = filtered.filter(b => isCustomerBooking(b));
    } else if (audienceFilter === 'other') {
      filtered = filtered.filter(b => !isCustomerBooking(b));
    }
    if (brandFilter !== 'all') {
      filtered = filtered.filter(b => brandOf(b) === brandFilter);
    }
    const today = londonDay(new Date());
    const now = new Date();
    if (quickView !== 'all') {
      filtered = filtered.filter((booking) => {
        const day = londonDay(booking.pickupTime || booking.dateTime);
        if (quickView === 'today') return legsForQuickView(booking, 'today', now).length > 0;
        if (quickView === 'tomorrow') return legsForQuickView(booking, 'tomorrow', now).length > 0;
        if (quickView === 'upcoming') return isPendingIncomingRequest(booking) || legsForQuickView(booking, 'upcoming', now).length > 0;
        if (quickView === 'past') return day !== '' && day < today;
        if (quickView === 'unassigned') return legsForQuickView(booking, 'unassigned', now).length > 0;
        if (quickView === 'awaiting_payment') {
          return booking.paymentStatus === 'pending' || booking.paymentStatus === 'partial' || booking.quoteAcceptanceSubstatus === 'awaiting_payment';
        }
        return true;
      });
    }
    return filtered;
  }, [bookings, search, dateFrom, dateTo, selectedMonth, statusFilter, paymentFilter, audienceFilter, brandFilter, quickView]);

  const sortedBookings = useMemo(() => {
    const nearestFirst = quickView === 'upcoming' || quickView === 'today' || quickView === 'tomorrow';
    return [...filteredBookings].sort((a, b) => {
      if (quickView === 'all' || quickView === 'upcoming') {
        const aPending = isPendingIncomingRequest(a);
        const bPending = isPendingIncomingRequest(b);
        if (aPending !== bPending) return aPending ? -1 : 1;
      }
      const aTime = new Date(a.pickupTime || a.dateTime || 0).getTime();
      const bTime = new Date(b.pickupTime || b.dateTime || 0).getTime();
      return nearestFirst ? aTime - bTime : bTime - aTime;
    });
  }, [filteredBookings, quickView]);

  const shownRows = useMemo(() => {
    const now = new Date();
    const expand = quickView === 'today' || quickView === 'tomorrow' || quickView === 'upcoming' || quickView === 'unassigned';
    const rows: { booking: Booking; leg: JourneyLeg | null }[] = [];
    for (const booking of sortedBookings) {
      if (!expand) {
        rows.push({ booking, leg: null });
        continue;
      }
      const matches = legsForQuickView(booking, quickView, now);
      if (matches.length === 0 && quickView === 'upcoming' && isPendingIncomingRequest(booking)) {
        rows.push({ booking, leg: journeyLegs(booking, now)[0] || null });
        continue;
      }
      matches.forEach((leg) => rows.push({ booking, leg }));
    }
    if (quickView === 'upcoming' || quickView === 'today' || quickView === 'tomorrow') {
      rows.sort((a, b) => {
        if (quickView === 'upcoming') {
          const aPending = isPendingIncomingRequest(a.booking);
          const bPending = isPendingIncomingRequest(b.booking);
          if (aPending !== bPending) return aPending ? -1 : 1;
        }
        const aTime = a.leg?.pickupAt?.getTime() || new Date(a.booking.pickupTime || a.booking.dateTime || 0).getTime();
        const bTime = b.leg?.pickupAt?.getTime() || new Date(b.booking.pickupTime || b.booking.dateTime || 0).getTime();
        return aTime - bTime;
      });
    }
    return rows;
  }, [sortedBookings, quickView]);

  const accountingSummary = useMemo(
    () => buildAccountingSummary(filteredBookings, drivers),
    [filteredBookings, drivers]
  );

  const exportToCSV = () => {
    const headers = ['Booking Number', 'Booking Created Date', 'Booking Created Time', 'Pickup Date', 'Pickup Time', 'Customer Name', 'Phone', 'Booking Method', 'Pickup Location', 'Destination', 'Fare', 'Fuel Expense', 'Parking Expense', 'Payment Method', 'Payment Status', 'Driver', 'Vehicle', 'Status', 'Notes'];
    const rows = filteredBookings.map(booking => {
      const driver = drivers.find(d => d.id === booking.driverId);
      const vehicle = vehicles.find(v => v.id === booking.vehicleId);
      const fuelExpense = booking.expenses?.find(e => e.type === 'fuel')?.amount || '';
      const parkingExpense = booking.expenses?.find(e => e.type === 'parking')?.amount || '';
      const bookingCreatedDate = londonExportDate(booking.createdAt);
      const bookingCreatedTime = londonExportTime(booking.createdAt);
      const pickupDate = londonExportDate(booking.pickupTime);
      const pickupTime = londonExportTime(booking.pickupTime);
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

  const exportAnalysis = () => {
    const csv = buildAnalysisCsv(filteredBookings as AnalysisBooking[]);
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `booking-analysis-${new Date().toISOString().split('T')[0]}.csv`);
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
    setSearch('');
    setDateFrom('');
    setDateTo('');
    setSelectedMonth('');
    setStatusFilter('all');
    setPaymentFilter('all');
    setAudienceFilter('all');
    setBrandFilter('all');
    setQuickView('upcoming');
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
        bookingId: booking.id,
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

  const handleSendDriverReminder = async (booking: Booking, leg?: JourneyLeg | null) => {
    const driverId = leg ? leg.driverId : booking.driverId;
    if (!driverId) {
      window.alert(leg?.leg === 'return' ? 'Driver not confirmed' : 'No driver assigned');
      return;
    }
    const driver = drivers.find(d => d.id === driverId);
    if (!driver?.email?.trim()) {
      window.alert('Driver has no email');
      return;
    }
    if (!booking.id) return;
    setSendingDriverReminderId(booking.id);
    try {
      const result = await sendDriverReminderManualCallable({ bookingId: booking.id, leg: leg?.leg || 'outbound' });
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

  const openBooking = (booking: Booking) => {
    sessionStorage.setItem(SCROLL_KEY, String(window.scrollY));
    onEditBooking(booking);
  };

  const visibleIds = sortedBookings.map((booking) => booking.id).filter((id): id is string => Boolean(id));
  const selectedBookings = sortedBookings.filter((booking) => booking.id && selectedIds.includes(booking.id));
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.includes(id));
  const activeDrivers = drivers.filter((driver) => driver.active);
  const availableVehicles = vehicles.filter((vehicle) => vehicle.available);

  const toggleSelected = (id: string) => {
    setSelectedIds((current) => current.includes(id) ? current.filter((item) => item !== id) : [...current, id]);
  };

  const toggleAllVisible = () => {
    setSelectedIds((current) => allVisibleSelected
      ? current.filter((id) => !visibleIds.includes(id))
      : Array.from(new Set([...current, ...visibleIds])));
  };

  const applyBulkEdit = async () => {
    if (bulkSaving || selectedBookings.length === 0) return;
    const changes: BulkJobChanges = { driver: bulkDriver, vehicle: bulkVehicle, status: bulkStatus, payment: bulkPayment, note: bulkNote };
    const updates: { id: string; patch: Extract<ReturnType<typeof planBulkJobUpdate>, { ok: true }>['patch'] }[] = [];
    const skipped: string[] = [];
    selectedBookings.forEach((booking) => {
      const plan = planBulkJobUpdate(booking, changes, new Date().toISOString());
      if (!plan.ok) {
        skipped.push(`${booking.bookingNumber}: ${plan.reason}`);
        return;
      }
      if (booking.id) updates.push({ id: booking.id, patch: plan.patch });
    });
    setBulkSaving(true);
    try {
      if (updates.length > 0) await applyBulkJobUpdates(db, updates);
      const updatedIds = new Set(updates.map((item) => item.id));
      setSelectedIds((current) => current.filter((id) => !updatedIds.has(id)));
      if (updates.length > 0) {
        setBulkDriver('');
        setBulkVehicle('');
        setBulkStatus('');
        setBulkPayment('');
        setBulkNote('');
      }
      const updatedText = updates.length === 1 ? 'Updated 1 job.' : `Updated ${updates.length} jobs.`;
      const skippedText = skipped.length === 0
        ? ''
        : ` ${skipped.length === 1 ? '1 job was left unchanged.' : `${skipped.length} jobs were left unchanged.`} ${skipped.join(' ')}`;
      setBulkMessage(`${updates.length > 0 ? updatedText : 'No jobs were updated.'}${skippedText}`);
    } catch {
      setBulkMessage('Could not save the selected jobs. Check the connection and try again.');
    } finally {
      setBulkSaving(false);
    }
  };

  const changePaymentStatus = async (booking: Booking, paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded') => {
    const current = booking.paymentStatus === 'paid' || booking.paymentStatus === 'partial' || booking.paymentStatus === 'refunded' ? booking.paymentStatus : 'pending';
    if (!booking.id || paymentSavingId || paymentStatus === current) return;
    const label = paymentStatus === 'paid' ? 'Paid' : paymentStatus === 'partial' ? 'Part paid' : paymentStatus === 'refunded' ? 'Refunded' : 'Unpaid';
    setPaymentSavingId(booking.id);
    try {
      await applyBulkJobUpdates(db, [{ id: booking.id, patch: { paymentStatus } }]);
      setPaymentMessage(`${booking.bookingNumber} payment is now ${label}. The amount already received is unchanged.`);
    } catch {
      setPaymentMessage(`Could not update payment for ${booking.bookingNumber}. Try again.`);
    } finally {
      setPaymentSavingId(null);
    }
  };

  const quickViews: { id: QuickView; label: string }[] = [
    { id: 'upcoming', label: 'Upcoming' },
    { id: 'today', label: 'Today' },
    { id: 'tomorrow', label: 'Tomorrow' },
    { id: 'past', label: 'Past' },
    { id: 'unassigned', label: 'Unassigned' },
    { id: 'awaiting_payment', label: 'Awaiting payment' },
    { id: 'all', label: 'All bookings' },
  ];

  return (
    <div>
      <JourneyStatsCard />
      {bookings.filter(b => isPendingIncomingRequest(b)).length > 0 && (
        <div className="alert alert-warning">
          <AlertCircle className="h-5 w-5" />
          <div>
            <h3 style={{ margin: 0, marginBottom: '0.25rem', fontSize: '0.875rem', fontWeight: 600 }}>
              {bookings.filter(b => isPendingIncomingRequest(b)).length} {bookings.filter(b => isPendingIncomingRequest(b)).length === 1 ? 'request' : 'requests'} pending review
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
            <button onClick={exportAnalysis} className="btn btn-secondary btn-sm" type="button">
              Analysis export
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
        <div style={{ padding: '0 1.25rem 1rem' }}>
          <div className="booking-view-row" role="toolbar" aria-label="Booking views">
            {quickViews.map((view) => (
              <button key={view.id} type="button" className={`booking-view-chip${quickView === view.id ? ' is-active' : ''}`} aria-pressed={quickView === view.id} onClick={() => setQuickView(view.id)}>{view.label}</button>
            ))}
          </div>
          <input aria-label="Search bookings" className="form-input" placeholder="Search customer, booking reference, phone or journey" value={search} onChange={e => setSearch(e.target.value)} />
          <p className="text-sm text-gray-500" style={{ margin: '0.5rem 0 0' }}>{filteredBookings.length} bookings shown. Upcoming journeys are nearest first. Past journeys are most recent first.</p>
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
            <div><label className="block text-sm font-medium text-gray-700 mb-1">Status</label><select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="w-full px-3 py-2 border border-gray-300 rounded-md"><option value="all">All Status</option><option value="pending">Pending</option><option value="awaiting_customer_confirmation">Awaiting customer confirmation</option><option value="confirmed">Confirmed</option><option value="allocated">Allocated</option><option value="completed">Completed</option><option value="cancelled">Cancelled</option></select></div>
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
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Brand</label>
              <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value as 'all' | 'spires_taxis' | 'spires_international')} className="w-full px-3 py-2 border border-gray-300 rounded-md">
                <option value="all">All brands</option>
                <option value="spires_taxis">Spires Taxis</option>
                <option value="spires_international">Spires International</option>
              </select>
            </div>
          </div>
        </div>
        )}
        <div className="bg-gradient-to-r from-green-50 to-blue-50 p-6 rounded-lg border border-green-200" style={{ marginTop: '1.5rem' }}>
        <div className="flex items-center mb-4"><DollarSign className="h-6 w-6 text-green-600 mr-2" /><h3 className="text-lg font-semibold text-gray-900">Accounting Summary</h3><span className="ml-auto text-sm text-gray-600">{filteredBookings.length} booking{filteredBookings.length !== 1 ? 's' : ''}{selectedMonth && ` in ${new Date(selectedMonth).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' })}`}</span></div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-4">
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Quoted fares on completed jobs</p><p className="text-2xl font-bold text-green-600">{gbp(accountingSummary.totalRevenue)}</p>{accountingSummary.faresMissing > 0 && accountingSummary.totalRevenue !== null ? <p className="text-xs text-gray-500 mt-1">{missingCount(accountingSummary.faresMissing, "no quoted fare")}</p> : null}</div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Recorded expenses</p><p className="text-2xl font-bold text-red-600">{gbp(accountingSummary.totalExpenses)}</p>{accountingSummary.expensesMissing > 0 && accountingSummary.totalExpenses !== null ? <p className="text-xs text-gray-500 mt-1">{missingCount(accountingSummary.expensesMissing, "no recorded expenses")}</p> : null}</div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Money received</p><p className="text-2xl font-bold text-blue-600">{gbp(accountingSummary.paidAmount)}</p>{accountingSummary.unrecordedCount > 0 && accountingSummary.paidAmount !== null ? <p className="text-xs text-gray-500 mt-1">{missingCount(accountingSummary.unrecordedCount, "no recorded payment")}</p> : null}</div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm text-gray-600">Completed Jobs</p><p className="text-2xl font-bold text-gray-900">{accountingSummary.totalBookings}</p></div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm font-medium text-gray-700 mb-2">Payment Status</p><div className="space-y-2"><div className="flex justify-between"><span className="text-sm text-gray-600">Recorded payment ({accountingSummary.recordedCount})</span><span className="text-sm font-semibold text-green-600">{gbp(accountingSummary.paidAmount)}</span></div><div className="flex justify-between"><span className="text-sm text-gray-600">Payment not recorded ({accountingSummary.unrecordedCount})</span><span className="text-sm font-semibold text-red-600">Unknown</span></div></div></div>
          <div className="bg-white p-4 rounded-lg shadow-sm"><p className="text-sm font-medium text-gray-700 mb-2">Revenue by Driver</p><div className="space-y-2 max-h-24 overflow-y-auto">{accountingSummary.driverRevenue.length > 0 ? accountingSummary.driverRevenue.map((dr, idx) => (<div key={idx} className="flex justify-between"><span className="text-sm text-gray-600">{dr.driver} ({dr.bookings})</span><span className="text-sm font-semibold text-blue-600">{gbp(dr.revenue)}</span></div>)) : (<p className="text-sm text-gray-500">No completed bookings</p>)}{accountingSummary.driverRevenue.some((dr) => dr.knownFares < dr.bookings) ? <p className="text-xs text-gray-500 mt-2">Jobs with no quoted fare are left out of the driver amounts.</p> : null}</div></div>
        </div>
      </div>
      </div>
      <div className="card booking-list-card" style={{ marginTop: '1.5rem' }} ref={listRef}>
        {selectedBookings.length > 0 && (
          <section className="bulk-edit" aria-label="Edit selected jobs">
            <p className="bulk-edit-count">{selectedBookings.length} selected</p>
            <div className="bulk-edit-grid">
              <label>
                Driver
                <select className="form-input" value={bulkDriver} onChange={(event) => setBulkDriver(event.target.value)} disabled={bulkSaving}>
                  <option value="">Leave unchanged</option>
                  <option value="clear">Remove driver</option>
                  {activeDrivers.map((driver) => <option key={driver.id} value={driver.id}>{driver.name}</option>)}
                </select>
              </label>
              <label>
                Vehicle
                <select className="form-input" value={bulkVehicle} onChange={(event) => setBulkVehicle(event.target.value)} disabled={bulkSaving}>
                  <option value="">Leave unchanged</option>
                  <option value="clear">Remove vehicle</option>
                  {availableVehicles.map((vehicle) => <option key={vehicle.id} value={vehicle.id}>{vehicle.registration}</option>)}
                </select>
              </label>
              <label>
                Payment status
                <select className="form-input" value={bulkPayment} onChange={(event) => setBulkPayment(event.target.value as BulkJobChanges['payment'])} disabled={bulkSaving}>
                  <option value="">Leave unchanged</option>
                  <option value="pending">Unpaid</option>
                  <option value="partial">Part paid</option>
                  <option value="paid">Paid</option>
                  <option value="refunded">Refunded</option>
                </select>
              </label>
              <label>
                Job status
                <select className="form-input" value={bulkStatus} onChange={(event) => setBulkStatus(event.target.value as BulkJobChanges['status'])} disabled={bulkSaving}>
                  <option value="">Leave unchanged</option>
                  <option value="pending">Pending</option>
                  <option value="awaiting_customer_confirmation">Awaiting customer confirmation</option>
                  <option value="confirmed">Confirmed</option>
                  <option value="allocated">Allocated</option>
                  <option value="completed">Completed</option>
                  <option value="cancelled">Cancelled</option>
                </select>
              </label>
              <label>
                Add a note
                <textarea className="form-input" rows={2} value={bulkNote} onChange={(event) => setBulkNote(event.target.value)} disabled={bulkSaving} />
              </label>
            </div>
            <p className="bulk-edit-note">The fare and customer details stay on each job. Changing the payment status does not change the amount already received.</p>
            {bulkMessage ? <p className="bulk-edit-result" role="status">{bulkMessage}</p> : null}
            <div className="bulk-edit-actions">
              <button type="button" className="btn btn-primary" onClick={() => void applyBulkEdit()} disabled={bulkSaving || (!bulkDriver && !bulkVehicle && !bulkStatus && !bulkPayment && !bulkNote.trim())}>
                {bulkSaving ? 'Saving…' : `Apply to ${selectedBookings.length} ${selectedBookings.length === 1 ? 'job' : 'jobs'}`}
              </button>
              <button type="button" className="btn btn-secondary" onClick={() => { setSelectedIds([]); setBulkMessage(''); }} disabled={bulkSaving}>Clear selection</button>
            </div>
          </section>
        )}
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
          <>
            {paymentMessage ? <p className="booking-payment-result" role="status">{paymentMessage}</p> : null}
            {!compactList ? (
            <div className="booking-table-wrap">
              <table className="booking-table">
                <caption className="sr-only">Bookings</caption>
                <thead>
                  <tr>
                    <th>
                      <input className="booking-select" type="checkbox" aria-label="Select all shown jobs" checked={allVisibleSelected} onChange={toggleAllVisible} />
                    </th>
                    <th>Pickup</th>
                    <th>Customer</th>
                    <th>Route</th>
                    <th>Vehicle</th>
                    <th>Fare</th>
                    <th>Booking</th>
                    <th>Payment</th>
                    <th>Driver</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {shownRows.map(({ booking, leg }) => {
                    const vehicle = vehicles.find(v => v.id === booking.vehicleId);
                    const ext = booking as ExtendedBooking;
                    const receivedPence = Number(booking.amountReceivedPence || 0);
                    const balancePence = Math.max(0, Math.round((booking.actualFare || 0) * 100) - receivedPence);
                    const workflow = effectiveWorkflowStatus(booking);
                    const shownStatus = leg?.needsReview ? 'needs_review' : (leg?.status || workflow);
                    const driverId = leg ? leg.driverId : (booking.driverId || '');
                    const driver = drivers.find(d => d.id === driverId);
                    const when = leg?.pickupAt || booking.pickupTime || booking.dateTime;
                    const routeFrom = leg?.pickupLocation || booking.pickupLocation;
                    const routeTo = leg?.destination || booking.destination;
                    const rowKey = `${booking.id || booking.bookingNumber}-${leg?.leg || 'booking'}`;
                    const nextAction = workflow === 'pending' ? 'Prepare quote'
                      : workflow === 'awaiting_customer_confirmation' ? (booking.quoteAcceptanceSubstatus === 'awaiting_payment' ? 'Record deposit or payment' : 'Review quote and acceptance')
                      : shownStatus !== 'cancelled' && shownStatus !== 'completed' && !driverId ? 'Assign driver' : 'Open booking';
                    const routeOpen = openRouteId === rowKey;
                    const returnJourney = isReturnBooking(booking);
                    const unassigned = !driverId && shownStatus !== 'cancelled' && shownStatus !== 'completed';
                    const badgeLabel = shownStatus === 'needs_review' ? 'Needs review' : workflowStatusLabel(shownStatus);
                    const badgeClass = shownStatus === 'needs_review' ? 'badge-awaiting' : workflowBadgeClass(shownStatus);
                    const driverLabel = driver?.name || (leg?.leg === 'return' ? 'Driver not confirmed' : 'Unassigned');
                    return (
                      <tr key={rowKey} className={unassigned ? 'is-unassigned' : undefined}>
                        <td>
                          <input className="booking-select" type="checkbox" aria-label={`Select ${booking.bookingNumber}`} checked={Boolean(booking.id && selectedIds.includes(booking.id))} onChange={() => booking.id && toggleSelected(booking.id)} />
                        </td>
                        <td>{londonWhen(when)}</td>
                        <td>
                          <div className="booking-customer">{booking.hirerName}</div>
                          <div className="booking-ref">{booking.bookingNumber}{leg?.leg === 'return' ? ' · Return' : ''}</div>
                          {brandOf(booking) === 'spires_international' ? <div className="booking-ref">Spires International</div> : null}
                        </td>
                        <td className="booking-route-cell">
                          <div className={`booking-route${routeOpen ? ' is-open' : ''}`}>{leg?.leg === 'return' ? 'Return: ' : leg?.leg === 'outbound' ? 'Outbound: ' : ''}{routeFrom} → {routeTo}</div>
                          <button type="button" className="booking-route-toggle" aria-expanded={routeOpen} onClick={() => setOpenRouteId(routeOpen ? null : rowKey)}>
                            {routeOpen ? 'Hide full address' : 'Full address'}
                          </button>
                          {leg?.leg !== 'return' && hasExtraStops(normaliseStops(ext.stops, booking.pickupLocation, booking.destination)) ? <p className="booking-legs">{describeStops(normaliseStops(ext.stops, booking.pickupLocation, booking.destination))}. Extra stops. Agree the fare.</p> : null}
                          {leg?.leg === 'return' ? (
                            <div className="booking-legs">
                              {leg.needsReview ? <p>Needs review. The return was not marked completed.</p> : null}
                              <p>The fare is for the whole booking.</p>
                            </div>
                          ) : null}
                          {!leg && returnJourney ? (
                            <div className="booking-legs">
                              <p><span>Outbound</span> {londonWhen(booking.pickupTime)}</p>
                              <p>{booking.pickupLocation} → {booking.destination}</p>
                              <p><span>Return</span> {ext.openReturn ? openReturnSummary(ext) : londonWhen(ext.returnPickupTime)}</p>
                              <p>{ext.returnPickupLocation || 'Pickup not recorded'} → {ext.returnDestination || 'Destination not recorded'}</p>
                              {hasExtraStops(normaliseStops(ext.returnStops, ext.returnPickupLocation, ext.returnDestination)) ? <p>{describeStops(normaliseStops(ext.returnStops, ext.returnPickupLocation, ext.returnDestination))}. Extra stops. Agree the fare.</p> : null}
                              <p>The fare is for the whole booking.</p>
                            </div>
                          ) : null}
                        </td>
                        <td>{formatVehicleTypeLabel(ext.vehicleType)}{ext.passengers ? ` · ${ext.passengers}` : ''}</td>
                        <td>{booking.actualFare != null ? `£${Number(booking.actualFare).toFixed(2)}` : 'Not set'}{hasExtraStops(normaliseStops(ext.stops, booking.pickupLocation, booking.destination)) || hasExtraStops(normaliseStops(ext.returnStops, ext.returnPickupLocation, ext.returnDestination)) ? <div className="booking-failed">Extra stops. Agree the fare.</div> : null}</td>
                        <td><span className={`badge ${badgeClass}`}>{badgeLabel}</span></td>
                        <td>
                          <span className={`badge ${booking.paymentStatus === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>{paymentLabel(booking)}</span>
                          <select className="booking-payment-select" aria-label={`Payment status for ${booking.bookingNumber}`} value={booking.paymentStatus === 'paid' || booking.paymentStatus === 'partial' || booking.paymentStatus === 'refunded' ? booking.paymentStatus : 'pending'} disabled={paymentSavingId === booking.id} onChange={(event) => void changePaymentStatus(booking, event.target.value as 'pending' | 'partial' | 'paid' | 'refunded')}>
                            <option value="pending">Unpaid</option>
                            <option value="partial">Part paid</option>
                            <option value="paid">Paid</option>
                            <option value="refunded">Refunded</option>
                          </select>
                          {receivedPence > 0 && balancePence > 0 ? <div className="booking-balance">Received £{(receivedPence / 100).toFixed(2)} · Remaining £{(balancePence / 100).toFixed(2)}</div> : null}
                          {booking.quoteEmailStatus === 'failed' ? <p role="status" className="booking-failed">Quote email failed. Open booking to retry.</p> : null}
                        </td>
                        <td className={unassigned ? 'booking-unassigned' : undefined}>{driverLabel}{vehicle?.registration ? ` · ${vehicle.registration}` : ''}</td>
                        <td>
                          <div className="booking-card-actions">
                            <button type="button" onClick={() => openBooking(booking)} className="btn btn-primary btn-sm"><Edit3 className="h-4 w-4" />{nextAction}</button>
                            <details className="booking-more-actions">
                              <summary className="btn btn-secondary btn-sm">More actions</summary>
                              <div className="booking-actions-menu">
                                <button type="button" onClick={() => handleSendDriverReminder(booking, leg)} className="btn btn-secondary btn-sm" aria-label="Send Driver Reminder" disabled={sendingDriverReminderId === booking.id}><Mail className="h-4 w-4" />{sendingDriverReminderId === booking.id ? 'Sending…' : 'Send Driver Reminder'}</button>
                                <button type="button" onClick={() => onCreateReturnBooking(booking)} className="btn btn-secondary btn-sm" aria-label="Add return journey to this booking"><ArrowLeftRight className="h-4 w-4" /> Add return</button>
                                <button type="button" onClick={() => onDuplicateBooking(booking)} className="btn btn-secondary btn-sm"> <Copy className="h-4 w-4" /> Duplicate</button>
                                <button type="button" onClick={() => onGeneratePDF(booking)} className="btn btn-success btn-sm"><Download className="h-4 w-4" /> Download PDF</button>
                                <button type="button" onClick={() => void handleSendCustomerPdf(booking)} className="btn btn-success btn-sm" disabled={sendingCustomerPdfId === booking.id}><Send className="h-4 w-4" />{sendingCustomerPdfId === booking.id ? 'Sending…' : booking.paymentStatus === 'paid' ? 'Email receipt' : booking.status === 'completed' ? 'Email payment request' : 'Email confirmation'}</button>
                                <button type="button" onClick={() => onDeleteBooking(booking.id!, booking.bookingNumber)} className="btn btn-danger btn-sm"> <Trash2 className="h-4 w-4" /> Delete</button>
                              </div>
                            </details>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            ) : (
            <div className="booking-mobile-list">
              {shownRows.map(({ booking, leg }) => {
                const ext = booking as ExtendedBooking;
                const workflow = effectiveWorkflowStatus(booking);
                const shownStatus = leg?.needsReview ? 'needs_review' : (leg?.status || workflow);
                const driverId = leg ? leg.driverId : (booking.driverId || '');
                const driver = drivers.find(d => d.id === driverId);
                const when = leg?.pickupAt || booking.pickupTime || booking.dateTime;
                const routeFrom = leg?.pickupLocation || booking.pickupLocation;
                const routeTo = leg?.destination || booking.destination;
                const rowKey = `${booking.id || booking.bookingNumber}-${leg?.leg || 'booking'}`;
                const nextAction = workflow === 'pending' ? 'Prepare quote'
                  : workflow === 'awaiting_customer_confirmation' ? (booking.quoteAcceptanceSubstatus === 'awaiting_payment' ? 'Record deposit or payment' : 'Review quote and acceptance')
                  : shownStatus !== 'cancelled' && shownStatus !== 'completed' && !driverId ? 'Assign driver' : 'Open booking';
                const returnJourney = isReturnBooking(booking);
                const badgeLabel = shownStatus === 'needs_review' ? 'Needs review' : workflowStatusLabel(shownStatus);
                const badgeClass = shownStatus === 'needs_review' ? 'badge-awaiting' : workflowBadgeClass(shownStatus);
                const driverLabel = driver?.name || (leg?.leg === 'return' ? 'Driver not confirmed' : 'Unassigned');
                return (
                  <div key={rowKey} className="booking-mobile-card">
                    <label className="booking-mobile-select">
                      <input className="booking-select" type="checkbox" aria-label={`Select ${booking.bookingNumber}`} checked={Boolean(booking.id && selectedIds.includes(booking.id))} onChange={() => booking.id && toggleSelected(booking.id)} />
                      Select
                    </label>
                    <details>
                    <summary>
                      <span>{londonWhen(when)}</span>
                      <strong>{booking.hirerName}</strong>
                      <span>{leg?.leg === 'return' ? 'Return: ' : ''}{routeFrom} → {routeTo}</span>
                      <span className={`badge ${badgeClass}`}>{badgeLabel}</span>
                      <span className={`badge ${booking.paymentStatus === 'paid' ? 'badge-paid' : 'badge-unpaid'}`}>{paymentLabel(booking)}</span>
                      <span>{driverLabel}</span>
                    </summary>
                    <div className="booking-mobile-body">
                      <p>{booking.bookingNumber}{leg?.leg === 'return' ? ' · Return' : ''}</p>
                      {leg?.needsReview ? <p>Needs review. The return was not marked completed.</p> : null}
                      {leg?.leg !== 'return' && hasExtraStops(normaliseStops(ext.stops, booking.pickupLocation, booking.destination)) ? <p>{describeStops(normaliseStops(ext.stops, booking.pickupLocation, booking.destination))}. Extra stops. Agree the fare.</p> : null}
                      {leg?.leg === 'return' || (!leg && returnJourney) ? <p>{leg?.leg === 'return' ? `${routeFrom} → ${routeTo}.` : ext.openReturn ? openReturnSummary(ext) : `Return ${londonWhen(ext.returnPickupTime)}. ${ext.returnPickupLocation} → ${ext.returnDestination}.`} The fare is for the whole booking.</p> : null}
                      {hasExtraStops(normaliseStops(ext.returnStops, ext.returnPickupLocation, ext.returnDestination)) ? <p>{describeStops(normaliseStops(ext.returnStops, ext.returnPickupLocation, ext.returnDestination))}. Extra stops. Agree the fare.</p> : null}
                      <select className="booking-payment-select" aria-label={`Payment status for ${booking.bookingNumber}`} value={booking.paymentStatus === 'paid' || booking.paymentStatus === 'partial' || booking.paymentStatus === 'refunded' ? booking.paymentStatus : 'pending'} disabled={paymentSavingId === booking.id} onChange={(event) => void changePaymentStatus(booking, event.target.value as 'pending' | 'partial' | 'paid' | 'refunded')}>
                        <option value="pending">Unpaid</option>
                        <option value="partial">Part paid</option>
                        <option value="paid">Paid</option>
                        <option value="refunded">Refunded</option>
                      </select>
                      <button type="button" onClick={() => openBooking(booking)} className="btn btn-primary btn-sm">{nextAction}</button>
                      <details className="booking-more-actions">
                        <summary className="btn btn-secondary btn-sm">More actions</summary>
                        <div className="booking-actions-menu">
                          <button type="button" onClick={() => handleSendDriverReminder(booking, leg)} className="btn btn-secondary btn-sm" aria-label="Send Driver Reminder">Send Driver Reminder</button>
                          <button type="button" onClick={() => onCreateReturnBooking(booking)} className="btn btn-secondary btn-sm" aria-label="Add return journey to this booking">Add return</button>
                          <button type="button" onClick={() => onDuplicateBooking(booking)} className="btn btn-secondary btn-sm">Duplicate</button>
                          <button type="button" onClick={() => onGeneratePDF(booking)} className="btn btn-success btn-sm">Download PDF</button>
                          <button type="button" onClick={() => void handleSendCustomerPdf(booking)} className="btn btn-success btn-sm">{booking.paymentStatus === 'paid' ? 'Email receipt' : booking.status === 'completed' ? 'Email payment request' : 'Email confirmation'}</button>
                          <button type="button" onClick={() => onDeleteBooking(booking.id!, booking.bookingNumber)} className="btn btn-danger btn-sm">Delete</button>
                        </div>
                      </details>
                    </div>
                    </details>
                  </div>
                );
              })}
            </div>
            )}
          </>
        )}
      </div>
    </div>
  );
};

export default Bookings;