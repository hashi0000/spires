import React, { useState, useEffect, useRef } from "react";
import { recordPortalLead } from "../savedLead";
import { auth, db, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { SPIRES_BANK_DETAILS, isBankTransferMethod } from "../bankDetails";
import {
  VEHICLE_TYPES,
  VEHICLE_ALLOCATION_DISCLAIMER,
  executiveServicePublic,
  maxPassengersForVehicle,
} from "../vehicleTypes";
import { classifyExecutiveJourney } from "../executiveService";
import {
  airportWaitingWebsiteBody,
  fixedTimeAcknowledgement,
  fixedTimeExplanation,
  CURRENT_WAITING_VERSION,
} from "../airportWaitingPolicy";
import "../styles.css";
import LocationField from "./LocationField";
import CotswoldsFields from "./CotswoldsFields";
import JourneyAssistance from './JourneyAssistance';
import { CURRENT_BOOKING_TERMS } from "../generatedDocuments/bookingTerms";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash (pay driver)" },
  { value: "card", label: "Card (pay driver)" },
  { value: "bank transfer", label: "Bank transfer" },
  { value: "undecided", label: "Not decided yet" },
];

const OPEN_RETURN_NOTICE = "For a return pickup in Oxford, please give your driver at least 30 minutes' notice. For pickups outside Oxford, contact us to confirm the notice needed.";

function named(prefix, name) {
  return prefix ? prefix + name.charAt(0).toUpperCase() + name.slice(1) : name;
}

function collectionError(form, prefix) {
  const active = prefix ? form.returnAirportCollection : form.airportCollection;
  if (!active) return "";
  const kind = form[named(prefix, "collectionLocationKind")] === "hotel" ? "hotel" : "terminal";
  const arrangement = kind === "hotel" || form[named(prefix, "collectionArrangement")] === "fixed_time" ? "fixed_time" : "flight_monitored";
  if (!String(form[named(prefix, "collectionLocation")] || "").trim()) return "Enter the exact collection location, including the terminal or hotel.";
  const flight = prefix ? form.returnFlightNumber : form.flightNumber;
  if (arrangement === "flight_monitored") {
    if (!String(flight || "").trim()) return "Flight monitored collection needs the flight number.";
    if (!/^\d{4}-\d{2}-\d{2}$/.test(String(form[named(prefix, "arrivalDate")] || ""))) return "Flight monitored collection needs the arrival date.";
  }
  if (arrangement === "fixed_time" && form[named(prefix, "fixedTimeAcknowledged")] !== true) {
    return "Tick the box to confirm this collection time will not be flight monitored.";
  }
  return "";
}

function collectionPayload(form, prefix) {
  const active = prefix ? form.returnAirportCollection : form.airportCollection;
  if (!active) return {};
  const kind = form[named(prefix, "collectionLocationKind")] === "hotel" ? "hotel" : "terminal";
  const arrangement = kind === "hotel" || form[named(prefix, "collectionArrangement")] === "fixed_time" ? "fixed_time" : "flight_monitored";
  return {
    [named(prefix, "collectionLocationKind")]: kind,
    [named(prefix, "collectionArrangement")]: arrangement,
    [named(prefix, "collectionLocation")]: String(form[named(prefix, "collectionLocation")] || "").trim(),
    [named(prefix, "arrivalDate")]: String(form[named(prefix, "arrivalDate")] || ""),
    [named(prefix, "precedingFlight")]: form[named(prefix, "precedingFlight")] === true,
    [named(prefix, "travellingIndependently")]: form[named(prefix, "travellingIndependently")] === true,
    [named(prefix, "assistanceRequested")]: form[named(prefix, "assistanceRequested")] === true,
    [named(prefix, "assistanceNote")]: String(form[named(prefix, "assistanceNote")] || "").trim(),
    [named(prefix, "walkingAid")]: form[named(prefix, "walkingAid")] === true,
    [named(prefix, "wheelchairCarriage")]: form[named(prefix, "wheelchairCarriage")] === true,
    [named(prefix, "fixedTimeAcknowledged")]: arrangement === "fixed_time" && form[named(prefix, "fixedTimeAcknowledged")] === true,
  };
}

