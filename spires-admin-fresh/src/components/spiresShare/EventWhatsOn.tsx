import React, { useEffect, useState } from "react";
import { gbp } from "./shareLabels";
import { RunAction, ShareState } from "./types";

type AdminFn = (data: Record<string, unknown>) => Promise<unknown>;

export type WhatsOnEvent = {
  sourceId: string;
  eventName: string;
  venueId: string;
  venueName: string;
  eventDate: string;
  eventStartTime: string;
  eventUrl?: string;
  eventCategory?: string;
  locationNote?: string;
  suggestedDepartureTime: string;
  outboundFarePence?: number;
  returnFarePence?: number;
  untilDate?: string;
  alreadyCreated: boolean;
  existingPublished?: boolean;
  interestedSeatCount?: number;
  whyInteresting: string;
};

export function EventWhatsOn({
  venues,
  run,
  busyKey,
  adminAction,
  onUseEvent,
}: {
  venues: NonNullable<ShareState["config"]["shareVenues"]>;
  run: RunAction;
  busyKey: string;
  adminAction: AdminFn;
  onUseEvent: (event: WhatsOnEvent) => void;
}) {
  const [venueId, setVenueId] = useState("");
  const [copyNote, setCopyNote] = useState("");
  const [payload, setPayload] = useState<{
    events: WhatsOnEvent[];
    calendars: Array<{ venueId: string; venueName: string; url: string; label: string }>;
    sources: string[];
    sourceErrors: string[];
    copyText: string;
  } | null>(null);

  const load = () =>
    run("event-whats-on", async () => {
      const result = (await adminAction({ action: "list-event-whats-on" })) as typeof payload;
      setPayload(result);
      setCopyNote("");
    });

  useEffect(() => {
    void load();
    // Load once when Event opportunities opens.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const events = (payload?.events || []).filter((row) => !venueId || row.venueId === venueId);

  return (
    <div className="share-ops-section">
      <h4>Events of interest</h4>
      <p className="share-ops-muted">Upcoming listings from official venue pages. Review them here, then create a Share opportunity if you want customers to register. Nothing is published automatically.</p>
      <div className="share-ops-filters">
        <button type="button" className={`btn btn-sm${!venueId ? " btn-primary" : ""}`} onClick={() => setVenueId("")}>All venues</button>
        {venues.map((row) => (
          <button key={row.id} type="button" className={`btn btn-sm${venueId === row.id ? " btn-primary" : ""}`} onClick={() => setVenueId(row.id)}>{row.name}</button>
        ))}
        <button type="button" className="btn btn-sm" disabled={busyKey === "event-whats-on"} onClick={() => void load()}>Refresh listings</button>
        <button
          type="button"
          className="btn btn-sm"
          disabled={!payload?.copyText}
          onClick={async () => {
            if (!payload?.copyText) return;
            if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(payload.copyText);
            setCopyNote("Copied a summary you can paste into notes or a message.");
          }}
        >
          Copy summary
        </button>
      </div>
      {copyNote ? <p className="share-ops-ok">{copyNote}</p> : null}
      {payload?.sourceErrors?.length ? <p className="share-ops-error">{payload.sourceErrors.join(" ")}</p> : null}
      {busyKey === "event-whats-on" && !payload ? <p className="share-ops-muted">Checking upcoming events…</p> : null}
      {payload && events.length === 0 ? <div className="share-ops-empty">No upcoming listings match this filter. Use the official venue pages below or create an event yourself.</div> : null}
      {events.length ? (
        <ul className="share-ops-card-list">
          {events.map((row) => (
            <li key={row.sourceId} className="share-ops-card">
              <div>
                <p className="share-ops-chip">{row.venueName}</p>
                <p>{row.eventName}</p>
                <p className="share-ops-muted">{row.eventDate} · {row.eventStartTime}{row.untilDate ? ` until ${row.untilDate}` : ""}{row.locationNote ? ` · ${row.locationNote}` : ""}</p>
                <p>Suggested departure {row.suggestedDepartureTime} from Thornhill Park and Ride</p>
                {row.outboundFarePence ? <p>{gbp(row.outboundFarePence)} one way{row.returnFarePence ? ` · ${gbp(row.returnFarePence)} return` : ""}</p> : null}
                <p className="share-ops-muted">{row.whyInteresting}</p>
                {row.eventUrl ? <p><a href={row.eventUrl} target="_blank" rel="noreferrer">Official listing</a></p> : null}
              </div>
              <div className="share-ops-inline">
                {row.alreadyCreated ? (
                  <p className="share-ops-ok">{row.existingPublished ? "Published" : "Draft already created"}{row.interestedSeatCount ? ` · ${row.interestedSeatCount} interested` : ""}</p>
                ) : (
                  <button type="button" className="btn btn-primary btn-sm" onClick={() => onUseEvent(row)}>Use this event</button>
                )}
              </div>
            </li>
          ))}
        </ul>
      ) : null}
      <p className="share-ops-muted">Official calendars: {(payload?.calendars || []).map((row, index) => (
        <span key={row.venueId}>{index ? " · " : ""}<a href={row.url} target="_blank" rel="noreferrer">{row.label}</a></span>
      ))}</p>
    </div>
  );
}
