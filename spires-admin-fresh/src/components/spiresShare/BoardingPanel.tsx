import React from "react";
import { OccupancyDots } from "./LiveCountdown";
import { boardingLabel } from "./shareLabels";
import { ShareBooking, ShareDriver, ShareJourney } from "./types";

export function BoardingPanel({
  journey,
  bookings,
  drivers,
  onAssign,
  onOpenBoarding,
  onResend,
  busyKey,
}: {
  journey: ShareJourney;
  bookings: ShareBooking[];
  drivers: ShareDriver[];
  onAssign: (driverId: string) => void;
  onOpenBoarding: () => void;
  onResend: () => void;
  busyKey: string;
}) {
  if (journey.status !== "CONFIRMED") return null;
  const active = bookings.filter((row) => !["CANCELLED", "LATE_CANCELLED"].includes(row.reservationStatus || ""));
  const verifiedSeats = active.filter((row) => boardingLabel(row) === "Verified").reduce((sum, row) => sum + row.passengers, 0);
  const totalSeats = active.reduce((sum, row) => sum + row.passengers, 0);
  return (
    <section className="share-ops-section">
      <h4>Driver</h4>
      <p>Assigned: {journey.assignedDriverName || "Not assigned"}</p>
      {journey.assignedDriverEmail ? <p className="share-ops-muted">{journey.assignedDriverEmail}</p> : <p className="share-ops-muted">No driver email on file. Assign a driver from the existing driver list.</p>}
      <p>Manifest: {journey.driverManifestSentAt ? new Date(journey.driverManifestSentAt).toLocaleString("en-GB") : "Not sent"}</p>
      <p>Boarding: {verifiedSeats} / {totalSeats}</p>
      <OccupancyDots filled={verifiedSeats} total={totalSeats} />
      <ul className="share-ops-plain">
        {active.map((row) => (
          <li key={row.id}>{row.name} · {boardingLabel(row) === "Verified" ? "Verified" : boardingLabel(row)}</li>
        ))}
      </ul>
      {!journey.assignedDriverId ? (
        <div className="share-ops-inline">
          <select className="form-select" defaultValue="" onChange={(e) => { if (e.target.value) onAssign(e.target.value); }}>
            <option value="">Assign driver</option>
            {drivers.filter((row) => row.active).map((row) => (
              <option key={row.id} value={row.id}>{row.name}{row.email ? "" : " (no email)"}</option>
            ))}
          </select>
        </div>
      ) : null}
      <div className="share-ops-inline">
        <button type="button" className="btn btn-primary btn-sm" onClick={onOpenBoarding}>Open boarding view</button>
        <button type="button" className="btn btn-sm" disabled={busyKey === `manifest-${journey.id}` || !journey.assignedDriverEmail} onClick={onResend}>Resend manifest</button>
      </div>
    </section>
  );
}
