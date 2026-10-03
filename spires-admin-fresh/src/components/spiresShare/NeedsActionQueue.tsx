import React from "react";
import { LiveCountdown } from "./LiveCountdown";
import { NeedsActionItem } from "./shareLabels";

export function NeedsActionQueue({
  items,
  summary,
  onOpenInterest,
  onOpenJourney,
}: {
  items: NeedsActionItem[];
  summary: { needs: number; interest: number; active: number; confirmed: number };
  onOpenInterest: (id: string, propose?: boolean) => void;
  onOpenJourney: (id: string) => void;
}) {
  return (
    <div className="share-ops-stack">
      <div className="share-ops-summary">
        <article><strong>{summary.needs}</strong><span>Needs action</span></article>
        <article><strong>{summary.interest}</strong><span>Interest groups</span></article>
        <article><strong>{summary.active}</strong><span>Active journeys</span></article>
        <article><strong>{summary.confirmed}</strong><span>Confirmed</span></article>
      </div>
      {items.length === 0 ? (
        <div className="share-ops-empty">Nothing needs your attention right now.</div>
      ) : (
        <ul className="share-ops-card-list">
          {items.map((item) => (
            <li key={item.id} className={`share-ops-card${item.urgency ? ` is-${item.urgency}` : ""}`}>
              <div>
                <p className="share-ops-kicker">{item.title}</p>
                <p>{item.route}</p>
                <p className="share-ops-muted">{item.when}</p>
                <p>{item.detail}</p>
                {item.extra ? <p className="share-ops-emphasis">{item.extra}</p> : null}
                {item.countdownAt ? <LiveCountdown deadlineAt={item.countdownAt} prefix={item.countdownLabel || "Closes in"} /> : null}
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => item.target.type === "interest" ? onOpenInterest(item.target.id, item.kind === "ready_to_propose") : onOpenJourney(item.target.id)}
              >
                {item.primaryLabel}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
