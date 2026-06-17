import React, { useState, useEffect, useCallback } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { fmt, fmtN, td, exportBtn, overlay, modal, inp, grid, Field, Spinner } from "./scrapShared";
import { getScrapPartySummary } from "../../api";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

export default function ScrapPartyView() {
  const [partySummary, setPartySummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [xlsxData, setXlsxData] = useState({});
  const [openingEdits, setOpeningEdits] = useState({});
  const [savingOpening, setSavingOpening] = useState({});
  const [partySheetModal, setPartySheetModal] = useState(null);
  const [partySheetTab, setPartySheetTab] = useState("summary");
  const [clearModal, setClearModal] = useState(null);
  const [savingClear, setSavingClear] = useState(false);
  const [clearedAccounts, setClearedAccounts] = useState([]);

  const fetchPartySummary = useCallback(async () => {
    setLoading(true);
    try {
      setPartySummary(await getScrapPartySummary());
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, []);

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

  const openPartySheet = async (partyName) => {
    try {
      const res = await axios.get(
        `${API}/api/scrap/party-sheet/${encodeURIComponent(partyName)}`,
      );
      setPartySheetTab("summary");
      setPartySheetModal({ partyName, rows: res.data });
    } catch (e) {
      alert("Failed to load party sheet");
    }
  };
  const saveOpening = async (partyName) => {
      setSavingOpening((p) => ({ ...p, [partyName]: true }));
      try {
        await axios.put(
          `${API}/api/scrap/opening/${encodeURIComponent(partyName)}`,
          { opening: openingEdits[partyName] ?? 0 },
        );
        fetchPartySummary();
      } catch (e) {
        alert("Failed to save opening");
      } finally {
        setSavingOpening((p) => ({ ...p, [partyName]: false }));
      }
    };

    const handleXlsxUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = async (evt) => {
      const wb = XLSX.read(evt.target.result, { type: "binary" });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const map = {};
      for (let i = 9; i < rows.length; i++) {
        const row = rows[i];
        const partyName = row[0];
        if (
          !partyName ||
          typeof partyName !== "string" ||
          partyName.trim() === ""
        )
          continue;
        map[partyName.trim()] = {
          opening: parseFloat(row[1]) || 0,
          debit: parseFloat(row[2]) || 0,
          credit: parseFloat(row[3]) || 0,
          closing: parseFloat(row[4]) || 0,
        };
      }
      setXlsxData(map);
      try {
        await axios.post(`${API}/api/scrap/tally`, map);
      } catch (e) {
        console.error("Failed to persist tally:", e);
      }

      for (const ps of partySummary) {
        const xl = map[ps.party_name];
        if (!xl) continue;
        const opening = parseFloat(
          openingEdits[ps.party_name] ?? ps.opening ?? 0,
        );
        const balance =
          opening + parseFloat(ps.purchase_8283 || 0) - (xl.debit || 0);
        if (Math.abs(balance) < 0.01) {
          try {
            await axios.post(`${API}/api/scrap/clear-party`, {
              party_name: ps.party_name,
              cleared_amount: balance,
              note: "Auto-cleared: balance reached 0 after Tally upload",
              entry_ids: [],
            });
          } catch (_) {
            // already cleared — ignore
          }
        }
      }
      fetchPartySummary();
    };
    reader.readAsBinaryString(file);
  };

  const saveClearAccount = async () => {
    if (!clearModal?.partyName) return;
    setSavingClear(true);
    try {
      await axios.post(`${API}/api/scrap/clear-party`, {
        party_name: clearModal.partyName,
        cleared_amount: clearModal.amount,
        note: clearModal.note,
        entry_ids: [],
      });
      setClearModal(null);
      fetchPartySummary();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.error || e.message));
    } finally {
      setSavingClear(false);
    }
  };
  const exportPartyExcel = () => {
    const rows = partySummary.map((r) => {
      const xl = xlsxData[r.party_name] || {};
      const payment8081 = xl.debit || 0;
      const purchaseTally = xl.credit || 0;
      const balance =
        parseFloat(r.opening || 0) +
        parseFloat(r.purchase_8283 || 0) -
        payment8081;
      const difference = purchaseTally - parseFloat(r.purchase_8283 || 0);
      return {
        "Party Name": r.party_name,
        Opening: r.opening,
        "82-83 Purchase": r.purchase_8283,
        Deduction: r.deduction,
        "Weight Loss": r.weight_loss,
        "Rate Diff": r.rate_diff,
        "Rejection Rate": r.rejection_rate,
        "Superseded Rejection Rate": r.superseded_rejection_rate,
        "80-81 Payment": payment8081,
        Balance: balance,
        "Purchase as per Tally": purchaseTally,
        Difference: difference,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Party Summary");
    XLSX.writeFile(wb, "scrap_party_summary.xlsx");
  };
  useEffect(() => {
  fetchPartySummary();
  fetchCleared();
}, [fetchPartySummary, fetchCleared]);
  return( <>
          <div>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
                flexWrap: "wrap",
                gap: 12,
              }}
            >
              <div>
                <h2
                  style={{
                    color: "#1a3c5e",
                    margin: 0,
                    fontSize: 18,
                    fontWeight: 700,
                  }}
                >
                  Party-wise Summary
                </h2>
                <p style={{ margin: "3px 0 0", fontSize: 12, color: "#718096" }}>
                  Opening edits save automatically on blur
                </p>
              </div>
              <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                <label
                  style={{
                    ...exportBtn,
                    background: "#4a5568",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  📂 Upload Tally XLSX
                  <input
                    type="file"
                    accept=".xlsx,.xls"
                    onChange={handleXlsxUpload}
                    style={{ display: "none" }}
                  />
                </label>
                {Object.keys(xlsxData).length > 0 && (
                  <span
                    style={{
                      fontSize: 12,
                      color: "#276749",
                      background: "#f0fff4",
                      padding: "5px 12px",
                      borderRadius: 6,
                      border: "1px solid #9ae6b4",
                      fontWeight: 600,
                    }}
                  >
                    ✓ {Object.keys(xlsxData).length} parties
                  </span>
                )}
                <button onClick={exportPartyExcel} style={exportBtn}>
                  ⬇ Export Excel
                </button>
              </div>
            </div>
  
            {loading ? (
              <Spinner />
            ) : (
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 10,
                  boxShadow: "0 1px 4px rgba(0,0,0,0.08)",
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#1a3c5e" }}>
                      {[
                        "Party Name",
                        "Opening",
                        "82-83 Purchase",
                        "Deduction",
                        "Wt Loss",
                        "Rate Diff",
                        "Rej Rate",
                        "Sup Rej Rate",
                        "80-81 Payment",
                        "Balance",
                        "Purchase (Tally)",
                        "Difference",
                        "",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "11px 12px",
                            textAlign: h === "Party Name" ? "left" : "right",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partySummary.map((row, i) => {
                      const xl = xlsxData[row.party_name] || {};
                      const payment8081 = xl.debit || 0;
                      const purchaseTally = xl.credit || 0;
                      const opening = parseFloat(
                        openingEdits[row.party_name] ?? row.opening ?? 0,
                      );
                      const balance =
                        opening +
                        parseFloat(row.purchase_8283 || 0) -
                        payment8081;
                      const difference =
                        purchaseTally - parseFloat(row.purchase_8283 || 0);
                      return (
                        <tr
                          key={row.party_name}
                          style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                          onMouseEnter={(e) =>
                            (e.currentTarget.style.background = "#f0f7ff")
                          }
                          onMouseLeave={(e) =>
                            (e.currentTarget.style.background =
                              i % 2 === 0 ? "#fff" : "#f8fafc")
                          }
                        >
                          <td
                            style={{
                              ...td,
                              fontWeight: 600,
                              color: "#2b6cb0",
                              cursor: "pointer",
                              textDecoration: "underline",
                            }}
                            onClick={() => openPartySheet(row.party_name)}
                          >
                            {row.party_name}
                          </td>
                          <td
                            style={{ ...td, textAlign: "right", minWidth: 110 }}
                          >
                            <input
                              type="number"
                              value={
                                openingEdits[row.party_name] ?? row.opening ?? 0
                              }
                              onChange={(e) =>
                                setOpeningEdits((p) => ({
                                  ...p,
                                  [row.party_name]: e.target.value,
                                }))
                              }
                              onBlur={() => saveOpening(row.party_name)}
                              style={{
                                width: 100,
                                padding: "4px 8px",
                                borderRadius: 6,
                                border: "1px solid #e2e8f0",
                                fontSize: 12,
                                textAlign: "right",
                                outline: "none",
                                background: "#f7fafc",
                                boxSizing: "border-box",
                              }}
                            />
                          </td>
                          <td
                            style={{ ...td, textAlign: "right", fontWeight: 600 }}
                          >
                            NPR {fmt(row.purchase_8283)}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              color: "#c53030",
                            }}
                          >
                            NPR {fmt(row.deduction)}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              fontWeight: 600,
                              color:
                                parseFloat(row.weight_loss) > 0
                                  ? "#c53030"
                                  : "#276749",
                            }}
                          >
                            {fmtN(row.weight_loss)}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {fmtN(row.rate_diff)}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {fmtN(row.rejection_rate)}
                          </td>
                          <td style={{ ...td, textAlign: "right" }}>
                            {fmtN(row.superseded_rejection_rate)}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              color: payment8081 ? "#2d3748" : "#a0aec0",
                            }}
                          >
                            {payment8081 ? `NPR ${fmt(payment8081)}` : "—"}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              fontWeight: 700,
                              color: balance >= 0 ? "#276749" : "#c53030",
                            }}
                          >
                            NPR {fmt(balance)}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              color: purchaseTally ? "#2d3748" : "#a0aec0",
                            }}
                          >
                            {purchaseTally ? `NPR ${fmt(purchaseTally)}` : "—"}
                          </td>
                          <td
                            style={{
                              ...td,
                              textAlign: "right",
                              fontWeight: 600,
                              color: difference >= 0 ? "#276749" : "#c53030",
                            }}
                          >
                            {purchaseTally ? `NPR ${fmt(difference)}` : "—"}
                          </td>
                          <td style={{ ...td, textAlign: "center" }}>
                            <button
                              onClick={() => openPartySheet(row.party_name)}
                              style={{
                                padding: "4px 12px",
                                background: "#1a3c5e",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                                marginRight: 4,
                              }}
                            >
                              View
                            </button>
                            <button
                              onClick={() =>
                                setClearModal({
                                  partyName: row.party_name,
                                  amount: balance.toFixed(2),
                                  note: "",
                                })
                              }
                              style={{
                                padding: "4px 12px",
                                background: "#276749",
                                color: "#fff",
                                border: "none",
                                borderRadius: 6,
                                fontSize: 11,
                                fontWeight: 600,
                                cursor: "pointer",
                              }}
                            >
                              ✓ Clear
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                    {partySummary.length === 0 && (
                      <tr>
                        <td
                          colSpan={13}
                          style={{
                            textAlign: "center",
                            color: "#a0aec0",
                            padding: 48,
                            fontSize: 13,
                          }}
                        >
                          No data yet.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        
        {clearModal && (
        <div style={overlay}>
          <div style={{ ...modal, width: 440 }}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#1a3c5e", fontWeight: 700 }}>
                  Mark Account Cleared
                </h3>
                <p
                  style={{ margin: "4px 0 0", color: "#718096", fontSize: 13 }}
                >
                  {clearModal.partyName}
                </p>
              </div>
              <button
                onClick={() => setClearModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#a0aec0",
                }}
              >
                ×
              </button>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Cleared Amount (NPR)">
                <input
                  type="number"
                  value={clearModal.amount}
                  onChange={(e) =>
                    setClearModal((p) => ({ ...p, amount: e.target.value }))
                  }
                  style={{ ...inp, borderColor: "#9ae6b4" }}
                />
              </Field>
              <Field label="Note / Reference">
                <textarea
                  value={clearModal.note}
                  onChange={(e) =>
                    setClearModal((p) => ({ ...p, note: e.target.value }))
                  }
                  style={{
                    ...inp,
                    resize: "vertical",
                    minHeight: 60,
                    fontFamily: "inherit",
                  }}
                  placeholder="e.g. Cheque #1234…"
                  rows={2}
                />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={saveClearAccount}
                disabled={savingClear}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  background: "#276749",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: savingClear ? "not-allowed" : "pointer",
                  opacity: savingClear ? 0.7 : 1,
                }}
              >
                {savingClear ? "Saving…" : "✓ Confirm Cleared"}
              </button>
              <button
                onClick={() => setClearModal(null)}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  background: "#fff",
                  color: "#4a5568",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
      {partySheetModal && (
        <div style={overlay}>
          <div
            style={{
              ...modal,
              width: "90vw",
              maxWidth: 980,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 16,
              }}
            >
              <div>
                <h3 style={{ margin: 0, color: "#1a3c5e", fontWeight: 700 }}>
                  Party Sheet
                </h3>
                <p
                  style={{ margin: "3px 0 0", color: "#718096", fontSize: 13 }}
                >
                  {partySheetModal.partyName}
                  {clearedAccounts.find(
                    (c) => c.party_name === partySheetModal.partyName,
                  ) && (
                    <span
                      style={{
                        marginLeft: 10,
                        background: "#f0fff4",
                        color: "#276749",
                        border: "1px solid #9ae6b4",
                        borderRadius: 4,
                        padding: "1px 8px",
                        fontSize: 11,
                        fontWeight: 700,
                      }}
                    >
                      ✓ Account Cleared
                    </span>
                  )}
                </p>
              </div>
              <button
                onClick={() => setPartySheetModal(null)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 22,
                  cursor: "pointer",
                  color: "#a0aec0",
                  lineHeight: 1,
                }}
              >
                ×
              </button>
            </div>

            {/* tabs */}
            <div
              style={{
                display: "flex",
                gap: 4,
                marginBottom: 16,
                borderBottom: "2px solid #e2e8f0",
              }}
            >
              {[
                { key: "summary", label: "📊 Summary" },
                { key: "freight", label: "🚛 Freight & Expenses" },
              ].map((t) => (
                <button
                  key={t.key}
                  onClick={() => setPartySheetTab(t.key)}
                  style={{
                    padding: "7px 18px",
                    border: "none",
                    cursor: "pointer",
                    fontWeight: 600,
                    fontSize: 12,
                    background: "none",
                    color: partySheetTab === t.key ? "#1a3c5e" : "#718096",
                    borderBottom:
                      partySheetTab === t.key
                        ? "2px solid #1a3c5e"
                        : "2px solid transparent",
                    marginBottom: -2,
                    borderRadius: 0,
                  }}
                >
                  {t.label}
                </button>
              ))}
            </div>

           
            {partySheetTab === "summary" && (
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#1a3c5e" }}>
                      {[
                        "#",
                        "GRN",
                        "Our Weight",
                        "Total Lab %",
                        "Rate",
                        "Superseded Rate",
                        "Net Payable",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 12px",
                            textAlign:
                              h === "#" || h === "GRN" ? "left" : "right",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partySheetModal.rows.map((row, i) => (
                      <tr
                        key={row.id}
                        style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                      >
                        <td style={td}>{row.id}</td>
                        <td style={td}>{row.grn || "—"}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmtN(row.our_weight)}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            color: "#c53030",
                            fontWeight: 600,
                          }}
                        >
                          {row.total_lab_report != null
                            ? `${fmtN(row.total_lab_report)}%`
                            : "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmtN(row.bill_rate)}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            color: row.superseded_rate ? "#2b6cb0" : "#a0aec0",
                          }}
                        >
                          {row.superseded_rate != null
                            ? fmtN(row.superseded_rate)
                            : "—"}
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#276749",
                          }}
                        >
                          NPR {fmt(row.net_payable)}
                        </td>
                      </tr>
                    ))}
                    {partySheetModal.rows.length > 0 &&
                      (() => {
                        const totalNet = partySheetModal.rows.reduce(
                          (s, r) => s + (parseFloat(r.net_payable) || 0),
                          0,
                        );
                        const totalOw = partySheetModal.rows.reduce(
                          (s, r) => s + (parseFloat(r.our_weight) || 0),
                          0,
                        );
                        return (
                          <tr
                            style={{ background: "#1a3c5e", fontWeight: 700 }}
                          >
                            <td style={{ ...td, color: "#fff" }} colSpan={2}>
                              TOTAL
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmtN(totalOw)}
                            </td>
                            <td style={{ ...td, color: "#fff" }}>—</td>
                            <td style={{ ...td, color: "#fff" }}>—</td>
                            <td style={{ ...td, color: "#fff" }}>—</td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#90cdf4",
                              }}
                            >
                              NPR {fmt(totalNet)}
                            </td>
                          </tr>
                        );
                      })()}
                    {partySheetModal.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={7}
                          style={{
                            textAlign: "center",
                            color: "#a0aec0",
                            padding: 40,
                            fontSize: 13,
                          }}
                        >
                          No entries for this party.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            {/* ── FREIGHT TAB ── */}
            {partySheetTab === "freight" && (
              <div
                style={{
                  overflowX: "auto",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                }}
              >
                <table
                  style={{
                    width: "100%",
                    borderCollapse: "collapse",
                    fontSize: 12,
                  }}
                >
                  <thead>
                    <tr style={{ background: "#1a3c5e" }}>
                      {[
                        "#",
                        "GRN",
                        "Bill Weight",
                        "Freight",
                        "Hetauda Tax",
                        "Simra Tax",
                        "Birgunj Tax",
                        "Other Exp",
                        "Total Expenses",
                        "Per KG Cost",
                        "Net Payable",
                      ].map((h) => (
                        <th
                          key={h}
                          style={{
                            padding: "10px 10px",
                            textAlign: "right",
                            fontSize: 11,
                            fontWeight: 700,
                            color: "#fff",
                            whiteSpace: "nowrap",
                            borderRight: "1px solid rgba(255,255,255,0.08)",
                          }}
                        >
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {partySheetModal.rows.map((row, i) => (
                      <tr
                        key={row.id}
                        style={{ background: i % 2 === 0 ? "#fff" : "#f8fafc" }}
                      >
                        <td style={{ ...td, textAlign: "right" }}>{row.id}</td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {row.grn || "—"}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmtN(row.bill_weight)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmt(row.freight)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmt(row.scrap_tax_hetauda)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmt(row.scrap_tax_simra)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmt(row.scrap_tax_birgunj)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          {fmt(row.other_expenses)}
                        </td>
                        <td
                          style={{ ...td, textAlign: "right", fontWeight: 600 }}
                        >
                          NPR {fmt(row.total_expenses)}
                        </td>
                        <td style={{ ...td, textAlign: "right" }}>
                          NPR {fmt(row.per_kg_cost)}/kg
                        </td>
                        <td
                          style={{
                            ...td,
                            textAlign: "right",
                            fontWeight: 700,
                            color: "#276749",
                          }}
                        >
                          NPR {fmt(row.net_payable)}
                        </td>
                      </tr>
                    ))}
                    {partySheetModal.rows.length > 0 &&
                      (() => {
                        const t = partySheetModal.rows.reduce(
                          (acc, r) => ({
                            bill_weight:
                              acc.bill_weight +
                              (parseFloat(r.bill_weight) || 0),
                            freight: acc.freight + (parseFloat(r.freight) || 0),
                            scrap_tax_hetauda:
                              acc.scrap_tax_hetauda +
                              (parseFloat(r.scrap_tax_hetauda) || 0),
                            scrap_tax_simra:
                              acc.scrap_tax_simra +
                              (parseFloat(r.scrap_tax_simra) || 0),
                            scrap_tax_birgunj:
                              acc.scrap_tax_birgunj +
                              (parseFloat(r.scrap_tax_birgunj) || 0),
                            other_expenses:
                              acc.other_expenses +
                              (parseFloat(r.other_expenses) || 0),
                            total_expenses:
                              acc.total_expenses +
                              (parseFloat(r.total_expenses) || 0),
                            net_payable:
                              acc.net_payable +
                              (parseFloat(r.net_payable) || 0),
                          }),
                          {
                            bill_weight: 0,
                            freight: 0,
                            scrap_tax_hetauda: 0,
                            scrap_tax_simra: 0,
                            scrap_tax_birgunj: 0,
                            other_expenses: 0,
                            total_expenses: 0,
                            net_payable: 0,
                          },
                        );
                        return (
                          <tr
                            style={{ background: "#1a3c5e", fontWeight: 700 }}
                          >
                            <td style={{ ...td, color: "#fff" }} colSpan={2}>
                              TOTAL
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmtN(t.bill_weight)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmt(t.freight)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmt(t.scrap_tax_hetauda)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmt(t.scrap_tax_simra)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmt(t.scrap_tax_birgunj)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              {fmt(t.other_expenses)}
                            </td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#fff",
                              }}
                            >
                              NPR {fmt(t.total_expenses)}
                            </td>
                            <td style={{ ...td, color: "#fff" }}>—</td>
                            <td
                              style={{
                                ...td,
                                textAlign: "right",
                                color: "#90cdf4",
                              }}
                            >
                              NPR {fmt(t.net_payable)}
                            </td>
                          </tr>
                        );
                      })()}
                    {partySheetModal.rows.length === 0 && (
                      <tr>
                        <td
                          colSpan={11}
                          style={{
                            textAlign: "center",
                            color: "#a0aec0",
                            padding: 40,
                            fontSize: 13,
                          }}
                        >
                          No entries for this party.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            )}

            <div style={{ marginTop: 16, textAlign: "right" }}>
              <button
                onClick={() => setPartySheetModal(null)}
                style={{
                  padding: "9px 24px",
                  background: "#fff",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  cursor: "pointer",
                  fontWeight: 600,
                  fontSize: 13,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}
      </>
  )

    }