import React, { useState } from "react";
import { OccupancyDots } from "./LiveCountdown";
import { boardingLabel, routeLabel } from "./shareLabels";
import { ShareBooking, ShareJourney } from "./types";

export function DriverBoard({
  journey,
  bookings,
  busyKey,
  onVerify,
  onNoShow,
  onDepart,
}: {
  journey: ShareJourney;
  bookings: ShareBooking[];
  busyKey: string;
  onVerify: (bookingId: string, code: string) => Promise<void>;
  onNoShow: (bookingId: string) => void;
  onDepart: () => void;
}) {
  const active = bookings.filter((row) => !["CANCELLED", "LATE_CANCELLED"].includes(row.reservationStatus || ""));
  const verifiedSeats = active.filter((row) => boardingLabel(row) === "Verified").reduce((sum, row) => sum + row.passengers, 0);
  const totalSeats = active.reduce((sum, row) => sum + row.passengers, 0);
  const remaining = Math.max(0, totalSeats - verifiedSeats);
  const [codes, setCodes] = useState<Record<string, string>>({});
  const [openId, setOpenId] = useState("");
  const [error, setError] = useState("");

  return (
    <div className="share-ops-driver">
      <p className="share-ops-kicker">{journey.publicNumber}</p>
      <h3>{routeLabel(journey)}</h3>
      <p>{journey.departureTime}</p>
      <p>{totalSeats} passengers</p>
      <h4>Boarding</h4>
      <p>{verifiedSeats} / {totalSeats} seats verified</p>
      <OccupancyDots filled={verifiedSeats} total={totalSeats} />
      <p>{remaining === 0 ? "All passengers verified" : `${remaining} passenger${remaining === 1 ? "" : "s"} remaining`}</p>
      {error ? <p className="share-ops-error">{error}</p> : null}
      <ul className="share-ops-driver-list">
        {active.map((row) => {
          const done = boardingLabel(row) === "Verified";
          const missing = boardingLabel(row) === "No show";
          return (
            <li key={row.id} className={`share-ops-driver-row${done ? " is-done" : ""}`}>
              <div>
                <strong>{row.name}</strong>
                <p>{row.passengers} passenger{row.passengers === 1 ? "" : "s"}</p>
                <p>Code: {done ? "verified" : "••••"}</p>
                {done && row.boardingVerifiedAt ? <p>Boarded {new Date(row.boardingVerifiedAt).toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit" })}</p> : null}
                {missing ? <p>No show</p> : null}
              </div>
              {!done && !missing ? (
                openId === row.id ? (
                  <form
                    onSubmit={async (e) => {
                      e.preventDefault();
                      setError("");
                      try {
                        await onVerify(row.id, codes[row.id] || "");
                        setOpenId("");
                      } catch (err) {
                        setError(err instanceof Error ? err.message : "Code does not match.");
                      }
                    }}
                  >
                    <p>Ask {row.name.split(" ")[0]} for their 4 digit boarding code.</p>
                    <input className="share-ops-code" inputMode="numeric" maxLength={4} value={codes[row.id] || ""} onChange={(e) => setCodes({ ...codes, [row.id]: e.target.value.replace(/\D/g, "").slice(0, 4) })} />
                    <button type="submit" className="btn btn-primary" disabled={busyKey === `verify-${row.id}`}>Verify passenger</button>
                  </form>
                ) : (
                  <div className="share-ops-driver-actions">
                    <button type="button" className="btn btn-primary" onClick={() => setOpenId(row.id)}>Verify</button>
                    <button
                      type="button"
                      className="btn btn-danger"
                      disabled={busyKey === `noshow-${row.id}`}
                      onClick={() => {
                        if (window.confirm(`Mark ${row.name} as a no show?`)) onNoShow(row.id);
                      }}
                    >
                      Mark no show
                    </button>
                  </div>
                )
              ) : null}
            </li>
          );
        })}
      </ul>
      <button
        type="button"
        className="btn btn-primary share-ops-start"
        disabled={busyKey === `depart-${journey.id}`}
        onClick={() => {
          if (remaining > 0 && !window.confirm(`${remaining} passenger${remaining === 1 ? " has" : "s have"} not been verified.`)) return;
          onDepart();
        }}
      >
        Start journey
      </button>
    </div>
  );
}
