import React, { useState } from "react";
import { Drawer } from "./Drawer";
import { LiveCountdown } from "./LiveCountdown";
import { formatUkDate, isoToLocalInput } from "./shareLabels";
import { ShareInterestGroup } from "./types";

export function InterestReviewDrawer({
  group,
  deadlineDraft,
  onDeadlineDraft,
  onSaveDeadline,
  onCloseGroup,
  onClose,
  onPropose,
  busyKey,
}: {
  group: ShareInterestGroup;
  deadlineDraft: string;
  onDeadlineDraft: (value: string) => void;
  onSaveDeadline: () => void;
  onCloseGroup: () => void;
  onClose: () => void;
  onPropose: () => void;
  busyKey: string;
}) {
  const required = group.minPassengerThreshold || 5;
  const enough = (group.interestedSeatCount || 0) >= required || group.status === "READY_FOR_REVIEW";
  const [notesOpen, setNotesOpen] = useState(false);
  return (
    <Drawer title="Review interest" onClose={onClose} wide>
      <section className="share-ops-section">
        <h4>Summary</h4>
        <p>{group.origin} → {group.destinationRegion}</p>
        <p>{formatUkDate(group.travelDate)} · Around {group.timeWindowStart}</p>
        <p>{group.interestedSeatCount || 0} / {required} interested</p>
        <LiveCountdown deadlineAt={group.interestDeadlineAt} prefix="Registration closes in" />
      </section>
      <section className="share-ops-section">
        <h4>Passengers</h4>
        <ul className="share-ops-plain">
          {(group.entries || []).map((row) => (
            <li key={row.id}>
              <strong>{row.name}</strong> · {row.passengers} seat{row.passengers === 1 ? "" : "s"}
              <div className="share-ops-muted">{row.email}</div>
              {row.flightNumber || row.departureTerminal ? <div>Flight {row.flightNumber || "not entered"} · terminal {row.departureTerminal || "not entered"}{row.flightDepartureTime ? ` · ${row.flightDepartureTime}` : ""}</div> : null}
              {row.intendedDestinationText ? <div>Intended destination {row.intendedDestinationText}</div> : null}
            </li>
          ))}
        </ul>
      </section>
      <section className="share-ops-section">
        <h4>Deadline</h4>
        <div className="share-ops-inline">
          <input className="form-input" type="datetime-local" value={deadlineDraft || isoToLocalInput(group.interestDeadlineAt)} onChange={(e) => onDeadlineDraft(e.target.value)} />
          <button type="button" className="btn btn-sm" disabled={busyKey === `deadline-${group.id}`} onClick={onSaveDeadline}>Change interest deadline</button>
        </div>
      </section>
      <section className="share-ops-section">
        <button type="button" className="btn btn-sm" onClick={() => setNotesOpen(!notesOpen)}>{notesOpen ? "Hide notes" : "Notes"}</button>
        {notesOpen ? <p className="share-ops-muted">Private destinations and flight terminals stay on this admin view only.</p> : null}
      </section>
      <section className="share-ops-section share-ops-actions">
        {enough ? <button type="button" className="btn btn-primary" onClick={onPropose}>Review and propose</button> : null}
        <button type="button" className="btn btn-danger btn-sm" disabled={busyKey === `close-${group.id}` || group.status === "CONVERTED_TO_JOURNEY"} onClick={onCloseGroup}>Close interest group</button>
      </section>
    </Drawer>
  );
}
