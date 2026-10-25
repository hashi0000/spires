import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { httpsCallable } from "firebase/functions";
import { doc, getDoc } from "firebase/firestore";
import { auth, db, functions } from "./firebase";

const QUOTE_API = "https://us-central1-spires-taxis.cloudfunctions.net/quotePublic";
const acceptQuote = httpsCallable(functions, "acceptQuote");

function moneyFromBooking(data) {
  const quote = data.issuedQuote || {};
  const pence = (value) => `£${(Number(value || 0) / 100).toFixed(2)}`;
  return {
    bookingNumber: data.bookingNumber || "",
    status: data.status || "",
    substatus: data.quoteAcceptanceSubstatus || "",
    vehicle: quote.vehicleType || data.vehicleType || "",
    pickup: quote.pickup || data.pickupLocation || data.pickup || "",
    destination: quote.destination || data.destination || "",
    dateTime: quote.dateTime || data.dateTime || "",
    returnPickupLocation: quote.returnPickupLocation || data.returnPickupLocation || "",
    returnDestination: quote.returnDestination || data.returnDestination || "",
    returnPickupTime: quote.returnPickupTime || data.returnPickupTime || "",
    bookingType: quote.bookingType || data.bookingType || "",
    normalFare: quote.normalFarePence != null ? pence(quote.normalFarePence) : "",
    discount: quote.discountPence != null ? pence(quote.discountPence) : "",
    finalFare: quote.finalFarePence != null ? pence(quote.finalFarePence) : "",
    validUntil: quote.validUntil || "",
    terms: quote.terms || "",
    paymentRequirement: quote.paymentRequirement || data.paymentRequirement || "later",
    paymentDescription: quote.paymentDescription === "deposit" ? "Deposit" : "Full payment",
    amountRequested: quote.amountRequestedPence != null ? pence(quote.amountRequestedPence) : "",
    paymentUrl: data.paymentStatus === "paid" || !String(data.paymentLinkUrl || "").startsWith("https://") ? "" : data.paymentLinkUrl,
    paymentLinkPending: (quote.paymentRequirement === "advance" || data.paymentRequirement === "advance") && data.paymentStatus !== "paid" && !data.paymentLinkUrl,
    accepted: Number(data.quoteAcceptedVersion) > 0 && Number(data.quoteAcceptedVersion) === Number(data.quoteIssuedVersion),
  };
}

export default function QuotePage() {
  const [params] = useSearchParams();
  const token = params.get("t") || "";
  const bookingId = params.get("booking") || "";
  const [quote, setQuote] = useState(null);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      setError("");
      try {
        if (token) {
          const res = await fetch(QUOTE_API, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "view", token }),
          });
          const data = await res.json();
          if (!res.ok) throw new Error(data.error || "Could not open this quote.");
          if (!cancelled) setQuote(data.quote);
          return;
        }
        const user = auth.currentUser;
        if (!user || !bookingId) {
          if (!cancelled) setError("Open the quote from your email link or sign in to your account.");
          return;
        }
        const snap = await getDoc(doc(db, "bookings", bookingId));
        if (!snap.exists() || snap.data().uid !== user.uid) {
          if (!cancelled) setError("This quote is not on your account.");
          return;
        }
        if (!cancelled) setQuote(moneyFromBooking({ id: snap.id, ...snap.data() }));
      } catch (err) {
        if (!cancelled) setError(err.message || "Could not open this quote.");
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [token, bookingId]);

  async function accept() {
    setBusy(true);
    setError("");
    setMessage("");
    try {
      if (token) {
        const res = await fetch(QUOTE_API, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action: "accept", token }),
        });
        const data = await res.json();
        if (!res.ok) throw new Error(data.error || "Could not accept this quote.");
        setQuote(data.quote);
        setMessage(data.substatus === "awaiting_payment"
          ? "Quote accepted — awaiting payment. Your booking will be confirmed once payment has been received."
          : "Your booking is confirmed.");
      } else {
        const result = await acceptQuote({ bookingId });
        const data = result.data || {};
        setMessage(data.substatus === "awaiting_payment"
          ? "Quote accepted — awaiting payment. Your booking will be confirmed once payment has been received."
          : data.already
            ? "This quote was already accepted."
            : "Your booking is confirmed.");
        const snap = await getDoc(doc(db, "bookings", bookingId));
        if (snap.exists()) setQuote(moneyFromBooking(snap.data()));
      }
    } catch (err) {
      setError(err.message || "Could not accept this quote.");
    } finally {
      setBusy(false);
    }
  }

  const waiting = quote?.substatus === "awaiting_payment" || quote?.status === "awaiting_customer_confirmation";
  return (
    <main style={{ maxWidth: 720, margin: "2rem auto", padding: "0 1rem", fontFamily: "Georgia, serif", color: "#1a2332" }}>
      <p style={{ color: "#b8956a", letterSpacing: "0.04em" }}>SPIRES TAXIS</p>
      <h1 style={{ color: "#002147" }}>Your quote</h1>
      {!quote && !error ? <p>Loading quote…</p> : null}
      {error ? <p style={{ color: "#991b1b" }}>{error}</p> : null}
      {quote ? (
        <article style={{ background: "#fff", border: "1px solid #e4e9ef", borderRadius: 12, padding: "1.25rem" }}>
          <p><strong>Booking reference</strong> {quote.bookingNumber}</p>
          <p>This is a quote, not a confirmed booking, until we confirm it.</p>
          <p>{quote.pickup} to {quote.destination}</p>
          {quote.dateTime ? <p>When: {quote.dateTime}</p> : null}
          {quote.bookingType === "return" ? (
            <p>Return: {quote.returnPickupLocation} to {quote.returnDestination} {quote.returnPickupTime}</p>
          ) : null}
          <p>Vehicle: {String(quote.vehicle || "").includes("8") ? "8 Seater" : "Standard Car"}</p>
          <p>Normal fare {quote.normalFare}</p>
          <p>Promotion discount {quote.discount}</p>
          <p><strong>Final total {quote.finalFare}</strong></p>
          {quote.validUntil ? <p>Valid until {quote.validUntil}</p> : null}
          <p>{quote.paymentRequirement === "advance" ? `${quote.paymentDescription} of ${quote.amountRequested} is required in advance.` : "Payment can be made later."}</p>
          {waiting && quote.paymentRequirement === "advance" ? (
            <p>Your booking will be confirmed once payment has been received.</p>
          ) : null}
          {quote.substatus === "awaiting_payment" ? <p><strong>Quote accepted — awaiting payment</strong></p> : null}
          <p>{quote.terms}</p>
          {quote.paymentUrl ? (
            <p><a href={quote.paymentUrl} target="_blank" rel="noopener noreferrer">Pay securely</a></p>
          ) : null}
          {quote.paymentLinkPending ? <p>The payment link will follow.</p> : null}
          {message ? <p style={{ color: "#166534" }}>{message}</p> : null}
          <button type="button" onClick={accept} disabled={busy || quote.accepted} style={{ background: "#002147", color: "#fff", border: 0, borderRadius: 8, padding: "0.75rem 1rem" }}>
            {quote.accepted ? "Quote accepted" : busy ? "Accepting…" : "Accept quote"}
          </button>
        </article>
      ) : null}
    </main>
  );
}
