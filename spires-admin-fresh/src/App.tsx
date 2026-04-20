import React, { useState, useEffect, useMemo } from 'react';
import { onAuthStateChanged, signOut, User } from 'firebase/auth';
import { auth } from './utils/firebase';

import { Driver, Vehicle, Booking } from './types/types';
import { useDrivers, useVehicles, useBookings, useDriverLimitCheck } from './hooks/useFirebase';
import { useBookingDesktopReminders } from './hooks/useBookingDesktopReminders';
import { generateBookingConfirmationPDF } from './utils/pdfGenerator';
import { isCustomerBooking } from './utils/bookingMapper';
import { countUpcomingWithinMs } from './utils/bookingSchedule';
import { buildCustomerSuggestionsFromBookings } from './utils/customerSuggestions';
import { buildReturnTripDraft } from './utils/bookingReturn';
import type { ExtendedBooking } from './types/types';

import Login from './components/Login';
import Header from './components/Header';
import Navigation from './components/Navigation';
import Dashboard from './components/Dashboard';
import Drivers from './components/Drivers';
import Vehicles from './components/Vehicles';
import Bookings from './components/Bookings';
import LinkBookings from './components/LinkBookings';
import Loading from './components/Loading';
import DriverModal from './components/DriverModal';
import VehicleModal from './components/VehicleModal';
import BookingModal from './components/BookingModal';
import './styles.css';

const DESKTOP_REMINDERS_KEY = 'spires_admin_desktop_reminders';
const UPCOMING_SOON_MS = 48 * 60 * 60 * 1000;

