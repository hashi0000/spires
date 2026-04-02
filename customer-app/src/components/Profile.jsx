import React, { useState, useEffect } from "react";
import { auth, db } from "../firebase";
import { doc, getDoc, setDoc } from "firebase/firestore";
import { updateProfile } from "firebase/auth";
import "../styles.css";

export default function Profile({ onClose }) {
  const [formData, setFormData] = useState({
    firstName: "",
    lastName: "",
    email: "",
    phone: "",
    dateOfBirth: "",
  });
  const [addresses, setAddresses] = useState([]);
  const [newAddressFirstLine, setNewAddressFirstLine] = useState("");
  const [newAddressPostcode, setNewAddressPostcode] = useState("");
  const [newAddressCounty, setNewAddressCounty] = useState("");
  const [newAddressNickname, setNewAddressNickname] = useState("");
  const [editingAddressIndex, setEditingAddressIndex] = useState(null);
  const [editingAddressFirstLine, setEditingAddressFirstLine] = useState("");
  const [editingAddressPostcode, setEditingAddressPostcode] = useState("");
  const [editingAddressCounty, setEditingAddressCounty] = useState("");
  const [editingAddressNickname, setEditingAddressNickname] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  useEffect(() => {
    const loadUserProfile = async () => {
      const user = auth.currentUser;
      if (!user) return;

      try {
        // Get user profile from Firestore
        const userDoc = await getDoc(doc(db, "customers", user.uid));
        
        if (userDoc.exists()) {
          const data = userDoc.data();
          setFormData({
            firstName: data.firstName || "",
            lastName: data.lastName || "",
            email: user.email || "",
            phone: data.phone || "",
            dateOfBirth: data.dateOfBirth || "",
          });
          // Load saved addresses
          if (data.addresses && Array.isArray(data.addresses)) {
            setAddresses(data.addresses);
          }
        } else {
          // Fallback: extract from displayName
          const displayName = user.displayName || "";
          const nameParts = displayName.split(" ");
          setFormData({
            firstName: nameParts[0] || "",
            lastName: nameParts.slice(1).join(" ") || "",
            email: user.email || "",
            phone: "",
            dateOfBirth: "",
          });
        }
      } catch (err) {
        console.error("Error loading profile:", err);
        setError("Failed to load profile.");
      } finally {
        setLoading(false);
      }
    };

    loadUserProfile();
  }, []);

  const handleChange = (e) => {
    setFormData({
      ...formData,
      [e.target.name]: e.target.value,
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    setSaving(true);

    const user = auth.currentUser;
    if (!user) {
      setError("You must be logged in to update your profile.");
      setSaving(false);
      return;
    }

    if (!formData.firstName.trim() || !formData.lastName.trim()) {
      setError("First name and last name are required.");
      setSaving(false);
      return;
    }

    try {
      // Update Firebase Auth displayName
      const fullName = `${formData.firstName.trim()} ${formData.lastName.trim()}`;
      await updateProfile(user, {
        displayName: fullName,
      });

      // Get existing document to preserve email and createdAt
      const userDocRef = doc(db, "customers", user.uid);
      const userDoc = await getDoc(userDocRef);
      
      const profileData = {
        firstName: formData.firstName.trim(),
        lastName: formData.lastName.trim(),
        email: user.email,
        phone: formData.phone.trim(),
        dateOfBirth: formData.dateOfBirth,
        addresses: addresses,
        updatedAt: new Date(),
      };

      // If document exists, preserve createdAt; otherwise add it
      if (userDoc.exists()) {
        profileData.createdAt = userDoc.data().createdAt || new Date();
      } else {
        profileData.createdAt = new Date();
      }

      // Use setDoc with merge to create or update the document
      await setDoc(userDocRef, profileData, { merge: true });

      setSuccess("Profile updated successfully!");
      setTimeout(() => {
        onClose();
      }, 1500);
    } catch (err) {
      console.error("Error updating profile:", err);
      setError(err.message || "Failed to update profile. Please try again.");
      setSaving(false);
    }
  };

  const getMaxDateOfBirth = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split("T")[0];
  };

  const handleAddAddress = () => {
    if (!newAddressFirstLine.trim() || !newAddressNickname.trim()) {
      setError("Please enter at least the first line and a nickname.");
      return;
    }
    const addressToAdd = {
      firstLine: newAddressFirstLine.trim(),
      postcode: newAddressPostcode.trim() || "",
      county: newAddressCounty.trim() || "",
      nickname: newAddressNickname.trim(),
      createdAt: new Date(),
    };
    setAddresses([...addresses, addressToAdd]);
    setNewAddressFirstLine("");
    setNewAddressPostcode("");
    setNewAddressCounty("");
    setNewAddressNickname("");
    setError("");
  };

  const handleEditAddress = (index) => {
    const addr = addresses[index];
    setEditingAddressIndex(index);
    setEditingAddressFirstLine(addr.firstLine || addr.address || "");
    setEditingAddressPostcode(addr.postcode || "");
    setEditingAddressCounty(addr.county || "");
    setEditingAddressNickname(addr.nickname);
    setError("");
  };

  const handleSaveEditAddress = () => {
    if (!editingAddressFirstLine.trim() || !editingAddressNickname.trim()) {
      setError("Please enter at least the first line and a nickname.");
      return;
    }
    const updatedAddresses = [...addresses];
    updatedAddresses[editingAddressIndex] = {
      firstLine: editingAddressFirstLine.trim(),
      postcode: editingAddressPostcode.trim() || "",
      county: editingAddressCounty.trim() || "",
      nickname: editingAddressNickname.trim(),
      createdAt: addresses[editingAddressIndex].createdAt || new Date(),
    };
    setAddresses(updatedAddresses);
    setEditingAddressIndex(null);
    setEditingAddressFirstLine("");
    setEditingAddressPostcode("");
    setEditingAddressCounty("");
    setEditingAddressNickname("");
    setError("");
  };

  const handleCancelEditAddress = () => {
    setEditingAddressIndex(null);
    setEditingAddressFirstLine("");
    setEditingAddressPostcode("");
    setEditingAddressCounty("");
    setEditingAddressNickname("");
    setError("");
  };

  const handleDeleteAddress = (index) => {
    if (window.confirm(`Delete address "${addresses[index].nickname}"?`)) {
      setAddresses(addresses.filter((_, i) => i !== index));
    }
  };

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <p>Loading profile...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-content" onClick={(e) => e.stopPropagation()} style={{ maxHeight: '90vh', overflowY: 'auto' }}>
        <button className="modal-close" onClick={onClose}>
          ×
        </button>
        <h2>Edit Profile</h2>
        {error && <div className="error">{error}</div>}
        {success && <div className="success">{success}</div>}
        <form onSubmit={handleSubmit} className="modal-form" style={{ display: 'flex', flexDirection: 'column', gap: '1rem' }}>
          <input
            type="text"
            name="firstName"
            placeholder="First Name"
            value={formData.firstName}
            onChange={handleChange}
            required
          />
          <input
            type="text"
            name="lastName"
            placeholder="Last Name"
            value={formData.lastName}
            onChange={handleChange}
            required
          />
          <input
            type="email"
            name="email"
            placeholder="Email"
            value={formData.email}
            disabled
            className="input-disabled"
          />
          <input
            type="tel"
            name="phone"
            placeholder="Phone Number"
            value={formData.phone}
            onChange={handleChange}
            required
          />
          <input
            type="date"
            name="dateOfBirth"
            placeholder="Date of Birth"
            value={formData.dateOfBirth}
            onChange={handleChange}
            max={getMaxDateOfBirth()}
            required
          />
          
          <div style={{ 
            marginTop: '1.5rem', 
            paddingTop: '1.5rem', 
            borderTop: '2px solid #e5e7eb',
            backgroundColor: '#f9fafb',
            padding: '1.5rem',
            borderRadius: '8px',
            marginBottom: '1rem'
          }}>
            <h3 style={{ 
              fontSize: '1.125rem', 
              fontWeight: 600, 
              marginBottom: '1rem', 
              color: '#0b1c3d',
              display: 'flex',
              alignItems: 'center',
              gap: '0.5rem'
            }}>
              <span>📍</span> Saved Addresses
            </h3>
            {addresses.length > 0 && (
              <div style={{ marginBottom: '1rem' }}>
                {addresses.map((addr, idx) => (
                  <div key={idx} style={{ 
                    padding: '0.75rem',
                    marginBottom: '0.5rem',
                    background: '#f7f9fc',
                    borderRadius: '8px',
                    border: editingAddressIndex === idx ? '2px solid #1d3c74' : '1px solid #e5e7eb'
                  }}>
                    {editingAddressIndex === idx ? (
                      <div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            value={editingAddressFirstLine}
                            onChange={(e) => setEditingAddressFirstLine(e.target.value)}
                            placeholder="First Line"
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                          />
                          <input
                            type="text"
                            value={editingAddressNickname}
                            onChange={(e) => setEditingAddressNickname(e.target.value)}
                            placeholder="Nickname"
                            maxLength={20}
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                          />
                        </div>
                        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                          <input
                            type="text"
                            value={editingAddressPostcode}
                            onChange={(e) => setEditingAddressPostcode(e.target.value)}
                            placeholder="Postcode"
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                          />
                          <input
                            type="text"
                            value={editingAddressCounty}
                            onChange={(e) => setEditingAddressCounty(e.target.value)}
                            placeholder="County"
                            style={{ padding: '0.5rem', borderRadius: '6px', border: '1px solid #d1d5db' }}
                          />
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={handleCancelEditAddress}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#6b7280',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            onClick={handleSaveEditAddress}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#1d3c74',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            Save
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div style={{ 
                        display: 'flex', 
                        justifyContent: 'space-between', 
                        alignItems: 'center'
                      }}>
                        <div style={{ flex: 1 }}>
                          <strong style={{ color: '#0b1c3d' }}>{addr.nickname}</strong>
                          <div style={{ fontSize: '0.875rem', color: '#4b5563', marginTop: '0.25rem' }}>
                            {addr.firstLine || addr.address}
                            {addr.postcode && `, ${addr.postcode}`}
                            {addr.county && `, ${addr.county}`}
                          </div>
                        </div>
                        <div style={{ display: 'flex', gap: '0.5rem' }}>
                          <button
                            type="button"
                            onClick={() => handleEditAddress(idx)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#1d3c74',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            Edit
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeleteAddress(idx)}
                            style={{
                              padding: '0.375rem 0.75rem',
                              background: '#dc2626',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '0.875rem',
                              cursor: 'pointer',
                              fontWeight: 500
                            }}
                          >
                            Delete
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
            {addresses.length === 0 && (
              <p style={{ fontSize: '0.875rem', color: '#6b7280', marginBottom: '1rem', fontStyle: 'italic' }}>
                No saved addresses. Add one below to quickly select when making bookings.
              </p>
            )}
            <div style={{ 
              marginTop: '1rem',
              padding: '1rem',
              backgroundColor: '#fff',
              borderRadius: '8px',
              border: '1px solid #e5e7eb'
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', color: '#6b7280' }}>
                    First Line
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., 123 Main Street"
                    value={newAddressFirstLine}
                    onChange={(e) => setNewAddressFirstLine(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', color: '#6b7280' }}>
                    Nickname
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Home"
                    value={newAddressNickname}
                    onChange={(e) => setNewAddressNickname(e.target.value)}
                    maxLength={20}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', color: '#6b7280' }}>
                    Postcode
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., OX1 1AA"
                    value={newAddressPostcode}
                    onChange={(e) => setNewAddressPostcode(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
                <div>
                  <label style={{ display: 'block', fontSize: '0.75rem', fontWeight: 500, marginBottom: '0.25rem', color: '#6b7280' }}>
                    County
                  </label>
                  <input
                    type="text"
                    placeholder="e.g., Oxfordshire"
                    value={newAddressCounty}
                    onChange={(e) => setNewAddressCounty(e.target.value)}
                    style={{ width: '100%', padding: '0.75rem', borderRadius: '8px', border: '1px solid #d1d5db', fontSize: '0.875rem' }}
                  />
                </div>
              </div>
              <button
                type="button"
                onClick={handleAddAddress}
                style={{
                  padding: '0.75rem 1.5rem',
                  background: '#1d3c74',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '8px',
                  fontSize: '0.875rem',
                  cursor: 'pointer',
                  fontWeight: 600,
                  width: '100%'
                }}
              >
                + Add Address
              </button>
            </div>
            <p style={{ fontSize: '0.75rem', color: '#6b7280', marginTop: '0.5rem' }}>
              Saved addresses will appear when creating bookings for quick selection.
            </p>
          </div>

          <button
            type="submit"
            className="btn-primary"
            disabled={saving}
            style={{ marginTop: '1.5rem' }}
          >
            {saving ? "Saving..." : "Save Changes"}
          </button>
        </form>
      </div>
    </div>
  );
}