function CollectionChoices({ formData, setFormData, prefix }) {
  const kind = formData[named(prefix, "collectionLocationKind")] === "hotel" ? "hotel" : "terminal";
  const arrangement = kind === "hotel" || formData[named(prefix, "collectionArrangement")] === "fixed_time" ? "fixed_time" : "flight_monitored";
  const set = (patch) => setFormData(Object.assign({}, formData, patch));
  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      <label>Collection place
        <select value={kind} onChange={(event) => set({ [named(prefix, "collectionLocationKind")]: event.target.value, [named(prefix, "collectionArrangement")]: event.target.value === "hotel" ? "fixed_time" : formData[named(prefix, "collectionArrangement")] || "flight_monitored" })}>
          <option value="terminal">Airport terminal</option>
          <option value="hotel">Airport hotel</option>
        </select>
      </label>
      <label>Exact collection location
        <input value={formData[named(prefix, "collectionLocation")] || ""} onChange={(event) => set({ [named(prefix, "collectionLocation")]: event.target.value })} placeholder={kind === "hotel" ? "Hotel name and address" : "Terminal and meeting point"} />
      </label>
      {kind === "terminal" ? (
        <label>Collection arrangement
          <select value={arrangement} onChange={(event) => set({ [named(prefix, "collectionArrangement")]: event.target.value, [named(prefix, "fixedTimeAcknowledged")]: false })}>
            <option value="flight_monitored">Flight monitored collection</option>
            <option value="fixed_time">Fixed time collection</option>
          </select>
        </label>
      ) : <p>A hotel collection uses the fixed time arrangement. A delay to an earlier flight does not move this pickup unless we agree a different time.</p>}
      {arrangement === "flight_monitored" ? (
        <label>Arrival date
          <input type="date" value={formData[named(prefix, "arrivalDate")] || ""} onChange={(event) => set({ [named(prefix, "arrivalDate")]: event.target.value })} />
        </label>
      ) : (
        <div>
          <p>{fixedTimeExplanation()}</p>
          <p>A flight number can be kept for reference. It is not monitored on this booking.</p>
          <label>
            <input type="checkbox" checked={formData[named(prefix, "fixedTimeAcknowledged")] === true} onChange={(event) => set({ [named(prefix, "fixedTimeAcknowledged")]: event.target.checked })} />
            {" "}{fixedTimeAcknowledgement()}
          </label>
        </div>
      )}
      {kind === "hotel" ? (
        <div>
          <label><input type="checkbox" checked={formData[named(prefix, "precedingFlight")] === true} onChange={(event) => set({ [named(prefix, "precedingFlight")]: event.target.checked })} /> Arriving on a flight before this hotel collection</label>
          <label><input type="checkbox" checked={formData[named(prefix, "travellingIndependently")] === true} onChange={(event) => set({ [named(prefix, "travellingIndependently")]: event.target.checked })} /> Travelling independently to the hotel</label>
        </div>
      ) : null}
      {prefix ? <>
      <label><input type="checkbox" checked={formData[named(prefix, "assistanceRequested")] === true} onChange={(event) => set({ [named(prefix, "assistanceRequested")]: event.target.checked })} /> Someone needs extra time or practical assistance boarding. This is subject to confirmation.</label>
      {formData[named(prefix, "assistanceRequested")] ? (
        <div>
          <textarea value={formData[named(prefix, "assistanceNote")] || ""} onChange={(event) => set({ [named(prefix, "assistanceNote")]: event.target.value })} placeholder="What practical help is needed?" />
          <label><input type="checkbox" checked={formData[named(prefix, "walkingAid")] === true} onChange={(event) => set({ [named(prefix, "walkingAid")]: event.target.checked })} /> Walking aid</label>
          <label><input type="checkbox" checked={formData[named(prefix, "wheelchairCarriage")] === true} onChange={(event) => set({ [named(prefix, "wheelchairCarriage")]: event.target.checked })} /> Wheelchair to be carried as luggage</label>
        </div>
      ) : null}
      </> : null}
    </div>
  );
}

function buildStops(start, end, startPlace, endPlace, middle) {
  return [
    { id: "start", type: "pickup", address: String(start || "").trim(), notes: "", place: startPlace || null },
    ...(middle || []).map((stop, index) => ({
      id: stop.id || `mid-${index}`,
      type: stop.type === "pickup" ? "pickup" : "dropoff",
      address: String(stop.address || "").trim(),
      notes: String(stop.notes || "").trim(),
      place: stop.place || null,
    })),
    { id: "end", type: "dropoff", address: String(end || "").trim(), notes: "", place: endPlace || null },
  ];
}

function describeStops(stops) {
  return stops
    .filter((stop) => stop.address)
    .map((stop, index) => `${index + 1}. ${stop.type === "pickup" ? "Pickup" : "Drop off"}: ${stop.address}${stop.notes ? ` (${stop.notes})` : ""}`)
    .join("; ");
}

