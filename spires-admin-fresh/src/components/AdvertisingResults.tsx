import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../utils/firebase";
import { isAdminEmail } from "../utils/staffAccess";
import {
  ADVERTISING_BUDGET_LABEL,
  ADDITIONAL_BOOKINGS_NOTE,
  RESULTS_CONTEXT_NOTE,
  AdvertisingBookingInput,
  AdvertisingReport,
  COMPARISON_OBJECTIVE,
  JobCostInput,
  SpendEntryInput,
  advertisingDateRange,
  buildAdvertisingReport,
  currentLondonMonth,
  bookingPaceChange,
  beforeAdsBookingsPerDay,
  afterAdsBookingsPerDay,
  formatGbp,
  formatPace,
  formatRate,
  formatReturn,
  interpretAttribution,
  routeLabel,
  sourceLabel,
  vehicleLabel,
} from "../utils/advertisingResults";
import { effectiveWorkflowStatus } from "../utils/bookingWorkflow";
import { ComparisonBars, growthComparisonItems, paceComparisonItems } from "./ComparisonBars";
import { BookingFrequencyChart } from "./BookingFrequencyChart";

const SOURCE_OPTIONS: Array<[string, string]> = [
  ["", "Not recorded"],
  ["google_ads", "Customer said Google Ads"],
  ["website", "Customer said website"],
  ["repeat", "Repeat customer"],
  ["recommendation", "Recommendation"],
  ["other", "Other"],
];

const COST_FIELDS: Array<[keyof JobCostInput, string]> = [
  ["driverPaymentPence", "Driver payment"],
  ["fuelPence", "Fuel"],
  ["parkingPence", "Parking"],
  ["airportChargesPence", "Airport charges"],
  ["paymentFeesPence", "Payment fees"],
];

interface NoteRecord {
  staffReportedSource?: string;
  enquiryChannel?: string;
  driverPaymentPence?: number | null;
  fuelPence?: number | null;
  parkingPence?: number | null;
  airportChargesPence?: number | null;
  paymentFeesPence?: number | null;
}

export interface DeliveryRow {
  id: string;
  bookingId: string;
  event: string;
  status: string;
  reason: string;
  validation: string;
  transport: string;
}

