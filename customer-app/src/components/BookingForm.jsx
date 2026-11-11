import React, { useState, useEffect, useRef } from "react";
import { recordPortalLead } from "../savedLead";
import { auth, db, functions } from "../firebase";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { SPIRES_BANK_DETAILS, isBankTransferMethod } from "../bankDetails";
import {
  VEHICLE_TYPES,
  VEHICLE_ALLOCATION_DISCLAIMER,
  maxPassengersForVehicle,
} from "../vehicleTypes";
import {
  airportWaitingWebsiteBody,
} from "../airportWaitingPolicy";
import "../styles.css";
import LocationField from "./LocationField";

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash (pay driver)" },
  { value: "card", label: "Card (pay driver)" },
  { value: "bank transfer", label: "Bank transfer" },
  { value: "undecided", label: "Not decided yet" },
];

const OPEN_RETURN_NOTICE = "For a return pickup in Oxford, please give your driver at least 30 minutes' notice. For pickups outside Oxford, contact us to confirm the notice needed.";

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

const TERMS_VERSION = "2026-10-25";
const TERMS_URL = "https://www.spires-taxis.com/terms/2026-10-25";
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
    returnAirportCollection: false,
    returnFlightNumber: "",
    notes: "",
    paymentMethod: "",
    flightNumber: "",
    terminal: "",
    vehicleType: "",
  });
  const [savedAddresses, setSavedAddresses] = useState([]);
  const [selectedPickupAddress, setSelectedPickupAddress] = useState("");
  const [selectedDestinationAddress, setSelectedDestinationAddress] = useState("");
  const [error, setError] = useState("");
  const [termsAccepted, setTermsAccepted] = useState(false);
  const submitLock = useRef(false);
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
    const maxPax = maxPassengersForVehicle(formData.vehicleType);
    if (passengers > maxPax) {
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

    if (!termsAccepted) {
      setError("Please agree to the Terms and Conditions before submitting.");
      setSubmitting(false);
      submitLock.current = false;
      return;
    }

    try {
      const marketingAttribution = window.SpiresMeasurement ? await window.SpiresMeasurement.attribution().catch(() => null) : null;
      const result = await createCustomerBooking({
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
        termsAccepted: true,
        termsVersion: TERMS_VERSION,
      });

      try { recordPortalLead(window.SpiresMeasurement, result.data); } catch (_) { /* Measurement must not interrupt a saved booking. */ }
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem', marginTop: '0.5rem' }}>
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
                <input
                  type="text"
                  placeholder="Return flight number, e.g. BA123"
                  value={formData.returnFlightNumber || ''}
                  onChange={(e) => setFormData({ ...formData, returnFlightNumber: e.target.value })}
                />
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
              {VEHICLE_TYPES.map((opt) => {
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
          <div className="terms-agreement">
            <input
              id="terms-accepted"
              type="checkbox"
              checked={termsAccepted}
              onChange={(e) => setTermsAccepted(e.target.checked)}
              aria-describedby="terms-agreement-error"
              aria-invalid={error && error.indexOf("Terms and Conditions") >= 0 ? "true" : "false"}
            />
            <label htmlFor="terms-accepted">
              I agree to the{" "}
              <a href={TERMS_URL} target="_blank" rel="noopener noreferrer">Terms and Conditions</a>.
            </label>
            <p id="terms-agreement-error" role="alert" hidden={!(error && error.indexOf("Terms and Conditions") >= 0)}>
              {error && error.indexOf("Terms and Conditions") >= 0 ? error : ""}
            </p>
          </div>
          <button
            type="submit"
            className="btn-primary"
            disabled={submitting}
          >
            {submitting ? "Creating..." : "Create Booking"}
          </button>
        </form>
      </div>
    </div>
  );
}
