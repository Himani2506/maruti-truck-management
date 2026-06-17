import React, { useState, useEffect, useRef } from "react";
import {
  getTrucks,
  getSources,
  getCustomers,
  getBackloads,
  createTrip,
  createCustomer,
  createBackload,
  getTrip,
  updateTrip,
} from "../api";
import NepaliDatePicker from "./NepaliDatePicker";
import { bsToADString, formatBS, adToBS } from "../nepaliDate";
import toast from "react-hot-toast";

const FOODING_RATE = 1000;
const BHATTA_RATE = 1500;
const DIESEL_PRICE = 222.5;

const initialForm = {
  truck_id: "",
  source_ids: [],      // NEW: array like customer_ids
  customer_ids: [],
  mpp_bill_no: "",
  meter_start: "",
  meter_end: "",
  diesel_used: "",
  loading_amount: "",
  unloading_amount: "",
  maintenance_hisab_phanna: "",
  maintenance_rokhar: "",
  grease_expense: "",
  trip_bhatta_override: "",
  road_tax: "",
  fooding_override: "",
  scrap_tax: "",
  tyre_expense: "",
  police_tax: "",
  phone_expense: "",
  freight_amount: "",
  backload_freight_amount: "",
  remarks: "",
  backload_id: "",
  backload_bill_no: "",
  backload_loading_amount: "",
  backload_unloading_amount: "",
};

const emptyBS = { year: "", month: "", day: "" };

