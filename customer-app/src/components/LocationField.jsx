import { useEffect, useId, useRef, useState } from "react";
import { localCallableUrl } from "../firebase";

const ENDPOINT = localCallableUrl("searchLocations");

export default function LocationField({ label, value, required, placeholder, onChange }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(0);
  const [needsProperty, setNeedsProperty] = useState(false);
  const request = useRef(0);
  const timer = useRef(null);
  const box = useRef(null);
  const selecting = useRef(false);

  useEffect(() => {
    function onDoc(event) {
      if (selecting.current) return;
      if (!box.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("pointerdown", onDoc);
    document.addEventListener("touchstart", onDoc, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", onDoc);
      document.removeEventListener("touchstart", onDoc);
    };
  }, []);

  async function load(query) {
    const token = ++request.current;
    try {
      const response = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query || "")}`);
      const body = await response.json();
      if (token !== request.current) return;
      const next = Array.isArray(body.suggestions) ? body.suggestions : [];
      setSuggestions(next);
      setActive(0);
      setOpen(next.length > 0);
    } catch {
      if (token === request.current) setOpen(false);
    }
  }

  function choose(item) {
    selecting.current = false;
    onChange(item.label, {
      label: item.label,
      placeId: item.placeId || "",
      postcode: item.postcode || "",
      latitude: item.latitude ?? null,
      longitude: item.longitude ?? null,
    });
    setNeedsProperty(item.needsProperty === true);
    setOpen(false);
  }

  function selectSuggestion(item, event) {
    event.preventDefault();
    event.stopPropagation();
    selecting.current = true;
    choose(item);
    window.setTimeout(() => {
      selecting.current = false;
    }, 400);
  }

  return (
    <div ref={box} style={{ position: "relative" }}>
      {label ? <label htmlFor={listId} style={{ display: "block", marginBottom: "0.25rem" }}>{label}</label> : null}
      <input
        id={listId}
        type="text"
        required={required}
        placeholder={placeholder}
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
          } else if (event.key === "Escape") setOpen(false);
        }}
      />
      {needsProperty ? <p style={{ fontSize: "0.8rem", margin: "0.25rem 0" }}>This postcode covers more than one property. Add the building, flat or entrance to the address.</p> : null}
      {open && suggestions.length > 0 ? (
        <ul
          id={`${listId}-list`}
          role="listbox"
          style={{
            position: "absolute",
            zIndex: 80,
            left: 0,
            right: 0,
            background: "#fff",
            border: "1px solid #d1d5db",
            margin: "4px 0 0",
            padding: 0,
            listStyle: "none",
            maxHeight: "min(240px, 45vh)",
            overflow: "auto",
            WebkitOverflowScrolling: "touch",
          }}
        >
          {suggestions.map((item, index) => (
            <li key={item.id || item.label} role="option" aria-selected={index === active}>
              <button
                type="button"
                onPointerDown={(event) => selectSuggestion(item, event)}
                onMouseDown={(event) => selectSuggestion(item, event)}
                onClick={(event) => selectSuggestion(item, event)}
                style={{
                  display: "block",
                  width: "100%",
                  textAlign: "left",
                  padding: "0.5rem 0.75rem",
                  minHeight: 44,
                  background: index === active ? "#f5efe6" : "#fff",
                  border: 0,
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