function ExtraStops({ stops, onChange }) {
  const rows = stops || [];
  const update = (index, patch) => onChange(rows.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  const move = (index, direction) => {
    const target = index + direction;
    if (target < 0 || target >= rows.length) return;
    const next = [...rows];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };
  return (
    <div style={{ display: "grid", gap: "0.5rem" }}>
      {rows.map((stop, index) => (
        <div id={stop.id} key={stop.id} style={{ display: "grid", gap: "0.35rem", padding: "0.5rem", border: "1px solid #dbe3ee", borderRadius: 8, scrollMargin: "5rem" }}>
          <div style={{ display: "flex", gap: "0.4rem", flexWrap: "wrap" }}>
            <select value={stop.type} onChange={(event) => update(index, { type: event.target.value })}>
              <option value="pickup">Pickup</option>
              <option value="dropoff">Drop off</option>
            </select>
            <button type="button" onClick={() => move(index, -1)} disabled={index === 0}>Move up</button>
            <button type="button" onClick={() => move(index, 1)} disabled={index === rows.length - 1}>Move down</button>
            <button type="button" onClick={() => onChange(rows.filter((_, i) => i !== index))}>Remove</button>
          </div>
          <LocationField placeholder="Stop address" value={stop.address} onChange={(value, place) => update(index, { address: value, place })} />
          <input placeholder="Note, optional" value={stop.notes || ""} onChange={(event) => update(index, { notes: event.target.value })} />
        </div>
      ))}
      <button type="button" onClick={() => {
        const id = `mid-${Date.now()}`;
        onChange([...rows, { id, type: "dropoff", address: "", notes: "" }]);
        window.setTimeout(() => document.getElementById(id)?.scrollIntoView({ block: "center" }), 0);
      }}>Add a stop</button>
    </div>
  );
}

const TERMS_VERSION = CURRENT_BOOKING_TERMS.version;
const TERMS_URL = CURRENT_BOOKING_TERMS.url;
const createCustomerBooking = httpsCallable(functions, "createCustomerBooking");

function splitLocalDateTime(value) {
  const raw = String(value || "").trim();
  if (!raw) return { date: "", time: "" };
  if (raw.includes("T")) {
    const [date, rest] = raw.split("T");
    return { date: date || "", time: (rest || "").slice(0, 5) };
  }
  return { date: "", time: "" };
}

function combineLocalDateTime(date, time) {
  if (!date) return "";
  return `${date}T${time || "00:00"}`;
}

function requestedBooking() {
  const params = new URLSearchParams(window.location.search);
  const vehicle = params.get("vehicle") || "";
  const allowed = vehicle === "executive" && !executiveServicePublic()
    ? ""
    : ["standard", "8_seater", "executive"].includes(vehicle)
      ? vehicle
      : "";
  return {
    vehicleType: allowed,
    pickup: params.get("pickup") || "",
    destination: params.get("destination") || "",
  };
}

export default function BookingForm({ onClose, onBookingCreated }) {
  const [formData, setFormData] = useState({
    phone: "",
    pickup: "",
    destination: "",
    dateTime: "",
    passengers: "1",
    luggage: "0",
    specialRequirements: "",
    bookingType: "one_way",
    returnTrip: false,
    returnDateTime: "",
    returnPickupTime: "",
    returnPickupLocation: "",
    returnDestination: "",
    openReturn: false,
    returnDate: "",
    returnNoticeNote: "",
    middleStops: [],
    returnMiddleStops: [],
    airportCollection: false,
    collectionLocationKind: "terminal",
    collectionArrangement: "flight_monitored",
    collectionLocation: "",
    arrivalDate: "",
    precedingFlight: false,
    travellingIndependently: false,
    assistanceRequested: false,
    assistanceNote: "",
    walkingAid: false,
    wheelchairCarriage: false,
    fixedTimeAcknowledged: false,
    returnAirportCollection: false,
    returnCollectionLocationKind: "terminal",
    returnCollectionArrangement: "flight_monitored",
    returnCollectionLocation: "",
    returnArrivalDate: "",
    returnFixedTimeAcknowledged: false,
    returnFlightNumber: "",
    notes: "",
    paymentMethod: "",
    flightNumber: "",
    terminal: "",
    ...requestedBooking(),
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedPickupAddress, setSelectedPickupAddress] = useState("");
  const [selectedDestinationAddress, setSelectedDestinationAddress] = useState("");
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const [termsError, setTermsError] = useState("");
  const termsCheckboxRef = useRef(null);
  const submitLock = useRef(false);
  const submissionId = useRef(null);
  const [submitting, setSubmitting] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadUserData = async () => {
      const user = auth.currentUser;
      if (!user) {
        setLoading(false);
        return;
      }

      try {
        // Get user data from Firestore customer profile
        const userDoc = await getDoc(doc(db, "customers", user.uid));
        if (userDoc.exists()) {
          const data = userDoc.data();
          if (data.phone) {
            setFormData(prev => ({ ...prev, phone: data.phone }));
          }
          // Load saved addresses
          if (data.addresses && Array.isArray(data.addresses)) {
            setSavedAddresses(data.addresses);
          }
        }
      } catch (err) {
        console.error("Error loading user data:", err);
      } finally {
        setLoading(false);
      }
    };

    loadUserData();
  }, []);

  // Format address for display
  const formatAddress = (addr) => {
    if (typeof addr === 'string') return addr; // Legacy format
    const parts = [];
    if (addr.firstLine) parts.push(addr.firstLine);
    if (addr.postcode) parts.push(addr.postcode);
    if (addr.county) parts.push(addr.county);
    return parts.length > 0 ? parts.join(', ') : (addr.address || '');
  };

  // Handle address selection for pickup
  const handlePickupAddressSelect = (addr) => {
    const formattedAddress = formatAddress(addr);
    setSelectedPickupAddress(formattedAddress);
    setFormData(prev => ({ ...prev, pickup: formattedAddress }));
  };

  // Handle address selection for destination
  const handleDestinationAddressSelect = (addr) => {
    const formattedAddress = formatAddress(addr);
    setSelectedDestinationAddress(formattedAddress);
    setFormData(prev => ({ ...prev, destination: formattedAddress }));
  };

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData({
      ...formData,
      [name]: value,
    });
    // Clear selected address if user manually types
    if (name === 'pickup' && value !== selectedPickupAddress) {
      setSelectedPickupAddress("");
    }
    if (name === 'destination' && value !== selectedDestinationAddress) {
      setSelectedDestinationAddress("");
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (submitLock.current) return;
    submitLock.current = true;
    setError("");
    setSubmitting(true);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to create a booking.");
      setSubmitting(false);
      submitLock.current = false;
      return;
    }

    if (!formData.paymentMethod) {
      setError("Please choose how you would like to pay.");
      setSubmitting(false);
      submitLock.current = false;
      return;
    }

    if (!formData.vehicleType) {
      setError("Please choose a Standard Car or 8 Seater.");
      setSubmitting(false);
      submitLock.current = false;
      return;
    }

    const passengers = parseInt(formData.passengers, 10) || 1;
    if (formData.vehicleType === "executive") {
      const executiveJourney = classifyExecutiveJourney({
        pickup: formData.pickup,
        destination: formData.destination,
        bookingType: formData.bookingType,
        journeyType: formData.journeyType,
        returnPickup: formData.returnPickupLocation,
        returnDestination: formData.returnDestination,
        stops: buildStops(formData.pickup, formData.destination, formData.pickupPlace, formData.destinationPlace, formData.middleStops),
        returnStops: formData.bookingType === "return"
          ? buildStops(formData.returnPickupLocation, formData.returnDestination, null, null, formData.returnMiddleStops)
          : [],
      });
      if (!executiveJourney.ok) {
        setError(executiveJourney.error);
        setSubmitting(false);
        submitLock.current = false;
        return;
      }
      if (passengers < 1 || passengers > 8) {
        setError("Enter the number of passengers travelling, from 1 to 8. We confirm that an Executive Car is suitable before we accept the booking.");
        setSubmitting(false);
        submitLock.current = false;
        return;
      }
    }
    const maxPax = maxPassengersForVehicle(formData.vehicleType);
    if (formData.vehicleType !== "executive" && passengers > maxPax) {
      setError(
        formData.vehicleType === "8_seater"
          ? "An 8 Seater can take up to 8 passengers."
          : "A Standard Car can take up to 4 passengers. Please choose the 8 Seater for larger groups."
      );
      setSubmitting(false);
      submitLock.current = false;
      return;
    }

    const isReturn = formData.bookingType === "return";
    const stops = buildStops(formData.pickup, formData.destination, formData.pickupPlace, formData.destinationPlace, formData.middleStops);
    if (stops.some((stop) => !stop.address)) {
      setError("Every stop needs a full address, and the journey needs a pickup and a drop off.");
      setSubmitting(false);
      submitLock.current = false;
      return;
    }
    if (isReturn) {
      const returnStops = buildStops(formData.returnPickupLocation, formData.returnDestination, null, null, formData.returnMiddleStops);
      if (returnStops.some((stop) => !stop.address) || !(formData.openReturn ? formData.returnDate : formData.returnPickupTime)) {
        setError(formData.openReturn ? "An open return needs the return date, pickup and destination." : "Return bookings need a return date, pickup time, pickup address and destination.");
        setSubmitting(false);
        submitLock.current = false;
        return;
      }
    }

    if (formData.airportCollection === true && collectionError(formData, "")) {
      setError(collectionError(formData, ""));
      setSubmitting(false);
      submitLock.current = false;
      return;
    }
    if (isReturn && formData.returnAirportCollection === true && collectionError(formData, "return")) {
      setError(collectionError(formData, "return"));
      setSubmitting(false);
      submitLock.current = false;
      return;
    }

    if (!termsAccepted) {
      setTermsError("Please agree to the Terms and Conditions before submitting.");
      setError("");
      setSubmitting(false);
      submitLock.current = false;
      window.setTimeout(() => {
        const box = termsCheckboxRef.current;
        if (!box) return;
        box.focus();
        box.scrollIntoView({ block: "center", behavior: "smooth" });
      }, 0);
      return;
    }
    setTermsError("");

    try {
      const marketingAttribution = window.SpiresMeasurement ? await window.SpiresMeasurement.attribution().catch(() => null) : null;
      if (!submissionId.current) submissionId.current = window.crypto.randomUUID();
      const result = await createCustomerBooking({
        submissionId: submissionId.current,
        marketingAttribution,
        name: user.displayName || user.email?.split("@")[0] || "Customer",
        phone: formData.phone || "",
        pickup: formData.pickup,
        destination: formData.destination,
        pickupPlace: formData.pickupPlace || null,
        destinationPlace: formData.destinationPlace || null,
        dateTime: formData.dateTime,
        passengers,
        luggage: parseInt(formData.luggage, 10) || 0,
        specialRequirements: formData.specialRequirements || "",
        bookingType: isReturn ? "return" : "one_way",
        assistanceRequested: formData.assistanceRequested === true,
        assistanceNote: formData.assistanceNote || '', walkingAid: formData.walkingAid === true, wheelchairCarriage: formData.wheelchairCarriage === true,
        journeyType: formData.journeyType || 'transfer',
        hireHours: formData.hireHours || '6',
        hireItinerary: formData.hireItinerary || '',
        timedHireAccepted: formData.timedHireAccepted === true,
        stops,
        returnStops: isReturn ? buildStops(formData.returnPickupLocation, formData.returnDestination, null, null, formData.returnMiddleStops) : [],
        openReturn: isReturn && formData.openReturn === true,
        returnDate: isReturn ? (formData.openReturn ? formData.returnDate : String(formData.returnPickupTime || "").slice(0, 10)) : "",
        returnNoticeNote: isReturn && formData.openReturn ? formData.returnNoticeNote : "",
        returnPickupTime: isReturn && !formData.openReturn ? formData.returnPickupTime : "",
        returnPickupLocation: isReturn ? String(formData.returnPickupLocation || "").trim() : "",
        returnDestination: isReturn ? String(formData.returnDestination || "").trim() : "",
        airportCollection: formData.airportCollection === true,
        returnAirportCollection: isReturn && formData.returnAirportCollection === true,
        returnFlightNumber:
          isReturn && formData.returnAirportCollection === true
            ? String(formData.returnFlightNumber || "").trim()
            : "",
        notes: formData.notes || "",
        paymentMethod: formData.paymentMethod,
        vehicleType: formData.vehicleType,
        flightNumber: formData.airportCollection ? formData.flightNumber || "" : "",
        terminal: formData.terminal || "",
        waitingPolicyVersion: formData.airportCollection || (isReturn && formData.returnAirportCollection) ? CURRENT_WAITING_VERSION : "",
        ...collectionPayload(formData, ""),
        ...collectionPayload(formData, "return"),
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
      });

      try { recordPortalLead(window.SpiresMeasurement, result.data); } catch (_) { /* Measurement must not interrupt a saved booking. */ }
      submissionId.current = null;
      onBookingCreated();
    } catch (err) {
      console.error("Error creating booking:", err);
      const serverMessage = err && typeof err.message === "string" ? err.message : "";
      const fromServer = err && typeof err.code === "string" && err.code.indexOf("functions/") === 0;
      setError(fromServer && serverMessage ? serverMessage : "Failed to create booking. Please try again.");
      setSubmitting(false);
      submitLock.current = false;
    }
  };

  const getMinDate = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 10);
  };

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <p>Loading...</p>
        </div>
      </div>
    );
  }

  const outbound = splitLocalDateTime(formData.dateTime);
  const ret = splitLocalDateTime(formData.returnPickupTime);
  const isReturn = formData.bookingType === "return";
  const labelStyle = { display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' };
  const journeyBox = (color) => ({
    padding: '1rem',
    borderRadius: '10px',
    border: `1px solid ${color === 'green' ? '#bbf7d0' : '#bfdbfe'}`,
    background: color === 'green' ? '#f0fdf4' : '#eff6ff',
  });

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Create New Booking</h2>
        {error && <div className="error">{error}</div>}
        <form onSubmit={handleSubmit} className="modal-form">
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <div>
            <JourneyAssistance formData={formData} setFormData={setFormData} />
            <CotswoldsFields value={formData} vehicleType={formData.vehicleType} onChange={change => setFormData(previous => ({ ...previous, ...change }))} />
            <label style={labelStyle}>Booking type *</label>
            <select
              name="bookingType"
              value={isReturn ? "return" : "one_way"}
              onChange={(e) => {
                const nextType = e.target.value === "return" ? "return" : "one_way";
                setFormData((prev) => ({
                  ...prev,
                  bookingType: nextType,
                  returnTrip: nextType === "return",
                  returnPickupLocation:
                    nextType === "return"
                      ? (prev.returnPickupLocation || prev.destination)
                      : prev.returnPickupLocation,
                  returnDestination:
                    nextType === "return"
                      ? (prev.returnDestination || prev.pickup)
                      : prev.returnDestination,
                }));
              }}
              required
            >
              <option value="one_way">One Way</option>
              <option value="return">Return</option>
            </select>
            <p style={{ margin: '0.4rem 0 0', fontSize: '0.8rem', color: '#6b7280' }}>
              Return stays on this same booking. It does not create a second booking.
            </p>
          </div>

          <div style={journeyBox('green')}>
            <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#14532d' }}>
              {isReturn ? 'Outbound journey *' : 'Journey *'}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
              <div>
                <label style={labelStyle}>Date *</label>
                <input
                  type="date"
                  value={outbound.date}
                  min={getMinDate()}
                  onChange={(e) => setFormData({ ...formData, dateTime: combineLocalDateTime(e.target.value, outbound.time || '00:00') })}
                  required
                />
              </div>
              <div>
                <label style={labelStyle}>Pickup time *</label>
                <input
                  type="time"
                  value={outbound.time}
                  onChange={(e) => setFormData({ ...formData, dateTime: combineLocalDateTime(outbound.date, e.target.value) })}
                  required
                />
              </div>
            </div>
            {savedAddresses.length > 0 && (
              <div>
                <label style={labelStyle}>Saved Addresses (Pickup)</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {savedAddresses.map((addr, idx) => {
                    const formattedAddress = formatAddress(addr);
                    const isSelected = selectedPickupAddress === formattedAddress;
                    return (
                      <button
                        key={idx}
                        type="button"
                        onClick={() => handlePickupAddressSelect(addr)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #1d3c74' : '1px solid #d1d5db',
                          background: isSelected ? '#1d3c74' : '#fff',
                          color: isSelected ? '#fff' : '#0b1c3d',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {addr.nickname}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <LocationField
              placeholder="Pickup location"
              value={formData.pickup}
              required
              onChange={(value, place) => setFormData((prev) => ({ ...prev, pickup: value, pickupPlace: place }))}
            />
            {savedAddresses.length > 0 && (
              <div>
                <label style={labelStyle}>Saved Addresses (Destination)</label>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', marginBottom: '0.5rem' }}>
                  {savedAddresses.map((addr, idx) => {
                    const formattedAddress = formatAddress(addr);
                    const isSelected = selectedDestinationAddress === formattedAddress;
                    return (
                      <button
                        key={`dest-${idx}`}
                        type="button"
                        onClick={() => handleDestinationAddressSelect(addr)}
                        style={{
                          padding: '0.5rem 1rem',
                          borderRadius: '8px',
                          border: isSelected ? '2px solid #1d3c74' : '1px solid #d1d5db',
                          background: isSelected ? '#1d3c74' : '#fff',
                          color: isSelected ? '#fff' : '#0b1c3d',
                          fontSize: '0.875rem',
                          fontWeight: 500,
                          cursor: 'pointer',
                          transition: 'all 0.2s ease'
                        }}
                      >
                        {addr.nickname}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
            <LocationField
              placeholder="Destination"
              value={formData.destination}
              required
              onChange={(value, place) => setFormData((prev) => ({ ...prev, destination: value, destinationPlace: place }))}
            />
            <ExtraStops stops={formData.middleStops} onChange={(middleStops) => setFormData({ ...formData, middleStops })} />
            <p style={{ margin: 0, fontSize: "0.85rem", color: "#0b1c3d" }}>{describeStops(buildStops(formData.pickup, formData.destination, formData.pickupPlace, formData.destinationPlace, formData.middleStops))}</p>
            {formData.middleStops.length > 0 ? <p style={{ margin: 0, fontSize: "0.85rem", color: "#9a3412", fontWeight: 700 }}>Extra stops. Agree the fare.</p> : null}
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#0b1c3d', cursor: 'pointer' }}>
              <input
                type="checkbox"
                checked={formData.airportCollection === true}
                onChange={(e) =>
                  setFormData({
                    ...formData,
                    airportCollection: e.target.checked,
                    flightNumber: e.target.checked ? formData.flightNumber : '',
                  })
                }
                style={{ width: '18px', height: '18px', cursor: 'pointer', marginBottom: 0 }}
              />
              Airport collection
            </label>
            {formData.airportCollection && (
              <div style={{ display: 'grid', gap: '0.75rem', marginTop: '0.5rem' }}>
                <input
                  type="text"
                  name="flightNumber"
                  placeholder="Flight number, e.g. BA123"
                  value={formData.flightNumber}
                  onChange={handleChange}
                />
                <input
                  type="text"
                  name="terminal"
                  placeholder="Terminal, e.g. T5"
                  value={formData.terminal}
                  onChange={handleChange}
                />
                <CollectionChoices formData={formData} setFormData={setFormData} prefix="" />
              </div>
            )}
          </div>

          {isReturn && (
            <div style={journeyBox('blue')}>
              <div style={{ fontWeight: 600, marginBottom: '0.75rem', color: '#1e3a8a' }}>Return journey *</div>
              <div style={{ display: "flex", gap: "1rem", flexWrap: "wrap", marginBottom: "0.75rem" }}>
                <label><input type="radio" name="open-return" checked={!formData.openReturn} onChange={() => setFormData({ ...formData, openReturn: false })} /> Set return pickup time</label>
                <label><input type="radio" name="open-return" checked={formData.openReturn} onChange={() => setFormData({ ...formData, openReturn: true, returnDate: formData.returnDate || ret.date, returnPickupTime: "" })} /> Return time to be confirmed</label>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input
                    type="date"
                    value={formData.openReturn ? (formData.returnDate || ret.date) : (formData.returnDate || ret.date)}
                    min={outbound.date || getMinDate()}
                    onChange={(e) => setFormData({
                      ...formData,
                      returnDate: e.target.value,
                      returnPickupTime: formData.openReturn || !ret.time ? "" : combineLocalDateTime(e.target.value, ret.time),
                    })}
                    required
                  />
                </div>
                {formData.openReturn ? null : (
                <div>
                  <label style={labelStyle}>Pickup time *</label>
                  <input
                    type="time"
                    value={ret.time}
                    onChange={(e) => setFormData({ ...formData, returnPickupTime: e.target.value ? combineLocalDateTime(formData.returnDate || ret.date, e.target.value) : "" })}
                    required
                  />
                </div>
                )}
              </div>
              {formData.openReturn ? (
                <>
                  <p style={{ fontSize: "0.85rem" }}>{OPEN_RETURN_NOTICE}</p>
                  <input placeholder="Customer will contact the driver when ready" value={formData.returnNoticeNote} onChange={(event) => setFormData({ ...formData, returnNoticeNote: event.target.value })} />
                </>
              ) : null}
              <LocationField
                placeholder="Return pickup address"
                value={formData.returnPickupLocation || ''}
                required
                onChange={(value) => setFormData({ ...formData, returnPickupLocation: value })}
              />
              <LocationField
                placeholder="Return destination"
                value={formData.returnDestination || ''}
                required
                onChange={(value) => setFormData({ ...formData, returnDestination: value })}
              />
              <ExtraStops stops={formData.returnMiddleStops} onChange={(returnMiddleStops) => setFormData({ ...formData, returnMiddleStops })} />
              <p style={{ margin: 0, fontSize: "0.85rem" }}>{describeStops(buildStops(formData.returnPickupLocation, formData.returnDestination, null, null, formData.returnMiddleStops))}</p>
              <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500, color: '#0b1c3d', cursor: 'pointer' }}>
                <input
                  type="checkbox"
                  checked={formData.returnAirportCollection === true}
                  onChange={(e) =>
                    setFormData({
                      ...formData,
                      returnAirportCollection: e.target.checked,
                      returnFlightNumber: e.target.checked ? formData.returnFlightNumber : '',
                    })
                  }
                  style={{ width: '18px', height: '18px', cursor: 'pointer', marginBottom: 0 }}
                />
                Airport collection
              </label>
              {formData.returnAirportCollection && (
                <div style={{ display: "grid", gap: "0.75rem" }}>
                  <input
                    type="text"
                    placeholder="Return flight number, e.g. BA123"
                    value={formData.returnFlightNumber || ''}
                    onChange={(e) => setFormData({ ...formData, returnFlightNumber: e.target.value })}
                  />
                  <CollectionChoices formData={formData} setFormData={setFormData} prefix="return" />
                </div>
              )}
            </div>
          )}

          {(formData.airportCollection || formData.returnAirportCollection) && (
            <div style={{
              padding: '0.85rem 1rem',
              borderRadius: '8px',
              border: '1px solid #e8e4da',
              background: '#fbfaf7',
              fontSize: '0.875rem',
              lineHeight: 1.5,
              color: '#0b1c3d',
            }}>
              <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Airport collection</div>
              {airportWaitingWebsiteBody().split('\n\n').map((para) => (
                <p key={para.slice(0, 40)} style={{ margin: '0 0 0.5rem' }}>{para}</p>
              ))}
              <p style={{ margin: 0 }}>The standard airport pickup charge is included in your fare.</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
                Number of Passengers *
              </label>
              <input
                type="number"
                name="passengers"
                placeholder="Passengers"
                value={formData.passengers}
                onChange={handleChange}
                min="1"
                max={maxPassengersForVehicle(formData.vehicleType || "8_seater")}
                required
              />
            </div>
            <div>
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
                Number of Luggage Pieces
              </label>
              <input
                type="number"
                name="luggage"
                placeholder="Luggage"
                value={formData.luggage}
                onChange={handleChange}
                min="0"
                max="10"
              />
            </div>
          </div>

          <div>
            <span style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
              Vehicle class *
            </span>
            <div className="vehicle-picker" role="radiogroup" aria-label="Vehicle class">
              {(executiveServicePublic() ? VEHICLE_TYPES : VEHICLE_TYPES.filter((opt) => opt.value !== "executive")).map((opt) => {
                const selected = formData.vehicleType === opt.value;
                return (
                  <label
                    key={opt.value}
                    className={`vehicle-picker__option${selected ? " is-selected" : ""}`}
                  >
                    <input
                      type="radio"
                      name="vehicleType"
                      value={opt.value}
                      checked={selected}
                      required={opt.value === "standard"}
                      onChange={() => {
                        const maxPax = maxPassengersForVehicle(opt.value);
                        const pax = parseInt(formData.passengers, 10) || 1;
                        setFormData({
                          ...formData,
                          vehicleType: opt.value,
                          passengers: String(Math.min(pax, maxPax)),
                        });
                        if (opt.value === "executive" && window.SpiresMeasurement && window.SpiresMeasurement.engagement) {
                          window.SpiresMeasurement.engagement("executive_option_selected", { service_type: "executive", airport: "heathrow" });
                        }
                      }}
                    />
                    <span className="vehicle-picker__name">{opt.label}</span>
                    <span className="vehicle-picker__examples">{opt.examples}</span>
                    <span className="vehicle-picker__capacity">{opt.capacity}</span>
                  </label>
                );
              })}
            </div>
            <p className="vehicle-disclaimer">{VEHICLE_ALLOCATION_DISCLAIMER}</p>
            {formData.vehicleType === "executive" && (
              <p className="vehicle-disclaimer">Mercedes E Class or equivalent. Advance booking required, subject to availability. Heathrow journeys only. A partner operator may provide the car. Sending this form does not confirm a vehicle or take payment.</p>
            )}
            {parseInt(formData.passengers, 10) > 4 && formData.vehicleType === "standard" && (
              <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#92400e' }}>
                Groups over 4 need the 8 Seater.
              </p>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
              How would you like to pay? *
            </label>
            <select
              name="paymentMethod"
              value={formData.paymentMethod}
              onChange={handleChange}
              required
              style={{
                width: '100%',
                padding: '0.75rem',
                borderRadius: '8px',
                border: '1px solid #d1d5db',
                fontSize: '1rem',
                color: '#0b1c3d',
                background: '#fff',
              }}
            >
              <option value="">Select payment method</option>
              {PAYMENT_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            {isBankTransferMethod(formData.paymentMethod) && (
              <div
                style={{
                  marginTop: '0.75rem',
                  padding: '0.875rem 1rem',
                  borderRadius: '8px',
                  border: '1px solid #C5A572',
                  background: '#faf8f4',
                  fontSize: '0.875rem',
                  lineHeight: 1.5,
                  color: '#0b1c3d',
                }}
              >
                <div style={{ fontWeight: 600, marginBottom: '0.35rem' }}>Bank transfer details</div>
                <div><strong>Account name:</strong> {SPIRES_BANK_DETAILS.accountName}</div>
                <div><strong>Sort code:</strong> {SPIRES_BANK_DETAILS.sortCode}</div>
                <div><strong>Account number:</strong> {SPIRES_BANK_DETAILS.accountNumber}</div>
                <div style={{ marginTop: '0.35rem', color: '#555' }}>
                  After we confirm your fare, please use your booking number as the payment reference.
                </div>
              </div>
            )}
          </div>

          <div>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
              Special Requirements (e.g., wheelchair access, child seat, etc.)
            </label>
            <textarea
              name="specialRequirements"
              placeholder="Any special requirements for your journey"
              value={formData.specialRequirements}
              onChange={handleChange}
              rows="2"
              className="form-textarea"
            />
          </div>

          <textarea
            name="notes"
            placeholder="Additional Notes (optional)"
            value={formData.notes}
            onChange={handleChange}
            rows="3"
            className="form-textarea"
          />
          <div className="terms-submit-row">
            <div className="terms-agreement">
              <label className="terms-agreement__line" htmlFor="terms-accepted">
                <input
                  ref={termsCheckboxRef}
                  id="terms-accepted"
                  type="checkbox"
                  checked={termsAccepted}
                  onChange={(e) => {
                    setTermsAccepted(e.target.checked);
                    if (e.target.checked) setTermsError("");
                  }}
                  aria-describedby="terms-agreement-error"
                  aria-invalid={termsError ? "true" : "false"}
                />
                <span>I agree to the Terms and Conditions</span>
              </label>
              <a
                className="terms-agreement__read"
                href={TERMS_URL}
                target="_blank"
                rel="noopener noreferrer"
              >
                Read the Terms and Conditions
              </a>
              <p id="terms-agreement-error" role="alert" hidden={!termsError}>
                {termsError}
              </p>
            </div>
            <button
              type="submit"
              className="btn-primary"
              disabled={submitting}
            >
              {submitting ? "Creating..." : "Create Booking"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
