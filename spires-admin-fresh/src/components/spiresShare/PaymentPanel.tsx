import React from "react";
import { LiveCountdown } from "./LiveCountdown";
import { gbp, isoToLocalInput, PAYMENT_GUARANTEE } from "./shareLabels";
import { ShareJourney } from "./types";

export function PaymentPanel({
  journey,
  required,
  verified,
  collected,
  remaining,
  paymentDraft,
  deadlineDraft,
  onPaymentDraft,
  onDeadlineDraft,
  onSaveLink,
  onOpenWindow,
  onChangeDeadline,
  busyKey,
}: {
  journey: ShareJourney;
  required: number;
  verified: number;
  collected: number;
  remaining: number;
  paymentDraft: string;
  deadlineDraft: string;
  onPaymentDraft: (value: string) => void;
  onDeadlineDraft: (value: string) => void;
  onSaveLink: () => void;
  onOpenWindow: () => void;
  onChangeDeadline: () => void;
  busyKey: string;
}) {
  const masked = journey.paymentLinkUrl ? journey.paymentLinkUrl.replace(/^https?:\/\//, "").slice(-32) : "";
  return (
    <section className="share-ops-section">
      <h4>Payment</h4>
      <p>Fare per passenger: {gbp(journey.farePence)}</p>
      <p>Required: {required}</p>
      <p>Verified: {verified} / {required}</p>
      <p>Collected: {gbp(collected)}</p>
      <p>Target: {gbp(journey.targetRevenuePence)}</p>
      {journey.paymentDeadlineAt ? <LiveCountdown deadlineAt={journey.paymentDeadlineAt} prefix="Payment closes in" /> : null}
      {remaining > 0 ? <p>{remaining} payment{remaining === 1 ? "" : "s"} remaining. Journey not yet confirmed.</p> : null}
      <p className="share-ops-note">{PAYMENT_GUARANTEE}</p>
      {masked ? <p className="share-ops-muted">Saved link ending {masked}. Saving a link does not email passengers.</p> : <p>No payment link saved.</p>}
      <div className="share-ops-inline">
        <input className="form-input" placeholder="Hosted payment URL" value={paymentDraft} onChange={(e) => onPaymentDraft(e.target.value)} />
        <button type="button" className="btn btn-sm" disabled={busyKey === `link-${journey.id}` || !paymentDraft} onClick={onSaveLink}>Save payment URL</button>
      </div>
      {journey.paymentStageStatus === "OPEN" ? (
        <div className="share-ops-inline">
          <input className="form-input" type="datetime-local" value={deadlineDraft || isoToLocalInput(journey.paymentDeadlineAt)} onChange={(e) => onDeadlineDraft(e.target.value)} />
          <button type="button" className="btn btn-sm" disabled={busyKey === `pdead-${journey.id}`} onClick={onChangeDeadline}>Change payment deadline</button>
        </div>
      ) : null}
      {journey.paymentLinkUrl && journey.paymentStageStatus !== "OPEN" ? (
        <button type="button" className="btn btn-primary" disabled={busyKey === `openpay-${journey.id}`} onClick={onOpenWindow}>Open payment window</button>
      ) : null}
    </section>
  );
}
