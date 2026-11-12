// Dashboard.tsx - Put this in a separate file
import React, { useEffect, useMemo, useState } from 'react';
import { Users, Car, FileText, Calendar, Bell, Clock } from 'lucide-react';
import { Booking } from '../types/types';
import {
  formatPickupDisplay,
  formatTimeUntil,
  getUpcomingBookings,
  returnsToReview
} from '../utils/bookingSchedule';
import {
  bookingPaceChange,
  beforeAdsBookingsPerDay,
  afterAdsBookingsPerDay,
  buildAdvertisingReport,
  ADDITIONAL_BOOKINGS_NOTE,
  RESULTS_CONTEXT_NOTE,
  COMPARISON_OBJECTIVE,
  currentLondonMonth,
  formatPace,
} from '../utils/advertisingResults';
import { ComparisonBars, growthComparisonItems } from './ComparisonBars';
import { BookingFrequencyChart } from './BookingFrequencyChart';

interface DashboardProps {
  activeDriversCount: number;
  availableVehiclesCount: number;
  totalBookings: number;
  todaysBookingsCount: number;
  pendingCustomerBookingsCount: number;
  bookings: Booking[];
  desktopRemindersEnabled: boolean;
  onDesktopRemindersChange: (enabled: boolean) => void | Promise<void>;
  showMarketingPerformance?: boolean;
  onOpenAdvertising?: () => void;
  advertisingStartedOn?: string | null;
  advertisingStartConfirmed?: boolean;
}

const FUEL_API = 'https://www.spires-taxis.com/api/uk-fuel-prices';

function formatFuelPence(value: unknown): string | null {
  const n = Number(value);
  if (!Number.isFinite(n) || n <= 0) return null;
  return `${n.toFixed(1)}p/L`;
}

