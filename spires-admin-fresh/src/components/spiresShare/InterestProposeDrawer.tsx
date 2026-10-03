import React, { FormEvent, useState } from "react";
import { Drawer } from "./Drawer";
import { gbp, penceFromPounds, poundsFromPence } from "./shareLabels";
import { ShareInterestGroup, ShareState } from "./types";

export function InterestProposeDrawer({
  group,
  hubs,
  defaults,
  busy,
  onClose,
  onPropose,
}: {
  group: ShareInterestGroup;
  hubs: NonNullable<ShareState["hubs"]>;
  defaults: { departureLocation: string; destinationLabel: string; farePence: number };
  busy: boolean;
  onClose: () => void;
  onPropose: (payload: { departureLocation: string; departureTime: string; farePence: number; capacity: number; hubId: string; notes: string }) => Promise<void>;
}) {
  const heathrow = /heathrow/i.test(group.destinationRegion);
  const [departureLocation, setDepartureLocation] = useState(defaults.departureLocation || "Thornhill Park and Ride");
  const [departureTime, setDepartureTime] = useState(group.timeWindowStart || "10:00");
  const [fare, setFare] = useState(heathrow ? poundsFromPence(defaults.farePence || 3500) : "");
  const [capacity, setCapacity] = useState(group.minPassengerThreshold || 5);
  const [hubId, setHubId] = useState("");
  const [notes, setNotes] = useState("");
  const farePence = penceFromPounds(fare);

  const submit = (e: FormEvent) => {
    e.preventDefault();
    if (!farePence) return;
    onPropose({ departureLocation, departureTime, farePence, capacity, hubId, notes });
  };

  return (
    <Drawer title="Propose journey" onClose={onClose}>
      <form onSubmit={submit} className="share-ops-form">
        <label className="form-group"><span className="form-label">Pickup</span><input className="form-input" required value={departureLocation} onChange={(e) => setDepartureLocation(e.target.value)} /></label>
        <label className="form-group"><span className="form-label">Drop off</span><input className="form-input" readOnly value={heathrow ? "Heathrow Terminal 3" : group.destinationRegion} /></label>
        <label className="form-group"><span className="form-label">Date</span><input className="form-input" readOnly value={group.travelDate} /></label>
        <label className="form-group"><span className="form-label">Departure time</span><input className="form-input" type="time" required value={departureTime} onChange={(e) => setDepartureTime(e.target.value)} /></label>
        <label className="form-group"><span className="form-label">Capacity</span><input className="form-input" type="number" min={1} max={5} value={capacity} onChange={(e) => setCapacity(Number(e.target.value) || 5)} /></label>
        <label className="form-group"><span className="form-label">Fare per passenger</span><input className="form-input" inputMode="decimal" required value={fare} onChange={(e) => setFare(e.target.value)} placeholder="35.00" /></label>
        {!heathrow ? (
          <label className="form-group">
            <span className="form-label">Shared drop off hub (optional)</span>
            <select className="form-select" value={hubId} onChange={(e) => setHubId(e.target.value)}>
              <option value="">None yet</option>
              {hubs.filter((hub) => hub.enabled).map((hub) => (
                <option key={hub.id} value={hub.id}>{hub.displayName || hub.name}</option>
              ))}
            </select>
          </label>
        ) : null}
        <label className="form-group"><span className="form-label">Notes</span><input className="form-input" value={notes} onChange={(e) => setNotes(e.target.value)} /></label>
        <p>Fare: {farePence ? gbp(farePence) : "set a fare first"}</p>
        <p className="share-ops-note">Passengers will be asked to accept this exact journey before payment opens.</p>
        <button type="submit" className="btn btn-primary" disabled={busy || !farePence}>Propose journey</button>
      </form>
    </Drawer>
  );
}
