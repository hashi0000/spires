import React from "react";
import { fixedTimeAcknowledgement, fixedTimeExplanation, CURRENT_WAITING_VERSION } from "../utils/airportWaitingPolicy";
function named(prefix: string, name: string) { return prefix ? prefix + name[0].toUpperCase() + name.slice(1) : name; }
export default function CollectionChoices({ formData, setFormData, prefix = "" }: { formData: any; setFormData: (value: any) => void; prefix?: string }) {
  const kind = formData[named(prefix, "collectionLocationKind")] === "hotel" ? "hotel" : "terminal";
  const arrangement = kind === "hotel" || formData[named(prefix, "collectionArrangement")] === "fixed_time" ? "fixed_time" : "flight_monitored";
  const set = (patch: any) => setFormData(Object.assign({}, formData, patch, {waitingPolicyVersion: CURRENT_WAITING_VERSION}));
  return (
    <div style={{ display: "grid", gap: "0.65rem" }}>
      <label>Collection place
        <select value={kind} onChange={(event) => set({ [named(prefix, "collectionLocationKind")]: event.target.value, [named(prefix, "collectionArrangement")]: event.target.value === "hotel" ? "fixed_time" : formData[named(prefix, "collectionArrangement")] || "flight_monitored" })}>
          <option value="terminal">Airport terminal</option>
          <option value="hotel">Airport hotel</option>
        </select>
      </label>
      <label>Exact collection location
        <input value={formData[named(prefix, "collectionLocation")] || ""} onChange={(event) => set({ [named(prefix, "collectionLocation")]: event.target.value })} placeholder={kind === "hotel" ? "Hotel name and address" : "Terminal and meeting point"} />
      </label>
      {kind === "terminal" ? (
        <label>Collection arrangement
          <select value={arrangement} onChange={(event) => set({ [named(prefix, "collectionArrangement")]: event.target.value, [named(prefix, "fixedTimeAcknowledged")]: false })}>
            <option value="flight_monitored">Flight monitored collection</option>
            <option value="fixed_time">Fixed time collection</option>
          </select>
        </label>
      ) : <p>A hotel collection uses the fixed time arrangement. A delay to an earlier flight does not move this pickup unless we agree a different time.</p>}
      {arrangement === "flight_monitored" ? (
        <label>Arrival date
          <input type="date" value={formData[named(prefix, "arrivalDate")] || ""} onChange={(event) => set({ [named(prefix, "arrivalDate")]: event.target.value })} />
        </label>
      ) : (
        <div>
          <p>{fixedTimeExplanation()}</p>
          <p>A flight number can be kept for reference. It is not monitored on this booking.</p>
          <label>
            <input type="checkbox" checked={formData[named(prefix, "fixedTimeAcknowledged")] === true} onChange={(event) => set({ [named(prefix, "fixedTimeAcknowledged")]: event.target.checked })} />
            {" "}{fixedTimeAcknowledgement()}
          </label>
        </div>
      )}
      {kind === "hotel" ? (
        <div>
          <label><input type="checkbox" checked={formData[named(prefix, "precedingFlight")] === true} onChange={(event) => set({ [named(prefix, "precedingFlight")]: event.target.checked })} /> Arriving on a flight before this hotel collection</label>
          <label><input type="checkbox" checked={formData[named(prefix, "travellingIndependently")] === true} onChange={(event) => set({ [named(prefix, "travellingIndependently")]: event.target.checked })} /> Travelling independently to the hotel</label>
        </div>
      ) : null}
      {prefix ? <>
      <label><input type="checkbox" checked={formData[named(prefix, "assistanceRequested")] === true} onChange={(event) => set({ [named(prefix, "assistanceRequested")]: event.target.checked })} /> Someone needs extra time or practical assistance boarding. This is subject to confirmation.</label>
      {formData[named(prefix, "assistanceRequested")] ? (
        <div>
          <textarea value={formData[named(prefix, "assistanceNote")] || ""} onChange={(event) => set({ [named(prefix, "assistanceNote")]: event.target.value })} placeholder="What practical help is needed?" />
          <label><input type="checkbox" checked={formData[named(prefix, "walkingAid")] === true} onChange={(event) => set({ [named(prefix, "walkingAid")]: event.target.checked })} /> Walking aid</label>
          <label><input type="checkbox" checked={formData[named(prefix, "wheelchairCarriage")] === true} onChange={(event) => set({ [named(prefix, "wheelchairCarriage")]: event.target.checked })} /> Wheelchair to be carried as luggage</label>
        </div>
      ) : null}
      </> : null}
    </div>
  );
}

