import React, { useState, useRef, useEffect } from "react";
import { createScrapEntry, getScrapEntries } from "../../api";
import PartySelector from "../../components/PartySelector";
import axios from "axios";
import {
  adToBSString,
  bsStringToAD,
  fmt,
  fmtN,
  LAB_FIELDS,
  GRN_PREFIXES,
  emptyForm,
  inp,
  grid,
  overlay,
  modal,
  Section,
  Field,
  Chip,
} from "./scrapShared";

const API = process.env.REACT_APP_API_URL || "http://localhost:4000";

export default function ScrapEntryForm() {
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [addPartyModal, setAddPartyModal] = useState(false);
  const [newParty, setNewParty] = useState({
    party_name: "",
    address: "",
    freight: "",
  });
  const [savingParty, setSavingParty] = useState(false);
  const [vehicleSuggestions, setVehicleSuggestions] = useState([]);
  const [showVehicleDropdown, setShowVehicleDropdown] = useState(false);
  const vehicleRef = useRef(null);
  const [partySelectorKey, setPartySelectorKey] = useState(0);

  const amount =
    (parseFloat(form.bill_weight) || 0) * (parseFloat(form.bill_rate) || 0);
  const vat = amount * 0.13;
  const total = amount + vat;
  const shortage =
    (parseFloat(form.bill_weight) || 0) - (parseFloat(form.our_weight) || 0);
  const totalRejection = LAB_FIELDS.reduce(
    (s, f) => s + (parseFloat(form[f.key]) || 0),
    0,
  );
  const totalLabReport = totalRejection + (parseFloat(form.moisture) || 0);
  const grn =
    form.grn_prefix === "None"
      ? form.grn_number
      : `${form.grn_prefix}${form.grn_number}`;

  const handleChange = (field, value) => {
    setForm((prev) => {
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

  const handleSubmit = async () => {
    if (submitting) return; // ← guard against double call
    if (!form.source)
      return setSubmitMsg({
        type: "error",
        text: "Source (Party Name) is required.",
      });
    if (!form.unloading_date_ad)
      return setSubmitMsg({
        type: "error",
        text: "Unloading date is required.",
      });
    if (!form.unloading_date_bs)
      return setSubmitMsg({ type: "error", text: "BS date is required." });

    setSubmitting(true);
    setSubmitMsg(null);
    try {
      const payload = {
        ...form,
        grn,
        grn_prefix: form.grn_prefix,
        grn_number: form.grn_number,
        freight: form.freight,
      };
      await createScrapEntry(payload);
      setForm(emptyForm);
      setSubmitMsg({ type: "success", text: "Entry saved successfully!" });
      setTimeout(() => {
        window.scrollTo({ top: 0, behavior: "smooth" });
        const dateInput = document.querySelector(
          "#scrap-form input[type='date']",
        );
        if (dateInput) dateInput.focus();
      }, 100);
    } catch (e) {
      setSubmitMsg({
        type: "error",
        text: e.response?.data?.error || "Failed to save entry.",
      });
    } finally {
      setSubmitting(false);
    }
  };
  const formKeyDown = (e) => {
    if (e.key === "Enter" && e.target.tagName !== "BUTTON") {
      e.preventDefault();
      const inputs = document.querySelectorAll(
        "#scrap-form input, #scrap-form select, #scrap-form textarea",
      );
      const arr = Array.from(inputs);
      const idx = arr.indexOf(e.target);
      if (idx > -1 && arr[idx + 1]) {
        arr[idx + 1].focus(); // ← only move focus, never auto-submit
      }
      // removed the else handleSubmit() — user must click Save explicitly
    }
  };

  const saveNewParty = async () => {
    if (!newParty.party_name.trim()) return alert("Party name is required");
    setSavingParty(true);
    try {
      await axios.post(`${API}/api/scrap/parties`, {
        party_name: newParty.party_name.trim(),
        address: newParty.address.trim(),
        freight: parseFloat(newParty.freight) || 0,
        opening: 0,
      });
      setAddPartyModal(false);
      setPartySelectorKey((k) => k + 1);
      setNewParty({ party_name: "", address: "", freight: "" });
      setSubmitMsg({
        type: "success",
        text: `Party "${newParty.party_name.trim()}" added!`,
      });
    } catch (e) {
      alert("Failed to add party: " + (e.response?.data?.error || e.message));
    } finally {
      setSavingParty(false);
    }
  };
  useEffect(() => {
    const handler = (e) => {
      if (document.activeElement.type === "number") {
        document.activeElement.blur();
      }
    };
    document.addEventListener("wheel", handler);
    return () => document.removeEventListener("wheel", handler);
  }, []);
  useEffect(() => {
    getScrapEntries()
      .then((data) => {
        const vehicles = [
          ...new Set(
            data.map((r) => r.vehicle_no?.trim().toUpperCase()).filter(Boolean),
          ),
        ].sort();
        setVehicleSuggestions(vehicles);
      })
      .catch(() => {});
  }, []);

  const handleVehicleInput = (value) => {
    handleChange("vehicle_no", value);
    setShowVehicleDropdown(value.length > 0);
  };

  const filteredVehicles = vehicleSuggestions.filter((v) =>
    v.includes(form.vehicle_no.trim().toUpperCase()),
  );

  return (
    <>
      <div
        id="scrap-form"
        style={{ maxWidth: 880, margin: "0 auto" }}
        onKeyDown={formKeyDown}
      >
        {submitMsg && (
          <div
            style={{
              padding: "10px 16px",
              borderRadius: 8,
              marginBottom: 16,
              background: submitMsg.type === "success" ? "#f0fff4" : "#fff5f5",
              color: submitMsg.type === "success" ? "#276749" : "#c53030",
              border: `1px solid ${submitMsg.type === "success" ? "#9ae6b4" : "#feb2b2"}`,
              fontSize: 13,
              fontWeight: 500,
            }}
          >
            {submitMsg.type === "success" ? "✓ " : "⚠ "}
            {submitMsg.text}
          </div>
        )}

        {/* ── Date & Reference ── */}
        <Section title="Date & Reference">
          <div style={grid(4)}>
            <Field label="Date (AD)" required>
              <input
                type="date"
                value={form.unloading_date_ad}
                onChange={(e) =>
                  handleChange("unloading_date_ad", e.target.value)
                }
                style={inp}
              />
            </Field>
            <Field label="Date (BS)">
              <input
                type="text"
                placeholder="DD/MM/YYYY"
                value={form.unloading_date_bs}
                onChange={(e) =>
                  handleChange("unloading_date_bs", e.target.value)
                }
                style={inp}
                maxLength={10}
              />
            </Field>
            <Field label="Gate Entry No. (GEN)">
              <input
                type="text"
                value={form.gen}
                onChange={(e) => handleChange("gen", e.target.value)}
                style={inp}
                placeholder="Gate Entry No."
              />
            </Field>
            <Field label="Gate Receipt No. (GRN)">
              <div style={{ display: "flex", gap: 4 }}>
                <select
                  value={form.grn_prefix}
                  onChange={(e) => handleChange("grn_prefix", e.target.value)}
                  style={{ ...inp, width: 90, flexShrink: 0, paddingRight: 4 }}
                >
                  {GRN_PREFIXES.map((p) => (
                    <option key={p} value={p}>
                      {p}
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={form.grn_number}
                  onChange={(e) => handleChange("grn_number", e.target.value)}
                  style={{ ...inp, flex: 1 }}
                  placeholder="Number / code"
                />
              </div>
              {form.grn_number && (
                <div
                  style={{
                    fontSize: 11,
                    color: "#2b6cb0",
                    marginTop: 3,
                    fontWeight: 600,
                  }}
                >
                  → {grn}
                </div>
              )}
            </Field>
          </div>
        </Section>

        {/* ── Party & Vehicle ── */}
        <Section title="Party & Vehicle">
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "1fr 1fr 1fr",
              gap: 10,
            }}
          >
            <Field label="Party Name" required>
              <div
                style={{ display: "flex", gap: 6, alignItems: "flex-start" }}
              >
                <div style={{ flex: 1 }}>
                  <PartySelector
                    key={partySelectorKey}
                    value={form.source}
                    onChange={(name, freight) =>
                      setForm((prev) => ({
                        ...prev,
                        source: name,
                        freight:
                          freight != null
                            ? String(parseFloat(freight))
                            : prev.freight,
                      }))
                    }
                    showAddress
                  />
                </div>
                <button
                  type="button"
                  onClick={() => setAddPartyModal(true)}
                  title="Add new party"
                  style={{
                    marginTop: 1,
                    padding: "7px 10px",
                    background: "#1a3c5e",
                    color: "#fff",
                    border: "none",
                    borderRadius: 6,
                    cursor: "pointer",
                    fontSize: 16,
                    lineHeight: 1,
                    flexShrink: 0,
                  }}
                >
                  +
                </button>
              </div>
            </Field>
            <Field label="Vehicle No.">
              <div style={{ position: "relative" }} ref={vehicleRef}>
                <input
                  type="text"
                  value={form.vehicle_no}
                  onChange={(e) => handleVehicleInput(e.target.value)}
                  onBlur={() =>
                    setTimeout(() => setShowVehicleDropdown(false), 150)
                  }
                  onFocus={() =>
                    form.vehicle_no && setShowVehicleDropdown(true)
                  }
                  style={inp}
                  placeholder="Vehicle no."
                  autoComplete="off"
                />
                {showVehicleDropdown && filteredVehicles.length > 0 && (
                  <div
                    style={{
                      position: "absolute",
                      top: "100%",
                      left: 0,
                      right: 0,
                      background: "#fff",
                      border: "1px solid #e2e8f0",
                      borderRadius: 6,
                      boxShadow: "0 4px 12px rgba(0,0,0,0.1)",
                      zIndex: 100,
                      maxHeight: 180,
                      overflowY: "auto",
                    }}
                  >
                    {filteredVehicles.map((v) => (
                      <div
                        key={v}
                        onMouseDown={() => {
                          // mouseDown fires before onBlur
                          handleChange("vehicle_no", v);
                          setShowVehicleDropdown(false);
                        }}
                        style={{
                          padding: "8px 12px",
                          fontSize: 12,
                          cursor: "pointer",
                          borderBottom: "1px solid #f0f0f0",
                          fontWeight: 500,
                        }}
                        onMouseEnter={(e) =>
                          (e.currentTarget.style.background = "#ebf8ff")
                        }
                        onMouseLeave={(e) =>
                          (e.currentTarget.style.background = "#fff")
                        }
                      >
                        {v}
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </Field>
            <Field label="Party Bill No.">
              <input
                type="text"
                value={form.party_bill_no}
                onChange={(e) => handleChange("party_bill_no", e.target.value)}
                style={inp}
              />
            </Field>
          </div>
        </Section>

        {/* ── Bill Financials & Weight ── */}
        <Section title="Bill Financials & Weight">
          <div style={grid(4)}>
            <Field label="Bill Weight (kg)">
              <input
                type="number"
                value={form.bill_weight}
                onChange={(e) => handleChange("bill_weight", e.target.value)}
                style={inp}
              />
            </Field>
            <Field label="Bill Rate (NPR/kg)">
              <input
                type="number"
                step="0.0001"
                value={form.bill_rate}
                onChange={(e) => handleChange("bill_rate", e.target.value)}
                style={inp}
              />
            </Field>
            <Field label="Our Weight (kg)">
              <input
                type="number"
                value={form.our_weight}
                onChange={(e) => handleChange("our_weight", e.target.value)}
                style={inp}
              />
            </Field>
            <Field label="Shortage">
              <div
                style={{
                  ...inp,
                  background: "#f7fafc",
                  fontWeight: 600,
                  fontSize: 13,
                  display: "flex",
                  alignItems: "center",
                  color:
                    form.our_weight !== "" && form.bill_weight !== ""
                      ? shortage > 0
                        ? "#c53030"
                        : shortage < 0
                          ? "#276749"
                          : "#4a5568"
                      : "#a0aec0",
                }}
              >
                {form.our_weight !== "" && form.bill_weight !== ""
                  ? `${fmtN(shortage)} kg ${shortage > 0 ? "⚠️" : shortage < 0 ? "✅" : ""}`
                  : "—"}
              </div>
            </Field>
          </div>
          {(form.bill_weight || form.bill_rate) && (
            <div style={{ display: "flex", gap: 10, marginTop: 10 }}>
              <Chip label="Amount" value={`NPR ${fmt(amount)}`} />
              <Chip label="VAT 13%" value={`NPR ${fmt(vat)}`} />
              <Chip label="Total" value={`NPR ${fmt(total)}`} color="#276749" />
            </div>
          )}
        </Section>

        {/* ── Lab Report ── */}
        <Section title="Lab Report">
          <div style={grid(4)}>
            <Field label="Moisture (%)">
              <input
                type="number"
                step="0.01"
                value={form.moisture}
                onChange={(e) => handleChange("moisture", e.target.value)}
                style={inp}
                placeholder="0"
              />
            </Field>
          </div>
          <div
            style={{
              fontSize: 11,
              fontWeight: 700,
              color: "#718096",
              textTransform: "uppercase",
              letterSpacing: "0.06em",
              margin: "8px 0 6px",
            }}
          >
            Rejection Breakdown
          </div>
          <div style={grid(4)}>
            {LAB_FIELDS.map((f) => (
              <Field key={f.key} label={f.label}>
                <input
                  type="number"
                  step="0.01"
                  value={form[f.key]}
                  onChange={(e) => handleChange(f.key, e.target.value)}
                  style={inp}
                  placeholder="0"
                />
              </Field>
            ))}
            <Field label="Total Rejection Rate">
              <div
                style={{
                  ...inp,
                  background: "#f7fafc",
                  fontWeight: 700,
                  display: "flex",
                  alignItems: "center",
                  fontSize: 13,
                  color: totalRejection > 0 ? "#c53030" : "#a0aec0",
                }}
              >
                {totalRejection > 0 ? `${fmtN(totalRejection)}%` : "—"}
              </div>
            </Field>
          </div>
          <div style={{ marginTop: 8 }}>
            <Chip
              label="Total Lab Report (Moisture + Rejection)"
              value={totalLabReport > 0 ? `${fmtN(totalLabReport)}%` : "—"}
              color="#c53030"
            />
          </div>
        </Section>

        {/* ── Taxes & Expenses ── */}
        <Section title="Taxes & Expenses">
          <div style={grid(3)}>
            <Field label="Scrap Tax – Birgunj">
              <input
                type="number"
                value={form.scrap_tax_birgunj}
                onChange={(e) =>
                  handleChange("scrap_tax_birgunj", e.target.value)
                }
                style={inp}
                placeholder="0"
              />
            </Field>
            <Field label="Scrap Tax – Simra">
              <input
                type="number"
                value={form.scrap_tax_simra}
                onChange={(e) =>
                  handleChange("scrap_tax_simra", e.target.value)
                }
                style={inp}
                placeholder="0"
              />
            </Field>
            <Field label="Scrap Tax – Hetauda">
              <input
                type="number"
                value={form.scrap_tax_hetauda}
                onChange={(e) =>
                  handleChange("scrap_tax_hetauda", e.target.value)
                }
                style={inp}
                placeholder="0"
              />
            </Field>
            <Field label="Other Taxes">
              <input
                type="number"
                value={form.other_taxes}
                onChange={(e) => handleChange("other_taxes", e.target.value)}
                style={inp}
                placeholder="0"
              />
            </Field>
            <Field label="Freight">
              <input
                type="number"
                value={form.other_expenses}
                onChange={(e) => handleChange("other_expenses", e.target.value)}
                style={inp}
                placeholder="0"
              />
            </Field>
            <Field label="Total Cash Given">
              <input
                type="number"
                value={form.freight}
                onChange={(e) => handleChange("freight", e.target.value)}
                style={inp}
                placeholder="0"
              />
            </Field>
          </div>
        </Section>

        {/* ── Remarks ── */}
        <Section title="Remarks">
          <Field label="Remarks / Notes">
            <textarea
              value={form.remarks}
              onChange={(e) => handleChange("remarks", e.target.value)}
              style={{
                ...inp,
                resize: "vertical",
                minHeight: 60,
                fontFamily: "inherit",
              }}
              placeholder="Any additional notes…"
              rows={2}
            />
          </Field>
        </Section>

        <div style={{ display: "flex", gap: 10, marginTop: 4 }}>
          <button
            onClick={handleSubmit}
            disabled={submitting}
            style={{
              padding: "11px 36px",
              background: "#1a3c5e",
              color: "#fff",
              border: "none",
              borderRadius: 8,
              fontSize: 14,
              fontWeight: 700,
              cursor: submitting ? "not-allowed" : "pointer",
              opacity: submitting ? 0.7 : 1,
            }}
          >
            {submitting ? "Saving…" : "💾 Save Entry"}
          </button>
          <button
            onClick={() => {
              setForm(emptyForm);
              setSubmitMsg(null);
            }}
            style={{
              padding: "11px 20px",
              background: "#fff",
              color: "#4a5568",
              border: "1px solid #e2e8f0",
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
            }}
          >
            Clear
          </button>
        </div>
      </div>

      {/* ── Add Party Modal ── */}
      {addPartyModal && (
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
              <h3 style={{ margin: 0, color: "#1a3c5e", fontWeight: 700 }}>
                Add New Party
              </h3>
              <button
                onClick={() => setAddPartyModal(false)}
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
              <Field label="Party Name" required>
                <input
                  type="text"
                  value={newParty.party_name}
                  onChange={(e) =>
                    setNewParty((p) => ({ ...p, party_name: e.target.value }))
                  }
                  style={inp}
                  placeholder="Full party name"
                  autoFocus
                />
              </Field>
              <Field label="Address">
                <input
                  type="text"
                  value={newParty.address}
                  onChange={(e) =>
                    setNewParty((p) => ({ ...p, address: e.target.value }))
                  }
                  style={inp}
                  placeholder="City / district"
                />
              </Field>
              <Field label="Default Freight (NPR)">
                <input
                  type="number"
                  value={newParty.freight}
                  onChange={(e) =>
                    setNewParty((p) => ({ ...p, freight: e.target.value }))
                  }
                  style={inp}
                  placeholder="0"
                />
              </Field>
            </div>
            <div style={{ display: "flex", gap: 10, marginTop: 20 }}>
              <button
                onClick={saveNewParty}
                disabled={savingParty}
                style={{
                  flex: 1,
                  padding: "11px 0",
                  background: "#1a3c5e",
                  color: "#fff",
                  border: "none",
                  borderRadius: 8,
                  fontSize: 14,
                  fontWeight: 700,
                  cursor: savingParty ? "not-allowed" : "pointer",
                  opacity: savingParty ? 0.7 : 1,
                }}
              >
                {savingParty ? "Saving…" : "✓ Add Party"}
              </button>
              <button
                onClick={() => setAddPartyModal(false)}
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
