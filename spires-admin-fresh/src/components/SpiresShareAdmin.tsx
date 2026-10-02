import React, { FormEvent, useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";

type ShareState = {
  actorEmail: string;
  publicEnabled: boolean;
  envFlag: boolean;
  config: {
    publicEnabled: boolean;
    passengerCapacity: number;
    earlyDepartureThreshold: number;
    maxHomeCollectionsPerJourney: number;
    confirmationDeadlineHoursBeforeDeparture: number;
    homeCollectionSurchargePence: number;
    luggage: {
      largeSuitcasesPerPassenger: number;
      cabinBagsPerPassenger: number;
      maxLargeSuitcasesPerVehicle: number;
      maxCabinBagsPerVehicle: number;
    };
    meetingPoint: { publicName: string };
    airports: Array<{
      id: string;
      name: string;
      dropoffLabel: string;
      farePence: number;
      targetRevenuePence: number;
    }>;
  };
  journeys: Array<{
    id: string;
    publicNumber: string;
    airportId: string;
    travelDate: string;
    departureTime: string;
    status: string;
    capacity: number;
    occupiedSeats: number;
    farePence: number;
    targetRevenuePence: number;
    waitlistCount: number;
    homeCollectionCount: number;
    earlyDepartureOffered?: boolean;
    paymentLinkUrl?: string;
    paymentStageStatus?: string;
    paymentDeadlineAt?: string;
    paymentWindowOpenedAt?: string;
    supplementPaymentLinkUrl?: string;
    locked?: boolean;
    confirmedAt?: string;
    customerVisible?: boolean;
    originLabel?: string;
    departureLocation?: string;
    destinationLabel?: string;
    vehicleLabel?: string;
    minPassengerThreshold?: number;
    adminNotes?: string;
    journeyType?: string;
    originCity?: string;
    destinationCity?: string;
    destinationMatchingEnabled?: boolean;
    proposedSharedDropoffHubId?: string;
    proposedSharedDropoffDisplayName?: string;
    sharedDropoffProposalVersion?: number;
    suggestedSharedDropoffHubId?: string;
    waitlistOfferOutstanding?: boolean;
    interestGroupId?: string;
  }>;
  bookings: Array<{
    id: string;
    journeyId: string;
    passengers: number;
    name: string;
    email: string;
    mobile: string;
    paymentStatus: string;
    reservationStatus?: string;
    hostedPaymentStatus?: string;
    paidAmountPence?: number;
    paidAt?: string;
    fourPassengerAccepted?: boolean;
    supplementPaidPence?: number;
    cancellationCategory?: string;
    refundStatus?: string;
    amountRefundedPence?: number;
    amountRetainedPence?: number;
    adminNotes?: string;
    boardStatus: string;
    earlyDepartureAccepted: boolean;
    intendedDestinationText?: string;
    intendedDestinationPostcode?: string;
    sharedDropoffAcceptedAt?: string;
    sharedDropoffDeclinedAt?: string;
    acceptedDropoffProposalVersion?: number;
  }>;
  hubs?: Array<{
    id: string;
    hubId?: string;
    name: string;
    city: string;
    displayName?: string;
    enabled: boolean;
    address?: string;
    postcode?: string;
  }>;
  waitlist: Array<{
    id: string;
    journeyId: string;
    status: string;
    passengers: number;
    name?: string;
    email?: string;
    waitlistPosition?: number;
    joinedWaitlistAt?: string;
    createdAt?: string;
    offeredAt?: string;
    offerExpiresAt?: string;
    claimedAt?: string;
    declinedAt?: string;
  }>;
  interestGroups?: Array<{
    id: string;
    publicNumber: string;
    origin: string;
    destinationRegion: string;
    travelDate: string;
    timeWindowStart: string;
    timeWindowEnd: string;
    interestedSeatCount: number;
    status: string;
    matchingUncertain?: boolean;
    destinationSpread?: Array<{ index: number; name: string; intendedDestinationText: string; timeWindowStart: string; timeWindowEnd: string }>;
    entries?: Array<{ id: string; name: string; email: string; passengers: number; status: string; intendedDestinationText?: string }>;
  }>;
  audit: Array<{ id: string; type: string; actorEmail?: string }>;
  notifications: Array<{ id: string; type?: string; to?: string; status?: string; dryRun?: boolean }>;
};

const getState = httpsCallable(functions, "spiresShareGetState");
const saveConfig = httpsCallable(functions, "spiresShareSaveConfig");
const searchFn = httpsCallable(functions, "spiresShareSearch");
const proposeOrJoin = httpsCallable(functions, "spiresShareProposeOrJoin");
const adminAction = httpsCallable(functions, "spiresShareAdminAction");
const runTick = httpsCallable(functions, "spiresShareRunTick");

function gbp(pence: number): string {
  return `£${((pence || 0) / 100).toFixed(2)}`;
}

const SpiresShareAdmin: React.FC = () => {
  const [state, setState] = useState<ShareState | null>(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState<"board" | "interest" | "preview" | "driver" | "config">("board");
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState({
    airportId: "heathrow",
    travelDate: "",
    preferredDepartureTime: "10:15",
    flexibility: "plus_minus_30",
    flightDepartureTime: "",
    flightNumber: "",
    dropoffTerminal: "T2",
    passengers: 1,
    largeSuitcases: 1,
    cabinBags: 1,
    name: "",
    mobile: "",
    email: "",
  });
  const [paymentLink, setPaymentLink] = useState("");
  const [supplementLink, setSupplementLink] = useState("");
  const [deadlineValue, setDeadlineValue] = useState("");
  const [journeyNote, setJourneyNote] = useState("");
  const [refundDraft, setRefundDraft] = useState({ bookingId: "", refundStatus: "PENDING", amountRefundedPence: "0", amountRetainedPence: "0", adminNotes: "" });
  const [createForm, setCreateForm] = useState({
    originLabel: "Oxford",
    departureLocation: "Thornhill Park & Ride",
    destinationLabel: "Heathrow Airport Terminal 3",
    destinationTerminal: "T3",
    vehicleLabel: "Mercedes Vito",
    travelDate: "",
    departureTime: "14:00",
    capacity: 5,
    farePence: 3500,
    minPassengerThreshold: 4,
    confirmationDeadlineHoursBeforeDeparture: 24,
    notes: "",
    customerVisible: false,
  });
  const [cityForm, setCityForm] = useState({
    originCity: "Oxford",
    destinationCity: "London",
    departureLocation: "Thornhill Park & Ride",
    travelDate: "",
    departureTime: "10:00",
    capacity: 5,
    farePence: 3500,
    minPassengerThreshold: 4,
    notes: "",
  });
  const [hubForm, setHubForm] = useState({
    name: "",
    city: "London",
    displayName: "",
    address: "",
    postcode: "",
    enabled: false,
  });
  const [selectedHubId, setSelectedHubId] = useState("");
  const [proposeForm, setProposeForm] = useState({
    interestGroupId: "",
    departureLocation: "Thornhill Park & Ride",
    departureTime: "10:00",
    farePence: 3500,
    capacity: 5,
    hubId: "",
    notes: "",
    mergeTargetId: "",
  });
  const [matches, setMatches] = useState<Array<{ publicNumber: string; departureTime: string; occupiedSeats: number; remainingSeats: number; capacity?: number; farePence: number; warning?: string; guarantee?: string }>>([]);

  const reload = async () => {
    const result = await getState({});
    setState(result.data as ShareState);
  };

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const result = await getState({});
        if (!cancelled) setState(result.data as ShareState);
      } catch (err) {
        if (!cancelled) setError(getCallableErrorMessage(err));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const selected = state?.journeys.find((row) => row.id === selectedId) || null;
  const selectedBookings = useMemo(
    () => (state?.bookings || []).filter((row) => row.journeyId === selectedId),
    [state, selectedId]
  );

  const run = async (fn: () => Promise<void>) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
      await reload();
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const handleSearch = async (e: FormEvent) => {
    e.preventDefault();
    await run(async () => {
      const result = await searchFn({
        ...preview,
        luggage: { largeSuitcases: preview.largeSuitcases, cabinBags: preview.cabinBags, other: "" },
      });
      const data = result.data as { matches: typeof matches };
      setMatches(data.matches || []);
      setStatus(
        data.matches?.length
          ? "There's already a Spires Share journey close to your requested time."
          : "No matching journey. You can propose one."
      );
    });
  };

  const handlePropose = async (publicNumber?: string, forcePropose = false) => {
    await run(async () => {
      const result = await proposeOrJoin({
        action: publicNumber ? "join" : "propose",
        publicNumber,
        forcePropose,
        airportId: "heathrow",
        travelDate: preview.travelDate,
        preferredDepartureTime: preview.preferredDepartureTime,
        flexibility: preview.flexibility,
        flightDepartureTime: preview.flightDepartureTime,
        flightNumber: preview.flightNumber,
        dropoffTerminal: preview.dropoffTerminal,
        passengers: preview.passengers,
        name: preview.name,
        mobile: preview.mobile,
        email: preview.email,
        idempotencyKey: `${Date.now()}-${Math.random().toString(36).slice(2, 10)}-admin`,
        termsAccepted: true,
        luggage: {
          largeSuitcases: preview.largeSuitcases,
          cabinBags: preview.cabinBags,
          other: "",
        },
      });
      const data = result.data as {
        ok?: boolean;
        needsChoice?: boolean;
        message?: string;
        publicNumber?: string;
        occupiedSeats?: number;
        matches?: typeof matches;
      };
      if (data.needsChoice && data.matches?.length) {
        setMatches(data.matches);
        setStatus(data.message || "There's already a Spires Share journey close to your requested time.");
        return;
      }
      setStatus(
        publicNumber
          ? `Joined departure. Occupancy now ${data.occupiedSeats}. Interest is provisional. No payment taken.`
          : `Proposed ${data.publicNumber || "departure"}. This place is a provisional reservation.`
      );
    });
  };

  if (error && !state) {
    return (
      <div className="card">
        <h3 className="card-title">Spires Share</h3>
        <p className="text-sm" style={{ color: "#b91c1c" }}>{error}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">Loading Spires Share…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Spires Share — Pilot Service</h2>
        <p className="text-sm text-gray-600 mt-1">
          Shared journeys. The live pilot is Oxford to Heathrow Terminal 3. City destination matching is admin only and is not publicly enabled. Hosted payment links are verified by admin. Saving a payment link does not email passengers.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn btn-sm ${view === "board" ? "btn-primary" : ""}`} onClick={() => setView("board")}>Board</button>
        <button type="button" className={`btn btn-sm ${view === "interest" ? "btn-primary" : ""}`} onClick={() => setView("interest")}>Interest</button>
        <button type="button" className={`btn btn-sm ${view === "preview" ? "btn-primary" : ""}`} onClick={() => setView("preview")}>Customer preview</button>
        <button type="button" className={`btn btn-sm ${view === "driver" ? "btn-primary" : ""}`} onClick={() => setView("driver")}>Driver view</button>
        <button type="button" className={`btn btn-sm ${view === "config" ? "btn-primary" : ""}`} onClick={() => setView("config")}>Configuration</button>
        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await runTick({}); setStatus("Deadline tick ran."); })}>
          Run deadline tick
        </button>
      </div>

      {error ? <p className="text-sm" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {status ? <p className="text-sm" style={{ color: "#166534" }}>{status}</p> : null}

      {view === "board" && (
        <div className="space-y-6">
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await adminAction({
                  action: "create-journey",
                  airportId: "heathrow",
                  originLabel: createForm.originLabel,
                  departureLocation: createForm.departureLocation,
                  destinationLabel: createForm.destinationLabel,
                  destinationTerminal: createForm.destinationTerminal,
                  vehicleLabel: createForm.vehicleLabel,
                  travelDate: createForm.travelDate,
                  departureTime: createForm.departureTime,
                  capacity: createForm.capacity,
                  farePence: createForm.farePence,
                  targetRevenuePence: createForm.farePence * createForm.capacity,
                  minPassengerThreshold: createForm.minPassengerThreshold,
                  confirmationDeadlineHoursBeforeDeparture: createForm.confirmationDeadlineHoursBeforeDeparture,
                  notes: createForm.notes,
                  customerVisible: createForm.customerVisible,
                });
                setStatus(createForm.customerVisible ? "Pilot journey created and visible to customers." : "Pilot journey created. It is not visible to customers until you publish it.");
              });
            }}
          >
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Create a pilot journey</h3>
            <p className="text-sm text-gray-600">Create individual departures. This is not a permanent timetable. Customers only see journeys you publish.</p>
            <div className="school-invoice-grid" style={{ marginTop: "1rem" }}>
              <label className="form-group"><span className="form-label">Origin</span><input className="form-input" value={createForm.originLabel} onChange={(e) => setCreateForm({ ...createForm, originLabel: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Departure location</span><input className="form-input" value={createForm.departureLocation} onChange={(e) => setCreateForm({ ...createForm, departureLocation: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Destination</span><input className="form-input" value={createForm.destinationLabel} onChange={(e) => setCreateForm({ ...createForm, destinationLabel: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Date</span><input className="form-input" type="date" required value={createForm.travelDate} onChange={(e) => setCreateForm({ ...createForm, travelDate: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Departure time</span><input className="form-input" type="time" required value={createForm.departureTime} onChange={(e) => setCreateForm({ ...createForm, departureTime: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Capacity</span><input className="form-input" type="number" min="1" max="5" value={createForm.capacity} onChange={(e) => setCreateForm({ ...createForm, capacity: Number(e.target.value) || 5 })} /></label>
              <label className="form-group"><span className="form-label">Standard fare (pence)</span><input className="form-input" type="number" value={createForm.farePence} onChange={(e) => setCreateForm({ ...createForm, farePence: Number(e.target.value) || 3500 })} /></label>
              <label className="form-group"><span className="form-label">Minimum passengers</span><input className="form-input" type="number" value={createForm.minPassengerThreshold} onChange={(e) => setCreateForm({ ...createForm, minPassengerThreshold: Number(e.target.value) || 4 })} /></label>
              <label className="form-group"><span className="form-label">Confirmation deadline (hours before)</span><input className="form-input" type="number" value={createForm.confirmationDeadlineHoursBeforeDeparture} onChange={(e) => setCreateForm({ ...createForm, confirmationDeadlineHoursBeforeDeparture: Number(e.target.value) || 24 })} /></label>
              <label className="form-group"><span className="form-label">Notes</span><input className="form-input" value={createForm.notes} onChange={(e) => setCreateForm({ ...createForm, notes: e.target.value })} /></label>
            </div>
            <p className="text-sm" style={{ marginTop: "0.75rem" }}>Target revenue: {gbp(createForm.farePence * createForm.capacity)}. Vehicle: {createForm.vehicleLabel}.</p>
            <label className="text-sm" style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={createForm.customerVisible} onChange={(e) => setCreateForm({ ...createForm, customerVisible: e.target.checked })} />
              Make this journey visible to customers now
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "1rem" }}>Create journey</button>
          </form>

          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await adminAction({
                  action: "create-city-journey",
                  originCity: cityForm.originCity,
                  destinationCity: cityForm.destinationCity,
                  departureLocation: cityForm.departureLocation,
                  travelDate: cityForm.travelDate,
                  departureTime: cityForm.departureTime,
                  capacity: cityForm.capacity,
                  farePence: cityForm.farePence,
                  targetRevenuePence: cityForm.farePence * cityForm.capacity,
                  minPassengerThreshold: cityForm.minPassengerThreshold,
                  notes: cityForm.notes,
                });
                setStatus("City matching journey created. It is not visible to customers.");
              });
            }}
          >
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Create a city matching journey</h3>
            <p className="text-sm text-gray-600">Admin only. Destination matching is not publicly enabled. Passengers enter an intended destination. Admin chooses a shared drop off hub before payment.</p>
            <div className="school-invoice-grid" style={{ marginTop: "1rem" }}>
              <label className="form-group"><span className="form-label">Origin city</span><input className="form-input" value={cityForm.originCity} onChange={(e) => setCityForm({ ...cityForm, originCity: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Destination city</span><input className="form-input" value={cityForm.destinationCity} onChange={(e) => setCityForm({ ...cityForm, destinationCity: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Departure location</span><input className="form-input" value={cityForm.departureLocation} onChange={(e) => setCityForm({ ...cityForm, departureLocation: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Date</span><input className="form-input" type="date" required value={cityForm.travelDate} onChange={(e) => setCityForm({ ...cityForm, travelDate: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Departure time</span><input className="form-input" type="time" required value={cityForm.departureTime} onChange={(e) => setCityForm({ ...cityForm, departureTime: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Capacity</span><input className="form-input" type="number" min="1" max="5" value={cityForm.capacity} onChange={(e) => setCityForm({ ...cityForm, capacity: Number(e.target.value) || 5 })} /></label>
              <label className="form-group"><span className="form-label">Fare per passenger (pence)</span><input className="form-input" type="number" value={cityForm.farePence} onChange={(e) => setCityForm({ ...cityForm, farePence: Number(e.target.value) || 3500 })} /></label>
              <label className="form-group"><span className="form-label">Minimum passengers</span><input className="form-input" type="number" value={cityForm.minPassengerThreshold} onChange={(e) => setCityForm({ ...cityForm, minPassengerThreshold: Number(e.target.value) || 4 })} /></label>
              <label className="form-group"><span className="form-label">Notes</span><input className="form-input" value={cityForm.notes} onChange={(e) => setCityForm({ ...cityForm, notes: e.target.value })} /></label>
            </div>
            <p className="text-sm" style={{ marginTop: "0.75rem" }}>Target revenue: {gbp(cityForm.farePence * cityForm.capacity)}. Destination matching enabled. Not published to customers.</p>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "1rem" }}>Create city journey</button>
          </form>

          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await adminAction({
                  action: "create-dropoff-hub",
                  name: hubForm.name,
                  city: hubForm.city,
                  displayName: hubForm.displayName || hubForm.name,
                  address: hubForm.address,
                  postcode: hubForm.postcode,
                  enabled: hubForm.enabled,
                });
                setStatus(hubForm.enabled ? "Shared drop off hub created and enabled." : "Shared drop off hub created. Enable it before it can be selected.");
                setHubForm({ ...hubForm, name: "", displayName: "", address: "", postcode: "" });
              });
            }}
          >
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Shared drop off hubs</h3>
            <p className="text-sm text-gray-600">Hubs are not assumed to be legally available stopping locations. Enable each hub explicitly before it can be used.</p>
            <div className="school-invoice-grid" style={{ marginTop: "1rem" }}>
              <label className="form-group"><span className="form-label">Name</span><input className="form-input" required value={hubForm.name} onChange={(e) => setHubForm({ ...hubForm, name: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">City</span><input className="form-input" required value={hubForm.city} onChange={(e) => setHubForm({ ...hubForm, city: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Display name</span><input className="form-input" value={hubForm.displayName} onChange={(e) => setHubForm({ ...hubForm, displayName: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Address</span><input className="form-input" value={hubForm.address} onChange={(e) => setHubForm({ ...hubForm, address: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Postcode</span><input className="form-input" value={hubForm.postcode} onChange={(e) => setHubForm({ ...hubForm, postcode: e.target.value })} /></label>
            </div>
            <label className="text-sm" style={{ display: "flex", gap: 8, marginTop: 8 }}>
              <input type="checkbox" checked={hubForm.enabled} onChange={(e) => setHubForm({ ...hubForm, enabled: e.target.checked })} />
              Enable this hub now
            </label>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "1rem" }}>Create hub</button>
            <ul className="text-sm" style={{ marginTop: "1rem" }}>
              {(state.hubs || []).map((hub) => (
                <li key={hub.id} style={{ padding: "0.35rem 0", display: "flex", gap: 8, alignItems: "center" }}>
                  <span>{hub.displayName || hub.name} · {hub.city} · {hub.enabled ? "enabled" : "disabled"}</span>
                  <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "update-dropoff-hub", hubId: hub.id, enabled: !hub.enabled, name: hub.name, displayName: hub.displayName }); setStatus(hub.enabled ? "Hub disabled." : "Hub enabled."); })}>{hub.enabled ? "Disable" : "Enable"}</button>
                </li>
              ))}
            </ul>
          </form>

          <div className="card">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Journeys</h3>
          {state.journeys.length === 0 ? (
            <p className="text-sm text-gray-500">No pilot journeys yet. Create one above.</p>
          ) : (
            <ul className="space-y-2">
              {state.journeys.map((row) => {
                const journeyBookings = state.bookings.filter((booking) => booking.journeyId === row.id);
                const holding = journeyBookings.filter((booking) => ["PROVISIONAL", "PAYMENT_PENDING", "PAID"].includes(booking.reservationStatus || ""));
                const paidPlaces = journeyBookings
                  .filter((booking) => booking.reservationStatus === "PAID" || booking.hostedPaymentStatus === "PAID")
                  .reduce((sum, booking) => sum + booking.passengers, 0);
                const provisional = holding.filter((booking) => booking.reservationStatus === "PROVISIONAL").reduce((sum, booking) => sum + booking.passengers, 0);
                const pending = holding.filter((booking) => booking.reservationStatus === "PAYMENT_PENDING").reduce((sum, booking) => sum + booking.passengers, 0);
                const received = journeyBookings.reduce((sum, booking) => sum + (booking.paidAmountPence || 0) + (booking.supplementPaidPence || 0), 0);
                const needsLink = row.status === "READY_FOR_PAYMENT_SETUP" && !row.paymentLinkUrl;
                return (
                <li key={row.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.85rem" }}>
                  <div>
                    <p style={{ fontWeight: 700, letterSpacing: "0.04em" }}>{(row.originLabel || row.originCity || "OXFORD").toUpperCase()} → {(row.destinationLabel || row.destinationCity || "HEATHROW T3").toUpperCase()}</p>
                    <p>{row.travelDate} · Departure {row.departureTime}</p>
                    <p>Places: {row.occupiedSeats} / {row.capacity}</p>
                    <p>Provisional: {provisional} · Payment pending: {pending} · Paid: {paidPlaces}</p>
                    <p>Collected: {gbp(received)} · Target: {gbp(row.targetRevenuePence)}</p>
                    <p>STATUS: {row.status.replace(/_/g, " ")}{row.customerVisible ? " · VISIBLE TO CUSTOMERS" : " · HIDDEN FROM CUSTOMERS"}{row.locked ? " · LOCKED" : ""}</p>
                    <p>Payment deadline: {row.paymentDeadlineAt || "not open"}</p>
                    {needsLink ? <p className="text-sm" style={{ color: "#b45309", fontWeight: 700 }}>4 passengers reached — create payment link</p> : null}
                  </div>
                  <div className="flex flex-wrap gap-2" style={{ marginTop: "0.65rem" }}>
                    <button type="button" className="btn btn-sm" onClick={() => { setSelectedId(row.id); }}>{selectedId === row.id ? "Hide details" : "Open journey"}</button>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: row.customerVisible ? "unpublish-journey" : "publish-journey", journeyId: row.id }); setStatus(row.customerVisible ? "Journey hidden from customers." : "Journey is now visible to customers."); })}>{row.customerVisible ? "Hide from customers" : "Make available to customers"}</button>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "offer-four-passenger", journeyId: row.id }); setStatus("Four passenger departure option offered."); })}>Offer four passenger departure</button>
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "cancel", journeyId: row.id }); setStatus("Journey cancelled. Refunds remain admin controlled."); })}>Cancel journey</button>
                  </div>
                  {selectedId === row.id ? (
                    <div style={{ marginTop: "0.75rem" }}>
                      <p className="text-xs text-gray-500">Admin only. Customers never see identities, payment URLs or another passenger's details.</p>
                      {row.destinationMatchingEnabled ? (
                        <div style={{ marginTop: "0.75rem", padding: "0.75rem", background: "#f8fafc", borderRadius: 8 }}>
                          <p style={{ fontWeight: 700 }}>DESTINATION MATCHING</p>
                          <p>{holding.reduce((sum, booking) => sum + booking.passengers, 0)} passengers interested</p>
                          <ul className="text-sm" style={{ marginTop: "0.5rem" }}>
                            {journeyBookings.filter((booking) => ["PROVISIONAL", "PAYMENT_PENDING", "PAID"].includes(booking.reservationStatus || "")).map((booking, index) => (
                              <li key={booking.id}>Passenger {index + 1}: {booking.intendedDestinationText || "Not entered"}{booking.intendedDestinationPostcode ? ` · ${booking.intendedDestinationPostcode}` : ""}</li>
                            ))}
                          </ul>
                          <p style={{ marginTop: "0.5rem" }}>Proposed shared drop off: {row.proposedSharedDropoffDisplayName || "Not selected yet"}</p>
                          <p>Suggested hubs: {row.suggestedSharedDropoffHubId || "Manual review. Distances are not calculated without coordinates."}</p>
                          {row.suggestedSharedDropoffReason ? <p className="text-sm text-gray-600">{row.suggestedSharedDropoffReason}</p> : null}
                          <p>
                            Drop off accepted: {journeyBookings.filter((booking) => booking.sharedDropoffAcceptedAt && booking.acceptedDropoffProposalVersion === row.sharedDropoffProposalVersion).length} / {holding.length}
                            {" "}· Declined: {journeyBookings.filter((booking) => booking.reservationStatus === "DROP_OFF_DECLINED").length}
                            {" "}· Pending: {holding.filter((booking) => !booking.sharedDropoffAcceptedAt || booking.acceptedDropoffProposalVersion !== row.sharedDropoffProposalVersion).length}
                          </p>
                          <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
                            <select className="form-select" value={selectedHubId} onChange={(e) => setSelectedHubId(e.target.value)}>
                              <option value="">Select shared drop off</option>
                              {(state.hubs || []).filter((hub) => hub.enabled).map((hub) => (
                                <option key={hub.id} value={hub.id}>{hub.displayName || hub.name}</option>
                              ))}
                            </select>
                            <button type="button" className="btn btn-primary btn-sm" disabled={busy || !selectedHubId} onClick={() => run(async () => { await adminAction({ action: "set-proposed-dropoff", journeyId: row.id, hubId: selectedHubId }); setStatus("Proposed shared drop off saved. Passengers will be asked to accept it."); })}>Set as proposed drop off</button>
                            <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "notify-dropoff-passengers", journeyId: row.id }); setStatus("Passengers notified to review the proposed drop off."); })}>Notify passengers</button>
                          </div>
                        </div>
                      ) : null}
                      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
                        <input className="form-input" placeholder="https hosted £35 payment link" value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} />
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "set-payment-link", journeyId: row.id, paymentLinkUrl: paymentLink }); setStatus("Payment link saved. Emails were not sent."); })}>Add payment link</button>
                        <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "open-payment-window", journeyId: row.id }); setStatus("Payment window opened. Eligible passengers emailed."); })}>Open payment window</button>
                      </div>
                      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
                        <input className="form-input" placeholder="Payment deadline ISO" value={deadlineValue} onChange={(e) => setDeadlineValue(e.target.value)} />
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "set-payment-deadline", journeyId: row.id, paymentDeadlineAt: deadlineValue }); setStatus("Payment deadline updated."); })}>Change payment deadline</button>
                      </div>
                      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
                        <input className="form-input" placeholder="https supplement £8.75 link" value={supplementLink} onChange={(e) => setSupplementLink(e.target.value)} />
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "set-supplement-link", journeyId: row.id, supplementPaymentLinkUrl: supplementLink }); setStatus("Supplement link saved."); })}>Add supplement link</button>
                      </div>
                      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.5rem" }}>
                        <input className="form-input" placeholder="Journey admin note" value={journeyNote} onChange={(e) => setJourneyNote(e.target.value)} />
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "add-admin-note", journeyId: row.id, adminNotes: journeyNote }); setStatus("Admin note saved."); })}>Add admin note</button>
                      </div>
                      <ul className="text-sm">
                        {journeyBookings.map((booking) => (
                          <li key={booking.id} style={{ padding: "0.45rem 0", borderBottom: "1px solid #f3f4f6" }}>
                            <div>
                              {booking.name} · {booking.email} · {booking.mobile} · {booking.passengers} passengers · {booking.reservationStatus || booking.paymentStatus} · paid {gbp(booking.paidAmountPence || 0)} · four person {booking.fourPassengerAccepted ? "accepted" : "not accepted"} · supplement {gbp(booking.supplementPaidPence || 0)} · refund {booking.refundStatus || "NONE"} · {booking.cancellationCategory || (booking.reservationStatus === "DROP_OFF_DECLINED" ? "drop off declined" : "active")}{row.destinationMatchingEnabled ? ` · intended destination ${booking.intendedDestinationText || "not entered"}` : ""}
                            </div>
                            <span className="flex flex-wrap gap-2" style={{ marginTop: "0.35rem" }}>
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "mark-paid", journeyId: row.id, bookingId: booking.id }); setStatus("Marked paid."); })}>Mark passenger paid</button>
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "undo-payment", journeyId: row.id, bookingId: booking.id }); setStatus("Payment status corrected."); })}>Undo / correct payment</button>
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "mark-supplement-paid", journeyId: row.id, bookingId: booking.id }); setStatus("Supplement marked paid."); })}>Mark supplement paid</button>
                              <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "driver", journeyId: row.id, bookingId: booking.id, boardAction: "NO_SHOW" }); setStatus("Passenger marked no show. Confirmed journeys stay locked."); })}>Mark no show</button>
                              <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "release-booking", journeyId: row.id, bookingId: booking.id }); setStatus("Reservation released. Waitlist will be offered if a place is available."); })}>Release reservation</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div style={{ marginTop: "0.85rem" }}>
                        <p style={{ fontWeight: 700 }}>Waitlist</p>
                        <p className="text-xs text-gray-500">Customers never see other people in this queue. Order is by joined time.</p>
                        {state.waitlist.filter((item) => item.journeyId === row.id).length === 0 ? (
                          <p className="text-sm text-gray-500">No waitlist entries.</p>
                        ) : (
                          <ol className="text-sm" style={{ marginTop: "0.35rem", paddingLeft: "1.1rem" }}>
                            {state.waitlist.filter((item) => item.journeyId === row.id).map((item, index) => (
                              <li key={item.id} style={{ padding: "0.25rem 0" }}>
                                {index + 1}. {item.name || "Passenger"} · {item.email || ""} · {item.passengers} seats · {item.status} · joined {item.joinedWaitlistAt || item.createdAt || "—"}
                                {item.offerExpiresAt ? ` · offer deadline ${item.offerExpiresAt}` : ""}
                                {item.claimedAt ? ` · claimed ${item.claimedAt}` : ""}
                                {item.declinedAt ? ` · declined ${item.declinedAt}` : ""}
                              </li>
                            ))}
                          </ol>
                        )}
                        <button type="button" className="btn btn-sm" style={{ marginTop: "0.5rem" }} disabled={busy} onClick={() => run(async () => { await adminAction({ action: "offer-waitlist", journeyId: row.id }); setStatus("Waitlist offer sent if a place was available."); })}>Offer next waitlist place</button>
                      </div>
                      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.75rem" }}>
                        <select className="form-select" value={refundDraft.bookingId} onChange={(e) => setRefundDraft({ ...refundDraft, bookingId: e.target.value })}>
                          <option value="">Record refund for…</option>
                          {journeyBookings.map((booking) => (
                            <option key={booking.id} value={booking.id}>{booking.name}</option>
                          ))}
                        </select>
                        <select className="form-select" value={refundDraft.refundStatus} onChange={(e) => setRefundDraft({ ...refundDraft, refundStatus: e.target.value })}>
                          <option value="PENDING">PENDING</option>
                          <option value="REFUNDED">REFUNDED</option>
                          <option value="RETAINED">RETAINED</option>
                          <option value="PARTIAL">PARTIAL</option>
                          <option value="NONE">NONE</option>
                        </select>
                        <input className="form-input" placeholder="Refunded pence" value={refundDraft.amountRefundedPence} onChange={(e) => setRefundDraft({ ...refundDraft, amountRefundedPence: e.target.value })} />
                        <input className="form-input" placeholder="Retained pence" value={refundDraft.amountRetainedPence} onChange={(e) => setRefundDraft({ ...refundDraft, amountRetainedPence: e.target.value })} />
                        <input className="form-input" placeholder="Refund notes" value={refundDraft.adminNotes} onChange={(e) => setRefundDraft({ ...refundDraft, adminNotes: e.target.value })} />
                        <button type="button" className="btn btn-sm" disabled={busy || !refundDraft.bookingId} onClick={() => run(async () => { await adminAction({ action: "record-refund", journeyId: row.id, bookingId: refundDraft.bookingId, refundStatus: refundDraft.refundStatus, amountRefundedPence: Number(refundDraft.amountRefundedPence) || 0, amountRetainedPence: Number(refundDraft.amountRetainedPence) || 0, adminNotes: refundDraft.adminNotes }); setStatus("Refund record saved."); })}>Record refund</button>
                      </div>
                    </div>
                  ) : null}
                </li>
                );
              })}
            </ul>
          )}
          </div>
        </div>
      )}

      {view === "interest" && (
        <div className="space-y-6">
          <div className="card">
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Active interest groups</h3>
            <p className="text-sm text-gray-600">Demand is grouped before a journey exists. Propose an exact departure, then passengers must accept it. Private destinations stay on this admin view only.</p>
            {(state.interestGroups || []).length === 0 ? (
              <p className="text-sm text-gray-500" style={{ marginTop: "1rem" }}>No interest groups yet.</p>
            ) : (
              <ul className="space-y-2" style={{ marginTop: "1rem" }}>
                {(state.interestGroups || []).map((group) => (
                  <li key={group.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.85rem" }}>
                    <strong>{group.origin} → {group.destinationRegion}</strong>
                    <p className="text-sm">{group.travelDate} · {group.timeWindowStart} to {group.timeWindowEnd} · {group.interestedSeatCount} interested · {group.status}{group.matchingUncertain ? " · needs review" : ""}</p>
                    {group.destinationSpread && group.destinationSpread.some((row) => row.intendedDestinationText) ? (
                      <div className="text-sm" style={{ marginTop: "0.5rem" }}>
                        <p style={{ fontWeight: 700 }}>Private destination spread</p>
                        <ul>
                          {group.destinationSpread.map((row) => (
                            <li key={row.index}>Passenger {row.index}: {row.intendedDestinationText || "not entered"} · {row.timeWindowStart} to {row.timeWindowEnd}</li>
                          ))}
                        </ul>
                      </div>
                    ) : null}
                    <div className="flex flex-wrap gap-2" style={{ marginTop: "0.65rem" }}>
                      <button type="button" className="btn btn-sm" onClick={() => setProposeForm({ ...proposeForm, interestGroupId: group.id })}>Review</button>
                      <button type="button" className="btn btn-danger btn-sm" disabled={busy || group.status === "CONVERTED_TO_JOURNEY"} onClick={() => run(async () => { await adminAction({ action: "close-interest", interestGroupId: group.id }); setStatus("Interest group closed."); })}>Close interest group</button>
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </div>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await adminAction({
                  action: "propose-from-interest",
                  interestGroupId: proposeForm.interestGroupId,
                  departureLocation: proposeForm.departureLocation,
                  departureTime: proposeForm.departureTime,
                  farePence: proposeForm.farePence,
                  capacity: proposeForm.capacity,
                  hubId: proposeForm.hubId,
                  notes: proposeForm.notes,
                });
                setStatus("Journey proposed from interest. Passengers must accept the exact departure. No payment has been taken.");
              });
            }}
          >
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Propose journey from interest</h3>
            <div className="school-invoice-grid" style={{ marginTop: "1rem" }}>
              <label className="form-group">
                <span className="form-label">Interest group</span>
                <select className="form-select" required value={proposeForm.interestGroupId} onChange={(e) => setProposeForm({ ...proposeForm, interestGroupId: e.target.value })}>
                  <option value="">Select</option>
                  {(state.interestGroups || []).filter((row) => row.status === "GATHERING_INTEREST" || row.status === "READY_FOR_REVIEW").map((row) => (
                    <option key={row.id} value={row.id}>{row.origin} → {row.destinationRegion} · {row.travelDate} · {row.interestedSeatCount} interested</option>
                  ))}
                </select>
              </label>
              <label className="form-group"><span className="form-label">Exact departure location</span><input className="form-input" required value={proposeForm.departureLocation} onChange={(e) => setProposeForm({ ...proposeForm, departureLocation: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Exact departure time</span><input className="form-input" type="time" required value={proposeForm.departureTime} onChange={(e) => setProposeForm({ ...proposeForm, departureTime: e.target.value })} /></label>
              <label className="form-group"><span className="form-label">Fare per passenger (pence)</span><input className="form-input" type="number" value={proposeForm.farePence} onChange={(e) => setProposeForm({ ...proposeForm, farePence: Number(e.target.value) || 3500 })} /></label>
              <label className="form-group"><span className="form-label">Capacity</span><input className="form-input" type="number" min="1" max="5" value={proposeForm.capacity} onChange={(e) => setProposeForm({ ...proposeForm, capacity: Number(e.target.value) || 5 })} /></label>
              <label className="form-group">
                <span className="form-label">Shared drop off hub (city only, optional)</span>
                <select className="form-select" value={proposeForm.hubId} onChange={(e) => setProposeForm({ ...proposeForm, hubId: e.target.value })}>
                  <option value="">None yet</option>
                  {(state.hubs || []).filter((hub) => hub.enabled).map((hub) => (
                    <option key={hub.id} value={hub.id}>{hub.displayName || hub.name}</option>
                  ))}
                </select>
              </label>
              <label className="form-group"><span className="form-label">Notes</span><input className="form-input" value={proposeForm.notes} onChange={(e) => setProposeForm({ ...proposeForm, notes: e.target.value })} /></label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "1rem" }}>Propose journey</button>
          </form>
          <form
            className="card"
            onSubmit={(e) => {
              e.preventDefault();
              run(async () => {
                await adminAction({
                  action: "merge-interest",
                  interestGroupId: proposeForm.interestGroupId,
                  targetInterestGroupId: proposeForm.mergeTargetId,
                });
                setStatus("Compatible interest groups merged.");
              });
            }}
          >
            <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Merge compatible groups</h3>
            <div className="school-invoice-grid" style={{ marginTop: "1rem" }}>
              <label className="form-group">
                <span className="form-label">Source group</span>
                <select className="form-select" required value={proposeForm.interestGroupId} onChange={(e) => setProposeForm({ ...proposeForm, interestGroupId: e.target.value })}>
                  <option value="">Select</option>
                  {(state.interestGroups || []).map((row) => (
                    <option key={row.id} value={row.id}>{row.origin} → {row.destinationRegion} · {row.travelDate}</option>
                  ))}
                </select>
              </label>
              <label className="form-group">
                <span className="form-label">Merge into</span>
                <select className="form-select" required value={proposeForm.mergeTargetId} onChange={(e) => setProposeForm({ ...proposeForm, mergeTargetId: e.target.value })}>
                  <option value="">Select</option>
                  {(state.interestGroups || []).filter((row) => row.id !== proposeForm.interestGroupId).map((row) => (
                    <option key={row.id} value={row.id}>{row.origin} → {row.destinationRegion} · {row.travelDate}</option>
                  ))}
                </select>
              </label>
            </div>
            <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "1rem" }}>Merge groups</button>
          </form>
        </div>
      )}

      {view === "preview" && (
        <form className="card" onSubmit={handleSearch}>
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Customer preview</h3>
          <p className="text-sm text-gray-600" style={{ marginBottom: "1rem" }}>
            This is not a public booking page. It is only visible to signed-in admins. Proposed journeys are not guaranteed.
          </p>
          <div className="school-invoice-grid">
            <label className="form-group">
              <span className="form-label">Airport</span>
              <select className="form-select" value="heathrow" disabled>
                <option value="heathrow">Heathrow ({gbp(state.config.airports.find((row) => row.id === "heathrow")?.farePence || 3500)} per passenger)</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Travel date</span>
              <input className="form-input" type="date" value={preview.travelDate} onChange={(e) => setPreview({ ...preview, travelDate: e.target.value })} required />
            </label>
            <label className="form-group">
              <span className="form-label">Preferred Thornhill departure</span>
              <input className="form-input" type="time" value={preview.preferredDepartureTime} onChange={(e) => setPreview({ ...preview, preferredDepartureTime: e.target.value })} required />
            </label>
            <label className="form-group">
              <span className="form-label">Flexibility</span>
              <select className="form-select" value={preview.flexibility} onChange={(e) => setPreview({ ...preview, flexibility: e.target.value })}>
                <option value="exact">Exact</option>
                <option value="plus_minus_15">+/- 15 minutes</option>
                <option value="plus_minus_30">+/- 30 minutes</option>
                <option value="plus_minus_60">+/- 60 minutes</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Flight departure (optional)</span>
              <input className="form-input" type="time" value={preview.flightDepartureTime} onChange={(e) => setPreview({ ...preview, flightDepartureTime: e.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Flight number (optional)</span>
              <input className="form-input" value={preview.flightNumber} onChange={(e) => setPreview({ ...preview, flightNumber: e.target.value })} />
            </label>
            <label className="form-group">
              <span className="form-label">Passengers</span>
              <input className="form-input" type="number" min="1" value={preview.passengers} onChange={(e) => setPreview({ ...preview, passengers: Number(e.target.value) || 1 })} />
            </label>
            <label className="form-group">
              <span className="form-label">Large suitcases</span>
              <input className="form-input" type="number" min="0" value={preview.largeSuitcases} onChange={(e) => setPreview({ ...preview, largeSuitcases: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">Cabin bags</span>
              <input className="form-input" type="number" min="0" value={preview.cabinBags} onChange={(e) => setPreview({ ...preview, cabinBags: Number(e.target.value) || 0 })} />
            </label>
            <label className="form-group">
              <span className="form-label">Heathrow terminal</span>
              <select className="form-select" value={preview.dropoffTerminal} onChange={(e) => setPreview({ ...preview, dropoffTerminal: e.target.value })}>
                <option value="T2">Terminal 2</option>
                <option value="T3">Terminal 3</option>
                <option value="T4">Terminal 4</option>
                <option value="T5">Terminal 5</option>
              </select>
            </label>
            <label className="form-group">
              <span className="form-label">Name</span>
              <input className="form-input" value={preview.name} onChange={(e) => setPreview({ ...preview, name: e.target.value })} required />
            </label>
            <label className="form-group">
              <span className="form-label">Mobile</span>
              <input className="form-input" value={preview.mobile} onChange={(e) => setPreview({ ...preview, mobile: e.target.value })} required />
            </label>
            <label className="form-group">
              <span className="form-label">Email</span>
              <input className="form-input" type="email" value={preview.email} onChange={(e) => setPreview({ ...preview, email: e.target.value })} required />
            </label>
          </div>
          <p className="text-sm text-gray-600">Home collection is not offered on the Heathrow MVP. Gatwick remains in configuration only.</p>
          <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>Search existing journeys</button>
            <button type="button" className="btn" disabled={busy} onClick={() => handlePropose()}>Propose new journey</button>
            <button type="button" className="btn" disabled={busy} onClick={() => handlePropose(undefined, true)}>Propose anyway (dev)</button>
          </div>
          {matches.length > 0 && (
            <ul className="space-y-2" style={{ marginTop: "1rem" }}>
              {matches.map((row) => (
                <li key={row.publicNumber} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                  <div>
                    {row.departureTime} · {row.occupiedSeats}/{row.capacity || 5} reserved · {row.remainingSeats} places remaining · {gbp(row.farePence)} per passenger · {row.guarantee || "PROVISIONAL"}
                  </div>
                  {row.warning ? <div className="text-xs text-gray-500">{row.warning}</div> : null}
                  {row.remainingSeats > 0 ? (
                    <button type="button" className="btn btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => handlePropose(row.publicNumber)}>Join this departure</button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => run(async () => {
                        const journeyId = state.journeys.find((item) => item.publicNumber === row.publicNumber)?.id;
                        if (!journeyId) return;
                        await adminAction({
                          action: "waitlist",
                          journeyId,
                          passengers: preview.passengers,
                          name: preview.name,
                          email: preview.email,
                        });
                        setStatus("Added to waitlist. Place is not secured and has not been charged.");
                      })}
                    >
                      Join waitlist
                    </button>
                  )}
                </li>
              ))}
            </ul>
          )}
        </form>
      )}

      {view === "driver" && (
        <div className="card">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Driver view</h3>
          <label className="form-group">
            <span className="form-label">Journey</span>
            <select className="form-select" value={selectedId} onChange={(e) => setSelectedId(e.target.value)}>
              <option value="">Select a journey</option>
              {state.journeys.map((row) => (
                <option key={row.id} value={row.id}>{row.publicNumber} · {row.departureTime} · {row.occupiedSeats}/{row.capacity}</option>
              ))}
            </select>
          </label>
          {selected ? (
            <div style={{ marginTop: "1rem" }}>
              <p>
                <strong>{selected.publicNumber}</strong> · Thornhill → {selected.airportId} · {selected.departureTime} · {selected.occupiedSeats} passengers
              </p>
              <ul className="space-y-2" style={{ marginTop: "0.75rem" }}>
                {selectedBookings.map((row, index) => (
                  <li key={row.id} className="flex items-center justify-between gap-3" style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                    <div>
                      Passenger {index + 1} · {(row.name || "Passenger").trim().split(/\s+/)[0]} · {row.passengers} pax · {row.boardStatus}
                      {row.earlyDepartureAccepted ? " · early departure accepted" : ""}
                    </div>
                    <div className="flex gap-2">
                      {(["CHECKED_IN", "BOARDED", "NO_SHOW"] as const).map((boardAction) => (
                        <button
                          key={boardAction}
                          type="button"
                          className="btn btn-sm"
                          disabled={busy}
                          onClick={() => run(async () => { await adminAction({ action: "driver", journeyId: selected.id, bookingId: row.id, boardAction }); })}
                        >
                          {boardAction.replace("_", " ")}
                        </button>
                      ))}
                      <button
                        type="button"
                        className="btn btn-sm"
                        disabled={busy}
                        onClick={() => run(async () => { await adminAction({ action: "accept-early-departure", journeyId: selected.id, bookingId: row.id }); setStatus("Early departure acceptance recorded."); })}
                      >
                        Accept early fare
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              <div className="flex gap-2" style={{ marginTop: "1rem" }}>
                {(["DEPARTED", "ARRIVED", "COMPLETED"] as const).map((boardAction) => (
                  <button key={boardAction} type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "driver", journeyId: selected.id, boardAction }); })}>
                    {boardAction}
                  </button>
                ))}
              </div>
            </div>
          ) : null}
        </div>
      )}

      {view === "config" && (
        <form
          className="card"
          onSubmit={(e) => {
            e.preventDefault();
            run(async () => {
              await saveConfig({ config: state.config });
              setStatus("Configuration saved. Public launch remains disabled.");
            });
          }}
        >
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Configuration (requires approval)</h3>
          <p className="text-sm text-gray-600">Public enabled stays false until council and payment decisions are made.</p>
          <div className="school-invoice-grid" style={{ marginTop: "1rem" }}>
            <label className="form-group">
              <span className="form-label">Passenger capacity</span>
              <input className="form-input" type="number" value={state.config.passengerCapacity} onChange={(e) => setState({ ...state, config: { ...state.config, passengerCapacity: Number(e.target.value) || 5 } })} />
            </label>
            <label className="form-group">
              <span className="form-label">Early departure threshold</span>
              <input className="form-input" type="number" value={state.config.earlyDepartureThreshold} onChange={(e) => setState({ ...state, config: { ...state.config, earlyDepartureThreshold: Number(e.target.value) || 4 } })} />
            </label>
            <label className="form-group">
              <span className="form-label">Max home collections</span>
              <input className="form-input" type="number" value={state.config.maxHomeCollectionsPerJourney} onChange={(e) => setState({ ...state, config: { ...state.config, maxHomeCollectionsPerJourney: Number(e.target.value) || 0 } })} />
            </label>
            <label className="form-group">
              <span className="form-label">Confirmation deadline (hours before)</span>
              <input className="form-input" type="number" value={state.config.confirmationDeadlineHoursBeforeDeparture} onChange={(e) => setState({ ...state, config: { ...state.config, confirmationDeadlineHoursBeforeDeparture: Number(e.target.value) || 24 } })} />
            </label>
          </div>
          <button type="submit" className="btn btn-primary" disabled={busy} style={{ marginTop: "1rem" }}>Save configuration</button>
          <div style={{ marginTop: "1.25rem" }}>
            <h4 className="text-sm font-bold">Audit</h4>
            <ul className="text-xs text-gray-600">
              {state.audit.slice(0, 20).map((row) => (
                <li key={row.id}>{row.type}{row.actorEmail ? ` · ${row.actorEmail}` : ""}</li>
              ))}
            </ul>
            <h4 className="text-sm font-bold" style={{ marginTop: "1rem" }}>Notifications (dry run unless SHARE_NOTIFICATIONS_SEND=true)</h4>
            <ul className="text-xs text-gray-600">
              {(state.notifications || []).slice(0, 20).map((row) => (
                <li key={row.id}>{row.type} · {row.status || (row.dryRun ? "DRY_RUN" : "")} · {row.to}</li>
              ))}
            </ul>
          </div>
        </form>
      )}
    </div>
  );
};

export default SpiresShareAdmin;
