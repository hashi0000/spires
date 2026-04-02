import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { collection, addDoc, serverTimestamp } from "firebase/firestore";
import { doc, getDoc } from "firebase/firestore";
import "../styles.css";

export default function BookingForm({ onClose, onBookingCreated }) {
  const [formData, setFormData] = useState({
    phone: "",
    pickup: "",
    destination: "",
    dateTime: "",
    passengers: "1",
    luggage: "0",
    specialRequirements: "",
    returnTrip: false,
    returnDateTime: "",
    notes: "",
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

    try {
      await addDoc(collection(db, "bookings"), {
        uid: user.uid,
        name: user.displayName || user.email?.split("@")[0] || "Customer",
        email: user.email,
        phone: formData.phone || "",
        pickup: formData.pickup,
        destination: formData.destination,
        dateTime: formData.dateTime,
        passengers: parseInt(formData.passengers) || 1,
        luggage: parseInt(formData.luggage) || 0,
        specialRequirements: formData.specialRequirements || "",
        returnTrip: formData.returnTrip || false,
        returnDateTime: formData.returnTrip && formData.returnDateTime ? formData.returnDateTime : "",
        notes: formData.notes || "",
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

  // Get minimum datetime for input (current time)
  const getMinDateTime = () => {
    const now = new Date();
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
    return now.toISOString().slice(0, 16);
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
          {savedAddresses.length > 0 && (
            <>
              <div>
                <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
                  Saved Addresses (Pickup)
                </label>
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
            </>
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
              <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
                Saved Addresses (Destination)
              </label>
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
          <input
            type="datetime-local"
            name="dateTime"
            value={formData.dateTime}
            onChange={handleChange}
            min={getMinDateTime()}
            required
          />
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
                max="8"
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
            <label style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d', cursor: 'pointer' }}>
              <input
                type="checkbox"
                name="returnTrip"
                checked={formData.returnTrip}
                onChange={(e) => setFormData({ ...formData, returnTrip: e.target.checked })}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              Return Trip Required
            </label>
            {formData.returnTrip && (
              <input
                type="datetime-local"
                name="returnDateTime"
                placeholder="Return Date & Time"
                value={formData.returnDateTime}
                onChange={handleChange}
                min={formData.dateTime || getMinDateTime()}
                style={{ marginTop: '0.5rem' }}
              />
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
