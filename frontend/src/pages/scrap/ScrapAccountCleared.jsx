import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import { fmt, fmtDate, fmtN, td, Spinner, overlay, modal } from "./scrapShared";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

export default function ScrapAccountCleared() {
  const [clearedAccounts, setClearedAccounts] = useState([]);
  const [loading, setLoading] = useState(false);
  const [partySheetModal, setPartySheetModal] = useState(null);
  const [partySheetTab, setPartySheetTab] = useState("summary");

  const fetchCleared = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await axios.get(`${API}/api/scrap/cleared`);
      setClearedAccounts(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchCleared();
  }, [fetchCleared]);

  const deleteCleared = async (id, partyName) => {
    if (!window.confirm(`Restore "${partyName}" back to Party View?`)) return;
    try {
      await axios.post(`${API}/api/scrap/unclear-party`, {
        party_name: partyName,
        cleared_id: id,
      });
      fetchCleared();
    } catch (e) {
      alert("Failed to restore: " + (e.response?.data?.error || e.message));
    }
  };

  const openPartySheet = async (partyName) => {
    try {
      const res = await axios.get(
        `${API}/api/scrap/party-sheet/${encodeURIComponent(partyName)}`
      );
      setPartySheetTab("summary");
      setPartySheetModal({ partyName, rows: res.data });
    } catch (e) {
      alert("Failed to load party sheet");
    }
  };

  return (
    <>
      <div>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 20 }}>
          <div>
            <h2 style={{ color: "#1a3c5e", margin: 0, fontSize: 18, fontWeight: 700 }}>
              Account Cleared
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#718096" }}>
              Records of settled party accounts
            </p>
          </div>
        </div>
        {loading ? (
          <Spinner />
        ) : (
          <div style={{ overflowX: "auto", borderRadius: 10, boxShadow: "0 1px 4px rgba(0,0,0,0.08)", border: "1px solid #e2e8f0" }}>
            <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
              <thead>
                <tr style={{ background: "#1a3c5e" }}>
                  {["#", "Party Name", "Cleared Date", "Cleared Amount", "Note", "Action"].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "11px 14px",
                        textAlign: h === "Party Name" || h === "Note" ? "left" : "right",
                        fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap",
                      }}
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {clearedAccounts.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                    onMouseEnter={(e) => (e.currentTarget.style.background = "#f0fff4")}
                    onMouseLeave={(e) => (e.currentTarget.style.background = i % 2 === 0 ? "#fff" : "#f8fafc")}
                  >
                    <td style={{ ...td, textAlign: "right" }}>{row.id}</td>
                    <td style={{ ...td, fontWeight: 600, color: "#2d3748" }}>{row.party_name}</td>
                    <td style={{ ...td, textAlign: "right" }}>{fmtDate(row.cleared_date)}</td>
                    <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#276749" }}>
                      NPR {fmt(row.cleared_amount)}
                    </td>
                    <td style={{ ...td, color: "#718096", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis" }}>
                      {row.note || "—"}
                    </td>
                    <td style={{ ...td, textAlign: "right", whiteSpace: "nowrap" }}>
                      <button
                        onClick={() => openPartySheet(row.party_name)}
                        style={{
                          padding: "3px 10px", fontSize: 11, border: "none",
                          borderRadius: 5, cursor: "pointer", background: "#1a3c5e",
                          color: "#fff", fontWeight: 600, marginRight: 6,
                        }}
                      >
                        View
                      </button>
                      <button
                        onClick={() => deleteCleared(row.id, row.party_name)}
                        style={{
                          padding: "3px 10px", fontSize: 11, border: "1px solid #fed7d7",
                          borderRadius: 5, cursor: "pointer", background: "#fff5f5",
                          color: "#c53030", fontWeight: 600,
                        }}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
                {clearedAccounts.length === 0 && (
                  <tr>
                    <td colSpan={6} style={{ textAlign: "center", color: "#a0aec0", padding: 48, fontSize: 13 }}>
                      No cleared accounts yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Party Sheet Modal ── */}
      {partySheetModal && (
        <div style={overlay}>
          <div style={{ ...modal, width: "90vw", maxWidth: 980, maxHeight: "90vh", overflowY: "auto" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 16 }}>
              <div>
                <h3 style={{ margin: 0, color: "#1a3c5e", fontWeight: 700 }}>Party Sheet</h3>
                <p style={{ margin: "3px 0 0", color: "#718096", fontSize: 13 }}>
                  {partySheetModal.partyName}
                  <span style={{ marginLeft: 10, background: "#f0fff4", color: "#276749", border: "1px solid #9ae6b4", borderRadius: 4, padding: "1px 8px", fontSize: 11, fontWeight: 700 }}>
                    ✓ Account Cleared
                  </span>
                </p>
              </div>
              <button onClick={() => setPartySheetModal(null)} style={{ background: "none", border: "none", fontSize: 22, cursor: "pointer", color: "#a0aec0", lineHeight: 1 }}>×</button>
            </div>

            {/* Tabs */}
            <div style={{ display: "flex", gap: 4, marginBottom: 16, borderBottom: "2px solid #e2e8f0" }}>
              {[{ key: "summary", label: "📊 Summary" }, { key: "freight", label: "🚛 Freight & Expenses" }].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPartySheetTab(t.key)}
                  style={{
                    padding: "7px 18px", border: "none", cursor: "pointer", fontWeight: 600, fontSize: 12,
                    background: "none", color: partySheetTab === t.key ? "#1a3c5e" : "#718096",
                    borderBottom: partySheetTab === t.key ? "2px solid #1a3c5e" : "2px solid transparent",
                    marginBottom: -2, borderRadius: 0,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

            {/* Summary Tab */}
            {partySheetTab === "summary" && (
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#1a3c5e" }}>
                      {["#", "GRN", "Our Weight", "Total Lab %", "Rate", "Superseded Rate", "Net Payable"].map((h) => (
                        <th key={h} style={{ padding: "10px 12px", textAlign: h === "#" || h === "GRN" ? "left" : "right", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partySheetModal.rows.map((row, i) => (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={td}>{row.id}</td>
                        <td style={td}>{row.grn || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtN(row.our_weight)}</td>
                        <td style={{ ...td, textAlign: "right", color: "#c53030", fontWeight: 600 }}>
                          {row.total_lab_report != null ? `${fmtN(row.total_lab_report)}%` : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtN(row.bill_rate)}</td>
                        <td style={{ ...td, textAlign: "right", color: row.superseded_rate ? "#2b6cb0" : "#a0aec0" }}>
                          {row.superseded_rate != null ? fmtN(row.superseded_rate) : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#276749" }}>
                          NPR {fmt(row.net_payable)}
                        </td>
                      </tr>
                    ))}
                    {partySheetModal.rows.length > 0 && (() => {
                      const totalNet = partySheetModal.rows.reduce((s, r) => s + (parseFloat(r.net_payable) || 0), 0);
                      const totalOw = partySheetModal.rows.reduce((s, r) => s + (parseFloat(r.our_weight) || 0), 0);
                      return (
                        <tr style={{ background: "#1a3c5e", fontWeight: 700 }}>
                          <td style={{ ...td, color: "#fff" }} colSpan={2}>TOTAL</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmtN(totalOw)}</td>
                          <td style={{ ...td, color: "#fff" }}>—</td>
                          <td style={{ ...td, color: "#fff" }}>—</td>
                          <td style={{ ...td, color: "#fff" }}>—</td>
                          <td style={{ ...td, textAlign: "right", color: "#90cdf4" }}>NPR {fmt(totalNet)}</td>
                        </tr>
                      );
                    })()}
                    {partySheetModal.rows.length === 0 && (
                      <tr><td colSpan={7} style={{ textAlign: "center", color: "#a0aec0", padding: 40, fontSize: 13 }}>No entries for this party.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* Freight Tab */}
            {partySheetTab === "freight" && (
              <div style={{ overflowX: "auto", borderRadius: 8, border: "1px solid #e2e8f0" }}>
                <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                  <thead>
                    <tr style={{ background: "#1a3c5e" }}>
                      {["#", "GRN", "Bill Weight", "Freight", "Hetauda Tax", "Simra Tax", "Birgunj Tax", "Other Exp", "Total Expenses", "Per KG Cost", "Net Payable"].map((h) => (
                        <th key={h} style={{ padding: "10px 10px", textAlign: "right", fontSize: 11, fontWeight: 700, color: "#fff", whiteSpace: "nowrap", borderRight: "1px solid rgba(255,255,255,0.08)" }}>
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partySheetModal.rows.map((row, i) => (
                      <tr key={row.id} style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}>
                        <td style={{ ...td, textAlign: "right" }}>{row.id}</td>
                        <td style={{ ...td, textAlign: "right" }}>{row.grn || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmtN(row.bill_weight)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(row.freight)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(row.scrap_tax_hetauda)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(row.scrap_tax_simra)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(row.scrap_tax_birgunj)}</td>
                        <td style={{ ...td, textAlign: "right" }}>{fmt(row.other_expenses)}</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 600 }}>NPR {fmt(row.total_expenses)}</td>
                        <td style={{ ...td, textAlign: "right" }}>NPR {fmt(row.per_kg_cost)}/kg</td>
                        <td style={{ ...td, textAlign: "right", fontWeight: 700, color: "#276749" }}>NPR {fmt(row.net_payable)}</td>
                      </tr>
                    ))}
                    {partySheetModal.rows.length > 0 && (() => {
                      const t = partySheetModal.rows.reduce((acc, r) => ({
                        bill_weight: acc.bill_weight + (parseFloat(r.bill_weight) || 0),
                        freight: acc.freight + (parseFloat(r.freight) || 0),
                        scrap_tax_hetauda: acc.scrap_tax_hetauda + (parseFloat(r.scrap_tax_hetauda) || 0),
                        scrap_tax_simra: acc.scrap_tax_simra + (parseFloat(r.scrap_tax_simra) || 0),
                        scrap_tax_birgunj: acc.scrap_tax_birgunj + (parseFloat(r.scrap_tax_birgunj) || 0),
                        other_expenses: acc.other_expenses + (parseFloat(r.other_expenses) || 0),
                        total_expenses: acc.total_expenses + (parseFloat(r.total_expenses) || 0),
                        net_payable: acc.net_payable + (parseFloat(r.net_payable) || 0),
                      }), { bill_weight: 0, freight: 0, scrap_tax_hetauda: 0, scrap_tax_simra: 0, scrap_tax_birgunj: 0, other_expenses: 0, total_expenses: 0, net_payable: 0 });
                      return (
                        <tr style={{ background: "#1a3c5e", fontWeight: 700 }}>
                          <td style={{ ...td, color: "#fff" }} colSpan={2}>TOTAL</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmtN(t.bill_weight)}</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmt(t.freight)}</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmt(t.scrap_tax_hetauda)}</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmt(t.scrap_tax_simra)}</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmt(t.scrap_tax_birgunj)}</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>{fmt(t.other_expenses)}</td>
                          <td style={{ ...td, textAlign: "right", color: "#fff" }}>NPR {fmt(t.total_expenses)}</td>
                          <td style={{ ...td, color: "#fff" }}>—</td>
                          <td style={{ ...td, textAlign: "right", color: "#90cdf4" }}>NPR {fmt(t.net_payable)}</td>
                        </tr>
                      );
                    })()}
                    {partySheetModal.rows.length === 0 && (
                      <tr><td colSpan={11} style={{ textAlign: "center", color: "#a0aec0", padding: 40, fontSize: 13 }}>No entries for this party.</td></tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                onClick={() => setPartySheetModal(null)}
                style={{ padding: "9px 24px", background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, cursor: "pointer", fontWeight: 600, fontSize: 13 }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}