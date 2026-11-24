import React, { useEffect, useRef, useState } from "react";
import type { Booking } from "../types/types";
import { auth, db, functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import { legPaymentDue, poundsFromPence, type JobCardLeg } from "../utils/jobCardActions";
import { commitQuickLegStatus, commitQuickPayment } from "../utils/quickBookingWrite";
import type { JourneyLegName, JourneyLegStatus } from "../utils/journeyLegs";
import { hasTimedReturn } from "../utils/journeyLegs";
import { CompleteJobActions } from "./CompleteJobActions";

const STATUS_OPTIONS: { value: JourneyLegStatus; label: string }[] = [
  { value: "pending", label: "Pending" },
  { value: "awaiting_customer_confirmation", label: "Awaiting customer confirmation" },
  { value: "confirmed", label: "Confirmed" },
  { value: "allocated", label: "Allocated" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

function resolveLeg(leg: JobCardLeg, booking: Booking): JourneyLegName {
  if (leg === "return") return "return";
  if (leg === "outbound") return "outbound";
  return "outbound";
}

export function JobCardStatusControls({
  booking,
  leg,
  badgeLabel,
  badgeClass,
  paymentLabel,
  paymentPaid,
}: {
  booking: Booking;
  leg: JobCardLeg;
  badgeLabel: string;
  badgeClass: string;
  paymentLabel: string;
  paymentPaid: boolean;
}) {
  const [open, setOpen] = useState<"status" | "payment" | "">("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [partAmount, setPartAmount] = useState("");
  const [method, setMethod] = useState(String(booking.paymentMethod || "cash") || "cash");
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (event: MouseEvent) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen("");
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [open]);

  const due = legPaymentDue(booking as unknown as Record<string, unknown>, leg);
  const suggested = due.ok && due.amountPence > 0 ? poundsFromPence(due.amountPence) : poundsFromPence(due.outstandingPence);

  const saveStatus = async (next: JourneyLegStatus) => {
    if (busy || !booking.id) return;
    setBusy(true);
    setMessage("");
    try {
      const named = resolveLeg(leg, booking);
      if (leg === "booking" && hasTimedReturn(booking) && next === "completed") {
        await commitQuickLegStatus(db, booking, "outbound", "completed", auth.currentUser?.uid || "");
      } else {
        await commitQuickLegStatus(db, booking, named, next, auth.currentUser?.uid || "");
      }
      setMessage("Journey status saved.");
      setOpen("");
    } catch (err) {
      setMessage(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const savePayment = async (mode: "full" | "part") => {
    if (busy || !booking.id) return;
    const amount = mode === "full" ? suggested : partAmount.trim();
    if (!amount || Number(amount) <= 0) {
      setMessage("Enter the amount received.");
      return;
    }
    setBusy(true);
    setMessage("");
    try {
      const requestId = `card_pay_${booking.id}_${leg}_${amount}_${method}`;
      await commitQuickPayment(functions, booking, amount, method, {
        clientRequestId: requestId,
        leg,
        note: mode === "full" ? "Recorded from jobs list" : "Part payment from jobs list",
      });
      setPartAmount("");
      setMessage(mode === "full" ? "Payment recorded." : "Part payment recorded.");
      setOpen("");
    } catch (err) {
      setMessage(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const canComplete = !["completed", "cancelled"].includes(String(
    leg === "return" ? (booking as any).returnStatus || booking.status : booking.status || ""
  ));

  return (
    <div className="job-card-badges" ref={rootRef}>
      {canComplete ? (
        <CompleteJobActions
          booking={booking}
          leg={leg}
          compact
          onDone={(text) => {
            setMessage(text);
            setOpen("");
          }}
        />
      ) : null}
      <button
        type="button"
        className={`badge badge-button ${badgeClass}`}
        aria-expanded={open === "status"}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => (current === "status" ? "" : "status"));
          setMessage("");
        }}
      >
        {badgeLabel}
      </button>
      <button
        type="button"
        className={`badge badge-button ${paymentPaid ? "badge-paid" : "badge-unpaid"}`}
        aria-expanded={open === "payment"}
        aria-haspopup="dialog"
        onClick={(event) => {
          event.preventDefault();
          event.stopPropagation();
          setOpen((current) => (current === "payment" ? "" : "payment"));
          setMessage("");
          setPartAmount(suggested);
        }}
      >
        {paymentLabel}
      </button>
      {open === "status" ? (
        <div className="job-card-popover" role="dialog" aria-label="Journey status">
          <p className="job-card-popover-title">Journey status</p>
          <div className="job-card-popover-actions">
            {STATUS_OPTIONS.map((option) => (
              <button
                key={option.value}
                type="button"
                className="btn btn-secondary btn-sm"
                disabled={busy}
                onClick={() => void saveStatus(option.value)}
              >
                {option.label}
              </button>
            ))}
          </div>
          {message ? <p role="status">{message}</p> : null}
        </div>
      ) : null}
      {open === "payment" ? (
        <div className="job-card-popover" role="dialog" aria-label="Payment controls">
          <p className="job-card-popover-title">Payment</p>
          {!due.ok ? <p className="job-card-exception">{due.reason}</p> : null}
          {due.kind === "account" ? <p>On account — no payment to collect.</p> : null}
          {due.kind === "paid" ? <p>Already paid. Nothing remains due.</p> : null}
          {due.ok && due.amountPence > 0 ? (
            <>
              <p>Outstanding on this card: £{poundsFromPence(due.amountPence)}</p>
              <label>
                Method
                <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={busy}>
                  <option value="cash">Cash</option>
                  <option value="card">Card</option>
                  <option value="bank transfer">Bank transfer</option>
                </select>
              </label>
              <button type="button" className="btn btn-primary btn-sm" disabled={busy} onClick={() => void savePayment("full")}>
                {busy ? "Saving…" : `Record £${poundsFromPence(due.amountPence)} as paid`}
              </button>
              <label>
                Part payment amount (£)
                <input inputMode="decimal" value={partAmount} onChange={(event) => setPartAmount(event.target.value)} disabled={busy} />
              </label>
              <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={() => void savePayment("part")}>
                Record part payment
              </button>
            </>
          ) : null}
          {message ? <p role="status">{message}</p> : null}
        </div>
      ) : null}
    </div>
  );
}
