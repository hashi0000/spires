// Dashboard.tsx — Today landing
import React, { useEffect, useMemo, useState } from 'react';
import { Bell, Car } from 'lucide-react';
import { Booking } from '../types/types';
import {
  formatPickupDisplay,
  getBookingPickupDate,
  returnsToReview,
} from '../utils/bookingSchedule';
import { journeyLegs } from '../utils/journeyLegs';
import { bookingNextAction } from '../utils/bookingNextAction';
import { effectiveWorkflowStatus } from '../utils/bookingWorkflow';
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
import { WelcomeReview } from './WelcomeReview';
import { CompleteJobActions } from './CompleteJobActions';
import { resolveJobCardLeg } from '../utils/jobCardActions';

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
  onOpenBooking?: (booking: Booking) => void;
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

function startOfLocalDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function addDays(d: Date, n: number): Date {
  const next = new Date(d);
  next.setDate(next.getDate() + n);
  return next;
}

type TodayRow = {
  key: string;
  booking: Booking;
  pickupAt: Date;
  route: string;
  legLabel?: string;
  nextAction: string;
  note?: string;
};

function routeOf(pickup: string, destination: string): string {
  return [pickup, destination].map((p) => p.trim()).filter(Boolean).join(' → ') || '—';
}

function BookingRow({
  row,
  onOpenBooking,
}: {
  row: TodayRow;
  onOpenBooking?: (booking: Booking) => void;
}) {
  const open = () => onOpenBooking?.(row.booking);
  const name = String(row.booking.hirerName || '').trim();
  return (
    <li className="today-row">
      <div className="today-row__main">
        {onOpenBooking ? (
          <button type="button" className="today-row__ref" onClick={open}>
            {row.booking.bookingNumber}
            {row.legLabel ? <span className="today-row__meta"> · {row.legLabel}</span> : null}
            {name ? <span className="today-row__meta"> · {name}</span> : null}
          </button>
        ) : (
          <span className="today-row__ref-static">
            {row.booking.bookingNumber}
            {row.legLabel ? <span className="today-row__meta"> · {row.legLabel}</span> : null}
            {name ? <span className="today-row__meta"> · {name}</span> : null}
          </span>
        )}
        <p className="today-row__route">{row.route}</p>
        {row.note ? <p className="today-row__note">{row.note}</p> : null}
      </div>
      <div className="today-row__side">
        <p className="today-row__when">{formatPickupDisplay(row.pickupAt)}</p>
        <p className="today-row__action">{row.nextAction}</p>
        {['confirmed', 'allocated'].includes(String(row.booking.status || '')) ||
        row.nextAction.startsWith('Complete') ||
        row.nextAction === 'Mark completed' ||
        row.nextAction === 'Mark complete' ? (
          <CompleteJobActions
            booking={row.booking}
            leg={resolveJobCardLeg(row.legLabel === 'Return' ? 'return' : row.legLabel === 'Outbound' ? 'outbound' : null)}
            compact
          />
        ) : null}
      </div>
    </li>
  );
}

function Section({
  title,
  rows,
  empty,
  onOpenBooking,
}: {
  title: string;
  rows: TodayRow[];
  empty: string;
  onOpenBooking?: (booking: Booking) => void;
}) {
  return (
    <section className="today-section" aria-label={title}>
      <div className="today-section__head">
        <h3>{title}</h3>
        <span className="today-section__count">{rows.length}</span>
      </div>
      {rows.length === 0 ? (
        <p className="today-section__empty">{empty}</p>
      ) : (
        <ul className="today-rows">
          {rows.map((row) => (
            <BookingRow key={row.key} row={row} onOpenBooking={onOpenBooking} />
          ))}
        </ul>
      )}
    </section>
  );
}

