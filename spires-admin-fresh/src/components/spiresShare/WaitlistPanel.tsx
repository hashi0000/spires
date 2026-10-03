import React from "react";
import { LiveCountdown } from "./LiveCountdown";
import { ShareWaitlist } from "./types";

export function WaitlistPanel({
  items,
  onOffer,
  busy,
}: {
  items: ShareWaitlist[];
  onOffer: () => void;
  busy: boolean;
}) {
  return (
    <section className="share-ops-section">
      <h4>Waitlist</h4>
      {items.length === 0 ? (
        <p>No passengers are currently waiting.</p>
      ) : (
        <>
          <p>{items.length} waiting</p>
          <ol className="share-ops-plain">
            {items.map((item, index) => (
              <li key={item.id}>
                {index + 1}. {item.name || "Passenger"} · {item.passengers} seat{item.passengers === 1 ? "" : "s"} · {item.status.replace(/_/g, " ").toLowerCase()}
                {item.offerExpiresAt ? <LiveCountdown deadlineAt={item.offerExpiresAt} prefix="Offer expires in" /> : null}
              </li>
            ))}
          </ol>
          <button type="button" className="btn btn-sm" disabled={busy} onClick={onOffer}>Offer next place</button>
        </>
      )}
    </section>
  );
}
