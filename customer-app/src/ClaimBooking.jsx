import { useEffect, useState } from "react";
import { onAuthStateChanged } from "firebase/auth";
import { Link, useNavigate, useSearchParams } from "react-router-dom";
import { auth } from "./firebase";
import { claimGuestBooking, previewGuestClaim, readableAuthError } from "./guestClaim";
import "./styles.css";

export default function ClaimBooking() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const navigate = useNavigate();
  const [preview, setPreview] = useState(null);
  const [user, setUser] = useState(undefined);
  const [error, setError] = useState("");
  const [status, setStatus] = useState("loading");

  useEffect(() => onAuthStateChanged(auth, (next) => setUser(next || null)), []);

  useEffect(() => {
    if (!token) {
      setStatus("invalid");
      setError("This link is not valid.");
      return undefined;
    }
    let cancelled = false;
    previewGuestClaim(token)
      .then((body) => {
        if (cancelled) return;
        setPreview(body);
        setStatus("ready");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("invalid");
        setError(readableAuthError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  useEffect(() => {
    if (status !== "ready" || !user || !token) return undefined;
    let cancelled = false;
    setStatus("claiming");
    claimGuestBooking(token)
      .then(() => {
        if (!cancelled) navigate("/dashboard");
      })
      .catch((err) => {
        if (cancelled) return;
        setStatus("claim-failed");
        setError(readableAuthError(err));
      });
    return () => {
      cancelled = true;
    };
  }, [status, user, token, navigate]);

  const signupTo = `/signup?t=${encodeURIComponent(token)}`;
  const loginTo = `/?t=${encodeURIComponent(token)}`;

  return (
    <div className="page-container">
      <div className="login-card">
        <img src="/images/spireslogo.svg" alt="Spires Taxis" className="logo" />
        <h1>Your booking request</h1>
        {status === "loading" || status === "claiming" || user === undefined ? <p>Loading...</p> : null}
        {error ? <div className="error">{error}</div> : null}
        {preview ? (
          <div>
            <p>Reference <strong>{preview.bookingNumber}</strong></p>
            <p>{preview.pickup} to {preview.destination}</p>
            <p>This request is already saved. It is not a confirmed booking until the quote is accepted.</p>
          </div>
        ) : null}
        {status === "ready" && user === null ? (
          <div>
            <p>Create an account to track and manage your bookings. This is optional.</p>
            <p>Accounts use an email address and a password. We do not send a text message to verify a phone number, so a landline can still be used for the request itself.</p>
            <p><Link className="btn-primary" to={signupTo} style={{ display: "inline-block", textAlign: "center" }}>Create an account</Link></p>
            <p className="switch-text">Already use Spires Taxis? <Link to={loginTo} className="link">Sign in</Link></p>
          </div>
        ) : null}
        {status === "claim-failed" ? (
          <p>Your request is still saved{preview?.bookingNumber ? ` as ${preview.bookingNumber}` : ""}. Call 07776 897772 if you need help. You do not need to send the journey again.</p>
        ) : null}
      </div>
    </div>
  );
}
