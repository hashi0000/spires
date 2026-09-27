import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
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

const PAYMENT_OPTIONS = [
  { value: "cash", label: "Cash (pay driver)" },
  { value: "card", label: "Card (pay driver)" },
  { value: "bank transfer", label: "Bank transfer" },
];

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
    setError("");
    setSubmitting(true);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to create a booking.");
      setSubmitting(false);
      return;
    }

    if (!formData.paymentMethod) {
      setError("Please choose how you would like to pay.");
      setSubmitting(false);
      return;
    }

    if (!formData.vehicleType) {
      setError("Please choose a Standard Car or 8 Seater.");
      setSubmitting(false);
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
      return;
    }

    const isReturn = formData.bookingType === "return";
    if (isReturn) {
      if (!formData.returnPickupTime || !String(formData.returnPickupLocation || "").trim() || !String(formData.returnDestination || "").trim()) {
        setError("Return bookings need a return date, pickup time, pickup address and destination.");
        setSubmitting(false);
        return;
      }
    }

    try {
      await addDoc(collection(db, "bookings"), {
        uid: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "Customer",
        email: user.email,
        phone: formData.phone || "",
        pickup: formData.pickup,
        destination: formData.destination,
        dateTime: formData.dateTime,
        passengers,
        luggage: parseInt(formData.luggage) || 0,
        specialRequirements: formData.specialRequirements || "",
        bookingType: isReturn ? "return" : "one_way",
        returnTrip: isReturn,
        returnDateTime: isReturn ? formData.returnPickupTime : "",
        returnPickupTime: isReturn ? formData.returnPickupTime : "",
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
        paymentStatus: "pending",
        vehicleType: formData.vehicleType,
        depositRequired: false,
        depositStatus: "not_required",
        flightNumber: formData.airportCollection ? formData.flightNumber || "" : "",
        terminal: formData.terminal || "",
        status: "pending",
        createdAt: serverTimestamp(),
      });

      onBookingCreated();
    } catch (err) {
      console.error("Error creating booking:", err);
      setError("Failed to create booking. Please try again.");
      setSubmitting(false);
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
            <input
              type="text"
              name="pickup"
              placeholder="Pickup Location"
              value={formData.pickup}
              onChange={handleChange}
              required
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
            <input
              type="text"
              name="destination"
              placeholder="Destination"
              value={formData.destination}
              onChange={handleChange}
              required
            />
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
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.75rem' }}>
                <div>
                  <label style={labelStyle}>Date *</label>
                  <input
                    type="date"
                    value={ret.date}
                    min={outbound.date || getMinDate()}
                    onChange={(e) => setFormData({ ...formData, returnPickupTime: combineLocalDateTime(e.target.value, ret.time || '00:00') })}
                    required
                  />
                </div>
                <div>
                  <label style={labelStyle}>Pickup time *</label>
                  <input
                    type="time"
                    value={ret.time}
                    onChange={(e) => setFormData({ ...formData, returnPickupTime: combineLocalDateTime(ret.date, e.target.value) })}
                    required
                  />
                </div>
              </div>
              <input
                type="text"
                placeholder="Return pickup address"
                value={formData.returnPickupLocation || ''}
                onChange={(e) => setFormData({ ...formData, returnPickupLocation: e.target.value })}
                required
              />
              <input
                type="text"
                placeholder="Return destination"
                value={formData.returnDestination || ''}
                onChange={(e) => setFormData({ ...formData, returnDestination: e.target.value })}
                required
              />
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