const App: React.FC = () => {
  const [user, setUser] = useState<User | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [desktopRemindersEnabled, setDesktopRemindersEnabled] = useState(() =>
    typeof window !== 'undefined' && localStorage.getItem(DESKTOP_REMINDERS_KEY) === 'true'
  );
  const [headerNow, setHeaderNow] = useState(() => new Date());

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setAuthLoading(false);
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    const id = window.setInterval(() => setHeaderNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const driversHook = useDrivers();
  const vehiclesHook = useVehicles();
  const bookingsHook = useBookings();
  const driverLimitCheck = useDriverLimitCheck(driversHook.drivers);

  const bookingLocationSuggestions = useMemo(() => {
    const seen = new Set<string>();
    for (const b of bookingsHook.bookings) {
      const pickup = (b.pickupLocation || '').trim();
      const dest = (b.destination || '').trim();
      if (pickup.length > 0) seen.add(pickup);
      if (dest.length > 0) seen.add(dest);
    }
    return Array.from(seen).sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' }));
  }, [bookingsHook.bookings]);

  const customerSuggestions = useMemo(
    () => buildCustomerSuggestionsFromBookings(bookingsHook.bookings),
    [bookingsHook.bookings]
  );

  const upcomingSoonCount = useMemo(
    () => countUpcomingWithinMs(bookingsHook.bookings, headerNow, UPCOMING_SOON_MS),
    [bookingsHook.bookings, headerNow]
  );
  useBookingDesktopReminders(desktopRemindersEnabled, bookingsHook.bookings);

  const [showDriverModal, setShowDriverModal] = useState(false);
  const [showVehicleModal, setShowVehicleModal] = useState(false);
  const [showBookingModal, setShowBookingModal] = useState(false);
  const [editingItem, setEditingItem] = useState<any>(null);
  const [bookingModalInitialDraft, setBookingModalInitialDraft] = useState<Partial<ExtendedBooking> | null>(null);

  const handleLogout = async () => {
    try {
      await signOut(auth);
    } catch (error) {
      console.error('Error signing out:', error);
    }
  };

  if (authLoading) {
    return <Loading />;
  }

  if (!user) {
    return <Login onLoginSuccess={() => {}} />;
  }

  const activeDrivers = driversHook.getActiveDrivers();
  const availableVehicles = vehiclesHook.getAvailableVehicles();
  const todaysBookings = bookingsHook.getTodaysBookings();
  
  // Count pending customer bookings that need review
  const pendingCustomerBookings = bookingsHook.bookings.filter(
    booking => isCustomerBooking(booking) && booking.status === 'pending'
  );
  const pendingCustomerBookingsCount = pendingCustomerBookings.length;

  const handleDesktopRemindersChange = async (enabled: boolean) => {
    if (enabled && typeof Notification !== 'undefined') {
      if (Notification.permission === 'denied') {
        window.alert(
          'Notifications are blocked for this site. Enable them in your browser settings if you want desktop reminders.'
        );
        return;
      }
      if (Notification.permission === 'default') {
        const permission = await Notification.requestPermission();
        if (permission !== 'granted') {
          window.alert('Notifications were not enabled. You can try again from the dashboard at any time.');
          return;
        }
      }
    }
    setDesktopRemindersEnabled(enabled);
    localStorage.setItem(DESKTOP_REMINDERS_KEY, enabled ? 'true' : 'false');
  };

  const handleAddDriver = async (driver: Omit<Driver, 'id' | 'createdAt'>) => {
    try {
      if (driver.active && driverLimitCheck.isAtLimit) {
        alert('Maximum 3 active drivers allowed by Oxford City Council.');
        return;
      }
      await driversHook.addDriver(driver);
      setShowDriverModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to add driver');
    }
  };

  const handleEditDriver = (driver: Driver) => {
    setEditingItem(driver);
    setShowDriverModal(true);
  };

  const handleUpdateDriver = async (driver: Partial<Driver>) => {
    try {
      if (driver.active && !editingItem.active && driverLimitCheck.isAtLimit) {
        alert('Maximum 3 active drivers allowed by Oxford City Council.');
        return;
      }
      await driversHook.updateDriver(editingItem.id!, driver);
      setShowDriverModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to update driver');
    }
  };

  const handleDeleteDriver = async (id: string, name: string) => {
    if (window.confirm(`Delete ${name}?`)) {
      try {
        await driversHook.deleteDriver(id);
      } catch (error) {
        alert('Failed to delete driver');
      }
    }
  };

  const handleAddVehicle = async (vehicle: Omit<Vehicle, 'id' | 'createdAt'>) => {
    try {
      await vehiclesHook.addVehicle(vehicle);
      setShowVehicleModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to add vehicle');
    }
  };

  const handleEditVehicle = (vehicle: Vehicle) => {
    setEditingItem(vehicle);
    setShowVehicleModal(true);
  };

  const handleUpdateVehicle = async (vehicle: Partial<Vehicle>) => {
    try {
      await vehiclesHook.updateVehicle(editingItem.id!, vehicle);
      setShowVehicleModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to update vehicle');
    }
  };

  const handleDeleteVehicle = async (id: string, registration: string) => {
    if (window.confirm(`Delete ${registration}?`)) {
      try {
        await vehiclesHook.deleteVehicle(id);
      } catch (error) {
        alert('Failed to delete vehicle');
      }
    }
  };

  const handleAddBooking = async (booking: any) => {
    try {
      // BookingModal already persisted new bookings via setDoc(bookings/{id})
      if (booking?.id) {
        setShowBookingModal(false);
        setEditingItem(null);
        return;
      }
      await bookingsHook.addBooking(booking);
      setShowBookingModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to add booking');
    }
  };

  const handleEditBooking = (booking: Booking) => {
    setBookingModalInitialDraft(null);
    setEditingItem(booking);
    setShowBookingModal(true);
  };

  const handleUpdateBooking = async (booking: any) => {
    try {
      await bookingsHook.updateBooking(editingItem.id!, booking);
      setShowBookingModal(false);
      setEditingItem(null);
    } catch (error) {
      alert('Failed to update booking');
    }
  };

  // NEW: For CSV Import - directly saves without opening modal
  const handleSaveBookingDirect = async (booking: any) => {
    try {
      if (booking.id) {
        await bookingsHook.updateBooking(booking.id, booking);
      } else {
        await bookingsHook.addBooking(booking);
      }
    } catch (error) {
      console.error('Failed to save booking:', error);
      throw error;
    }
  };

  const handleDeleteBooking = async (id: string, bookingNumber: string) => {
    if (window.confirm(`Delete booking ${bookingNumber}?`)) {
      try {
        await bookingsHook.deleteBooking(id);
      } catch (error) {
        alert('Failed to delete booking');
      }
    }
  };

  const handleDuplicateBooking = (booking: Booking) => {
    setBookingModalInitialDraft(null);
    const duplicatedBooking = {
      ...booking,
      id: undefined,
      bookingNumber: `SP${Date.now()}`,
      hirerName: '',
      hirerPhone: '',
      dateTime: new Date().toISOString(),
      status: 'pending' as const,
      paymentStatus: 'pending' as const
    };
    setEditingItem(duplicatedBooking);
    setShowBookingModal(true);
  };

  const handleCreateReturnTrip = (booking: Booking) => {
    setEditingItem(null);
    setBookingModalInitialDraft(buildReturnTripDraft(booking));
    setShowBookingModal(true);
  };

  const resolvePdfType = (
    booking: Booking
  ): "booking_confirmation" | "payment_receipt" | "payment_request" => {
    if (booking.paymentStatus === "paid") {
      return "payment_receipt";
    }

    if (booking.status === "completed") {
      return "payment_request";
    }

    return "booking_confirmation";
  };

  const handleGeneratePDF = (booking: Booking) => {
    const driver = driversHook.drivers.find(d => d.id === booking.driverId);
    const vehicle = vehiclesHook.vehicles.find(v => v.id === booking.vehicleId);
    const documentType = resolvePdfType(booking);
    generateBookingConfirmationPDF(booking, driver, vehicle, documentType);
  };

  const openDriverModal = () => {
    setEditingItem(null);
    setShowDriverModal(true);
  };

  const openVehicleModal = () => {
    setEditingItem(null);
    setShowVehicleModal(true);
  };

  const openBookingModal = () => {
    setEditingItem(null);
    setBookingModalInitialDraft(null);
    setShowBookingModal(true);
  };

  const closeDriverModal = () => {
    setShowDriverModal(false);
    setEditingItem(null);
  };

  const closeVehicleModal = () => {
    setShowVehicleModal(false);
    setEditingItem(null);
  };

  const closeBookingModal = () => {
    setShowBookingModal(false);
    setEditingItem(null);
    setBookingModalInitialDraft(null);
  };

  if (driversHook.loading || vehiclesHook.loading || bookingsHook.loading) {
    return <Loading />;
  }

  const renderContent = () => {
    switch (activeTab) {
      case 'dashboard':
        return (
          <Dashboard
            activeDriversCount={activeDrivers.length}
            availableVehiclesCount={availableVehicles.length}
            totalBookings={bookingsHook.bookings.length}
            todaysBookingsCount={todaysBookings.length}
            isAtDriverLimit={driverLimitCheck.isAtLimit}
            pendingCustomerBookingsCount={pendingCustomerBookingsCount}
            bookings={bookingsHook.bookings}
            desktopRemindersEnabled={desktopRemindersEnabled}
            onDesktopRemindersChange={handleDesktopRemindersChange}
          />
        );
      case 'drivers':
        return (
          <Drivers
            drivers={driversHook.drivers}
            activeCount={driverLimitCheck.activeCount}
            isAtLimit={driverLimitCheck.isAtLimit}
            remainingSlots={driverLimitCheck.remainingSlots}
            onAddDriver={openDriverModal}
            onEditDriver={handleEditDriver}
            onDeleteDriver={handleDeleteDriver}
          />
        );
      case 'vehicles':
        return (
          <Vehicles
            vehicles={vehiclesHook.vehicles}
            onAddVehicle={openVehicleModal}
            onEditVehicle={handleEditVehicle}
            onDeleteVehicle={handleDeleteVehicle}
          />
        );
      case 'bookings':
        return (
          <Bookings
            bookings={bookingsHook.bookings}
            drivers={driversHook.drivers}
            vehicles={vehiclesHook.vehicles}
            onAddBooking={openBookingModal}
            onEditBooking={handleEditBooking}
            onSaveBookingDirect={handleSaveBookingDirect}
            onDeleteBooking={handleDeleteBooking}
            onGeneratePDF={handleGeneratePDF}
            onDuplicateBooking={handleDuplicateBooking}
            onCreateReturnBooking={handleCreateReturnTrip}
          />
        );
      case 'link-bookings':
        return <LinkBookings />;
      default:
        return <div>Page not found</div>;
    }
  };

  return (
    <div className="admin-wrapper">
      <Header
        activeDriversCount={activeDrivers.length}
        availableVehiclesCount={availableVehicles.length}
        pendingCustomerBookingsCount={pendingCustomerBookingsCount}
        upcomingSoonCount={upcomingSoonCount}
        onLogout={handleLogout}
      />
      <Navigation activeTab={activeTab} setActiveTab={setActiveTab} />
      <main className="admin-main">
        {renderContent()}
      </main>
      {showDriverModal && (<DriverModal isOpen={showDriverModal} onClose={closeDriverModal} onSubmit={editingItem ? handleUpdateDriver : handleAddDriver} editingDriver={editingItem} isAtLimit={driverLimitCheck.isAtLimit} />)}
      {showVehicleModal && (<VehicleModal isOpen={showVehicleModal} onClose={closeVehicleModal} onSubmit={editingItem ? handleUpdateVehicle : handleAddVehicle} editingVehicle={editingItem} />)}
      {showBookingModal && (
        <BookingModal
          isOpen={showBookingModal}
          onClose={closeBookingModal}
          onSubmit={editingItem ? handleUpdateBooking : handleAddBooking}
          editingBooking={editingItem}
          activeDrivers={activeDrivers}
          availableVehicles={availableVehicles}
          locationSuggestions={bookingLocationSuggestions}
          customerSuggestions={customerSuggestions}
          initialDraft={bookingModalInitialDraft}
        />
      )}
    </div>
  );
};

export default App;