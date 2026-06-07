import React, { useState, useEffect } from "react";
import {
  getTrips,
  getTrucks,
  getCustomers,
  getBackloads,
  verifyTrip,
  getExportUrl,
} from "../api";
import NepaliDatePicker from "./NepaliDatePicker";
import { adToBS, formatBSShort, bsToADString } from "../nepaliDate";
import toast from "react-hot-toast";

const STATUS_COLOR = {
  open: { bg: "#fff3cd", color: "#856404" },
  completed: { bg: "#d1ecf1", color: "#0c5460" },
  verified: { bg: "#d4edda", color: "#155724" },
};

const ALL_COLS = [
  { key: "id", label: "#", always: true },
  { key: "truck_number", label: "Truck", always: true },
  { key: "driver_name", label: "Driver" },
  { key: "source_name", label: "Source" },
  { key: "customer_name", label: "Customer", always: true },
  { key: "start_date", label: "Start (BS)", always: true },
  { key: "end_date", label: "End (BS)" },
  { key: "num_days", label: "Days" },
  { key: "meter_start", label: "Meter Start" },
  { key: "meter_end", label: "Meter End" },
  { key: "distance_km", label: "KM" },
  { key: "diesel_needed", label: "D.Needed" },
  { key: "diesel_used", label: "D.Used" },
  { key: "diesel_deviation", label: "D.Dev" },
  { key: "diesel_cost", label: "Diesel Cost" },
  { key: "fooding", label: "Fooding" },
  { key: "trip_bhatta", label: "Bhatta" },
  { key: "loading_amount", label: "Loading" },
  { key: "unloading_amount", label: "Unloading" },
  { key: "maintenance_hisab_phanna", label: "Maint.Hisab" },
  { key: "maintenance_rokhar", label: "Maint.Rokhar" },
  { key: "grease_expense", label: "Grease" },
  { key: "road_tax", label: "Road Tax" },
  { key: "scrap_tax", label: "Scrap Tax" },
  { key: "tyre_expense", label: "Tyre" },
  { key: "total_expenses", label: "Total Exp", always: true },
  { key: "freight_amount", label: "Freight", always: true },
  { key: "backload_freight_amount", label: "Backload Freight" },
  { key: "surplus", label: "Surplus", always: true },
  { key: "backload_description", label: "Backload" },
  { key: "status", label: "Status", always: true },
  { key: "_actions", label: "Actions", always: true },
];

const DEFAULT_VISIBLE = new Set([
  "id",
  "truck_number",
  "customer_name",
  "start_date",
  "end_date",
  "num_days",
  "meter_start",
  "meter_end",
  "distance_km",
  "diesel_cost",
  "fooding",
  "trip_bhatta",
  "loading_amount",
  "unloading_amount",
  "maintenance_hisab_phanna",
  "maintenance_rokhar",
  "grease_expense",
  "road_tax",
  "scrap_tax",
  "tyre_expense",
  "total_expenses",
  "freight_amount",
  "surplus",
  "status",
  "_actions",
]);

