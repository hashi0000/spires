import React, { useEffect, useId, useRef, useState } from "react";
import { localCallableUrl } from "../utils/firebase";

export type SelectedPlace = {
  label: string;
  placeId: string;
  postcode: string;
  latitude: number | null;
  longitude: number | null;
  premise: string;
};

type Suggestion = SelectedPlace & { id: string; needsProperty: boolean };

const ENDPOINT = localCallableUrl("searchLocations");

type Props = {
  label: string;
  value: string;
  required?: boolean;
  onChange: (value: string, place: SelectedPlace | null) => void;
  /** Company or recent places shown ahead of API results. Deduped by label. */
  extraSuggestions?: { id: string; label: string }[];
};

function mergeSuggestions(
  api: Suggestion[],
  extras: { id: string; label: string }[] | undefined,
  query: string
): Suggestion[] {
  const q = String(query || "").trim().toLowerCase();
  const fromExtras: Suggestion[] = (extras || [])
    .map((row) => ({
      id: row.id,
      label: row.label,
      placeId: "",
      postcode: "",
      latitude: null as number | null,
      longitude: null as number | null,
      premise: "",
      needsProperty: false,
    }))
    .filter((row) => {
      const label = String(row.label || "").trim();
      if (!label) return false;
      if (!q) return true;
      return label.toLowerCase().includes(q);
    });
  const seen = new Set(fromExtras.map((row) => row.label.trim().toLowerCase()));
  const fromApi = api.filter((row) => !seen.has(String(row.label || "").trim().toLowerCase()));
  return [...fromExtras, ...fromApi];
}

export default function LocationField({ label, value, required, onChange, extraSuggestions }: Props) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [active, setActive] = useState(0);
  const [needsProperty, setNeedsProperty] = useState(false);
  const request = useRef(0);
  const timer = useRef<number | null>(null);
  const box = useRef<HTMLDivElement>(null);
  const selecting = useRef(false);

  useEffect(() => {
    function onDoc(event: Event) {
      if (selecting.current) return;
      if (!box.current?.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  async function load(query: string) {
    const token = ++request.current;
    const trimmed = String(query || "").trim();
    if (!trimmed) {
      const onlyExtras = mergeSuggestions([], extraSuggestions, "");
      setSuggestions(onlyExtras);
      setActive(0);
      setOpen(onlyExtras.length > 0);
      return;
    }
    try {
      const response = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query)}`);
      const body = await response.json();
      if (token !== request.current) return;
      const api = Array.isArray(body.suggestions) ? body.suggestions : [];
      const merged = mergeSuggestions(api, extraSuggestions, query);
      setSuggestions(merged);
      setActive(0);
      setOpen(merged.length > 0);
    } catch {
      if (token === request.current) {
        const onlyExtras = mergeSuggestions([], extraSuggestions, query);
        setSuggestions(onlyExtras);
        setOpen(onlyExtras.length > 0);
      }
    }
  }

  function choose(item: Suggestion) {
    selecting.current = false;
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

  function selectSuggestion(item: Suggestion, event: React.SyntheticEvent) {
    event.preventDefault();
    event.stopPropagation();
    selecting.current = true;
    choose(item);
    window.setTimeout(() => {
      selecting.current = false;
    }, 400);
  }

  return (
    <div ref={box} className="location-field" style={{ position: "relative" }}>
      <label className="block text-sm font-medium text-gray-700 mb-1" htmlFor={listId}>{label}</label>
      <input
        id={listId}
        className="form-input"
        required={required}
        value={value}
        autoComplete="off"
        autoCorrect="off"
        spellCheck={false}
        inputMode="search"
        role="combobox"
        aria-expanded={open}
        aria-autocomplete="list"
        aria-controls={`${listId}-list`}
        onFocus={() => load(value)}
        onTouchStart={() => {
          if (!open) load(value);
        }}
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
        <ul
          id={`${listId}-list`}
          role="listbox"
          className="location-field__list bg-white border rounded shadow"
          style={{
            position: "absolute",
            zIndex: 80,
            left: 0,
            right: 0,
            marginTop: 4,
            maxHeight: "min(240px, 45vh)",
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {suggestions.map((item, index) => (
            <li key={item.id || item.label} role="option" aria-selected={index === active}>
              <button
                type="button"
                className="w-full text-left px-3 py-2 text-sm"
                style={{ background: index === active ? "#f5efe6" : "#fff", minHeight: 44 }}
                onPointerDown={(event) => selectSuggestion(item, event)}
                onMouseDown={(event) => selectSuggestion(item, event)}
                onClick={(event) => selectSuggestion(item, event)}
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
