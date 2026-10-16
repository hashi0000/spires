import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { User } from "firebase/auth";
import { addDoc, collection, deleteField, doc, serverTimestamp, updateDoc } from "firebase/firestore";
import { AlertTriangle, ChevronLeft, ChevronRight, Phone, Plus, Search, X } from "lucide-react";
import { Booking, Driver } from "../types/types";
import { db } from "../utils/firebase";
import { fromDateAndTime } from "../utils/bookingDateTime";
import { getBookingPickupDate } from "../utils/bookingSchedule";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import { generateSpiresBookingNumber } from "../utils/bookingNumber";
import { CustomerProfile } from "../utils/customerSuggestions";
import {
  FAMILY_VEHICLE_OPTIONS,
  FamilyJobDraft,
  FamilyJobView,
  buildFamilyCancelPayload,
  buildFamilyCreatePayload,
  buildFamilyUpdatePayload,
  clearFamilyJobDraft,
  conflictsFor,
  draftFromBooking,
  driverColour,
  driverName,
  emptyFamilyJobDraft,
  familyVehicleLabel,
  filterFamilyJobs,
  findJobConflicts,
  isUnassignedJob,
  loadFamilyJobDraft,
  saveFamilyJobDraft,
  telHref,
  validateFamilyJobDraft,
  whatsappHref,
} from "../utils/familyJobs";
import { addLocalDays, startOfLocalDay } from "../utils/bookingDateTime";

type Props = {
  bookings: Booking[];
  drivers: Driver[];
  locationSuggestions: string[];
  customerSuggestions: CustomerProfile[];
  user: User;
  loading: boolean;
};

function actorFrom(user: User) {
  return { uid: user.uid, email: (user.email || "").trim().toLowerCase() };
}

