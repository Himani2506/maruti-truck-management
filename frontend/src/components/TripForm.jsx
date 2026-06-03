import React, { useState, useEffect } from "react";
import {
  getTrucks,
  getSources,
  getCustomers,
  getBackloads,
  createTrip,
} from "../api";
import { bsToADString, formatBS } from "../nepaliDate";
import NepaliDatePicker from "./NepaliDatePicker";
import toast from "react-hot-toast";

const FOODING_RATE = 1000;
const BHATTA_RATE = 1500;
const DIESEL_PRICE = 222.5;

const initialForm = {
  truck_id: "",
  source_id: "",
  customer_id: "",
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
  scrap_tax: "",
  tyre_expense: "",
  police_tax: "",      // Added field
  phone_expense: "",   // Added field
  freight_amount: "",
  backload_freight_amount: "",
  remarks: "",
  backload_id: "",
  backload_bill_no: "",
  backload_loading_amount: "",
  backload_unloading_amount: "",
};

const emptyBS = { year: "", month: "", day: "" };

export default function TripForm({ onSuccess }) {
  const [form, setForm] = useState(initialForm);
  const [startBS, setStartBS] = useState(emptyBS);
  const [endBS, setEndBS] = useState(emptyBS);
  const [backloadStartBS, setBackloadStartBS] = useState(emptyBS);
  const [backloadEndBS, setBackloadEndBS] = useState(emptyBS);
  const [trucks, setTrucks] = useState([]);
  const [sources, setSources] = useState([]);
  const [customers, setCustomers] = useState([]);
  const [selectedTruck, setSelectedTruck] = useState(null);
  const [selectedCustomer, setSelectedCustomer] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [backloads, setBackloads] = useState([]);

  const startAD = bsToADString(startBS.year, startBS.month, startBS.day);
  const endAD = bsToADString(endBS.year, endBS.month, endBS.day);

  // ── Days ─────────────────────────────────────────────────────
  const numDays = (() => {
    if (!startAD || !endAD) return null;
    const d = Math.ceil(
      (new Date(endAD) - new Date(startAD)) / (1000 * 60 * 60 * 24),
    );
    return d >= 0 ? d + 1 : null;
  })();
  const fooding = numDays ? numDays * FOODING_RATE : 0;
  const tripBhatta = startAD && endAD ? BHATTA_RATE : 0;

  // ── Odometer → distance ──────────────────────────────────────
  const meterStart = parseFloat(form.meter_start) || null;
  const meterEnd = parseFloat(form.meter_end) || null;
  const distanceKm =
    meterStart && meterEnd && meterEnd > meterStart
      ? parseFloat((meterEnd - meterStart).toFixed(2))
      : null;

  // ── Diesel needed (distance / truck avg) ─────────────────────
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

  // ── Total expenses ────────────────────────────────────────────
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
    n("scrap_tax") +
    n("tyre_expense") +
    n("police_tax") +       // Added to sum calculation
    n("phone_expense");     // Added to sum calculation

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
    effectiveBackloadFooding;

  const totalCashExpenseWithBackload = totalCashExpense + backloadCashExpense;

  const totalRevenue =
    Number(form.freight_amount || 0) +
    Number(form.backload_freight_amount || 0);

  const surplus = form.freight_amount
    ? parseFloat((totalRevenue - totalExpenses).toFixed(2))
    : null;

  const backloadSurplus = form.backload_freight_amount
    ? parseFloat(
        (
          parseFloat(form.backload_freight_amount) -
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

  // ── Load master data ─────────────────────────────────────────
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

  useEffect(() => {
    const c =
      customers.find((c) => c.id === parseInt(form.customer_id)) || null;
    setSelectedCustomer(c);
    if (c?.freight_actual) {
      setForm((prev) => ({ ...prev, freight_amount: c.freight_actual }));
    }
  }, [form.customer_id, customers]);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.truck_id || !form.source_id || !form.customer_id) {
      toast.error("Please fill all required fields.");
      return;
    }
    if (!startAD) {
      toast.error("Please select a start date.");
      return;
    }
    setSubmitting(true);
    try {
      await createTrip({
        ...form,
        start_date: startAD,
        end_date: endAD || null,
        distance_km: distanceKm,
        diesel_needed: dieselNeeded,
        diesel_cost: dieselCost,
        trip_bhatta: effectiveBhatta,
        police_tax: n("police_tax") || null,         // Passed payload entry
        phone_expense: n("phone_expense") || null,   // Passed payload entry
        loading_unloading: n("loading_amount") + n("unloading_amount") || null,
        backload_supplier_id: form.backload_id || null,
        backload_bill_no: form.backload_bill_no || null,
        backload_start_date: backloadStartAD || null,
        backload_end_date: backloadEndAD || null,
        backload_fooding: effectiveBackloadFooding,
        backload_bhatta: effectiveBackloadBhatta,
        backload_loading_amount: form.backload_loading_amount || null,
        backload_unloading_amount: form.backload_unloading_amount || null,
      });
      toast.success("Trip entry saved!");
      setForm(initialForm);
      setStartBS(emptyBS);
      setEndBS(emptyBS);
      setBackloadStartBS(emptyBS);
      setBackloadEndBS(emptyBS);
      onSuccess?.();
    } catch (err) {
      toast.error(err.response?.data?.error || "Failed to save trip.");
    } finally {
      setSubmitting(false);
    }
  };

  const fmt = (n) => (n != null ? `NPR ${Number(n).toLocaleString()}` : "—");
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

  return (
    <form
      onSubmit={handleSubmit}
      style={styles.form}
      onKeyDown={(e) => {
        if (e.key === "Enter") e.preventDefault();
      }}
    >
      <h2 style={styles.heading}>New Trip Entry</h2>

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

      {/* ── 2. Source ── */}
      <Section title="2. Source">
        <Field label="From (Source) *">
          <select
            name="source_id"
            value={form.source_id}
            onChange={handleChange}
            style={styles.input}
            required
            onKeyDown={handleEnter}
          >
            <option value="">Select source</option>
            {sources.map((s) => (
              <option key={s.id} value={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
      </Section>

      {/* ── 3. Trip Dates & Customer ── */}
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
        <Field label="Customer (Destination) *">
          <select
            name="customer_id"
            value={form.customer_id}
            onChange={handleChange}
            style={styles.input}
            required
            onKeyDown={handleEnter}
          >
            <option value="">Select customer</option>
            {customers.map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
        {selectedCustomer && (
          <InfoBox>
            <b>Destination:</b>{" "}
            {selectedCustomer.destination_address?.trim() ||
              "⚠ Address not set"}
            &nbsp;&nbsp;
            <b>Freight Rate:</b> {fmt(selectedCustomer.freight_actual)}
          </InfoBox>
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

      {/* ── 5. Odometer & Distance ── */}
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
          <Field label={`Fooding (NPR ${FOODING_RATE}/day)`}>
            <input
              value={fooding ? fmt(fooding) : "—"}
              readOnly
              style={styles.readOnly}
            />
          </Field>
          <Field label={`Trip Bhatta (NPR ${BHATTA_RATE}/day)`}>
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
          <Field label="Scrap Tax (NPR)">
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
        </Row>
        {/* Row added for Police Tax and Phone Expenses */}
        <Row>
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
          <select
            name="backload_id"
            value={form.backload_id}
            onChange={handleChange}
            onKeyDown={handleEnter}
            style={styles.input}
          >
            <option value="">No backload</option>
            {backloads.map((b) => (
              <option key={b.id} value={b.id}>
                {b.description}
              </option>
            ))}
          </select>
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
              <Field label="Backload Loading / Offloading (NPR)">
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
        <Field label="Freight Amount (NPR) ">
          <input
            type="number"
            name="freight_amount"
            value={form.freight_amount}
            onKeyDown={handleEnter}
            onChange={handleChange}
            style={styles.input}
            placeholder="e.g. 30000"
          />
          {selectedCustomer?.freight_actual && (
            <span
              style={{
                fontSize: 11,
                color: "#2a6098",
                marginTop: 3,
                fontStyle: "italic",
              }}
            >
              Rate from DB: NPR{" "}
              {Number(selectedCustomer.freight_actual).toLocaleString()}
            </span>
          )}
        </Field>

        {/* Expense breakdown */}
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
            <BLine label="Scrap Tax" value={fmt(n("scrap_tax") || null)} />
            <BLine label="Tyre" value={fmt(n("tyre_expense") || null)} />
            <BLine label="Police Tax" value={fmt(n("police_tax") || null)} />
            <BLine label="Phone" value={fmt(n("phone_expense") || null)} />
          </div>
          <div style={styles.breakdownTotal}>
            <span>Total Expenses</span>
            <span style={{ fontWeight: 700 }}>{fmt(totalExpenses)}</span>
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
        {submitting ? "Saving..." : "Save Trip Entry"}
      </button>
    </form>
  );
}

// ─── Sub-components ───────────────────────────────────────────
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
};