const Dashboard: React.FC<DashboardProps> = ({
  pendingCustomerBookingsCount,
  bookings,
  desktopRemindersEnabled,
  onDesktopRemindersChange,
  showMarketingPerformance = false,
  onOpenAdvertising,
  advertisingStartedOn = null,
  advertisingStartConfirmed = false,
  onOpenBooking,
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

  const todayStart = startOfLocalDay(now);
  const tomorrowStart = addDays(todayStart, 1);
  const dayAfter = addDays(todayStart, 2);

  const lists = useMemo(() => {
    const newEnquiries: TodayRow[] = [];
    const todaysJobs: TodayRow[] = [];
    const tomorrowsJobs: TodayRow[] = [];
    const unassigned: TodayRow[] = [];
    const exceptions: TodayRow[] = [];
    const exceptionKeys = new Set<string>();

    for (const booking of bookings) {
      const status = effectiveWorkflowStatus(booking);
      if (status === 'cancelled') continue;

      if (status === 'pending' || status === 'awaiting_customer_confirmation') {
        const pickup = getBookingPickupDate(booking) || now;
        newEnquiries.push({
          key: `enq-${booking.id || booking.bookingNumber}`,
          booking,
          pickupAt: pickup,
          route: routeOf(booking.pickupLocation || '', booking.destination || ''),
          nextAction: bookingNextAction(booking).label,
        });
      }

      for (const leg of journeyLegs(booking, now)) {
        if (!leg.pickupAt || leg.status === 'cancelled') continue;
        const t = leg.pickupAt.getTime();
        const key = `${booking.id || booking.bookingNumber}-${leg.leg}`;
        const row: TodayRow = {
          key,
          booking,
          pickupAt: leg.pickupAt,
          route: routeOf(leg.pickupLocation, leg.destination),
          legLabel: leg.leg === 'return' || journeyLegs(booking).length > 1 ? leg.label : undefined,
          nextAction: bookingNextAction(booking).label,
          note: leg.leg === 'return' && !leg.driverId ? 'Driver not confirmed' : undefined,
        };

        if (leg.status !== 'completed') {
          if (t >= todayStart.getTime() && t < tomorrowStart.getTime()) {
            todaysJobs.push(row);
          } else if (t >= tomorrowStart.getTime() && t < dayAfter.getTime()) {
            tomorrowsJobs.push(row);
          }
        }

        if (
          (status === 'confirmed' || status === 'allocated' || leg.status === 'confirmed' || leg.status === 'allocated') &&
          !leg.driverId &&
          leg.status !== 'completed'
        ) {
          unassigned.push({ ...row, key: `unassigned-${key}` });
        }

        const overdue =
          leg.status !== 'completed' &&
          t < now.getTime() - 60 * 1000 &&
          t >= todayStart.getTime() - 6 * 60 * 60 * 1000;
        if (overdue) {
          const ek = `overdue-${key}`;
          if (!exceptionKeys.has(ek)) {
            exceptionKeys.add(ek);
            exceptions.push({ ...row, key: ek, nextAction: 'Overdue incomplete', note: row.note });
          }
        }
      }
    }

    for (const item of returnsToReview(bookings, now, 0)) {
      const ek = `review-${item.booking.id || item.booking.bookingNumber}-${item.leg}`;
      if (exceptionKeys.has(ek)) continue;
      exceptionKeys.add(ek);
      exceptions.push({
        key: ek,
        booking: item.booking,
        pickupAt: item.pickupAt,
        route: routeOf(item.pickupLocation, item.destination),
        legLabel: 'Return',
        nextAction: 'Needs review',
        note: item.driverId ? 'Return still open after outbound completed' : 'Driver not confirmed',
      });
    }

    const byTime = (a: TodayRow, b: TodayRow) => a.pickupAt.getTime() - b.pickupAt.getTime();
    newEnquiries.sort(byTime);
    todaysJobs.sort(byTime);
    tomorrowsJobs.sort(byTime);
    unassigned.sort(byTime);
    exceptions.sort(byTime);

    return { newEnquiries, todaysJobs, tomorrowsJobs, unassigned, exceptions };
  }, [bookings, now, todayStart, tomorrowStart, dayAfter]);

  const handleDesktopToggle = async (next: boolean) => {
    await onDesktopRemindersChange(next);
  };

  return (
    <div className="today-board">
      <h2>Today</h2>

      {pendingCustomerBookingsCount > 0 ? (
        <div className="today-alert">
          <Bell className="h-5 w-5 flex-shrink-0" style={{ color: '#b8956a' }} aria-hidden="true" />
          <div>
            <h3>
              {pendingCustomerBookingsCount} new customer {pendingCustomerBookingsCount === 1 ? 'request' : 'requests'} to review
            </h3>
            <p>Open Bookings to quote or confirm.</p>
          </div>
        </div>
      ) : null}

      <Section title="New enquiries" rows={lists.newEnquiries} empty="No new enquiries." onOpenBooking={onOpenBooking} />
      <Section title="Today's jobs" rows={lists.todaysJobs} empty="No jobs today." onOpenBooking={onOpenBooking} />
      <Section title="Tomorrow's jobs" rows={lists.tomorrowsJobs} empty="No jobs tomorrow." onOpenBooking={onOpenBooking} />
      <Section title="Unassigned" rows={lists.unassigned} empty="No unassigned confirmed journeys." onOpenBooking={onOpenBooking} />
      <Section title="Exceptions" rows={lists.exceptions} empty="No exceptions." onOpenBooking={onOpenBooking} />

      <div className="today-reminders">
        <label>
          <input
            type="checkbox"
            checked={desktopRemindersEnabled}
            onChange={(e) => void handleDesktopToggle(e.target.checked)}
          />
          <span>
            <strong>Desktop reminders</strong>
            {' — '}
            browser notifications for journeys in the next hour, and a chime for new customer requests while this tab is open.
          </span>
        </label>
      </div>

      <details className="today-reports">
        <summary>Reports</summary>
        <div className="today-reports__body">
          <WelcomeReview />
          {fuelInfo ? (
            <div className="flex items-start gap-3">
              <Car className="h-5 w-5 mt-0.5 flex-shrink-0" style={{ color: '#64748b' }} aria-hidden="true" />
              <div>
                <h3 className="text-sm font-semibold" style={{ color: '#0b1c3d', margin: 0 }}>UK average fuel prices</h3>
                <p className="text-sm" style={{ color: '#334155', margin: '0.25rem 0 0' }}>
                  Petrol {fuelInfo.petrol} · Diesel {fuelInfo.diesel}
                </p>
                <p className="text-xs" style={{ color: '#64748b', margin: '0.25rem 0 0' }}>
                  Last updated {fuelInfo.updated}. Informational only, not linked to fares.
                </p>
              </div>
            </div>
          ) : (
            <p className="text-sm" style={{ color: '#64748b', margin: 0 }}>Fuel prices are not available right now.</p>
          )}

          {showMarketingPerformance ? (
            <>
              <MarketingPerformance
                bookings={bookings}
                now={now}
                onOpenAdvertising={onOpenAdvertising}
                advertisingStartedOn={advertisingStartedOn}
                advertisingStartConfirmed={advertisingStartConfirmed}
              />
              <BeforeAfterAdvertising
                bookings={bookings}
                now={now}
                advertisingStartedOn={advertisingStartedOn}
                advertisingStartConfirmed={advertisingStartConfirmed}
              />
            </>
          ) : onOpenAdvertising ? (
            <p className="text-sm" style={{ color: '#334155', margin: 0 }}>
              Marketing figures live on Advertising results.{' '}
              <button type="button" className="btn btn-secondary btn-sm" onClick={onOpenAdvertising}>
                Open Advertising
              </button>
            </p>
          ) : null}
        </div>
      </details>
    </div>
  );
};

function MarketingPerformance({
  bookings,
  now,
  onOpenAdvertising,
  advertisingStartedOn = null,
  advertisingStartConfirmed = false,
}: {
  bookings: Booking[];
  now: Date;
  onOpenAdvertising?: () => void;
  advertisingStartedOn?: string | null;
  advertisingStartConfirmed?: boolean;
}) {
  const report = useMemo(() => {
    const month = currentLondonMonth(now);
    return buildAdvertisingReport(bookings, {
      ...month,
      dateBasis: 'enquiry',
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
    <section className="pt-2">
      <h3 className="text-lg font-medium text-gray-900">Marketing performance</h3>
      <h4 className="text-sm font-medium text-gray-900 mt-4">Objective</h4>
      <p className="text-sm text-gray-700 mt-1">{COMPARISON_OBJECTIVE}</p>
      <p className="text-sm text-gray-700 mt-3">
        Google Ads start date:{' '}
        {advertisingStartedOn
          ? `${advertisingStartedOn}. ${advertisingStartConfirmed ? 'An administrator has confirmed this date.' : 'An administrator has not confirmed this date.'}`
          : 'not recorded.'}
      </p>
      {report.selectedPace.days === 0 ? (
        <p className="text-sm text-gray-700 mt-2">This month has no finished day, so bookings a day are not calculated.</p>
      ) : (
        <p className="text-sm text-gray-700 mt-2">
          Finished days {report.selectedPace.from} to {report.selectedPace.to}: {formatPace(report.selectedPace.bookingsPerDay)}{' '}
          confirmed bookings a day. The previous {report.earlierPace.days} days: {formatPace(report.earlierPace.bookingsPerDay)}. {pace}.
        </p>
      )}
      <p className="text-sm text-gray-700 mt-2">The current day is not finished, so it is left out of this comparison.</p>
      <BookingFrequencyChart
        points={report.frequency}
        dateLabel="journey date"
        startDate={advertisingStartConfirmed ? advertisingStartedOn : null}
        frequencyChange={report.selectedPace.days === 0 ? '' : report.frequencyChange}
        revenuePerDayChange={report.selectedPace.days === 0 ? '' : report.revenuePerDayChange}
        averageBookingValueChange={report.selectedPace.days === 0 ? '' : report.averageBookingValueChange}
        confirmedBookingRateChange={report.selectedPace.days === 0 ? '' : report.confirmedBookingRateChange}
      />
      {report.limitations.length > 0 ? (
        <>
          <h4 className="text-sm font-medium text-gray-900 mt-4">Incomplete historical records</h4>
          <p className="text-sm text-gray-700 mt-1">
            Where a historical booking record is incomplete, the limitation is shown here. The missing parts stay missing.
          </p>
          {report.limitations.map((line) => (
            <p key={line} className="text-sm text-gray-700 mt-2">
              {line}
            </p>
          ))}
        </>
      ) : null}
      <p className="text-sm text-gray-700 mt-2">{report.reportingBasis}</p>
      <p className="text-sm text-gray-700 mt-2">{RESULTS_CONTEXT_NOTE}</p>
      <p className="text-sm text-gray-500 mt-2">
        This summary uses the existing Firebase booking records. Historical bookings are not modified merely to produce a comparison.
      </p>
      {onOpenAdvertising ? (
        <button type="button" className="mt-4 text-sm font-medium text-indigo-700" onClick={onOpenAdvertising}>
          Open Advertising results
        </button>
      ) : null}
    </section>
  );
}

function BeforeAfterAdvertising({
  bookings,
  now,
  advertisingStartedOn = null,
  advertisingStartConfirmed = false,
}: {
  bookings: Booking[];
  now: Date;
  advertisingStartedOn?: string | null;
  advertisingStartConfirmed?: boolean;
}) {
  const report = useMemo(
    () =>
      buildAdvertisingReport(bookings, {
        ...currentLondonMonth(now),
        dateBasis: 'enquiry',
        now,
        spend: [],
        manualSpendIsComplete: false,
        adsConnected: false,
        advertisingStartedOn,
        advertisingStartConfirmed,
      }),
    [bookings, now, advertisingStartedOn, advertisingStartConfirmed]
  );
  const growth = report.businessGrowth;
  return (
    <section className="pt-2 border-t border-gray-100">
      <h3 className="text-lg font-medium text-gray-900">Before and after advertising</h3>
      <p className="text-sm text-gray-700 mt-2">
        Overall business growth after advertising started is separate from bookings directly attributed to Google Ads, bookings
        from other sources, and bookings with unknown attribution. A booking without a Google click still counts here.{' '}
        {ADDITIONAL_BOOKINGS_NOTE}
      </p>
      <p className="text-sm text-gray-700 mt-2">
        This compares the 30 days immediately before the confirmed Google Ads start date with the first 30 days after it. If
        fewer than 30 days after advertising started are finished, it compares those finished days with the same number of days
        immediately before advertising started. The current day is not finished, so it is left out. {RESULTS_CONTEXT_NOTE}
      </p>
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
      <p className="text-sm text-gray-700 mt-3">
        {growth.text}. {growth.detail}
      </p>
      {growth.limitations.length > 0 ? (
        <>
          <h4 className="text-sm font-medium text-gray-900 mt-4">Incomplete records in the before and after comparison</h4>
          <p className="text-sm text-gray-700 mt-1">
            Where a historical booking record in these periods is incomplete, the limitation is shown here. The missing parts
            stay missing.
          </p>
          {growth.limitations.map((line) => (
            <p key={line} className="text-sm text-gray-700 mt-2">
              {line}
            </p>
          ))}
        </>
      ) : null}
      <p className="text-sm text-gray-500 mt-2">
        This comparison uses the existing Firebase booking records. Historical bookings are not modified merely to produce a
        comparison.
      </p>
    </section>
  );
}

export default Dashboard;
