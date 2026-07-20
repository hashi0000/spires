import React, { useState, useEffect } from "react";
import { signOut } from "firebase/auth";
import { auth, db } from "./firebase";
import { collection, query, where, onSnapshot, orderBy, doc, getDoc } from "firebase/firestore";
import { useNavigate } from "react-router-dom";
import BookingForm from "./components/BookingForm";
import Profile from "./components/Profile";
import { generateBookingPDF } from "./pdfGenerator";
import {
  SPIRES_BANK_DETAILS,
  formatPaymentMethodLabel,
  isBankTransferMethod,
} from "./bankDetails";
import { formatVehicleTypeLabel } from "./vehicleTypes";
import "./styles.css";

export default function Dashboard() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showBookingForm, setShowBookingForm] = useState(false);
  const [showProfile, setShowProfile] = useState(false);
  const [userName, setUserName] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [drivers, setDrivers] = useState({}); // Store drivers by ID
  const [vehicles, setVehicles] = useState({}); // Store vehicles by ID
  const navigate = useNavigate();

  useEffect(() => {
    const user = auth.currentUser;
    if (!user) {
      navigate("/");
      return;
    }

    // Get user's display name and extract first name
    const displayName = user.displayName;
    if (displayName) {
      // Extract first name (first word before space)
      const firstName = displayName.trim().split(" ")[0];
      setUserName(firstName);
    } else if (user.email) {
      // Fallback: Extract name from email (part before @)
      const emailName = user.email.split("@")[0];
      // Capitalize first letter
      const capitalizedName = emailName.charAt(0).toUpperCase() + emailName.slice(1).split(".")[0];
      setUserName(capitalizedName);
    }

    // Listen for all user's bookings in Firestore (not just pending)
    // Note: We filter by status, but customer app uses "pending"/"confirmed"/"paid"
    // Admin sets customerStatus when confirming, otherwise we use status field
    let q;
    if (statusFilter === "all") {
      q = query(
        collection(db, "bookings"),
        where("uid", "==", user.uid),
        orderBy("createdAt", "desc")
      );
    } else {
      // Filter by status field (customer app uses this)
      q = query(
        collection(db, "bookings"),
        where("uid", "==", user.uid),
        where("status", "==", statusFilter),
        orderBy("createdAt", "desc")
      );
    }
    
    const unsubscribe = onSnapshot(
      q,
      async (snapshot) => {
        const bookingList = snapshot.docs.map((doc) => {
          const data = doc.data();
          // Use customerStatus if set by admin, otherwise use status
          const customerStatus = data.customerStatus || data.status || "pending";
          return {
            id: doc.id,
            ...data,
            status: customerStatus, // Use customer status for display
          };
        });
        
        // Fetch driver and vehicle details for bookings that have them
        const driverIds = new Set();
        const vehicleIds = new Set();
        bookingList.forEach(booking => {
          if (booking.driverId) driverIds.add(booking.driverId);
          if (booking.vehicleId) vehicleIds.add(booking.vehicleId);
        });
        
        // Fetch all unique drivers
        const driversData = {};
        for (const driverId of driverIds) {
          try {
            const driverDoc = await getDoc(doc(db, "drivers", driverId));
            if (driverDoc.exists()) {
              driversData[driverId] = driverDoc.data();
            }
          } catch (err) {
            console.error(`Error fetching driver ${driverId}:`, err);
          }
        }
        
        // Fetch all unique vehicles
        const vehiclesData = {};
        for (const vehicleId of vehicleIds) {
          try {
            const vehicleDoc = await getDoc(doc(db, "vehicles", vehicleId));
            if (vehicleDoc.exists()) {
              vehiclesData[vehicleId] = vehicleDoc.data();
            }
          } catch (err) {
            console.error(`Error fetching vehicle ${vehicleId}:`, err);
          }
        }
        
        setDrivers(driversData);
        setVehicles(vehiclesData);
        setBookings(bookingList);
        setLoading(false);
      },
      (error) => {
        console.error("Error fetching bookings:", error);
        // If orderBy fails, try without it
        const fallbackQ = query(
          collection(db, "bookings"),
          where("uid", "==", user.uid)
        );
        onSnapshot(fallbackQ, async (snapshot) => {
          const bookingList = snapshot.docs.map((doc) => ({
            id: doc.id,
            ...doc.data(),
          })).sort((a, b) => {
            const aTime = a.createdAt?.toDate?.() || new Date(a.createdAt || 0);
            const bTime = b.createdAt?.toDate?.() || new Date(b.createdAt || 0);
            return bTime - aTime;
          });
          
          // Fetch driver and vehicle details
          const driverIds = new Set();
          const vehicleIds = new Set();
          bookingList.forEach(booking => {
            if (booking.driverId) driverIds.add(booking.driverId);
            if (booking.vehicleId) vehicleIds.add(booking.vehicleId);
          });
          
          const driversData = {};
          for (const driverId of driverIds) {
            try {
              const driverDoc = await getDoc(doc(db, "drivers", driverId));
              if (driverDoc.exists()) {
                driversData[driverId] = driverDoc.data();
              }
            } catch (err) {
              console.error(`Error fetching driver ${driverId}:`, err);
            }
          }
          
          const vehiclesData = {};
          for (const vehicleId of vehicleIds) {
            try {
              const vehicleDoc = await getDoc(doc(db, "vehicles", vehicleId));
              if (vehicleDoc.exists()) {
                vehiclesData[vehicleId] = vehicleDoc.data();
              }
            } catch (err) {
              console.error(`Error fetching vehicle ${vehicleId}:`, err);
            }
          }
          
          setDrivers(driversData);
          setVehicles(vehiclesData);
          setBookings(bookingList);
          setLoading(false);
        });
      }
    );

    return unsubscribe;
  }, [navigate, statusFilter]);

  const handleLogout = async () => {
    try {
      await signOut(auth);
      navigate("/");
    } catch (error) {
      console.error("Logout error:", error);
    }
  };

  const handleBookingCreated = () => {
    setShowBookingForm(false);
  };

  const resolvePdfType = (booking) => {
    if (booking.paymentStatus === "paid") {
      return "payment_receipt";
    }
    if (booking.status === "completed") {
      return "payment_request";
    }
    return "booking_confirmation";
  };

  const handleDownloadPDF = (booking) => {
    // Generate filename: "Name - BookingReference"
    const customerName = (booking.name || "Customer").replace(/[^a-zA-Z0-9\s]/g, "").trim();
    const bookingRef = booking.id ? `CUST${booking.id.slice(0, 6).toUpperCase()}` : "N/A";
    const fileName = `${customerName} - ${bookingRef}`;
    
    // Get driver and vehicle data for the booking
    const driver = booking.driverId && drivers[booking.driverId] ? drivers[booking.driverId] : null;
    const vehicle = booking.vehicleId && vehicles[booking.vehicleId] ? vehicles[booking.vehicleId] : null;
    
    // Call PDF generator which will handle download/print with proper filename
    const pdfType = resolvePdfType(booking);

    generateBookingPDF(booking, fileName, driver, vehicle, pdfType);
  };

  // Format date/time for display
  const formatDateTime = (dateTime) => {
    if (!dateTime) return "N/A";
    
    // Handle Firestore Timestamp
    if (dateTime.toDate) {
      const date = dateTime.toDate();
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    
    // Handle string dateTime
    if (typeof dateTime === "string") {
      const date = new Date(dateTime);
      return date.toLocaleString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
        hour: "2-digit",
        minute: "2-digit",
      });
    }
    
    return dateTime;
  };

  // Format created date
  const formatCreatedDate = (createdAt) => {
    if (!createdAt) return "N/A";
    
    if (createdAt.toDate) {
      const date = createdAt.toDate();
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    
    if (typeof createdAt === "string") {
      const date = new Date(createdAt);
      return date.toLocaleDateString("en-GB", {
        day: "2-digit",
        month: "short",
        year: "numeric",
      });
    }
    
    return createdAt;
  };

  const filteredBookings = bookings;

  return (
    <div className="dashboard-wrapper">
      <header className="dashboard-navbar">
        <div className="navbar-left">
          <img src="/images/spireslogo.svg" alt="Spires Taxis" className="navbar-logo" />
        </div>
        <div className="navbar-center">
          <span className="welcome-text">
            Welcome back, {userName}
          </span>
        </div>
        <div className="navbar-right">
          <button onClick={() => setShowProfile(true)} className="btn-profile">
            Profile
          </button>
          <button onClick={handleLogout} className="btn-logout">
            Logout
          </button>
        </div>
      </header>

      <main className="dashboard-main">
        <div className="dashboard-header-section">
          <h2 className="dashboard-title">Journey History</h2>
          <button
            onClick={() => setShowBookingForm(true)}
            className="btn-new-booking"
          >
            + New Booking
          </button>
        </div>

        <div className="filter-section">
          <button
            className={`filter-btn ${statusFilter === "all" ? "active" : ""}`}
            onClick={() => setStatusFilter("all")}
          >
            All
          </button>
          <button
            className={`filter-btn ${statusFilter === "pending" ? "active" : ""}`}
            onClick={() => setStatusFilter("pending")}
          >
            Pending
          </button>
          <button
            className={`filter-btn ${statusFilter === "confirmed" ? "active" : ""}`}
            onClick={() => setStatusFilter("confirmed")}
          >
            Confirmed
          </button>
          <button
            className={`filter-btn ${statusFilter === "paid" ? "active" : ""}`}
            onClick={() => setStatusFilter("paid")}
          >
            Paid
          </button>
        </div>

        {loading ? (
          <div className="empty-state">
            <p>Loading bookings...</p>
          </div>
        ) : filteredBookings.length === 0 ? (
          <div className="empty-state">
            <p>No bookings found.</p>
            <p className="empty-state-subtitle">
              {statusFilter === "all" 
                ? "Create a new booking to get started."
                : `No ${statusFilter} bookings.`}
            </p>
          </div>
        ) : (
          <div className="booking-list">
            {filteredBookings.map((booking) => (
              <div key={booking.id} className="booking-card">
                <div className="booking-card-header">
                  <div className="booking-route">
                    <span className="route-pickup">{booking.pickup || "N/A"}</span>
                    <span className="route-arrow">→</span>
                    <span className="route-destination">{booking.destination || "N/A"}</span>
                  </div>
                  <span className={`status-badge status-${(booking.status || "pending").toLowerCase()}`}>
                    {booking.status ? booking.status.charAt(0).toUpperCase() + booking.status.slice(1) : "Pending"}
                  </span>
                </div>
                
                <div className="booking-card-body">
                  <div className="booking-info-row">
                    <span className="info-label">Date & Time:</span>
                    <span className="info-value">{formatDateTime(booking.dateTime || (booking.date && booking.time ? `${booking.date} ${booking.time}` : null))}</span>
                  </div>
                  
                  {booking.passengers && (
                    <div className="booking-info-row">
                      <span className="info-label">Passengers:</span>
                      <span className="info-value">{booking.passengers}</span>
                    </div>
                  )}

                  {booking.vehicleType && (
                    <div className="booking-info-row">
                      <span className="info-label">Vehicle:</span>
                      <span className="info-value">{formatVehicleTypeLabel(booking.vehicleType)}</span>
                    </div>
                  )}

                  {booking.depositRequired && (
                    <div className="booking-info-row">
                      <span className="info-label">Deposit:</span>
                      <span className="info-value" style={{ fontWeight: 600, color: booking.depositStatus === "paid" ? "#065f46" : "#92400e" }}>
                        {booking.depositStatus === "paid"
                          ? `Paid${booking.depositAmount ? ` (£${Number(booking.depositAmount).toFixed(2)})` : ""}`
                          : `Required${booking.depositAmount ? ` — £${Number(booking.depositAmount).toFixed(2)}` : ""}`}
                      </span>
                    </div>
                  )}

                  {booking.createdAt && (
                    <div className="booking-info-row">
                      <span className="info-label">Booked:</span>
                      <span className="info-value">{formatCreatedDate(booking.createdAt)}</span>
                    </div>
                  )}

                  {booking.returnTrip && booking.returnDateTime && (
                    <div className="booking-info-row">
                      <span className="info-label">Return:</span>
                      <span className="info-value">{formatDateTime(booking.returnDateTime)}</span>
                    </div>
                  )}

                  {(booking.flightNumber || booking.terminal) && (
                    <div className="booking-info-row">
                      <span className="info-label">Flight:</span>
                      <span className="info-value">
                        {[booking.flightNumber, booking.terminal ? `Terminal ${booking.terminal}` : ""]
                          .filter(Boolean)
                          .join(" · ")}
                      </span>
                    </div>
                  )}

                  {/* Show price when booking is confirmed or paid */}
                  {booking.actualFare && (booking.status === "confirmed" || booking.status === "paid" || booking.paymentStatus === "paid") && (
                    <div className="booking-info-row">
                      <span className="info-label">Fare:</span>
                      <span className="info-value" style={{ color: "#065f46", fontWeight: "600" }}>
                        £{typeof booking.actualFare === "number" ? booking.actualFare.toFixed(2) : parseFloat(booking.actualFare).toFixed(2)}
                      </span>
                    </div>
                  )}

                  {booking.paymentMethod && (
                    <div className="booking-info-row">
                      <span className="info-label">Pay by:</span>
                      <span className="info-value">{formatPaymentMethodLabel(booking.paymentMethod)}</span>
                    </div>
                  )}

                  {booking.paymentStatus === "paid" && (
                    <div className="booking-info-row">
                      <span className="info-label">Payment:</span>
                      <span className="info-value" style={{ color: "#065f46", fontWeight: "600" }}>Paid</span>
                    </div>
                  )}

                  {((isBankTransferMethod(booking.paymentMethod) &&
                    booking.paymentStatus !== "paid" &&
                    (booking.status === "confirmed" || booking.actualFare)) ||
                    (booking.depositRequired &&
                      booking.depositStatus !== "paid" &&
                      booking.status === "confirmed")) && (
                    <div
                      style={{
                        marginTop: "0.75rem",
                        padding: "0.75rem",
                        borderRadius: "8px",
                        border: "1px solid #C5A572",
                        background: "#faf8f4",
                        fontSize: "0.85rem",
                        lineHeight: 1.45,
                      }}
                    >
                      <div style={{ fontWeight: 600, marginBottom: "0.25rem" }}>
                        {booking.depositRequired && booking.depositStatus !== "paid"
                          ? "Bank details for deposit / payment"
                          : "Bank transfer"}
                      </div>
                      <div>{SPIRES_BANK_DETAILS.accountName}</div>
                      <div>Sort code: {SPIRES_BANK_DETAILS.sortCode}</div>
                      <div>Account: {SPIRES_BANK_DETAILS.accountNumber}</div>
                      <div style={{ marginTop: "0.25rem", color: "#555" }}>
                        Use booking ref{" "}
                        <strong>
                          {booking.bookingNumber ||
                            (booking.id ? `CUST${booking.id.slice(0, 6).toUpperCase()}` : "TBC")}
                        </strong>{" "}
                        as the payment reference.
                      </div>
                    </div>
                  )}

                  {/* Show driver and vehicle info when allocated */}
                  {(booking.driverId || booking.vehicleId) && (
                    <>
                      <div className="booking-info-row" style={{ marginTop: '0.75rem', paddingTop: '0.75rem', borderTop: '1px solid #e5e7eb' }}>
                        <span className="info-label" style={{ fontWeight: "600", color: "#1d3c74" }}>Driver & Vehicle:</span>
                      </div>
                      {booking.driverId && drivers[booking.driverId] && (
                        <div className="booking-info-row">
                          <span className="info-label">Driver:</span>
                          <span className="info-value" style={{ fontWeight: "600", color: "#1d3c74" }}>
                            {drivers[booking.driverId].name}
                          </span>
                        </div>
                      )}
                      {booking.vehicleId && vehicles[booking.vehicleId] && (
                        <div className="booking-info-row">
                          <span className="info-label">Vehicle:</span>
                          <span className="info-value" style={{ fontWeight: "500" }}>
                            {vehicles[booking.vehicleId].color} {vehicles[booking.vehicleId].registration}
                          </span>
                        </div>
                      )}
                    </>
                  )}
                </div>

                <div className="booking-card-actions">
                  <button
                    onClick={() => handleDownloadPDF(booking)}
                    className="btn-download"
                  >
                    Download Confirmation
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}
      </main>

      {showBookingForm && (
        <BookingForm
          onClose={() => setShowBookingForm(false)}
          onBookingCreated={handleBookingCreated}
        />
      )}

      {showProfile && (
        <Profile
          onClose={() => setShowProfile(false)}
        />
      )}
    </div>
  );
}