function formatJobWhen(booking: Booking): string {
  const pickup = getBookingPickupDate(booking);
  if (!pickup) return "Time TBC";
  return pickup.toLocaleString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function monthLabel(d: Date): string {
  return d.toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

const FamilyJobs: React.FC<Props> = ({
  bookings,
  drivers,
  locationSuggestions,
  customerSuggestions,
  user,
  loading,
}) => {
  const [view, setView] = useState<FamilyJobView>("today");
  const [query, setQuery] = useState("");
  const [driverFilter, setDriverFilter] = useState("");
  const [vehicleFilter, setVehicleFilter] = useState("");
  const [calendarCursor, setCalendarCursor] = useState(() => startOfLocalDay(new Date()));
  const [selectedDay, setSelectedDay] = useState(() => startOfLocalDay(new Date()));
  const [now, setNow] = useState(() => new Date());
  const [formOpen, setFormOpen] = useState(false);
  const [moreDetails, setMoreDetails] = useState(false);
  const [draft, setDraft] = useState<FamilyJobDraft>(emptyFamilyJobDraft);
  const [editing, setEditing] = useState<Booking | null>(null);
  const [selected, setSelected] = useState<Booking | null>(null);
  const [confirmCancel, setConfirmCancel] = useState(false);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), 60 * 1000);
    return () => window.clearInterval(id);
  }, []);

  useEffect(() => {
    if (!status) return;
    const id = window.setTimeout(() => setStatus(""), 4000);
    return () => window.clearTimeout(id);
  }, [status]);

  const conflicts = useMemo(() => findJobConflicts(bookings), [bookings]);
  const jobs = useMemo(
    () =>
      filterFamilyJobs(bookings, {
        view,
        now,
        calendarDay: view === "calendar" ? selectedDay : undefined,
        driverId: driverFilter || undefined,
        vehicleType: vehicleFilter || undefined,
        query,
      }),
    [bookings, view, now, selectedDay, driverFilter, vehicleFilter, query]
  );

  const liveSelected = selected
    ? bookings.find((row) => row.id === selected.id) || selected
    : null;

  const openCreate = () => {
    const restored = loadFamilyJobDraft();
    const today = toTodayDefaults(restored);
    setEditing(null);
    setSelected(null);
    setDraft(today);
    setMoreDetails(Boolean(today.driverId || today.actualFare || today.flightNumber || today.notes));
    setError("");
    setConfirmCancel(false);
    setFormOpen(true);
  };

  const openEdit = (booking: Booking) => {
    setEditing(booking);
    setSelected(booking);
    setDraft(draftFromBooking(booking));
    setMoreDetails(true);
    setError("");
    setConfirmCancel(false);
    setFormOpen(true);
  };

  const closeForm = () => {
    if (!editing) saveFamilyJobDraft(draft);
    setFormOpen(false);
  };

  const updateDraft = (patch: Partial<FamilyJobDraft>) => {
    setDraft((current) => {
      const next = { ...current, ...patch };
      if (!editing) saveFamilyJobDraft(next);
      return next;
    });
  };

  const applyCustomerName = (name: string) => {
    const match = customerSuggestions.find(
      (row) => row.displayName.toLowerCase() === name.trim().toLowerCase()
    );
    updateDraft({
      hirerName: name,
      hirerPhone: match?.phone || draft.hirerPhone,
    });
  };

  const saveJob = async (event: FormEvent) => {
    event.preventDefault();
    const problem = validateFamilyJobDraft(draft);
    if (problem) {
      setError(problem);
      return;
    }
    const pickupIso = fromDateAndTime(draft.pickupDate, draft.pickupTime);
    const actor = actorFrom(user);
    setBusy(true);
    setError("");
    try {
      if (editing?.id) {
        const payload = buildFamilyUpdatePayload(editing, draft, pickupIso, actor);
        if (!draft.driverId.trim()) payload.driverId = deleteField();
        payload.updatedAt = serverTimestamp();
        await updateDoc(doc(db, "bookings", editing.id), payload as Record<string, any>);
        setStatus("Job updated for everyone.");
      } else {
        const payload = buildFamilyCreatePayload(draft, pickupIso, actor);
        payload.createdAt = serverTimestamp();
        payload.updatedAt = serverTimestamp();
        if (!payload.bookingNumber) payload.bookingNumber = generateSpiresBookingNumber();
        await addDoc(collection(db, "bookings"), payload);
        clearFamilyJobDraft();
        setStatus("Job added to the shared calendar.");
      }
      setFormOpen(false);
      setEditing(null);
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const cancelJob = async () => {
    if (!liveSelected?.id) return;
    setBusy(true);
    setError("");
    try {
      const payload = buildFamilyCancelPayload(liveSelected, actorFrom(user));
      payload.updatedAt = serverTimestamp();
      await updateDoc(doc(db, "bookings", liveSelected.id), payload as Record<string, any>);
      setStatus(`${liveSelected.bookingNumber} cancelled.`);
      setConfirmCancel(false);
      setSelected(null);
      setFormOpen(false);
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const calendarCells = useMemo(() => monthCells(calendarCursor), [calendarCursor]);
  const daysWithJobs = useMemo(() => {
    const set = new Set<string>();
    for (const booking of bookings) {
      if (booking.status === "cancelled") continue;
      const pickup = getBookingPickupDate(booking);
      if (!pickup) continue;
      set.add(ymd(pickup));
    }
    return set;
  }, [bookings]);

  return (
    <div className="family-jobs">
      <header className="family-jobs-head">
        <div>
          <h2>Family jobs</h2>
          <p>Shared live calendar. Website bookings appear here too.</p>
        </div>
      </header>

      {error && !formOpen && !liveSelected ? <p className="family-jobs-error">{error}</p> : null}
      {status ? <p className="family-jobs-ok">{status}</p> : null}

      <div className="family-jobs-tabs" role="tablist" aria-label="Job views">
        {(
          [
            ["today", "Today"],
            ["tomorrow", "Tomorrow"],
            ["week", "This week"],
            ["calendar", "Calendar"],
          ] as const
        ).map(([id, label]) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={view === id}
            className={view === id ? "is-active" : ""}
            onClick={() => setView(id)}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="family-jobs-filters">
        <label className="family-jobs-search">
          <Search aria-hidden="true" />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search name, phone or place"
          />
        </label>
        <select value={driverFilter} onChange={(e) => setDriverFilter(e.target.value)} aria-label="Filter by driver">
          <option value="">All drivers</option>
          <option value="unassigned">Unassigned</option>
          {drivers.filter((row) => row.active).map((driver) => (
            <option key={driver.id} value={driver.id}>
              {driver.name}
            </option>
          ))}
        </select>
        <select value={vehicleFilter} onChange={(e) => setVehicleFilter(e.target.value)} aria-label="Filter by vehicle">
          <option value="">All vehicles</option>
          {FAMILY_VEHICLE_OPTIONS.map((option) => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
      </div>

      {view === "calendar" ? (
        <div className="family-jobs-cal">
          <div className="family-jobs-cal-nav">
            <button
              type="button"
              onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() - 1, 1))}
              aria-label="Previous month"
            >
              <ChevronLeft />
            </button>
            <strong>{monthLabel(calendarCursor)}</strong>
            <button
              type="button"
              onClick={() => setCalendarCursor(new Date(calendarCursor.getFullYear(), calendarCursor.getMonth() + 1, 1))}
              aria-label="Next month"
            >
              <ChevronRight />
            </button>
          </div>
          <div className="family-jobs-cal-grid">
            {["M", "T", "W", "T", "F", "S", "S"].map((label, index) => (
              <span key={`${label}-${index}`} className="family-jobs-cal-dow">
                {label}
              </span>
            ))}
            {calendarCells.map((cell) => (
              <button
                key={cell.toISOString()}
                type="button"
                className={[
                  "family-jobs-cal-day",
                  ymd(cell) === ymd(selectedDay) ? "is-selected" : "",
                  daysWithJobs.has(ymd(cell)) ? "has-jobs" : "",
                ].join(" ")}
                onClick={() => setSelectedDay(cell)}
              >
                {cell.getDate()}
              </button>
            ))}
          </div>
        </div>
      ) : null}

      {loading ? (
        <p className="family-jobs-empty">Loading jobs…</p>
      ) : jobs.length === 0 ? (
        <p className="family-jobs-empty">No jobs in this view. Tap Add job to put one on the shared calendar.</p>
      ) : (
        <ul className="family-jobs-list">
          {jobs.map((booking) => {
            const colour = driverColour(booking.driverId);
            const ownConflicts = conflictsFor(booking.id || "", conflicts);
            const unassigned = isUnassignedJob(booking);
            return (
              <li key={booking.id}>
                <button
                  type="button"
                  className={`family-job-card${unassigned ? " is-unassigned" : ""}`}
                  style={{ borderLeftColor: colour }}
                  onClick={() => {
                    setSelected(booking);
                    setConfirmCancel(false);
                    setError("");
                  }}
                >
                  <div className="family-job-when">{formatJobWhen(booking)}</div>
                  <div className="family-job-route">
                    {booking.pickupLocation} to {booking.destination}
                  </div>
                  <div className="family-job-meta">
                    <span>{booking.hirerName}</span>
                    <span>{familyVehicleLabel(booking.vehicleType)}</span>
                    <span className={unassigned ? "is-warn" : ""}>{driverName(drivers, booking.driverId)}</span>
                  </div>
                  {ownConflicts.length > 0 ? (
                    <div className="family-job-conflict">
                      <AlertTriangle /> Possible overlap
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <button type="button" className="family-jobs-fab" onClick={openCreate}>
        <Plus /> Add job
      </button>

      {liveSelected && !formOpen ? (
        <div className="family-jobs-sheet" role="dialog" aria-label="Job details">
          <div className="family-jobs-sheet-card">
            <button type="button" className="family-jobs-close" onClick={() => setSelected(null)} aria-label="Close">
              <X />
            </button>
            <p className="family-jobs-kicker">{liveSelected.bookingNumber}</p>
            <h3>{formatJobWhen(liveSelected)}</h3>
            <p className="family-job-route">
              {liveSelected.pickupLocation} to {liveSelected.destination}
            </p>
            <p>{liveSelected.hirerName}</p>
            <p>{familyVehicleLabel(liveSelected.vehicleType)} · {driverName(drivers, liveSelected.driverId)}</p>
            {conflictsFor(liveSelected.id || "", conflicts).length > 0 ? (
              <p className="family-job-conflict">
                <AlertTriangle /> This job overlaps another driver or vehicle booking.
              </p>
            ) : null}
            {error ? <p className="family-jobs-error">{error}</p> : null}
            <div className="family-jobs-actions">
              {telHref(liveSelected.hirerPhone) ? (
                <a className="btn btn-primary" href={telHref(liveSelected.hirerPhone)}>
                  <Phone /> Call
                </a>
              ) : null}
              {whatsappHref(liveSelected.hirerPhone) ? (
                <a className="btn" href={whatsappHref(liveSelected.hirerPhone, `Spires Taxis job ${liveSelected.bookingNumber}`)} target="_blank" rel="noreferrer">
                  WhatsApp
                </a>
              ) : null}
              <button type="button" className="btn" onClick={() => openEdit(liveSelected)}>
                Edit
              </button>
              {liveSelected.status !== "cancelled" ? (
                confirmCancel ? (
                  <div className="family-jobs-confirm">
                    <p>Cancel this job for everyone? It stays on the record.</p>
                    <button type="button" className="btn btn-danger" onClick={cancelJob} disabled={busy}>
                      Confirm cancel
                    </button>
                    <button type="button" className="btn" onClick={() => setConfirmCancel(false)}>
                      Keep job
                    </button>
                  </div>
                ) : (
                  <button type="button" className="btn btn-danger" onClick={() => setConfirmCancel(true)}>
                    Cancel job
                  </button>
                )
              ) : (
                <p className="family-jobs-muted">Already cancelled.</p>
              )}
            </div>
          </div>
        </div>
      ) : null}

      {formOpen ? (
        <div className="family-jobs-sheet" role="dialog" aria-label={editing ? "Edit job" : "Add job"}>
          <form className="family-jobs-sheet-card family-jobs-form" onSubmit={saveJob}>
            <button type="button" className="family-jobs-close" onClick={closeForm} aria-label="Close">
              <X />
            </button>
            <h3>{editing ? "Edit job" : "Add job"}</h3>
            <label>
              Pickup location
              <input
                list="family-job-places"
                value={draft.pickupLocation}
                onChange={(e) => updateDraft({ pickupLocation: e.target.value })}
                autoComplete="street-address"
                required
              />
            </label>
            <label>
              Drop off location
              <input
                list="family-job-places"
                value={draft.destination}
                onChange={(e) => updateDraft({ destination: e.target.value })}
                autoComplete="street-address"
                required
              />
            </label>
            <div className="family-jobs-split">
              <label>
                Pickup date
                <input type="date" value={draft.pickupDate} onChange={(e) => updateDraft({ pickupDate: e.target.value })} required />
              </label>
              <label>
                Pickup time
                <input type="time" value={draft.pickupTime} onChange={(e) => updateDraft({ pickupTime: e.target.value })} required />
              </label>
            </div>
            <label>
              Customer name
              <input
                list="family-job-customers"
                value={draft.hirerName}
                onChange={(e) => applyCustomerName(e.target.value)}
                autoComplete="name"
                required
              />
            </label>
            <label>
              Customer phone or WhatsApp number
              <input
                type="tel"
                inputMode="tel"
                value={draft.hirerPhone}
                onChange={(e) => updateDraft({ hirerPhone: e.target.value })}
                autoComplete="tel"
                required
              />
            </label>
            <fieldset>
              <legend>Vehicle required</legend>
              {FAMILY_VEHICLE_OPTIONS.map((option) => (
                <label key={option.value} className="family-jobs-radio">
                  <input
                    type="radio"
                    name="vehicleType"
                    checked={draft.vehicleType === option.value}
                    onChange={() => updateDraft({ vehicleType: option.value })}
                  />
                  {option.label}
                </label>
              ))}
            </fieldset>
            <button type="button" className="family-jobs-more" onClick={() => setMoreDetails((open) => !open)}>
              {moreDetails ? "Hide extra details" : "More details"}
            </button>
            {moreDetails ? (
              <div className="family-jobs-extra">
                <label>
                  Assigned driver
                  <select value={draft.driverId} onChange={(e) => updateDraft({ driverId: e.target.value })}>
                    <option value="">Unassigned</option>
                    {drivers.filter((row) => row.active).map((driver) => (
                      <option key={driver.id} value={driver.id}>
                        {driver.name}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Fare
                  <input
                    type="number"
                    inputMode="decimal"
                    min="0"
                    step="0.01"
                    value={draft.actualFare}
                    onChange={(e) => updateDraft({ actualFare: e.target.value })}
                    placeholder="Optional"
                  />
                </label>
                <label>
                  Payment status
                  <select
                    value={draft.paymentStatus}
                    onChange={(e) => updateDraft({ paymentStatus: e.target.value as FamilyJobDraft["paymentStatus"] })}
                  >
                    <option value="">Not set</option>
                    <option value="pending">Pending</option>
                    <option value="paid">Paid</option>
                    <option value="partial">Partial</option>
                  </select>
                </label>
                <label>
                  Flight number
                  <input value={draft.flightNumber} onChange={(e) => updateDraft({ flightNumber: e.target.value })} />
                </label>
                <label>
                  Notes
                  <textarea rows={3} value={draft.notes} onChange={(e) => updateDraft({ notes: e.target.value })} />
                </label>
              </div>
            ) : null}
            {error ? <p className="family-jobs-error">{error}</p> : null}
            <button type="submit" className="btn btn-primary family-jobs-submit" disabled={busy}>
              {busy ? "Saving…" : editing ? "Save changes" : "Add to calendar"}
            </button>
            <p className="family-jobs-muted">If you close this, the details stay until you add the job.</p>
            <datalist id="family-job-places">
              {locationSuggestions.map((place) => (
                <option key={place} value={place} />
              ))}
            </datalist>
            <datalist id="family-job-customers">
              {customerSuggestions.map((row) => (
                <option key={row.displayName} value={row.displayName} />
              ))}
            </datalist>
          </form>
        </div>
      ) : null}
    </div>
  );
};

function ymd(d: Date): string {
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function monthCells(cursor: Date): Date[] {
  const first = new Date(cursor.getFullYear(), cursor.getMonth(), 1);
  const startOffset = (first.getDay() + 6) % 7;
  const start = addLocalDays(first, -startOffset);
  return Array.from({ length: 42 }, (_, index) => addLocalDays(start, index));
}

function toTodayDefaults(draft: FamilyJobDraft): FamilyJobDraft {
  if (draft.pickupDate || draft.pickupLocation) return draft;
  const now = new Date();
  const pad = (n: number) => String(n).padStart(2, "0");
  return {
    ...draft,
    pickupDate: `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    pickupTime: `${pad(now.getHours())}:${pad(now.getMinutes())}`,
  };
}

export default FamilyJobs;
