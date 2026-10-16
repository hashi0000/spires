import React, { FormEvent, useMemo, useState } from "react";
import { EventWhatsOn, WhatsOnEvent } from "./EventWhatsOn";
import { gbp, penceFromPounds, poundsFromPence } from "./shareLabels";
import { RunAction, ShareState } from "./types";

type AdminFn = (data: Record<string, unknown>) => Promise<unknown>;

const EMPTY = {
  eventName: "",
  venueId: "",
  venueName: "Wembley Stadium",
  eventDate: "",
  eventStartTime: "19:45",
  expectedFinishTime: "",
  pickupLocation: "Thornhill Park and Ride",
  destination: "Wembley Stadium",
  suggestedDepartureTime: "16:30",
  outboundPounds: "40",
  returnPounds: "75",
  passengerLimit: 5,
  interestDeadlineAt: "",
  offerReturn: true,
  returnDepartureBasis: "AFTER_EVENT",
  returnAfterMinutes: 45,
  returnDepartureTime: "",
  venueReturnMeetingPoint: "",
  eventUrl: "",
};

export function EventTools({
  state,
  run,
  busyKey,
  adminAction,
}: {
  state: ShareState;
  run: RunAction;
  busyKey: string;
  adminAction: AdminFn;
}) {
  const venues = state.config.shareVenues || [];
  const areas = state.config.londonShareAreas || [];
  const [form, setForm] = useState(EMPTY);
  const [advert, setAdvert] = useState("");
  const events = (state.interestGroups || []).filter((row) => row.journeyType === "EVENT");

  const applyVenue = (venueId: string, extras: Partial<typeof EMPTY> = {}) => {
    const venue = venues.find((row) => row.id === venueId);
    if (!venue) {
      setForm({ ...form, venueId, ...extras });
      return;
    }
    setForm({
      ...form,
      venueId,
      venueName: venue.name,
      destination: venue.name,
      pickupLocation: venue.defaultPickup || form.pickupLocation,
      outboundPounds: poundsFromPence(venue.defaultFarePence || 4000),
      returnPounds: poundsFromPence(venue.defaultReturnFarePence || 7500),
      passengerLimit: venue.defaultPassengerCap || 5,
      venueReturnMeetingPoint: venue.returnMeetingPoint || "",
      ...extras,
    });
  };

  const useListedEvent = (event: WhatsOnEvent) => {
    applyVenue(event.venueId, {
      eventName: event.eventName,
      venueName: event.venueName,
      destination: event.venueName,
      eventDate: event.eventDate,
      eventStartTime: event.eventStartTime,
      suggestedDepartureTime: event.suggestedDepartureTime,
      eventUrl: event.eventUrl || "",
      offerReturn: true,
      ...(event.outboundFarePence ? { outboundPounds: poundsFromPence(event.outboundFarePence) } : {}),
      ...(event.returnFarePence ? { returnPounds: poundsFromPence(event.returnFarePence) } : {}),
    });
  };

  const outboundFarePence = penceFromPounds(form.outboundPounds);
  const returnFarePence = penceFromPounds(form.returnPounds);
  const seats = form.passengerLimit || 5;
  const outboundRevenue = outboundFarePence * seats;
  const returnPackage = form.offerReturn ? returnFarePence * seats : 0;

  const payload = useMemo(
    () => ({
      action: "create-event-interest",
      eventName: form.eventName,
      venueId: form.venueId,
      venueName: form.venueName,
      eventDate: form.eventDate,
      eventStartTime: form.eventStartTime,
      expectedFinishTime: form.expectedFinishTime,
      pickupLocation: form.pickupLocation,
      destination: form.destination || form.venueName,
      suggestedDepartureTime: form.suggestedDepartureTime,
      outboundFarePence,
      returnFarePence: form.offerReturn ? returnFarePence : 0,
      passengerLimit: seats,
      interestDeadlineAt: form.interestDeadlineAt ? new Date(form.interestDeadlineAt).toISOString() : "",
      offerReturn: form.offerReturn,
      returnDepartureBasis: form.returnDepartureBasis,
      returnAfterMinutes: form.returnAfterMinutes,
      returnDepartureTime: form.returnDepartureTime,
      venueReturnMeetingPoint: form.venueReturnMeetingPoint,
      eventUrl: form.eventUrl,
      origin: "Oxford",
    }),
    [form, outboundFarePence, returnFarePence, seats]
  );

  return (
    <div className="share-ops-stack">
      <EventWhatsOn venues={venues} run={run} busyKey={busyKey} adminAction={adminAction} onUseEvent={useListedEvent} />
      <form
        className="share-ops-form"
        onSubmit={(e: FormEvent) => {
          e.preventDefault();
          run("event-create", async () => {
            await adminAction(payload);
          });
        }}
      >
        <h4>Create event interest journey</h4>
        <p className="share-ops-muted">Creates an unpublished event opportunity. Publish it when you want it on the Share page. Maximum 5 passengers.</p>
        <label className="form-group">
          <span className="form-label">Venue defaults</span>
          <select className="form-select" value={form.venueId} onChange={(e) => applyVenue(e.target.value)}>
            <option value="">Choose a venue</option>
            {venues.map((row) => (
              <option key={row.id} value={row.id}>{row.name}</option>
            ))}
          </select>
        </label>
        <label className="form-group"><span className="form-label">Event name</span><input className="form-input" required value={form.eventName} onChange={(e) => setForm({ ...form, eventName: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Venue</span><input className="form-input" required value={form.venueName} onChange={(e) => setForm({ ...form, venueName: e.target.value, destination: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Event date</span><input className="form-input" type="date" required value={form.eventDate} onChange={(e) => setForm({ ...form, eventDate: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Event start time</span><input className="form-input" type="time" required value={form.eventStartTime} onChange={(e) => setForm({ ...form, eventStartTime: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Expected finish time optional</span><input className="form-input" type="time" value={form.expectedFinishTime} onChange={(e) => setForm({ ...form, expectedFinishTime: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Pickup location</span><input className="form-input" required value={form.pickupLocation} onChange={(e) => setForm({ ...form, pickupLocation: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Suggested departure</span><input className="form-input" type="time" required value={form.suggestedDepartureTime} onChange={(e) => setForm({ ...form, suggestedDepartureTime: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Fare per passenger in pounds</span><input className="form-input" required value={form.outboundPounds} onChange={(e) => setForm({ ...form, outboundPounds: e.target.value })} /></label>
        <label className="form-group"><span className="form-label">Maximum passengers</span><input className="form-input" type="number" min={1} max={5} value={form.passengerLimit} onChange={(e) => setForm({ ...form, passengerLimit: Math.min(5, Number(e.target.value) || 5) })} /></label>
        <label className="form-group"><span className="form-label">Interest deadline</span><input className="form-input" type="datetime-local" value={form.interestDeadlineAt} onChange={(e) => setForm({ ...form, interestDeadlineAt: e.target.value })} /></label>
        <label className="form-group">
          <span className="form-label">Offer return journey</span>
          <select className="form-select" value={form.offerReturn ? "yes" : "no"} onChange={(e) => setForm({ ...form, offerReturn: e.target.value === "yes" })}>
            <option value="yes">Yes</option>
            <option value="no">No</option>
          </select>
        </label>
        {form.offerReturn ? (
          <>
            <label className="form-group">
              <span className="form-label">Return departure basis</span>
              <select className="form-select" value={form.returnDepartureBasis} onChange={(e) => setForm({ ...form, returnDepartureBasis: e.target.value })}>
                <option value="AFTER_EVENT">After event finishes</option>
                <option value="SPECIFIC_TIME">Specific time</option>
              </select>
            </label>
            {form.returnDepartureBasis === "SPECIFIC_TIME" ? (
              <label className="form-group"><span className="form-label">Return departure time</span><input className="form-input" type="time" value={form.returnDepartureTime} onChange={(e) => setForm({ ...form, returnDepartureTime: e.target.value })} /></label>
            ) : (
              <label className="form-group">
                <span className="form-label">Minutes after event finishes</span>
                <select className="form-select" value={String(form.returnAfterMinutes)} onChange={(e) => setForm({ ...form, returnAfterMinutes: Number(e.target.value) })}>
                  <option value="30">30</option>
                  <option value="45">45</option>
                  <option value="60">60</option>
                </select>
              </label>
            )}
            <label className="form-group"><span className="form-label">Return fare in pounds</span><input className="form-input" value={form.returnPounds} onChange={(e) => setForm({ ...form, returnPounds: e.target.value })} /></label>
            <label className="form-group"><span className="form-label">Return meeting point</span><input className="form-input" value={form.venueReturnMeetingPoint} onChange={(e) => setForm({ ...form, venueReturnMeetingPoint: e.target.value })} /></label>
          </>
        ) : null}
        <section className="share-ops-section">
          <h4>Revenue preview</h4>
          <p>Fare: {gbp(outboundFarePence)}</p>
          <p>Passengers required: {seats}</p>
          <p>Full journey revenue: {gbp(outboundRevenue)}</p>
          {form.offerReturn ? (
            <>
              <p>Outbound: {gbp(outboundFarePence)} × {seats} = {gbp(outboundRevenue)}</p>
              <p>Return package: {gbp(returnFarePence)} × {seats} = {gbp(returnPackage)}</p>
              <p className="share-ops-muted">Return package revenue is the return fare times required seats. Do not add the outbound fare on top of the package. This is not profit.</p>
            </>
          ) : (
            <p className="share-ops-muted">Full journey revenue if every required seat is taken. This is not profit.</p>
          )}
        </section>
        <button type="submit" className="btn btn-primary" disabled={busyKey === "event-create"}>Create share interest journey</button>
      </form>

      <div>
        <h4>Event opportunities</h4>
        <p className="share-ops-muted">Publish only the events you want customers to see. Do not auto publish every London event.</p>
        {areas.length ? <p className="share-ops-muted">London areas are internal pricing defaults: {areas.map((row) => row.name).join(", ")}.</p> : null}
        {events.length === 0 ? <div className="share-ops-empty">No event opportunities yet.</div> : (
          <ul className="share-ops-card-list">
            {events.map((row) => (
              <li key={row.id} className="share-ops-card">
                <div>
                  <p className="share-ops-chip">EVENT</p>
                  <p>{row.eventName || row.publicNumber}</p>
                  <p>{row.venueName || row.destinationRegion}</p>
                  <p className="share-ops-muted">{row.eventDate || row.travelDate} · {row.eventStartTime || row.timeWindowStart}</p>
                  <p>{row.interestedSeatCount || 0} / {row.minPassengerThreshold || 5} interested</p>
                  <p>{row.eventPublished ? "Published" : "Draft"}</p>
                  {row.outboundFarePence ? <p>{gbp(row.outboundFarePence)} per passenger</p> : null}
                </div>
                <div className="share-ops-inline">
                  {row.eventPublished ? (
                    <button type="button" className="btn btn-sm" disabled={busyKey === `unpub-${row.id}`} onClick={() => run(`unpub-${row.id}`, async () => { await adminAction({ action: "unpublish-event-interest", interestGroupId: row.id }); })}>Unpublish</button>
                  ) : (
                    <button type="button" className="btn btn-primary btn-sm" disabled={busyKey === `pub-${row.id}`} onClick={() => run(`pub-${row.id}`, async () => { await adminAction({ action: "publish-event-interest", interestGroupId: row.id }); })}>Publish</button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    disabled={busyKey === `ad-${row.id}`}
                    onClick={() => run(`ad-${row.id}`, async () => {
                      const result = await adminAction({ action: "event-advert", interestGroupId: row.id }) as { text?: string };
                      const text = result?.text || "";
                      setAdvert(text);
                      if (text && navigator.clipboard?.writeText) await navigator.clipboard.writeText(text);
                    })}
                  >
                    Copy advert text
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
        {advert ? <pre className="share-ops-note">{advert}</pre> : null}
      </div>
    </div>
  );
}
