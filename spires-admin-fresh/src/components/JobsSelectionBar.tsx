import React, { useMemo, useState } from "react";
import type { Booking } from "../types/types";
import { auth, db, functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";
import {
  jobSelectionKey,
  planBulkPaymentLines,
  poundsFromPence,
  type JobCardLeg,
} from "../utils/jobCardActions";
import { commitQuickLegComplete, commitQuickPayment } from "../utils/quickBookingWrite";
import { hasTimedReturn } from "../utils/journeyLegs";

export type SelectedJobRow = {
  key: string;
  booking: Booking;
  leg: JobCardLeg;
};

export function JobsSelectionBar({
  selectedRows,
  selectedKeys,
  onSelectedKeysChange,
  onMessage,
}: {
  selectedRows: SelectedJobRow[];
  selectedKeys: string[];
  onSelectedKeysChange: (keys: string[]) => void;
  onMessage: (message: string) => void;
}) {
  const [busy, setBusy] = useState(false);
  const [confirmPay, setConfirmPay] = useState<"paid" | "completed_paid" | "">("");
  const [method, setMethod] = useState("cash");
  const [batchId] = useState(() => `batch_${Date.now()}`);

  const paymentLines = useMemo(
    () => planBulkPaymentLines(selectedRows.map((row) => ({ key: row.key, booking: row.booking as any, leg: row.leg }))),
    [selectedRows]
  );

  const completeOne = async (row: SelectedJobRow) => {
    const booking = row.booking;
    if (!booking.id) throw new Error("Missing booking id.");
    if (row.leg === "booking" && hasTimedReturn(booking)) {
      await commitQuickLegComplete(db, booking, "outbound", auth.currentUser?.uid || "");
      return;
    }
    const leg = row.leg === "return" ? "return" : "outbound";
    await commitQuickLegComplete(db, booking, leg, auth.currentUser?.uid || "");
  };

  const payOne = async (row: SelectedJobRow, lineAmountPence: number, requestBatch: string) => {
    if (!row.booking.id || !(lineAmountPence > 0)) return;
    await commitQuickPayment(functions, row.booking, poundsFromPence(lineAmountPence), method, {
      clientRequestId: `bulk_pay_${requestBatch}_${row.booking.id}_${row.leg}`,
      leg: row.leg,
      note: "Bulk payment from jobs list",
    });
  };

  const runComplete = async () => {
    if (busy || selectedRows.length === 0) return;
    setBusy(true);
    const succeeded: string[] = [];
    const failed: string[] = [];
    for (const row of selectedRows) {
      try {
        await completeOne(row);
        succeeded.push(row.key);
      } catch (err) {
        failed.push(`${row.booking.bookingNumber}: ${getCallableErrorMessage(err)}`);
      }
    }
    onSelectedKeysChange(selectedKeys.filter((key) => !succeeded.includes(key)));
    onMessage(
      [
        succeeded.length ? `Completed ${succeeded.length} ${succeeded.length === 1 ? "job" : "jobs"}.` : "No jobs were completed.",
        failed.length ? `Failed: ${failed.join(" ")}` : "",
      ].filter(Boolean).join(" ")
    );
    setBusy(false);
  };

  const runPayments = async (alsoComplete: boolean) => {
    if (busy) return;
    const requestBatch = `${batchId}_${Date.now()}`;
    setBusy(true);
    const succeeded: string[] = [];
    const failed: string[] = [];
    const skipped: string[] = [];
    for (const line of paymentLines) {
      const row = selectedRows.find((item) => item.key === line.key);
      if (!row) continue;
      try {
        if (line.skipPayment || line.amountPence == null || line.amountPence <= 0) {
          if (alsoComplete) {
            await completeOne(row);
            succeeded.push(row.key);
          } else {
            skipped.push(`${line.label}: ${line.exception || "No payment recorded"}`);
          }
          continue;
        }
        await payOne(row, line.amountPence, requestBatch);
        if (alsoComplete) await completeOne(row);
        succeeded.push(row.key);
      } catch (err) {
        failed.push(`${line.label}: ${getCallableErrorMessage(err)}`);
      }
    }
    onSelectedKeysChange(selectedKeys.filter((key) => !succeeded.includes(key)));
    onMessage(
      [
        succeeded.length ? `Updated ${succeeded.length} ${succeeded.length === 1 ? "job" : "jobs"}.` : "No jobs were updated.",
        skipped.length ? `Skipped: ${skipped.join(" ")}` : "",
        failed.length ? `Failed: ${failed.join(" ")}` : "",
      ].filter(Boolean).join(" ")
    );
    setConfirmPay("");
    setBusy(false);
  };

  if (selectedRows.length === 0) return null;

  return (
    <>
      <section className="jobs-selection-bar" aria-label="Selected job actions">
        <p className="jobs-selection-count">{selectedRows.length} selected</p>
        <div className="jobs-selection-actions">
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => void runComplete()}>
            Mark completed
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirmPay("paid")}>
            Record as paid
          </button>
          <button type="button" className="btn btn-primary" disabled={busy} onClick={() => setConfirmPay("completed_paid")}>
            Mark completed and paid
          </button>
          <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => onSelectedKeysChange([])}>
            Clear
          </button>
        </div>
      </section>
      {confirmPay ? (
        <div className="jobs-payment-sheet" role="dialog" aria-modal="true" aria-label="Confirm bulk payment">
          <div className="jobs-payment-sheet-card">
            <h3>{confirmPay === "completed_paid" ? "Mark completed and paid" : "Record as paid"}</h3>
            <p>Review each selected job and the amount that will be recorded. Journey status and payment stay independent.</p>
            <label>
              Payment method for this save
              <select value={method} onChange={(event) => setMethod(event.target.value)} disabled={busy}>
                <option value="cash">Cash</option>
                <option value="card">Card</option>
                <option value="bank transfer">Bank transfer</option>
              </select>
            </label>
            <ul className="jobs-payment-list">
              {paymentLines.map((line) => (
                <li key={line.key} className={line.exception ? "is-exception" : undefined}>
                  <strong>{line.label}</strong>
                  {line.exception ? (
                    <span>{line.exception}</span>
                  ) : (
                    <span>£{poundsFromPence(line.amountPence || 0)} outstanding after deposits and part payments</span>
                  )}
                </li>
              ))}
            </ul>
            {paymentLines.some((line) => line.exception) ? (
              <p className="jobs-payment-note">Flagged jobs will not receive a payment on this save. They stay selected if the payment step is skipped or fails.</p>
            ) : null}
            <div className="jobs-selection-actions">
              <button
                type="button"
                className="btn btn-primary"
                disabled={busy}
                onClick={() => void runPayments(confirmPay === "completed_paid")}
              >
                {busy ? "Saving…" : "Confirm and save"}
              </button>
              <button type="button" className="btn btn-secondary" disabled={busy} onClick={() => setConfirmPay("")}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

export function selectedRowsFromKeys(
  keys: string[],
  rows: Array<{ booking: Booking; leg?: { leg?: string } | null }>
): SelectedJobRow[] {
  const map = new Map<string, SelectedJobRow>();
  rows.forEach((row) => {
    if (!row.booking.id) return;
    const leg: JobCardLeg = row.leg?.leg === "return" ? "return" : row.leg?.leg === "outbound" ? "outbound" : "booking";
    const key = jobSelectionKey(row.booking.id, leg);
    map.set(key, { key, booking: row.booking, leg });
  });
  return keys.map((key) => map.get(key)).filter((row): row is SelectedJobRow => Boolean(row));
}
