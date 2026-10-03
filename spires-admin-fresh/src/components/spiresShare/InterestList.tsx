import React from "react";
import { LiveCountdown, OccupancyDots } from "./LiveCountdown";
import { formatUkDate, humanInterestStatus } from "./shareLabels";
import { ShareInterestGroup } from "./types";

export function InterestList({
  groups,
  onReview,
}: {
  groups: ShareInterestGroup[];
  onReview: (id: string, propose?: boolean) => void;
}) {
  const live = groups.filter((row) => !["CONVERTED_TO_JOURNEY", "CANCELLED"].includes(row.status));
  if (live.length === 0) {
    return <div className="share-ops-empty">No active Share interest groups.</div>;
  }
  return (
    <ul className="share-ops-card-list">
      {live.map((group) => {
        const required = group.minPassengerThreshold || 5;
        const interested = group.interestedSeatCount || 0;
        const remaining = Math.max(0, required - interested);
        const enough = interested >= required || group.status === "READY_FOR_REVIEW";
        return (
          <li key={group.id} className="share-ops-card">
            <div>
              {group.journeyType === "EVENT" ? <p className="share-ops-chip">EVENT</p> : null}
              <p className="share-ops-kicker">{group.origin} → {group.venueName || group.destinationRegion}</p>
              {group.eventName ? <p>{group.eventName}</p> : null}
              <p>{formatUkDate(group.eventDate || group.travelDate)}</p>
              <p className="share-ops-muted">Around {group.timeWindowStart}{group.timeWindowEnd ? ` to ${group.timeWindowEnd}` : ""}</p>
              <OccupancyDots filled={interested} total={required} />
              <p>{interested} / {required} interested</p>
              <p>{enough ? "Ready to propose" : `${remaining} more passenger${remaining === 1 ? "" : "s"} needed`}</p>
              <LiveCountdown deadlineAt={group.interestDeadlineAt} prefix="Registration closes in" />
              <p className="share-ops-chip">{humanInterestStatus(group.status, enough)}</p>
            </div>
            <button type="button" className="btn btn-primary btn-sm" onClick={() => onReview(group.id, enough)}>
              {enough ? "Review and propose" : "Review"}
            </button>
          </li>
        );
      })}
    </ul>
  );
}
