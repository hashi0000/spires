import React, { useEffect, useId, useRef, useState } from "react";

export type SelectedPlace = {
  label: string;
  placeId: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  premise: string;
};

type Suggestion = SelectedPlace & { id: string; needsProperty: boolean };

const ENDPOINT = "https://us-central1-spires-taxis.cloudfunctions.net/searchLocations";

type Props = {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string, place: SelectedPlace | null) => void;
};

export default function LocationField({ label, value, required, onChange }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [needsProperty, setNeedsProperty] = useState(false);
  const request = useRef(0);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onDoc(event: MouseEvent) {
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function load(query: string) {
    const token = ++request.current;
    try {
      const response = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}`);
      const body = await response.json();
      if (token !== request.current) return;
      setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
      setActive(0);
      setOpen(true);
    } catch {
      if (token === request.current) {
        setSuggestions([]);
        setOpen(false);
      }
    }
  }

  function choose(item: Suggestion) {
    const place: SelectedPlace = {
      label: item.label,
      placeId: item.placeId || "",
      postcode: item.postcode || "",
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
      premise: "",
    };
    onChange(item.label, place);
    setNeedsProperty(item.needsProperty === true);
    setOpen(false);
    if (item.placeId && item.latitude == null) {
      const token = ++request.current;
      fetch(`${ENDPOINT}?placeId=${encodeURIComponent(item.placeId)}`)
        .then((response) => response.json())
        .then((body) => {
          if (token !== request.current || !body.suggestion) return;
          onChange(body.suggestion.label || item.label, {
            label: body.suggestion.label || item.label,
            placeId: body.suggestion.placeId || item.placeId,
            postcode: body.suggestion.postcode || "",
            latitude: body.suggestion.latitude ?? null,
            longitude: body.suggestion.longitude ?? null,
            premise: "",
          });
          setNeedsProperty(body.suggestion.needsProperty === true);
        })
        .catch(() => undefined);
    }
  }

  return (
    <div ref={box} style={{ position: "relative" }}>
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={listId}>{label}</label>
      <input
        id={listId}
        className="form-input"
        required={required}
        value={value}
        autoComplete="off"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${listId}-list`}
        onFocus={() => load(value)}
        onChange={(event) => {
          onChange(event.target.value, null);
          setNeedsProperty(false);
          if (timer.current) window.clearTimeout(timer.current);
          timer.current = window.setTimeout(() => load(event.target.value), 280);
        }}
        onKeyDown={(event) => {
          if (!open || suggestions.length === 0) return;
          if (event.key === "ArrowDown") {
            event.preventDefault();
            setActive((index) => Math.min(suggestions.length - 1, index + 1));
          } else if (event.key === "ArrowUp") {
            event.preventDefault();
            setActive((index) => Math.max(0, index - 1));
          } else if (event.key === "Enter" && suggestions[active]) {
            event.preventDefault();
            choose(suggestions[active]);
          } else if (event.key === "Escape") {
            setOpen(false);
          }
        }}
      />
      {needsProperty ? (
        <p className="text-xs text-gray-600 mt-1">This postcode covers more than one property. Add the building, flat or entrance to the address.</p>
      ) : null}
      {open && suggestions.length > 0 ? (
        <ul id={`${listId}-list`} role="listbox" className="bg-white border rounded shadow" style={{ position: "absolute", zIndex: 30, left: 0, right: 0, marginTop: 4, maxHeight: 240, overflow: "auto" }}>
          {suggestions.map((item, index) => (
            <li key={item.id || item.label} role="option" aria-selected={index === active}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm"
                style={{ background: index === active ? "#f5efe6" : "#fff" }}
                onMouseDown={(event) => {
                  event.preventDefault();
                  choose(item);
                }}
              >
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
