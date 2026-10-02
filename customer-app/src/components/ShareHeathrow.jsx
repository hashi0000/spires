import React, { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

function gbp(pence) {
  return `£${(Number(pence || 0) / 100).toFixed(2)}`;
}

function newKey() {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

function formatDeadline(iso) {
  if (!iso) return "";
  try {
    return new Intl.DateTimeFormat("en-GB", {
      timeZone: "Europe/London",
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}

function formatDate(isoDate) {
  const [y, m, d] = String(isoDate || "").split("-").map(Number);
  if (!y) return isoDate;
  return new Date(Date.UTC(y, m - 1, d)).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "UTC",
  });
}

export default function ShareHeathrow() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [available, setAvailable] = useState([]);
  const [interestGroups, setInterestGroups] = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [myInterest, setMyInterest] = useState([]);
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(params.get("publicNumber") || "");
  const [showRequest, setShowRequest] = useState(params.get("request") === "1" || Boolean(params.get("interest")));
  const [joinInterestNumber, setJoinInterestNumber] = useState(params.get("interest") || "");
  const [form, setForm] = useState({
    passengers: Number(params.get("passengers") || 1),
    largeSuitcases: 1,
    cabinBags: 1,
    dropoffTerminal: "T3",
    flightNumber: "",
    flightDepartureTime: "",
    name: "",
    mobile: "",
    email: "",
    intendedDestinationText: "",
    intendedDestinationPostcode: "",
    sharedDropoffAcknowledged: false,
  });
  const [interestForm, setInterestForm] = useState({
    origin: params.get("origin") || "Oxford",
    destinationRegion: params.get("destination") || "London",
    travelDate: params.get("travelDate") || "",
    preferredDepartureTime: params.get("preferredDepartureTime") || "10:00",
    flexibility: "plus_minus_30",
    passengers: Number(params.get("passengers") || 1),
    intendedDestinationText: "",
    intendedDestinationPostcode: "",
    sharedDropoffAcknowledged: false,
  });

  const loadDashboard = async () => {
    const fn = httpsCallable(functions, "spiresShareGetMyBookings");
    const result = await fn({});
    setDashboard(result.data?.bookings || []);
    setMyInterest(result.data?.interest || []);
    setMyWaitlist(result.data?.waitlist || []);
  };

  const loadJourneys = async () => {
    const fn = httpsCallable(functions, "spiresShareListDepartures");
    const result = await fn({ airportId: "heathrow" });
    setAvailable(result.data?.journeys || []);
    setInterestGroups(result.data?.interestGroups || []);
  };

  useEffect(() => {
    const sessionFn = httpsCallable(functions, "spiresShareSession");
    sessionFn({})
      .then((result) => setSession(result.data))
      .catch(() => setSession({ available: false }));
  }, []);

  useEffect(() => {
    if (!session?.available) return;
    loadDashboard().catch(() => undefined);
    loadJourneys().catch(() => undefined);
  }, [session]);

  const call = async (name, payload) => {
    const fn = httpsCallable(functions, name);
    const result = await fn(payload);
    return result.data;
  };

  const run = async (fn) => {
    setBusy(true);
    setError("");
    setStatus("");
    try {
      await fn();
    } catch (err) {
      setError(err.message || "Spires Share is not available.");
    } finally {
      setBusy(false);
    }
  };

  if (!session) {
    return <div className="empty-state"><p>Checking Spires Share…</p></div>;
  }

  if (!session.available) {
    return (
      <section className="share-app-panel">
        <h3>Spires Share — Pilot Service</h3>
        <p>Spires Share is not currently available on this account.</p>
        <p>Your ordinary private hire bookings are unchanged.</p>
      </section>
    );
  }

  const selected = available.find((row) => row.publicNumber === selectedNumber) || available[0] || null;
  const farePence = session.farePence || 3500;

  return (
    <section className="share-app-panel">
      <p className="share-pilot-kicker">Spires Share Pilot</p>
      <h3>Spires Share — Pilot Service</h3>
      <p className="share-app-note">We're currently trialling our shared Oxford to Heathrow transfer service on selected departures. This is a direct shared airport transfer, not a bus, coach or scheduled public transport service.</p>
      <p className="share-app-note">Registering interest does not confirm your journey and no payment is taken at this stage.</p>
      {error ? <p className="share-app-error">{error}</p> : null}
      {status ? <p className="share-app-status">{status}</p> : null}

      {dashboard.map((row) => (
        <article key={row.bookingId} className="share-dash-card">
          <p className="share-dash-kicker">{row.originLabel || "Oxford"} → {row.destinationLabel || (row.destinationMatchingEnabled ? row.destinationCity || "shared destination" : "Heathrow Airport Terminal 3")}</p>
          <h4>{formatDate(row.travelDate)}</h4>
          <dl className="share-dash-grid">
            <div><dt>Departure time</dt><dd>{row.departureTime}</dd></div>
            {row.destinationMatchingEnabled ? (
              <>
                <div><dt>Your intended destination</dt><dd>{row.intendedDestinationText || "Not entered"}</dd></div>
                <div><dt>Shared drop off</dt><dd>{row.proposedSharedDropoffDisplayName || "Not selected yet"}</dd></div>
              </>
            ) : (
              <div><dt>Recommended arrival</dt><dd>{row.recommendedArrivalTime}</dd></div>
            )}
            <div><dt>Your status</dt><dd>{row.customerStatusLabel || (row.journeyStatus === "CONFIRMED" ? "Journey confirmed" : "Provisional place")}</dd></div>
            <div><dt>Places reserved</dt><dd>{row.occupiedSeats} of {row.capacity}</dd></div>
            <div><dt>Paid passengers</dt><dd>{row.paidPassengerPlaces} of {row.requiredPaidPlaces}</dd></div>
            <div><dt>Your payment</dt><dd>{row.hostedPaymentStatus === "PAID" ? `Payment received · ${gbp(row.paidAmountPence)}` : row.reservationStatus === "PAYMENT_PENDING" ? `Payment required · ${gbp(row.amountDuePence)}` : "No payment required yet"}</dd></div>
          </dl>
          {row.journeyStatus === "CONFIRMED" ? (
            <p className="share-app-status">{row.confirmedNotice || "Your airport transfer is now confirmed."}</p>
          ) : (
            <p className="share-app-note">{row.customerStatusLabel === "Payment received — awaiting journey confirmation" ? "Payment received — awaiting journey confirmation. This does not mean the journey is confirmed." : "Your place is currently provisional. We will contact you when enough passengers have registered and payment opens."}</p>
          )}
          {row.paymentDeadlineAt && row.hostedPaymentStatus !== "PAID" ? (
            <p className="share-deadline">Pay by {formatDeadline(row.paymentDeadlineAt)}</p>
          ) : null}
          {row.fillNotice ? <p className="share-app-note">{row.fillNotice}</p> : null}
          <p className="share-strict">Please arrive at least 15 minutes before departure. The vehicle leaves at the stated departure time. A short grace period of up to five minutes may be possible at the driver's discretion, but this is not guaranteed. Passengers should not rely on this.</p>
          {row.warning ? <p className="share-app-note">{row.warning}</p> : null}
          {row.paymentSubmittedNotice ? <p className="share-app-status">{row.paymentSubmittedNotice}</p> : null}
          {row.destinationMatchingEnabled && row.canAcceptSharedDropoff ? (
            <div className="share-offer">
              <h4>Proposed shared drop off</h4>
              <p>{row.sharedDropoffNotice}</p>
              <div className="share-app-actions">
                <button type="button" className="btn-profile" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "accept-shared-dropoff", bookingId: row.bookingId }); await loadDashboard(); setStatus("Shared drop off accepted."); })}>Accept drop off</button>
                <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "decline-shared-dropoff", bookingId: row.bookingId }); await loadDashboard(); setStatus("Proposed drop off declined. Your place has been released."); })}>Decline</button>
              </div>
            </div>
          ) : null}
          {row.fourPassengerOffer?.available ? (
            <div className="share-offer">
              <h4>Four passenger departure option</h4>
              <p>We currently have four passengers ready to travel. The journey can still operate if all four passengers agree to a total fare of £43.75 each. You have already paid £35. If everyone accepts, an additional £8.75 payment will be required.</p>
              <div className="share-app-actions">
                <button type="button" className="btn-profile" disabled={busy || row.fourPassengerOffer.accepted} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "accept-four-passenger", bookingId: row.bookingId }); await loadDashboard(); setStatus("Four passenger option accepted."); })}>Accept £43.75 fare</button>
                <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "reject-four-passenger", bookingId: row.bookingId }); await loadDashboard(); setStatus("Four passenger option declined."); })}>Decline</button>
              </div>
            </div>
          ) : null}
          <div className="share-app-actions">
            {row.paymentLinkAvailable ? (
              <button
                type="button"
                className="btn-new-booking share-pay-btn"
                disabled={busy}
                onClick={() => run(async () => {
                  const data = await call("spiresShareGetPaymentLink", { bookingId: row.bookingId });
                  await call("spiresShareCustomerAction", { action: "payment-submitted", bookingId: row.bookingId });
                  window.location.href = data.url;
                })}
              >
                Pay {gbp(row.fourPassengerOffer?.available && row.journeyStatus === "SUPPLEMENT_PAYMENT" ? row.fourPassengerOffer.additionalPence : row.amountDuePence)}
              </button>
            ) : null}
            <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "cancel", bookingId: row.bookingId }); await loadDashboard(); setStatus("Reservation cancelled."); })}>Cancel reservation</button>
          </div>
        </article>
      ))}

      {myInterest.map((row) => (
        <article key={row.interestEntryId} className="share-dash-card">
          <p className="share-dash-kicker">{row.origin} → {row.destinationRegion}</p>
          <h4>{formatDate(row.travelDate)}</h4>
          <p>{row.timeLabel}. {row.passengers} {row.passengers === 1 ? "seat" : "seats"} requested.</p>
          <p>Your status: {row.status === "ACTIVE" ? (row.groupStatus === "CONVERTED_TO_JOURNEY" ? "A proposed journey is ready for you to review" : "Interest recorded") : row.status === "CONVERTED" ? "Converted to a reservation" : "Closed"}</p>
          {row.intendedDestinationText ? <p className="share-app-note">Your intended destination (private): {row.intendedDestinationText}</p> : null}
          {row.canAcceptProposal ? (
            <div className="share-offer">
              <h4>Proposed shared journey</h4>
              <p>Departure: {row.proposedDepartureLocation} at {row.proposedDepartureTime}. {gbp(row.proposedFarePence || farePence)} per passenger.</p>
              <p className="share-app-note">Registering interest at an approximate time does not commit you to this departure. You must accept it before payment.</p>
              <div className="share-app-actions">
                <button type="button" className="btn-profile" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "accept-interest-proposal", interestEntryId: row.interestEntryId }); await loadDashboard(); await loadJourneys(); setStatus("Proposed journey accepted. Complete any remaining steps from your dashboard."); })}>Accept proposed journey</button>
                <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "decline-interest-proposal", interestEntryId: row.interestEntryId }); await loadDashboard(); setStatus("Proposed journey declined."); })}>Decline</button>
              </div>
            </div>
          ) : null}
          {row.status === "ACTIVE" && row.groupStatus !== "CONVERTED_TO_JOURNEY" ? (
            <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "withdraw-interest", interestEntryId: row.interestEntryId }); await loadDashboard(); setStatus("Interest withdrawn."); })}>Withdraw interest</button>
          ) : null}
        </article>
      ))}

      {myWaitlist.map((row) => (
        <article key={row.waitlistId} className="share-dash-card">
          <p className="share-dash-kicker">{row.originLabel} → {row.destinationLabel}</p>
          <h4>{formatDate(row.travelDate)}</h4>
          <p>Departure: {row.departureTime}</p>
          <p>Waitlist position: {row.waitlistPosition || "—"}</p>
          <p>Status: {row.status === "OFFERED" ? "A place is available for you to claim" : row.status === "WAITING" ? "Waiting" : row.status}</p>
          {row.offerExpiresAt && row.canClaim ? <p className="share-deadline">Claim by {formatDeadline(row.offerExpiresAt)}</p> : null}
          {row.canClaim ? (
            <div className="share-offer">
              <p>A place has become available on your Spires Share journey. You have 60 minutes to claim the place before it is offered to the next passenger.</p>
              <div className="share-app-actions">
                <button type="button" className="btn-new-booking share-pay-btn" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "claim-waitlist", waitlistId: row.waitlistId }); await loadDashboard(); await loadJourneys(); setStatus("Place claimed. Complete any remaining acceptance and payment steps. You have not been charged automatically."); })}>Claim place</button>
                <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "decline-waitlist", waitlistId: row.waitlistId }); await loadDashboard(); setStatus("Waitlist offer declined."); })}>Decline</button>
              </div>
            </div>
          ) : null}
        </article>
      ))}

      <h4>Available pilot journeys</h4>
      {available.length === 0 ? (
        <p className="share-app-note">No published pilot journeys are available at the moment.</p>
      ) : (
        available.map((row) => (
          <article key={row.publicNumber} className={`share-dash-card${selectedNumber === row.publicNumber ? " share-dash-card--selected" : ""}`}>
            <p className="share-dash-kicker">{row.originLabel || "Oxford"} → {row.destinationLabel || "Heathrow Airport Terminal 3"}</p>
            <h4>{formatDate(row.travelDate)}</h4>
            <p>Departure: {row.departureTime}</p>
            <p>Recommended arrival: {row.recommendedArrivalTime}</p>
            <p>{gbp(row.farePence)} per passenger</p>
            <p>{row.occupiedSeats} of {row.capacity} places reserved</p>
            <p>{row.remainingSeats} {row.remainingSeats === 1 ? "place" : "places"} remaining</p>
            <p>{row.guarantee === "CONFIRMED" ? "Journey confirmed" : "Provisional place"}</p>
            {row.remainingSeats > 0 ? (
              <button type="button" className="btn-profile" onClick={() => setSelectedNumber(row.publicNumber)}>Select this departure</button>
            ) : (
              <button
                type="button"
                className="btn-profile"
                disabled={busy}
                onClick={() => {
                  setSelectedNumber(row.publicNumber);
                  run(async () => {
                    if (!termsAccepted) {
                      setError("You must read and agree to the Spires Share terms before joining the waitlist.");
                      return;
                    }
                    await call("spiresShareCustomerAction", {
                      action: "join-waitlist",
                      journeyId: row.journeyId,
                      passengers: form.passengers,
                      name: form.name,
                      mobile: form.mobile,
                      email: form.email,
                      termsAccepted,
                      intendedDestinationText: form.intendedDestinationText,
                      intendedDestinationPostcode: form.intendedDestinationPostcode,
                      sharedDropoffAcknowledged: form.sharedDropoffAcknowledged,
                      dropoffTerminal: form.dropoffTerminal,
                      luggage: { largeSuitcases: form.largeSuitcases, cabinBags: form.cabinBags, other: "" },
                    });
                    await loadDashboard();
                    await loadJourneys();
                    setStatus("You have joined the waitlist. A place is not secured and you have not been charged.");
                  });
                }}
              >
                Join waitlist
              </button>
            )}
          </article>
        ))
      )}

      {selected ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              if (!termsAccepted) {
                setError("You must read and agree to the Spires Share terms before registering interest.");
                return;
              }
              if (selected.destinationMatchingEnabled && !form.intendedDestinationText.trim()) {
                setError(`Where in ${selected.destinationCity || "London"} are you travelling to?`);
                return;
              }
              if (selected.destinationMatchingEnabled && !form.sharedDropoffAcknowledged) {
                setError("Please confirm you understand the shared drop off may differ from your intended destination.");
                return;
              }
              const data = await call("spiresShareProposeOrJoin", {
                action: "join",
                airportId: selected.destinationMatchingEnabled ? selected.airportId : "heathrow",
                publicNumber: selected.publicNumber,
                journeyId: selected.journeyId,
                travelDate: selected.travelDate,
                preferredDepartureTime: selected.departureTime,
                flexibility: "exact",
                passengers: form.passengers,
                flightNumber: form.flightNumber,
                flightDepartureTime: form.flightDepartureTime,
                dropoffTerminal: form.dropoffTerminal,
                name: form.name,
                mobile: form.mobile,
                email: form.email,
                termsAccepted,
                intendedDestinationText: form.intendedDestinationText,
                intendedDestinationPostcode: form.intendedDestinationPostcode,
                sharedDropoffAcknowledged: form.sharedDropoffAcknowledged,
                idempotencyKey: newKey(),
                luggage: { largeSuitcases: form.largeSuitcases, cabinBags: form.cabinBags, other: "" },
              });
              await loadDashboard();
              await loadJourneys();
              setStatus(`Your place is currently provisional on ${data.publicNumber}. We will contact you when enough passengers have registered and payment opens.`);
            });
          }}
        >
          <h4>Register interest</h4>
          <p className="share-app-note">Selected departure: {formatDate(selected.travelDate)} at {selected.departureTime}. {gbp(selected.farePence || farePence)} per passenger.</p>
          <p className="share-app-note">Registering interest does not confirm your journey and no payment is taken at this stage.</p>
            {selected.destinationMatchingEnabled ? (
              <p className="share-app-note">Tell us where in {selected.destinationCity || "London"} you're ultimately travelling to. We'll use passenger destinations to choose a practical shared drop off point. Your intended destination is used for matching and does not mean the vehicle will take you directly to that address.</p>
            ) : null}
            {selected.destinationMatchingEnabled ? (
              <p className="share-app-note">We use this to help choose the most practical shared drop off point for everyone travelling. Your final destination is not necessarily where the shared vehicle will drop you.</p>
            ) : null}
          <div className="share-app-grid">
            <label>Passengers<input type="number" min="1" max="5" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) || 1 })} /></label>
            <label>Large suitcases<input type="number" min="0" value={form.largeSuitcases} onChange={(e) => setForm({ ...form, largeSuitcases: Number(e.target.value) || 0 })} /></label>
            <label>Cabin bags<input type="number" min="0" value={form.cabinBags} onChange={(e) => setForm({ ...form, cabinBags: Number(e.target.value) || 0 })} /></label>
            {selected.destinationMatchingEnabled ? (
              <>
                <label>Where in {selected.destinationCity || "London"} are you travelling to?
                  <input required value={form.intendedDestinationText} onChange={(e) => setForm({ ...form, intendedDestinationText: e.target.value })} placeholder="Postcode, address, landmark or area" />
                </label>
                <label>Postcode (optional)<input value={form.intendedDestinationPostcode} onChange={(e) => setForm({ ...form, intendedDestinationPostcode: e.target.value })} /></label>
              </>
            ) : (
              <label>Heathrow terminal
                <select value={form.dropoffTerminal} onChange={(e) => setForm({ ...form, dropoffTerminal: e.target.value })}>
                  <option value="T3">Terminal 3</option>
                </select>
              </label>
            )}
            {selected.destinationMatchingEnabled ? null : (
              <>
                <label>Flight number (private)<input value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} /></label>
                <label>Flight time<input type="time" value={form.flightDepartureTime} onChange={(e) => setForm({ ...form, flightDepartureTime: e.target.value })} /></label>
              </>
            )}
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Mobile<input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
            <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
          </div>
          <div className="share-terms">
            <p><a href="https://www.spires-taxis.com/share-terms" target="_blank" rel="noopener noreferrer">Read the Spires Share terms (draft for review)</a>. These terms have not been legally approved.</p>
            <ul>
              <li>£35 is the standard fare when 5 passengers travel.</li>
              <li>The four passenger option is never automatic.</li>
              <li>Registering interest creates a provisional place only.</li>
            </ul>
            <label className="share-terms-check">
              <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
              I have read and agree to the current Spires Share terms
            </label>
            {selected.destinationMatchingEnabled ? (
              <label className="share-terms-check">
                <input type="checkbox" checked={form.sharedDropoffAcknowledged} onChange={(e) => setForm({ ...form, sharedDropoffAcknowledged: e.target.checked })} />
                I understand my intended destination is used for matching and is not necessarily where the shared vehicle will drop me
              </label>
            ) : null}
          </div>
          <div className="share-app-actions">
            <button type="submit" className="btn-new-booking share-pay-btn" disabled={busy || !termsAccepted || (selected.destinationMatchingEnabled && !form.sharedDropoffAcknowledged)}>Register interest</button>
          </div>
        </form>
      ) : null}

      <h4>Shared journeys people are interested in</h4>
      {interestGroups.length === 0 ? (
        <p className="share-app-note">No open interest groups at the moment. You can request a shared journey below.</p>
      ) : (
        interestGroups.map((row) => (
          <article key={row.publicNumber} className="share-dash-card">
            <p className="share-dash-kicker">{row.origin} → {row.destinationRegion}</p>
            <h4>{formatDate(row.travelDate)}</h4>
            <p>{row.timeLabel}</p>
            <p>{row.interestedSeatCount} {row.interestedSeatCount === 1 ? "passenger interested" : "passengers interested"}</p>
            <button
              type="button"
              className="btn-profile"
              onClick={() => {
                setShowRequest(true);
                setJoinInterestNumber(row.publicNumber);
                setInterestForm({
                  ...interestForm,
                  origin: row.origin,
                  destinationRegion: row.destinationRegion,
                  travelDate: row.travelDate,
                });
              }}
            >
              Join interest
            </button>
          </article>
        ))
      )}

      <div className="share-app-actions">
        <button type="button" className="btn-profile" onClick={() => { setShowRequest(true); setJoinInterestNumber(""); }}>Request a shared journey</button>
      </div>

      {showRequest ? (
        <form
          onSubmit={(event) => {
            event.preventDefault();
            run(async () => {
              if (!termsAccepted) {
                setError("You must read and agree to the Spires Share terms before registering interest.");
                return;
              }
              const city = interestForm.destinationRegion.trim().toLowerCase() === "london" || interestForm.destinationRegion.trim().toLowerCase() === "central london";
              if (city && !interestForm.intendedDestinationText.trim()) {
                setError("Where in London are you travelling to? This stays private.");
                return;
              }
              if (city && !interestForm.sharedDropoffAcknowledged) {
                setError("Please confirm you understand the shared drop off may differ from your intended destination.");
                return;
              }
              const data = await call("spiresShareExpressInterest", {
                publicNumber: joinInterestNumber,
                origin: interestForm.origin,
                destinationRegion: interestForm.destinationRegion,
                travelDate: interestForm.travelDate,
                preferredDepartureTime: interestForm.preferredDepartureTime,
                flexibility: interestForm.flexibility,
                passengers: interestForm.passengers,
                name: form.name,
                mobile: form.mobile,
                email: form.email,
                termsAccepted,
                intendedDestinationText: interestForm.intendedDestinationText,
                intendedDestinationPostcode: interestForm.intendedDestinationPostcode,
                sharedDropoffAcknowledged: interestForm.sharedDropoffAcknowledged,
              });
              await loadDashboard();
              await loadJourneys();
              setStatus(data.joinedExisting ? `Joined existing interest for ${data.publicNumber}. This is not a booking and no payment has been taken.` : `Interest recorded as ${data.publicNumber}. This is not a booking and no payment has been taken.`);
            });
          }}
        >
          <h4>Request a shared journey</h4>
          <p className="share-app-note">If a compatible interest group already exists, you will join it. Otherwise a new group is created. No payment is taken. You will be asked to accept an exact proposed departure later.</p>
          <div className="share-app-grid">
            <label>Origin<input required value={interestForm.origin} onChange={(e) => setInterestForm({ ...interestForm, origin: e.target.value })} /></label>
            <label>Destination<input required value={interestForm.destinationRegion} onChange={(e) => setInterestForm({ ...interestForm, destinationRegion: e.target.value })} /></label>
            <label>Date<input required type="date" value={interestForm.travelDate} onChange={(e) => setInterestForm({ ...interestForm, travelDate: e.target.value })} /></label>
            <label>Preferred departure<input required type="time" value={interestForm.preferredDepartureTime} onChange={(e) => setInterestForm({ ...interestForm, preferredDepartureTime: e.target.value })} /></label>
            <label>Flexible
              <select value={interestForm.flexibility} onChange={(e) => setInterestForm({ ...interestForm, flexibility: e.target.value })}>
                <option value="exact">Exact time</option>
                <option value="plus_minus_15">15 minutes either side</option>
                <option value="plus_minus_30">30 minutes either side</option>
                <option value="plus_minus_60">60 minutes either side</option>
              </select>
            </label>
            <label>Seats required<input type="number" min="1" max="5" value={interestForm.passengers} onChange={(e) => setInterestForm({ ...interestForm, passengers: Number(e.target.value) || 1 })} /></label>
            <label>Name<input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></label>
            <label>Mobile<input required value={form.mobile} onChange={(e) => setForm({ ...form, mobile: e.target.value })} /></label>
            <label>Email<input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} /></label>
            {(interestForm.destinationRegion || "").toLowerCase().includes("london") ? (
              <>
                <label>Final destination (private)
                  <input required value={interestForm.intendedDestinationText} onChange={(e) => setInterestForm({ ...interestForm, intendedDestinationText: e.target.value })} placeholder="Area, landmark or postcode. This stays private." />
                </label>
                <label>Postcode (optional, private)<input value={interestForm.intendedDestinationPostcode} onChange={(e) => setInterestForm({ ...interestForm, intendedDestinationPostcode: e.target.value })} /></label>
              </>
            ) : null}
          </div>
          {(interestForm.destinationRegion || "").toLowerCase().includes("london") ? (
            <label className="share-terms-check">
              <input type="checkbox" checked={interestForm.sharedDropoffAcknowledged} onChange={(e) => setInterestForm({ ...interestForm, sharedDropoffAcknowledged: e.target.checked })} />
              I understand my intended destination is used for matching and is not necessarily where the shared vehicle will drop me
            </label>
          ) : null}
          <label className="share-terms-check">
            <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
            I have read and agree to the current Spires Share terms
          </label>
          <div className="share-app-actions">
            <button type="submit" className="btn-new-booking share-pay-btn" disabled={busy || !termsAccepted}>Submit interest</button>
          </div>
        </form>
      ) : null}
    </section>
  );
}
