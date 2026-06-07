import React, { useState, useEffect, useRef, useCallback } from "react";

const API = process.env.REACT_APP_API_URL ? `${process.env.REACT_APP_API_URL}/api` : "http://localhost:4000/api";

const SEVERITY = {
  critical: { color: "#cc0000", bg: "#fff0f0", border: "#ffcccc", label: "Critical", icon: "🔴" },
  warning:  { color: "#b45309", bg: "#fffbeb", border: "#fde68a", label: "Warning",  icon: "🟡" },
  info:     { color: "#1a3a5c", bg: "#f0f6ff", border: "#bfdbfe", label: "Info",     icon: "🔵" },
};

const TYPE_LABEL = {
  overlapping_dates: "Overlapping Dates",
  cash_expense_high: "High Cash Expense",
  duration_high:     "Long Trip Duration",
  diesel_streak:     "Diesel Over-Usage",
  rokhar_streak:     "Repeated Breakdown",
  entry_delay:       "Late Entry",
  bhatta_no_date:    "Bhatta — No Date",
  duplicate_bill:    "Duplicate Bill",
  truck_idle:        "Truck Idle",
  new_expense_head:  "New Expense Type",
};

export default function AlertsBell({ refreshTrigger }) {
  const [open, setOpen]           = useState(false);
  const [alerts, setAlerts]       = useState([]);
  const [counts, setCounts]       = useState({ critical: 0, warning: 0, info: 0, total: 0 });
  const [filter, setFilter]       = useState("all"); // all | critical | warning | info | unread
  const [loading, setLoading]     = useState(false);
  const panelRef                  = useRef(null);
  const pollRef                   = useRef(null);

  const fetchCounts = useCallback(async () => {
    try {
      const r = await fetch(`${API}/alerts/unread-count`);
      const d = await r.json();
      setCounts(d);
    } catch {}
  }, []);

  const fetchAlerts = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (filter === "unread")   params.set("is_read", "false");
      if (["critical","warning","info"].includes(filter)) params.set("severity", filter);
      params.set("limit", "80");
      const r = await fetch(`${API}/alerts?${params}`);
      const d = await r.json();
      setAlerts(d);
    } catch {}
    setLoading(false);
  }, [filter]);

  // Poll counts every 30s
  useEffect(() => {
    fetchCounts();
    pollRef.current = setInterval(fetchCounts, 30000);
    return () => clearInterval(pollRef.current);
  }, [fetchCounts]);

  // Refresh when a trip is saved (refreshTrigger increments)
  useEffect(() => {
    if (refreshTrigger > 0) fetchCounts();
  }, [refreshTrigger, fetchCounts]);

  // Fetch alerts when panel opens or filter changes
  useEffect(() => {
    if (open) fetchAlerts();
  }, [open, fetchAlerts]);

  // Close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const markRead = async (id) => {
    await fetch(`${API}/alerts/${id}/read`, { method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reviewed_by: "supervisor" }) });
    setAlerts(prev => prev.map(a => a.id === id ? { ...a, is_read: true } : a));
    fetchCounts();
  };

  const markAllRead = async () => {
    const body = filter !== "all" && filter !== "unread" ? { severity: filter } : {};
    await fetch(`${API}/alerts/read-all`, { method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body) });
    setAlerts(prev => prev.map(a => ({ ...a, is_read: true })));
    fetchCounts();
  };

  const bellColor = counts.critical > 0 ? "#cc0000"
    : counts.warning > 0 ? "#b45309"
    : counts.total > 0   ? "#1a3a5c"
    : "#888";

  return (
    <div ref={panelRef} style={{ position: "relative" }}>
      {/* ── Bell Button ── */}
      <button onClick={() => setOpen(v => !v)} style={{ ...styles.bell, borderColor: open ? bellColor : "#d0dce8" }}>
        <span style={{ fontSize: 18 }}>🔔</span>
        {counts.total > 0 && (
          <span style={{ ...styles.badge, background: bellColor }}>
            {counts.total > 99 ? "99+" : counts.total}
          </span>
        )}
      </button>

      {/* ── Panel ── */}
      {open && (
        <div style={styles.panel}>
          {/* Header */}
          <div style={styles.panelHeader}>
            <div>
              <div style={styles.panelTitle}>Supervisor Alerts</div>
              <div style={styles.panelSub}>
                {counts.critical > 0 && <span style={{ color: "#cc0000", fontWeight: 700 }}>🔴 {counts.critical} critical&nbsp;&nbsp;</span>}
                {counts.warning  > 0 && <span style={{ color: "#b45309" }}>🟡 {counts.warning} warning&nbsp;&nbsp;</span>}
                {counts.info     > 0 && <span style={{ color: "#555" }}>🔵 {counts.info} info</span>}
              </div>
            </div>
            {counts.total > 0 && (
              <button onClick={markAllRead} style={styles.markAllBtn}>Mark all read</button>
            )}
          </div>

          {/* Filter tabs */}
          <div style={styles.tabs}>
            {["all","unread","critical","warning","info"].map(f => (
              <button key={f} onClick={() => setFilter(f)}
                style={{ ...styles.tab, ...(filter === f ? styles.tabActive : {}) }}>
                {f === "all"    ? "All" :
                 f === "unread" ? `Unread (${counts.total})` :
                 `${SEVERITY[f]?.icon} ${SEVERITY[f]?.label} (${counts[f] || 0})`}
              </button>
            ))}
          </div>

          {/* Alert list */}
          <div style={styles.list}>
            {loading ? (
              <div style={styles.empty}>Loading...</div>
            ) : alerts.length === 0 ? (
              <div style={styles.empty}>No alerts{filter !== "all" ? " for this filter" : ""}. All clear ✓</div>
            ) : alerts.map(a => {
              const s = SEVERITY[a.severity] || SEVERITY.info;
              return (
                <div key={a.id} style={{
                  ...styles.alertRow,
                  background: a.is_read ? "#fafafa" : s.bg,
                  borderLeft: `4px solid ${a.is_read ? "#ddd" : s.color}`,
                  opacity: a.is_read ? 0.65 : 1,
                }}>
                  <div style={styles.alertTop}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ ...styles.typeTag, background: s.bg, color: s.color, borderColor: s.border }}>
                        {s.icon} {TYPE_LABEL[a.type] || a.type}
                      </span>
                      {a.truck_number && (
                        <span style={styles.truckTag}>{a.truck_number}</span>
                      )}
                    </div>
                    <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                      <span style={styles.time}>{formatTime(a.created_at)}</span>
                      {!a.is_read && (
                        <button onClick={() => markRead(a.id)} style={styles.readBtn}>✓ Review</button>
                      )}
                    </div>
                  </div>
                  <div style={styles.alertMsg}>{a.message}</div>
                  {a.trip_id && (
                    <div style={styles.alertMeta}>
                      Trip #{a.trip_id}
                      {a.source_name && a.customer_name && ` · ${a.source_name} → ${a.customer_name}`}
                      {a.start_date && ` · ${a.start_date}`}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTime(ts) {
  if (!ts) return "";
  const d = new Date(ts);
  const now = new Date();
  const diff = Math.floor((now - d) / 1000);
  if (diff < 60)   return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  return `${Math.floor(diff / 86400)}d ago`;
}

const styles = {
  bell: {
    position: "relative", background: "#fff", border: "1.5px solid #d0dce8",
    borderRadius: 8, padding: "7px 10px", cursor: "pointer",
    display: "flex", alignItems: "center", gap: 4,
  },
  badge: {
    position: "absolute", top: -6, right: -6,
    color: "#fff", fontSize: 10, fontWeight: 700,
    borderRadius: 10, padding: "2px 5px", minWidth: 18, textAlign: "center",
  },
  panel: {
    position: "absolute", top: "calc(100% + 8px)", right: 0,
    width: 480, maxWidth: "95vw",
    background: "#fff", border: "1px solid #d0dce8",
    borderRadius: 10, boxShadow: "0 8px 32px rgba(0,0,0,0.15)",
    zIndex: 1000, overflow: "hidden",
  },
  panelHeader: {
    display: "flex", justifyContent: "space-between", alignItems: "flex-start",
    padding: "14px 16px 10px", borderBottom: "1px solid #e8eef4",
    background: "#f7fafd",
  },
  panelTitle: { fontWeight: 700, fontSize: 15, color: "#1a3a5c" },
  panelSub:   { fontSize: 12, marginTop: 3 },
  markAllBtn: {
    padding: "5px 10px", background: "#f0f4f8", border: "1px solid #c0ccd8",
    borderRadius: 5, cursor: "pointer", fontSize: 11, color: "#555", whiteSpace: "nowrap",
  },
  tabs: {
    display: "flex", gap: 0, borderBottom: "1px solid #e8eef4",
    overflowX: "auto", background: "#f7fafd",
  },
  tab: {
    padding: "8px 12px", border: "none", background: "none",
    cursor: "pointer", fontSize: 11, color: "#888", whiteSpace: "nowrap",
    borderBottom: "2px solid transparent",
  },
  tabActive: { color: "#1a3a5c", fontWeight: 700, borderBottom: "2px solid #1a3a5c" },
  list: { maxHeight: 480, overflowY: "auto" },
  empty: { padding: 32, textAlign: "center", color: "#aaa", fontSize: 13 },
  alertRow: {
    padding: "12px 14px", borderBottom: "1px solid #f0f4f8",
    transition: "opacity 0.2s",
  },
  alertTop: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  typeTag: {
    fontSize: 10, fontWeight: 700, padding: "2px 8px",
    borderRadius: 10, border: "1px solid", textTransform: "uppercase", letterSpacing: "0.04em",
  },
  truckTag: {
    fontSize: 11, background: "#1a3a5c", color: "#fff",
    borderRadius: 6, padding: "2px 7px", fontWeight: 600,
  },
  time:    { fontSize: 11, color: "#aaa" },
  readBtn: {
    padding: "3px 8px", background: "#e8f5e9", border: "1px solid #a5d6a7",
    borderRadius: 4, cursor: "pointer", fontSize: 11, color: "#155724", fontWeight: 600,
  },
  alertMsg:  { fontSize: 13, color: "#333", lineHeight: 1.5, marginBottom: 4 },
  alertMeta: { fontSize: 11, color: "#999" },
};