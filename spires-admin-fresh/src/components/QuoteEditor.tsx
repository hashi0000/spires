import React, { useEffect, useRef, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { doc, onSnapshot } from "firebase/firestore";
import { db, functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import { paymentMethods } from "../utils/constants";
import { VEHICLE_TYPE_OPTIONS } from "../utils/vehicleTypes";
import { isBankTransferMethod, SPIRES_BANK_DETAILS } from "../utils/bankDetails";
import { depositStillDuePence, money, paymentSummary, quoteSendState } from "../utils/farePayment";
import { fromDatetimeLocalValue } from "../utils/bookingDateTime";

export type FareForm = {
  actualFare: string;
  vehicleType: string;
  paymentMethod: string;
  depositRequired: boolean;
  depositAmount: string;
  pickupLocation: string;
  destination: string;
  pickupTime: string;
  bookingType: string;
  returnPickupLocation: string;
  returnDestination: string;
  returnPickupTime: string;
  passengers?: number | string;
  status: string;
};

type Props = {
  bookingId: string;
  form: FareForm;
  onChange: (patch: Partial<Omit<FareForm, "passengers" | "status">>) => void;
  onWorkflowStatus?: (status: string) => void;
};

type EmailRow = { id: string; kind: string; status: string; at: string };

const issueQuoteFn = httpsCallable(functions, "issueQuote");
const saveQuoteDraftFn = httpsCallable(functions, "saveQuoteDraft");
const sendPaymentRequestFn = httpsCallable(functions, "sendPaymentRequest");
const recordManualPaymentFn = httpsCallable(functions, "recordManualPayment");
const resendQuoteEmailFn = httpsCallable(functions, "resendQuoteEmail");
const retryEmailJobFn = httpsCallable(functions, "retryEmailJob");
const listBookingEmailsFn = httpsCallable(functions, "listBookingEmails");

const EMAIL_LABELS: Record<string, string> = {
  quote: "Quote",
  payment_request: "Payment request",
  booking_confirmed: "Confirmation",
  payment_receipt: "Receipt",
  acceptance_customer: "Acceptance",
  acceptance_admin: "Office note",
};

function requestId(): string {
  return `pay${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
}

function sentLabel(value: unknown): string {
  if (!value) return "";
  const raw = value as { toDate?: () => Date };
  const date = raw.toDate ? raw.toDate() : new Date(String(value));
  return Number.isNaN(date.getTime())
    ? ""
    : date.toLocaleString("en-GB", { timeZone: "Europe/London", day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
}

export default function QuoteEditor({ bookingId, form, onChange, onWorkflowStatus }: Props) {
  const [booking, setBooking] = useState<any>(null);
  const [paymentLink, setPaymentLink] = useState("");
  const [customerMessage, setCustomerMessage] = useState("");
  const [reissue, setReissue] = useState(false);
  const [panel, setPanel] = useState<"pay" | "record" | "correct" | "">("");
  const [requestKind, setRequestKind] = useState<"balance" | "deposit">("balance");
  const [requestAmount, setRequestAmount] = useState("");
  const [receivedAmount, setReceivedAmount] = useState("");
  const [receivedMethod, setReceivedMethod] = useState(form.paymentMethod || "bank transfer");
  const [receivedDate, setReceivedDate] = useState("");
  const [receivedNote, setReceivedNote] = useState("");
  const [correctTotal, setCorrectTotal] = useState("");
  const [correctReason, setCorrectReason] = useState("");
  const [emails, setEmails] = useState<EmailRow[]>([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const payRequest = useRef(requestId());
  const recordRequest = useRef(requestId());

  useEffect(() => onSnapshot(doc(db, "bookings", bookingId), (snap) => {
    if (!snap.exists()) return;
    const data = snap.data();
    setBooking(data);
    setPaymentLink((current) => current || data.paymentLinkUrl || "");
  }, () => setError("Could not refresh this booking. Close and reopen it before recording payment.")), [bookingId]);

  useEffect(() => {
    listBookingEmailsFn({ bookingId })
      .then((res) => setEmails(((res.data as { emails?: EmailRow[] }).emails) || []))
      .catch(() => setEmails([]));
  }, [bookingId, message]);

  const receivedPence = booking?.amountReceivedPence != null
    ? Number(booking.amountReceivedPence)
    : booking?.paymentStatus === "paid"
      ? Math.round(Number(form.actualFare || booking?.actualFare || 0) * 100)
      : 0;
  const summary = paymentSummary(Number(form.actualFare || 0), receivedPence, booking?.paymentStatus);
  const quoteState = quoteSendState(form.status);
  const canPay = form.status !== "cancelled";
  const depositDue = money(depositStillDuePence(Number(form.depositAmount || 0), receivedPence));
  const outstanding = money(summary.outstandingPence);

  function quotePayload(fare: string) {
    return {
      bookingId,
      normalFarePounds: fare,
      vehicleType: form.vehicleType,
      bookingType: form.bookingType === "return" ? "return" : "one_way",
      pickup: form.pickupLocation,
      destination: form.destination,
      dateTime: form.pickupTime ? fromDatetimeLocalValue(form.pickupTime) : "",
      returnPickupLocation: form.returnPickupLocation,
      returnDestination: form.returnDestination,
      returnPickupTime: form.returnPickupTime ? fromDatetimeLocalValue(form.returnPickupTime) : "",
      paymentRequirement: form.depositRequired ? "advance" : "later",
      paymentDescription: form.depositRequired ? "deposit" : "full",
      amountRequestedPounds: form.depositRequired ? form.depositAmount : "",
      paymentLinkUrl: paymentLink,
      customerMessage,
      reissue,
      passengers: form.passengers || 1,
    };
  }

  function fareValue(): string {
    const fare = String(form.actualFare || "").replace(/£/g, "").replace(/,/g, "").trim();
    if (!/^\d+(\.\d{1,2})?$/.test(fare)) {
      setError("Enter the agreed fare in pounds, for example 85.00.");
      return "";
    }
    if (form.depositRequired && !/^\d+(\.\d{1,2})?$/.test(String(form.depositAmount || "").trim())) {
      setError("Enter the deposit amount.");
      return "";
    }
    return fare;
  }

  async function run(label: string, fn: () => Promise<void>) {
    if (busy) return;
    setBusy(label);
    setError("");
    setMessage("");
    try {
      await fn();
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusy("");
    }
  }

  const latestQuote = booking?.quoteEmailStatus === "sent" && booking?.quoteEmailSentAt
    ? `Quote sent ${sentLabel(booking.quoteEmailSentAt)}.`
    : booking?.quoteEmailStatus === "queued"
      ? "Quote queued."
      : "";

  return (
    <div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4 text-sm">
        <div><div className="text-gray-500">Agreed fare</div><strong>£{Number(form.actualFare || 0).toFixed(2)}</strong></div>
        <div><div className="text-gray-500">Amount paid</div><strong>£{money(summary.receivedPence)}</strong></div>
        <div><div className="text-gray-500">Outstanding</div><strong>£{outstanding}</strong></div>
        <div><div className="text-gray-500">Payment status</div><strong>{summary.label}</strong></div>
      </div>
      {summary.overpaymentPence > 0 ? <p className="text-sm mb-3">£{money(summary.overpaymentPence)} is recorded above the agreed fare. It is kept in the payment history.</p> : null}
      {booking?.paymentStatus === "refunded" ? <p className="text-sm mb-3">This booking is marked refunded. Use More actions if that needs correcting.</p> : null}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <label className="text-sm">Agreed fare (£)
          <input className="form-input" inputMode="decimal" value={form.actualFare || ""} onChange={(e) => onChange({ actualFare: e.target.value })} />
        </label>
        <label className="text-sm">Vehicle class
          <select className="form-input" value={form.vehicleType || ""} onChange={(e) => onChange({ vehicleType: e.target.value })}>
            <option value="">Not specified</option>
            {VEHICLE_TYPE_OPTIONS.map((opt) => <option key={opt.value} value={opt.value}>{opt.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Payment method
          <select className="form-input" value={form.paymentMethod || "cash"} onChange={(e) => onChange({ paymentMethod: e.target.value })}>
            {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
          </select>
        </label>
        <label className="text-sm">Deposit required
          <select className="form-input" value={form.depositRequired ? "yes" : "no"} onChange={(e) => onChange({ depositRequired: e.target.value === "yes", depositAmount: e.target.value === "yes" ? form.depositAmount : "" })}>
            <option value="no">No</option>
            <option value="yes">Yes</option>
          </select>
        </label>
        {form.depositRequired ? (
          <label className="text-sm">Deposit amount (£)
            <input className="form-input" inputMode="decimal" value={form.depositAmount || ""} onChange={(e) => onChange({ depositAmount: e.target.value })} />
          </label>
        ) : null}
        <label className="text-sm">Payment link (optional)
          <input className="form-input" value={paymentLink} onChange={(e) => setPaymentLink(e.target.value)} placeholder="https://" />
        </label>
      </div>
      <details className="quote-section">
        <summary>Fare guidance</summary>
        <p className="text-xs text-gray-600">Published airport prices are for Oxford only. Quote Abingdon, Kidlington, Witney, Bicester, Didcot and other towns separately. Do not change a fare that has already been agreed.</p>
      </details>
      {isBankTransferMethod(form.paymentMethod) && summary.label !== "Paid" ? (
        <p className="text-xs text-gray-600 mt-2">{SPIRES_BANK_DETAILS.accountName}. Sort code {SPIRES_BANK_DETAILS.sortCode}. Account {SPIRES_BANK_DETAILS.accountNumber}. The booking number is the reference.</p>
      ) : null}

      <label className="text-sm mt-3 block">Message for the customer (optional)
        <input className="form-input" value={customerMessage} onChange={(e) => setCustomerMessage(e.target.value)} />
      </label>
      {latestQuote ? <p className="text-sm mt-2">{latestQuote}</p> : null}
      {quoteState.reason ? <p className="text-sm mt-2">{quoteState.reason}</p> : null}
      {quoteState.reissue ? (
        <label className="text-sm mt-2" style={{ display: "flex", gap: "0.4rem" }}>
          <input type="checkbox" checked={reissue} onChange={(e) => setReissue(e.target.checked)} />
          Send an updated quote. The previous acceptance link will stop working.
        </label>
      ) : null}
      {error ? <p role="alert" className="text-sm mt-2" style={{ color: "#b91c1c" }}>{error}</p> : null}
      {message ? <p role="status" className="text-sm mt-2" style={{ color: "#166534" }}>{message}</p> : null}

      <div className="flex flex-wrap gap-2 mt-3">
        <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("draft", async () => {
          const fare = fareValue();
          if (!fare) return;
          const res = await saveQuoteDraftFn(quotePayload(fare));
          const data = res.data as { formatted?: { final: string } };
          if (data.formatted?.final) onChange({ actualFare: data.formatted.final.replace(/£/g, "").replace(/,/g, "") });
          setMessage("Draft saved. The customer was not emailed.");
        })}>{busy === "draft" ? "Saving…" : "Save draft"}</button>
        {(quoteState.send || (quoteState.reissue && reissue)) ? (
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run("send", async () => {
            const fare = fareValue();
            if (!fare) return;
            const res = await issueQuoteFn(quotePayload(fare));
            const data = res.data as { formatted?: { final: string }; emailState?: string; version?: number };
            if (data.formatted?.final) onChange({ actualFare: data.formatted.final.replace(/£/g, "").replace(/,/g, "") });
            onWorkflowStatus?.("awaiting_customer_confirmation");
            if (data.emailState === "failed" || data.emailState === "skipped") {
              setError(data.emailState === "skipped"
                ? "The quote was saved. This booking has no email address, so call the customer."
                : "The quote was saved, but the email could not be queued. Use Email history to retry.");
            } else {
              setMessage(`Quote version ${data.version} sent.`);
              setReissue(false);
            }
          })}>{busy === "send" ? "Sending…" : quoteState.reissue ? "Send updated quote" : "Send quote"}</button>
        ) : null}
        {canPay ? <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => { setPanel(panel === "pay" ? "" : "pay"); setRequestKind("balance"); setRequestAmount(outstanding); payRequest.current = requestId(); }}>Request payment</button> : null}
        {canPay ? <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => { setPanel(panel === "record" ? "" : "record"); setReceivedAmount(""); recordRequest.current = requestId(); }}>Record payment</button> : null}
      </div>

      {panel === "pay" ? (
        <div className="mt-3 p-3 border rounded bg-white">
          <p className="text-sm mb-2">This sends a request. It does not record money received.</p>
          <label className="text-sm block mb-2">
            <input type="radio" checked={requestKind === "balance"} onChange={() => { setRequestKind("balance"); setRequestAmount(outstanding); }} /> Full outstanding balance (£{outstanding})
          </label>
          <label className="text-sm block mb-2">
            <input type="radio" checked={requestKind === "deposit"} onChange={() => { setRequestKind("deposit"); setRequestAmount(depositDue); }} /> Deposit or other amount
          </label>
          <label className="text-sm">Amount (£)
            <input className="form-input" value={requestAmount} onChange={(e) => setRequestAmount(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary mt-2" disabled={Boolean(busy)} onClick={() => run("paymail", async () => {
            const res = await sendPaymentRequestFn({
              bookingId,
              amountRequestedPounds: requestAmount,
              paymentDescription: requestKind === "deposit" ? "deposit" : "full",
              paymentLinkUrl: paymentLink,
              method: form.paymentMethod,
              clientRequestId: payRequest.current,
            });
            const data = res.data as { emailState?: string };
            if (data.emailState === "skipped") setMessage("This request was already sent.");
            else setMessage("Payment request sent. The booking is not marked paid.");
            setPanel("");
          })}>{busy === "paymail" ? "Sending…" : "Send request"}</button>
        </div>
      ) : null}

      {panel === "record" ? (
        <div className="mt-3 p-3 border rounded bg-white grid grid-cols-1 md:grid-cols-2 gap-3">
          <label className="text-sm">Amount received (£)
            <input className="form-input" value={receivedAmount} onChange={(e) => setReceivedAmount(e.target.value)} />
          </label>
          <label className="text-sm">Method
            <select className="form-input" value={receivedMethod} onChange={(e) => setReceivedMethod(e.target.value)}>
              {paymentMethods.map((method) => <option key={method.value} value={method.value}>{method.label}</option>)}
            </select>
          </label>
          <label className="text-sm">Date
            <input className="form-input" type="date" value={receivedDate} onChange={(e) => setReceivedDate(e.target.value)} />
          </label>
          <label className="text-sm">Reference or note
            <input className="form-input" value={receivedNote} onChange={(e) => setReceivedNote(e.target.value)} />
          </label>
          <button type="button" className="btn btn-primary" disabled={Boolean(busy)} onClick={() => run("paid", async () => {
            const res = await recordManualPaymentFn({
              bookingId,
              mode: "add",
              amountPounds: receivedAmount,
              method: receivedMethod,
              paidOn: receivedDate,
              note: receivedNote,
              clientRequestId: recordRequest.current,
            });
            const data = res.data as { label?: string; duplicate?: boolean; confirmed?: boolean };
            if (data.confirmed) onWorkflowStatus?.("confirmed");
            setMessage(data.duplicate ? "This payment was already recorded." : `Payment recorded. Status: ${data.label || "updated"}.`);
            setPanel("");
            recordRequest.current = requestId();
          })}>{busy === "paid" ? "Saving…" : "Save payment"}</button>
        </div>
      ) : null}

      <details className="quote-section">
        <summary>Email history</summary>
        {emails.length === 0 ? <p className="text-sm">No quote or payment emails yet.</p> : (
          <ul className="text-sm">
            {emails.map((row) => (
              <li key={row.id} className="flex flex-wrap gap-2 items-center py-1">
                <span>{EMAIL_LABELS[row.kind] || "Email"}</span>
                <span>{row.status}</span>
                <span>{row.at ? sentLabel(row.at) : ""}</span>
                {row.status === "failed" ? (
                  <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy)} onClick={() => run("retry", async () => {
                    const res = await retryEmailJobFn({ jobId: row.id });
                    const data = res.data as { retried?: number };
                    setMessage(data.retried ? "That email was queued again." : "That email could not be retried.");
                  })}>Retry</button>
                ) : null}
              </li>
            ))}
          </ul>
        )}
      </details>

      <details className="quote-section">
        <summary>More actions</summary>
        <div className="flex flex-wrap gap-2">
          <button type="button" className="btn btn-secondary btn-sm" disabled={Boolean(busy) || !booking?.quoteIssuedVersion} onClick={() => run("resend", async () => {
            await resendQuoteEmailFn({ bookingId });
            setMessage("The current quote was resent. The price was not changed.");
          })}>Resend quote</button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setPanel(panel === "correct" ? "" : "correct")}>Correct a payment</button>
        </div>
        {panel === "correct" ? (
          <div className="mt-3 grid grid-cols-1 md:grid-cols-2 gap-3">
            <p className="text-sm md:col-span-2">This replaces the recorded total and keeps the previous figure in the audit. Use it for a reversal or a mistake. It does not delete the history.</p>
            <label className="text-sm">Corrected total received (£)
              <input className="form-input" value={correctTotal} onChange={(e) => setCorrectTotal(e.target.value)} />
            </label>
            <label className="text-sm">Reason
              <input className="form-input" value={correctReason} onChange={(e) => setCorrectReason(e.target.value)} />
            </label>
            <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("correct", async () => {
              const res = await recordManualPaymentFn({
                bookingId,
                mode: "correct",
                amountPounds: correctTotal,
                reason: correctReason,
                method: receivedMethod,
                clientRequestId: requestId(),
              });
              const data = res.data as { label?: string };
              setMessage(`Payment total corrected. Status: ${data.label || "updated"}.`);
              setPanel("");
            })}>Save correction</button>
          </div>
        ) : null}
      </details>
    </div>
  );
}
