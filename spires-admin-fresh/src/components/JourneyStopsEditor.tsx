import React from "react";
import LocationField from "./LocationField";
import { describeStops, hasExtraStops, JourneyStop, newStopId } from "../utils/journeyStops";

type Props = {
  stops: JourneyStop[];
  onChange: (stops: JourneyStop[]) => void;
  extraStopsIncluded?: boolean;
  onExtraStopsIncluded?: (included: boolean) => void;
  addressesRequired?: boolean;
  /** Company or recent places passed through to each address field. */
  placeSuggestions?: { id: string; label: string }[];
};

const JourneyStopsEditor: React.FC<Props> = ({ stops, onChange, extraStopsIncluded = false, onExtraStopsIncluded, addressesRequired = true, placeSuggestions }) => {
  const update = (index: number, patch: Partial<JourneyStop>) => {
    onChange(stops.map((stop, i) => (i === index ? { ...stop, ...patch } : stop)));
  };
  const addStop = () => {
    const id = newStopId();
    const next = [...stops];
    next.splice(Math.max(stops.length - 1, 1), 0, { id, type: "dropoff", address: "", notes: "", place: null });
    onChange(next);
    window.setTimeout(() => {
      const row = document.getElementById(id);
      row?.scrollIntoView({ block: "center" });
      row?.querySelector("input")?.focus();
    }, 0);
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
        <div key={stop.id} id={stop.id} className="stop-row">
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
            required={addressesRequired}
            extraSuggestions={placeSuggestions}
            onChange={(value, place) => update(index, { address: value, place: place || null })}
          />
          <label className="stop-note">
            Note, optional
            <input value={stop.notes || ""} onChange={(event) => update(index, { notes: event.target.value })} placeholder="For example, side entrance" />
          </label>
        </div>
      ))}
      <button type="button" className="btn btn-secondary btn-sm" onClick={addStop}>Add a stop</button>
      <p className="stop-summary">{describeStops(stops.filter((stop) => stop.address))}</p>
      {hasExtraStops(stops) && !extraStopsIncluded ? <p className="stop-review">Extra stops. Agree the fare before confirming.</p> : null}
      {hasExtraStops(stops) && onExtraStopsIncluded ? (
        <label className="stop-note">
          <input type="checkbox" checked={extraStopsIncluded} onChange={(event) => onExtraStopsIncluded(event.target.checked)} />
          Extra stops are included in the agreed fare
        </label>
      ) : null}
    </div>
  );
};

export default JourneyStopsEditor;
