import React, { useMemo, useState } from "react";
import { ShareState } from "./types";

export function AuditAndEmails({ audit, notifications }: { audit: ShareState["audit"]; notifications: ShareState["notifications"] }) {
  const [q, setQ] = useState("");
  const auditRows = useMemo(
    () => audit.filter((row) => `${row.type || ""} ${row.actorEmail || ""} ${row.journeyId || ""}`.toLowerCase().includes(q.toLowerCase())),
    [audit, q]
  );
  const mailRows = useMemo(
    () => notifications.filter((row) => `${row.type || ""} ${row.to || row.recipient || ""} ${row.subject || ""}`.toLowerCase().includes(q.toLowerCase())),
    [notifications, q]
  );
  return (
    <div className="share-ops-stack">
      <input className="form-input" placeholder="Filter audit and emails" value={q} onChange={(e) => setQ(e.target.value)} />
      <h4>Audit</h4>
      {auditRows.length === 0 ? <p>No audit rows match.</p> : (
        <ul className="share-ops-plain">
          {auditRows.slice(0, 40).map((row) => (
            <li key={row.id}>
              {row.at ? new Date(String(row.at)).toLocaleString("en-GB") : "—"} · {(row.type || "").replace(/_/g, " ")} · {row.journeyId || "—"} · {row.actorEmail || "system"}
            </li>
          ))}
        </ul>
      )}
      <h4>Emails</h4>
      {mailRows.length === 0 ? <p>No email rows match.</p> : (
        <ul className="share-ops-plain">
          {mailRows.slice(0, 40).map((row) => (
            <li key={row.id}>
              {row.createdAt ? new Date(row.createdAt).toLocaleString("en-GB") : "—"} · {(row.type || "").replace(/_/g, " ")} · {row.to || row.recipient} · {row.journeyId || "—"} · {row.dryRun ? "DRY RUN" : (row.status || "").replace(/_/g, " ")}
              {row.subject ? <div className="share-ops-muted">{row.subject}</div> : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
