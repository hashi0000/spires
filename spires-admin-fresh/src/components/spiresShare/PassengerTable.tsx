import React, { useState } from "react";
import { boardingLabel, gbp, reservationLabel } from "./shareLabels";
import { ShareBooking, ShareJourney } from "./types";

export function PassengerTable({
  journey,
  bookings,
  busyKey,
  onMarkPaid,
  onUndo,
}: {
  journey: ShareJourney;
  bookings: ShareBooking[];
  busyKey: string;
  onMarkPaid: (id: string) => void;
  onUndo: (id: string) => void;
}) {
  const [openId, setOpenId] = useState("");
  const collecting = journey.paymentStageStatus === "OPEN" || journey.status === "PAYMENT_WINDOW_OPEN";
  return (
    <div className="share-ops-table-wrap">
      <table className="share-ops-table">
        <thead>
          <tr>
            <th>Passenger</th>
            <th>Seats</th>
            <th>Reservation</th>
            <th>Payment</th>
            <th>Verified</th>
            <th>Flight / terminal</th>
            <th>Boarding</th>
            <th></th>
          </tr>
        </thead>
        <tbody>
          {bookings.map((booking) => {
            const verified = booking.reservationStatus === "PAID";
            const paid = verified || booking.hostedPaymentStatus === "PAID";
            return (
              <React.Fragment key={booking.id}>
                <tr>
                  <td>{booking.name}</td>
                  <td>{booking.passengers}</td>
                  <td>{reservationLabel(booking.reservationStatus)}</td>
                  <td>{gbp(booking.paidAmountPence || 0)}</td>
                  <td>{verified ? "Verified" : paid ? "Received, not verified" : "No"}</td>
                  <td>{[booking.flightNumber, booking.departureTerminal].filter(Boolean).join(" · ") || "—"}</td>
                  <td>{boardingLabel(booking)}</td>
                  <td>
                    <div className="share-ops-inline">
                      {collecting && !verified ? (
                        <button type="button" className="btn btn-primary btn-sm" disabled={busyKey === `paid-${booking.id}`} onClick={() => onMarkPaid(booking.id)}>Mark paid</button>
                      ) : null}
                      <button type="button" className="btn btn-sm" onClick={() => setOpenId(openId === booking.id ? "" : booking.id)}>Details</button>
                    </div>
                  </td>
                </tr>
                {openId === booking.id ? (
                  <tr className="share-ops-detail-row">
                    <td colSpan={8}>
                      <p>{booking.email} · {booking.mobile}</p>
                      {booking.intendedDestinationText ? <p>Intended destination {booking.intendedDestinationText}{booking.intendedDestinationPostcode ? ` · ${booking.intendedDestinationPostcode}` : ""}</p> : null}
                      {journey.status === "CONFIRMED" && booking.boardingCode ? <p>Boarding code {booking.boardingCode}</p> : null}
                      {booking.refundStatus && booking.refundStatus !== "NONE" ? <p>Refund {booking.refundStatus} · refunded {gbp(booking.amountRefundedPence || 0)}</p> : null}
                      {booking.adminNotes ? <p>{booking.adminNotes}</p> : null}
                      {collecting && verified ? (
                        <button type="button" className="btn btn-sm" disabled={busyKey === `undo-${booking.id}`} onClick={() => onUndo(booking.id)}>Undo / correct payment</button>
                      ) : null}
                    </td>
                  </tr>
                ) : null}
              </React.Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
