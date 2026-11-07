import { useEffect, useId, useRef, useState } from "react";

const ENDPOINT = "https://us-central1-spires-taxis.cloudfunctions.net/searchLocations";

export default function LocationField({ label, value, required, placeholder, onChange }) {
  const listId = useId();
  const [open, setOpen] = useState(false);
  const [suggestions, setSuggestions] = useState([]);
  const [active, setActive] = useState(0);
  const [needsProperty, setNeedsProperty] = useState(false);
  const request = useRef(0);
  const timer = useRef(null);
  const box = useRef(null);

  useEffect(() => {
    function onDoc(event) {
      if (!box.current?.contains(event.target)) setOpen(false);
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  async function load(query) {
    const token = ++request.current;
    try {
      const response = await fetch(`${ENDPOINT}?q=${encodeURIComponent(query || "")}`);
      const body = await response.json();
      if (token !== request.current) return;
      setSuggestions(Array.isArray(body.suggestions) ? body.suggestions : []);
      setActive(0);
      setOpen(true);
    } catch {
      if (token === request.current) setOpen(false);
    }
  }

  function choose(item) {
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
          } else if (event.key === "Escape") setOpen(false);
        }}
      />
      {needsProperty ? <p style={{ fontSize: "0.8rem", margin: "0.25rem 0" }}>This postcode covers more than one property. Add the building, flat or entrance to the address.</p> : null}
      {open && suggestions.length > 0 ? (
        <ul id={`${listId}-list`} role="listbox" style={{ position: "absolute", zIndex: 20, left: 0, right: 0, background: "#fff", border: "1px solid #d1d5db", margin: "4px 0 0", padding: 0, listStyle: "none", maxHeight: 220, overflow: "auto" }}>
          {suggestions.map((item, index) => (
            <li key={item.id || item.label} role="option" aria-selected={index === active}>
              <button type="button" onMouseDown={(event) => { event.preventDefault(); choose(item); }} style={{ display: "block", width: "100%", textAlign: "left", padding: "0.5rem 0.75rem", background: index === active ? "#f5efe6" : "#fff", border: 0 }}>
                {item.label}
              </button>
            </li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