export function AdvertisingResultsView({
  report,
  deliveries = [],
  preview = false,
  message = "",
  saving = false,
  manualIsComplete = false,
  advertisingStartedOn = null,
  advertisingStartConfirmed = false,
  connectionNote = "",
  onDates,
  onManualComplete,
  onSaveStartDate,
  onAddSpend,
  onSaveSource,
  onSaveCost,
  reportFilters,
  filterChoices,
  onReportFilters,
}: {
  report: AdvertisingReport;
  deliveries?: DeliveryRow[];
  preview?: boolean;
  message?: string;
  saving?: boolean;
  manualIsComplete?: boolean;
  advertisingStartedOn?: string | null;
  advertisingStartConfirmed?: boolean;
  connectionNote?: string;
  onDates: (from: string, to: string, dateBasis: "journey" | "enquiry") => void;
  onManualComplete: (value: boolean) => void;
  onSaveStartDate: (date: string) => void;
  onAddSpend: (date: string, pounds: string, note: string) => void;
  onSaveSource: (id: string, source: string, channel: "telephone" | "whatsapp") => void;
  onSaveCost: (id: string, field: keyof JobCostInput, pounds: string) => void;
  reportFilters?: { status: string; route: string; vehicle: string; source: string };
  filterChoices?: { routes: string[]; vehicles: string[]; sources: string[] };
  onReportFilters?: (next: { status: string; route: string; vehicle: string; source: string }) => void;
}) {
  const [spendDate, setSpendDate] = useState(report.to);
  const [spendPounds, setSpendPounds] = useState("");
  const [spendNote, setSpendNote] = useState("");
  const [startDate, setStartDate] = useState(advertisingStartedOn || "");
  useEffect(() => {
    setStartDate(advertisingStartedOn || "");
  }, [advertisingStartedOn]);
  const today = advertisingDateRange("today");
  const lastSeven = advertisingDateRange("last_7");
  const lastTwentyEight = advertisingDateRange("last_28");
  const monthToDate = advertisingDateRange("month_to_date");
  const dateLabel = report.dateBasis === "enquiry" ? "enquiry or submission date" : "journey date";
  const figures = [report.costPerConfirmed, report.contribution, report.quoted, report.netPayments, report.manualSpend, report.adsSpend, report.advertisingSpend, report.costPerCompletedPaid, report.costs.driver, report.costs.fuel, report.costs.parking, report.costs.airport, report.costs.paymentFees];

  return (
    <section className="advertising-results">
      <header className="advertising-results__header">
        <div>
          <h1>Advertising results</h1>
          <p>Booking records are the source. Unknown sources are not treated as advertising.</p>
        </div>
        <p className="advertising-results__budget">{ADVERTISING_BUDGET_LABEL}</p>
      </header>
      {preview ? <p className="advertising-results__banner">Sample preview. These are not live bookings.</p> : null}
      {message ? <p className="advertising-results__message">{message}</p> : null}

      <form className="advertising-results__filters" onSubmit={(event) => event.preventDefault()}>
        <div className="advertising-results__presets" role="group" aria-label="Date shortcuts">
          <button type="button" className={report.from === today.from && report.to === today.to ? "is-active" : ""} aria-pressed={report.from === today.from && report.to === today.to} onClick={() => onDates(today.from, today.to, report.dateBasis)}>Today</button>
          <button type="button" className={report.from === lastSeven.from && report.to === lastSeven.to ? "is-active" : ""} aria-pressed={report.from === lastSeven.from && report.to === lastSeven.to} onClick={() => onDates(lastSeven.from, lastSeven.to, report.dateBasis)}>Last 7 finished days</button>
          <button type="button" className={report.from === lastTwentyEight.from && report.to === lastTwentyEight.to ? "is-active" : ""} aria-pressed={report.from === lastTwentyEight.from && report.to === lastTwentyEight.to} onClick={() => onDates(lastTwentyEight.from, lastTwentyEight.to, report.dateBasis)}>Last 28 finished days</button>
          <button type="button" className={report.from === monthToDate.from && report.to === monthToDate.to ? "is-active" : ""} aria-pressed={report.from === monthToDate.from && report.to === monthToDate.to} onClick={() => onDates(monthToDate.from, monthToDate.to, report.dateBasis)}>Month to date</button>
        </div>
        <label>From
          <input className="form-input" type="date" value={report.from} onChange={(event) => onDates(event.target.value, report.to, report.dateBasis)} />
        </label>
        <label>To
          <input className="form-input" type="date" value={report.to} onChange={(event) => onDates(report.from, event.target.value, report.dateBasis)} />
        </label>
        <label>Date used
          <select className="form-select" value={report.dateBasis} onChange={(event) => onDates(report.from, report.to, event.target.value as "journey" | "enquiry")}>
            <option value="journey">Journey date</option>
            <option value="enquiry">Enquiry date</option>
          </select>
        </label>
        {onReportFilters && reportFilters && filterChoices ? (
          <>
            <label>Status
              <select className="form-select" value={reportFilters.status} onChange={(event) => onReportFilters({ ...reportFilters, status: event.target.value })}>
                <option value="all">All statuses</option>
                <option value="pending">Pending</option>
                <option value="awaiting_customer_confirmation">Awaiting customer confirmation</option>
                <option value="confirmed">Confirmed</option>
                <option value="allocated">Allocated</option>
                <option value="completed">Completed</option>
                <option value="cancelled">Cancelled</option>
              </select>
            </label>
            <label>Route
              <select className="form-select" value={reportFilters.route} onChange={(event) => onReportFilters({ ...reportFilters, route: event.target.value })}>
                <option value="all">All routes</option>
                {filterChoices.routes.map((route) => <option key={route} value={route}>{route}</option>)}
              </select>
            </label>
            <label>Vehicle
              <select className="form-select" value={reportFilters.vehicle} onChange={(event) => onReportFilters({ ...reportFilters, vehicle: event.target.value })}>
                <option value="all">All vehicles</option>
                {filterChoices.vehicles.map((vehicle) => <option key={vehicle} value={vehicle}>{vehicle}</option>)}
              </select>
            </label>
            <label>Recorded source
              <select className="form-select" value={reportFilters.source} onChange={(event) => onReportFilters({ ...reportFilters, source: event.target.value })}>
                <option value="all">All sources</option>
                {filterChoices.sources.map((source) => <option key={source} value={source}>{source}</option>)}
              </select>
            </label>
          </>
        ) : null}
      </form>

      <section className="advertising-results__panel">
        <h2>Selected period against the days before it</h2>
        <p>Revenue per day: {report.selectedPace.days === 0 ? "not calculated" : formatGbp(report.revenuePerDay.pence)}. Average booking value: {report.averageBookingValue.pence === null && (report.selectedPace.days === 0 || report.selectedPace.confirmed === 0) ? "not calculated" : formatGbp(report.averageBookingValue.pence)}. Confirmed booking rate: {report.confirmedRate === null ? "not calculated" : formatRate(report.confirmedRate)}.</p>
        {report.selectedPace.days === 0 ? <p>This period has no finished day, so bookings a day are not calculated.</p> : (
          <>
            <p>Earlier period, {report.earlierPace.from} to {report.earlierPace.to}: {formatPace(report.earlierPace.bookingsPerDay)} confirmed bookings a day.</p>
            <p>Finished days, {report.selectedPace.from} to {report.selectedPace.to}: {formatPace(report.selectedPace.bookingsPerDay)} confirmed bookings a day.</p>
          </>
        )}
        <p>{bookingPaceChange(report.earlierPace.bookingsPerDay, report.selectedPace.bookingsPerDay)}. This compares confirmed bookings on finished days. The current day is not finished, so it is left out of this comparison. Last 7 finished days and last 28 finished days each use the equal number of days immediately before. A partial month is not compared with a full month.</p>
        {report.monthEquivalent ? <p>{report.monthEquivalent.text}</p> : null}
        <p>Active date basis: {dateLabel}.</p>
        {report.selectedPace.days > 0 ? <ComparisonBars earlierName="Earlier" laterName="Finished days" items={paceComparisonItems(report.earlierPace, report.selectedPace)} /> : null}
        <BookingFrequencyChart points={report.frequency} dateLabel={report.dateBasis === "enquiry" ? "enquiry date" : "journey date"} startDate={advertisingStartConfirmed ? advertisingStartedOn : null} frequencyChange={report.frequencyChange} revenuePerDayChange={report.revenuePerDayChange} averageBookingValueChange={report.averageBookingValueChange} confirmedBookingRateChange={report.confirmedBookingRateChange} />
        <p>{report.revenuePerDay.detail} {report.averageBookingValue.detail} {report.confirmedRateLabel} The earlier period is the same number of days immediately before the dates selected.</p>
        <p>This comparison is calculated from the stored bookings. Historical bookings are not modified merely to produce a comparison.</p>
        <p>{report.reportingBasis}</p>
        <p>{ADDITIONAL_BOOKINGS_NOTE}</p>
        <p>{RESULTS_CONTEXT_NOTE}</p>
        <h2>Objective</h2>
        <p>{COMPARISON_OBJECTIVE}</p>
        <h2>Google Ads start date</h2>
        <p>{advertisingStartedOn ? `Google Ads start date: ${advertisingStartedOn}. ${advertisingStartConfirmed ? "An administrator has confirmed this date." : "An administrator has not confirmed this date."}` : "No Google Ads start date is recorded."} Historical Google Ads campaign data is not available, so the first date of impressions or spend cannot be identified. A stored Google click is not used as this date, the dates selected above are not used as this date, and a campaign creation date is not used as this date.</p>
        <p>An administrator can confirm this date or change it. Booking records are not changed.</p>
        <form className="advertising-results__filters" onSubmit={(event) => event.preventDefault()}>
          <label>Google Ads start date
            <input className="form-input" type="date" value={startDate} onChange={(event) => setStartDate(event.target.value)} disabled={preview || saving} />
          </label>
          <button className="btn btn-primary" type="button" disabled={preview || saving || !/^\d{4}-\d{2}-\d{2}$/.test(startDate) || (Boolean(advertisingStartedOn) && (startDate !== advertisingStartedOn || advertisingStartConfirmed))} onClick={() => onSaveStartDate(startDate)}>Confirm Google Ads start date</button>
          <button className="btn btn-secondary" type="button" disabled={preview || saving || !advertisingStartedOn || startDate === advertisingStartedOn || !/^\d{4}-\d{2}-\d{2}$/.test(startDate)} onClick={() => onSaveStartDate(startDate)}>Change Google Ads start date</button>
        </form>
        <h2>Overall business growth after advertising started</h2>
        <p>This comparison is separate from bookings directly attributed to Google Ads, bookings from other sources, and bookings with unknown attribution. It uses the stored bookings before and after the confirmed Google Ads start date. A booking without a Google click still counts here. {ADDITIONAL_BOOKINGS_NOTE}</p>
        <h2>{report.businessGrowth.label}</h2>
        {report.businessGrowth.before && report.businessGrowth.after ? (
          <>
            <h3>Before</h3>
            <p>{beforeAdsBookingsPerDay(report.businessGrowth.before.days, report.businessGrowth.before.bookingsPerDay)}</p>
            <p>{report.businessGrowth.before.summary}</p>
            <h3>After</h3>
            <p>{afterAdsBookingsPerDay(report.businessGrowth.after.days, report.businessGrowth.after.bookingsPerDay)}</p>
            <p>{bookingPaceChange(report.businessGrowth.before.bookingsPerDay, report.businessGrowth.after.bookingsPerDay)}</p>
            <p>{report.businessGrowth.after.summary}</p>
            <ComparisonBars earlierName="Before" laterName="After" items={growthComparisonItems(report.businessGrowth.before, report.businessGrowth.after)} />
          </>
        ) : null}
        <p>{report.businessGrowth.text}. {report.businessGrowth.detail}</p>
        {report.businessGrowth.limitations.length > 0 ? (
          <>
            <h3>Incomplete records in the before and after comparison</h3>
            <p>Where a historical booking record in these periods is incomplete, the limitation is shown here. The missing parts stay missing.</p>
            {report.businessGrowth.limitations.map((line) => <p key={line}>{line}</p>)}
          </>
        ) : null}
      </section>

      {report.limitations.length > 0 ? (
        <section className="advertising-results__panel">
          <h2>Incomplete historical records</h2>
          <p>Where a historical booking record is incomplete, the limitation is shown here. The missing parts stay missing. Historical bookings are not modified merely to produce a comparison.</p>
          {report.limitations.map((line) => <p key={line}>{line}</p>)}
        </section>
      ) : null}

      <BarList
        title="Weekly volume"
        caption={`Bookings in each week by ${dateLabel}. A return fare stays on the one booking.`}
        rows={report.weekly.map((week) => ({ label: `Week of ${week.weekStarting}`, text: `${week.bookings} ${week.bookings === 1 ? "booking" : "bookings"}, ${week.confirmed} confirmed`, width: week.bookings }))}
      />
      <BarList
        title="Weekly fares and payments"
        caption="Quoted fares and payments received are separate. A missing amount is not shown as zero. The bar uses the known payment total only."
        rows={report.weekly.map((week) => ({
          label: `Week of ${week.weekStarting}`,
          text: `Quoted fares ${formatGbp(week.quotedKnownPence)}${week.quotedMissing ? `, ${week.quotedMissing} missing` : ""}. Payments ${formatGbp(week.paymentsKnownPence)}${week.paymentsMissing ? `, ${week.paymentsMissing} missing` : ""}.`,
          width: week.paymentsKnownPence === null ? 0 : week.paymentsKnownPence,
        }))}
      />
      <section className="advertising-results__panel">
        <h2>Enquiry to confirmed booking</h2>
        <p>{report.funnel.enquiries} stored {report.funnel.enquiries === 1 ? "enquiry" : "enquiries"}, {report.funnel.confirmed} confirmed bookings, {report.funnel.completed} completed {report.funnel.completed === 1 ? "journey" : "journeys"}. {report.funnel.reason}</p>
      </section>
      <BarList
        title="Upcoming confirmed work"
        caption="Future confirmed and allocated journeys by the week of the journey. Completed work and receipts are not included."
        rows={report.upcomingWeeks.map((week) => ({ label: `Week of ${week.weekStarting}`, text: `${week.journeys} journeys. Known quoted fares ${formatGbp(week.knownFarePence)}${week.missingFares ? `, ${week.missingFares} missing` : ""}.`, width: week.journeys }))}
      />
      <BarList
        title="Manual advertising spend by week"
        caption="Only dated manual entries are shown. Google Ads daily spend is not connected, so it is not drawn as zero."
        rows={report.manualSpendWeeks.map((week) => ({ label: `Week of ${week.weekStarting}`, text: `${formatGbp(week.amountPence)} from ${week.entries} ${week.entries === 1 ? "entry" : "entries"}`, width: week.amountPence || 0 }))}
      />
      <section className="advertising-results__panel">
        <h2>Missing data</h2>
        <p>These counts are why some figures stay unknown. They are not treated as zero.</p>
        <ul>
          <li>{report.missingData.fares} missing fares</li>
          <li>{report.missingData.payments} missing payments</li>
          <li>{report.missingData.sources} bookings with no recorded source</li>
          <li>{report.missingData.creation} missing creation times</li>
          <li>{report.missingData.journey} missing journey dates</li>
          <li>{report.missingData.costs} completed {report.missingData.costs === 1 ? "job has" : "jobs have"} a missing direct cost</li>
        </ul>
        <p>No campaign is stored on the booking, so the results cannot be filtered by advertising campaign.</p>
      </section>

      <div className="advertising-results__counts">
        <article><span>Enquiries</span><strong>{report.enquiries}</strong></article>
        <article><span>Confirmed bookings</span><strong>{report.confirmed}</strong></article>
        <article><span>Completed jobs</span><strong>{report.completed}</strong></article>
        <article><span>Cancellations</span><strong>{report.cancelled}</strong></article>
      </div>

      <div className="advertising-results__figures">
        <article>
          <h2>{report.costPerConfirmed.label}</h2>
          <p className="advertising-results__amount">{formatGbp(report.costPerConfirmed.pence)}</p>
          <p>{report.costPerConfirmed.detail}</p>
        </article>
        <article>
          <h2>{report.returnOnSpend.label}</h2>
          <p className="advertising-results__amount">{formatReturn(report.returnOnSpend.ratio)}</p>
          <p>{report.returnOnSpend.detail}</p>
        </article>
        {figures.filter((row) => row !== report.costPerConfirmed).map((row) => (
          <article key={row.label}>
            <h2>{row.label}</h2>
            <p className="advertising-results__amount">{formatGbp(row.pence)}</p>
            <p>{row.detail}</p>
          </article>
        ))}
      </div>

      <section className="advertising-results__panel">
        <h2>Attribution</h2>
        <p>Clearly distinguish between bookings directly attributed to Google Ads, bookings from other sources, and bookings with unknown attribution. A confirmed, allocated or completed booking is counted in only one of these. A cancellation or an enquiry is not included in these counts. Overall business growth after advertising started is a separate comparison. It is not one of those attribution counts.</p>
      </section>

      <section className="advertising-results__panel">
        <h2>{report.directAds.label}</h2>
        <p>A booking is directly attributed to Google Ads only when it has a consented Google click id that has not expired. A customer who said Google Ads is counted under bookings from other sources. A cancellation or an enquiry is not included in this count. The current day is left out.</p>
        <p className="advertising-results__amount">{report.selectedPace.days === 0 ? "not calculated" : report.directAds.confirmed}</p>
        <p>{report.directAds.detail}</p>
      </section>

      <section className="advertising-results__panel">
        <h2>{report.otherSources.label}</h2>
        <p>A booking is from another source when the customer reported where it came from, including a customer who said Google Ads, the website, a repeat booking, a recommendation, or another source. That report is not a stored Google click. A cancellation or an enquiry is not included in this count. The current day is left out.</p>
        <p className="advertising-results__amount">{report.selectedPace.days === 0 ? "not calculated" : report.otherSources.confirmed}</p>
        <p>{report.otherSources.detail}</p>
      </section>

      <section className="advertising-results__panel">
        <h2>{report.unknownAttribution.label}</h2>
        <p>A booking has unknown attribution when no source was recorded. It stays unknown. It is not counted as a Google Ads booking or as a customer reported source. A cancellation or an enquiry is not included in this count. The current day is left out.</p>
        <p className="advertising-results__amount">{report.selectedPace.days === 0 ? "not calculated" : report.unknownAttribution.confirmed}</p>
        <p>{report.unknownAttribution.detail}</p>
      </section>

      <section className="advertising-results__panel">
        <h2>Attribution and interpretation</h2>
        {interpretAttribution({
          trackedGoogleAds: report.attribution.trackedGoogleAds,
          customerReported: report.attribution.customerReported,
          unknown: report.attribution.unknown,
          included: report.attribution.included,
          telephoneWithoutSource: report.attribution.telephoneWithoutSource,
          whatsappWithoutSource: report.attribution.whatsappWithoutSource,
          earlierPerDay: report.earlierPace.bookingsPerDay,
          selectedPerDay: report.selectedPace.bookingsPerDay,
          finished: report.selectedPace.days > 0,
          leavesOutCurrentDay: report.from <= (report.selectedPace.to || report.from) && report.to > report.selectedPace.to,
        }).map((line) => <p key={line}>{line}</p>)}
        <p>{report.unpaidConfirmed} confirmed {report.unpaidConfirmed === 1 ? "booking has" : "bookings have"} no recorded payment. Those fares are not counted as money received.</p>
      </section>

      <section className="advertising-results__panel">
        <h2>Historical data integrity</h2>
        <p>These figures use the existing Firebase booking records, as they were stored. Opening this page does not change a booking, a recorded price, a recorded payment, or stored attribution.</p>
        <p>A comparison is calculated from the stored bookings. Historical bookings are not modified merely to produce a comparison.</p>
        <p>A booking with no recorded source stays unknown. This page does not fill in a source for an older booking.</p>
        <p>A customer reported source or a journey cost saved here is stored as a separate note. The original booking record is left unchanged.</p>
        <p>The stored creation time is reliable as the time the booking record was saved. It is not reliable as the customer enquiry time, because a booking can be saved after the journey. Enquiry date uses that stored time. A journey date is not substituted for a booking creation date. A booking with no creation time is left out of an enquiry date report. A creation time is not used in place of a missing journey date.</p>
        {report.dateBasis === "enquiry" && report.excluded.missingCreationDate > 0 ? <p>{report.excluded.missingCreationDate} {report.excluded.missingCreationDate === 1 ? "booking has" : "bookings have"} no creation time, so {report.excluded.missingCreationDate === 1 ? "it is" : "they are"} left out of this enquiry date report.</p> : null}
      </section>

      <ResultsTable title="Airport route" rows={report.byRoute} />
      <ResultsTable title="Vehicle" rows={report.byVehicle} />
      <ResultsTable title="Acquisition source" rows={report.bySource} />
      <ResultsTable title="Enquiry type" rows={report.byEnquiry} />

      <section className="advertising-results__panel">
        <h2>Measurement delivery</h2>
        <p>Submitted means Google's collection endpoint accepted the request. It does not prove the event is in a GA4 report or in Google Ads.</p>
        {deliveries.length === 0 ? <p>No conversion deliveries are loaded.</p> : (
          <div className="advertising-results__table-wrap">
            <table>
              <thead><tr><th>Booking</th><th>Event</th><th>Status</th><th>Validation</th><th>Transport</th><th>GA4 report</th><th>Ads attribution</th><th>Note</th></tr></thead>
              <tbody>
                {deliveries.map((row) => (
                  <tr key={row.id}>
                    <td>{row.bookingId}</td>
                    <td>{row.event === "booking_confirmed" ? "Confirmed booking" : row.event === "purchase" ? "Payment" : row.event === "refund" ? "Refund" : row.event}</td>
                    <td>{row.status}</td>
                    <td>{row.validation || "not run"}</td>
                    <td>{row.transport || "not sent"}</td>
                    <td>Not confirmed</td>
                    <td>Not confirmed</td>
                    <td>{row.reason}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="advertising-results__panel">
        <h2>Manual advertising spend</h2>
        <p>{connectionNote || report.adsSpend.detail}</p>
        <label className="advertising-results__check">
          <input type="checkbox" checked={manualIsComplete} onChange={(event) => onManualComplete(event.target.checked)} disabled={saving || preview} />
          Use the dated manual entries as the full advertising spend for this period
        </label>
        <form className="advertising-results__spend" onSubmit={(event) => { event.preventDefault(); onAddSpend(spendDate, spendPounds, spendNote); setSpendPounds(""); setSpendNote(""); }}>
          <label>Date
            <input className="form-input" type="date" value={spendDate} onChange={(event) => setSpendDate(event.target.value)} required />
          </label>
          <label>Amount in pounds
            <input className="form-input" inputMode="decimal" value={spendPounds} onChange={(event) => setSpendPounds(event.target.value)} placeholder="0.00" required />
          </label>
          <label>Note
            <input className="form-input" value={spendNote} onChange={(event) => setSpendNote(event.target.value)} maxLength={120} placeholder="What this spend covers" />
          </label>
          <button className="btn btn-primary" type="submit" disabled={saving || preview}>Add manual entry</button>
        </form>
      </section>

      <section className="advertising-results__panel">
        <h2>Telephone and WhatsApp sources</h2>
        <p>Record what the customer said. This does not mark the booking as tracked advertising, and it does not change the original booking record.</p>
        {report.sourcePrompts.length === 0 ? <p>No telephone or WhatsApp bookings in this period.</p> : (
          <div className="advertising-results__table-wrap">
            <table>
              <thead><tr><th>Booking</th><th>Journey date</th><th>Route</th><th>Channel</th><th>Correct channel</th><th>Customer reported source</th></tr></thead>
              <tbody>
                {report.sourcePrompts.map((row) => (
                  <tr key={row.id || row.bookingNumber}>
                    <td>{row.bookingNumber}</td>
                    <td>{row.journeyDate}</td>
                    <td>{row.route}</td>
                    <td>{row.channel === "whatsapp" ? "WhatsApp" : "Telephone"}</td>
                    <td>
                      <select className="form-select" aria-label={`Channel for ${row.bookingNumber}`} value={row.channel} disabled={saving || preview || !row.id} onChange={(event) => onSaveSource(row.id, row.staffReportedSource, event.target.value === "whatsapp" ? "whatsapp" : "telephone")}>
                        <option value="telephone">Telephone</option>
                        <option value="whatsapp">WhatsApp</option>
                      </select>
                    </td>
                    <td>
                      <select className="form-select" aria-label={`Source for ${row.bookingNumber}`} value={row.staffReportedSource} disabled={saving || preview || !row.id} onChange={(event) => onSaveSource(row.id, event.target.value, row.channel)}>
                        {SOURCE_OPTIONS.map(([value, label]) => <option key={value || "blank"} value={value}>{label}</option>)}
                      </select>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="advertising-results__panel">
        <h2>Missing job costs</h2>
        <p>Leave a box empty to keep it unknown. Enter 0 only when the cost was actually zero.</p>
        {report.costPrompts.length === 0 ? <p>No completed job is missing a cost in this period.</p> : report.costPrompts.map((row) => (
          <form key={row.id || row.bookingNumber} className="advertising-results__costs" onSubmit={(event) => event.preventDefault()}>
            <p><strong>{row.bookingNumber}</strong> {row.journeyDate} {row.route}</p>
            {COST_FIELDS.map(([field, label]) => (
              <label key={field}>{label}
                <input className="form-input" inputMode="decimal" placeholder={row.costs[field] === null ? "Unknown" : formatGbp(row.costs[field] ?? null)} disabled={saving || preview || !row.id} onBlur={(event) => { if (event.target.value.trim()) onSaveCost(row.id, field, event.target.value); }} />
              </label>
            ))}
          </form>
        ))}
      </section>

      <footer className="advertising-results__footer">
        <p>{report.freshness}</p>
        <p>Excluded {report.excluded.synthetic} test bookings, {report.excluded.duplicate} duplicate bookings, and {report.excluded.returnLegs} return legs whose fare was already on the original booking.</p>
        <p>Customer names, contact details, exact addresses and booking notes are not sent to Google Analytics from this page.</p>
      </footer>
    </section>
  );
}

function ResultsTable({ title, rows }: { title: string; rows: AdvertisingReport["byRoute"] }) {
  return (
    <section className="advertising-results__panel">
      <h2>{title}</h2>
      {rows.length === 0 ? <p>Nothing in this period.</p> : (
        <div className="advertising-results__table-wrap">
          <table>
            <thead>
              <tr><th>{title}</th><th>Enquiries</th><th>Confirmed</th><th>Completed</th><th>Cancellations</th><th>Quoted fares</th><th>Payments less refunds</th></tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.label}>
                  <td>{row.label}</td>
                  <td>{row.enquiries}</td>
                  <td>{row.confirmed}</td>
                  <td>{row.completed}</td>
                  <td>{row.cancelled}</td>
                  <td>{formatGbp(row.quotedPence)}</td>
                  <td>{formatGbp(row.netPaymentsPence)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function BarList({ title, caption, rows }: { title: string; caption: string; rows: Array<{ label: string; text: string; width: number }> }) {
  const max = rows.reduce((largest, row) => Math.max(largest, row.width), 0);
  return (
    <section className="advertising-results__panel">
      <h2>{title}</h2>
      <p>{caption}</p>
      {rows.length === 0 ? <p>Nothing to show for this selection.</p> : (
        <ul className="advertising-results__bars">
          {rows.map((row) => (
            <li key={row.label}>
              <span>{row.label}</span>
              <span className="advertising-results__bar" style={{ width: `${max > 0 ? Math.max(4, Math.round((row.width / max) * 100)) : 0}%` }} />
              <span>{row.text}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function poundsToPence(value: string): number | null {
  const cleaned = value.trim();
  if (!/^\d+(\.\d{1,2})?$/.test(cleaned)) return null;
  return Math.round(Number(cleaned) * 100);
}

function withNotes(bookings: AdvertisingBookingInput[], notes: Record<string, NoteRecord>): AdvertisingBookingInput[] {
  return bookings.map((booking) => {
    const note = booking.id ? notes[booking.id] : undefined;
    if (!note) return booking;
    const costs: JobCostInput = { ...(booking.jobCosts || {}) };
    (Object.keys(costs).length ? Object.keys(costs) : COST_FIELDS.map(([field]) => field)).forEach((field) => {
      const key = field as keyof JobCostInput;
      if (note[key] !== undefined) costs[key] = note[key];
    });
    COST_FIELDS.forEach(([field]) => {
      if (note[field] !== undefined) costs[field] = note[field];
    });
    return {
      ...booking,
      staffReportedSource: note.staffReportedSource || booking.staffReportedSource,
      enquiryChannel: note.enquiryChannel || booking.enquiryChannel,
      jobCosts: costs,
    };
  });
}

const AdvertisingResults: React.FC<{ bookings: AdvertisingBookingInput[]; email?: string | null; previewMode?: boolean }> = ({ bookings, email, previewMode = false }) => {
  const initial = previewMode ? { from: "2026-11-01", to: "2026-11-30" } : currentLondonMonth();
  const [from, setFrom] = useState(initial.from);
  const [to, setTo] = useState(initial.to);
  const [dateBasis, setDateBasis] = useState<"journey" | "enquiry">("journey");
  const [spend, setSpend] = useState<SpendEntryInput[]>([]);
  const [notes, setNotes] = useState<Record<string, NoteRecord>>({});
  const [manualIsComplete, setManualIsComplete] = useState(false);
  const [advertisingStartedOn, setAdvertisingStartedOn] = useState<string | null>(null);
  const [advertisingStartConfirmed, setAdvertisingStartConfirmed] = useState(false);
  const [adsConnected, setAdsConnected] = useState(false);
  const [adsReason, setAdsReason] = useState(previewMode
    ? "Google Ads is not connected. No advertising credentials are available to the server."
    : "Checking whether Google Ads can be read from the server.");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);
  const [reportFilters, setReportFilters] = useState({ status: "all", route: "all", vehicle: "all", source: "all" });

  useEffect(() => {
    if (previewMode) return undefined;
    const spendUnsub = onSnapshot(collection(db, "marketingSpend"), (snapshot) => {
      setSpend(snapshot.docs.map((row) => {
        const data = row.data();
        return {
          id: row.id,
          date: String(data.date || ""),
          amountPence: Number(data.amountPence) || 0,
          source: data.source === "google_ads" ? "google_ads" : "manual",
          label: String(data.label || "Manual entry"),
        };
      }));
    }, () => setMessage("Advertising spend could not be loaded. Admin access is required before entries can be saved."));
    const notesUnsub = onSnapshot(collection(db, "bookingMeasurementNotes"), (snapshot) => {
      const next: Record<string, NoteRecord> = {};
      snapshot.docs.forEach((row) => { next[row.id] = row.data() as NoteRecord; });
      setNotes(next);
    }, () => undefined);
    const settingsUnsub = onSnapshot(doc(db, "marketingSpendSettings", "manual"), (snapshot) => {
      const data = snapshot.data();
      const started = data?.advertisingStartedOn;
      const recorded = typeof started === "string" && /^\d{4}-\d{2}-\d{2}$/.test(started) ? started : null;
      setManualIsComplete(data?.treatManualAsFullSpend === true);
      setAdvertisingStartedOn(recorded);
      setAdvertisingStartConfirmed(recorded !== null && data?.advertisingStartConfirmed === true);
    }, () => undefined);
    const deliveryUnsub = onSnapshot(collection(db, "marketingConversions"), (snapshot) => {
      setDeliveries(snapshot.docs.map((row) => {
        const data = row.data();
        return {
          id: row.id,
          bookingId: String(data.bookingId || ""),
          event: String(data.event || ""),
          status: String(data.status || ""),
          reason: String(data.reason || "").slice(0, 240),
          validation: String(data.validation || ""),
          transport: String(data.transport || ""),
        };
      }));
    }, () => setDeliveries([]));
    httpsCallable(functions, "readAdvertisingSpend")({}).then((result) => {
      const data = result.data as { connected?: boolean; reason?: string };
      setAdsConnected(data.connected === true);
      setAdsReason(data.reason || "Google Ads is not connected.");
    }).catch(() => {
      setAdsConnected(false);
      setAdsReason("Google Ads is not connected. No advertising credentials are available to the server, and the read has not been deployed.");
    });
    return () => {
      spendUnsub();
      notesUnsub();
      settingsUnsub();
      deliveryUnsub();
    };
  }, [previewMode]);

  const noted = useMemo(() => withNotes(bookings, notes), [bookings, notes]);
  const filterChoices = useMemo(() => ({
    routes: Array.from(new Set(noted.map((booking) => routeLabel(booking)))).sort(),
    vehicles: Array.from(new Set(noted.map((booking) => vehicleLabel(booking)))).sort(),
    sources: Array.from(new Set(noted.map((booking) => sourceLabel(booking)))).sort(),
  }), [noted]);
  const filteredBookings = useMemo(() => noted.filter((booking) => {
    if (reportFilters.status !== "all" && effectiveWorkflowStatus(booking) !== reportFilters.status) return false;
    if (reportFilters.route !== "all" && routeLabel(booking) !== reportFilters.route) return false;
    if (reportFilters.vehicle !== "all" && vehicleLabel(booking) !== reportFilters.vehicle) return false;
    if (reportFilters.source !== "all" && sourceLabel(booking) !== reportFilters.source) return false;
    return true;
  }), [noted, reportFilters]);
  const report = useMemo(() => buildAdvertisingReport(filteredBookings, {
    from, to, dateBasis, spend, manualSpendIsComplete: manualIsComplete, adsConnected, adsSpendPence: null, advertisingStartedOn, advertisingStartConfirmed,
  }), [filteredBookings, from, to, dateBasis, spend, manualIsComplete, adsConnected, advertisingStartedOn, advertisingStartConfirmed]);

  if (!previewMode && !isAdminEmail(email)) {
    return <section className="advertising-results"><h1>Advertising results</h1><p>This page is only for admin accounts.</p></section>;
  }

  const saveNote = async (id: string, patch: NoteRecord) => {
    setSaving(true);
    setMessage("");
    try {
      await setDoc(doc(db, "bookingMeasurementNotes", id), { ...patch, updatedAt: serverTimestamp(), updatedBy: email || "" }, { merge: true });
    } catch {
      setMessage("The source or cost was not saved. Admin rules for these records are not available until they are deployed.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <AdvertisingResultsView
      report={report}
      deliveries={deliveries}
      preview={previewMode}
      message={message}
      connectionNote={adsReason}
      saving={saving}
      manualIsComplete={manualIsComplete}
      advertisingStartedOn={advertisingStartedOn}
      advertisingStartConfirmed={advertisingStartConfirmed}
      onDates={(nextFrom, nextTo, nextBasis) => { setFrom(nextFrom); setTo(nextTo); setDateBasis(nextBasis); }}
      onManualComplete={async (value) => {
        setManualIsComplete(value);
        if (previewMode) return;
        try {
          await setDoc(doc(db, "marketingSpendSettings", "manual"), { treatManualAsFullSpend: value, updatedAt: serverTimestamp(), updatedBy: email || "" }, { merge: true });
        } catch {
          setMessage("The spend setting was not saved. Admin rules for these records are not available until they are deployed.");
        }
      }}
      onSaveStartDate={async (date) => {
        if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
          setMessage("Enter the Google Ads start date.");
          return;
        }
        const changed = advertisingStartedOn !== null && advertisingStartedOn !== date;
        setAdvertisingStartedOn(date);
        setAdvertisingStartConfirmed(true);
        if (previewMode) return;
        setSaving(true);
        try {
          await setDoc(doc(db, "marketingSpendSettings", "manual"), {
            advertisingStartedOn: date,
            advertisingStartConfirmed: true,
            updatedAt: serverTimestamp(),
            updatedBy: email || "",
          }, { merge: true });
          setMessage(changed
            ? "Google Ads start date changed. Booking records were not changed."
            : "Google Ads start date confirmed. Booking records were not changed.");
        } catch {
          setMessage("The Google Ads start date was not saved. Admin rules for these records are not available until they are deployed.");
        } finally {
          setSaving(false);
        }
      }}
      onAddSpend={async (date, pounds, note) => {
        const amountPence = poundsToPence(pounds);
        if (!date || amountPence === null) {
          setMessage("Enter a date and an amount in pounds and pence.");
          return;
        }
        setSaving(true);
        try {
          await addDoc(collection(db, "marketingSpend"), {
            date,
            amountPence,
            source: "manual",
            label: "Manual entry",
            note: note.trim().slice(0, 120),
            createdAt: serverTimestamp(),
            createdBy: email || "",
          });
          setMessage("Manual spend entry saved.");
        } catch {
          setMessage("The manual entry was not saved. Admin rules for advertising spend are not available until they are deployed.");
        } finally {
          setSaving(false);
        }
      }}
      reportFilters={reportFilters}
      filterChoices={filterChoices}
      onReportFilters={setReportFilters}
      onSaveSource={(id, source, channel) => { void saveNote(id, { staffReportedSource: source, enquiryChannel: channel }); }}
      onSaveCost={(id, field, pounds) => {
        const amount = poundsToPence(pounds);
        if (amount === null) {
          setMessage("Enter a cost in pounds and pence, or leave the box empty.");
          return;
        }
        void saveNote(id, { [field]: amount });
      }}
    />
  );
};

export default AdvertisingResults;
