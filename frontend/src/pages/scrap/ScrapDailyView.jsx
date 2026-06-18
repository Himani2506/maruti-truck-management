import React, { useState, useEffect, useCallback } from "react";
import {
  getScrapEntries,
  updateScrapEntry,
  overrideScrapEntry,
} from "../../api";
import * as XLSX from "xlsx";
import PartySelector from "../../components/PartySelector";
import { useAuth } from "../../context/AuthContext";
import {
  fmt,
  fmtN,
  fmtDate,
  calcNetPayable,
  LAB_FIELDS,
  inp,
  td,
  exportBtn,
  overlay,
  modal,
  grid,
  Field,
  Spinner,
  adToBSString,
  bsStringToAD,
} from "./scrapShared";

export default function ScrapDailyView() {
  const { isAdmin } = useAuth();
  const [entries, setEntries] = useState([]);
  const [filteredEntries, setFilteredEntries] = useState([]);
  const [loading, setLoading] = useState(false);
  const [overrideModal, setOverrideModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [filterDate, setFilterDate] = useState("");
  const [filterParty, setFilterParty] = useState("");
  const [filterVehicle, setFilterVehicle] = useState("");
  const [dateSort, setDateSort] = useState("desc");
  const [filterDateFrom, setFilterDateFrom] = useState("");
  const [filterDateTo, setFilterDateTo] = useState("");
  const [knownVehicles, setKnownVehicles] = useState([]);

  const buildKnownVehicles = useCallback((rows) => {
    const set = new Set();
    rows.forEach(
      (r) => r.vehicle_no && set.add(r.vehicle_no.trim().toUpperCase()),
    );
    setKnownVehicles([...set].sort());
  }, []);

  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getScrapEntries();
      setEntries(data);
      setFilteredEntries(data);
      buildKnownVehicles(data);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [buildKnownVehicles]);

  useEffect(() => {
    fetchEntries();
  }, [fetchEntries]);

  useEffect(() => {
    let result = [...entries];

    if (filterDateFrom || filterDateTo) {
      result = result.filter((r) => {
        const d = r.unloading_date_bs || "";
        const toSort = (s) => {
          const p = s.replace(/\//g, "");
          if (p.length < 8) return "";
          return `${p.slice(4, 8)}/${p.slice(2, 4)}/${p.slice(0, 2)}`;
        };
        const ds = toSort(d);
        const from = filterDateFrom ? toSort(filterDateFrom) : "";
        const to = filterDateTo ? toSort(filterDateTo) : "";
        if (from && ds < from) return false;
        if (to && ds > to) return false;
        return true;
      });
    } else if (filterDate) {
      result = result.filter((r) => r.unloading_date_bs?.includes(filterDate));
    }

    if (filterParty) {
      result = result.filter((r) =>
        r.source?.toLowerCase().includes(filterParty.toLowerCase()),
      );
    }
    if (filterVehicle) {
      result = result.filter((r) =>
        r.vehicle_no?.toLowerCase().includes(filterVehicle.toLowerCase()),
      );
    }
    if (!isAdmin) {
      result = result.filter((r) => !r.is_overridden);
    }
    result.sort((a, b) => {
      const da = new Date(a.unloading_date_ad).getTime() || 0;
      const db = new Date(b.unloading_date_ad).getTime() || 0;
      return dateSort === "asc" ? da - db : db - da;
    });

    setFilteredEntries(result);
  }, [
    filterDate,
    filterDateFrom,
    filterDateTo,
    filterParty,
    filterVehicle,
    entries,
    dateSort,
  ]);

  const openEdit = (row) => setEditModal({ ...row });

  const handleEditChange = (field, value) => {
    setEditModal((prev) => {
      const next = { ...prev, [field]: value };
      if (field === "unloading_date_ad" && value)
        next.unloading_date_bs = adToBSString(value);
      if (field === "unloading_date_bs") {
        const digits = value.replace(/\D/g, "");
        let formatted = digits;
        if (digits.length > 2)
          formatted = digits.slice(0, 2) + "/" + digits.slice(2);
        if (digits.length > 4)
          formatted =
            digits.slice(0, 2) +
            "/" +
            digits.slice(2, 4) +
            "/" +
            digits.slice(4, 8);
        next.unloading_date_bs = formatted;
        if (digits.length === 8) {
          const ad = bsStringToAD(formatted);
          if (ad) next.unloading_date_ad = ad;
        }
      }
      return next;
    });
  };

  const saveEdit = async () => {
    try {
      await updateScrapEntry(editModal.id, editModal);
      setEditModal(null);
      fetchEntries();
    } catch (e) {
      alert("Failed to save: " + (e.response?.data?.error || e.message));
    }
  };

  const openOverride = (row) =>
    setOverrideModal({
      row,
      superseded_rate: row.superseded_rate ?? "",
      superseded_rejection: row.superseded_rejection ?? "",
    });

  const saveOverride = async () => {
    try {
      await overrideScrapEntry(overrideModal.row.id, {
        superseded_rate:
          overrideModal.superseded_rate !== ""
            ? overrideModal.superseded_rate
            : null,
        superseded_rejection:
          overrideModal.superseded_rejection !== ""
            ? overrideModal.superseded_rejection
            : null,
      });
      setOverrideModal(null);
      fetchEntries();
    } catch (e) {
      alert("Failed: " + (e.response?.data?.error || e.message));
    }
  };

  const exportDailyExcel = () => {
    const rows = filteredEntries.map((r) => ({
      "Date (AD)": r.unloading_date_ad,
      "Date (BS)": r.unloading_date_bs,
      GEN: r.gen,
      GRN: r.grn,
      "Party Name": r.source,
      "Vehicle No": r.vehicle_no,
      "Party Bill No": r.party_bill_no,
      "Bill Weight": r.bill_weight,
      "Bill Rate": r.bill_rate,
      Amount: r.amount,
      VAT: r.vat,
      Total: r.total,
      "Our Weight": r.our_weight,
      Shortage: r.shortage,
      "Duplex %": r.duplex,
      "Plastic %": r.plastic,
      "Pin %": r.pin,
      "Raining Water %": r.raining_water,
      "Dust %": r.dust,
      "Millboard %": r.millboard,
      "Extra %": r.extra,
      "Total Lab Report %": r.total_lab_report,
      "Moisture %": r.moisture,
      "Scrap Tax Birgunj": r.scrap_tax_birgunj,
      "Scrap Tax Simra": r.scrap_tax_simra,
      "Scrap Tax Hetauda": r.scrap_tax_hetauda,
      "Other Taxes": r.other_taxes,
      "Other Expenses": r.other_expenses,
      Freight: r.freight,
      "Total Cash Given": r.total_cash_given,
      Remarks: r.remarks,
      "Superseded Rate": r.superseded_rate,
      "Superseded Rejection %": r.superseded_rejection,
      "Net Payable": r.net_payable,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, "Daily Scrap");
    XLSX.writeFile(wb, "scrap_daily_report.xlsx");
  };

  return (
    <>
      <div>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            marginBottom: 14,
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
              Daily Scrap Entries
            </h2>
            <p style={{ margin: "3px 0 0", fontSize: 12, color: "#718096" }}>
              <span
                style={{
                  background: "#ebf8ff",
                  padding: "2px 7px",
                  borderRadius: 4,
                  border: "1px solid #90cdf4",
                  marginRight: 6,
                }}
              >
                🔵 Override active
              </span>
              Click <strong>Override</strong> to set superseded values ·{" "}
              <strong>Edit</strong> to update
            </p>
          </div>
          <button onClick={exportDailyExcel} style={exportBtn}>
            ⬇ Export Excel
          </button>
        </div>

        {/* ── Filters ── */}
        <div
          style={{
            display: "flex",
            gap: 10,
            marginBottom: 14,
            flexWrap: "wrap",
            background: "#f7fafc",
            border: "1px solid #e2e8f0",
            borderRadius: 10,
            padding: "12px 16px",
            alignItems: "flex-end",
          }}
        >
          <Field label="Filter by BS Date">
            <input
              type="text"
              value={filterDate}
              onChange={(e) => setFilterDate(e.target.value)}
              style={{ ...inp, width: 150 }}
              placeholder="e.g. 01/09/2081"
              maxLength={10}
            />
          </Field>
          <Field label="BS Date From">
            <input
              type="text"
              value={filterDateFrom}
              onChange={(e) => setFilterDateFrom(e.target.value)}
              style={{ ...inp, width: 140 }}
              placeholder="01/09/2081"
              maxLength={10}
            />
          </Field>
          <Field label="BS Date To">
            <input
              type="text"
              value={filterDateTo}
              onChange={(e) => setFilterDateTo(e.target.value)}
              style={{ ...inp, width: 140 }}
              placeholder="30/09/2081"
              maxLength={10}
            />
          </Field>
          <Field label="Filter by Party">
            <input
              type="text"
              value={filterParty}
              onChange={(e) => setFilterParty(e.target.value)}
              style={{ ...inp, width: 180 }}
              placeholder="Type party name…"
            />
          </Field>
          <Field label="Filter by Vehicle">
            <input
              type="text"
              value={filterVehicle}
              onChange={(e) => setFilterVehicle(e.target.value)}
              style={{ ...inp, width: 130 }}
              placeholder="Vehicle no…"
            />
          </Field>
          {(filterDate ||
            filterDateFrom ||
            filterDateTo ||
            filterParty ||
            filterVehicle) && (
            <button
              onClick={() => {
                setFilterDate("");
                setFilterDateFrom("");
                setFilterDateTo("");
                setFilterParty("");
                setFilterVehicle("");
              }}
              style={{
                padding: "7px 14px",
                background: "#fff",
                color: "#c53030",
                border: "1px solid #fed7d7",
                borderRadius: 6,
                cursor: "pointer",
                fontSize: 12,
                fontWeight: 600,
                alignSelf: "flex-end",
              }}
            >
              ✕ Clear Filters
            </button>
          )}
          {(filterDate ||
            filterDateFrom ||
            filterDateTo ||
            filterParty ||
            filterVehicle) && (
            <span
              style={{
                alignSelf: "flex-end",
                fontSize: 12,
                color: "#718096",
                paddingBottom: 2,
              }}
            >
              Showing {filteredEntries.length} of {entries.length}
            </span>
          )}
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
                  <th
                    style={{
                      padding: "10px 8px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                    }}
                  >
                    #
                  </th>
                  <th
                    style={{
                      padding: "10px 8px",
                      textAlign: "left",
                      fontSize: 11,
                      fontWeight: 700,
                      color: "#fff",
                      whiteSpace: "nowrap",
                      borderRight: "1px solid rgba(255,255,255,0.08)",
                      cursor: "pointer",
                      userSelect: "none",
                    }}
                    onClick={() =>
                      setDateSort((s) => (s === "asc" ? "desc" : "asc"))
                    }
                  >
                    Date {dateSort === "asc" ? "▲" : "▼"}
                  </th>
                  {[
                    "BS Date",
                    "GEN",
                    "GRN",
                    "Party",
                    "Vehicle",
                    "Bill No",
                    "Bill Wt",
                    "Rate",
                    "Amount",
                    "VAT",
                    "Total",
                    "Our Wt",
                    "Shortage",
                    "Duplex%",
                    "Plastic%",
                    "Pin%",
                    "Rain%",
                    "Dust%",
                    "Millboard%",
                    "Extra%",
                    "Lab%",
                    "Moisture%",
                    "Tax BJ",
                    "Tax SM",
                    "Tax HT",
                    "Other Tax",
                    "Other Exp",
                    "Freight",
                    "Cash Given",
                    "Remarks",
                    "Sup Rate",
                    "Sup Rej%",
                    "Net Payable",
                    "Actions",
                  ].map((h) => (
                    <th
                      key={h}
                      style={{
                        padding: "10px 8px",
                        textAlign: "left",
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
                {filteredEntries.map((row, i) => (
                  <tr
                    key={row.id}
                    style={{
                      background: row.is_overridden
                        ? "#ebf8ff"
                        : i % 2 === 0
                          ? "#fff"
                          : "#f8fafc",
                    }}
                    onMouseEnter={(e) =>
                      (e.currentTarget.style.background = "#f0f7ff")
                    }
                    onMouseLeave={(e) =>
                      (e.currentTarget.style.background = row.is_overridden
                        ? "#ebf8ff"
                        : i % 2 === 0
                          ? "#fff"
                          : "#f8fafc")
                    }
                  >
                    <td style={td}>{row.id}</td>
                    <td style={td}>{fmtDate(row.unloading_date_ad)}</td>
                    <td style={td}>{row.unloading_date_bs || "—"}</td>
                    <td style={td}>{row.gen || "—"}</td>
                    <td style={td}>{row.grn || "—"}</td>
                    <td
                      style={{
                        ...td,
                        maxWidth: 130,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        fontWeight: 500,
                      }}
                    >
                      {row.source}
                    </td>
                    <td style={td}>{row.vehicle_no || "—"}</td>
                    <td style={td}>{row.party_bill_no || "—"}</td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.bill_weight)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.bill_rate)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.amount)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.vat)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.total)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.our_weight)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontWeight: 600,
                        color:
                          parseFloat(row.shortage) > 0 ? "#c53030" : "#276749",
                      }}
                    >
                      {fmtN(row.shortage)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.duplex)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.plastic)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.pin)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.raining_water)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.dust)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.millboard)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmtN(row.extra)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        fontWeight: 600,
                        color: "#c53030",
                      }}
                    >
                      {fmtN(row.total_lab_report)}
                    </td>
                    <td style={{ ...td, textAlign: "right", color: "#718096" }}>
                      {fmtN(row.moisture)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.scrap_tax_birgunj)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.scrap_tax_simra)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.scrap_tax_hetauda)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.other_taxes)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.other_expenses)}
                    </td>
                    <td style={{ ...td, textAlign: "right" }}>
                      {fmt(row.freight)}
                    </td>
                    <td
                      style={{
                        ...td,
                        textAlign: "right",
                        color: "#2b6cb0",
                        fontWeight: 600,
                      }}
                    >
                      {row.total_cash_given
                        ? `NPR ${fmt(row.total_cash_given)}`
                        : "—"}
                    </td>
                    <td
                      style={{
                        ...td,
                        maxWidth: 120,
                        overflow: "hidden",
                        textOverflow: "ellipsis",
                        color: "#718096",
                      }}
                    >
                      {row.remarks || "—"}
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
                        color: row.superseded_rejection ? "#2b6cb0" : "#a0aec0",
                      }}
                    >
                      {row.superseded_rejection != null
                        ? fmtN(row.superseded_rejection)
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
                    <td style={{ ...td, whiteSpace: "nowrap" }}>
                      {isAdmin ? (
                        <>
                          <button
                            onClick={() => openEdit(row)}
                            style={{
                              padding: "3px 10px",
                              fontSize: 11,
                              border: "1px solid #e2e8f0",
                              borderRadius: 5,
                              cursor: "pointer",
                              background: "#fff",
                              color: "#2d3748",
                              fontWeight: 600,
                              marginRight: 4,
                            }}
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => openOverride(row)}
                            style={{
                              padding: "3px 10px",
                              fontSize: 11,
                              border: "none",
                              borderRadius: 5,
                              cursor: "pointer",
                              background: "#2b6cb0",
                              color: "#fff",
                              fontWeight: 600,
                            }}
                          >
                            Override
                          </button>
                        </>
                      ) : (
                        <span style={{ color: "#a0aec0", fontSize: 11 }}>
                          —
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
                {filteredEntries.length === 0 && (
                  <tr>
                    <td
                      colSpan={37}
                      style={{
                        textAlign: "center",
                        color: "#a0aec0",
                        padding: 48,
                        fontSize: 13,
                      }}
                    >
                      {entries.length > 0
                        ? "No entries match your filters."
                        : "No entries yet."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ══ OVERRIDE MODAL ══ */}
      {overrideModal && (
        <div style={overlay}>
          <div style={modal}>
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                marginBottom: 20,
              }}
            >
              <div>
                <h3
                  style={{
                    margin: 0,
                    color: "#1a3c5e",
                    fontSize: 16,
                    fontWeight: 700,
                  }}
                >
                  Admin Override
                </h3>
                <p
                  style={{ margin: "4px 0 0", color: "#718096", fontSize: 13 }}
                >
                  Entry #{overrideModal.row.id} —{" "}
                  <strong>{overrideModal.row.source}</strong>
                </p>
              </div>
              <button
                onClick={() => setOverrideModal(null)}
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
            <div
              style={{
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                marginBottom: 20,
              }}
            >
              {[
                {
                  label: "Bill Rate",
                  value: fmtN(overrideModal.row.bill_rate),
                },
                {
                  label: "Lab Total",
                  value: `${fmtN(overrideModal.row.total_lab_report)}%`,
                },
              ].map((item) => (
                <div
                  key={item.label}
                  style={{
                    background: "#f7fafc",
                    border: "1px solid #e2e8f0",
                    borderRadius: 8,
                    padding: "10px 12px",
                    textAlign: "center",
                  }}
                >
                  <div
                    style={{
                      fontSize: 10,
                      color: "#718096",
                      marginBottom: 4,
                      textTransform: "uppercase",
                      letterSpacing: "0.05em",
                    }}
                  >
                    {item.label}
                  </div>
                  <div
                    style={{ fontSize: 15, fontWeight: 700, color: "#2d3748" }}
                  >
                    {item.value}
                  </div>
                </div>
              ))}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <Field label="Superseded Rate">
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.0001"
                    value={overrideModal.superseded_rate}
                    onChange={(e) =>
                      setOverrideModal((p) => ({
                        ...p,
                        superseded_rate: e.target.value,
                      }))
                    }
                    style={{ ...inp, paddingRight: 72 }}
                    placeholder={`Default: ${overrideModal.row.bill_rate}`}
                  />
                  {overrideModal.superseded_rate !== "" && (
                    <button
                      onClick={() =>
                        setOverrideModal((p) => ({ ...p, superseded_rate: "" }))
                      }
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 11,
                        color: "#e53e3e",
                        background: "#fff5f5",
                        border: "1px solid #fed7d7",
                        borderRadius: 4,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </Field>
              <Field label="Superseded Rejection %">
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.01"
                    value={overrideModal.superseded_rejection}
                    onChange={(e) =>
                      setOverrideModal((p) => ({
                        ...p,
                        superseded_rejection: e.target.value,
                      }))
                    }
                    style={{ ...inp, paddingRight: 72 }}
                    placeholder={`Default: ${overrideModal.row.total_lab_report}%`}
                  />
                  {overrideModal.superseded_rejection !== "" && (
                    <button
                      onClick={() =>
                        setOverrideModal((p) => ({
                          ...p,
                          superseded_rejection: "",
                        }))
                      }
                      style={{
                        position: "absolute",
                        right: 8,
                        top: "50%",
                        transform: "translateY(-50%)",
                        fontSize: 11,
                        color: "#e53e3e",
                        background: "#fff5f5",
                        border: "1px solid #fed7d7",
                        borderRadius: 4,
                        padding: "2px 8px",
                        cursor: "pointer",
                      }}
                    >
                      Clear
                    </button>
                  )}
                </div>
              </Field>
            </div>
            <div
              style={{
                marginTop: 16,
                background: "#f0fff4",
                border: "1px solid #9ae6b4",
                borderRadius: 8,
                padding: "12px 16px",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
              }}
            >
              <span style={{ fontSize: 13, color: "#276749", fontWeight: 600 }}>
                Preview Net Payable
              </span>
              <span style={{ fontSize: 17, fontWeight: 800, color: "#276749" }}>
                NPR{" "}
                {fmt(
                  calcNetPayable({
                    ...overrideModal.row,
                    superseded_rate:
                      overrideModal.superseded_rate !== ""
                        ? overrideModal.superseded_rate
                        : null,
                    superseded_rejection:
                      overrideModal.superseded_rejection !== ""
                        ? overrideModal.superseded_rejection
                        : null,
                  }),
                )}
              </span>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={saveOverride}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  background: "#1a3c5e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save Override
              </button>
              <button
                onClick={() => setOverrideModal(null)}
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

      {/* ══ EDIT MODAL ══ */}
      {editModal && (
        <div style={overlay}>
          <div
            style={{
              ...modal,
              width: 700,
              maxHeight: "90vh",
              overflowY: "auto",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                marginBottom: 20,
              }}
            >
              <h3 style={{ margin: 0, color: "#1a3c5e", fontWeight: 700 }}>
                Edit Entry #{editModal.id}
              </h3>
              <button
                onClick={() => setEditModal(null)}
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
            <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div style={grid(2)}>
                <Field label="Date (AD)" required>
                  <input
                    type="date"
                    value={editModal.unloading_date_ad || ""}
                    onChange={(e) =>
                      handleEditChange("unloading_date_ad", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Date (BS)">
                  <input
                    type="text"
                    value={editModal.unloading_date_bs || ""}
                    onChange={(e) =>
                      handleEditChange("unloading_date_bs", e.target.value)
                    }
                    style={inp}
                    maxLength={10}
                  />
                </Field>
              </div>
              <div style={grid(2)}>
                <Field label="Gate Entry No. (GEN)">
                  <input
                    type="text"
                    value={editModal.gen || ""}
                    onChange={(e) => handleEditChange("gen", e.target.value)}
                    style={inp}
                  />
                </Field>
                <Field label="Gate Receipt No. (GRN)">
                  <input
                    type="text"
                    value={editModal.grn || ""}
                    onChange={(e) => handleEditChange("grn", e.target.value)}
                    style={inp}
                  />
                </Field>
              </div>
              <div style={grid(3)}>
                <Field label="Party Name" required>
                  <PartySelector
                    value={editModal.source || ""}
                    onChange={(name, freight) =>
                      setEditModal((p) => ({
                        ...p,
                        source: name,
                        freight: freight ?? p.freight,
                      }))
                    }
                    showAddress
                  />
                </Field>
                <Field label="Vehicle No.">
                  <input
                    type="text"
                    value={editModal.vehicle_no || ""}
                    onChange={(e) =>
                      handleEditChange("vehicle_no", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Party Bill No.">
                  <input
                    type="text"
                    value={editModal.party_bill_no || ""}
                    onChange={(e) =>
                      handleEditChange("party_bill_no", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
              </div>
              <div style={grid(2)}>
                <Field label="Bill Weight">
                  <input
                    type="number"
                    value={editModal.bill_weight || ""}
                    onChange={(e) =>
                      handleEditChange("bill_weight", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Bill Rate">
                  <input
                    type="number"
                    step="0.0001"
                    value={editModal.bill_rate || ""}
                    onChange={(e) =>
                      handleEditChange("bill_rate", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
              </div>
              <Field label="Our Weight">
                <input
                  type="number"
                  value={editModal.our_weight || ""}
                  onChange={(e) =>
                    handleEditChange("our_weight", e.target.value)
                  }
                  style={inp}
                />
              </Field>
              <div
                style={{
                  background: "#f7fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 8,
                  padding: "10px 12px",
                }}
              >
                <div
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    color: "#718096",
                    textTransform: "uppercase",
                    marginBottom: 8,
                  }}
                >
                  Lab Report
                </div>
                <Field label="Moisture (%)">
                  <input
                    type="number"
                    step="0.01"
                    value={editModal.moisture || ""}
                    onChange={(e) =>
                      handleEditChange("moisture", e.target.value)
                    }
                    style={inp}
                    placeholder="0"
                  />
                </Field>
                <div style={{ ...grid(4), marginTop: 8 }}>
                  {LAB_FIELDS.map((f) => (
                    <Field key={f.key} label={f.label}>
                      <input
                        type="number"
                        step="0.01"
                        value={editModal[f.key] || ""}
                        onChange={(e) =>
                          handleEditChange(f.key, e.target.value)
                        }
                        style={inp}
                        placeholder="0"
                      />
                    </Field>
                  ))}
                </div>
              </div>
              <div style={grid(3)}>
                <Field label="Tax Birgunj">
                  <input
                    type="number"
                    value={editModal.scrap_tax_birgunj || ""}
                    onChange={(e) =>
                      handleEditChange("scrap_tax_birgunj", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Tax Simra">
                  <input
                    type="number"
                    value={editModal.scrap_tax_simra || ""}
                    onChange={(e) =>
                      handleEditChange("scrap_tax_simra", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Tax Hetauda">
                  <input
                    type="number"
                    value={editModal.scrap_tax_hetauda || ""}
                    onChange={(e) =>
                      handleEditChange("scrap_tax_hetauda", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
              </div>
              <div style={grid(3)}>
                <Field label="Other Taxes">
                  <input
                    type="number"
                    value={editModal.other_taxes || ""}
                    onChange={(e) =>
                      handleEditChange("other_taxes", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Other Expenses">
                  <input
                    type="number"
                    value={editModal.other_expenses || ""}
                    onChange={(e) =>
                      handleEditChange("other_expenses", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
                <Field label="Freight">
                  <input
                    type="number"
                    value={editModal.freight || ""}
                    onChange={(e) =>
                      handleEditChange("freight", e.target.value)
                    }
                    style={inp}
                  />
                </Field>
              </div>
              <Field label="Total Cash Given">
                <input
                  type="number"
                  value={editModal.total_cash_given || ""}
                  onChange={(e) =>
                    handleEditChange("total_cash_given", e.target.value)
                  }
                  style={{ ...inp, borderColor: "#90cdf4" }}
                />
              </Field>
              <Field label="Remarks">
                <textarea
                  value={editModal.remarks || ""}
                  onChange={(e) => handleEditChange("remarks", e.target.value)}
                  style={{
                    ...inp,
                    resize: "vertical",
                    minHeight: 60,
                    fontFamily: "inherit",
                  }}
                  rows={2}
                />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 24 }}>
              <button
                onClick={saveEdit}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  background: "#1a3c5e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: "pointer",
                }}
              >
                Save Changes
              </button>
              <button
                onClick={() => setEditModal(null)}
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
    </>
  );
}
