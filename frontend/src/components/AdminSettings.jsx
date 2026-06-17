import React, { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import axios from "axios";
import toast from "react-hot-toast";


const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";
const api = axios.create({ baseURL: `${BASE_URL}/api` });

const DEFAULT_SETTINGS = {
  diesel_rate: 222.5,
  fooding_rate: 1000,
  bhatta_rate: 1500,
  freight_multiplier: 1.3,
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [rates, setRates] = useState([]);
  const [ratesLoading, setRatesLoading] = useState(true);
  const [rateSearch, setRateSearch] = useState("");
  // NEW: sources state
  const [sources, setSources] = useState([]);
  const [sourcesLoading, setSourcesLoading] = useState(true);
  const [sourceSearch, setSourceSearch] = useState("");

  useEffect(() => {
    api
      .get("/settings")
      .then((r) => setSettings({ ...DEFAULT_SETTINGS, ...r.data }))
      .catch(() => setSettings(DEFAULT_SETTINGS))
      .finally(() => setLoading(false));

    api
      .get("/customers/rates")
      .then((r) => setRates(r.data))
      .catch(() => setRates([]))
      .finally(() => setRatesLoading(false));

    // NEW: fetch sources with trip usage stats
    api
      .get("/sources")
      .then((r) => setSources(r.data))
      .catch(() => setSources([]))
      .finally(() => setSourcesLoading(false));
  }, []);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setSettings((s) => ({ ...s, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post("/settings", settings);
      toast.success("Settings saved! New trips will use updated rates.");
    } catch {
      localStorage.setItem("maruti_settings", JSON.stringify(settings));
      toast.success("Settings saved locally.");
    } finally {
      setSaving(false);
    }
  };

  const filteredRates = rates.filter(
    (r) =>
      r.name.toLowerCase().includes(rateSearch.toLowerCase()) ||
      (r.destination_address || "")
        .toLowerCase()
        .includes(rateSearch.toLowerCase()),
  );

  // NEW: filter sources
  const filteredSources = sources.filter(
    (s) =>
      s.name.toLowerCase().includes(sourceSearch.toLowerCase()) ||
      (s.address || "").toLowerCase().includes(sourceSearch.toLowerCase()),
  );

  const fmt = (n) => (n != null ? `NPR ${Number(n).toLocaleString()}` : "—");

  if (loading)
    return (
      <p style={{ padding: 40, color: "#888", textAlign: "center" }}>
        Loading settings...
      </p>
    );

  return (
    <div style={styles.container}>
      {/* ── Rate Settings ── */}
      <h2 style={styles.heading}>⚙️ Rate Settings</h2>
      <p style={styles.sub}>
        These rates are used for all new trip calculations. Existing trips are
        not affected.
      </p>

      <div style={styles.grid}>
        <SettingCard
          label="Diesel Rate"
          name="diesel_rate"
          value={settings.diesel_rate}
          onChange={handleChange}
          unit="NPR / Litre"
          note="Used to auto-calculate diesel cost from litres used"
          color="#1a3a5c"
        />
        <SettingCard
          label="Fooding Allowance"
          name="fooding_rate"
          value={settings.fooding_rate}
          onChange={handleChange}
          unit="NPR / Day"
          note="Multiplied by number of trip days"
          color="#2a6098"
        />
        <SettingCard
          label="Trip Bhatta"
          name="bhatta_rate"
          value={settings.bhatta_rate}
          onChange={handleChange}
          unit="NPR / Trip"
          note="Fixed per trip"
          color="#1b6ca8"
        />
        <SettingCard
          label="Freight Multiplier"
          name="freight_multiplier"
          value={settings.freight_multiplier}
          onChange={handleChange}
          unit="× actual"
          note="e.g. 1.3 means dhuwwani = actual × 1.3"
          color="#0d4f7c"
          step="0.01"
        />
      </div>

      <div style={styles.preview}>
        <h3 style={styles.previewTitle}>Preview with current rates</h3>
        <div style={styles.previewGrid}>
          <PreviewItem
            label="Diesel (100L trip)"
            value={`NPR ${(100 * settings.diesel_rate).toLocaleString()}`}
          />
          <PreviewItem
            label="Fooding (3 days)"
            value={`NPR ${(3 * settings.fooding_rate).toLocaleString()}`}
          />
          <PreviewItem
            label="Bhatta (3 days)"
            value={`NPR ${(3 * settings.bhatta_rate).toLocaleString()}`}
          />
          <PreviewItem
            label="Dhuwwani on 30,000"
            value={`NPR ${(30000 * settings.freight_multiplier).toLocaleString()}`}
          />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
        {saving ? "Saving..." : "💾 Save Settings"}
      </button>

      {/* ── Sources DB ── NEW SECTION ── */}
      <div style={styles.ratesSection}>
        <div style={styles.ratesHeader}>
          <div>
            <h2 style={styles.heading}>🗺️ Sources</h2>
            <p style={styles.sub}>
              All loading sources configured in the database. These appear in
              the trip form's multi-source selector.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search source..."
            value={sourceSearch}
            onChange={(e) => setSourceSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {sourcesLoading ? (
          <p style={{ color: "#888", fontSize: 13 }}>Loading sources...</p>
        ) : filteredSources.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 13 }}>No sources found.</p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>#</th>
                  <th style={styles.th}>Source Name</th>
                  <th style={styles.th}>Address</th>
                  <th style={styles.th}>Latitude</th>
                  <th style={styles.th}>Longitude</th>
                </tr>
              </thead>
              <tbody>
                {filteredSources.map((s, i) => (
                  <tr
                    key={s.id}
                    style={{ background: i % 2 === 0 ? "#fff" : "#f7fafd" }}
                  >
                    <td style={{ ...styles.td, color: "#999", width: 40 }}>
                      {s.id}
                    </td>
                    <td style={{ ...styles.td, fontWeight: 600 }}>
                      {s.name}
                    </td>
                    <td style={{ ...styles.td, color: "#666" }}>
                      {s.address || "—"}
                    </td>
                    <td style={{ ...styles.td, color: "#666", fontFamily: "monospace" }}>
                      {s.lat || "—"}
                    </td>
                    <td style={{ ...styles.td, color: "#666", fontFamily: "monospace" }}>
                      {s.lng || "—"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Sources summary pill */}
        {filteredSources.length > 0 && (
          <div style={{ ...styles.pills, marginBottom: 32 }}>
            <Pill
              label="Total sources"
              value={sources.length}
              sub="in database"
            />
          </div>
        )}
      </div>

      {/* ── Customer Freight Rates ── */}
      <div style={styles.ratesSection}>
        <div style={styles.ratesHeader}>
          <div>
            <h2 style={styles.heading}>📊 Customer Freight Rate Analysis</h2>
            <p style={styles.sub}>
              Avg multiplier = actual freight charged ÷ base rate, calculated
              from all trip history. Supervisors use this to spot under-billing
              or rate drift per customer.
            </p>
          </div>
          <input
            type="text"
            placeholder="Search customer..."
            value={rateSearch}
            onChange={(e) => setRateSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>

        {ratesLoading ? (
          <p style={{ color: "#888", fontSize: 13 }}>Loading rates...</p>
        ) : filteredRates.length === 0 ? (
          <p style={{ color: "#aaa", fontSize: 13 }}>
            No data yet. Rates are calculated as trips are entered.
          </p>
        ) : (
          <div style={styles.tableWrap}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.thead}>
                  <th style={styles.th}>Customer</th>
                  <th style={styles.th}>Destination</th>
                  <th style={styles.th}>Base Rate (NPR)</th>
                  <th style={styles.th}>Avg Multiplier</th>
                  <th style={styles.th}>Avg Charged (NPR)</th>
                  <th style={styles.th}>Trips</th>
                  <th style={styles.th}>Avg Rate/Piece</th>
                  <th style={styles.th}>Piece Trips</th>
                  <th style={styles.th}>Last Updated</th>
                  <th style={styles.th}>Status</th>
                </tr>
              </thead>
              <tbody>
                {filteredRates.map((r, i) => {
                  const mult = parseFloat(r.avg_rate_multiplier);
                  const hasData = r.rate_trip_count > 0;
                  const isLow = hasData && mult < 1.0;
                  const isHigh = hasData && mult > 1.5;
                  const multColor = !hasData
                    ? "#aaa"
                    : isLow
                      ? "#cc0000"
                      : isHigh
                        ? "#007700"
                        : "#1a3a5c";

                  return (
                    <tr
                      key={r.id}
                      style={{ background: i % 2 === 0 ? "#fff" : "#f7fafd" }}
                    >
                      <td
                        style={{ ...styles.td, fontWeight: 600, minWidth: 160 }}
                      >
                        {r.name}
                      </td>
                      <td
                        style={{ ...styles.td, color: "#666", minWidth: 160 }}
                      >
                        {r.destination_address || "—"}
                      </td>
                      <td style={styles.td}>{fmt(r.freight_actual)}</td>
                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 700,
                          color: multColor,
                        }}
                      >
                        {hasData ? `${mult.toFixed(3)}×` : "—"}
                      </td>
                      <td style={{ ...styles.td, fontWeight: 600 }}>
                        {hasData ? fmt(r.avg_freight_charged) : "—"}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        {r.rate_trip_count > 0 ? (
                          <span style={styles.tripBadge}>
                            {r.rate_trip_count}
                          </span>
                        ) : (
                          <span style={{ color: "#ccc" }}>0</span>
                        )}
                      </td>
                      <td
                        style={{
                          ...styles.td,
                          fontWeight: 600,
                          color: "#1a3a5c",
                        }}
                      >
                        {r.avg_rate_per_piece
                          ? `NPR ${Number(r.avg_rate_per_piece).toFixed(2)}/pc`
                          : "—"}
                      </td>
                      <td style={{ ...styles.td, textAlign: "center" }}>
                        {r.piece_trip_count > 0 ? (
                          <span style={styles.tripBadge}>
                            {r.piece_trip_count}
                          </span>
                        ) : (
                          <span style={{ color: "#ccc" }}>0</span>
                        )}
                      </td>
                      <td style={{ ...styles.td, color: "#999", fontSize: 11 }}>
                        {r.last_rate_updated
                          ? new Date(r.last_rate_updated).toLocaleDateString(
                              "en-IN",
                            )
                          : "—"}
                      </td>
                      <td style={styles.td}>
                        {!hasData ? (
                          <span
                            style={{
                              ...styles.badge,
                              background: "#f0f0f0",
                              color: "#aaa",
                            }}
                          >
                            No trips
                          </span>
                        ) : isLow ? (
                          <span
                            style={{
                              ...styles.badge,
                              background: "#fff0f0",
                              color: "#cc0000",
                            }}
                          >
                            ⚠ Under-billed
                          </span>
                        ) : isHigh ? (
                          <span
                            style={{
                              ...styles.badge,
                              background: "#f0fff0",
                              color: "#007700",
                            }}
                          >
                            ↑ Above avg
                          </span>
                        ) : (
                          <span
                            style={{
                              ...styles.badge,
                              background: "#e8f0fe",
                              color: "#1a3a5c",
                            }}
                          >
                            ✓ Normal
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        {/* Summary pills */}
        {filteredRates.length > 0 && (
          <div style={styles.pills}>
            <Pill
              label="Customers tracked"
              value={rates.filter((r) => r.rate_trip_count > 0).length}
              sub={`of ${rates.length} total`}
            />
            <Pill
              label="Avg multiplier (all)"
              value={
                rates.filter((r) => r.avg_rate_multiplier).length
                  ? (
                      rates
                        .filter((r) => r.avg_rate_multiplier)
                        .reduce(
                          (a, r) => a + parseFloat(r.avg_rate_multiplier),
                          0,
                        ) / rates.filter((r) => r.avg_rate_multiplier).length
                    ).toFixed(3) + "×"
                  : "—"
              }
              sub="across all customers"
            />
            <Pill
              label="Under-billed customers"
              value={
                rates.filter(
                  (r) =>
                    r.avg_rate_multiplier &&
                    parseFloat(r.avg_rate_multiplier) < 1.0,
                ).length
              }
              sub="multiplier < 1.0"
              alert
            />
          </div>
        )}

        <CreateUserForm />
      </div>
    </div>
  );
}

// ── Small components ─────────────────────────────────────────
function SettingCard({
  label,
  name,
  value,
  onChange,
  unit,
  note,
  color,
  step = "0.5",
}) {
  return (
    <div style={{ ...styles.card, borderTop: `4px solid ${color}` }}>
      <div style={styles.cardLabel}>{label}</div>
      <div style={styles.cardInputRow}>
        <input
          type="number"
          name={name}
          value={value}
          onChange={onChange}
          step={step}
          style={styles.cardInput}
        />
        <span style={styles.cardUnit}>{unit}</span>
      </div>
      <div style={styles.cardNote}>{note}</div>
    </div>
  );
}

function PreviewItem({ label, value }) {
  return (
    <div style={styles.previewItem}>
      <div style={styles.previewLabel}>{label}</div>
      <div style={styles.previewValue}>{value}</div>
    </div>
  );
}

function Pill({ label, value, sub, alert }) {
  return (
    <div
      style={{
        ...styles.pill,
        borderColor: alert && value > 0 ? "#ffcccc" : "#d0dce8",
        background: alert && value > 0 ? "#fff0f0" : "#fff",
      }}
    >
      <div style={styles.pillLabel}>{label}</div>
      <div
        style={{
          ...styles.pillValue,
          color: alert && value > 0 ? "#cc0000" : "#1a3a5c",
        }}
      >
        {value}
      </div>
      {sub && <div style={styles.pillSub}>{sub}</div>}
    </div>
  );
}

const styles = {
  container: {
    maxWidth: 1100,
    margin: "0 auto",
    padding: "0 4px",
    fontFamily: "'Segoe UI', sans-serif",
  },
  heading: { fontSize: 20, fontWeight: 700, color: "#1a3a5c", marginBottom: 4 },
  sub: { color: "#666", fontSize: 13, marginBottom: 24 },
  grid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
    gap: 16,
    marginBottom: 24,
  },
  card: {
    background: "#fff",
    border: "1px solid #d0dce8",
    borderRadius: 8,
    padding: 16,
  },
  cardLabel: {
    fontWeight: 600,
    fontSize: 13,
    color: "#1a3a5c",
    marginBottom: 10,
  },
  cardInputRow: {
    display: "flex",
    alignItems: "center",
    gap: 8,
    marginBottom: 8,
  },
  cardInput: {
    flex: 1,
    padding: "8px 10px",
    border: "1px solid #c0ccd8",
    borderRadius: 5,
    fontSize: 16,
    fontWeight: 700,
    color: "#1a3a5c",
  },
  cardUnit: { fontSize: 11, color: "#888", whiteSpace: "nowrap" },
  cardNote: { fontSize: 11, color: "#999", lineHeight: 1.4 },
  preview: {
    background: "#f0f4f8",
    border: "1px solid #d0dce8",
    borderRadius: 8,
    padding: 16,
    marginBottom: 24,
  },
  previewTitle: {
    fontSize: 13,
    fontWeight: 600,
    color: "#555",
    marginBottom: 12,
  },
  previewGrid: {
    display: "grid",
    gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
    gap: 12,
  },
  previewItem: {
    background: "#fff",
    borderRadius: 6,
    padding: "10px 14px",
    border: "1px solid #d0dce8",
  },
  previewLabel: { fontSize: 11, color: "#888", marginBottom: 4 },
  previewValue: { fontSize: 15, fontWeight: 700, color: "#1a3a5c" },
  saveBtn: {
    width: "100%",
    padding: 14,
    background: "#1a3a5c",
    color: "#fff",
    fontSize: 15,
    fontWeight: 700,
    border: "none",
    borderRadius: 8,
    cursor: "pointer",
    marginBottom: 40,
  },
  ratesSection: { borderTop: "2px solid #e8eef4", paddingTop: 32, marginBottom: 8 },
  ratesHeader: {
    display: "flex",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  searchInput: {
    padding: "8px 12px",
    border: "1px solid #c0ccd8",
    borderRadius: 6,
    fontSize: 13,
    minWidth: 220,
  },
  tableWrap: {
    overflowX: "auto",
    borderRadius: 8,
    border: "1px solid #d0dce8",
    marginBottom: 16,
  },
  table: { width: "100%", borderCollapse: "collapse", fontSize: 12 },
  thead: { background: "#1a3a5c" },
  th: {
    padding: "10px 12px",
    textAlign: "left",
    color: "#fff",
    fontWeight: 600,
    whiteSpace: "nowrap",
  },
  td: {
    padding: "8px 12px",
    borderBottom: "1px solid #e8eef4",
    whiteSpace: "normal",
    wordBreak: "break-word",
  },
  tripBadge: {
    background: "#e8f0fe",
    color: "#1a3a5c",
    borderRadius: 10,
    padding: "2px 8px",
    fontWeight: 700,
    fontSize: 11,
  },
  badge: {
    padding: "2px 8px",
    borderRadius: 10,
    fontSize: 11,
    fontWeight: 600,
  },
  pills: { display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 },
  pill: {
    background: "#fff",
    border: "1px solid #d0dce8",
    borderRadius: 8,
    padding: "10px 16px",
    minWidth: 140,
  },
  pillLabel: {
    fontSize: 10,
    color: "#999",
    textTransform: "uppercase",
    letterSpacing: "0.04em",
  },
  pillValue: {
    fontSize: 20,
    fontWeight: 700,
    color: "#1a3a5c",
    margin: "4px 0 2px",
  },
  pillSub: { fontSize: 11, color: "#aaa" },
};

function CreateUserForm() {
  const [form, setForm] = useState({ username: "", password: "", role: "viewer" });
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleCreate = async () => {
    if (!form.username || !form.password)
      return setError("Username and password are required");
    setLoading(true); setError(""); setSuccess("");
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${BASE_URL}/auth/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${token}`,
        },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to create user");
      setSuccess(`✓ User "${data.user.username}" created as ${data.user.role}`);
      setForm({ username: "", password: "", role: "viewer" });
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={cs.card}>
      <h2 style={{ ...styles.heading, marginBottom: 4 }}>👤 Create New User</h2>
      <p style={styles.sub}>Only admins can create accounts. Viewers cannot access this page.</p>

      <div style={cs.row}>
        <div style={cs.field}>
          <label style={cs.label}>Username</label>
          <input style={cs.input} name="username" value={form.username}
            onChange={update} placeholder="e.g. ram_driver" />
        </div>
        <div style={cs.field}>
          <label style={cs.label}>Password</label>
          <input style={cs.input} type="password" name="password"
            value={form.password} onChange={update} placeholder="Min 6 chars" />
        </div>
        <div style={cs.field}>
          <label style={cs.label}>Role</label>
          <select style={cs.input} name="role" value={form.role} onChange={update}>
            <option value="viewer">Viewer — can view & add trips</option>
            <option value="admin">Admin — full access</option>
          </select>
        </div>
      </div>

      {error   && <p style={{ color: "#cc3333", fontSize: 13, margin: "8px 0" }}>{error}</p>}
      {success && <p style={{ color: "#166534", fontSize: 13, margin: "8px 0" }}>{success}</p>}

      <button style={styles.saveBtn} onClick={handleCreate} disabled={loading}>
        {loading ? "Creating..." : "➕ Create User"}
      </button>
    </div>
  );
}

const cs = {
  card:  { borderTop: "2px solid #e8eef4", paddingTop: 32, marginTop: 8 },
  row:   { display: "flex", gap: 12, flexWrap: "wrap", marginBottom: 12 },
  field: { display: "flex", flexDirection: "column", gap: 4, flex: 1, minWidth: 180 },
  label: { fontSize: 11, fontWeight: 600, color: "#666", textTransform: "uppercase" },
  input: { padding: "9px 10px", border: "1px solid #d0dce8", borderRadius: 6, fontSize: 13 },
};