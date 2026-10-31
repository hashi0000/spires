import React, { useEffect, useMemo, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "../utils/firebase";
import { toDatetimeLocalValue } from "../utils/bookingDateTime";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";

type Props = {
  bookingId: string;
  booking: any;
  onWorkflowStatus?: (status: string) => void;
};

const issueQuoteFn = httpsCallable(functions, "issueQuote");
const saveQuoteDraftFn = httpsCallable(functions, "saveQuoteDraft");
const savePaymentLinkFn = httpsCallable(functions, "savePaymentLink");
const sendPaymentRequestFn = httpsCallable(functions, "sendPaymentRequest");
const recordManualPaymentFn = httpsCallable(functions, "recordManualPayment");
const recordManualAcceptanceFn = httpsCallable(functions, "recordManualAcceptance");
const resendQuoteEmailFn = httpsCallable(functions, "resendQuoteEmail");
const retryEmailJobFn = httpsCallable(functions, "retryEmailJob");

function pounds(pence?: number): string {
  if (!Number.isFinite(Number(pence))) return "";
  return (Number(pence) / 100).toFixed(2);
}

export default function QuoteEditor({ bookingId, booking: initialBooking, onWorkflowStatus }: Props) {
  const [booking, setBooking] = useState(initialBooking);
  useEffect(() => onSnapshot(doc(db, 'bookings', bookingId), snap => {
    if (snap.exists()) setBooking(snap.data());
  }, () => setError('Could not refresh this booking. Close and reopen it before recording payment.')), [bookingId]);
  const issued = booking?.quoteDraft || booking?.issuedQuote || {};
  const [normalFare, setNormalFare] = useState(
    issued.normalFarePence ? pounds(issued.normalFarePence) : booking?.actualFare ? String(booking.actualFare) : ""
  );
  const [vehicleType, setVehicleType] = useState(booking?.vehicleType || "standard");
  const [bookingType, setBookingType] = useState(booking?.bookingType === "return" || booking?.returnTrip ? "return" : "one_way");
  const [pickup, setPickup] = useState(booking?.pickupLocation || booking?.pickup || "");
  const [destination, setDestination] = useState(booking?.destination || "");
  const [dateTime, setDateTime] = useState(booking?.pickupTime || booking?.dateTime || "");
  const [returnPickupLocation, setReturnPickupLocation] = useState(booking?.returnPickupLocation || "");
  const [returnDestination, setReturnDestination] = useState(booking?.returnDestination || "");
  const [returnPickupTime, setReturnPickupTime] = useState(booking?.returnPickupTime || "");
  const [validUntil, setValidUntil] = useState(issued.validUntil || "");
  const [paymentRequirement, setPaymentRequirement] = useState(issued.paymentRequirement || booking?.paymentRequirement || "later");
  const [paymentDescription, setPaymentDescription] = useState(issued.paymentDescription || booking?.paymentDescription || "full");
  const [amountRequested, setAmountRequested] = useState(
    issued.amountRequestedPence ? pounds(issued.amountRequestedPence) : booking?.amountRequestedPence ? pounds(booking.amountRequestedPence) : ""
  );
  const [paymentLinkUrl, setPaymentLinkUrl] = useState(issued.paymentLinkUrl || booking?.paymentLinkUrl || "");
  const [reissue, setReissue] = useState(false);
  const receivedTotalPence = booking?.amountReceivedPence != null ? Number(booking.amountReceivedPence) : booking?.paymentStatus === 'paid' ? Math.round(Number(booking?.actualFare || 0) * 100) : 0;
  const [received, setReceived] = useState(pounds(receivedTotalPence));
  const [method, setMethod] = useState(booking?.paymentMethod || "bank transfer");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [preview, setPreview] = useState<{ normal?: string; discount?: string; final?: string } | null>(
    issued.finalFarePence
      ? {
          normal: `£${pounds(issued.normalFarePence)}`,
          discount: `£${pounds(issued.discountPence)}`,
          final: `£${pounds(issued.finalFarePence)}`,
        }
      : null
  );

  useEffect(() => {
    setReceived(pounds(receivedTotalPence));
  }, [receivedTotalPence]);

  const quoteLocked = ['confirmed', 'allocated', 'completed', 'cancelled'].includes(booking?.status);
  const sentLabel = (value: any) => {
    if (!value) return '';
    const date = value?.toDate ? value.toDate() : new Date(value);
    return Number.isNaN(date.getTime()) ? '' : date.toLocaleString('en-GB', { timeZone: 'Europe/London', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' });
  };
  const promotion = booking?.promotion?.eligible === true;
  const payload = useMemo(
    () => ({
      bookingId,
      normalFarePounds: normalFare,
      vehicleType,
      bookingType,
      pickup,
      destination,
      dateTime,
      returnPickupLocation,
      returnDestination,
      returnPickupTime,
      validUntil,
      paymentRequirement,
      paymentDescription,
      amountRequestedPounds: amountRequested,
      paymentLinkUrl,
      reissue,
      passengers: booking?.passengers || 1,
    }),
    [
      bookingId,
      normalFare,
      vehicleType,
      bookingType,
      pickup,
      destination,
      dateTime,
      returnPickupLocation,
      returnDestination,
      returnPickupTime,
      validUntil,
      paymentRequirement,
      paymentDescription,
      amountRequested,
      paymentLinkUrl,
      reissue,
      booking?.passengers,
    ]
  );

  function fareToSend(): string {
    const typed = normalFare.trim();
    if (typed) return typed;
    const stored = booking?.actualFare;
    return stored != null && String(stored).trim() ? String(stored).trim() : "";
  }

  function requireFare(): string {
    const fare = fareToSend().replace(/£/g, "").replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(fare)) {
      setError("Enter the normal quoted total in pounds and pence, for example 85.00.");
      document.getElementById("quote-normal-fare")?.scrollIntoView({ behavior: "smooth", block: "center" });
      return "";
    }
    return fare;
  }

  async function run(label: string, fn: () => Promise<unknown>) {
    setBusy(label);
    setError("");
    setMessage("");
    try {
      const result = await fn();
      return result;
    } catch (err) {
      setError(getCallableErrorMessage(err));
      return null;
    } finally {
      setBusy("");
    }
  }

  return (
    <div className="card" style={{ margin: "0 0 1.25rem", border: "1px solid #e4e9ef" }}>
      <h3 className="card-title" style={{ fontSize: "1.05rem" }}>Quote and payment</h3>
      <div className="quote-money-summary">
        <span>Total <strong>£{Number(booking?.actualFare || 0).toFixed(2)}</strong></span>
        <span>Received <strong>£{pounds(receivedTotalPence)}</strong></span>
        <span>Remaining <strong>£{pounds(Math.max(0, Math.round(Number(booking?.actualFare || 0) * 100) - receivedTotalPence))}</strong></span>
      </div>
      <p className="text-sm text-gray-600" style={{ marginBottom: "0.75rem" }}>
        {promotion
          ? "Half term offer HALFTERM is attached to this request. £5 is taken off the normal return total once."
          : "Prepare the fare and payment requirement, then send the quote."}
        {booking?.quoteIssuedVersion ? ` Issued version ${booking.quoteIssuedVersion}.` : ""}
        {booking?.quoteAcceptanceSubstatus === "awaiting_payment" ? " Quote accepted — awaiting payment." : ""}
      </p>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">Normal quoted total (£)
          <input id="quote-normal-fare" className="form-input" value={normalFare} onChange={(e) => setNormalFare(e.target.value)} placeholder="For example 85.00" />
        </label>
        <label className="text-sm">Vehicle
          <select className="form-input" value={vehicleType} onChange={(e) => setVehicleType(e.target.value)}>
            <option value="standard">Standard Car</option>
            <option value="8_seater">8 Seater</option>
          </select>
        </label>
        <label className="text-sm">Journey
          <select className="form-input" value={bookingType} onChange={(e) => setBookingType(e.target.value)}>
            <option value="one_way">One way</option>
            <option value="return">Return</option>
          </select>
        </label>
        <label className="text-sm">Quote valid until (optional)
          <input className="form-input" type="datetime-local" value={toDatetimeLocalValue(validUntil)} onChange={(e) => setValidUntil(e.target.value ? new Date(e.target.value).toISOString() : "")} />
        </label>
        <details className="quote-section" style={{ gridColumn: '1 / -1' }}>
          <summary>Journey details for this quote</summary>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">Pickup
          <input className="form-input" value={pickup} onChange={(e) => setPickup(e.target.value)} />
        </label>
        <label className="text-sm">Destination
          <input className="form-input" value={destination} onChange={(e) => setDestination(e.target.value)} />
        </label>
        <label className="text-sm">Outbound date and time
          <input className="form-input" type="datetime-local" value={toDatetimeLocalValue(dateTime)} onChange={(e) => setDateTime(e.target.value ? new Date(e.target.value).toISOString() : '')} />
        </label>
        {bookingType === "return" ? (
          <>
            <label className="text-sm">Return pickup
              <input className="form-input" value={returnPickupLocation} onChange={(e) => setReturnPickupLocation(e.target.value)} />
            </label>
            <label className="text-sm">Return destination
              <input className="form-input" value={returnDestination} onChange={(e) => setReturnDestination(e.target.value)} />
            </label>
            <label className="text-sm">Return date and time
              <input className="form-input" type="datetime-local" value={toDatetimeLocalValue(returnPickupTime)} onChange={(e) => setReturnPickupTime(e.target.value ? new Date(e.target.value).toISOString() : '')} />
            </label>
          </>
        ) : null}
          </div>
        </details>
        <label className="text-sm">Payment requirement
          <select className="form-input" value={paymentRequirement} onChange={(e) => setPaymentRequirement(e.target.value)}>
            <option value="later">Payment later</option>
            <option value="advance">Advance payment required</option>
          </select>
        </label>
        <label className="text-sm">Amount description
          <select className="form-input" value={paymentDescription} onChange={(e) => setPaymentDescription(e.target.value)}>
            <option value="full">Full payment</option>
            <option value="deposit">Deposit</option>
          </select>
        </label>
        <label className="text-sm">Amount requested (£)
          <input className="form-input" value={amountRequested} onChange={(e) => setAmountRequested(e.target.value)} placeholder="Defaults to the final quote" />
        </label>
        <label className="text-sm">Payment link (https)
          <input className="form-input" value={paymentLinkUrl} onChange={(e) => setPaymentLinkUrl(e.target.value)} placeholder="https://pay.shift4.com/..." />
        </label>
      </div>
      {preview ? (
        <p className="text-sm" style={{ marginTop: "0.75rem" }}>
          Normal fare {preview.normal}. Discount {preview.discount}. Final total {preview.final}.
        </p>
      ) : null}
      <p className="text-xs text-gray-500">
        Quote email: {booking?.quoteEmailStatus || "not sent"}{booking?.quoteEmailSentAt ? ` (${sentLabel(booking.quoteEmailSentAt)})` : ''}. Payment request: {booking?.paymentLinkEmailStatus || "not sent"}{booking?.paymentLinkSentAt ? ` (${sentLabel(booking.paymentLinkSentAt)})` : ''}.
        Confirmation: {booking?.confirmationEmailStatus || (booking?.confirmationEmailSentAt ? 'sent' : 'not sent')}.
        {booking?.emailError ? ` ${booking.emailError}` : ""}
      </p>
      {quoteLocked && <p className="text-sm text-gray-600">This booking is {booking.status}. A new quote cannot be issued at this stage.</p>}
      {booking?.quoteIssuedVersion && !quoteLocked ? (
        <label className="text-sm" style={{ display: "flex", gap: "0.4rem", marginTop: "0.5rem" }}>
          <input type="checkbox" checked={reissue} onChange={(e) => setReissue(e.target.checked)} />
          Reissue quote. The previous acceptance link will no longer work.
        </label>
      ) : null}
      {error ? <p role="alert" className="text-sm" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {message ? <p role="status" className="text-sm" style={{ color: "#166534" }}>{message}</p> : null}
      <div className="flex flex-wrap gap-2" style={{ marginTop: "0.75rem" }}>
        <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("draft", async () => {
          const fare = requireFare();
          if (!fare) return;
          const res = await saveQuoteDraftFn({ ...payload, normalFarePounds: fare });
          const data = res.data as { formatted?: { normal: string; discount: string; final: string } };
          if (data.formatted) setPreview(data.formatted);
          setMessage("Draft saved. The customer was not emailed.");
        })}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
        <button type="button" className="btn btn-primary" disabled={Boolean(busy) || quoteLocked} onClick={() => run("send", async () => {
          const fare = requireFare();
          if (!fare) return;
          const res = await issueQuoteFn({ ...payload, normalFarePounds: fare });
          const data = res.data as { formatted?: { normal: string; discount: string; final: string }; emailState?: string; version?: number };
          if (data.formatted) setPreview(data.formatted);
          onWorkflowStatus?.("awaiting_customer_confirmation");
          if (data.emailState === 'failed') {
            setError('The quote was saved but its email could not be queued. Check the customer email and resend.');
          } else {
            setMessage(`Quote version ${data.version} saved and email ${data.emailState || 'queued'}. The customer and office copies are sent by the email service.`);
          }
        })}>{busy === "send" ? "Sending…" : "Send quote"}</button>
      </div>
      <details className="quote-section">
        <summary>Payment requests and quote actions</summary>
        <div className="flex flex-wrap gap-2">
        <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("link", async () => {
          await savePaymentLinkFn({
            bookingId,
            paymentLinkUrl,
            amountRequestedPounds: amountRequested,
            paymentDescription,
            clear: !paymentLinkUrl.trim(),
          });
          setMessage(paymentLinkUrl.trim() ? "Payment link saved. It has not been emailed." : "Payment link removed.");
        })}>{busy === "link" ? "Saving…" : "Save payment link"}</button>
        <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("paymail", async () => {
          const res = await sendPaymentRequestFn({ bookingId });
          const data = res.data as { emailState?: string };
          setMessage(`Payment request ${data.emailState || "queued"}. Opening the link does not mark the booking paid.`);
        })}>{busy === "paymail" ? "Queuing…" : "Send payment request"}</button>
        <button type="button" className="btn btn-secondary" disabled={Boolean(busy) || !booking?.quoteIssuedVersion} onClick={() => run("resend", async () => {
          const res = await resendQuoteEmailFn({ bookingId });
          const data = res.data as { emailState?: string };
          setMessage(`Quote resent (${data.emailState || "queued"}) without a new price. A copy is sent to you and bookings@spires-taxis.com.`);
        })}>Resend quote</button>
        <button type="button" className="btn btn-secondary" disabled={Boolean(busy) || !booking?.quoteIssuedVersion} onClick={() => run("accept", async () => {
          if (!window.confirm("Record that the customer accepted this quote by phone?")) return;
          const res = await recordManualAcceptanceFn({ bookingId });
          const data = res.data as { status?: string; substatus?: string };
          if (data.status) onWorkflowStatus?.(data.status);
          setMessage(data.substatus === "awaiting_payment" ? "Acceptance recorded. Quote accepted — awaiting payment." : "Acceptance recorded.");
        })}>Record acceptance</button>
      </div>
      </details>
      <details className="quote-section" open={booking?.quoteAcceptanceSubstatus === 'awaiting_payment' || undefined}>
        <summary>Record or correct payment</summary>
        <p className="text-sm text-gray-600">Enter the total received so far, including any previous deposit. This replaces the recorded total; it does not add another payment.</p>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3" style={{ marginTop: "1rem" }}>
        <label className="text-sm">Total received so far (£)
          <input className="form-input" value={received} onChange={(e) => setReceived(e.target.value)} />
        </label>
        <label className="text-sm">Method
          <input className="form-input" value={method} onChange={(e) => setMethod(e.target.value)} />
        </label>
        <div style={{ alignSelf: "end" }}>
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run("paid", async () => {
            const res = await recordManualPaymentFn({ bookingId, amountReceivedPounds: received, method });
            const data = res.data as { label?: string; confirmed?: boolean; paymentStatus?: string };
            if (data.confirmed) onWorkflowStatus?.("confirmed");
            setMessage(`Payment recorded as ${data.label || data.paymentStatus}. A deposit does not mark the full fare paid.`);
          })}>{busy === "paid" ? "Saving…" : "Record payment received"}</button>
        </div>
      </div>
      </details>
      <div style={{ marginTop: "0.5rem" }}>
        <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => {
          run("retry", async () => {
            const result = await retryEmailJobFn({ bookingId });
            const data = result.data as { retried?: number };
            setMessage(data.retried ? `${data.retried} failed email(s) queued for retry.` : "No failed emails to retry for this booking.");
          });
        }}>Retry failed email</button>
      </div>
    </div>
  );
}
