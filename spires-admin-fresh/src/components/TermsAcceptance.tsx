import React, { useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import {
  CURRENT_BOOKING_TERMS,
  acceptanceMethodLabel,
  formatTermsWhen,
  termsUrlForVersion,
} from "../utils/bookingTerms";

type Props = { booking: any };

const recordFn = httpsCallable(functions, "recordStaffTermsAcceptance");
const linkFn = httpsCallable(functions, "createTermsAcceptanceLink");

export default function TermsAcceptance({ booking }: Props) {
  const accepted = booking?.termsAccepted === true && Boolean(booking?.termsVersion);
  const version = accepted ? String(booking.termsVersion) : "";
  const url = version ? termsUrlForVersion(version) : "";
  const [method, setMethod] = useState("phone");
  const [acceptedAtLocal, setAcceptedAtLocal] = useState("");
  const [note, setNote] = useState("");
  const [link, setLink] = useState("");
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError("");
    setMessage("");
    try {
      await action();
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="card" style={{ margin: "0 0 1.25rem", border: "1px solid #e4e9ef" }}>
      <h3 className="card-title" style={{ fontSize: "1.05rem" }}>Terms agreement</h3>
      {accepted ? (
        <div className="text-sm">
          <p>Accepted</p>
          <p>Terms version {version}</p>
          <p>Accepted {formatTermsWhen(booking.termsAcceptedAt) || "time not recorded"} (London)</p>
          <p>Method: {acceptanceMethodLabel(String(booking.acceptanceMethod || "")) || "Not recorded"}</p>
          {booking.termsAcceptanceRecordedAt ? (
            <p>Recorded {formatTermsWhen(booking.termsAcceptanceRecordedAt)} (London){booking.termsAcceptanceRecordedBy ? ` by ${booking.termsAcceptanceRecordedBy}` : ""}</p>
          ) : null}
          {booking.termsAcceptanceNote ? <p>Note: {booking.termsAcceptanceNote}</p> : null}
          {url ? <p><a href={url} target="_blank" rel="noopener noreferrer">Open the recorded terms version</a></p> : <p>No stored page for this version.</p>}
        </div>
      ) : (
        <p className="text-sm">Acceptance not recorded.</p>
      )}
      <p className="text-sm" style={{ marginTop: "0.75rem" }}>
        Current terms, version {CURRENT_BOOKING_TERMS.version}. Applies to journeys from 1 April 2026. Published 25 October 2026.
        {" "}<a href={CURRENT_BOOKING_TERMS.url} target="_blank" rel="noopener noreferrer">Open terms</a>
      </p>
      {booking?.id && !accepted ? (
        <>
          <div className="flex flex-wrap gap-2" style={{ marginTop: "0.75rem" }}>
            <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("link", async () => {
              const res = await linkFn({ bookingId: booking.id, sendEmail: false });
              const data = res.data as { url?: string };
              setLink(data.url || "");
              setMessage("Acceptance link ready. Opening it does not record agreement.");
            })}>{busy === "link" ? "Preparing…" : "Create acceptance link"}</button>
            <button type="button" className="btn btn-secondary" disabled={Boolean(busy)} onClick={() => run("email", async () => {
              const res = await linkFn({ bookingId: booking.id, sendEmail: true });
              const data = res.data as { url?: string; emailed?: boolean; emailError?: string };
              setLink(data.url || "");
              setMessage(data.emailed ? "Acceptance email queued or sent. Agreement is not recorded until the customer submits it." : (data.emailError || "The link is ready to copy."));
            })}>{busy === "email" ? "Sending…" : "Email acceptance link"}</button>
          </div>
          {link ? (
            <label className="text-sm" style={{ display: "block", marginTop: "0.75rem" }}>
              Acceptance link
              <input className="form-input" readOnly value={link} onFocus={(e) => e.target.select()} />
            </label>
          ) : null}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3" style={{ marginTop: "1rem" }}>
            <label className="text-sm">Acceptance method
              <select className="form-input" value={method} onChange={(e) => setMethod(e.target.value)}>
                <option value="phone">Phone</option>
                <option value="email">Email</option>
                <option value="whatsapp">WhatsApp</option>
                <option value="in_person">In person</option>
                <option value="other">Other</option>
              </select>
            </label>
            <label className="text-sm">When the customer accepted (London)
              <input className="form-input" type="datetime-local" value={acceptedAtLocal} onChange={(e) => setAcceptedAtLocal(e.target.value)} />
            </label>
            <label className="text-sm" style={{ gridColumn: "1 / -1" }}>Reference or note
              <input className="form-input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Call, email or WhatsApp reference" />
            </label>
          </div>
          <button type="button" className="btn btn-primary" style={{ marginTop: "0.75rem" }} disabled={Boolean(busy)} onClick={() => run("record", async () => {
            await recordFn({ bookingId: booking.id, acceptanceMethod: method, acceptedAtLocal, note });
            setMessage("Acceptance recorded. Refresh the booking if the details do not update immediately.");
          })}>{busy === "record" ? "Recording…" : "Record acceptance"}</button>
        </>
      ) : null}
      {error ? <p className="text-sm" style={{ color: "#b91c1c" }} role="alert">{error}</p> : null}
      {message ? <p className="text-sm" style={{ color: "#166534" }}>{message}</p> : null}
    </div>
  );
}
