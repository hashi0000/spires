import React from "react";
import { LiveCountdown } from "./LiveCountdown";
import { formatUkDateShort, humanJourneyStage, paidVerifiedSeats, routeLabel } from "./shareLabels";
import { ShareBooking, ShareJourney } from "./types";

export function JourneyList({
  journeys,
  bookings,
  filter,
  onFilter,
  onOpen,
}: {
  journeys: ShareJourney[];
  bookings: ShareBooking[];
  filter: string;
  onFilter: (value: string) => void;
  onOpen: (id: string) => void;
}) {
  const filtered = journeys.filter((row) => {
    const stage = humanJourneyStage(row, bookings.filter((booking) => booking.journeyId === row.id));
    if (filter === "payment") return ["Add payment link", "Ready to open payment", "Collecting payment", "Ready to confirm"].includes(stage);
    if (filter === "confirmed") return stage === "Confirmed";
    if (filter === "completed") return stage === "Completed" || stage === "Did not fill";
    if (filter === "cancelled") return stage === "Cancelled";
    return true;
  });

  return (
    <div className="share-ops-stack">
      <div className="share-ops-filters">
        {[
          ["all", "All"],
          ["payment", "Needs payment"],
          ["confirmed", "Confirmed"],
          ["completed", "Completed"],
          ["cancelled", "Cancelled"],
        ].map(([id, label]) => (
          <button key={id} type="button" className={`btn btn-sm${filter === id ? " btn-primary" : ""}`} onClick={() => onFilter(id)}>{label}</button>
        ))}
      </div>
      {filtered.length === 0 ? (
        <div className="share-ops-empty">No journeys match this filter.</div>
      ) : (
        <ul className="share-ops-card-list">
          {filtered.map((row) => {
            const journeyBookings = bookings.filter((booking) => booking.journeyId === row.id);
            const stage = humanJourneyStage(row, journeyBookings);
            const { verified } = paidVerifiedSeats(journeyBookings);
            const paymentRelevant = ["Collecting payment", "Ready to confirm", "Confirmed", "Ready to open payment"].includes(stage);
            return (
              <li key={row.id} className="share-ops-card share-ops-card--row">
                <div>
                  <p className="share-ops-kicker">{row.publicNumber}</p>
                  <p>{routeLabel(row)}</p>
                  <p className="share-ops-muted">{formatUkDateShort(row.travelDate)} · {row.departureTime}</p>
                  <p className="share-ops-chip">{stage}</p>
                  <p>Seats: {row.occupiedSeats} / {row.capacity}</p>
                  {paymentRelevant ? <p>Payments: {verified} / {row.capacity} verified</p> : null}
                  {row.paymentDeadlineAt && stage === "Collecting payment" ? <LiveCountdown deadlineAt={row.paymentDeadlineAt} /> : null}
                  <p className="share-ops-muted">{row.customerVisible ? "Visible" : "Hidden"}</p>
                </div>
                <button type="button" className="btn btn-primary btn-sm" onClick={() => onOpen(row.id)}>Open</button>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
