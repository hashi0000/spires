import React from "react";
import LocationField from "./LocationField";
import { JourneyStop, describeStops, hasExtraStops, newStopId } from "../utils/journeyStops";

type Props = {
  stops: JourneyStop[];
  onChange: (stops: JourneyStop[]) => void;
};

const JourneyStopsEditor: React.FC<Props> = ({ stops, onChange }) => {
  const update = (index: number, patch: Partial<JourneyStop>) => {
    onChange(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  };
  const addStop = () => {
    const next = [...stops];
    next.splice(Math.max(stops.length - 1, 1), 0, { id: newStopId(), type: "dropoff", address: "", notes: "", place: null });
    onChange(next);
  };
  const removeStop = (index: number) => {
    if (stops.length <= 2) return;
    onChange(stops.filter((_, i) => i !== index));
  };
  const moveStop = (index: number, direction: -1 | 1) => {
    const target = index + direction;
    if (target < 0 || target >= stops.length) return;
    const next = [...stops];
    const [item] = next.splice(index, 1);
    next.splice(target, 0, item);
    onChange(next);
  };

  return (
    <div className="stop-editor">
      {stops.map((stop, index) => (
        <div key={stop.id} className="stop-row">
          <div className="stop-row-head">
            {stops.length === 2 ? (
              <strong>{stop.type === "pickup" ? "Pickup" : "Drop off"}</strong>
            ) : (
              <label>
                {index + 1}. Stop
                <select value={stop.type} onChange={(event) => update(index, { type: event.target.value === "dropoff" ? "dropoff" : "pickup" })}>
                  <option value="pickup">Pickup</option>
                  <option value="dropoff">Drop off</option>
                </select>
              </label>
            )}
            {stops.length > 2 ? (
              <div className="stop-row-actions">
                <button type="button" onClick={() => moveStop(index, -1)} disabled={index === 0}>Move up</button>
                <button type="button" onClick={() => moveStop(index, 1)} disabled={index === stops.length - 1}>Move down</button>
                <button type="button" onClick={() => removeStop(index)}>Remove</button>
              </div>
            ) : null}
          </div>
            <LocationField
            label="Address"
            value={stop.address}
            required
            onChange={(value, place) => update(index, { address: value, place: (place as JourneyStop["place"]) || null })}
          />
          <label className="stop-note">
            Note, optional
            <input value={stop.notes} onChange={(event) => update(index, { notes: event.target.value })} placeholder="For example, side entrance" />
          </label>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addStop}>Add a stop</button>
      <p className="stop-summary">{describeStops(stops.filter((stop) => stop.address))}</p>
      {hasExtraStops(stops) ? <p className="stop-review">Extra stops. Agree the fare before confirming.</p> : null}
    </div>
  );
};

export default JourneyStopsEditor;
