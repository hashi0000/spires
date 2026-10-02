import React, { useState } from "react";
import { createUserWithEmailAndPassword, updateProfile } from "firebase/auth";
import { auth, db } from "./firebase";
import { doc, setDoc } from "firebase/firestore";
import { Link, useLocation, useNavigate } from "react-router-dom";
import "./styles.css";

export default function Signup() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [phone, setPhone] = useState("");
  const [dateOfBirth, setDateOfBirth] = useState("");
  const [addressFirstLine, setAddressFirstLine] = useState("");
  const [addressPostcode, setAddressPostcode] = useState("");
  const [addressCounty, setAddressCounty] = useState("");
  const [addressNickname, setAddressNickname] = useState("");
  const [error, setError] = useState("");
  const navigate = useNavigate();
  const location = useLocation();

  const handleSignup = async (e) => {
    e.preventDefault();
    setError("");
    
    if (!firstName.trim()) {
      setError("First name is required.");
      return;
    }
    
    if (!lastName.trim()) {
      setError("Last name is required.");
      return;
    }
    
    if (!phone.trim()) {
      setError("Phone number is required.");
      return;
    }
    
    if (!dateOfBirth) {
      setError("Date of birth is required.");
      return;
    }
    
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    
    if (password.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if ((addressFirstLine.trim() || addressPostcode.trim() || addressCounty.trim()) && !addressNickname.trim()) {
      setError("Please add a nickname for your address.");
      return;
    }

    if (addressNickname.trim() && !addressFirstLine.trim()) {
      setError("Please enter at least the first line of your address.");
      return;
    }
    
    try {
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;
      
      // Combine first and last name for displayName
      const fullName = `${firstName.trim()} ${lastName.trim()}`;
      await updateProfile(user, {
        displayName: fullName
      });
      
        // Prepare addresses array if address provided
        const addresses = [];
        if (addressFirstLine.trim() && addressNickname.trim()) {
          addresses.push({
            firstLine: addressFirstLine.trim(),
            postcode: addressPostcode.trim() || "",
            county: addressCounty.trim() || "",
            nickname: addressNickname.trim(),
            createdAt: new Date(),
          });
        }

      // Save user profile to Firestore customers collection
      await setDoc(doc(db, "customers", user.uid), {
        firstName: firstName.trim(),
        lastName: lastName.trim(),
        email: email.trim(),
        phone: phone.trim(),
        dateOfBirth: dateOfBirth,
        addresses: addresses,
        createdAt: new Date(),
      });
      
      const from = location.state?.from;
      navigate(typeof from === "string" && from.startsWith("/") && !from.startsWith("//") ? from : "/dashboard");
    } catch (err) {
      setError(err.message || "Could not create account.");
    }
  };

  // Get maximum date for DOB (18 years ago)
  const getMaxDateOfBirth = () => {
    const date = new Date();
    date.setFullYear(date.getFullYear() - 18);
    return date.toISOString().split("T")[0];
  };

  return (
    <div className="page-container">
      <div className="login-card">
        <img src="/images/spireslogo.svg" alt="Spires Taxis" className="logo" />
        <h1>Create an Account</h1>
        <p className="subtitle">Join Spires Taxis today</p>

        {error && <div className="error">{error}</div>}

        <form onSubmit={handleSignup}>
          <input
            type="text"
            placeholder="First Name"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
          <input
            type="text"
            placeholder="Last Name"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
          <input
            type="email"
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
          <input
            type="tel"
            placeholder="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            required
          />
          <input
            type="date"
            placeholder="Date of Birth"
            value={dateOfBirth}
            onChange={(e) => setDateOfBirth(e.target.value)}
            max={getMaxDateOfBirth()}
            required
          />
          <div style={{ marginTop: '0.5rem' }}>
            <label style={{ display: 'block', fontSize: '0.875rem', fontWeight: 500, marginBottom: '0.5rem', color: '#0b1c3d' }}>
              Address <span style={{ color: '#6b7280', fontWeight: 400 }}>(optional - you can add more in your profile)</span>
            </label>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 100px', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="First Line (e.g., 123 Main Street)"
                value={addressFirstLine}
                onChange={(e) => setAddressFirstLine(e.target.value)}
              />
              <input
                type="text"
                placeholder="Nickname"
                value={addressNickname}
                onChange={(e) => setAddressNickname(e.target.value)}
                maxLength={20}
              />
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0.5rem', marginBottom: '0.5rem' }}>
              <input
                type="text"
                placeholder="Postcode (e.g., OX1 1AA)"
                value={addressPostcode}
                onChange={(e) => setAddressPostcode(e.target.value)}
              />
              <input
                type="text"
                placeholder="County (e.g., Oxfordshire)"
                value={addressCounty}
                onChange={(e) => setAddressCounty(e.target.value)}
              />
            </div>
            {(addressFirstLine || addressPostcode || addressCounty) && !addressNickname && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.5rem 0 0 0' }}>
                Please add a nickname for this address (e.g., Home, Work)
              </p>
            )}
            {addressNickname && !addressFirstLine && (
              <p style={{ fontSize: '0.75rem', color: '#ef4444', margin: '0.5rem 0 0 0' }}>
                Please enter at least the first line of your address
              </p>
            )}
            {!addressFirstLine && !addressPostcode && !addressCounty && (
              <p style={{ fontSize: '0.75rem', color: '#6b7280', margin: '0.5rem 0 0 0' }}>
                💡 Tip: Save your address now to quickly select it when making bookings
              </p>
            )}
          </div>
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
          <input
            type="password"
            placeholder="Confirm Password"
            value={confirm}
            onChange={(e) => setConfirm(e.target.value)}
            required
          />
          <button type="submit" className="btn-primary">Sign Up</button>
        </form>

        <p className="switch-text">
          Already have an account?{" "}
          <Link to="/" state={location.state} className="link">Log in</Link>
        </p>
      </div>
    </div>
  );
}
