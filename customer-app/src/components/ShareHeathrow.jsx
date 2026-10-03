import React, { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";

const TERMS_URL = "https://www.spires-taxis.com/share-terms";
const GUIDE_URL = "https://www.spires-taxis.com/share/heathrow-terminal-transfer";

function formatCountdown(deadlineAt, nowMs) {
  if (!deadlineAt) return "";
  const ms = new Date(deadlineAt).getTime() - nowMs;
  if (!Number.isFinite(ms)) return "";
  if (ms <= 0) return "Closed";
  const totalMins = Math.floor(ms / 60000);
  const days = Math.floor(totalMins / (24 * 60));
  const hours = Math.floor((totalMins % (24 * 60)) / 60);
  const mins = totalMins % 60;
  const secs = Math.floor((ms % 60000) / 1000);
  const pad = (n) => String(Math.max(0, n)).padStart(2, "0");
  if (days >= 1) return `${days} day${days === 1 ? "" : "s"} ${pad(hours)} hrs ${pad(mins)} mins`;
  return `${pad(hours)}:${pad(mins)}:${pad(secs)}`;
}

function ProgressDots({ filled, total }) {
  const capacity = Math.max(0, Number(total) || 0);
  const taken = Math.max(0, Number(filled) || 0);
  return (
    <div className="share-occupancy" aria-hidden="true">
      {Array.from({ length: capacity }, (_, index) => (
        <span key={index} className={`share-dot${index < taken ? " is-filled" : ""}`} />
      ))}
    </div>
  );
}

function GuaranteeNotice() {
  return (
    <div className="share-guarantee">
      <p>Your journey is only confirmed once all required passenger payments have been received and verified by Spires Taxis.</p>
      <p>Please do not make travel plans on the assumption that registering interest or making an individual payment confirms the journey.</p>
    </div>
  );
}

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

function destKey(value) {
  return String(value || "").trim().toLowerCase();
}

function isHeathrowDest(value) {
  const key = destKey(value);
  return key.includes("heathrow") || key === "lhr";
}

function isCityDest(value) {
  const key = destKey(value);
  return key === "london" || key === "central london" || key === "birmingham";
}

function isAirportDest(value) {
  const key = destKey(value);
  return isHeathrowDest(key) || key.includes("gatwick") || key.includes("luton") || key.includes("stansted") || key.includes("airport");
}

function flexibilityLabel(value) {
  if (value === "exact") return "Exact time";
  if (value === "plus_minus_15") return "15 minutes either side";
  if (value === "plus_minus_60") return "60 minutes either side";
  return "30 minutes either side";
}

function flexibilityWindow(time, flexibility) {
  if (!time) return "";
  const [h, m] = time.split(":").map(Number);
  if (!Number.isFinite(h)) return time;
  const mins = { exact: 0, plus_minus_15: 15, plus_minus_30: 30, plus_minus_60: 60 }[flexibility] || 30;
  if (!mins) return time;
  const start = (h * 60 + m - mins + 24 * 60) % (24 * 60);
  const end = (h * 60 + m + mins) % (24 * 60);
  const fmt = (total) => `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
  return `${fmt(start)}–${fmt(end)}`;
}

function guideHref(terminal) {
  const t = String(terminal || "").toUpperCase();
  if (t === "T2") return `${GUIDE_URL}#t2`;
  if (t === "T4") return `${GUIDE_URL}#t4`;
  if (t === "T5") return `${GUIDE_URL}#t5`;
  return `${GUIDE_URL}#t3`;
}

function guideLinkText(terminal) {
  const t = String(terminal || "").toUpperCase();
  if (t === "T2") return "How to get from T3 to T2";
  if (t === "T4") return "How to get from T3 to T4";
  if (t === "T5") return "How to get from T3 to T5";
  return "Terminal transfer instructions";
}

function terminalWarning(terminal) {
  const t = String(terminal || "").toUpperCase();
  if (t === "T3") return "Your flight departs from Terminal 3. No terminal transfer is required after Spires Share drops you at Terminal 3.";
  if (t === "T2") return "Your flight departs from Terminal 2. Spires Share drops you at Terminal 3. You will need to transfer from Terminal 3 to Terminal 2 after we drop you off. Please allow additional time.";
  if (t === "T4") return "Your flight departs from Terminal 4. Spires Share drops you at Terminal 3. You will need to transfer from Terminal 3 to Terminal 4 after we drop you off. Please allow additional time.";
  if (t === "T5") return "Your flight departs from Terminal 5. Spires Share drops you at Terminal 3, so you will need to transfer to Terminal 5 after we drop you off. Please allow additional time.";
  if (t === "UNSURE") return "If your flight departs from a terminal other than Terminal 3, you will need to transfer from Terminal 3 after we drop you off. Please allow additional time.";
  return "";
}

function bookingStatusLabel(row) {
  if (row.journeyStatus === "CONFIRMED" || row.customerStage === "JOURNEY_CONFIRMED") return "Journey confirmed";
  if (row.customerStageLabel) return row.customerStageLabel;
  if (row.hostedPaymentStatus === "PAID" || row.reservationStatus === "PAID") return "Awaiting all payments";
  if (row.paymentSubmittedNotice && row.hostedPaymentStatus !== "PAID") return "Payment submitted";
  if (row.paymentLinkAvailable || row.reservationStatus === "PAYMENT_PENDING") return "Payment required";
  if (row.canAcceptSharedDropoff) return "Action required";
  if (row.fourPassengerOffer?.available) return "Action required";
  if (row.customerStatusLabel) return row.customerStatusLabel;
  return "Place accepted";
}

function interestStatusLabel(row) {
  if (row.groupStatus === "EXPIRED") return "Not enough interest";
  if (row.groupStatus === "CANCELLED") return "Cancelled";
  if (row.customerStageLabel) return row.customerStageLabel;
  if (row.canAcceptProposal) return "Action required";
  if (row.groupStatus === "CONVERTED_TO_JOURNEY") return "Journey proposed";
  if (row.groupStatus === "READY_FOR_REVIEW") return "Enough interest received";
  if (row.status === "ACTIVE") return "Interest registered";
  if (row.status === "CONVERTED") return "Converted";
  if (row.status === "WITHDRAWN") return "Cancelled";
  return "Interest registered";
}

function waitlistStatusLabel(row) {
  if (row.canClaim) return "Action required";
  if (row.status === "OFFERED") return "A place is available";
  if (row.status === "WAITING") return "Waitlist";
  if (row.status === "ACCEPTED") return "Accepted";
  if (row.status === "DECLINED") return "Declined";
  if (row.status === "EXPIRED") return "Expired";
  return "Waitlist";
}

export default function ShareHeathrow() {
  const params = useMemo(() => new URLSearchParams(window.location.search), []);
  const startView = params.get("request") === "1" ? "request" : params.get("waitlist") === "1" ? "explore" : "home";
  const [session, setSession] = useState(null);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("");
  const [busy, setBusy] = useState(false);
  const [view, setView] = useState(startView);
  const [step, setStep] = useState(1);
  const [available, setAvailable] = useState([]);
  const [interestGroups, setInterestGroups] = useState([]);
  const [events, setEvents] = useState([]);
  const [dashboard, setDashboard] = useState([]);
  const [myInterest, setMyInterest] = useState([]);
  const [myWaitlist, setMyWaitlist] = useState([]);
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [requestAck, setRequestAck] = useState(false);
  const [selectedNumber, setSelectedNumber] = useState(params.get("publicNumber") || "");
  const [joinInterestNumber, setJoinInterestNumber] = useState(params.get("interest") || "");
  const [match, setMatch] = useState(null);
  const [skipMatch, setSkipMatch] = useState(false);
  const [editingInterestId, setEditingInterestId] = useState("");
  const [interestPatch, setInterestPatch] = useState({
    preferredDepartureTime: "10:00",
    flexibility: "plus_minus_30",
    passengers: 1,
    intendedDestinationText: "",
    flightNumber: "",
    flightDepartureTime: "",
    departureTerminal: "T3",
  });
  const [contact, setContact] = useState({ name: "", mobile: "", email: "" });
  const [nowMs, setNowMs] = useState(Date.now());
  const [form, setForm] = useState({
    origin: params.get("origin") || "Oxford",
    destinationRegion: params.get("destination") || "",
    travelDate: params.get("travelDate") || "",
    preferredDepartureTime: params.get("preferredDepartureTime") || "10:00",
    flexibility: "plus_minus_30",
    passengers: Number(params.get("passengers") || 1),
    largeSuitcases: 1,
    cabinBags: 1,
    flightNumber: "",
    flightDepartureTime: "",
    departureTerminal: "T3",
    intendedDestinationText: "",
    intendedDestinationPostcode: "",
    sharedDropoffAcknowledged: false,
    tripType: params.get("tripType") === "RETURN" ? "RETURN" : "ONE_WAY",
    eventSlug: params.get("event") || "",
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
    const result = await fn({ airportId: "all" });
    setAvailable(result.data?.journeys || []);
    setInterestGroups(result.data?.interestGroups || []);
    setEvents(result.data?.events || []);
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

  useEffect(() => {
    const timer = setInterval(() => setNowMs(Date.now()), 1000);
    const refresh = () => {
      if (!session?.available) return;
      loadDashboard().catch(() => undefined);
      loadJourneys().catch(() => undefined);
    };
    window.addEventListener("focus", refresh);
    document.addEventListener("visibilitychange", () => {
      if (!document.hidden) refresh();
    });
    return () => {
      clearInterval(timer);
      window.removeEventListener("focus", refresh);
    };
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
      const code = typeof err?.code === "string" ? err.code : "";
      const raw = typeof err?.message === "string" ? err.message : "";
      setError(
        !raw || raw === "INTERNAL" || code === "functions/internal"
          ? "Could not save your Spires Share request. Please try again."
          : raw.replace(/^FirebaseError:\s*/i, "")
      );
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
        <h3>Spires Share</h3>
        <p>Spires Share is not currently available on this account.</p>
        <p>Your ordinary private hire bookings are unchanged.</p>
      </section>
    );
  }

  const selected = available.find((row) => row.publicNumber === selectedNumber) || null;
  const selectedEvent = events.find((row) => row.publicNumber === joinInterestNumber || (form.eventSlug && row.eventSlug === form.eventSlug)) || null;
  const eventMode = Boolean(selectedEvent || form.eventSlug);
  const city = !eventMode && isCityDest(form.destinationRegion);
  const heathrow = !eventMode && isHeathrowDest(form.destinationRegion);
  const airport = isAirportDest(form.destinationRegion);
  const actions = [
    ...dashboard.filter((row) => row.canAcceptSharedDropoff || row.paymentLinkAvailable || row.fourPassengerOffer?.available).map((row) => ({
      key: row.bookingId,
      title: row.canAcceptSharedDropoff ? "Shared drop off waiting for acceptance" : row.fourPassengerOffer?.available ? "Four passenger option requires a response" : "Payment required",
      go: () => setView("mine"),
    })),
    ...myInterest.filter((row) => row.canAcceptProposal).map((row) => ({
      key: row.interestEntryId,
      title: "Journey proposal waiting for acceptance",
      go: () => setView("mine"),
    })),
    ...myWaitlist.filter((row) => row.canClaim).map((row) => ({
      key: row.waitlistId,
      title: "Waitlist place available",
      go: () => setView("mine"),
    })),
    ...dashboard.filter((row) => row.terminalGuideUrl && String(row.departureTerminal || "").toUpperCase() !== "T3").map((row) => ({
      key: `guide-${row.bookingId}`,
      title: row.terminalGuideLabel || "Terminal transfer information",
      go: () => window.open(row.terminalGuideUrl, "_blank", "noopener,noreferrer"),
    })),
  ];

  const previewMatch = async () => {
    const data = await call("spiresSharePreviewInterest", {
      origin: form.origin,
      destinationRegion: form.destinationRegion,
      travelDate: form.travelDate,
      preferredDepartureTime: form.preferredDepartureTime,
      flexibility: form.flexibility,
      passengers: form.passengers,
    });
    const found = data?.match || null;
    if (!found || Number(found.interestedSeatCount || 0) < 1) {
      setMatch(null);
      setSkipMatch(true);
      return;
    }
    setSkipMatch(false);
    setMatch(found);
  };

  const submitInterest = async (publicNumber) => {
    if (!termsAccepted || !requestAck) {
      setError("Please confirm you understand this is a Share interest request and agree to the current terms.");
      return;
    }
    if (city && !form.intendedDestinationText.trim()) {
      setError("Tell us where you are ultimately travelling to. This stays private.");
      return;
    }
    if (city && !form.sharedDropoffAcknowledged) {
      setError("Please confirm you understand the shared drop off may differ from your intended destination.");
      return;
    }
    const data = await call("spiresShareExpressInterest", {
      publicNumber: publicNumber || "",
      origin: form.origin,
      destinationRegion: form.destinationRegion,
      travelDate: form.travelDate,
      preferredDepartureTime: form.preferredDepartureTime,
      flexibility: form.flexibility,
      passengers: form.passengers,
      name: contact.name,
      mobile: contact.mobile,
      email: contact.email,
      termsAccepted,
      intendedDestinationText: form.intendedDestinationText,
      intendedDestinationPostcode: form.intendedDestinationPostcode,
      sharedDropoffAcknowledged: form.sharedDropoffAcknowledged,
      flightNumber: form.flightNumber,
      flightDepartureTime: form.flightDepartureTime,
      departureTerminal: heathrow ? form.departureTerminal : "",
      dropoffTerminal: heathrow ? "T3" : "",
      tripType: form.tripType,
      eventSlug: form.eventSlug || "",
    });
    await loadDashboard();
    await loadJourneys();
    setView("mine");
    setStep(1);
    setMatch(null);
    setSkipMatch(false);
    setStatus(data.joinedExisting
      ? `Joined existing interest for ${data.publicNumber}. This is not a confirmed booking and no payment has been taken.`
      : form.eventSlug || (data.public?.journeyType === "EVENT")
        ? `Interest registered. We currently have ${data.public?.interestedSeatCount ?? 0} / ${data.public?.requiredSeats ?? 5} passengers interested. This is not yet a confirmed booking. We will contact you if enough passengers register and an exact journey is proposed.`
        : `Interest registered as ${data.publicNumber}. We'll try to match you with other passengers travelling in the same direction. This is not yet a confirmed booking and no payment has been taken.`);
  };

  const termsChecks = (
    <div className="share-terms-block">
      <p className="share-app-note">This registers your interest in a shared journey. It does not confirm a booking and no payment will be taken now.</p>
      <p><a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Read the Spires Share Terms and Conditions</a></p>
      <label className="share-terms-check">
        <input type="checkbox" checked={requestAck} onChange={(e) => setRequestAck(e.target.checked)} />
        I understand that this is a request to join or create Spires Share interest and is not yet a confirmed journey.
      </label>
      <label className="share-terms-check">
        <input type="checkbox" checked={termsAccepted} onChange={(e) => setTermsAccepted(e.target.checked)} />
        I have read and agree to the current Spires Share terms
      </label>
    </div>
  );

  const nav = (
    <div className="share-app-actions">
      <button type="button" className={`btn-secondary${view === "home" ? " share-nav-active" : ""}`} onClick={() => setView("home")}>Spires Share</button>
      <button type="button" className={`btn-secondary${view === "request" ? " share-nav-active" : ""}`} onClick={() => { setView("request"); setStep(1); }}>Request</button>
      <button type="button" className={`btn-secondary${view === "explore" ? " share-nav-active" : ""}`} onClick={() => setView("explore")}>Available</button>
      <button type="button" className={`btn-secondary${view === "mine" ? " share-nav-active" : ""}`} onClick={() => setView("mine")}>My Share journeys</button>
    </div>
  );

  return (
    <section className="share-app-panel">
      <p className="share-pilot-kicker">Spires Share</p>
      <h3>Share a journey with other passengers travelling in the same direction.</h3>
      <p className="share-app-note">This is a demand led shared private hire request. It is not a confirmed taxi booking and may not operate unless enough compatible passengers are found.</p>
      {nav}
      {error ? <p className="share-app-error">{error}</p> : null}
      {status ? <p className="share-app-status">{status}</p> : null}

      {view === "home" ? (
        <>
          {actions.length ? (
            <div className="share-offer">
              <h4>Needs your attention</h4>
              {actions.map((item) => (
                <button key={item.key} type="button" className="btn-secondary" onClick={item.go}>{item.title}</button>
              ))}
            </div>
          ) : null}
          <div className="share-app-actions">
            <button type="button" className="btn-new-booking share-pay-btn" onClick={() => { setView("request"); setStep(1); }}>Request a shared journey</button>
            <button type="button" className="btn-secondary" onClick={() => setView("explore")}>View available shared journeys</button>
            <button type="button" className="btn-secondary" onClick={() => setView("mine")}>My Share journeys</button>
          </div>
          {events.length ? (
            <>
              <h4>Upcoming events</h4>
              {events.slice(0, 4).map((row) => (
                <article key={row.publicNumber} className="share-dash-card">
                  <p className="share-dash-kicker">{row.venueName || row.destinationRegion}</p>
                  <h4>{row.eventName || "Event"}</h4>
                  <p>{formatDate(row.eventDate || row.travelDate)}</p>
                  <p>Oxford → {row.venueName || row.destinationRegion}</p>
                  <p>From {gbp(row.outboundFarePence)} per passenger</p>
                  <p>Maximum {row.requiredSeats || 5} passengers</p>
                  <ProgressDots filled={row.interestedSeatCount || 0} total={row.requiredSeats || 5} />
                  <p>{row.interestedSeatCount || 0} of {row.requiredSeats || 5} interested</p>
                  <p className="share-needed">{row.publicStatusLabel || row.neededLabel}</p>
                  <button type="button" className="btn-secondary" onClick={() => {
                    setJoinInterestNumber(row.publicNumber);
                    setForm({
                      ...form,
                      origin: row.origin || "Oxford",
                      destinationRegion: row.destinationRegion || row.venueName,
                      travelDate: row.eventDate || row.travelDate,
                      eventSlug: row.eventSlug || "",
                      tripType: "ONE_WAY",
                      preferredDepartureTime: row.suggestedDepartureTime || row.preferredDepartureTime || form.preferredDepartureTime,
                    });
                    setView("request");
                    setStep(7);
                  }}>Register interest</button>
                </article>
              ))}
            </>
          ) : null}
        </>
      ) : null}

      {view === "request" ? (
        <div className="share-wizard">
          <p className="share-wizard-progress">Step {Math.min(step, 8)} of 8</p>
          {step === 1 ? (
            <label>Where are you travelling from?
              <input value={form.origin} onChange={(e) => setForm({ ...form, origin: e.target.value })} />
            </label>
          ) : null}
          {step === 2 ? (
            <label>Where are you travelling to?
              <input value={form.destinationRegion} onChange={(e) => setForm({ ...form, destinationRegion: e.target.value })} placeholder="Heathrow, London, Wembley…" />
            </label>
          ) : null}
          {step === 3 ? (
            <label>What date?
              <input type="date" value={form.travelDate} onChange={(e) => setForm({ ...form, travelDate: e.target.value })} />
            </label>
          ) : null}
          {step === 4 ? (
            <label>What time would you ideally like to leave?
              <input type="time" value={form.preferredDepartureTime} onChange={(e) => setForm({ ...form, preferredDepartureTime: e.target.value })} />
            </label>
          ) : null}
          {step === 5 ? (
            <label>How flexible are you?
              <select value={form.flexibility} onChange={(e) => setForm({ ...form, flexibility: e.target.value })}>
                <option value="exact">Exact time</option>
                <option value="plus_minus_15">15 minutes either side</option>
                <option value="plus_minus_30">30 minutes either side</option>
                <option value="plus_minus_60">60 minutes either side</option>
              </select>
            </label>
          ) : null}
          {step === 6 ? (
            <label>How many passengers?
              <input type="number" min="1" max="5" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) || 1 })} />
            </label>
          ) : null}
          {step === 7 ? (
            <div className="share-app-grid">
              {eventMode ? (
                <>
                  <p className="share-dash-kicker">{selectedEvent?.venueName || form.destinationRegion}</p>
                  <h4>{selectedEvent?.eventName || "Event"}</h4>
                  <p>{formatDate(selectedEvent?.eventDate || form.travelDate)}</p>
                  <p>Oxford → {selectedEvent?.venueName || form.destinationRegion}</p>
                  <p>Fare from {gbp(selectedEvent?.outboundFarePence)} per passenger{selectedEvent?.offerReturn && selectedEvent?.returnFarePence ? ` or ${gbp(selectedEvent.returnFarePence)} return` : ""}</p>
                  <p className="share-app-note">Share the journey with a small group travelling to the same event. Maximum five passengers. More space and fewer passengers than a coach.</p>
                  <label>Number of passengers
                    <input type="number" min="1" max="5" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) || 1 })} />
                  </label>
                  {selectedEvent?.offerReturn ? (
                    <label>Journey
                      <select value={form.tripType} onChange={(e) => setForm({ ...form, tripType: e.target.value })}>
                        <option value="ONE_WAY">One way</option>
                        <option value="RETURN">Return</option>
                      </select>
                    </label>
                  ) : <p>One way</p>}
                </>
              ) : null}
              {heathrow ? (
                <>
                  <p className="share-strict">Shared drop off: Heathrow Terminal 3</p>
                  <p className="share-app-note">Your Spires Share drop off is Terminal 3. If your flight departs from another terminal, you will need to make your own way from Terminal 3 to your departure terminal.</p>
                  <label>Flight number (if known)<input value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} /></label>
                  <label>Flight departure time<input type="time" value={form.flightDepartureTime} onChange={(e) => setForm({ ...form, flightDepartureTime: e.target.value })} /></label>
                  <label>Which terminal does your flight leave from?
                    <select value={form.departureTerminal} onChange={(e) => setForm({ ...form, departureTerminal: e.target.value })}>
                      <option value="T2">Terminal 2</option>
                      <option value="T3">Terminal 3</option>
                      <option value="T4">Terminal 4</option>
                      <option value="T5">Terminal 5</option>
                      <option value="UNSURE">Not sure</option>
                    </select>
                  </label>
                  {terminalWarning(form.departureTerminal) ? (
                    <div className="share-offer">
                      <p>{terminalWarning(form.departureTerminal)}</p>
                      {form.departureTerminal !== "T3" ? <p><a href={guideHref(form.departureTerminal)} target="_blank" rel="noopener noreferrer">{guideLinkText(form.departureTerminal)}</a></p> : null}
                    </div>
                  ) : null}
                  <label>Large suitcases<input type="number" min="0" value={form.largeSuitcases} onChange={(e) => setForm({ ...form, largeSuitcases: Number(e.target.value) || 0 })} /></label>
                  <label>Cabin bags<input type="number" min="0" value={form.cabinBags} onChange={(e) => setForm({ ...form, cabinBags: Number(e.target.value) || 0 })} /></label>
                </>
              ) : null}
              {city ? (
                <>
                  <p className="share-app-note">Your intended destination helps us match you with passengers travelling to a similar part of the city. Spires Share may use one common drop off point rather than taking each passenger to their individual final destination. Your exact intended destination remains private.</p>
                  <label>Intended destination (private)
                    <input value={form.intendedDestinationText} onChange={(e) => setForm({ ...form, intendedDestinationText: e.target.value })} placeholder="Area, landmark or postcode" />
                  </label>
                  <label className="share-terms-check">
                    <input type="checkbox" checked={form.sharedDropoffAcknowledged} onChange={(e) => setForm({ ...form, sharedDropoffAcknowledged: e.target.checked })} />
                    I understand the shared drop off may differ from my intended destination
                  </label>
                </>
              ) : null}
              {airport && !heathrow ? (
                <>
                  <label>Airport / venue notes<input value={form.flightNumber} onChange={(e) => setForm({ ...form, flightNumber: e.target.value })} placeholder="Flight number if known" /></label>
                  <label>Scheduled time<input type="time" value={form.flightDepartureTime} onChange={(e) => setForm({ ...form, flightDepartureTime: e.target.value })} /></label>
                </>
              ) : null}
              <label>Name<input required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
              <label>Mobile<input required value={contact.mobile} onChange={(e) => setContact({ ...contact, mobile: e.target.value })} /></label>
              <label>Email<input type="email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
            </div>
          ) : null}
          {step === 8 && match && !skipMatch ? (
            <div className="share-offer">
              <h4>We found a possible match</h4>
              <p>{match.origin} → {match.destinationRegion}</p>
              <p>{formatDate(match.travelDate)}</p>
              <p>Preferred departure: around {form.preferredDepartureTime}</p>
              <p>{match.interestedSeatCount} {match.interestedSeatCount === 1 ? "passenger currently interested" : "passengers currently interested"}</p>
              {termsChecks}
              <div className="share-app-actions">
                <button type="button" className="btn-new-booking share-pay-btn" disabled={busy || !termsAccepted || !requestAck} onClick={() => run(() => submitInterest(match.publicNumber))}>Join this group</button>
                <button type="button" className="btn-logout" onClick={() => { setSkipMatch(true); setMatch(null); }}>My times do not match</button>
              </div>
            </div>
          ) : null}
          {step === 8 && (!match || skipMatch) ? (
            <div>
              <h4>Review your request</h4>
              <dl className="share-dash-grid">
                <div><dt>From</dt><dd>{form.origin}</dd></div>
                <div><dt>To</dt><dd>{form.destinationRegion}</dd></div>
                <div><dt>Date</dt><dd>{formatDate(form.travelDate)}</dd></div>
                <div><dt>Preferred departure</dt><dd>{form.preferredDepartureTime}</dd></div>
                <div><dt>Flexible</dt><dd>{flexibilityWindow(form.preferredDepartureTime, form.flexibility) || flexibilityLabel(form.flexibility)}</dd></div>
                <div><dt>Passengers</dt><dd>{form.passengers}</dd></div>
                {city ? <div><dt>Intended destination</dt><dd>{form.intendedDestinationText}</dd></div> : null}
                {heathrow ? <div><dt>Flight terminal</dt><dd>{form.departureTerminal === "UNSURE" ? "Not sure" : form.departureTerminal} · Share drop off T3</dd></div> : null}
              </dl>
              {termsChecks}
              <button type="button" className="btn-new-booking share-pay-btn" disabled={busy || !termsAccepted || !requestAck} onClick={() => run(() => submitInterest(joinInterestNumber))}>Register interest</button>
            </div>
          ) : null}
          <div className="share-app-actions">
            {step > 1 ? <button type="button" className="btn-logout" onClick={() => setStep(step - 1)}>Back</button> : null}
            {step < 8 ? (
              <button
                type="button"
                className="btn-new-booking"
                disabled={busy}
                onClick={() => run(async () => {
                  if (step === 1 && !form.origin.trim()) { setError("Enter where you are travelling from."); return; }
                  if (step === 2 && !form.destinationRegion.trim()) { setError("Enter where you are travelling to."); return; }
                  if (step === 3 && !form.travelDate) { setError("Choose a date."); return; }
                  if (step === 7 && city && !form.intendedDestinationText.trim()) { setError("Tell us your intended destination. This stays private."); return; }
                  if (step === 7 && !contact.name.trim()) { setError("Enter your name."); return; }
                  if (step === 7) {
                    setSkipMatch(false);
                    await previewMatch();
                  }
                  setStep(step + 1);
                })}
              >
                Continue
              </button>
            ) : null}
          </div>
        </div>
      ) : null}

      {view === "explore" ? (
        <>
          {events.length ? (
            <>
              <h4>Upcoming events</h4>
              {events.map((row) => {
                const required = row.requiredSeats || 5;
                const seats = row.interestedSeatCount || 0;
                const full = seats >= required;
                return (
                  <article key={row.publicNumber} className="share-dash-card">
                    <p className="share-dash-kicker">{row.venueName || row.destinationRegion}</p>
                    <h4>{row.eventName || "Event"}</h4>
                    <p>{formatDate(row.eventDate || row.travelDate)}</p>
                    <p>Oxford → {row.venueName || row.destinationRegion}</p>
                    <p>From {gbp(row.outboundFarePence)} per passenger{row.offerReturn && row.returnFarePence ? ` or ${gbp(row.returnFarePence)} return` : ""}</p>
                    <p>Maximum {required} passengers. Spires Share deliberately limits each journey to five passengers, giving you more room and a more comfortable journey.</p>
                    <ProgressDots filled={seats} total={required} />
                    <p>{seats} of {required} interested</p>
                    <p className="share-needed">{full ? "Full" : row.publicStatusLabel || row.neededLabel}</p>
                    {row.interestDeadlineAt ? <p className="share-deadline">{new Date(row.interestDeadlineAt).getTime() <= nowMs ? "Registration closed" : `Registration closes in: ${formatCountdown(row.interestDeadlineAt, nowMs)}`}</p> : null}
                    <p className="share-app-note">Share the journey with a small group travelling to the same event. This is not a coach or bus service.</p>
                    {full ? (
                      <p className="share-app-note">This event is full. If a place becomes available after a journey is proposed, you can join the waitlist from the published journey.</p>
                    ) : (
                      <button type="button" className="btn-secondary" onClick={() => {
                        setJoinInterestNumber(row.publicNumber);
                        setForm({
                          ...form,
                          origin: row.origin || "Oxford",
                          destinationRegion: row.destinationRegion || row.venueName,
                          travelDate: row.eventDate || row.travelDate,
                          eventSlug: row.eventSlug || "",
                          tripType: "ONE_WAY",
                          preferredDepartureTime: row.suggestedDepartureTime || row.preferredDepartureTime || form.preferredDepartureTime,
                        });
                        setView("request");
                        setStep(7);
                      }}>Register interest</button>
                    )}
                  </article>
                );
              })}
            </>
          ) : null}
          <h4>Shared journeys people are interested in</h4>
          {interestGroups.length === 0 ? <p className="share-app-note">No open interest groups at the moment.</p> : interestGroups.map((row) => (
            <article key={row.publicNumber} className="share-dash-card">
              <p className="share-dash-kicker">{row.origin} → {row.destinationRegion}</p>
              <h4>{formatDate(row.travelDate)}</h4>
              <p>Departure around {row.preferredDepartureTime || row.timeLabel}</p>
              <p>{row.placesLabel || `${row.interestedSeatCount} of ${row.requiredSeats || 5} places interested`}</p>
              <ProgressDots filled={row.interestedSeatCount} total={row.requiredSeats || 5} />
              <p className="share-needed">{row.enoughInterest ? "Enough interest received. Payment requests can now be sent." : row.neededLabel}</p>
              {row.interestDeadlineAt ? <p className="share-deadline">Registration closes in: {formatCountdown(row.interestDeadlineAt, nowMs)}</p> : null}
              <button type="button" className="btn-secondary" onClick={() => {
                setJoinInterestNumber(row.publicNumber);
                setForm({ ...form, origin: row.origin, destinationRegion: row.destinationRegion, travelDate: row.travelDate });
                setView("request");
                setStep(7);
              }}>Join interest</button>
            </article>
          ))}
          <h4>Published journeys</h4>
          {available.length === 0 ? <p className="share-app-note">No published journeys are available at the moment.</p> : available.map((row) => (
            <article key={row.publicNumber} className={`share-dash-card${selectedNumber === row.publicNumber ? " share-dash-card--selected" : ""}`}>
              <p className="share-dash-kicker">{row.originLabel || "Oxford"} → {row.destinationLabel || row.destinationCity}</p>
              <h4>{formatDate(row.travelDate)}</h4>
              <p>Departure: {row.departureTime}</p>
              <p>{gbp(row.farePence)} per passenger</p>
              <p>{row.occupiedSeats} of {row.capacity} places reserved</p>
              {String(row.destinationLabel || row.destinationCity || "").toLowerCase().includes("heathrow") ? (
                <p className="share-app-note">Shared drop off: Terminal 3. <a href={`${GUIDE_URL}#t3`} target="_blank" rel="noopener noreferrer">Terminal transfer instructions</a></p>
              ) : null}
              {row.remainingSeats > 0 ? (
                <button type="button" className="btn-secondary" onClick={() => setSelectedNumber(row.publicNumber)}>Select this departure</button>
              ) : (
                <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(async () => {
                  if (!termsAccepted) { setError("You must agree to the Spires Share terms before joining the waitlist."); return; }
                  await call("spiresShareCustomerAction", {
                    action: "join-waitlist",
                    journeyId: row.journeyId,
                    passengers: form.passengers,
                    name: contact.name,
                    mobile: contact.mobile,
                    email: contact.email,
                    termsAccepted,
                    intendedDestinationText: form.intendedDestinationText,
                    sharedDropoffAcknowledged: form.sharedDropoffAcknowledged,
                    dropoffTerminal: "T3",
                    departureTerminal: form.departureTerminal,
                    luggage: { largeSuitcases: form.largeSuitcases, cabinBags: form.cabinBags, other: "" },
                  });
                  await loadDashboard();
                  await loadJourneys();
                  setView("mine");
                  setStatus("You have joined the waitlist. A place is not secured and you have not been charged.");
                })}>Join waitlist</button>
              )}
            </article>
          ))}
          {selected ? (
            <form onSubmit={(event) => {
              event.preventDefault();
              run(async () => {
                if (!termsAccepted) { setError("You must agree to the Spires Share terms before registering interest."); return; }
                if (selected.destinationMatchingEnabled && !form.intendedDestinationText.trim()) {
                  setError(`Where in ${selected.destinationCity || "the city"} are you travelling to?`);
                  return;
                }
                const data = await call("spiresShareProposeOrJoin", {
                  action: "join",
                  airportId: selected.airportId,
                  publicNumber: selected.publicNumber,
                  journeyId: selected.journeyId,
                  travelDate: selected.travelDate,
                  preferredDepartureTime: selected.departureTime,
                  flexibility: "exact",
                  passengers: form.passengers,
                  flightNumber: form.flightNumber,
                  flightDepartureTime: form.flightDepartureTime,
                  dropoffTerminal: selected.destinationMatchingEnabled ? undefined : "T3",
                  departureTerminal: form.departureTerminal,
                  name: contact.name,
                  mobile: contact.mobile,
                  email: contact.email,
                  termsAccepted,
                  intendedDestinationText: form.intendedDestinationText,
                  intendedDestinationPostcode: form.intendedDestinationPostcode,
                  sharedDropoffAcknowledged: form.sharedDropoffAcknowledged,
                  idempotencyKey: newKey(),
                  luggage: { largeSuitcases: form.largeSuitcases, cabinBags: form.cabinBags, other: "" },
                });
                await loadDashboard();
                await loadJourneys();
                setView("mine");
                setStatus(`Your place is currently provisional on ${data.publicNumber}. This is not yet a confirmed booking.`);
              });
            }}>
              <h4>Join this published journey</h4>
              <p>{gbp(selected.farePence)} per passenger. Registering interest does not confirm the journey and no payment is taken now.</p>
              <div className="share-app-grid">
                <label>Passengers<input type="number" min="1" max="5" value={form.passengers} onChange={(e) => setForm({ ...form, passengers: Number(e.target.value) || 1 })} /></label>
                {selected.destinationMatchingEnabled ? (
                  <label>Intended destination (private)<input value={form.intendedDestinationText} onChange={(e) => setForm({ ...form, intendedDestinationText: e.target.value })} /></label>
                ) : (
                  <>
                    <label>Flight terminal
                      <select value={form.departureTerminal} onChange={(e) => setForm({ ...form, departureTerminal: e.target.value })}>
                        <option value="T2">Terminal 2</option>
                        <option value="T3">Terminal 3</option>
                        <option value="T4">Terminal 4</option>
                        <option value="T5">Terminal 5</option>
                        <option value="UNSURE">Not sure</option>
                      </select>
                    </label>
                    {terminalWarning(form.departureTerminal) ? <p>{terminalWarning(form.departureTerminal)}</p> : null}
                    {form.departureTerminal !== "T3" ? <a href={guideHref(form.departureTerminal)} target="_blank" rel="noopener noreferrer">{guideLinkText(form.departureTerminal)}</a> : null}
                  </>
                )}
                <label>Name<input required value={contact.name} onChange={(e) => setContact({ ...contact, name: e.target.value })} /></label>
                <label>Mobile<input required value={contact.mobile} onChange={(e) => setContact({ ...contact, mobile: e.target.value })} /></label>
                <label>Email<input type="email" required value={contact.email} onChange={(e) => setContact({ ...contact, email: e.target.value })} /></label>
              </div>
              {termsChecks}
              <button type="submit" className="btn-new-booking share-pay-btn" disabled={busy || !termsAccepted || !requestAck}>Register interest</button>
            </form>
          ) : null}
        </>
      ) : null}

      {view === "mine" ? (
        <>
          {dashboard.map((row) => (
            <article key={row.bookingId} className="share-dash-card">
              <p className="share-dash-kicker">{row.originLabel || "Oxford"} → {row.destinationLabel || row.destinationCity}</p>
              {row.journeyStatus === "CONFIRMED" ? <p className="share-confirmed-kicker">Journey confirmed</p> : null}
              <h4>{formatDate(row.travelDate)}</h4>
              <p>Status: {bookingStatusLabel(row)}</p>
              <dl className="share-dash-grid">
                <div><dt>Departure</dt><dd>{row.departureTime}</dd></div>
                {row.flightNumber ? <div><dt>Your flight</dt><dd>{row.flightNumber}{row.departureTerminal ? ` · ${row.departureTerminal}` : ""}{row.flightDepartureTime ? ` · ${row.flightDepartureTime}` : ""}</dd></div> : null}
                {row.destinationMatchingEnabled ? (
                  <>
                    <div><dt>Your intended destination</dt><dd>{row.intendedDestinationText || "Private"}</dd></div>
                    <div><dt>Shared drop off</dt><dd>{row.proposedSharedDropoffDisplayName || "Not selected yet"}</dd></div>
                  </>
                ) : (
                  <div><dt>Shared drop off</dt><dd>Heathrow Terminal 3</dd></div>
                )}
                <div><dt>Fare</dt><dd>{gbp(row.amountDuePence || row.farePence)}</dd></div>
              </dl>
              {row.journeyStatus === "CONFIRMED" ? (
                <>
                  <p className="share-app-status">All required payments received. This shared journey is confirmed.</p>
                  {row.boardingCode ? (
                    <div className="share-boarding">
                      <p className="share-boarding-kicker">Boarding</p>
                      <p>Your verification code</p>
                      <p className="share-boarding-code">{row.boardingCode}</p>
                      <p>Tell your driver this code when boarding.</p>
                      <p>{row.passengerName || "Passenger"} · {row.passengers} seat{row.passengers === 1 ? "" : "s"} · {row.publicNumber}</p>
                      {row.eventName ? <p>{row.eventName} · {row.venueName}</p> : null}
                      {row.tripType === "RETURN" && row.returnDepartureCopy ? (
                        <div>
                          <p>Return to Oxford</p>
                          <p>Meeting point: {row.returnMeetingPoint || row.venueReturnMeetingPoint || "Confirmed before travel"}</p>
                          <p>{row.returnDepartureCopy}</p>
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </>
              ) : (
                <>
                  <p>{row.paymentsReceived || 0} of {row.paymentsRequired || row.capacity} payments received</p>
                  <ProgressDots filled={row.paymentsReceived || 0} total={row.paymentsRequired || row.capacity} />
                  {row.ownPaymentVerified ? (
                    <>
                      <p className="share-app-status">Your payment received</p>
                      <p>Waiting for {row.remainingPaymentsNeeded || 0} remaining payment{(row.remainingPaymentsNeeded || 0) === 1 ? "" : "s"}</p>
                      <p className="share-app-note">There's nothing else you need to do right now. We'll email you when the journey is confirmed.</p>
                    </>
                  ) : row.paymentLinkAvailable ? (
                    <>
                      <p>Your payment: {gbp(row.amountDuePence)} required</p>
                      {row.paymentDeadlineAt ? <p className="share-deadline">Pay within: {formatCountdown(row.paymentDeadlineAt, nowMs)}</p> : null}
                    </>
                  ) : (
                    <p className="share-app-note">Journey not yet confirmed.</p>
                  )}
                  <GuaranteeNotice />
                </>
              )}
              {row.paymentSubmittedNotice ? <p className="share-app-status">Payment submitted. We are confirming your payment. Your journey will show as paid once Spires Taxis has verified it.</p> : null}
              {row.departureTerminal && String(row.destinationLabel || "").toLowerCase().includes("heathrow") ? (
                <p className="share-app-note">{terminalWarning(row.departureTerminal)} {row.departureTerminal !== "T3" ? <a href={row.terminalGuideUrl || guideHref(row.departureTerminal)} target="_blank" rel="noopener noreferrer">{row.terminalGuideLabel || guideLinkText(row.departureTerminal)}</a> : "No terminal transfer required."}</p>
              ) : null}
              {row.destinationMatchingEnabled && row.canAcceptSharedDropoff ? (
                <div className="share-offer">
                  <h4>Proposed shared drop off</h4>
                  <p>{row.proposedSharedDropoffDisplayName}</p>
                  <p>Your intended destination: {row.intendedDestinationText}</p>
                  <p>You will need to make your own onward journey from {row.proposedSharedDropoffDisplayName}.</p>
                  <div className="share-app-actions">
                    <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "accept-shared-dropoff", bookingId: row.bookingId }); await loadDashboard(); setStatus("Shared drop off accepted."); })}>Accept drop off</button>
                    <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "decline-shared-dropoff", bookingId: row.bookingId }); await loadDashboard(); setStatus("Proposed drop off declined. Your place has been released."); })}>Decline</button>
                  </div>
                </div>
              ) : null}
              {row.fourPassengerOffer?.available ? (
                <div className="share-offer">
                  <h4>Four passenger departure option</h4>
                  <p>We currently have four passengers ready to travel. The journey can still operate if all four passengers agree to a total fare of £43.75 each. You have already paid £35. If everyone accepts, an additional £8.75 payment will be required.</p>
                  <div className="share-app-actions">
                    <button type="button" className="btn-secondary" disabled={busy || row.fourPassengerOffer.accepted} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "accept-four-passenger", bookingId: row.bookingId }); await loadDashboard(); setStatus("Four passenger option accepted."); })}>Accept £43.75 fare</button>
                    <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "reject-four-passenger", bookingId: row.bookingId }); await loadDashboard(); setStatus("Four passenger option declined."); })}>Decline</button>
                  </div>
                </div>
              ) : null}
              <div className="share-app-actions">
                {row.paymentLinkAvailable ? (
                  <button type="button" className="btn-new-booking share-pay-btn" disabled={busy} onClick={() => run(async () => {
                    const data = await call("spiresShareGetPaymentLink", { bookingId: row.bookingId });
                    await call("spiresShareCustomerAction", { action: "payment-submitted", bookingId: row.bookingId });
                    window.location.href = data.url;
                  })}>Pay {gbp(row.fourPassengerOffer?.available && row.journeyStatus === "SUPPLEMENT_PAYMENT" ? row.fourPassengerOffer.additionalPence : row.amountDuePence)}</button>
                ) : null}
                <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "cancel", bookingId: row.bookingId }); await loadDashboard(); setStatus("Reservation cancelled."); })}>Cancel reservation</button>
              </div>
            </article>
          ))}

          {myInterest.map((row) => (
            <article key={row.interestEntryId} className="share-dash-card">
              <p className="share-dash-kicker">{row.origin} → {row.venueName || row.destinationRegion}</p>
              {row.eventName ? <p>EVENT · {row.eventName}</p> : null}
              <h4>{formatDate(row.travelDate)}</h4>
              <p>Status: {interestStatusLabel(row)}</p>
              <p>{row.placesLabel || `${row.interestedSeatCount || 0} / ${row.requiredSeats || 5} interested`}</p>
              <ProgressDots filled={row.interestedSeatCount || 0} total={row.requiredSeats || 5} />
              <p className="share-needed">{row.enoughInterest ? "Enough interest received. Payment has not confirmed this journey." : row.neededLabel}</p>
              {row.interestDeadlineAt ? <p className="share-deadline">Registration closes in: {formatCountdown(row.interestDeadlineAt, nowMs)}</p> : null}
              {row.groupStatus === "EXPIRED" ? <p className="share-app-note">Not enough interest. No payment was taken.</p> : <p className="share-app-note">We'll email you when enough passengers have registered. Registering interest does not confirm the journey.</p>}
              <p>Preferred departure: {row.preferredDepartureTime || row.timeLabel}. Passengers: {row.passengers}</p>
              {row.intendedDestinationText ? <p className="share-app-note">Your intended destination (private): {row.intendedDestinationText}</p> : null}
              {row.departureTerminal ? <p className="share-app-note">{terminalWarning(row.departureTerminal)} {row.departureTerminal !== "T3" ? <a href={guideHref(row.departureTerminal)} target="_blank" rel="noopener noreferrer">{guideLinkText(row.departureTerminal)}</a> : null}</p> : null}
              {row.canAcceptProposal ? (
                <div className="share-offer">
                  <h4>Your shared journey is ready to review</h4>
                  <p>Departure: {row.proposedDepartureLocation} at {row.proposedDepartureTime}. {gbp(row.proposedFarePence)} per passenger.</p>
                  <p className="share-app-note">You must accept this proposed departure before payment. Registering interest at an approximate time does not commit you to this time.</p>
                  <div className="share-app-actions">
                    <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "accept-interest-proposal", interestEntryId: row.interestEntryId }); await loadDashboard(); setStatus("Proposed journey accepted."); })}>Accept journey</button>
                    <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "decline-interest-proposal", interestEntryId: row.interestEntryId }); await loadDashboard(); setStatus("Proposed journey declined."); })}>Decline</button>
                  </div>
                </div>
              ) : null}
              {row.canUpdate ? (
                <>
                  {editingInterestId === row.interestEntryId ? (
                    <div className="share-offer">
                      <h4>Update your interest</h4>
                      <p className="share-app-note">If the new time no longer overlaps this group, we will move you to a compatible group or create a new request. This cannot be changed once an exact journey has been proposed.</p>
                      <div className="share-app-grid">
                        <label>Preferred departure
                          <input type="time" value={interestPatch.preferredDepartureTime} onChange={(e) => setInterestPatch({ ...interestPatch, preferredDepartureTime: e.target.value })} />
                        </label>
                        <label>Flexibility
                          <select value={interestPatch.flexibility} onChange={(e) => setInterestPatch({ ...interestPatch, flexibility: e.target.value })}>
                            <option value="exact">Exact time</option>
                            <option value="plus_minus_15">15 minutes either side</option>
                            <option value="plus_minus_30">30 minutes either side</option>
                            <option value="plus_minus_60">60 minutes either side</option>
                          </select>
                        </label>
                        <label>Passengers
                          <input type="number" min="1" max="5" value={interestPatch.passengers} onChange={(e) => setInterestPatch({ ...interestPatch, passengers: Number(e.target.value) || 1 })} />
                        </label>
                        {row.intendedDestinationText || isCityDest(row.destinationRegion) ? (
                          <label>Intended destination (private)
                            <input value={interestPatch.intendedDestinationText} onChange={(e) => setInterestPatch({ ...interestPatch, intendedDestinationText: e.target.value })} />
                          </label>
                        ) : null}
                        {isHeathrowDest(row.destinationRegion) ? (
                          <>
                            <label>Flight number
                              <input value={interestPatch.flightNumber} onChange={(e) => setInterestPatch({ ...interestPatch, flightNumber: e.target.value })} />
                            </label>
                            <label>Flight time
                              <input type="time" value={interestPatch.flightDepartureTime} onChange={(e) => setInterestPatch({ ...interestPatch, flightDepartureTime: e.target.value })} />
                            </label>
                            <label>Flight terminal
                              <select value={interestPatch.departureTerminal} onChange={(e) => setInterestPatch({ ...interestPatch, departureTerminal: e.target.value })}>
                                <option value="T2">Terminal 2</option>
                                <option value="T3">Terminal 3</option>
                                <option value="T4">Terminal 4</option>
                                <option value="T5">Terminal 5</option>
                                <option value="UNSURE">Not sure</option>
                              </select>
                            </label>
                          </>
                        ) : null}
                      </div>
                      <div className="share-app-actions">
                        <button type="button" className="btn-secondary" disabled={busy} onClick={() => run(async () => {
                          const data = await call("spiresShareCustomerAction", {
                            action: "update-interest",
                            interestEntryId: row.interestEntryId,
                            origin: row.origin,
                            destinationRegion: row.destinationRegion,
                            travelDate: row.travelDate,
                            preferredDepartureTime: interestPatch.preferredDepartureTime,
                            flexibility: interestPatch.flexibility,
                            passengers: interestPatch.passengers,
                            intendedDestinationText: interestPatch.intendedDestinationText,
                            sharedDropoffAcknowledged: true,
                            flightNumber: interestPatch.flightNumber,
                            flightDepartureTime: interestPatch.flightDepartureTime,
                            departureTerminal: interestPatch.departureTerminal,
                          });
                          await loadDashboard();
                          setEditingInterestId("");
                          setStatus(data?.rematched ? "Your request was moved to a compatible interest group because the time no longer matched." : "Interest updated.");
                        })}>Save changes</button>
                        <button type="button" className="btn-secondary" onClick={() => setEditingInterestId("")}>Cancel</button>
                      </div>
                    </div>
                  ) : (
                    <div className="share-app-actions">
                      <button type="button" className="btn-secondary" onClick={() => {
                        setEditingInterestId(row.interestEntryId);
                        setInterestPatch({
                          preferredDepartureTime: row.preferredDepartureTime || "10:00",
                          flexibility: row.flexibility || "plus_minus_30",
                          passengers: Number(row.passengers || 1),
                          intendedDestinationText: row.intendedDestinationText || "",
                          flightNumber: row.flightNumber || "",
                          flightDepartureTime: row.flightDepartureTime || "",
                          departureTerminal: row.departureTerminal || "T3",
                        });
                      }}>Update details</button>
                      <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "withdraw-interest", interestEntryId: row.interestEntryId }); await loadDashboard(); setStatus("Interest withdrawn. This was an unpaid request, not a paid cancellation."); })}>Withdraw interest</button>
                    </div>
                  )}
                </>
              ) : null}
            </article>
          ))}

          {myWaitlist.map((row) => (
            <article key={row.waitlistId} className="share-dash-card">
              <p className="share-dash-kicker">{row.originLabel} → {row.destinationLabel}</p>
              <h4>{formatDate(row.travelDate)}</h4>
              <p>Status: {waitlistStatusLabel(row)}</p>
              <p>You're on the waitlist. We'll contact you if a suitable place becomes available.</p>
              {row.canClaim ? (
                <div className="share-offer">
                  <h4>A place is available</h4>
                  <p>A place has become available on your Spires Share journey. You have 60 minutes to claim it before it may be offered to the next passenger.</p>
                  {row.offerExpiresAt ? <p className="share-deadline">You have until {formatDeadline(row.offerExpiresAt)} to claim this place.</p> : null}
                  <div className="share-app-actions">
                    <button type="button" className="btn-new-booking share-pay-btn" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "claim-waitlist", waitlistId: row.waitlistId }); await loadDashboard(); setStatus("Place claimed. Complete any remaining acceptance and payment steps. You have not been charged automatically."); })}>Claim place</button>
                    <button type="button" className="btn-logout" disabled={busy} onClick={() => run(async () => { await call("spiresShareCustomerAction", { action: "decline-waitlist", waitlistId: row.waitlistId }); await loadDashboard(); setStatus("Waitlist offer declined."); })}>Decline</button>
                  </div>
                </div>
              ) : null}
            </article>
          ))}
        </>
      ) : null}
    </section>
  );
}