function formatFuelWeek(value: unknown): string | null {
  const raw = String(value || '').trim();
  const m = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (!m) return null;
  const d = new Date(Number(m[3]), Number(m[2]) - 1, Number(m[1]));
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const UPCOMING_WINDOW_MS = 7 * 24 * 60 * 60 * 1000;
const UPCOMING_LIST_MAX = 20;

const Dashboard: React.FC<DashboardProps> = ({
  activeDriversCount,
  availableVehiclesCount,
  totalBookings,
  todaysBookingsCount,
  pendingCustomerBookingsCount,
  bookings,
  desktopRemindersEnabled,
  onDesktopRemindersChange,
  showMarketingPerformance = false,
  onOpenAdvertising,
  advertisingStartedOn = null,
  advertisingStartConfirmed = false
}) => {
  const [now, setNow] = useState(() => new Date());
  const [fuelInfo, setFuelInfo] = useState<{ petrol: string; diesel: string; updated: string } | null>(null);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    let cancelled = false;
    fetch(FUEL_API, { headers: { Accept: 'application/json' } })
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data || data.available !== true) return;
        const petrol = formatFuelPence(data.petrolPence);
        const diesel = formatFuelPence(data.dieselPence);
        const updated = formatFuelWeek(data.weekCommencing);
        if (!petrol || !diesel || !updated) return;
        setFuelInfo({ petrol, diesel, updated });
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, []);

  const upcoming = useMemo(
    () => getUpcomingBookings(bookings, now, { withinMs: UPCOMING_WINDOW_MS, maxItems: UPCOMING_LIST_MAX }),
    [bookings, now]
  );
  const reviewReturns = useMemo(
    () => returnsToReview(bookings, now, UPCOMING_WINDOW_MS),
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
      
      <div className="bg-white border border-gray-200 rounded-lg shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex items-center gap-2">
          <Clock className="h-5 w-5 text-indigo-600 flex-shrink-0" />
          <div>
            <h3 className="text-base font-semibold text-gray-900">Upcoming jobs</h3>
            <p className="text-xs text-gray-500">
              Each journey in the next 7 days. A return is listed on its own pickup time.
            </p>
          </div>
        </div>
        {upcoming.length === 0 ? (
          <p className="text-sm text-gray-600 px-4 py-6">No upcoming jobs in the next week.</p>
        ) : (
          <ul className="divide-y divide-gray-100">
            {upcoming.map((item) => {
              const soon = item.pickupAt.getTime() - now.getTime() <= 24 * 60 * 60 * 1000;
              const route = [item.pickupLocation, item.destination].map((part) => part.trim()).filter(Boolean).join(' → ');
              return (
                <li key={`${item.booking.id || item.booking.bookingNumber}-${item.leg}`} className="px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
                  <div>
                    <p className="text-sm font-medium text-gray-900">
                      {item.booking.bookingNumber}
                      {item.showLabel ? <span className="text-gray-500 font-normal"> · {item.label}</span> : null}
                      <span className="text-gray-500 font-normal"> · {item.booking.hirerName}</span>
                    </p>
                    <p className="text-xs text-gray-600 mt-0.5">{route || '—'}</p>
                    {item.leg === 'return' && !item.driverId ? (
                      <p className="text-xs text-amber-700 mt-0.5">Driver not confirmed</p>
                    ) : null}
                  </div>
                  <div className="text-left sm:text-right flex-shrink-0">
                    <p className="text-sm text-gray-900">{formatPickupDisplay(item.pickupAt)}</p>
                    <p className={`text-xs mt-0.5 ${soon ? 'text-amber-700 font-medium' : 'text-gray-500'}`}>
                      {formatTimeUntil(item.pickupAt, now)}
                      {soon ? ' · next 24h' : ''}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{item.statusLabel}</p>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
        {reviewReturns.length > 0 ? (
          <div className="px-4 py-3 border-t border-gray-100">
            <h4 className="text-sm font-semibold text-gray-900">Returns to review</h4>
            <p className="text-xs text-gray-500 mt-1">
              A completed booking still has a return that was not marked completed. The record was not changed.
            </p>
            <ul className="mt-2 divide-y divide-gray-100">
              {reviewReturns.map((item) => (
                <li key={`${item.booking.id || item.booking.bookingNumber}-${item.leg}-review`} className="py-2">
                  <p className="text-sm font-medium text-gray-900">{item.booking.bookingNumber} · Return</p>
                  <p className="text-xs text-gray-600">{[item.pickupLocation, item.destination].filter(Boolean).join(' → ')}</p>
                  <p className="text-xs text-gray-500">{formatPickupDisplay(item.pickupAt)} · Needs review</p>
                </li>
              ))}
            </ul>
          </div>
        ) : null}
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
              browser notifications for each journey in the next hour (and new booking alerts when permission is granted).
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
      
      {fuelInfo && (
        <div className="bg-white border border-gray-200 rounded-lg p-4">
          <div className="flex items-start gap-3">
            <Car className="h-5 w-5 text-slate-500 mt-0.5 flex-shrink-0" />
            <div>
              <h3 className="text-sm font-semibold text-gray-900">UK average fuel prices</h3>
              <p className="text-sm text-gray-700 mt-1">
                Petrol {fuelInfo.petrol} · Diesel {fuelInfo.diesel}
              </p>
              <p className="text-xs text-gray-500 mt-1">
                Last updated {fuelInfo.updated} · informational only, not linked to fares
              </p>
            </div>
          </div>
        </div>
      )}

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

      {showMarketingPerformance ? (
        <>
          <MarketingPerformance bookings={bookings} now={now} onOpenAdvertising={onOpenAdvertising} advertisingStartedOn={advertisingStartedOn} advertisingStartConfirmed={advertisingStartConfirmed} />
          <BeforeAfterAdvertising bookings={bookings} now={now} advertisingStartedOn={advertisingStartedOn} advertisingStartConfirmed={advertisingStartConfirmed} />
        </>
      ) : null}
    </div>
  );
};

function MarketingPerformance({ bookings, now, onOpenAdvertising, advertisingStartedOn = null, advertisingStartConfirmed = false }: { bookings: Booking[]; now: Date; onOpenAdvertising?: () => void; advertisingStartedOn?: string | null; advertisingStartConfirmed?: boolean }) {
  const report = useMemo(() => {
    const month = currentLondonMonth(now);
    return buildAdvertisingReport(bookings, {
      ...month,
      dateBasis: "journey",
      now,
      spend: [],
      manualSpendIsComplete: false,
      adsConnected: false,
      advertisingStartedOn,
      advertisingStartConfirmed,
    });
  }, [bookings, now, advertisingStartedOn, advertisingStartConfirmed]);
  const pace = bookingPaceChange(report.earlierPace.bookingsPerDay, report.selectedPace.bookingsPerDay);
  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900">Marketing performance</h3>
      <h4 className="text-sm font-medium text-gray-900 mt-4">Objective</h4>
      <p className="text-sm text-gray-700 mt-1">{COMPARISON_OBJECTIVE}</p>
      <p className="text-sm text-gray-700 mt-3">Google Ads start date: {advertisingStartedOn ? `${advertisingStartedOn}. ${advertisingStartConfirmed ? "An administrator has confirmed this date." : "An administrator has not confirmed this date."}` : "not recorded."}</p>
      {report.selectedPace.days === 0 ? (
        <p className="text-sm text-gray-700 mt-2">This month has no finished day, so bookings a day are not calculated.</p>
      ) : (
        <p className="text-sm text-gray-700 mt-2">
          Finished days {report.selectedPace.from} to {report.selectedPace.to}: {formatPace(report.selectedPace.bookingsPerDay)} confirmed bookings a day. The previous {report.earlierPace.days} days: {formatPace(report.earlierPace.bookingsPerDay)}. {pace}.
        </p>
      )}
      <p className="text-sm text-gray-700 mt-2">The current day is not finished, so it is left out of this comparison.</p>
      <BookingFrequencyChart points={report.frequency} dateLabel="journey date" startDate={advertisingStartConfirmed ? advertisingStartedOn : null} frequencyChange={report.selectedPace.days === 0 ? "" : report.frequencyChange} revenuePerDayChange={report.selectedPace.days === 0 ? "" : report.revenuePerDayChange} averageBookingValueChange={report.selectedPace.days === 0 ? "" : report.averageBookingValueChange} confirmedBookingRateChange={report.selectedPace.days === 0 ? "" : report.confirmedBookingRateChange} />
      {report.limitations.length > 0 ? (
        <>
          <h4 className="text-sm font-medium text-gray-900 mt-4">Incomplete historical records</h4>
          <p className="text-sm text-gray-700 mt-1">Where a historical booking record is incomplete, the limitation is shown here. The missing parts stay missing.</p>
          {report.limitations.map((line) => <p key={line} className="text-sm text-gray-700 mt-2">{line}</p>)}
        </>
      ) : null}
      <p className="text-sm text-gray-700 mt-2">{report.reportingBasis}</p>
      <p className="text-sm text-gray-700 mt-2">{RESULTS_CONTEXT_NOTE}</p>
      <p className="text-sm text-gray-500 mt-2">This summary uses the existing Firebase booking records. Historical bookings are not modified merely to produce a comparison.</p>
      {onOpenAdvertising ? (
        <button type="button" className="mt-4 text-sm font-medium text-indigo-700" onClick={onOpenAdvertising}>
          Open Advertising results
        </button>
      ) : null}
    </section>
  );
}

function BeforeAfterAdvertising({ bookings, now, advertisingStartedOn = null, advertisingStartConfirmed = false }: { bookings: Booking[]; now: Date; advertisingStartedOn?: string | null; advertisingStartConfirmed?: boolean }) {
  const report = useMemo(() => buildAdvertisingReport(bookings, {
    ...currentLondonMonth(now),
    dateBasis: "journey",
    now,
    spend: [],
    manualSpendIsComplete: false,
    adsConnected: false,
    advertisingStartedOn,
    advertisingStartConfirmed,
  }), [bookings, now, advertisingStartedOn, advertisingStartConfirmed]);
  const growth = report.businessGrowth;
  return (
    <section className="bg-white p-6 rounded-lg shadow">
      <h3 className="text-lg font-medium text-gray-900">Before and after advertising</h3>
      <p className="text-sm text-gray-700 mt-2">Overall business growth after advertising started is separate from bookings directly attributed to Google Ads, bookings from other sources, and bookings with unknown attribution. A booking without a Google click still counts here. {ADDITIONAL_BOOKINGS_NOTE}</p>
      <p className="text-sm text-gray-700 mt-2">This compares the 30 days immediately before the confirmed Google Ads start date with the first 30 days after it. If fewer than 30 days after advertising started are finished, it compares those finished days with the same number of days immediately before advertising started. The current day is not finished, so it is left out. {RESULTS_CONTEXT_NOTE}</p>
      {growth.before && growth.after ? (
        <>
          <h4 className="text-sm font-medium text-gray-900 mt-4">Before</h4>
          <p className="text-sm text-gray-700 mt-1">{beforeAdsBookingsPerDay(growth.before.days, growth.before.bookingsPerDay)}</p>
          <p className="text-sm text-gray-700 mt-1">{growth.before.summary}</p>
          <h4 className="text-sm font-medium text-gray-900 mt-4">After</h4>
          <p className="text-sm text-gray-700 mt-1">{afterAdsBookingsPerDay(growth.after.days, growth.after.bookingsPerDay)}</p>
          <p className="text-sm text-gray-700 mt-1">{bookingPaceChange(growth.before.bookingsPerDay, growth.after.bookingsPerDay)}</p>
          <p className="text-sm text-gray-700 mt-1">{growth.after.summary}</p>
          <ComparisonBars earlierName="Before" laterName="After" items={growthComparisonItems(growth.before, growth.after)} />
        </>
      ) : null}
      <p className="text-sm text-gray-700 mt-3">{growth.text}. {growth.detail}</p>
      {growth.limitations.length > 0 ? (
        <>
          <h4 className="text-sm font-medium text-gray-900 mt-4">Incomplete records in the before and after comparison</h4>
          <p className="text-sm text-gray-700 mt-1">Where a historical booking record in these periods is incomplete, the limitation is shown here. The missing parts stay missing.</p>
          {growth.limitations.map((line) => <p key={line} className="text-sm text-gray-700 mt-2">{line}</p>)}
        </>
      ) : null}
      <p className="text-sm text-gray-500 mt-2">This comparison uses the existing Firebase booking records. Historical bookings are not modified merely to produce a comparison.</p>
    </section>
  );
}

export default Dashboard;