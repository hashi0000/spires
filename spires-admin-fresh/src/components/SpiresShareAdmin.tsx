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
  }>;
  bookings: Array<{
    id: string;
    journeyId: string;
    passengers: number;
    name: string;
    email: string;
    mobile: string;
    paymentStatus: string;
    boardStatus: string;
    earlyDepartureAccepted: boolean;
  }>;
  waitlist: Array<{ id: string; journeyId: string; status: string; passengers: number }>;
  audit: Array<{ id: string; type: string; actorEmail?: string }>;
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
  const [view, setView] = useState<"board" | "preview" | "driver" | "config">("board");
  const [selectedId, setSelectedId] = useState("");
  const [preview, setPreview] = useState({
    airportId: "heathrow",
    travelDate: "",
    preferredDepartureTime: "10:15",
    flexibility: "plus_minus_30",
    flightDepartureTime: "",
    flightNumber: "",
    passengers: 1,
    largeSuitcases: 1,
    cabinBags: 1,
    homePostcode: "",
    name: "",
    mobile: "",
    email: "",
  });
  const [moveTarget, setMoveTarget] = useState("");
  const [matches, setMatches] = useState<Array<{ id: string; departureTime: string; occupiedSeats: number; remainingSeats: number; capacity?: number; farePence: number; warning?: string }>>([]);
  const [homeMessage, setHomeMessage] = useState("");

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
      const result = await searchFn(preview);
      const data = result.data as { matches: typeof matches; homeCollection?: { message: string } };
      setMatches(data.matches || []);
      setHomeMessage(data.homeCollection?.message || "");
      setStatus(
        data.matches?.length
          ? "There's already a Spires Share journey close to your requested time."
          : "No matching journey. You can propose one."
      );
    });
  };

  const handlePropose = async (journeyId?: string, forcePropose = false) => {
    await run(async () => {
      const result = await proposeOrJoin({
        action: journeyId ? "join" : "propose",
        journeyId,
        forcePropose,
        ...preview,
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
        journeyId
          ? `Joined journey. Occupancy now ${data.occupiedSeats}. This is mock payment only.`
          : `Proposed ${data.publicNumber || "journey"}. This journey is not yet confirmed.`
      );
    });
  };

  if (error && !state) {
    return (
      <div className="card">
        <h3 className="card-title">Spires Share (development)</h3>
        <p className="text-sm" style={{ color: "#b91c1c" }}>{error}</p>
      </div>
    );
  }

  if (!state) {
    return (
      <div className="card">
        <p className="text-sm text-gray-600">Loading Spires Share development data…</p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-2xl font-bold text-gray-900">Spires Share (development only)</h2>
        <p className="text-sm text-gray-600 mt-1">
          Hidden admin workspace. Public launch is off (`SPIRES_SHARE_ENABLED=false`). No real payments. Do not advertise this service.
        </p>
      </div>

      <div className="flex flex-wrap gap-2">
        <button type="button" className={`btn btn-sm ${view === "board" ? "btn-primary" : ""}`} onClick={() => setView("board")}>Board</button>
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
        <div className="card">
          <h3 className="card-title" style={{ fontSize: "1.15rem" }}>Journeys</h3>
          {state.journeys.length === 0 ? (
            <p className="text-sm text-gray-500">No development journeys yet. Use Customer preview to propose one.</p>
          ) : (
            <ul className="space-y-2">
              {state.journeys.map((row) => {
                const journeyBookings = state.bookings.filter((booking) => booking.journeyId === row.id);
                const secured = journeyBookings
                  .filter((booking) => ["AUTHORISED", "CAPTURE_PENDING", "CAPTURED"].includes(booking.paymentStatus))
                  .reduce((sum, booking) => sum + booking.passengers * row.farePence, 0);
                const captured = journeyBookings
                  .filter((booking) => booking.paymentStatus === "CAPTURED")
                  .reduce((sum, booking) => sum + booking.passengers * row.farePence, 0);
                return (
                <li key={row.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                  <div className="flex items-center justify-between gap-3">
                  <div>
                    <strong>{row.publicNumber}</strong>
                    {" · "}
                    {row.airportId}
                    {" "}
                    {row.travelDate}
                    {" "}
                    {row.departureTime}
                    {" · "}
                    {row.occupiedSeats}/{row.capacity}
                    {" · "}
                    {row.status}
                    {" · "}
                    {gbp(secured)} secured (mock)
                    {" · "}
                    {gbp(captured)} captured (mock)
                    {row.homeCollectionCount ? ` · home collections ${row.homeCollectionCount}` : ""}
                    {row.waitlistCount ? ` · waitlist ${row.waitlistCount}` : ""}
                  </div>
                  <div className="flex gap-2">
                    <button type="button" className="btn btn-sm" onClick={() => { setSelectedId(row.id); }}>Inspect</button>
                    <button type="button" className="btn btn-sm" onClick={() => { setSelectedId(row.id); setView("driver"); }}>Driver</button>
                    <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "offer-early-departure", journeyId: row.id }); setStatus("Early departure offered. All passengers must accept the new equal-split fare."); })}>Offer 4/5</button>
                    <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "confirm", journeyId: row.id }); setStatus("Journey confirmed (mock capture only)."); })}>Confirm</button>
                    <button type="button" className="btn btn-danger btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "cancel", journeyId: row.id }); setStatus("Journey cancelled; mock authorisations released."); })}>Cancel</button>
                  </div>
                  </div>
                  {selectedId === row.id ? (
                    <div style={{ marginTop: "0.75rem" }}>
                      <p className="text-xs text-gray-500">Admin-only booking inspect. Customers never see this data.</p>
                      <ul className="text-sm">
                        {journeyBookings.map((booking) => (
                          <li key={booking.id} className="flex items-center justify-between gap-2" style={{ padding: "0.35rem 0" }}>
                            <span>
                              {booking.name} · {booking.passengers} pax · {booking.paymentStatus} · {booking.boardStatus}
                              {booking.earlyDepartureAccepted ? " · early accepted" : ""}
                            </span>
                            <span className="flex gap-2">
                              <select className="form-select" value={moveTarget} onChange={(e) => setMoveTarget(e.target.value)}>
                                <option value="">Move to…</option>
                                {state.journeys.filter((other) => other.id !== row.id && other.airportId === row.airportId && other.travelDate === row.travelDate).map((other) => (
                                  <option key={other.id} value={other.id}>{other.publicNumber} {other.departureTime} {other.occupiedSeats}/{other.capacity}</option>
                                ))}
                              </select>
                              <button type="button" className="btn btn-sm" disabled={busy || !moveTarget} onClick={() => run(async () => { await adminAction({ action: "move-booking", journeyId: row.id, bookingId: booking.id, targetJourneyId: moveTarget }); setStatus("Passenger moved."); })}>Move</button>
                            </span>
                          </li>
                        ))}
                      </ul>
                      <div className="flex gap-2" style={{ marginTop: "0.5rem" }}>
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "waitlist", journeyId: row.id, passengers: preview.passengers, name: preview.name, email: preview.email }); setStatus("Added to waitlist."); })}>Add waitlist test entry</button>
                        <button type="button" className="btn btn-sm" disabled={busy} onClick={() => run(async () => { await adminAction({ action: "offer-waitlist", journeyId: row.id }); setStatus("Waitlist offer created."); })}>Offer next waitlist seat</button>
                      </div>
                    </div>
                  ) : null}
                </li>
                );
              })}
            </ul>
          )}
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
              <select className="form-select" value={preview.airportId} onChange={(e) => setPreview({ ...preview, airportId: e.target.value })}>
                {state.config.airports.map((airport) => (
                  <option key={airport.id} value={airport.id}>{airport.name} ({gbp(airport.farePence)})</option>
                ))}
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
              <span className="form-label">Home postcode (optional)</span>
              <input className="form-input" value={preview.homePostcode} onChange={(e) => setPreview({ ...preview, homePostcode: e.target.value })} />
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
          {homeMessage ? <p className="text-sm text-gray-600">{homeMessage}</p> : null}
          <div className="flex flex-wrap gap-2" style={{ marginTop: "1rem" }}>
            <button type="submit" className="btn btn-primary" disabled={busy}>Search existing journeys</button>
            <button type="button" className="btn" disabled={busy} onClick={() => handlePropose()}>Propose new journey</button>
            <button type="button" className="btn" disabled={busy} onClick={() => handlePropose(undefined, true)}>Propose anyway (dev)</button>
          </div>
          {matches.length > 0 && (
            <ul className="space-y-2" style={{ marginTop: "1rem" }}>
              {matches.map((row) => (
                <li key={row.id} style={{ border: "1px solid #e5e7eb", borderRadius: 8, padding: "0.65rem 0.85rem" }}>
                  <div>
                    {row.departureTime} · {row.occupiedSeats}/{row.capacity || 5} booked · {row.remainingSeats} seats remaining · {gbp(row.farePence)} per passenger
                  </div>
                  {row.warning ? <div className="text-xs text-gray-500">{row.warning}</div> : null}
                  {row.remainingSeats > 0 ? (
                    <button type="button" className="btn btn-sm" style={{ marginTop: "0.5rem" }} onClick={() => handlePropose(row.id)}>Join this journey</button>
                  ) : (
                    <button
                      type="button"
                      className="btn btn-sm"
                      style={{ marginTop: "0.5rem" }}
                      onClick={() => run(async () => {
                        await adminAction({
                          action: "waitlist",
                          journeyId: row.id,
                          passengers: preview.passengers,
                          name: preview.name,
                          email: preview.email,
                        });
                        setStatus("Added to waitlist. Seat is not secured.");
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
          </div>
        </form>
      )}
    </div>
  );
};

export default SpiresShareAdmin;