// ── Source multi-select (mirrors CustomerSearchInput) ────────
function SourceSearchInput({ sources, selectedIds, onToggle }) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const inputRef = useRef(null);
  const wrapRef = useRef(null);

  const filtered = sources.filter(
    (s) =>
      !selectedIds.includes(s.id) &&
      s.name.toLowerCase().includes(query.toLowerCase()),
  );

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const select = (source) => {
    onToggle(source.id);
    setQuery("");
    setHighlighted(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) => Math.min(h + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlighted]) select(filtered[highlighted]);
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
    }
  };

  const selectedSources = selectedIds
    .map((id) => sources.find((s) => s.id === id))
    .filter(Boolean);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {selectedSources.length > 0 && (
        <div style={styles.tagRow}>
          {selectedSources.map((s, i) => (
            <div key={s.id} style={{ ...styles.tag, background: i === 0 ? "#1a3a5c" : "#5a7a9c" }}>
              {i === 0 && (
                <span style={styles.primaryDot} title="Primary source" />
              )}
              <span style={{ fontSize: 12.5 }}>{s.name}</span>
              <button
                type="button"
                onClick={() => onToggle(s.id)}
                style={styles.tagRemove}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.searchWrap}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={
            selectedSources.length === 0
              ? "Type to search sources…"
              : "Add another source…"
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
          }}
          onFocus={() => setOpen(true)}
          onKeyDown={handleKeyDown}
          style={styles.input}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            style={styles.clearBtn}
          >
            ×
          </button>
        )}
      </div>

      {open && (
        <div style={styles.dropdown}>
          {filtered.length === 0 ? (
            <div style={styles.dropdownEmpty}>
              {query
                ? `No source matching "${query}"`
                : selectedIds.length === sources.length
                  ? "All sources selected"
                  : "Start typing to search…"}
            </div>
          ) : (
            filtered.map((s, i) => (
              <div
                key={s.id}
                onMouseDown={(e) => {
                  e.preventDefault();
                  select(s);
                }}
                onMouseEnter={() => setHighlighted(i)}
                style={{
                  ...styles.dropdownItem,
                  background: i === highlighted ? "#e8f0fe" : "#fff",
                  fontWeight: i === highlighted ? 600 : 400,
                }}
              >
                <span style={{ fontSize: 13 }}>{s.name}</span>
                {s.address && (
                  <span style={styles.dropdownSub}>{s.address.trim()}</span>
                )}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}

// ── Customer multi-select ────────────────────────────────────
function CustomerSearchInput({
  customers,
  selectedIds,
  onToggle,
  onCustomerCreated,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newCust, setNewCust] = useState({
    name: "",
    destination_address: "",
    freight_dhuwwani: "",
  });
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const inputRef = useRef(null);
  const wrapRef = useRef(null);
  const nameRef = useRef(null);

  const filtered = customers.filter(
    (c) =>
      !selectedIds.includes(c.id) &&
      c.name.toLowerCase().includes(query.toLowerCase()),
  );

  const exactMatch = customers.some(
    (c) => c.name?.toLowerCase() === query.toLowerCase()
  );
  const showAddOption = query.trim().length > 0 && !exactMatch;

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
        setShowAddForm(false);
        setAddError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showAddForm) {
      setTimeout(() => nameRef.current?.focus(), 0);
    }
  }, [showAddForm]);

  const select = (customer) => {
    onToggle(customer.id);
    setQuery("");
    setHighlighted(0);
    setOpen(false);
    inputRef.current?.focus();
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) =>
        Math.min(h + 1, filtered.length - 1 + (showAddOption ? 1 : 0)),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlighted]) {
        select(filtered[highlighted]);
      } else if (open && showAddOption && filtered.length === 0) {
        openAddForm();
      } else if (open && showAddOption && highlighted === filtered.length) {
        openAddForm();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setShowAddForm(false);
    }
  };

  const handleFormKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      const focusable = Array.from(
        wrapRef.current?.querySelectorAll(
          "input:not([disabled]), button:not([disabled])",
        ) || [],
      ).filter((el) => !el.readOnly);
      const idx = focusable.indexOf(e.target);
      const next = focusable[idx + 1];
      if (next && next.tagName !== "BUTTON") {
        next.focus();
      } else {
        handleAddSubmit();
      }
    }
  };

  const openAddForm = () => {
    setTimeout(() => {
      setNewCust({
        name: query.trim(),
        destination_address: "",
        freight_dhuwwani: "",
      });
      setShowAddForm(true);
      setOpen(false);
      setAddError("");
    }, 0);
  };

  const toTitleCase = (str) =>
    str
      .trim()
      .replace(
        /\w\S*/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      );

  const handleAddSubmit = async () => {
    if (!newCust.name.trim()) {
      setAddError("Name is required.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const created = await createCustomer({
        ...newCust,
        name: toTitleCase(newCust.name),
      });
      onCustomerCreated(created);
      setShowAddForm(false);
      setQuery("");
      setOpen(false);
    } catch (err) {
      setAddError(err.response?.data?.error || "Failed to create customer.");
    } finally {
      setAdding(false);
    }
  };

  const selectedCustomers = selectedIds
    .map((id) => customers.find((c) => c.id === id))
    .filter(Boolean);

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {selectedCustomers.length > 0 && (
        <div style={styles.tagRow}>
          {selectedCustomers.map((c, i) => (
            <div key={c.id} style={styles.tag}>
              {i === 0 && (
                <span style={styles.primaryDot} title="Primary customer" />
              )}
              <span style={{ fontSize: 12.5 }}>{c.name}</span>
              <button
                type="button"
                onClick={() => onToggle(c.id)}
                style={styles.tagRemove}
                title="Remove"
              >
                ×
              </button>
            </div>
          ))}
        </div>
      )}

      <div style={styles.searchWrap}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={
            selectedCustomers.length === 0
              ? "Type to search customers…"
              : "Add another customer…"
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
            setShowAddForm(false);
          }}
          onFocus={() => {
            if (!showAddForm) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          style={styles.input}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              setShowAddForm(false);
              inputRef.current?.focus();
            }}
            style={styles.clearBtn}
          >
            ×
          </button>
        )}
      </div>

      {open && !showAddForm && (
        <div style={styles.dropdown}>
          {filtered.length === 0 && !showAddOption ? (
            <div style={styles.dropdownEmpty}>
              {query
                ? `No customer matching "${query}"`
                : selectedIds.length === customers.length
                  ? "All customers selected"
                  : "Start typing to search…"}
            </div>
          ) : (
            <>
              {filtered.map((c, i) => (
                <div
                  key={c.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(c);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    ...styles.dropdownItem,
                    background: i === highlighted ? "#e8f0fe" : "#fff",
                    fontWeight: i === highlighted ? 600 : 400,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{c.name}</span>
                  {c.destination_address && (
                    <span style={styles.dropdownSub}>
                      {c.destination_address.trim()}
                    </span>
                  )}
                </div>
              ))}
              {showAddOption && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openAddForm();
                  }}
                  onMouseEnter={() => setHighlighted(filtered.length)}
                  style={{
                    ...styles.dropdownItem,
                    background:
                      highlighted === filtered.length ? "#ffe082" : "#fff8e1",
                    borderTop: "1px solid #ffe082",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}
                  >
                    ＋ Add "{query.trim()}" as new customer
                  </span>
                  <span style={styles.dropdownSub}>
                    Click to fill in details and save
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showAddForm && (
        <div style={addFormStyles.wrap} onKeyDown={handleFormKeyDown}>
          <div style={addFormStyles.header}>
            <span style={addFormStyles.title}>New Customer</span>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              style={addFormStyles.closeBtn}
            >
              ✕
            </button>
          </div>

          <div style={addFormStyles.fieldWrap}>
            <label style={addFormStyles.label}>Name *</label>
            <input
              ref={nameRef}
              type="text"
              value={newCust.name}
              onChange={(e) =>
                setNewCust((p) => ({ ...p, name: e.target.value }))
              }
              style={styles.input}
              placeholder="e.g. Shrestha Traders"
            />
          </div>

          <div style={addFormStyles.fieldWrap}>
            <label style={addFormStyles.label}>Destination Address</label>
            <input
              type="text"
              value={newCust.destination_address}
              onChange={(e) =>
                setNewCust((p) => ({
                  ...p,
                  destination_address: e.target.value,
                }))
              }
              style={styles.input}
              placeholder="e.g. Butwal, Lumbini"
            />
          </div>

          <div style={addFormStyles.fieldWrap}>
            <label style={addFormStyles.label}>Freight Dhuwani Rate (NPR)</label>
            <input
              type="number"
              value={newCust.freight_dhuwwani}
              onChange={(e) =>
                setNewCust((p) => ({ ...p, freight_dhuwwani: e.target.value }))
              }
              style={styles.input}
              placeholder="e.g. 28000"
            />
          </div>

          {addError && <div style={addFormStyles.error}>{addError}</div>}

          <div style={addFormStyles.actions}>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              style={addFormStyles.cancelBtn}
              disabled={adding}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSubmit}
              style={addFormStyles.saveBtn}
              disabled={adding}
            >
              {adding ? "Saving…" : "Save & Select"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Backload supplier select ─────────────────────────────────
function BackloadSupplierSelect({
  backloads,
  value,
  onChange,
  onBackloadCreated,
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlighted, setHighlighted] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);
  const [newDesc, setNewDesc] = useState("");
  const [adding, setAdding] = useState(false);
  const [addError, setAddError] = useState("");
  const inputRef = useRef(null);
  const nameRef = useRef(null);
  const wrapRef = useRef(null);

  const selected =
    backloads.find((b) => String(b.id) === String(value)) || null;

  const filtered = backloads.filter((b) =>
    b.description.toLowerCase().includes(query.toLowerCase()),
  );

  const exactMatch = backloads.some(
    (b) => b.description.toLowerCase() === query.toLowerCase(),
  );
  const showAddOption = query.trim().length > 0 && !exactMatch;

  const toTitleCase = (str) =>
    str
      .trim()
      .replace(
        /\w\S*/g,
        (w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase(),
      );

  useEffect(() => {
    const handler = (e) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target)) {
        setOpen(false);
        setQuery("");
        setShowAddForm(false);
        setAddError("");
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  useEffect(() => {
    if (showAddForm) setTimeout(() => nameRef.current?.focus(), 0);
  }, [showAddForm]);

  const select = (b) => {
    onChange({ target: { name: "backload_id", value: String(b.id) } });
    setQuery("");
    setOpen(false);
    setHighlighted(0);
  };

  const clearSelection = () => {
    onChange({ target: { name: "backload_id", value: "" } });
    setQuery("");
    setTimeout(() => inputRef.current?.focus(), 0);
  };

  const handleKeyDown = (e) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setOpen(true);
      setHighlighted((h) =>
        Math.min(h + 1, filtered.length - 1 + (showAddOption ? 1 : 0)),
      );
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setHighlighted((h) => Math.max(h - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (open && filtered[highlighted]) {
        select(filtered[highlighted]);
      } else if (
        open &&
        showAddOption &&
        (filtered.length === 0 || highlighted === filtered.length)
      ) {
        openAddForm();
      }
    } else if (e.key === "Escape") {
      setOpen(false);
      setQuery("");
      setShowAddForm(false);
    }
  };

  const openAddForm = () => {
    setTimeout(() => {
      setNewDesc(query.trim());
      setShowAddForm(true);
      setOpen(false);
      setAddError("");
    }, 0);
  };

  const handleFormKeyDown = (e) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddSubmit();
    }
    if (e.key === "Escape") {
      setShowAddForm(false);
      setAddError("");
    }
  };

  const handleAddSubmit = async () => {
    if (!newDesc.trim()) {
      setAddError("Description is required.");
      return;
    }
    setAdding(true);
    setAddError("");
    try {
      const created = await createBackload({
        description: toTitleCase(newDesc),
      });
      onBackloadCreated(created);
      onChange({ target: { name: "backload_id", value: String(created.id) } });
      setShowAddForm(false);
      setNewDesc("");
      setQuery("");
    } catch (err) {
      setAddError(err.response?.data?.error || "Failed to create supplier.");
    } finally {
      setAdding(false);
    }
  };

  return (
    <div ref={wrapRef} style={{ position: "relative" }}>
      {selected && (
        <div style={styles.tagRow}>
          <div style={styles.tag}>
            <span style={{ fontSize: 12.5 }}>{selected.description}</span>
            <button
              type="button"
              onClick={clearSelection}
              style={styles.tagRemove}
              title="Remove"
            >
              ×
            </button>
          </div>
        </div>
      )}

      <div style={styles.searchWrap}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={
            selected ? "Change supplier…" : "Type to search suppliers…"
          }
          onChange={(e) => {
            setQuery(e.target.value);
            setOpen(true);
            setHighlighted(0);
            setShowAddForm(false);
          }}
          onFocus={() => {
            if (!showAddForm) setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          style={styles.input}
          autoComplete="off"
        />
        {query && (
          <button
            type="button"
            onClick={() => {
              setQuery("");
              inputRef.current?.focus();
            }}
            style={styles.clearBtn}
          >
            ×
          </button>
        )}
      </div>

      {open && !showAddForm && (
        <div style={styles.dropdown}>
          <div
            onMouseDown={(e) => {
              e.preventDefault();
              clearSelection();
              setOpen(false);
            }}
            style={{
              ...styles.dropdownItem,
              background: !value ? "#e8f0fe" : "#fff",
              fontWeight: !value ? 600 : 400,
              color: "#888",
              fontStyle: "italic",
            }}
          >
            <span style={{ fontSize: 13 }}>No backload</span>
          </div>

          {filtered.length === 0 && !showAddOption ? (
            <div style={styles.dropdownEmpty}>
              {query
                ? `No supplier matching "${query}"`
                : "Start typing to search…"}
            </div>
          ) : (
            <>
              {filtered.map((b, i) => (
                <div
                  key={b.id}
                  onMouseDown={(e) => {
                    e.preventDefault();
                    select(b);
                  }}
                  onMouseEnter={() => setHighlighted(i)}
                  style={{
                    ...styles.dropdownItem,
                    background: i === highlighted ? "#e8f0fe" : "#fff",
                    fontWeight: i === highlighted ? 600 : 400,
                  }}
                >
                  <span style={{ fontSize: 13 }}>{b.description}</span>
                </div>
              ))}
              {showAddOption && (
                <div
                  onMouseDown={(e) => {
                    e.preventDefault();
                    openAddForm();
                  }}
                  onMouseEnter={() => setHighlighted(filtered.length)}
                  style={{
                    ...styles.dropdownItem,
                    background:
                      highlighted === filtered.length ? "#ffe082" : "#fff8e1",
                    borderTop: "1px solid #ffe082",
                    cursor: "pointer",
                  }}
                >
                  <span
                    style={{ fontSize: 13, color: "#b45309", fontWeight: 600 }}
                  >
                    ＋ Add "{query.trim()}" as new supplier
                  </span>
                  <span style={styles.dropdownSub}>
                    Click to fill in details and save
                  </span>
                </div>
              )}
            </>
          )}
        </div>
      )}

      {showAddForm && (
        <div style={addFormStyles.wrap} onKeyDown={handleFormKeyDown}>
          <div style={addFormStyles.header}>
            <span style={addFormStyles.title}>New Backload Supplier</span>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              style={addFormStyles.closeBtn}
            >
              ✕
            </button>
          </div>

          <div style={addFormStyles.fieldWrap}>
            <label style={addFormStyles.label}>Description *</label>
            <input
              ref={nameRef}
              type="text"
              value={newDesc}
              onChange={(e) => setNewDesc(e.target.value)}
              style={styles.input}
              placeholder="e.g. Scrap from Hariom Suppliers"
            />
          </div>

          {addError && <div style={addFormStyles.error}>{addError}</div>}

          <div style={addFormStyles.actions}>
            <button
              type="button"
              onClick={() => {
                setShowAddForm(false);
                setAddError("");
              }}
              style={addFormStyles.cancelBtn}
              disabled={adding}
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleAddSubmit}
              style={addFormStyles.saveBtn}
              disabled={adding}
            >
              {adding ? "Saving…" : "Save & Select"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Main Form ────────────────────────────────────────────────
export default function TripForm({ onSuccess, editTripId }) {
  const [form, setForm] = useState(initialForm);
  const [startBS, setStartBS] = useState(emptyBS);
  const [endBS, setEndBS] = useState(emptyBS);
  const [backloadStartBS, setBackloadStartBS] = useState(emptyBS);
  const [backloadEndBS, setBackloadEndBS] = useState(emptyBS);
  const [trucks, setTrucks] = useState([]);
  const [sources, setSources] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [backloads, setBackloads] = useState([]);
  const [customerPieces, setCustomerPieces] = useState({});
  const [customerFreight, setCustomerFreight] = useState({});

  const topRef = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement?.type === "number") {
        document.activeElement.blur();
      }
    };
    document.addEventListener("wheel", handler, { passive: true });
    return () => document.removeEventListener("wheel", handler);
  }, []);

  const startAD = bsToADString(startBS.year, startBS.month, startBS.day);
  const endAD = bsToADString(endBS.year, endBS.month, endBS.day);

  const numDays = (() => {
    if (!startAD || !endAD) return null;
    const d = Math.ceil(
      (new Date(endAD) - new Date(startAD)) / (1000 * 60 * 60 * 24),
    );
    return d >= 0 ? d + 1 : null;
  })();
  const foodingAuto = numDays ? numDays * FOODING_RATE : 0;
  const fooding = form.fooding_override !== ""
    ? parseFloat(form.fooding_override) || 0
    : foodingAuto;
  const tripBhatta = startAD && endAD ? BHATTA_RATE : 0;

  const meterStart = parseFloat(form.meter_start) || null;
  const meterEnd = parseFloat(form.meter_end) || null;
  const distanceKm =
    meterStart && meterEnd && meterEnd > meterStart
      ? parseFloat((meterEnd - meterStart).toFixed(2))
      : null;

  const truckAvg = selectedTruck?.avg_kmpl
    ? parseFloat(selectedTruck.avg_kmpl)
    : null;
  const dieselNeeded =
    distanceKm && truckAvg
      ? parseFloat((distanceKm / truckAvg).toFixed(2))
      : null;
  const dieselCost = form.diesel_used
    ? parseFloat((parseFloat(form.diesel_used) * DIESEL_PRICE).toFixed(2))
    : null;
  const dieselDev =
    dieselNeeded != null && form.diesel_used
      ? parseFloat((dieselNeeded - parseFloat(form.diesel_used)).toFixed(2))
      : null;

  const n = (k) => parseFloat(form[k]) || 0;
  const effectiveBhatta =
    form.trip_bhatta_override !== ""
      ? parseFloat(form.trip_bhatta_override) || 0
      : BHATTA_RATE;

  const totalExpenses =
    (dieselCost || 0) +
    fooding +
    effectiveBhatta +
    n("loading_amount") +
    n("unloading_amount") +
    n("maintenance_hisab_phanna") +
    n("maintenance_rokhar") +
    n("grease_expense") +
    n("road_tax") +
    n("tyre_expense") +
    n("police_tax") +
    n("phone_expense");

  const totalCashExpense = totalExpenses - (dieselCost || 0);

  const backloadStartAD = bsToADString(
    backloadStartBS.year,
    backloadStartBS.month,
    backloadStartBS.day,
  );
  const backloadEndAD = bsToADString(
    backloadEndBS.year,
    backloadEndBS.month,
    backloadEndBS.day,
  );

  const backloadDays = (() => {
    if (!backloadStartAD || !backloadEndAD) return null;
    const d = Math.ceil(
      (new Date(backloadEndAD) - new Date(backloadStartAD)) /
        (1000 * 60 * 60 * 24),
    );
    return d >= 0 ? d + 1 : null;
  })();

  const backloadFoodingAuto = backloadDays ? backloadDays * FOODING_RATE : 0;
  const effectiveBackloadFooding =
    form.backload_fooding !== ""
      ? parseFloat(form.backload_fooding) || 0
      : backloadFoodingAuto;
  const effectiveBackloadBhatta =
    form.backload_bhatta !== ""
      ? parseFloat(form.backload_bhatta) || 0
      : backloadStartAD
        ? BHATTA_RATE
        : 0;

  const backloadCashExpense =
    (parseFloat(form.backload_loading_amount) || 0) +
    (parseFloat(form.backload_unloading_amount) || 0) +
    effectiveBackloadBhatta +
    effectiveBackloadFooding +
    n("scrap_tax");

  const totalCashExpenseWithBackload = totalCashExpense + backloadCashExpense;

  const totalFreightDisplay =
    (parseFloat(form.freight_amount) || 0) +
    (form.customer_ids || [])
      .slice(1)
      .reduce((sum, id) => sum + (parseFloat(customerFreight[id]) || 0), 0);

  const effectiveBackloadFreight =
    (parseFloat(form.backload_freight_amount) || 0) + n("scrap_tax");

  const totalRevenue =
    totalFreightDisplay + Number(form.backload_freight_amount || 0);

  const surplus = form.freight_amount
    ? parseFloat((totalRevenue - totalExpenses).toFixed(2))
    : null;

  const backloadSurplus = form.backload_freight_amount
    ? parseFloat(
        (
          effectiveBackloadFreight -
          (parseFloat(form.backload_loading_amount) || 0) -
          (parseFloat(form.backload_unloading_amount) || 0) -
          effectiveBackloadBhatta -
          effectiveBackloadFooding
        ).toFixed(2),
      )
    : null;

  const netSurplus =
    surplus != null || backloadSurplus != null
      ? (surplus || 0) + (backloadSurplus || 0)
      : null;

  const selectedCustomers = (form.customer_ids || [])
    .map((id) => customers.find((c) => c.id === id))
    .filter(Boolean);
  const firstCustomer = selectedCustomers[0] || null;

  // Selected sources derived
  const selectedSources = (form.source_ids || [])
    .map((id) => sources.find((s) => s.id === id))
    .filter(Boolean);

  useEffect(() => {
    getTrucks().then(setTrucks);
    getSources().then(setSources);
    getCustomers().then(setCustomers);
    getBackloads().then(setBackloads);
  }, []);

  useEffect(() => {
    setSelectedTruck(
      trucks.find((t) => t.id === parseInt(form.truck_id)) || null,
    );
  }, [form.truck_id, trucks]);

  // Auto-fill freight from first customer's freight_dhuwwani
  useEffect(() => {
    if (firstCustomer?.freight_dhuwwani) {
      setForm((prev) => ({
        ...prev,
        freight_amount: firstCustomer.freight_dhuwwani,
      }));
    }
  }, [form.customer_ids[0]]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const toggleCustomer = (id) => {
    setForm((prev) => {
      const existing = prev.customer_ids || [];
      if (existing.includes(id)) {
        return { ...prev, customer_ids: existing.filter((x) => x !== id) };
      } else {
        return { ...prev, customer_ids: [...existing, id] };
      }
    });
  };

  // NEW: toggle source selection
  const toggleSource = (id) => {
    setForm((prev) => {
      const existing = prev.source_ids || [];
      if (existing.includes(id)) {
        return { ...prev, source_ids: existing.filter((x) => x !== id) };
      } else {
        return { ...prev, source_ids: [...existing, id] };
      }
    });
  };

  const handleCustomerCreated = (newCustomer) => {
    setCustomers((prev) => [...prev, newCustomer]);
    toggleCustomer(newCustomer.id);
    toast.success(`"${newCustomer.name}" added and selected!`);
  };

  const handleBackloadCreated = (newBackload) => {
    setBackloads((prev) => [...prev, newBackload]);
    toast.success(`"${newBackload.description}" added and selected!`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.truck_id || !form.source_ids.length || !form.customer_ids.length) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!startAD) {
      toast.error("Please select a start date.");
      return;
    }
    setSubmitting(true);

    const payload = {
      ...form,
      customer_id: form.customer_ids[0],
      customer_ids: form.customer_ids,
      source_id: form.source_ids[0],   // primary source
      source_ids: form.source_ids,      // all sources
      start_date: startAD,
      end_date: endAD || null,
      distance_km: distanceKm,
      diesel_needed: dieselNeeded,
      diesel_cost: dieselCost,
      trip_bhatta: effectiveBhatta,
      police_tax: n("police_tax") || null,
      phone_expense: n("phone_expense") || null,
      loading_unloading: n("loading_amount") + n("unloading_amount") || null,
      backload_supplier_id: form.backload_id || null,
      backload_bill_no: form.backload_bill_no || null,
      pieces: customerPieces[form.customer_ids[0]] || null,
      customer_pieces: customerPieces,
      customer_freight: customerFreight,
      backload_start_date: backloadStartAD || null,
      backload_end_date: backloadEndAD || null,
      backload_fooding: effectiveBackloadFooding,
      backload_bhatta: effectiveBackloadBhatta,
      backload_loading_amount: form.backload_loading_amount || null,
      backload_unloading_amount: form.backload_unloading_amount || null,
    };

    try {
      if (editTripId) {
        await updateTrip(editTripId, payload);
        toast.success("Trip updated!");
      } else {
        await createTrip(payload);
        toast.success("Trip entry saved!");
        setCustomerPieces({});
        setCustomerFreight({});
        setForm(initialForm);
        setStartBS(emptyBS);
        setEndBS(emptyBS);
        setBackloadStartBS(emptyBS);
        setBackloadEndBS(emptyBS);
        topRef.current?.scrollIntoView({ behavior: "smooth" });
        return;
      }
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save trip.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (v) => (v != null ? `NPR ${Number(v).toLocaleString()}` : "—");
  const handleEnter = (e) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const focusable = Array.from(
        document.querySelectorAll("input, select, textarea"),
      ).filter((el) => !el.readOnly && !el.disabled);
      const index = focusable.indexOf(e.target);
      if (index > -1 && focusable[index + 1]) focusable[index + 1].focus();
    }
  };

  useEffect(() => {
    if (!editTripId) return;
    getTrip(editTripId)
      .then((trip) => {
        setForm({
          truck_id: String(trip.truck_id || ""),
          // Restore source_ids: prefer stored array, else wrap single source_id
          source_ids: Array.isArray(trip.source_ids) && trip.source_ids.length
            ? trip.source_ids.map(Number)
            : trip.source_id
              ? [Number(trip.source_id)]
              : [],
          customer_ids: trip.customer_ids?.length
            ? trip.customer_ids
            : trip.customer_id
              ? [trip.customer_id]
              : [],
          mpp_bill_no: trip.mpp_bill_no || "",
          meter_start: trip.meter_start ?? "",
          meter_end: trip.meter_end ?? "",
          diesel_used: trip.diesel_used ?? "",
          loading_amount: trip.loading_amount ?? "",
          unloading_amount: trip.unloading_amount ?? "",
          maintenance_hisab_phanna: trip.maintenance_hisab_phanna ?? "",
          maintenance_rokhar: trip.maintenance_rokhar ?? "",
          grease_expense: trip.grease_expense ?? "",
          trip_bhatta_override: trip.trip_bhatta ?? "",
          fooding_override: trip.fooding != null ? String(trip.fooding) : "",
          road_tax: trip.road_tax ?? "",
          scrap_tax: trip.scrap_tax ?? "",
          tyre_expense: trip.tyre_expense ?? "",
          police_tax: trip.police_tax ?? "",
          phone_expense: trip.phone_expense ?? "",
          freight_amount: trip.freight_amount ?? "",
          backload_freight_amount: trip.backload_freight_amount ?? "",
          remarks: trip.remarks || "",
          backload_id: trip.backload_supplier_id
            ? String(trip.backload_supplier_id)
            : "",
          backload_bill_no: trip.backload_bill_no || "",
          backload_loading_amount: trip.backload_loading_amount ?? "",
          backload_unloading_amount: trip.backload_unloading_amount ?? "",
          backload_fooding: trip.backload_fooding ?? "",
          backload_bhatta: trip.backload_bhatta ?? "",
        });
        if (trip.start_date) setStartBS(adToBS(trip.start_date));
        if (trip.end_date) setEndBS(adToBS(trip.end_date));
        if (trip.backload_start_date)
          setBackloadStartBS(adToBS(trip.backload_start_date));
        if (trip.backload_end_date)
          setBackloadEndBS(adToBS(trip.backload_end_date));
        if (trip.customer_pieces) setCustomerPieces(trip.customer_pieces);
        if (trip.customer_freight) setCustomerFreight(trip.customer_freight);
      })
      .catch(() => toast.error("Failed to load trip data"));
  }, [editTripId]);

  return (
    <form
      onSubmit={handleSubmit}
      style={styles.form}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      <div ref={topRef} />
      <h2 style={styles.heading}>
        {editTripId ? `Edit Trip #${editTripId}` : "New Trip Entry"}
      </h2>

      {/* ── 1. Truck ── */}
      <Section title="1. Truck & Driver">
        <Row>
          <Field label="Truck Number *">
            <select
              name="truck_id"
              value={form.truck_id}
              onChange={handleChange}
              style={styles.input}
              required
              onKeyDown={handleEnter}
            >
              <option value="">Select truck</option>
              {trucks.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.truck_number}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Driver Name">
            <input
              value={selectedTruck?.driver_name || "—"}
              readOnly
              style={styles.readOnly}
            />
          </Field>
          <Field label="Truck Avg (km/L)">
            <input
              value={truckAvg ? `${truckAvg} km/L` : "—"}
              readOnly
              style={{
                ...styles.readOnly,
                color: truckAvg ? "#1a3a5c" : "#aaa",
                fontWeight: 600,
              }}
            />
          </Field>
        </Row>
      </Section>

      {/* ── 2. Source (multi-select) ── */}
      <Section title="2. Source(s) *">
        <Field label="From (Source) — select one or more *">
          <SourceSearchInput
            sources={sources}
            selectedIds={form.source_ids}
            onToggle={toggleSource}
          />
          {selectedSources.length === 0 && (
            <span style={{ fontSize: 11, color: "#e07000", marginTop: 4 }}>
              Search and select at least one source
            </span>
          )}
        </Field>

        {/* Show selected sources summary */}
        {selectedSources.length > 0 && (
          <div style={{ marginTop: 6 }}>
            {selectedSources.map((s, i) => (
              <div
                key={s.id}
                style={{
                  background: i === 0 ? "#e8f0fe" : "#f5f5f5",
                  border: `1px solid ${i === 0 ? "#a8c0e8" : "#d0d0d0"}`,
                  borderRadius: 6,
                  padding: "8px 12px",
                  marginBottom: 6,
                  fontSize: 13,
                }}
              >
                <b>{i === 0 ? "🥇 Primary" : `#${i + 1}`}:</b> {s.name}
                {s.address && (
                  <span style={{ color: "#666", marginLeft: 8 }}>
                    — {s.address}
                  </span>
                )}
              </div>
            ))}
          </div>
        )}
      </Section>

      {/* ── 3. Trip Details ── */}
      <Section title="3. Trip Details">
        <Row>
          <NepaliDatePicker
            label="Start Date *"
            value={startBS}
            onChange={setStartBS}
            required
            onKeyDown={handleEnter}
          />
          <NepaliDatePicker
            label="End Date"
            value={endBS}
            onChange={setEndBS}
            onKeyDown={handleEnter}
          />
        </Row>
        {numDays && (
          <InfoBox color="#e8f0fe" border="#a8c0e8">
            🗓 Trip duration:{" "}
            <b>
              {numDays} day{numDays > 1 ? "s" : ""}
            </b>
            &nbsp;({formatBS(startBS)} → {formatBS(endBS)})
          </InfoBox>
        )}

        <Field label="Customer(s) (Destination) *">
          <CustomerSearchInput
            customers={customers}
            selectedIds={form.customer_ids}
            onToggle={toggleCustomer}
            onCustomerCreated={handleCustomerCreated}
          />
          {selectedCustomers.length === 0 && (
            <span style={{ fontSize: 11, color: "#e07000", marginTop: 4 }}>
              Search and select one or more customers
            </span>
          )}
        </Field>

        {selectedCustomers.map((c, i) => (
          <div
            key={c.id}
            style={{
              background: i === 0 ? "#e8f5e9" : "#f5f5f5",
              border: `1px solid ${i === 0 ? "#a5d6a7" : "#d0d0d0"}`,
              borderRadius: 6,
              padding: "10px 14px",
              margin: "8px 0 6px",
            }}
          >
            <div style={{ fontSize: 13, marginBottom: 8 }}>
              <b>
                {i === 0 ? "🥇 Primary" : `#${i + 1}`}: {c.name}
              </b>
              &nbsp;— {c.destination_address?.trim() || "⚠ Address not set"}
              &nbsp;&nbsp;<b>Dhuwani Rate:</b> {fmt(c.freight_dhuwwani)}
              {c.avg_rate_per_piece && (
                <span style={{ fontSize: 11, color: "#2a6098", marginLeft: 8 }}>
                  Avg NPR {Number(c.avg_rate_per_piece).toLocaleString()}/piece
                  ({c.piece_trip_count} trips)
                </span>
              )}
            </div>
            <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
              <div
                style={{
                  display: "flex",
                  flexDirection: "column",
                  flex: 1,
                  minWidth: 140,
                }}
              >
                <label
                  style={{
                    fontSize: 11,
                    color: "#555",
                    marginBottom: 3,
                    fontWeight: 500,
                  }}
                >
                  Pieces Delivered
                </label>
                <input
                  type="number"
                  value={customerPieces[c.id] || ""}
                  onChange={(e) =>
                    setCustomerPieces((p) => ({ ...p, [c.id]: e.target.value }))
                  }
                  onKeyDown={handleEnter}
                  style={styles.input}
                  placeholder="e.g. 500"
                />
              </div>
              {i > 0 && (
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    flex: 1,
                    minWidth: 140,
                  }}
                >
                  <label
                    style={{
                      fontSize: 11,
                      color: "#555",
                      marginBottom: 3,
                      fontWeight: 500,
                    }}
                  >
                    Freight Amount (NPR)
                  </label>
                  <input
                    type="number"
                    value={customerFreight[c.id] || ""}
                    onChange={(e) =>
                      setCustomerFreight((p) => ({
                        ...p,
                        [c.id]: e.target.value,
                      }))
                    }
                    onKeyDown={handleEnter}
                    style={styles.input}
                    placeholder="e.g. 15000"
                  />
                </div>
              )}
              {customerPieces[c.id] &&
                (i === 0 ? form.freight_amount : customerFreight[c.id]) && (
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      flex: 1,
                      minWidth: 140,
                    }}
                  >
                    <label
                      style={{
                        fontSize: 11,
                        color: "#555",
                        marginBottom: 3,
                        fontWeight: 500,
                      }}
                    >
                      Rate / Piece — Auto
                    </label>
                    <input
                      readOnly
                      value={`NPR ${(
                        (i === 0
                          ? parseFloat(form.freight_amount)
                          : parseFloat(customerFreight[c.id])) /
                        parseFloat(customerPieces[c.id])
                      ).toFixed(2)}/pc`}
                      style={{
                        ...styles.readOnly,
                        fontWeight: 600,
                        color: "#1a3a5c",
                      }}
                    />
                  </div>
                )}
            </div>
          </div>
        ))}

        {/* Freight amount for primary customer */}
        {selectedCustomers.length > 0 && (
          <Field label="Freight Amount — Primary Customer (NPR)">
            <input
              type="number"
              name="freight_amount"
              value={form.freight_amount}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="e.g. 30000"
            />
            {firstCustomer?.freight_dhuwwani && (
              <span
                style={{
                  fontSize: 11,
                  color: "#2a6098",
                  marginTop: 3,
                  fontStyle: "italic",
                }}
              >
                Dhuwani Rate from DB: NPR{" "}
                {Number(firstCustomer.freight_dhuwwani).toLocaleString()}
              </span>
            )}
          </Field>
        )}

        {/* Total freight box — only shown when 2+ customers */}
        {selectedCustomers.length > 1 && (
          <Field label="Total Freight — All Customers (Auto)">
            <input
              value={totalFreightDisplay ? fmt(totalFreightDisplay) : "—"}
              readOnly
              style={{
                ...styles.readOnly,
                fontWeight: 700,
                fontSize: 15,
                background: "#e8f5e9",
                color: "#1b5e20",
                border: "1px solid #a5d6a7",
              }}
            />
            <span style={{ fontSize: 11, color: "#555", marginTop: 3 }}>
              Primary ({fmt(parseFloat(form.freight_amount) || 0)})
              {(form.customer_ids || []).slice(1).map((id) => {
                const c = customers.find((x) => x.id === id);
                return c
                  ? ` + ${c.name.split(" ")[0]} (${fmt(parseFloat(customerFreight[id]) || 0)})`
                  : "";
              })}
            </span>
          </Field>
        )}
      </Section>

      {/* ── 4. MPP Bill ── */}
      <Section title="4. MPP Bill Number">
        <Field label="MPP Bill No.">
          <input
            type="text"
            name="mpp_bill_no"
            value={form.mpp_bill_no}
            onChange={handleChange}
            onKeyDown={handleEnter}
            style={styles.input}
            placeholder="e.g. 5531"
          />
        </Field>
      </Section>

      {/* ── 5. Odometer ── */}
      <Section title="5. Odometer Readings">
        <Row>
          <Field label="Starting KM (Meter Start)">
            <input
              type="number"
              name="meter_start"
              value={form.meter_start}
              onChange={handleChange}
              style={styles.input}
              onKeyDown={handleEnter}
              placeholder="e.g. 45820"
              step="0.01"
            />
          </Field>
          <Field label="Closing KM (Meter End)">
            <input
              type="number"
              name="meter_end"
              value={form.meter_end}
              onChange={handleChange}
              style={styles.input}
              onKeyDown={handleEnter}
              placeholder="e.g. 46270"
              step="0.01"
            />
          </Field>
          <Field label="Distance — Auto">
            <input
              value={
                distanceKm != null
                  ? `${distanceKm} km`
                  : meterStart && meterEnd && meterEnd <= meterStart
                    ? "⚠ End must be > Start"
                    : "—"
              }
              readOnly
              style={{
                ...styles.readOnly,
                background: distanceKm ? "#e8f5e9" : "#fff8e1",
                color: distanceKm ? "#1b5e20" : "#b45309",
                fontWeight: 600,
              }}
            />
          </Field>
        </Row>
      </Section>

      {/* ── 6. Diesel ── */}
      <Section title="6. Diesel">
        <Row>
          <Field label="Diesel Needed (L) — Auto">
            <input
              value={
                dieselNeeded != null
                  ? `${dieselNeeded} L`
                  : distanceKm && !truckAvg
                    ? "⚠ No truck avg set"
                    : "—"
              }
              readOnly
              style={{
                ...styles.readOnly,
                background: dieselNeeded ? "#e8f5e9" : "#f0f4f8",
                color: dieselNeeded ? "#1b5e20" : "#999",
                fontWeight: 600,
              }}
            />
          </Field>
          <Field label="Diesel Used (L) — Enter actual">
            <input
              type="number"
              name="diesel_used"
              value={form.diesel_used}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              step="0.01"
              placeholder="e.g. 148"
            />
          </Field>
        </Row>
        <Row>
          <Field label={`Diesel Cost — Auto (${DIESEL_PRICE}/L × used)`}>
            <input
              value={dieselCost != null ? fmt(dieselCost) : "—"}
              readOnly
              style={{ ...styles.readOnly, fontWeight: 600 }}
            />
          </Field>
          <Field label="Deviation (L) — Needed − Used">
            <input
              value={dieselDev != null ? `${dieselDev} L` : "—"}
              readOnly
              style={{
                ...styles.readOnly,
                fontWeight: 600,
                color:
                  dieselDev < 0
                    ? "#cc0000"
                    : dieselDev > 0
                      ? "#007700"
                      : "#555",
              }}
            />
          </Field>
        </Row>
      </Section>

      {/* ── 7. Allowances ── */}
      <Section title="7. Allowances — Auto">
        <Row>
          <Field label="Days">
            <input value={numDays ?? "—"} readOnly style={styles.readOnly} />
          </Field>
          <Field
            label={`Fooding (NPR ${FOODING_RATE}/day)`}
            hint="Edit to override auto"
          >
            <input
              type="number"
              name="fooding_override"
              value={form.fooding_override}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder={String(foodingAuto || 0)}
            />
          </Field>
          <Field label={`Trip Bhatta (NPR ${BHATTA_RATE}/trip)`}>
            <input
              type="number"
              name="trip_bhatta_override"
              value={form.trip_bhatta_override}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder={tripBhatta ? String(tripBhatta) : "0"}
            />
          </Field>
        </Row>
      </Section>

      {/* ── 8. Loading & Unloading ── */}
      <Section title="8. Loading & Unloading">
        <Row>
          <Field label="Loading Amount (NPR)">
            <input
              type="number"
              name="loading_amount"
              value={form.loading_amount}
              onChange={handleChange}
              style={styles.input}
              onKeyDown={handleEnter}
              placeholder="0"
            />
          </Field>
          <Field label="Unloading Amount (NPR)">
            <input
              type="number"
              name="unloading_amount"
              value={form.unloading_amount}
              onChange={handleChange}
              style={styles.input}
              onKeyDown={handleEnter}
              placeholder="0"
            />
          </Field>
        </Row>
      </Section>

      {/* ── 9. Maintenance ── */}
      <Section title="9. Maintenance">
        <Row>
          <Field
            label="Hisab Phanna (NPR)"
            hint="Scheduled / regular maintenance"
          >
            <input
              type="number"
              name="maintenance_hisab_phanna"
              value={form.maintenance_hisab_phanna}
              onChange={handleChange}
              style={styles.input}
              onKeyDown={handleEnter}
              placeholder="0"
            />
          </Field>
          <Field label="Cashbook (NPR)" hint="Breakdown / unplanned repair">
            <input
              type="number"
              name="maintenance_rokhar"
              value={form.maintenance_rokhar}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="0"
            />
          </Field>
        </Row>
      </Section>

      {/* ── 10. Other Expenses ── */}
      <Section title="10. Other Expenses">
        <Row>
          <Field label="Grease Expense (NPR)">
            <input
              type="number"
              name="grease_expense"
              value={form.grease_expense}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="0"
            />
          </Field>
          <Field label="Road Tax (NPR)">
            <input
              type="number"
              name="road_tax"
              value={form.road_tax}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="0"
            />
          </Field>
        </Row>
        <Row>
          <Field label="Tyre Expense (NPR)">
            <input
              type="number"
              name="tyre_expense"
              value={form.tyre_expense}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="0"
            />
          </Field>
          <Field label="Police Tax (NPR)">
            <input
              type="number"
              name="police_tax"
              value={form.police_tax}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="0"
            />
          </Field>
        </Row>
        <Row>
          <Field label="Phone Expense (NPR)">
            <input
              type="number"
              name="phone_expense"
              value={form.phone_expense}
              onChange={handleChange}
              onKeyDown={handleEnter}
              style={styles.input}
              placeholder="0"
            />
          </Field>
        </Row>
      </Section>

      {/* ── 11. Backload / Return ── */}
      <Section title="11. Backload / Return Trip">
        <Field label="Backload Supplier">
          <BackloadSupplierSelect
            backloads={backloads}
            value={form.backload_id}
            onChange={handleChange}
            onBackloadCreated={handleBackloadCreated}
            onKeyDown={handleEnter}
          />
        </Field>

        <Field label="Scrap Tax (NPR)" hint="Applied to backload / return">
          <input
            type="number"
            name="scrap_tax"
            value={form.scrap_tax}
            onChange={handleChange}
            onKeyDown={handleEnter}
            style={styles.input}
            placeholder="0"
          />
        </Field>

        {form.backload_id && (
          <>
            <Field label="Backload Bill No. (Optional)">
              <input
                type="text"
                name="backload_bill_no"
                value={form.backload_bill_no}
                onChange={handleChange}
                onKeyDown={handleEnter}
                style={styles.input}
                placeholder="e.g. BL-221"
              />
            </Field>
            <Row>
              <NepaliDatePicker
                label="Backload Start Date (Optional)"
                value={backloadStartBS}
                onChange={setBackloadStartBS}
                onKeyDown={handleEnter}
              />
              <NepaliDatePicker
                label="Backload End Date (Optional)"
                value={backloadEndBS}
                onChange={setBackloadEndBS}
                onKeyDown={handleEnter}
              />
            </Row>
            {backloadDays && (
              <InfoBox color="#e8f5e9" border="#a5d6a7">
                🗓 Backload duration:{" "}
                <b>
                  {backloadDays} day{backloadDays > 1 ? "s" : ""}
                </b>
              </InfoBox>
            )}
            <Row>
              <Field label="Backload Freight (NPR)">
                <input
                  type="number"
                  name="backload_freight_amount"
                  value={form.backload_freight_amount}
                  onChange={handleChange}
                  onKeyDown={handleEnter}
                  style={styles.input}
                  placeholder="e.g. 15000"
                />
              </Field>
              <Field label="Backload Loading (NPR)">
                <input
                  type="number"
                  name="backload_loading_amount"
                  value={form.backload_loading_amount}
                  onChange={handleChange}
                  onKeyDown={handleEnter}
                  style={styles.input}
                  placeholder="0"
                />
              </Field>
              <Field label="Backload Unloading (NPR)">
                <input
                  type="number"
                  name="backload_unloading_amount"
                  value={form.backload_unloading_amount}
                  onChange={handleChange}
                  onKeyDown={handleEnter}
                  style={styles.input}
                  placeholder="0"
                />
              </Field>
            </Row>
            <Row>
              <Field
                label={`Backload Fooding — Auto (${FOODING_RATE}/day)`}
                hint="Edit to override"
              >
                <input
                  type="number"
                  name="backload_fooding"
                  value={
                    form.backload_fooding !== ""
                      ? form.backload_fooding
                      : backloadFoodingAuto || ""
                  }
                  onChange={handleChange}
                  onKeyDown={handleEnter}
                  style={styles.input}
                  placeholder={String(backloadFoodingAuto || 0)}
                />
              </Field>
              <Field label="Backload Bhatta (NPR)" hint="Edit to override">
                <input
                  type="number"
                  name="backload_bhatta"
                  value={
                    form.backload_bhatta !== ""
                      ? form.backload_bhatta
                      : backloadStartAD
                        ? BHATTA_RATE
                        : ""
                  }
                  onChange={handleChange}
                  onKeyDown={handleEnter}
                  style={styles.input}
                  placeholder="1500"
                />
              </Field>
            </Row>
            <InfoBox color="#f0f6ff" border="#a8c0e8">
              <b>Effective Backload Freight:</b> {fmt(effectiveBackloadFreight)}
              &nbsp;&nbsp;
              <b>Backload Cash Expense:</b> {fmt(backloadCashExpense)}
              &nbsp;&nbsp;
              {form.backload_freight_amount && (
                <>
                  <b>Backload Surplus:</b> {fmt(backloadSurplus)}
                </>
              )}
            </InfoBox>
          </>
        )}
      </Section>

      {/* ── 12. Summary ── */}
      <Section title="12. Summary">
        <div style={styles.breakdown}>
          <div style={styles.breakdownTitle}>Expense Breakdown</div>
          <div style={styles.breakdownGrid}>
            <BLine label="Diesel Cost" value={fmt(dieselCost)} />
            <BLine label="Fooding" value={fmt(fooding)} />
            <BLine label="Trip Bhatta" value={fmt(effectiveBhatta)} />
            <BLine label="Loading" value={fmt(n("loading_amount") || null)} />
            <BLine
              label="Unloading"
              value={fmt(n("unloading_amount") || null)}
            />
            <BLine
              label="Maint. Hisab"
              value={fmt(n("maintenance_hisab_phanna") || null)}
            />
            <BLine
              label="Maint. Cashbook"
              value={fmt(n("maintenance_rokhar") || null)}
            />
            <BLine label="Grease" value={fmt(n("grease_expense") || null)} />
            <BLine label="Road Tax" value={fmt(n("road_tax") || null)} />
            <BLine label="Tyre" value={fmt(n("tyre_expense") || null)} />
            <BLine label="Police Tax" value={fmt(n("police_tax") || null)} />
            <BLine label="Phone" value={fmt(n("phone_expense") || null)} />
            {n("scrap_tax") > 0 && (
              <BLine
                label="Scrap Tax (BL)"
                value={fmt(n("scrap_tax") || null)}
              />
            )}
            {form.backload_id && (
              <>
                <BLine
                  label="BL Fooding"
                  value={fmt(effectiveBackloadFooding || null)}
                />
                <BLine
                  label="BL Bhatta"
                  value={fmt(effectiveBackloadBhatta || null)}
                />
                <BLine
                  label="BL Loading"
                  value={fmt(n("backload_loading_amount") || null)}
                />
                <BLine
                  label="BL Unloading"
                  value={fmt(n("backload_unloading_amount") || null)}
                />
              </>
            )}
          </div>
          <div style={styles.breakdownTotal}>
            <span>
              Total Expenses{form.backload_id ? " (incl. Backload)" : ""}
            </span>
            <span style={{ fontWeight: 700 }}>
              {fmt(
                form.backload_id
                  ? totalExpenses + backloadCashExpense
                  : totalExpenses,
              )}
            </span>
          </div>
        </div>

        <Row>
          <Field label="Total Expenses — Auto">
            <input
              value={fmt(totalExpenses)}
              readOnly
              style={{ ...styles.readOnly, fontWeight: "bold", fontSize: 15 }}
            />
          </Field>
          <Field label="Total Cash Expense — Auto">
            <input
              value={fmt(totalCashExpenseWithBackload)}
              readOnly
              style={{
                ...styles.readOnly,
                fontWeight: "bold",
                fontSize: 15,
                color: "#1a3a5c",
                background: "#e8f0fe",
              }}
            />
          </Field>
          <Field label="Outward Surplus — Auto">
            <input
              value={surplus != null ? fmt(surplus) : "—"}
              readOnly
              style={{
                ...styles.readOnly,
                fontWeight: "bold",
                fontSize: 15,
                color:
                  surplus == null
                    ? "#555"
                    : surplus < 0
                      ? "#cc0000"
                      : "#007700",
              }}
            />
          </Field>
        </Row>

        {form.backload_id && (
          <Row>
            <Field label="Backload Surplus — Auto">
              <input
                value={backloadSurplus != null ? fmt(backloadSurplus) : "—"}
                readOnly
                style={{
                  ...styles.readOnly,
                  fontWeight: "bold",
                  fontSize: 15,
                  color:
                    backloadSurplus == null
                      ? "#555"
                      : backloadSurplus < 0
                        ? "#cc0000"
                        : "#007700",
                }}
              />
            </Field>
            <Field label="Net Surplus (Outward + Backload)">
              <input
                value={netSurplus != null ? fmt(netSurplus) : "—"}
                readOnly
                style={{
                  ...styles.readOnly,
                  fontWeight: "bold",
                  fontSize: 15,
                  background: "#1a3a5c",
                  color:
                    netSurplus == null
                      ? "#fff"
                      : netSurplus < 0
                        ? "#ffaaaa"
                        : "#aaffaa",
                }}
              />
            </Field>
          </Row>
        )}
      </Section>

      {/* ── Remarks ── */}
      <Section title="Remarks (Optional)">
        <textarea
          name="remarks"
          value={form.remarks}
          onKeyDown={handleEnter}
          onChange={handleChange}
          style={{ ...styles.input, height: 70, resize: "vertical" }}
          placeholder="Any notes..."
        />
      </Section>

      <button type="submit" disabled={submitting} style={styles.submitBtn}>
        {submitting
          ? editTripId
            ? "Updating..."
            : "Saving..."
          : editTripId
            ? "Update Trip"
            : "Save Trip Entry"}
      </button>
    </form>
  );
}

// ── Small layout helpers ─────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={styles.section}>
      <div style={styles.sectionTitle}>{title}</div>
      {children}
    </div>
  );
}
function Row({ children }) {
  return <div style={styles.row}>{children}</div>;
}
function Field({ label, hint, children }) {
  return (
    <div style={styles.field}>
      <label style={styles.label}>{label}</label>
      {children}
      {hint && <span style={styles.hint}>{hint}</span>}
    </div>
  );
}
function InfoBox({ children, color = "#e8f5e9", border = "#a5d6a7" }) {
  return (
    <div style={{ ...styles.infoBox, background: color, borderColor: border }}>
      {children}
    </div>
  );
}
function BLine({ label, value }) {
  return (
    <div style={styles.bline}>
      <span style={{ color: "#666" }}>{label}</span>
      <span>{value}</span>
    </div>
  );
}

// ── Styles ───────────────────────────────────────────────────
const styles = {
  form: {
    maxWidth: 860,
    margin: "0 auto",
    padding: "24px 16px",
    fontFamily: "'Segoe UI', sans-serif",
    color: "#222",
  },
  heading: {
    fontSize: 22,
    fontWeight: 700,
    marginBottom: 24,
    color: "#1a3a5c",
    borderBottom: "2px solid #1a3a5c",
    paddingBottom: 8,
  },
  section: {
    background: "#fff",
    border: "1px solid #d0dce8",
    borderRadius: 8,
    padding: "16px 20px",
    marginBottom: 14,
  },
  sectionTitle: {
    fontWeight: 600,
    fontSize: 12,
    color: "#1a3a5c",
    textTransform: "uppercase",
    letterSpacing: "0.06em",
    marginBottom: 12,
    borderBottom: "1px solid #e8eef4",
    paddingBottom: 6,
  },
  row: { display: "flex", gap: 12, flexWrap: "wrap" },
  field: {
    display: "flex",
    flexDirection: "column",
    flex: 1,
    minWidth: 180,
    marginBottom: 10,
  },
  label: { fontSize: 12, color: "#555", marginBottom: 4, fontWeight: 500 },
  hint: { fontSize: 11, color: "#999", marginTop: 3 },
  input: {
    padding: "8px 10px",
    border: "1px solid #c0ccd8",
    borderRadius: 5,
    fontSize: 14,
    width: "100%",
    boxSizing: "border-box",
  },
  readOnly: {
    padding: "8px 10px",
    border: "1px solid #d0dce8",
    borderRadius: 5,
    background: "#f4f7fa",
    fontSize: 14,
    color: "#555",
  },
  infoBox: {
    padding: "10px 14px",
    borderRadius: 6,
    border: "1px solid",
    fontSize: 13,
    margin: "8px 0 14px",
    color: "#222",
  },
  breakdown: {
    border: "1px solid #c0ccd8",
    borderRadius: 6,
    padding: 14,
    background: "#fafbfc",
    marginBottom: 16,
  },
  breakdownTitle: {
    fontWeight: 600,
    fontSize: 13,
    color: "#1a3a5c",
    marginBottom: 10,
  },
  breakdownGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
    gap: "6px 16px",
    fontSize: 12,
  },
  bline: {
    display: "flex",
    justifyContent: "space-between",
    borderBottom: "1px dashed #e2e8f0",
    paddingBottom: 3,
  },
  breakdownTotal: {
    display: "flex",
    justifyContent: "space-between",
    marginTop: 12,
    paddingTop: 8,
    borderTop: "1px solid #1a3a5c",
    fontWeight: 600,
    fontSize: 13,
    color: "#1a3a5c",
  },
  submitBtn: {
    width: "100%",
    padding: "12px",
    background: "#1a3a5c",
    color: "#fff",
    border: "none",
    borderRadius: 6,
    fontSize: 16,
    fontWeight: 600,
    cursor: "pointer",
    marginTop: 10,
  },
  tagRow: { display: "flex", flexWrap: "wrap", gap: 6, marginBottom: 8 },
  tag: {
    display: "flex",
    alignItems: "center",
    gap: 5,
    background: "#1a3a5c",
    color: "#fff",
    borderRadius: 20,
    padding: "4px 10px 4px 8px",
    fontSize: 12.5,
  },
  primaryDot: {
    width: 7,
    height: 7,
    borderRadius: "50%",
    background: "#ffd700",
    flexShrink: 0,
  },
  tagRemove: {
    background: "none",
    border: "none",
    color: "#fff",
    cursor: "pointer",
    fontSize: 16,
    lineHeight: 1,
    padding: "0 0 0 2px",
    opacity: 0.75,
  },
  searchWrap: {
    position: "relative",
    display: "flex",
    alignItems: "center",
    width: "100%",
  },
  clearBtn: {
    position: "absolute",
    right: 8,
    background: "none",
    border: "none",
    color: "#999",
    cursor: "pointer",
    fontSize: 18,
    lineHeight: 1,
    padding: 0,
  },
  dropdown: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #c0ccd8",
    borderRadius: 6,
    boxShadow: "0 4px 16px rgba(0,0,0,0.12)",
    zIndex: 999,
    maxHeight: 220,
    overflowY: "auto",
  },
  dropdownItem: {
    padding: "9px 12px",
    cursor: "pointer",
    display: "flex",
    flexDirection: "column",
    gap: 2,
    borderBottom: "1px solid #f0f4f8",
  },
  dropdownSub: { fontSize: 11, color: "#888" },
  dropdownEmpty: {
    padding: "10px 12px",
    fontSize: 12.5,
    color: "#aaa",
    textAlign: "center",
  },
};

