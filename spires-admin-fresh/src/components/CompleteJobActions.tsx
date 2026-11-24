import React, { useState } from "react";
import type { Booking } from "../types/types";
import { auth, functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import { completeActionPlan } from "../utils/completeAction";
import { poundsFromPence, type JobCardLeg } from "../utils/jobCardActions";
import { httpsCallable } from "firebase/functions";

type Props = {
  booking: Booking;
  leg?: JobCardLeg;
  compact?: boolean;
  onDone?: (message: string) => void;
};

export function CompleteJobActions({ booking, leg = "outbound", compact = false, onDone }: Props) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [confirmAmount, setConfirmAmount] = useState<number | null>(null);
  const [differentOpen, setDifferentOpen] = useState(false);
  const [differentAmount, setDifferentAmount] = useState("");
  const plan = completeActionPlan(booking as unknown as Record<string, unknown>, leg);
  const journey = leg === "return" ? "return" : "outbound";

  if (!booking.id) return null;
  const status = String(booking.status || "");
  if (status === "cancelled" || status === "completed") {
    if (leg === "return" && String((booking as any).returnStatus || "") === "completed") return null;
    if (leg !== "return" && status === "completed") return null;
  }

  const run = async (mode: "complete_and_record" | "complete_only", options: {
    confirmChangedAmount?: boolean;
    amountPounds?: string;
    expectedAmountPence?: number;
  } = {}) => {
    if (busy || !booking.id) return;
    setBusy(true);
    setMessage("");
    try {
      const call = httpsCallable(functions, "completeAndRecordPayment");
      const clientRequestId = `complete_${booking.id}_${journey}_${options.amountPounds || plan.amountPence}_${Date.now()}`;
      const result = await call({
        bookingId: booking.id,
        leg: journey,
        mode,
        expectedRevision: Number(booking.revision || 0),
        expectedAmountPence: options.expectedAmountPence ?? (mode === "complete_and_record" ? plan.amountPence : 0),
        confirmChangedAmount: options.confirmChangedAmount === true,
        amountPounds: options.amountPounds,
        method: plan.methodKnown ? plan.paymentMethod : "",
        clientRequestId,
        actorUid: auth.currentUser?.uid || "",
      });
      const data = (result.data || {}) as {
        ok?: boolean;
        needsConfirm?: boolean;
        amountPence?: number;
        message?: string;
        label?: string;
      };
      if (data.needsConfirm && data.amountPence != null) {
        setConfirmAmount(data.amountPence);
        setMessage(data.message || "The balance changed. Confirm the new amount.");
        return;
      }
      const text = data.message || "Journey updated.";
      setMessage(text);
      setConfirmAmount(null);
      setDifferentOpen(false);
      onDone?.(text);
    } catch (err) {
      setMessage(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={compact ? "complete-job-actions complete-job-actions--compact" : "complete-job-actions"}>
      {confirmAmount != null ? (
        <div className="complete-job-confirm" role="status">
          <p>Balance is now £{poundsFromPence(confirmAmount)}. Confirm to complete and record that amount.</p>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void run("complete_and_record", { confirmChangedAmount: true, expectedAmountPence: confirmAmount })}
          >
            {busy ? "Saving…" : `Confirm £${poundsFromPence(confirmAmount)}`}
          </button>
          <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => setConfirmAmount(null)}>
            Cancel
          </button>
        </div>
      ) : (
        <>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy}
            onClick={() => void run(plan.mode === "complete_and_record" ? "complete_and_record" : "complete_only")}
          >
            {busy ? "Saving…" : plan.primaryLabel}
          </button>
          {plan.mode === "complete_and_record" ? (
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              disabled={busy}
              onClick={() => void run("complete_only")}
            >
              Complete without payment
            </button>
          ) : null}
          <button
            type="button"
            className="btn btn-secondary btn-sm"
            disabled={busy}
            onClick={() => {
              setDifferentOpen((open) => !open);
              setDifferentAmount(plan.amountPence > 0 ? poundsFromPence(plan.amountPence) : "");
            }}
          >
            Record a different amount
          </button>
        </>
      )}
      {differentOpen ? (
        <div className="complete-job-different">
          <label>
            Amount received (£)
            <input
              inputMode="decimal"
              value={differentAmount}
              onChange={(event) => setDifferentAmount(event.target.value)}
              disabled={busy}
            />
          </label>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={busy || !differentAmount.trim()}
            onClick={() => void run("complete_and_record", { amountPounds: differentAmount.trim() })}
          >
            {busy ? "Saving…" : "Complete and record"}
          </button>
        </div>
      ) : null}
      {message ? <p className="complete-job-message" role="status">{message}</p> : null}
    </div>
  );
}