export default function AdminTrips({ onEdit }) {
  const [trips, setTrips] = useState([]);
  const [trucks, setTrucks] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [backloads, setBackloads] = useState([]);
  const [loading, setLoading] = useState(true);
  const [visibleCols, setVisibleCols] = useState(DEFAULT_VISIBLE);
  const [showColPicker, setShowColPicker] = useState(false);
  const [customerPopup, setCustomerPopup] = useState(null);
  const [filters, setFilters] = useState({
    truck_id: "",
    status: "",
    from_date: { year: "", month: "", day: "" },
    to_date: { year: "", month: "", day: "" },
    customer_id: "",
    backload_supplier_id: "",
  });

  const load = async () => {
    setLoading(true);
    try {
      const backendFilters = {
        truck_id: filters.truck_id,
        customer_id: filters.customer_id,
        status: filters.status,
        backload_supplier_id: filters.backload_supplier_id,
      };

      // 1. Convert From Date
      if (
        filters.from_date?.year &&
        filters.from_date?.month &&
        filters.from_date?.day
      ) {
        // If bsToADString takes (year, month, day):
        backendFilters.from_date = bsToADString(
          Number(filters.from_date.year),
          Number(filters.from_date.month),
          Number(filters.from_date.day),
        );

        // ALTERNATIVE: If your utility expects a string like "2083-04-15", uncomment below:
        // const bsStr = `${filters.from_date.year}-${String(filters.from_date.month).padStart(2, '0')}-${String(filters.from_date.day).padStart(2, '0')}`;
        // backendFilters.from_date = bsToADString(bsStr);
      }

      // 2. Convert To Date
      if (
        filters.to_date?.year &&
        filters.to_date?.month &&
        filters.to_date?.day
      ) {
        backendFilters.to_date = bsToADString(
          Number(filters.to_date.year),
          Number(filters.to_date.month),
          Number(filters.to_date.day),
        );
      }

      const cleanFilters = Object.fromEntries(
        Object.entries(backendFilters).filter(([, v]) => v),
      );

      let data = await getTrips(cleanFilters);
      setTrips(data);
    } catch (error) {
      toast.error("Failed to load trips");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    getTrucks().then(setTrucks);
    getCustomers().then(setCustomers);
    getBackloads().then(setBackloads);
  }, []);
  useEffect(() => {
    load();
  }, []);

  const handleFilter = (e) =>
    setFilters((f) => ({ ...f, [e.target.name]: e.target.value }));
  const clearFilters = () =>
    setFilters({
      truck_id: "",
      status: "",
      from_date: { year: "", month: "", day: "" },
      to_date: { year: "", month: "", day: "" },
      customer_id: "",
      backload_supplier_id: "",
    });
  useEffect(() => {
    load();
  }, [
    filters.truck_id,
    filters.status,
    filters.from_date,
    filters.to_date,
    filters.customer_id,
    filters.backload_supplier_id,
  ]);
  const toggleCol = (key) =>
    setVisibleCols((prev) => {
      const next = new Set(prev);
      next.has(key) ? next.delete(key) : next.add(key);
      return next;
    });

  const handleVerify = async (id) => {
    try {
      await verifyTrip(id);
      toast.success("Trip verified");
      load();
    } catch {
      toast.error("Failed to verify");
    }
  };

  const fmt = (n) =>
    n != null && n !== "" ? `NPR ${Number(n).toLocaleString()}` : "—";
  const fmtL = (n) => (n != null && n !== "" ? `${n} L` : "—");

  // Totals
  const sum = (key) => trips.reduce((a, t) => a + (parseFloat(t[key]) || 0), 0);
  const totals = {
    diesel_cost: sum("diesel_cost"),
    fooding: sum("fooding"),
    trip_bhatta: sum("trip_bhatta"),
    loading_amount: sum("loading_amount"),
    unloading_amount: sum("unloading_amount"),
    maintenance_hisab_phanna: sum("maintenance_hisab_phanna"),
    backload_freight_amount: sum("backload_freight_amount"),
    maintenance_rokhar: sum("maintenance_rokhar"),
    grease_expense: sum("grease_expense"),
    road_tax: sum("road_tax"),
    scrap_tax: sum("scrap_tax"),
    tyre_expense: sum("tyre_expense"),
    total_expenses: sum("total_expenses"),
    freight_amount: sum("freight_amount"),
    surplus: sum("surplus"),
  };

  const visibleColDefs = ALL_COLS.filter((c) => visibleCols.has(c.key));
  const activeFilters = Object.values(filters).filter((v) => v).length;

  // Cell renderer
  const renderCell = (col, t) => {
    switch (col.key) {
      case "id":
        return t.id;
      case "truck_number":
        return <b>{t.truck_number}</b>;
      case "driver_name":
        return t.driver_name || "—";
      case "source_name":
        return (
          <span title={t.source_name} style={styles.ellipsis}>
            {t.source_name}
          </span>
        );
      case "customer_name": {
        let extras = [];
        try {
          const raw = t.extra_customers;
          const arr = Array.isArray(raw)
            ? raw
            : typeof raw === "string"
              ? JSON.parse(raw)
              : [];
          extras = arr.filter((x) => x && x.name);
        } catch {
          extras = [];
        }
        const allNames = [t.customer_name, ...extras.map((c) => c.name)].filter(
          Boolean,
        );
        return (
          <span title={allNames.join(", ")} style={styles.ellipsis}>
            <span
              style={{
                overflow: "hidden",
                textOverflow: "ellipsis",
                whiteSpace: "nowrap",
              }}
            >
              {t.customer_name}
            </span>
            {extras.length > 0 && (
              <span
                onClick={(e) => {
                  e.stopPropagation();
                  setCustomerPopup(
                    customerPopup?.id === t.id
                      ? null
                      : {
                          id: t.id,
                          names: allNames,
                          x: e.clientX,
                          y: e.clientY,
                        },
                  );
                }}
                style={{
                  fontSize: 10,
                  background: "#1a3a5c",
                  color: "#fff",
                  borderRadius: 10,
                  padding: "1px 6px",
                  flexShrink: 0,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                +{extras.length}
              </span>
            )}
          </span>
        );
      }
      case "start_date":
        return t.start_date ? formatBSShort(adToBS(t.start_date)) : "—";
      case "end_date":
        return t.end_date ? formatBSShort(adToBS(t.end_date)) : "—";
      case "num_days":
        return t.num_days ?? "—";
      case "meter_start":
        return t.meter_start != null
          ? Number(t.meter_start).toLocaleString()
          : "—";
      case "meter_end":
        return t.meter_end != null ? Number(t.meter_end).toLocaleString() : "—";
      case "distance_km":
        return t.distance_km != null ? (
          <span style={{ color: "#1a3a5c", fontWeight: 500 }}>
            {t.distance_km} km
          </span>
        ) : (
          "—"
        );
      case "diesel_needed":
        return fmtL(t.diesel_needed);
      case "diesel_used":
        return fmtL(t.diesel_used);
      case "diesel_deviation":
        return t.diesel_deviation != null ? (
          <span
            style={{
              color: t.diesel_deviation < 0 ? "red" : "green",
              fontWeight: 600,
            }}
          >
            {t.diesel_deviation} L
          </span>
        ) : (
          "—"
        );
      case "diesel_cost":
        return fmt(t.diesel_cost);
      case "fooding":
        return fmt(t.fooding);
      case "trip_bhatta":
        return fmt(t.trip_bhatta);
      case "loading_amount":
        return fmt(t.loading_amount ?? t.loading_unloading / 2);
      case "unloading_amount":
        return fmt(t.unloading_amount ?? t.loading_unloading / 2);
      case "maintenance_hisab_phanna":
        return fmt(t.maintenance_hisab_phanna);
      case "maintenance_rokhar":
        return fmt(t.maintenance_rokhar);
      case "grease_expense":
        return fmt(t.grease_expense);
      case "road_tax":
        return fmt(t.road_tax);
      case "scrap_tax":
        return fmt(t.scrap_tax);
      case "tyre_expense":
        return fmt(t.tyre_expense);
      case "backload_freight_amount":
        return fmt(t.backload_freight_amount);
      case "total_expenses":
        return <b>{fmt(t.total_expenses)}</b>;
      case "freight_amount":
        return fmt(t.freight_amount);
      case "surplus":
        return (
          <b style={{ color: t.surplus < 0 ? "#cc0000" : "#007700" }}>
            {fmt(t.surplus)}
          </b>
        );
      case "backload_description":
        return (
          <span title={t.backload_description} style={styles.ellipsis}>
            {t.backload_description || "—"}
          </span>
        );
      case "status": {
        const sc = STATUS_COLOR[t.status] || {};
        return (
          <span style={{ ...styles.badge, background: sc.bg, color: sc.color }}>
            {t.status}
          </span>
        );
      }
      case "_actions":
        return (
          <div style={{ display: "flex", gap: 4 }}>
            <button onClick={() => onEdit(t.id)} style={styles.editBtn}>
              Edit
            </button>
            {t.status !== "verified" && (
              <button
                onClick={() => handleVerify(t.id)}
                style={styles.verifyBtn}
              >
                ✓
              </button>
            )}
          </div>
        );
      default:
        return "—";
    }
  };

  // Footer cell
  const renderFooter = (col) => {
    const moneyKeys = [
      "diesel_cost",
      "fooding",
      "trip_bhatta",
      "loading_amount",
      "unloading_amount",
      "maintenance_hisab_phanna",
      "maintenance_rokhar",
      "grease_expense",
      "road_tax",
      "scrap_tax",
      "backload_freight_amount",
      "tyre_expense",
      "total_expenses",
      "freight_amount",
      "surplus",
    ];
    if (!moneyKeys.includes(col.key)) return null;
    const val = totals[col.key];
    return (
      <span
        style={{
          fontWeight: 700,
          color:
            col.key === "surplus" ? (val < 0 ? "#ffaaaa" : "#aaffaa") : "#fff",
        }}
      >
        {fmt(val)}
      </span>
    );
  };

  return (
    <div style={styles.container}>
      {/* ── Header ── */}
      <div style={styles.header}>
        <div>
          <h2 style={styles.heading}>All Trips</h2>
          <p style={styles.subtext}>
            {trips.length} trip{trips.length !== 1 ? "s" : ""} shown
          </p>
        </div>
        <div style={{ display: "flex", gap: 8 }}>
          <button
            onClick={() => setShowColPicker((v) => !v)}
            style={styles.colBtn}
          >
            ☰ Columns
          </button>
          <a
            href={getExportUrl(
              Object.fromEntries(Object.entries(filters).filter(([, v]) => v)),
            )}
            style={styles.exportBtn}
            download
          >
            ⬇ Export Excel
          </a>
        </div>
      </div>

      {/* ── Column picker ── */}
      {showColPicker && (
        <div style={styles.colPicker}>
          <div style={styles.colPickerTitle}>Toggle Columns</div>
          <div style={styles.colPickerGrid}>
            {ALL_COLS.filter((c) => !c.always && c.key !== "_actions").map(
              (c) => (
                <label key={c.key} style={styles.colPickerLabel}>
                  <input
                    type="checkbox"
                    checked={visibleCols.has(c.key)}
                    onChange={() => toggleCol(c.key)}
                    style={{ marginRight: 5 }}
                  />
                  {c.label}
                </label>
              ),
            )}
          </div>
        </div>
      )}
      <div style={styles.filterRow}>
        {/* ── Filters ── */}
        <div style={styles.filterBox}>
          <div style={styles.filterRow}>
            <FilterGroup label="Truck">
              <select
                name="truck_id"
                value={filters.truck_id}
                onChange={handleFilter}
                style={styles.filterInput}
              >
                <option value="">All Trucks</option>
                {trucks.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.truck_number} — {t.driver_name || "—"}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Customer">
              <select
                name="customer_id"
                value={filters.customer_id}
                onChange={handleFilter}
                style={styles.filterInput}
              >
                <option value="">All Customers</option>
                {customers.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Backload Supplier">
              <select
                name="backload_supplier_id"
                value={filters.backload_supplier_id}
                onChange={handleFilter}
                style={styles.filterInput}
              >
                <option value="">All Suppliers</option>
                {backloads.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.description}
                  </option>
                ))}
              </select>
            </FilterGroup>
            <FilterGroup label="Status">
              <select
                name="status"
                value={filters.status}
                onChange={handleFilter}
                style={styles.filterInput}
              >
                <option value="">All</option>
                <option value="open">Open</option>
                <option value="completed">Completed</option>
                <option value="verified">Verified</option>
              </select>
            </FilterGroup>
          </div>
          <div style={{ ...styles.filterRow, marginTop: 10 }}>
            <FilterGroup label="From Date (BS)">
              <NepaliDatePicker
                value={filters.from_date || { year: "", month: "", day: "" }}
                onChange={(bs) => setFilters((f) => ({ ...f, from_date: bs }))}
              />
            </FilterGroup>
            <FilterGroup label="To Date (BS)">
              <NepaliDatePicker
                value={filters.to_date || { year: "", month: "", day: "" }}
                onChange={(bs) => setFilters((f) => ({ ...f, to_date: bs }))}
              />
            </FilterGroup>
            <div
              style={{
                display: "flex",
                gap: 8,
                alignItems: "flex-end",
                paddingBottom: 2,
              }}
            >
              <button onClick={load} style={styles.filterBtn}>
                🔍 Apply
              </button>
              {activeFilters > 0 && (
                <button onClick={clearFilters} style={styles.clearBtn}>
                  ✕ Clear ({activeFilters})
                </button>
              )}
            </div>
          </div>

        </div>
      </div>

      {/* ── Summary pills ── */}
      {trips.length > 0 && (
        <div style={styles.pills}>
          <Pill label="Total Expenses" value={fmt(totals.total_expenses)} />
          <Pill label="Total Freight" value={fmt(totals.freight_amount)} />
          <Pill
            label="Total Surplus"
            value={fmt(totals.surplus)}
            bold
            color={totals.surplus < 0 ? "#cc0000" : "#007700"}
          />
          <Pill label="Diesel Cost" value={fmt(totals.diesel_cost)} />
          <Pill
            label="Maintenance"
            value={fmt(
              totals.maintenance_hisab_phanna + totals.maintenance_rokhar,
            )}
          />
          <Pill
            label="Road+Scrap Tax"
            value={fmt(totals.road_tax + totals.scrap_tax)}
          />
          <Pill label="Tyre" value={fmt(totals.tyre_expense)} />
        </div>
      )}

      {/* ── Table ── */}
      {loading ? (
        <p style={{ textAlign: "center", padding: 40, color: "#888" }}>
          Loading trips...
        </p>
      ) : trips.length === 0 ? (
        <p style={{ textAlign: "center", padding: 40, color: "#888" }}>
          No trips found.
        </p>
      ) : (
        <div style={styles.tableWrap}>
          <table style={styles.table}>
            <thead>
              <tr style={styles.thead}>
                {visibleColDefs.map((c) => (
                  <th key={c.key} style={styles.th}>
                    {c.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {[...trips]
                .sort((a, b) => {
                  // Sorts by start_date ascending so matching dates group together.
                  // Change to b.start_date.localeCompare(a.start_date) for descending.
                  if (!a.start_date) return 1;
                  if (!b.start_date) return -1;
                  return a.start_date.localeCompare(b.start_date);
                })
                .map((t, i) => (
                  <tr
                    key={t.id}
                    style={{ background: i % 2 === 0 ? "#fff" : "#f7fafd" }}
                  >
                    {visibleColDefs.map((c) => (
                      <td key={c.key} style={styles.td}>
                        {renderCell(c, t)}
                      </td>
                    ))}
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr style={{ background: "#1a3a5c" }}>
                {visibleColDefs.map((c) => (
                  <td key={c.key} style={styles.tfoot}>
                    {renderFooter(c)}
                  </td>
                ))}
              </tr>
            </tfoot>
          </table>
        </div>
      )}
      {customerPopup && (
        <div
          onClick={() => setCustomerPopup(null)}
          style={{
            position: "fixed",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            zIndex: 998,
          }}
        />
      )}
      {customerPopup && (
        <div
          style={{
            position: "fixed",
            top: customerPopup.y + 8,
            left: customerPopup.x,
            background: "#fff",
            border: "1px solid #c0ccd8",
            borderRadius: 8,
            boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
            zIndex: 999,
            padding: "10px 14px",
            minWidth: 220,
          }}
        >
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#1a3a5c",
              marginBottom: 8,
              textTransform: "uppercase",
            }}
          >
            All Customers ({customerPopup.names.length})
          </div>
          {customerPopup.names.map((name, i) => (
            <div
              key={i}
              style={{
                fontSize: 13,
                padding: "4px 0",
                borderBottom: "1px dashed #e8eef4",
                display: "flex",
                alignItems: "center",
                gap: 6,
              }}
            >
              {i === 0 && (
                <span
                  style={{
                    fontSize: 9,
                    background: "#ffd700",
                    color: "#333",
                    borderRadius: 8,
                    padding: "1px 5px",
                    fontWeight: 700,
                  }}
                >
                  PRIMARY
                </span>
              )}
              {name}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function FilterGroup({ label, children }) {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        gap: 4,
        flex: 1,
        minWidth: 150,
      }}
    >
      <label
        style={{
          fontSize: 11,
          color: "#666",
          fontWeight: 600,
          textTransform: "uppercase",
        }}
      >
        {label}
      </label>
      {children}
    </div>
  );
}

function Pill({ label, value, bold, color }) {
  return (
    <div
      style={{
        background: "#fff",
        border: "1px solid #d0dce8",
        borderRadius: 8,
        padding: "8px 14px",
        minWidth: 110,
      }}
    >
      <div
        style={{
          fontSize: 10,
          color: "#999",
          textTransform: "uppercase",
          letterSpacing: "0.04em",
        }}
      >
        {label}
      </div>
      <div
        style={{
          fontWeight: bold ? 700 : 500,
          fontSize: 14,
          color: color || "#1a3a5c",
          marginTop: 2,
        }}
      >
        {value}
      </div>
    </div>
  );
}

const styles = {
  container: { padding: "0 4px", fontFamily: "'Segoe UI', sans-serif" },
  header: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 12,
  },
  heading: { fontSize: 20, fontWeight: 700, color: "#1a3a5c", margin: 0 },
  subtext: { fontSize: 12, color: "#888", margin: "4px 0 0" },
  exportBtn: {
    padding: "8px 14px",
    background: "#1a3a5c",
    color: "#fff",
    borderRadius: 6,
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 600,
  },
  colBtn: {
    padding: "8px 14px",
    background: "#f0f4f8",
    color: "#1a3a5c",
    border: "1px solid #c0ccd8",
    borderRadius: 6,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
  },
  colPicker: {
    background: "#fff",
    border: "1px solid #d0dce8",
    borderRadius: 8,
    padding: "14px 16px",
    marginBottom: 12,
  },
  colPickerTitle: {
    fontSize: 12,
    fontWeight: 700,
    color: "#555",
    marginBottom: 10,
    textTransform: "uppercase",
  },
  colPickerGrid: { display: "flex", flexWrap: "wrap", gap: "8px 20px" },
  colPickerLabel: {
    fontSize: 13,
    color: "#333",
    cursor: "pointer",
    display: "flex",
    alignItems: "center",
  },
  filterBox: {
    background: "#f7fafd",
    border: "1px solid #d0dce8",
    borderRadius: 8,
    padding: "12px 16px",
    marginBottom: 12,
  },
  filterRow: {
    display: "flex",
    gap: 10,
    flexWrap: "wrap",
    alignItems: "flex-end",
  },
  filterInput: {
    padding: "7px 10px",
    border: "1px solid #c0ccd8",
    borderRadius: 5,
    fontSize: 13,
    background: "#fff",
  },
  filterBtn: {
    padding: "8px 18px",
    background: "#1a3a5c",
    color: "#fff",
    border: "none",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 13,
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  clearBtn: {
    padding: "8px 14px",
    background: "#fff",
    color: "#cc4444",
    border: "1px solid #cc4444",
    borderRadius: 5,
    cursor: "pointer",
    fontSize: 13,
    whiteSpace: "nowrap",
  },
  pills: { display: "flex", gap: 8, marginBottom: 12, flexWrap: "wrap" },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #d0dce8",
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  thead: { background: "#1a3a5c" },
  th: {
    padding: "10px 10px",
    textAlign: "left",
    whiteSpace: "nowrap",
    fontWeight: 600,
    color: "#fff",
  },
  td: {
    padding: "7px 10px",
    borderBottom: "1px solid #e8eef4",
    whiteSpace: "nowrap",
  },
  tfoot: { padding: "8px 10px", color: "#fff", whiteSpace: "nowrap" },
  badge: {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  editBtn: {
    padding: "3px 8px",
    background: "#e8f0fe",
    border: "1px solid #a0b8e8",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
  },
  verifyBtn: {
    padding: "3px 8px",
    background: "#d4edda",
    border: "1px solid #a5d6a7",
    borderRadius: 4,
    cursor: "pointer",
    fontSize: 11,
    color: "#155724",
    fontWeight: 700,
  },
  ellipsis: {
    display: "flex",
    alignItems: "center",
    gap: 4,
    maxWidth: 180,
    overflow: "hidden",
  },
};
