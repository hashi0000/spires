import React, { useEffect, useState } from "react";
import { httpsCallable } from "firebase/functions";
import { functions } from "../utils/firebase";
import { getCallableErrorMessage } from "../utils/callableErrorMessage";

type Summary = {
  periodLabel?: string;
  completedJourneys?: number;
  airports?: Record<string, number>;
  areas?: Record<string, number>;
  unclassified?: number;
  withheld?: number;
  updatedAt?: string;
};

const readFn = httpsCallable(functions, "getJourneyStats");
const refreshFn = httpsCallable(functions, "refreshJourneyStats");

export default function JourneyStatsCard() {
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setBusy(true);
    setError("");
    try {
      const res = await refreshFn({});
      setSummary(res.data as Summary);
    } catch (err) {
      setError(getCallableErrorMessage(err));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    const pending = readFn({}) as Promise<{ data?: Summary & { ready?: boolean } }> | undefined;
    if (!pending || typeof pending.then !== "function") return;
    pending
      .then((res) => {
        const data = res.data as Summary & { ready?: boolean };
        if (data?.ready) setSummary(data);
      })
      .catch(() => setSummary(null));
  }, []);

  const groups = [
    ...Object.entries(summary?.airports || {}),
    ...Object.entries(summary?.areas || {}),
  ];

  return (
    <div className="card" style={{ marginBottom: "1rem" }}>
      <div className="card-header">
        <h2 className="card-title" style={{ fontSize: "1rem" }}>Completed journey figures</h2>
        <button type="button" className="btn btn-secondary btn-sm" disabled={busy} onClick={refresh}>{busy ? "Updating…" : "Refresh figures"}</button>
      </div>
      {!summary ? <p className="text-sm">Figures appear after the first refresh.</p> : (
        <div className="text-sm">
          <p>Completed journeys in {summary.periodLabel}: <strong>{summary.completedJourneys ?? 0}</strong></p>
          <p>Unclassified records: {summary.unclassified ?? 0}. Sensitive routes withheld from the public page: {summary.withheld ?? 0}.</p>
          {groups.length > 0 ? (
            <ul>
              {groups.map(([id, count]) => <li key={id}>{id}: {count}</li>)}
            </ul>
          ) : null}
          {summary.updatedAt ? <p className="text-xs text-gray-500">Last updated {new Date(summary.updatedAt).toLocaleString("en-GB", { timeZone: "Europe/London" })}.</p> : null}
        </div>
      )}
      {error ? <p className="text-sm" style={{ color: "#b91c1c" }}>{error}</p> : null}
    </div>
  );
}