const addFormStyles = {
  wrap: {
    position: "absolute",
    top: "calc(100% + 4px)",
    left: 0,
    right: 0,
    background: "#fff",
    border: "1px solid #c0ccd8",
    borderRadius: 8,
    boxShadow: "0 4px 20px rgba(0,0,0,0.14)",
    zIndex: 999,
    padding: "14px 16px",
  },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 12,
    borderBottom: "1px solid #e8eef4",
    paddingBottom: 8,
  },
  title: { fontWeight: 700, fontSize: 13, color: "#1a3a5c" },
  closeBtn: {
    background: "none",
    border: "none",
    cursor: "pointer",
    fontSize: 16,
    color: "#999",
    padding: 0,
  },
  fieldWrap: { display: "flex", flexDirection: "column", marginBottom: 10 },
  label: { fontSize: 11, color: "#555", marginBottom: 4, fontWeight: 500 },
  error: {
    fontSize: 12,
    color: "#cc0000",
    marginBottom: 8,
    background: "#fff0f0",
    padding: "6px 10px",
    borderRadius: 4,
  },
  actions: {
    display: "flex",
    gap: 8,
    justifyContent: "flex-end",
    marginTop: 4,
  },
  cancelBtn: {
    padding: "7px 16px",
    background: "#f0f0f0",
    border: "1px solid #ccc",
    borderRadius: 5,
    fontSize: 13,
    cursor: "pointer",
  },
  saveBtn: {
    padding: "7px 16px",
    background: "#1a3a5c",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    fontSize: 13,
    fontWeight: 600,
    cursor: "pointer",
  },
};