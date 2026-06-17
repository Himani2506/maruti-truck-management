import React, { useState, useEffect, useCallback } from "react";
import {
  BarChart, Bar, LineChart, Line,
  XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid, Legend
} from "recharts";
import axios from "axios";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

// ─── Formatting helpers ───────────────────────────────────────────────────────
const fmt = (n) =>
  n != null && n !== ""
    ? parseFloat(n).toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : "—";
const fmtN = (n, decimals = 2) =>
  n != null && n !== ""
    ? parseFloat(n).toLocaleString("en-IN", { minimumFractionDigits: 0, maximumFractionDigits: decimals })
    : "—";
const fmtK = (n) => {
  if (n == null) return "—";
  const v = parseFloat(n);
  if (Math.abs(v) >= 10_00_000) return `${(v / 10_00_000).toFixed(2)}L`;
  if (Math.abs(v) >= 1000) return `${(v / 1000).toFixed(1)}K`;
  return fmtN(v, 0);
};

// ─── Date helpers ─────────────────────────────────────────────────────────────
function getWeekRange(weeksBack = 0) {
  const now = new Date();
  const day = now.getDay();
  const diffToSun = day; // Sunday = start of week
  const start = new Date(now);
  start.setDate(now.getDate() - diffToSun - weeksBack * 7);
  start.setHours(0, 0, 0, 0);
  const end = new Date(start);
  end.setDate(start.getDate() + 6);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function getMonthRange(monthsBack = 0) {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth() - monthsBack, 1);
  const end = new Date(now.getFullYear(), now.getMonth() - monthsBack + 1, 0);
  end.setHours(23, 59, 59, 999);
  return { start, end };
}

function dateInRange(dateStr, start, end) {
  if (!dateStr) return false;
  const d = new Date(dateStr);
  return d >= start && d <= end;
}

