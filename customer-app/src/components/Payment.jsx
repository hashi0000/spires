import React, { useState, useEffect } from "react";
import { loadStripe } from "@stripe/stripe-js";
import {
  Elements,
  CardElement,
  useStripe,
  useElements,
} from "@stripe/react-stripe-js";
import { httpsCallable } from "firebase/functions";
import { functions } from "../firebase";
import "../styles.css";

// Initialize Stripe with publishable key
const stripePromise = loadStripe(
  process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY || ""
);

function PaymentForm({ booking, onSuccess, onClose }) {
  const stripe = useStripe();
  const elements = useElements();
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState(null);
  const [clientSecret, setClientSecret] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Create payment intent when component mounts
    const createPaymentIntent = async () => {
      try {
        console.log("Creating payment intent for booking:", booking.id);
        console.log("Amount:", booking.actualFare || booking.estimatedFare || 0);

        const createPaymentIntentFn = httpsCallable(
          functions,
          "createPaymentIntent"
        );
        
        const amount = booking.actualFare || booking.estimatedFare || 0;
        if (!amount || amount === 0) {
          setError("No fare amount available for this booking. Please contact support.");
          setLoading(false);
          return;
        }

        const result = await createPaymentIntentFn({
          bookingId: booking.id,
          amount: amount,
        });
        
        console.log("Payment intent created successfully:", result.data);
        setClientSecret(result.data.clientSecret);
        setLoading(false);
      } catch (err) {
        console.error("Error creating payment intent:", err);
        console.error("Error details:", err.code, err.message, err.details);
        
        // Extract error message from Firebase Functions error
        let errorMessage = "Failed to initialize payment";
        
        if (err.code === "failed-precondition") {
          errorMessage = "Payment system not configured. Please contact support.";
        } else if (err.code === "unauthenticated") {
          errorMessage = "You must be logged in to make a payment.";
        } else if (err.code === "permission-denied") {
          errorMessage = "You don't have permission to pay for this booking.";
        } else if (err.code === "not-found") {
          errorMessage = "Booking not found.";
        } else if (err.code === "already-exists") {
          errorMessage = "This booking has already been paid.";
        } else if (err.code === "invalid-argument") {
          errorMessage = err.message || "Invalid payment details. Please check the amount.";
        } else if (err.message) {
          errorMessage = err.message;
        } else if (err.details) {
          errorMessage = typeof err.details === "string" ? err.details : err.details.message || errorMessage;
        }
        
        setError(errorMessage);
        setLoading(false);
      }
    };

    if (booking && (booking.actualFare || booking.estimatedFare)) {
      createPaymentIntent();
    } else {
      setError("No fare amount available for this booking. Please wait for the booking to be confirmed.");
      setLoading(false);
    }
  }, [booking]);

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!stripe || !elements || !clientSecret) {
      return;
    }

    setProcessing(true);
    setError(null);

    const cardElement = elements.getElement(CardElement);

    try {
      // Confirm payment with Stripe
      const { error: stripeError, paymentIntent } = await stripe.confirmCardPayment(
        clientSecret,
        {
          payment_method: {
            card: cardElement,
            billing_details: {
              name: booking.name || "Customer",
              email: booking.email || "",
              phone: booking.phone || "",
            },
          },
        }
      );

      if (stripeError) {
        setError(stripeError.message || "Payment failed");
        setProcessing(false);
        return;
      }

      if (paymentIntent.status === "succeeded") {
        // Confirm payment in Firebase
        try {
          const confirmPaymentFn = httpsCallable(functions, "confirmPayment");
          await confirmPaymentFn({
            bookingId: booking.id,
            paymentIntentId: paymentIntent.id,
          });
          onSuccess();
        } catch (err) {
          console.error("Error confirming payment:", err);
          setError("Payment succeeded but failed to update booking. Please contact support.");
          setProcessing(false);
        }
      }
    } catch (err) {
      console.error("Payment error:", err);
      setError(err.message || "An error occurred during payment");
      setProcessing(false);
    }
  };

  const cardElementOptions = {
    style: {
      base: {
        fontSize: "16px",
        color: "#0b1c3d",
        fontFamily: "system-ui, -apple-system, sans-serif",
        "::placeholder": {
          color: "#9ca3af",
        },
      },
      invalid: {
        color: "#ef4444",
        iconColor: "#ef4444",
      },
    },
  };

  if (loading) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
          <h2>Processing Payment</h2>
          <p>Please wait...</p>
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
        <h2>Pay for Booking</h2>
        <div style={{ marginBottom: "1.5rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "#6b7280" }}>Route:</span>
            <span style={{ fontWeight: "600" }}>
              {booking.pickup} → {booking.destination}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "0.5rem" }}>
            <span style={{ color: "#6b7280" }}>Date:</span>
            <span>{new Date(booking.dateTime || booking.date).toLocaleDateString("en-GB")}</span>
          </div>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              paddingTop: "1rem",
              borderTop: "2px solid #e5e7eb",
              marginTop: "1rem",
            }}
          >
            <span style={{ fontSize: "1.25rem", fontWeight: "700", color: "#0b1c3d" }}>
              Total Amount:
            </span>
            <span style={{ fontSize: "1.5rem", fontWeight: "700", color: "#1d3c74" }}>
              £{(booking.actualFare || 0).toFixed(2)}
            </span>
          </div>
        </div>

        {error && (
          <div className="error" style={{ marginBottom: "1rem" }}>
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="modal-form">
          <div style={{ marginBottom: "1.5rem" }}>
            <label
              style={{
                display: "block",
                marginBottom: "0.5rem",
                fontWeight: "500",
                color: "#0b1c3d",
              }}
            >
              Card Details
            </label>
            <div
              style={{
                padding: "1rem",
                border: "2px solid #e2e8f0",
                borderRadius: "8px",
                backgroundColor: "#fff",
              }}
            >
              <CardElement options={cardElementOptions} />
            </div>
          </div>

          <div style={{ fontSize: "0.875rem", color: "#6b7280", marginBottom: "1.5rem" }}>
            <p>Your payment is secure and encrypted. We accept all major credit and debit cards.</p>
          </div>

          <div style={{ display: "flex", gap: "1rem" }}>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary"
              disabled={processing}
              style={{ flex: 1 }}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn-primary"
              disabled={!stripe || processing}
              style={{ flex: 1 }}
            >
              {processing ? "Processing..." : `Pay £${(booking.actualFare || 0).toFixed(2)}`}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function Payment({ booking, onSuccess, onClose }) {
  if (!process.env.REACT_APP_STRIPE_PUBLISHABLE_KEY) {
    return (
      <div className="modal-backdrop" onClick={onClose}>
        <div className="modal-content" onClick={(e) => e.stopPropagation()}>
          <button className="modal-close" onClick={onClose}>
            ×
          </button>
          <h2>Payment Unavailable</h2>
          <p style={{ color: "#ef4444" }}>
            Stripe is not configured. Please contact support to complete your payment.
          </p>
          <button onClick={onClose} className="btn-primary" style={{ marginTop: "1rem" }}>
            Close
          </button>
        </div>
      </div>
    );
  }

  return (
    <Elements stripe={stripePromise}>
      <PaymentForm booking={booking} onSuccess={onSuccess} onClose={onClose} />
    </Elements>
  );
}

