// ─── PartySelector.jsx ────────────────────────────────────────────────────────
// Searchable party dropdown with keyboard navigation, address display,
// and live-reload so newly added parties appear without page refresh.
//
// Usage:
//   <PartySelector
//     value={form.source}
//     onChange={(name, freight, address) => { ... }}
//     showAddress   ← optional: shows address hint below input when a party is selected
//   />

import React, { useState, useEffect, useRef } from "react";
import axios from "axios";
const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

export default function PartySelector({ value, onChange, showAddress }) {
  const [parties, setParties] = useState([]);
  const [query, setQuery] = useState(value || "");
  const [open, setOpen] = useState(false);
  const [focused, setFocused] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);
  const wrapRef = useRef(null);

  // Refetch every mount so newly added parties appear immediately
  useEffect(() => {
    axios
      .get(`${API}/api/scrap/parties`)
      .then((r) => setParties(r.data))
      .catch((e) => console.error("PartySelector fetch error:", e));
  }, []);

  // Sync external value → input text
  useEffect(() => {
    setQuery(value || "");
  }, [value]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered =
    query.length === 0
      ? parties
      : parties.filter(
          (p) =>
            p.party_name.toLowerCase().includes(query.toLowerCase()) ||
            (p.address || "").toLowerCase().includes(query.toLowerCase()),
        );

  // The currently selected party object (for address hint)
  const selectedParty = parties.find((p) => p.party_name === value);

  const handleSelect = (party, inputEl) => {
    setQuery(party.party_name);
    setOpen(false);
    // Pass name, freight, address as 3 args
    onChange(party.party_name, party.freight ?? 0, party.address ?? "");
    // Move to next input after selection
    setTimeout(() => {
      const inputs = document.querySelectorAll("input, select, textarea");
      const arr = Array.from(inputs);
      const idx = arr.indexOf(inputEl);
      if (idx > -1 && arr[idx + 1]) arr[idx + 1].focus();
    }, 0);
  };

  const handleInputChange = (e) => {
    setQuery(e.target.value);
    setOpen(true);
    setHighlightIndex(0);
    if (!e.target.value) onChange("", 0, "");
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      <input
        type="text"
        value={query}
        onChange={handleInputChange}
        onFocus={() => {
          setOpen(true);
          setFocused(true);
        }}
        onBlur={() => setFocused(false)}
        placeholder="Type to search party…"
        style={{
          padding: "6px 10px",
          borderRadius: 6,
          border: `1px solid ${focused ? "#4299e1" : "#cbd5e0"}`,
          fontSize: 13,
          width: "100%",
          boxSizing: "border-box",
          outline: "none",
          background: "#fff",
        }}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown") {
            e.preventDefault();
            setHighlightIndex((i) => Math.min(i + 1, filtered.length - 1));
          } else if (e.key === "ArrowUp") {
            e.preventDefault();
            setHighlightIndex((i) => Math.max(i - 1, 0));
          } else if (e.key === "Enter") {
            e.preventDefault();
            if (open && filtered.length > 0) {
              handleSelect(filtered[highlightIndex], e.target);
            } else {
              const inputs = document.querySelectorAll(
                "input, select, textarea",
              );
              const arr = Array.from(inputs);
              const idx = arr.indexOf(e.target);
              if (idx > -1 && arr[idx + 1]) arr[idx + 1].focus();
            }
          } else if (e.key === "Escape") {
            setOpen(false);
          }
        }}
      />

      {/* Address hint shown below input when a party is selected */}
      {showAddress && selectedParty?.address && (
        <div style={{ fontSize: 11, color: "#718096", marginTop: 3, paddingLeft: 2 }}>
          📍 {selectedParty.address}
        </div>
      )}

      {/* Hint when no match found */}
      {open && query && filtered.length === 0 && (
        <div
          style={{
            position: "fixed",
            top: wrapRef.current?.getBoundingClientRect().bottom + 2,
            left: wrapRef.current?.getBoundingClientRect().left,
            width: wrapRef.current?.getBoundingClientRect().width,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            zIndex: 9999,
            padding: "12px",
            fontSize: 12,
            color: "#a0aec0",
            textAlign: "center",
          }}
        >
          No match — use the <strong>+</strong> button to add this party
        </div>
      )}

      {open && filtered.length > 0 && (
        <div
          style={{
            position: "fixed",
            top: wrapRef.current?.getBoundingClientRect().bottom + 2,
            left: wrapRef.current?.getBoundingClientRect().left,
            width: wrapRef.current?.getBoundingClientRect().width,
            background: "#fff",
            border: "1px solid #e2e8f0",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
            maxHeight: 260,
            overflowY: "auto",
            zIndex: 9999,
            marginTop: 2,
          }}
        >
          {filtered.map((p, i) => (
            <div
              key={p.party_name}
              onMouseDown={() => handleSelect(p)}
              style={{
                padding: "8px 12px",
                cursor: "pointer",
                borderBottom: "1px solid #f7fafc",
                background:
                  i === highlightIndex
                    ? "#bee3f8"
                    : p.party_name === value
                      ? "#ebf8ff"
                      : "#fff",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.background = "#f7fafc")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.background =
                  p.party_name === value ? "#ebf8ff" : "#fff")
              }
            >
              <div style={{ fontWeight: 600, fontSize: 13, color: "#2d3748" }}>
                {p.party_name}
              </div>
              {/* Always show address in dropdown list if available */}
              {p.address && (
                <div style={{ fontSize: 11, color: "#718096", marginTop: 1 }}>
                  📍 {p.address}
                </div>
              )}
              {p.freight > 0 && (
                <div style={{ fontSize: 11, color: "#2b6cb0", marginTop: 1 }}>
                  🚚 Freight: NPR {Number(p.freight).toLocaleString("en-IN")}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}