function formatPeriodLabel(mode, selectedBSMonth, availableBSMonths) {
  if (mode === "week") {
    const { start, end } = getWeekRange(0);
    return `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })} – ${end.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
  }
  if (mode === "bs") {
    const found = availableBSMonths.find(m => m.key === selectedBSMonth);
    return found ? found.label : "—";
  }
  return new Date().toLocaleDateString("en-GB", { month: "long", year: "numeric" });
}

// ─── BS Month helpers ─────────────────────────────────────────────────────────
const BS_MONTHS = [
  "Baisakh","Jestha","Ashadh","Shrawan","Bhadra","Ashwin",
  "Kartik","Mangsir","Poush","Magh","Falgun","Chaitra"
];

// Extract BS year+month from unloading_date_bs ("DD/MM/YYYY")
function parseBSMonth(bsStr) {
  if (!bsStr) return null;
  const parts = bsStr.split("/");
  if (parts.length !== 3) return null;
  const month = parseInt(parts[1]);
  const year = parseInt(parts[2]);
  if (!month || !year) return null;
  return { year, month }; // month 1-12
}

function bsMonthKey(year, month) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

function bsMonthLabel(year, month) {
  return `${BS_MONTHS[month - 1]} ${year}`;
}

// Get unique BS months from entries, sorted desc
function getAvailableBSMonths(entries) {
  const seen = new Set();
  const months = [];
  entries.forEach(e => {
    const bm = parseBSMonth(e.unloading_date_bs);
    if (!bm) return;
    const key = bsMonthKey(bm.year, bm.month);
    if (!seen.has(key)) {
      seen.add(key);
      months.push({ key, year: bm.year, month: bm.month, label: bsMonthLabel(bm.year, bm.month) });
    }
  });
  return months.sort((a, b) => b.key.localeCompare(a.key));
}

function filterByBSMonth(entries, key) {
  return entries.filter(e => {
    const bm = parseBSMonth(e.unloading_date_bs);
    if (!bm) return false;
    return bsMonthKey(bm.year, bm.month) === key;
  });
}

// ─── Colors ───────────────────────────────────────────────────────────────────
const NAVY = "#1a3c5e";
const GREEN = "#276749";
const AMBER = "#d97706";
const RED = "#c53030";
const BLUE = "#2b6cb0";
const LIGHT_BLUE = "#ebf8ff";

// ─── Score thresholds ─────────────────────────────────────────────────────────
function scoreParty(party, thresholds) {
  const lab = parseFloat(party.avg_lab) || 0;
  const shortage = parseFloat(party.avg_shortage_pct) || 0;
  const overridePct = parseFloat(party.override_pct) || 0;

  let issues = 0;
  if (lab > thresholds.lab) issues++;
  if (shortage > thresholds.shortage) issues++;
  if (overridePct > thresholds.override) issues++;

  if (issues === 0) return "good";
  if (issues === 1) return "warn";
  return "bad";
}

const scoreStyle = {
  good: { bg: "#f0fff4", color: GREEN, border: "#9ae6b4", label: "✓ Good" },
  warn: { bg: "#fffbeb", color: AMBER, border: "#fcd34d", label: "⚠ Watch" },
  bad:  { bg: "#fff5f5", color: RED,   border: "#feb2b2", label: "✗ Flag" },
};

// ─── Custom tooltip ───────────────────────────────────────────────────────────
function ChartTooltip({ active, payload, label, prefix = "" }) {
  if (!active || !payload?.length) return null;
  return (
    <div style={{
      background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8,
      padding: "10px 14px", fontSize: 12, boxShadow: "0 4px 12px rgba(0,0,0,0.1)"
    }}>
      <div style={{ fontWeight: 700, marginBottom: 6, color: NAVY }}>{label}</div>
      {payload.map((p, i) => (
        <div key={i} style={{ color: p.color, marginBottom: 2 }}>
          {p.name}: <strong>{prefix}{fmtK(p.value)}</strong>
        </div>
      ))}
    </div>
  );
}

// ═════════════════════════════════════════════════════════════════════════════
export default function ScrapAnalysis() {
  const [mode, setMode] = useState("month"); // "week" | "month" | "bs"
  const [allEntries, setAllEntries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [barMetric, setBarMetric] = useState("weight"); // "weight" | "payable"
  const [thresholds, setThresholds] = useState({ lab: 5, shortage: 3, override: 30 });
  const [showThresholds, setShowThresholds] = useState(false);
  const [selectedBSMonth, setSelectedBSMonth] = useState(null); // key like "2082-01"
  const [selectedParty, setSelectedParty] = useState("all");

  // Fetch all entries once
  const fetchAll = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/scrap`);
      setAllEntries(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  // Auto-select latest BS month once entries load
  useEffect(() => {
    if (allEntries.length > 0 && !selectedBSMonth) {
      const months = getAvailableBSMonths(allEntries);
      if (months.length > 0) setSelectedBSMonth(months[0].key);
    }
  }, [allEntries, selectedBSMonth]);

  // ── Compute ranges ──────────────────────────────────────────────────────────
  const currRange = mode === "week" ? getWeekRange(0) : getMonthRange(0);
  const prevRange = mode === "week" ? getWeekRange(1) : getMonthRange(1);

  const availableBSMonths = getAvailableBSMonths(allEntries);

  // Base filter by period
  let currEntries, prevEntries;
  if (mode === "bs") {
    currEntries = selectedBSMonth ? filterByBSMonth(allEntries, selectedBSMonth) : [];
    // prev = the month before selected
    const idx = availableBSMonths.findIndex(m => m.key === selectedBSMonth);
    prevEntries = (idx >= 0 && idx + 1 < availableBSMonths.length)
      ? filterByBSMonth(allEntries, availableBSMonths[idx + 1].key)
      : [];
  } else {
    currEntries = allEntries.filter(e => dateInRange(e.unloading_date_ad, currRange.start, currRange.end));
    prevEntries = allEntries.filter(e => dateInRange(e.unloading_date_ad, prevRange.start, prevRange.end));
  }

  // Apply party filter
  const allParties = [...new Set(allEntries.map(e => e.source))].sort();
  if (selectedParty !== "all") {
    currEntries = currEntries.filter(e => e.source === selectedParty);
    prevEntries = prevEntries.filter(e => e.source === selectedParty);
  }

  // ── KPI calculations ────────────────────────────────────────────────────────
  function sumEntries(entries) {
    return entries.reduce((acc, e) => ({
      weight: acc.weight + (parseFloat(e.bill_weight) || 0),
      payable: acc.payable + (parseFloat(e.net_payable) || 0),
      parties: acc.parties,
    }), { weight: 0, payable: 0, parties: 0 });
  }

  const curr = sumEntries(currEntries);
  const prev = sumEntries(prevEntries);
  curr.parties = new Set(currEntries.map(e => e.source)).size;
  prev.parties = new Set(prevEntries.map(e => e.source)).size;
  curr.ratePerKg = curr.weight > 0 ? curr.payable / curr.weight : 0;
  prev.ratePerKg = prev.weight > 0 ? prev.payable / prev.weight : 0;

  function delta(curr, prev) {
    if (!prev || prev === 0) return null;
    return ((curr - prev) / prev * 100).toFixed(1);
  }

  // ── Party scorecard ─────────────────────────────────────────────────────────
  const partyMap = {};
  currEntries.forEach(e => {
    const k = e.source;
    if (!partyMap[k]) partyMap[k] = {
      name: k, entries: 0, weight: 0, payable: 0,
      lab_sum: 0, shortage_sum: 0, overrides: 0,
      bill_weight_sum: 0,
    };
    const p = partyMap[k];
    p.entries++;
    p.weight += parseFloat(e.bill_weight) || 0;
    p.payable += parseFloat(e.net_payable) || 0;
    p.lab_sum += parseFloat(e.total_lab_report) || 0;
    p.shortage_sum += parseFloat(e.shortage) || 0;
    p.bill_weight_sum += parseFloat(e.bill_weight) || 0;
    if (e.is_overridden) p.overrides++;
  });

  const partyScores = Object.values(partyMap).map(p => ({
    ...p,
    avg_lab: p.entries > 0 ? p.lab_sum / p.entries : 0,
    avg_shortage_pct: p.bill_weight_sum > 0 ? (p.shortage_sum / p.bill_weight_sum) * 100 : 0,
    override_pct: p.entries > 0 ? (p.overrides / p.entries) * 100 : 0,
    net_per_kg: p.weight > 0 ? p.payable / p.weight : 0,
  })).sort((a, b) => b.payable - a.payable);

  // ── Bar chart data ──────────────────────────────────────────────────────────
  const barData = [...partyScores]
    .sort((a, b) => barMetric === "weight" ? b.weight - a.weight : b.payable - a.payable)
    .slice(0, 10)
    .map(p => ({
      name: p.name.length > 14 ? p.name.slice(0, 13) + "…" : p.name,
      fullName: p.name,
      value: barMetric === "weight" ? p.weight : p.payable,
    }));

  // ── Trend chart — last 8 weeks or 6 months ──────────────────────────────────
  const trendData = [];
  if (mode === "week") {
    for (let i = 7; i >= 0; i--) {
      const { start, end } = getWeekRange(i);
      const week = allEntries.filter(e => dateInRange(e.unloading_date_ad, start, end));
      const label = `${start.toLocaleDateString("en-GB", { day: "2-digit", month: "short" })}`;
      trendData.push({
        label,
        weight: week.reduce((s, e) => s + (parseFloat(e.bill_weight) || 0), 0),
        payable: week.reduce((s, e) => s + (parseFloat(e.net_payable) || 0), 0),
      });
    }
  } else if (mode === "bs") {
    // Last 6 available BS months
    const recent = availableBSMonths.slice(0, 6).reverse();
    recent.forEach(m => {
      const entries = filterByBSMonth(
        selectedParty !== "all" ? allEntries.filter(e => e.source === selectedParty) : allEntries,
        m.key
      );
      trendData.push({
        label: `${BS_MONTHS[m.month - 1].slice(0, 3)} ${m.year}`,
        weight: entries.reduce((s, e) => s + (parseFloat(e.bill_weight) || 0), 0),
        payable: entries.reduce((s, e) => s + (parseFloat(e.net_payable) || 0), 0),
      });
    });
  } else {
    for (let i = 5; i >= 0; i--) {
      const { start, end } = getMonthRange(i);
      const month = allEntries.filter(e => dateInRange(e.unloading_date_ad, start, end));
      const label = start.toLocaleDateString("en-GB", { month: "short", year: "2-digit" });
      trendData.push({
        label,
        weight: month.reduce((s, e) => s + (parseFloat(e.bill_weight) || 0), 0),
        payable: month.reduce((s, e) => s + (parseFloat(e.net_payable) || 0), 0),
      });
    }
  }

  // ── Flags ───────────────────────────────────────────────────────────────────
  const flagHighLab = partyScores.filter(p => p.avg_lab > thresholds.lab);
  const flagHighShortage = partyScores.filter(p => p.avg_shortage_pct > thresholds.shortage);
  const flagOverrides = partyScores.filter(p => p.override_pct > thresholds.override);

  // ─────────────────────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div style={{ textAlign: "center", padding: 64, color: "#a0aec0", fontSize: 13 }}>
        Loading analysis…
      </div>
    );
  }

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#1a202c", padding: "0 2px" }}>

      {/* ── Header row ── */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16, flexWrap: "wrap", gap: 10 }}>
        <div>
          <h2 style={{ margin: 0, fontSize: 18, fontWeight: 700, color: NAVY }}>Scrap Analysis</h2>
          <p style={{ margin: "3px 0 0", fontSize: 12, color: "#718096" }}>
            {formatPeriodLabel(mode, selectedBSMonth, availableBSMonths)}
            {selectedParty !== "all" && <span style={{ marginLeft: 8, color: BLUE, fontWeight: 600 }}>· {selectedParty}</span>}
          </p>
        </div>
        <div style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
          {/* Period toggle */}
          <div style={{ display: "flex", background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 8, overflow: "hidden" }}>
            {[["week", "This Week"], ["month", "This Month"], ["bs", "BS Month"]].map(([m, label]) => (
              <button key={m} onClick={() => setMode(m)} style={{
                padding: "7px 14px", border: "none", cursor: "pointer", fontSize: 12, fontWeight: 600,
                background: mode === m ? NAVY : "transparent",
                color: mode === m ? "#fff" : "#718096",
                transition: "all 0.15s",
              }}>
                {label}
              </button>
            ))}
          </div>

          {/* BS Month dropdown — only shown in bs mode */}
          {mode === "bs" && (
            <select
              value={selectedBSMonth || ""}
              onChange={e => setSelectedBSMonth(e.target.value)}
              style={{
                padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
                fontSize: 12, fontWeight: 600, color: NAVY, background: "#fff",
                cursor: "pointer", outline: "none",
              }}
            >
              {availableBSMonths.map(m => (
                <option key={m.key} value={m.key}>{m.label}</option>
              ))}
              {availableBSMonths.length === 0 && <option disabled>No data</option>}
            </select>
          )}

          {/* Party filter */}
          <select
            value={selectedParty}
            onChange={e => setSelectedParty(e.target.value)}
            style={{
              padding: "7px 12px", borderRadius: 8, border: "1px solid #e2e8f0",
              fontSize: 12, fontWeight: 600, color: selectedParty === "all" ? "#718096" : NAVY,
              background: selectedParty === "all" ? "#fff" : "#ebf8ff",
              cursor: "pointer", outline: "none",
            }}
          >
            <option value="all">All Parties</option>
            {allParties.map(p => (
              <option key={p} value={p}>{p}</option>
            ))}
          </select>

          {/* Threshold toggle */}
          <button onClick={() => setShowThresholds(p => !p)} style={{
            padding: "7px 14px", border: "1px solid #e2e8f0", borderRadius: 8,
            background: showThresholds ? "#fffbeb" : "#fff", color: AMBER,
            fontSize: 12, fontWeight: 600, cursor: "pointer",
          }}>
            ⚙ Thresholds
          </button>
        </div>
      </div>

      {/* ── Threshold panel ── */}
      {showThresholds && (
        <div style={{
          background: "#fffbeb", border: "1px solid #fcd34d", borderRadius: 10,
          padding: "14px 18px", marginBottom: 16, display: "flex", gap: 24, flexWrap: "wrap", alignItems: "center",
        }}>
          <span style={{ fontSize: 12, fontWeight: 700, color: AMBER }}>Flag when:</span>
          {[
            { key: "lab", label: "Lab % above" },
            { key: "shortage", label: "Shortage % above" },
            { key: "override", label: "Override % above" },
          ].map(({ key, label }) => (
            <label key={key} style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#4a5568", fontWeight: 500 }}>
              {label}
              <input
                type="number"
                value={thresholds[key]}
                onChange={e => setThresholds(p => ({ ...p, [key]: parseFloat(e.target.value) || 0 }))}
                style={{
                  width: 56, padding: "4px 8px", borderRadius: 6,
                  border: "1px solid #fcd34d", fontSize: 12, textAlign: "center",
                  background: "#fff", outline: "none",
                }}
              />
              %
            </label>
          ))}
        </div>
      )}

      {/* ── KPI Cards ── */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 20 }}>
        {[
          {
            label: "Total Volume",
            value: `${fmtN(curr.weight, 0)} kg`,
            raw: curr.weight, prev: prev.weight,
            icon: "⚖️",
          },
          {
            label: "Net Payable",
            value: `NPR ${fmtK(curr.payable)}`,
            raw: curr.payable, prev: prev.payable,
            icon: "💰",
          },
          {
            label: "Active Parties",
            value: curr.parties,
            raw: curr.parties, prev: prev.parties,
            icon: "🏢",
          },
          {
            label: "Avg Rate / kg",
            value: `NPR ${fmtN(curr.ratePerKg, 2)}`,
            raw: curr.ratePerKg, prev: prev.ratePerKg,
            icon: "📈",
          },
        ].map((kpi) => {
          const d = delta(kpi.raw, kpi.prev);
          const up = d !== null && parseFloat(d) >= 0;
          return (
            <div key={kpi.label} style={{
              background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0",
              padding: "16px 18px", boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
            }}>
              <div style={{ fontSize: 20, marginBottom: 8 }}>{kpi.icon}</div>
              <div style={{ fontSize: 11, fontWeight: 600, color: "#718096", textTransform: "uppercase", letterSpacing: "0.05em", marginBottom: 4 }}>
                {kpi.label}
              </div>
              <div style={{ fontSize: 20, fontWeight: 800, color: NAVY, marginBottom: 6 }}>
                {kpi.value}
              </div>
              {d !== null && (
                <div style={{ fontSize: 11, fontWeight: 600, color: up ? GREEN : RED }}>
                  {up ? "▲" : "▼"} {Math.abs(d)}% vs prev {mode}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* ── Charts row ── */}
      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 20 }}>

        {/* Bar chart */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "18px 16px" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: NAVY }}>Top Parties</div>
            <div style={{ display: "flex", background: "#f7fafc", border: "1px solid #e2e8f0", borderRadius: 6, overflow: "hidden" }}>
              {[["weight", "by Volume"], ["payable", "by Payable"]].map(([k, l]) => (
                <button key={k} onClick={() => setBarMetric(k)} style={{
                  padding: "4px 10px", border: "none", cursor: "pointer", fontSize: 11, fontWeight: 600,
                  background: barMetric === k ? NAVY : "transparent",
                  color: barMetric === k ? "#fff" : "#718096",
                }}>
                  {l}
                </button>
              ))}
            </div>
          </div>
          {barData.length === 0 ? (
            <div style={{ textAlign: "center", color: "#a0aec0", padding: 40, fontSize: 12 }}>No data for this period</div>
          ) : (
            <ResponsiveContainer width="100%" height={220}>
              <BarChart data={barData} layout="vertical" margin={{ left: 0, right: 16, top: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#f0f0f0" />
                <XAxis type="number" tick={{ fontSize: 10, fill: "#718096" }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
                <YAxis type="category" dataKey="name" tick={{ fontSize: 10, fill: "#4a5568", fontWeight: 500 }} width={90} axisLine={false} tickLine={false} />
                <Tooltip content={<ChartTooltip prefix={barMetric === "payable" ? "NPR " : ""} />} />
                <Bar dataKey="value" fill={NAVY} radius={[0, 4, 4, 0]} maxBarSize={18} name={barMetric === "weight" ? "Volume (kg)" : "Net Payable"} />
              </BarChart>
            </ResponsiveContainer>
          )}
        </div>

        {/* Trend line */}
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", padding: "18px 16px" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: NAVY, marginBottom: 16 }}>
            {mode === "week" ? "8-Week Volume Trend" : "6-Month Volume Trend"}
          </div>
          <ResponsiveContainer width="100%" height={220}>
            <LineChart data={trendData} margin={{ left: 0, right: 16, top: 4, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: "#718096" }} axisLine={false} tickLine={false} />
              <YAxis yAxisId="left" tick={{ fontSize: 10, fill: "#718096" }} tickFormatter={fmtK} axisLine={false} tickLine={false} />
              <YAxis yAxisId="right" orientation="right" tick={{ fontSize: 10, fill: "#718096" }} tickFormatter={v => `${fmtK(v)}`} axisLine={false} tickLine={false} />
              <Tooltip content={<ChartTooltip />} />
              <Legend wrapperStyle={{ fontSize: 11 }} />
              <Line yAxisId="left" type="monotone" dataKey="weight" stroke={NAVY} strokeWidth={2} dot={{ r: 3 }} name="Volume (kg)" />
              <Line yAxisId="right" type="monotone" dataKey="payable" stroke={GREEN} strokeWidth={2} dot={{ r: 3 }} strokeDasharray="4 2" name="Net Payable (NPR)" />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Party Scorecard Table ── */}
      <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 20, overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
        <div style={{ background: "#f7fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
          <span style={{ fontWeight: 700, fontSize: 11, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em" }}>
            Party Scorecard — {mode === "bs"
              ? (availableBSMonths.find(m => m.key === selectedBSMonth)?.label || "BS Month")
              : mode === "week" ? "This Week" : "This Month"}
            {selectedParty !== "all" && ` · ${selectedParty}`}
          </span>
          <span style={{ fontSize: 11, color: "#a0aec0" }}>{partyScores.length} parties</span>
        </div>
        {partyScores.length === 0 ? (
          <div style={{ textAlign: "center", color: "#a0aec0", padding: 48, fontSize: 13 }}>No entries for this period.</div>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: NAVY }}>
                  {["Party Name", "Entries", "Volume (kg)", "Net Payable", "NPR/kg", "Avg Lab %", "Shortage %", "Override %", "Rating"].map(h => (
                    <th key={h} style={{
                      padding: "10px 12px", textAlign: h === "Party Name" ? "left" : "right",
                      fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                    }}>{h}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {partyScores.map((p, i) => {
                  const score = scoreParty(p, thresholds);
                  const ss = scoreStyle[score];
                  return (
                    <tr key={p.name}
                      style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                      onMouseEnter={e => e.currentTarget.style.background = "#f0f7ff"}
                      onMouseLeave={e => e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f8fafc"}
                    >
                      <td style={{ padding: "10px 12px", fontWeight: 600, color: "#2d3748", whiteSpace: "nowrap", borderBottom: "1px solid #f0f0f0" }}>
                        {p.name}
                      </td>
                      <td style={numTd}>{p.entries}</td>
                      <td style={numTd}>{fmtN(p.weight, 0)}</td>
                      <td style={{ ...numTd, fontWeight: 700 }}>NPR {fmtK(p.payable)}</td>
                      <td style={{ ...numTd, color: BLUE, fontWeight: 600 }}>{fmtN(p.net_per_kg, 2)}</td>
                      <td style={{ ...numTd, color: p.avg_lab > thresholds.lab ? RED : GREEN, fontWeight: 600 }}>
                        {fmtN(p.avg_lab, 2)}%
                      </td>
                      <td style={{ ...numTd, color: p.avg_shortage_pct > thresholds.shortage ? RED : GREEN, fontWeight: 600 }}>
                        {fmtN(p.avg_shortage_pct, 2)}%
                      </td>
                      <td style={{ ...numTd, color: p.override_pct > thresholds.override ? AMBER : "#4a5568" }}>
                        {fmtN(p.override_pct, 0)}%
                      </td>
                      <td style={{ padding: "10px 12px", textAlign: "right", borderBottom: "1px solid #f0f0f0" }}>
                        <span style={{
                          background: ss.bg, color: ss.color, border: `1px solid ${ss.border}`,
                          borderRadius: 6, padding: "3px 10px", fontSize: 11, fontWeight: 700, whiteSpace: "nowrap",
                        }}>
                          {ss.label}
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Flags Section ── */}
      {(flagHighLab.length > 0 || flagHighShortage.length > 0 || flagOverrides.length > 0) && (
        <div style={{ background: "#fff", borderRadius: 10, border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 3px rgba(0,0,0,0.05)" }}>
          <div style={{ background: "#f7fafc", padding: "10px 16px", borderBottom: "1px solid #e2e8f0" }}>
            <span style={{ fontWeight: 700, fontSize: 11, color: "#718096", textTransform: "uppercase", letterSpacing: "0.06em" }}>
              🚩 Flags — Attention Needed
            </span>
          </div>
          <div style={{ padding: "14px 16px", display: "flex", flexDirection: "column", gap: 10 }}>
            {flagHighLab.length > 0 && (
              <FlagRow
                color={RED}
                bg="#fff5f5"
                border="#fed7d7"
                icon="🧪"
                title={`High Lab % (>${thresholds.lab}%)`}
                parties={flagHighLab}
                detail={p => `${fmtN(p.avg_lab, 2)}% avg`}
              />
            )}
            {flagHighShortage.length > 0 && (
              <FlagRow
                color={AMBER}
                bg="#fffbeb"
                border="#fcd34d"
                icon="⚖️"
                title={`High Shortage (>${thresholds.shortage}%)`}
                parties={flagHighShortage}
                detail={p => `${fmtN(p.avg_shortage_pct, 2)}% loss`}
              />
            )}
            {flagOverrides.length > 0 && (
              <FlagRow
                color={BLUE}
                bg={LIGHT_BLUE}
                border="#90cdf4"
                icon="🔁"
                title={`Frequent Overrides (>${thresholds.override}% of entries)`}
                parties={flagOverrides}
                detail={p => `${fmtN(p.override_pct, 0)}% overridden`}
              />
            )}
          </div>
        </div>
      )}

      {(flagHighLab.length === 0 && flagHighShortage.length === 0 && flagOverrides.length === 0 && partyScores.length > 0) && (
        <div style={{
          background: "#f0fff4", border: "1px solid #9ae6b4", borderRadius: 10,
          padding: "16px 20px", textAlign: "center", fontSize: 13, fontWeight: 600, color: GREEN,
        }}>
          ✓ All parties are within acceptable thresholds for this period.
        </div>
      )}
    </div>
  );
}

// ─── Flag row sub-component ───────────────────────────────────────────────────
function FlagRow({ color, bg, border, icon, title, parties, detail }) {
  return (
    <div style={{ background: bg, border: `1px solid ${border}`, borderRadius: 8, padding: "10px 14px" }}>
      <div style={{ fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>
        {icon} {title}
      </div>
      <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
        {parties.map(p => (
          <span key={p.name} style={{
            background: "#fff", border: `1px solid ${border}`, borderRadius: 6,
            padding: "3px 10px", fontSize: 11, color: "#2d3748", fontWeight: 500,
          }}>
            {p.name} <span style={{ color, fontWeight: 700 }}>({detail(p)})</span>
          </span>
        ))}
      </div>
    </div>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────
const numTd = {
  padding: "10px 12px",
  textAlign: "right",
  borderBottom: "1px solid #f0f0f0",
  whiteSpace: "nowrap",
};