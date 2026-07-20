// Dashboard.tsx - Put this in a separate file
import React, { useEffect, useMemo, useState } from 'react';
import { Users, Car, FileText, Calendar, AlertTriangle, Bell, Clock } from 'lucide-react';
import { Booking } from '../types/types';
import {
  formatPickupDisplay,
  formatTimeUntil,
  getUpcomingBookings
} from '../utils/bookingSchedule';

interface DashboardProps {
  activeDriversCount: number;
  availableVehiclesCount: number;
  totalBookings: number;
  todaysBookingsCount: number;
  isAtDriverLimit: boolean;
  pendingCustomerBookingsCount: number;
  bookings: Booking[];
  desktopRemindersEnabled: boolean;
  onDesktopRemindersChange: (enabled: boolean) => void | Promise<void>;
}

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_LIST_MAX = 20;

const Dashboard: React.FC<DashboardProps> = ({
  activeDriversCount,
  availableVehiclesCount,
  totalBookings,
  todaysBookingsCount,
  isAtDriverLimit,
  pendingCustomerBookingsCount,
  bookings,
  desktopRemindersEnabled,
  onDesktopRemindersChange
}) => {
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  const upcoming = useMemo(
    () => getUpcomingBookings(bookings, now, { withinMs: UPCOMING_WINDOW_MS, maxItems: UPCOMING_LIST_MAX }),
    [bookings, now]
  );

  const handleDesktopToggle = async (next: boolean) => {
    await onDesktopRemindersChange(next);
  };

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold text-gray-900">Dashboard</h2>
      
      {pendingCustomerBookingsCount > 0 && (
        <div className="bg-orange-50 border-l-4 border-orange-500 p-4 rounded-lg">
          <div className="flex items-center">
            <Bell className="h-5 w-5 text-orange-600 mr-3 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-orange-900">
                {pendingCustomerBookingsCount} New Customer {pendingCustomerBookingsCount === 1 ? 'Booking' : 'Bookings'} Pending Review
              </h3>
              <p className="text-sm text-orange-700 mt-1">
                Go to the Bookings page to review and confirm customer bookings with pricing.
              </p>
            </div>
          </div>
        </div>
      )}
      
      {isAtDriverLimit && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <div className="flex">
            <AlertTriangle className="w-5 h-5 text-yellow-600 mr-3 flex-shrink-0 mt-0.5" />
            <div>
              <h3 className="text-sm font-medium text-yellow-800">Maximum Driver Limit Reached</h3>
              <p className="text-sm text-yellow-700 mt-1">
                You have reached the Oxford City Council limit of 3 active drivers.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Upcoming jobs</h3>
            <p className="text-xs text-gray-500">
              Active bookings in the next 7 days (pending, confirmed, or allocated)
            </p>
          </div>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-600 px-4 py-6">No upcoming jobs in the next week.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map(({ booking, pickupAt }) => {
              const soon = pickupAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000;
              return (
                <li key={booking.id || booking.bookingNumber} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {booking.bookingNumber}
                      <span className="text-gray-500 font-normal"> · {booking.hirerName}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">
                      {(booking.pickupLocation || '').trim() || '—'}
                      {(booking.destination || '').trim() ? ` → ${(booking.destination || '').trim()}` : ''}
                    </p>
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-sm text-gray-900">{formatPickupDisplay(pickupAt)}</p>
                    <p className={`text-xs mt-0.5 ${soon ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
                      {formatTimeUntil(pickupAt, now)}
                      {soon ? ' · next 24h' : ''}
                    </p>
                    <p className="text-xs text-gray-400 capitalize mt-0.5">{booking.status}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        <div className="px-4 py-3 bg-gray-50 border-t border-gray-100">
          <label className="flex items-start gap-2 cursor-pointer">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500"
              checked={desktopRemindersEnabled}
              onChange={(e) => void handleDesktopToggle(e.target.checked)}
            />
            <span className="text-sm text-gray-700">
              <span className="font-medium text-gray-900">Desktop reminders</span>
              {' — '}
              browser notifications for pickups in the next hour (and new booking alerts when permission is granted).
              A chime also plays for new customer requests while this tab is open.
            </span>
          </label>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Users className="h-8 w-8 text-blue-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Active Drivers</p>
              <p className="text-2xl font-bold text-gray-900">{activeDriversCount}/3</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Car className="h-8 w-8 text-green-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Available Vehicles</p>
              <p className="text-2xl font-bold text-gray-900">{availableVehiclesCount}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <FileText className="h-8 w-8 text-purple-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Total Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{totalBookings}</p>
            </div>
          </div>
        </div>
        
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <Calendar className="h-8 w-8 text-yellow-600" />
            <div className="ml-4">
              <p className="text-sm font-medium text-gray-600">Today's Bookings</p>
              <p className="text-2xl font-bold text-gray-900">{todaysBookingsCount}</p>
            </div>
          </div>
        </div>
      </div>
      
      <div className="bg-white p-6 rounded-lg shadow">
        <h3 className="text-lg font-medium text-gray-900 mb-4">Oxford City Council Compliance</h3>
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Operator License Status</span>
            <span className="text-sm text-green-600">✓ Active</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Active Driver Count</span>
            <span className="text-sm text-green-600">{activeDriversCount}/3 Compliant</span>
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm text-gray-600">Record Keeping</span>
            <span className="text-sm text-green-600">✓ 12 Month Retention</span>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;