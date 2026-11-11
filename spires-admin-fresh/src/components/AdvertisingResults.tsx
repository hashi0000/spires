import React, { useEffect, useMemo, useState } from "react";
import { addDoc, collection, doc, onSnapshot, serverTimestamp, setDoc } from "firebase/firestore";
import { httpsCallable } from "firebase/functions";
import { db, functions } from "../utils/firebase";
import { isAdminEmail } from "../utils/staffAccess";
import {
  ADVERTISING_BUDGET_LABEL,
  AdvertisingBookingInput,
  AdvertisingReport,
  JobCostInput,
  SpendEntryInput,
  buildAdvertisingReport,
  currentLondonMonth,
  formatGbp,
} from "../utils/advertisingResults";

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
  connectionNote = "",
  onDates,
  onManualComplete,
  onAddSpend,
  onSaveSource,
  onSaveCost,
}: {
  report: AdvertisingReport;
  deliveries?: DeliveryRow[];
  preview?: boolean;
  message?: string;
  saving?: boolean;
  manualIsComplete?: boolean;
  connectionNote?: string;
  onDates: (from: string, to: string, dateBasis: "journey" | "enquiry") => void;
  onManualComplete: (value: boolean) => void;
  onAddSpend: (date: string, pounds: string, note: string) => void;
  onSaveSource: (id: string, source: string, channel: "telephone" | "whatsapp") => void;
  onSaveCost: (id: string, field: keyof JobCostInput, pounds: string) => void;
}) {
  const [spendDate, setSpendDate] = useState(report.to);
  const [spendPounds, setSpendPounds] = useState("");
  const [spendNote, setSpendNote] = useState("");
  const figures = [report.quoted, report.netPayments, report.manualSpend, report.adsSpend, report.advertisingSpend, report.contribution, report.costPerConfirmed, report.costPerCompletedPaid, report.costs.driver, report.costs.fuel, report.costs.parking, report.costs.airport, report.costs.paymentFees];

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
      </form>

      <div className="advertising-results__counts">
        <article><span>Enquiries</span><strong>{report.enquiries}</strong></article>
        <article><span>Confirmed bookings</span><strong>{report.confirmed}</strong></article>
        <article><span>Completed jobs</span><strong>{report.completed}</strong></article>
        <article><span>Cancellations</span><strong>{report.cancelled}</strong></article>
      </div>

      <div className="advertising-results__figures">
        {figures.map((row) => (
          <article key={row.label}>
            <h2>{row.label}</h2>
            <p className="advertising-results__amount">{formatGbp(row.pence)}</p>
            <p>{row.detail}</p>
          </article>
        ))}
      </div>

      <section className="advertising-results__panel">
        <h2>Attribution coverage</h2>
        <p>{report.attribution.trackedGoogleAds} tracked Google Ads, {report.attribution.customerReported} customer reported, {report.attribution.unknown} unknown, from {report.attribution.included} included bookings.</p>
        <p>{report.attribution.telephoneWithoutSource} telephone and {report.attribution.whatsappWithoutSource} WhatsApp bookings have no recorded source.</p>
        <p>{report.unpaidConfirmed} confirmed {report.unpaidConfirmed === 1 ? "booking has" : "bookings have"} no recorded payment. Those fares are not counted as money received.</p>
        <p>Tracked means a consented Google click id was stored with the booking. A customer saying the enquiry came from an advert is recorded separately. An unknown source stays unknown.</p>
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
        <p>Record what the customer said. This does not mark the booking as tracked advertising.</p>
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
  const [adsConnected, setAdsConnected] = useState(false);
  const [adsReason, setAdsReason] = useState(previewMode
    ? "Google Ads is not connected. No advertising credentials are available to the server."
    : "Checking whether Google Ads can be read from the server.");
  const [message, setMessage] = useState("");
  const [saving, setSaving] = useState(false);
  const [deliveries, setDeliveries] = useState<DeliveryRow[]>([]);

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
      setManualIsComplete(snapshot.data()?.treatManualAsFullSpend === true);
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

  const report = useMemo(() => buildAdvertisingReport(withNotes(bookings, notes), {
    from, to, dateBasis, spend, manualSpendIsComplete: manualIsComplete, adsConnected, adsSpendPence: null,
  }), [bookings, notes, from, to, dateBasis, spend, manualIsComplete, adsConnected]);

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
