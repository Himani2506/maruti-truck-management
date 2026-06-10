import React, { useState, useEffect, useCallback, useRef } from 'react';
import * as XLSX from 'xlsx';
import {
  getScrapEntries, getScrapPartySummary, createScrapEntry,
  overrideScrapEntry, updateScrapEntry,
} from '../api';
import axios from 'axios';
import { adToBS as adToBSRaw, bsToADString } from '../nepaliDate';

const API = process.env.REACT_APP_API_URL || 'http://localhost:4000';

// ─── BS/AD helpers ────────────────────────────────────────────────────────────
function adToBSString(adDateStr) {
  if (!adDateStr) return '';
  const bs = adToBSRaw(adDateStr);
  if (!bs) return '';
  return `${String(bs.day).padStart(2,'0')}/${String(bs.month).padStart(2,'0')}/${bs.year}`;
}
function bsStringToAD(bsStr) {
  if (!bsStr) return '';
  const clean = bsStr.replace(/\//g, '');
  if (clean.length < 8) return '';
  const day = parseInt(clean.substring(0, 2));
  const month = parseInt(clean.substring(2, 4));
  const year = parseInt(clean.substring(4, 8));
  if (!day || !month || !year) return '';
  return bsToADString(year, month, day) || '';
}

// ─── Formatting ───────────────────────────────────────────────────────────────
const fmt = (n) => n != null && n !== '' ? parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—';
const fmtN = (n) => n != null && n !== '' ? parseFloat(n).toLocaleString('en-IN', { minimumFractionDigits: 0, maximumFractionDigits: 2 }) : '—';

// ─── Net payable calc ─────────────────────────────────────────────────────────
function calcNetPayable(row) {
  const bw = parseFloat(row.bill_weight) || 0;
  const br = parseFloat(row.bill_rate) || 0;
  const ow = parseFloat(row.our_weight) || 0;
  const mo = parseFloat(row.moisture) || 0;
  const rej = parseFloat(row.rejection) || 0;
  const sr = row.superseded_rate != null ? parseFloat(row.superseded_rate) : null;
  const srej = row.superseded_rejection != null ? parseFloat(row.superseded_rejection) : null;

  const shortage = bw - ow;
  const vat = bw * br * 0.13;
  const effectiveRate = sr !== null ? sr : br;
  // superseded_rejection fully replaces (moisture + rejection)
  const effectiveTotalLab = srej !== null ? srej : (mo + rej);
  // lab deduction in rupees
  const labDeductionRupees = bw * br * effectiveTotalLab / 100;

  return (bw - shortage) * effectiveRate + vat - labDeductionRupees;
}

// ─── Empty form ───────────────────────────────────────────────────────────────
const emptyForm = {
  unloading_date_ad: '', unloading_date_bs: '',
  gen: '', grn: '', source: '', vehicle_no: '', party_bill_no: '',
  bill_weight: '', bill_rate: '', our_weight: '',
  moisture: '', rejection: '',
  scrap_tax_birgunj: '', scrap_tax_simra: '', scrap_tax_hetauda: '',
  other_expenses: '', freight: '',
};

// ══════════════════════════════════════════════════════════════════════════════
export default function ScrapManagement() {
  const [activeTab, setActiveTab] = useState('form');
  const [entries, setEntries] = useState([]);
  const [partySummary, setPartySummary] = useState([]);
  const [loading, setLoading] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [submitMsg, setSubmitMsg] = useState(null);
  const [overrideModal, setOverrideModal] = useState(null);
  const [editModal, setEditModal] = useState(null);
  const [partySheetModal, setPartySheetModal] = useState(null); // { partyName, rows }
  const [xlsxData, setXlsxData] = useState({}); // { partyName: { debit, credit } }
  const [openingEdits, setOpeningEdits] = useState({}); // { partyName: value }
  const [savingOpening, setSavingOpening] = useState({});

  const amount = (parseFloat(form.bill_weight) || 0) * (parseFloat(form.bill_rate) || 0);
  const vat = amount * 0.13;
  const total = amount + vat;
  const shortage = (parseFloat(form.bill_weight) || 0) - (parseFloat(form.our_weight) || 0);
  const totalLabReport = (parseFloat(form.moisture) || 0) + (parseFloat(form.rejection) || 0);

  // ── Fetchers ────────────────────────────────────────────────────────────────
  const fetchEntries = useCallback(async () => {
    setLoading(true);
    try { setEntries(await getScrapEntries()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  const fetchPartySummary = useCallback(async () => {
    setLoading(true);
    try { setPartySummary(await getScrapPartySummary()); }
    catch (e) { console.error(e); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => {
    if (activeTab === 'daily') fetchEntries();
    if (activeTab === 'party') fetchPartySummary();
  }, [activeTab, fetchEntries, fetchPartySummary]);

  // ── Form handlers ───────────────────────────────────────────────────────────
  const handleChange = (field, value) => {
    setForm(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'unloading_date_ad' && value) next.unloading_date_bs = adToBSString(value);
      if (field === 'unloading_date_bs') {
        const digits = value.replace(/\D/g, '');
        let formatted = digits;
        if (digits.length > 2) formatted = digits.slice(0,2) + '/' + digits.slice(2);
        if (digits.length > 4) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,8);
        next.unloading_date_bs = formatted;
        if (digits.length === 8) { const ad = bsStringToAD(formatted); if (ad) next.unloading_date_ad = ad; }
      }
      return next;
    });
  };

  const handleSubmit = async () => {
    if (!form.source) return setSubmitMsg({ type: 'error', text: 'Source (Party Name) is required.' });
    if (!form.unloading_date_ad) return setSubmitMsg({ type: 'error', text: 'Unloading date is required.' });
    if (!form.unloading_date_bs) return setSubmitMsg({ type: 'error', text: 'BS date is required.' });
    setSubmitting(true); setSubmitMsg(null);
    try {
      await createScrapEntry(form);
      setForm(emptyForm);
      setSubmitMsg({ type: 'success', text: 'Entry saved successfully!' });
    } catch (e) {
      setSubmitMsg({ type: 'error', text: e.response?.data?.error || 'Failed to save entry.' });
    } finally { setSubmitting(false); }
  };

  // ── Edit modal ──────────────────────────────────────────────────────────────
  const openEdit = (row) => {
    setEditModal({ ...row });
  };

  const handleEditChange = (field, value) => {
    setEditModal(prev => {
      const next = { ...prev, [field]: value };
      if (field === 'unloading_date_ad' && value) next.unloading_date_bs = adToBSString(value);
      if (field === 'unloading_date_bs') {
        const digits = value.replace(/\D/g, '');
        let formatted = digits;
        if (digits.length > 2) formatted = digits.slice(0,2) + '/' + digits.slice(2);
        if (digits.length > 4) formatted = digits.slice(0,2) + '/' + digits.slice(2,4) + '/' + digits.slice(4,8);
        next.unloading_date_bs = formatted;
        if (digits.length === 8) { const ad = bsStringToAD(formatted); if (ad) next.unloading_date_ad = ad; }
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
      alert('Failed to save: ' + (e.response?.data?.error || e.message));
    }
  };

  // ── Override modal ──────────────────────────────────────────────────────────
  const openOverride = (row) => setOverrideModal({ row, superseded_rate: row.superseded_rate ?? '', superseded_rejection: row.superseded_rejection ?? '' });

  const saveOverride = async () => {
    try {
      await overrideScrapEntry(overrideModal.row.id, {
        superseded_rate: overrideModal.superseded_rate !== '' ? overrideModal.superseded_rate : null,
        superseded_rejection: overrideModal.superseded_rejection !== '' ? overrideModal.superseded_rejection : null,
      });
      setOverrideModal(null); fetchEntries();
    } catch (e) { alert('Failed: ' + (e.response?.data?.error || e.message)); }
  };

  // ── Party sheet popup ───────────────────────────────────────────────────────
  const openPartySheet = async (partyName) => {
    try {
      const res = await axios.get(`${API}/api/scrap/party-sheet/${encodeURIComponent(partyName)}`);
      setPartySheetModal({ partyName, rows: res.data });
    } catch (e) { alert('Failed to load party sheet'); }
  };

  // ── Opening balance save ────────────────────────────────────────────────────
  const saveOpening = async (partyName) => {
    setSavingOpening(p => ({ ...p, [partyName]: true }));
    try {
      await axios.put(`${API}/api/scrap/opening/${encodeURIComponent(partyName)}`, {
        opening: openingEdits[partyName] ?? 0,
      });
      fetchPartySummary();
    } catch (e) { alert('Failed to save opening'); }
    finally { setSavingOpening(p => ({ ...p, [partyName]: false })); }
  };

  // ── XLSX upload ─────────────────────────────────────────────────────────────
  const handleXlsxUpload = (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (evt) => {
      const wb = XLSX.read(evt.target.result, { type: 'binary' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      // Convert to array of arrays (not objects) to use column index directly
      const rows = XLSX.utils.sheet_to_json(ws, { header: 1 });
      const map = {};
      // Data starts at row index 9: col[0]=party_name, col[1]=opening, col[2]=debit, col[3]=credit, col[4]=closing
      for (let i = 9; i < rows.length; i++) {
        const row = rows[i];
        const partyName = row[0];
        if (!partyName || typeof partyName !== 'string' || partyName.trim() === '') continue;
        map[partyName.trim()] = {
          opening: parseFloat(row[1]) || 0,
          debit:   parseFloat(row[2]) || 0,
          credit:  parseFloat(row[3]) || 0,
          closing: parseFloat(row[4]) || 0,
        };
      }
      setXlsxData(map);
    };
    reader.readAsBinaryString(file);
  };

  // ── Excel exports ───────────────────────────────────────────────────────────
  const exportDailyExcel = () => {
    const rows = entries.map(r => ({
      'Date (AD)': r.unloading_date_ad, 'Date (BS)': r.unloading_date_bs,
      'GEN': r.gen, 'GRN': r.grn, 'Party Name': r.source,
      'Vehicle No': r.vehicle_no, 'Party Bill No': r.party_bill_no,
      'Bill Weight': r.bill_weight, 'Bill Rate': r.bill_rate,
      'Amount': r.amount, 'VAT': r.vat, 'Total': r.total,
      'Our Weight': r.our_weight, 'Shortage': r.shortage,
      'Moisture %': r.moisture, 'Rejection %': r.rejection,
      'Total Lab Report %': r.total_lab_report,
      'Scrap Tax Birgunj': r.scrap_tax_birgunj, 'Scrap Tax Simra': r.scrap_tax_simra,
      'Scrap Tax Hetauda': r.scrap_tax_hetauda, 'Other Expenses': r.other_expenses,
      'Freight': r.freight, 'Superseded Rate': r.superseded_rate,
      'Superseded Rejection %': r.superseded_rejection, 'Net Payable': r.net_payable,
    }));
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Daily Scrap');
    XLSX.writeFile(wb, 'scrap_daily_report.xlsx');
  };

  const exportPartyExcel = () => {
    const rows = partySummary.map(r => {
      const xl = xlsxData[r.party_name] || {};
      const payment8081 = xl.debit || 0;
      const purchaseTally = xl.credit || 0;
      const balance = parseFloat(r.opening || 0) + parseFloat(r.purchase_8283 || 0) - payment8081;
      const difference = purchaseTally - parseFloat(r.purchase_8283 || 0);
      return {
        'Party Name': r.party_name, 'Opening': r.opening,
        '82-83 Purchase': r.purchase_8283, 'Deduction': r.deduction,
        'Weight Loss': r.weight_loss, 'Rate Diff': r.rate_diff,
        'Rejection Rate': r.rejection_rate, 'Superseded Rejection Rate': r.superseded_rejection_rate,
        '80-81 Payment': payment8081, 'Balance': balance,
        'Purchase as per Tally': purchaseTally, 'Difference': difference,
      };
    });
    const ws = XLSX.utils.json_to_sheet(rows);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Party Summary');
    XLSX.writeFile(wb, 'scrap_party_summary.xlsx');
  };

  // ════════════════════════════════════════════════════════════════════════════
  return (
    <div style={{ fontFamily: 'Inter, sans-serif', color: '#1a202c' }}>
      {/* Tab bar */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 24 }}>
        {[{ key: 'form', label: '✏️ New Entry' }, { key: 'daily', label: '📋 Daily View' }, { key: 'party', label: '🏢 Party View' }].map(t => (
          <button key={t.key} onClick={() => setActiveTab(t.key)} style={{
            padding: '8px 20px', borderRadius: 8, border: 'none', cursor: 'pointer',
            fontWeight: 600, fontSize: 14,
            background: activeTab === t.key ? '#1a3c5e' : '#e2e8f0',
            color: activeTab === t.key ? '#fff' : '#4a5568',
          }}>{t.label}</button>
        ))}
      </div>

      {/* ── TAB 1: FORM ── */}
      {activeTab === 'form' && (
        <div style={{ maxWidth: 900, margin: '0 auto' }}>
          <h2 style={{ color: '#1a3c5e', marginBottom: 20 }}>New Scrap Entry</h2>
          {submitMsg && (
            <div style={{ padding: '10px 16px', borderRadius: 8, marginBottom: 16,
              background: submitMsg.type === 'success' ? '#f0fff4' : '#fff5f5',
              color: submitMsg.type === 'success' ? '#276749' : '#c53030',
              border: `1px solid ${submitMsg.type === 'success' ? '#9ae6b4' : '#feb2b2'}`,
            }}>{submitMsg.text}</div>
          )}
          <Section title="1. Unloading Date">
            <div style={gridStyle(2)}>
              <Field label="Date (AD)" required>
                <input type="date" value={form.unloading_date_ad} onChange={e => handleChange('unloading_date_ad', e.target.value)} style={inputStyle} />
              </Field>
              <Field label="Date (BS) — DD/MM/YYYY">
                <input type="text" placeholder="e.g. 15/04/2081" value={form.unloading_date_bs} onChange={e => handleChange('unloading_date_bs', e.target.value)} style={inputStyle} maxLength={10} />
              </Field>
            </div>
          </Section>
          <Section title="2. Reference Numbers">
            <div style={gridStyle(2)}>
              <Field label="GEN (Gate Entry Note No.)"><input type="text" value={form.gen} onChange={e => handleChange('gen', e.target.value)} style={inputStyle} /></Field>
              <Field label="GRN (Gate Receipt Note No.)"><input type="text" value={form.grn} onChange={e => handleChange('grn', e.target.value)} style={inputStyle} /></Field>
            </div>
          </Section>
          <Section title="3. Party & Vehicle">
            <div style={gridStyle(3)}>
              <Field label="Source (Party Name)" required><input type="text" value={form.source} onChange={e => handleChange('source', e.target.value)} style={inputStyle} /></Field>
              <Field label="Vehicle No."><input type="text" value={form.vehicle_no} onChange={e => handleChange('vehicle_no', e.target.value)} style={inputStyle} /></Field>
              <Field label="Party Bill No."><input type="text" value={form.party_bill_no} onChange={e => handleChange('party_bill_no', e.target.value)} style={inputStyle} /></Field>
            </div>
          </Section>
          <Section title="4. Bill Financials">
            <div style={gridStyle(2)}>
              <Field label="Bill Weight (kg)"><input type="number" value={form.bill_weight} onChange={e => handleChange('bill_weight', e.target.value)} style={inputStyle} /></Field>
              <Field label="Bill Rate (NPR/kg)"><input type="number" step="0.0001" value={form.bill_rate} onChange={e => handleChange('bill_rate', e.target.value)} style={inputStyle} /></Field>
            </div>
            {(form.bill_weight || form.bill_rate) && (
              <div style={{ display: 'flex', gap: 16, marginTop: 12, flexWrap: 'wrap' }}>
                <CalcChip label="Amount" value={`NPR ${fmt(amount)}`} />
                <CalcChip label="VAT (13%)" value={`NPR ${fmt(vat)}`} />
                <CalcChip label="Total" value={`NPR ${fmt(total)}`} color="#276749" />
              </div>
            )}
          </Section>
          <Section title="5. Our Weight">
            <div style={gridStyle(2)}>
              <Field label="Our Weight (kg)"><input type="number" value={form.our_weight} onChange={e => handleChange('our_weight', e.target.value)} style={inputStyle} /></Field>
              {form.our_weight !== '' && form.bill_weight !== '' && (
                <Field label="Shortage (auto)">
                  <div style={{ ...inputStyle, background: '#f7fafc', display: 'flex', alignItems: 'center', color: shortage > 0 ? '#c53030' : shortage < 0 ? '#276749' : '#4a5568', fontWeight: 600 }}>
                    {fmtN(shortage)} kg {shortage > 0 ? '⚠️ shortage' : shortage < 0 ? '✅ surplus' : ''}
                  </div>
                </Field>
              )}
            </div>
          </Section>
          <Section title="6. Lab Report">
            <div style={gridStyle(3)}>
              <Field label="Moisture (%)"><input type="number" step="0.01" value={form.moisture} onChange={e => handleChange('moisture', e.target.value)} style={inputStyle} /></Field>
              <Field label="Rejection (%)"><input type="number" step="0.01" value={form.rejection} onChange={e => handleChange('rejection', e.target.value)} style={inputStyle} /></Field>
              <Field label="Total Lab Report (auto)">
                <div style={{ ...inputStyle, background: '#f7fafc', fontWeight: 600, display: 'flex', alignItems: 'center' }}>
                  {form.moisture || form.rejection ? `${fmtN(totalLabReport)}%` : '—'}
                </div>
              </Field>
            </div>
          </Section>
          <Section title="7. Taxes & Expenses">
            <div style={gridStyle(3)}>
              <Field label="Scrap Tax – Birgunj MNP"><input type="number" value={form.scrap_tax_birgunj} onChange={e => handleChange('scrap_tax_birgunj', e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="Scrap Tax – Simra MNP"><input type="number" value={form.scrap_tax_simra} onChange={e => handleChange('scrap_tax_simra', e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="Scrap Tax – Hetauda MNP"><input type="number" value={form.scrap_tax_hetauda} onChange={e => handleChange('scrap_tax_hetauda', e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="Other Expenses"><input type="number" value={form.other_expenses} onChange={e => handleChange('other_expenses', e.target.value)} style={inputStyle} placeholder="0" /></Field>
              <Field label="Freight"><input type="number" value={form.freight} onChange={e => handleChange('freight', e.target.value)} style={inputStyle} placeholder="0" /></Field>
            </div>
          </Section>
          <button onClick={handleSubmit} disabled={submitting} style={{ marginTop: 8, padding: '12px 32px', background: '#1a3c5e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 15, fontWeight: 700, cursor: submitting ? 'not-allowed' : 'pointer', opacity: submitting ? 0.7 : 1 }}>
            {submitting ? 'Saving…' : '💾 Save Entry'}
          </button>
        </div>
      )}

      {/* ── TAB 2: DAILY VIEW ── */}
      {activeTab === 'daily' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <h2 style={{ color: '#1a3c5e', margin: 0 }}>Daily Scrap Entries</h2>
            <button onClick={exportDailyExcel} style={exportBtnStyle}>⬇ Export Excel</button>
          </div>
          <div style={{ marginBottom: 12, fontSize: 13, color: '#718096' }}>
            <span style={{ background: '#ebf8ff', padding: '3px 8px', borderRadius: 4, border: '1px solid #90cdf4', marginRight: 8 }}>🔵 Override active</span>
            Click <strong>Override</strong> to set superseded values · Click <strong>Edit</strong> to update entry data
          </div>
          {loading ? <Spinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                    {['#','Date AD','Date BS','GEN','GRN','Party','Vehicle','Bill No','Bill Wt','Bill Rate','Amount','VAT','Total','Our Wt','Shortage','Moisture%','Rejection%','Lab Total%','Tax Birgunj','Tax Simra','Tax Hetauda','Other Exp','Freight','Sup. Rate','Sup. Rej%','Net Payable','Actions'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {entries.map((row, i) => (
                    <tr key={row.id} style={{ background: row.is_overridden ? '#ebf8ff' : (i % 2 === 0 ? '#fff' : '#f8fafc') }}>
                      <td style={tdStyle}>{row.id}</td>
                      <td style={tdStyle}>{row.unloading_date_ad}</td>
                      <td style={tdStyle}>{row.unloading_date_bs}</td>
                      <td style={tdStyle}>{row.gen || '—'}</td>
                      <td style={tdStyle}>{row.grn || '—'}</td>
                      <td style={{ ...tdStyle, maxWidth: 120, overflow: 'hidden', textOverflow: 'ellipsis' }}>{row.source}</td>
                      <td style={tdStyle}>{row.vehicle_no || '—'}</td>
                      <td style={tdStyle}>{row.party_bill_no || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.bill_weight)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.bill_rate)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.amount)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.vat)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.total)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.our_weight)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: parseFloat(row.shortage) > 0 ? '#c53030' : '#276749', fontWeight: 600 }}>{fmtN(row.shortage)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.moisture)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.rejection)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.total_lab_report)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.scrap_tax_birgunj)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.scrap_tax_simra)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.scrap_tax_hetauda)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.other_expenses)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.freight)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: row.superseded_rate ? '#2b6cb0' : '#a0aec0' }}>{row.superseded_rate != null ? fmtN(row.superseded_rate) : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', color: row.superseded_rejection ? '#2b6cb0' : '#a0aec0' }}>{row.superseded_rejection != null ? fmtN(row.superseded_rejection) : '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#276749' }}>NPR {fmt(row.net_payable)}</td>
                      <td style={{ ...tdStyle, whiteSpace: 'nowrap' }}>
                        <button onClick={() => openEdit(row)} style={{ ...actionBtn, background: '#e2e8f0', color: '#2d3748', marginRight: 4 }}>Edit</button>
                        <button onClick={() => openOverride(row)} style={{ ...actionBtn, background: '#2b6cb0', color: '#fff' }}>Override</button>
                      </td>
                    </tr>
                  ))}
                  {entries.length === 0 && <tr><td colSpan={27} style={{ ...tdStyle, textAlign: 'center', color: '#a0aec0', padding: 32 }}>No entries yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ── TAB 3: PARTY VIEW ── */}
      {activeTab === 'party' && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 12 }}>
            <h2 style={{ color: '#1a3c5e', margin: 0 }}>Party-wise Summary</h2>
            <div style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              {/* XLSX upload */}
              <label style={{ ...exportBtnStyle, background: '#4a5568', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}>
                📂 Upload Tally XLSX
                <input type="file" accept=".xlsx,.xls" onChange={handleXlsxUpload} style={{ display: 'none' }} />
              </label>
              {Object.keys(xlsxData).length > 0 && (
                <span style={{ fontSize: 12, color: '#276749', background: '#f0fff4', padding: '4px 10px', borderRadius: 6, border: '1px solid #9ae6b4' }}>
                  ✓ {Object.keys(xlsxData).length} parties loaded
                </span>
              )}
              <button onClick={exportPartyExcel} style={exportBtnStyle}>⬇ Export Excel</button>
            </div>
          </div>

          {loading ? <Spinner /> : (
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                    {['Party Name','Opening','82-83 Purchase','Deduction','Weight Loss','Rate Diff','Rejection Rate','Sup. Rejection Rate','80-81 Payment','Balance','Purchase (Tally)','Difference','Sheet'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {partySummary.map((row, i) => {
                    const xl = xlsxData[row.party_name] || {};
                    const payment8081 = xl.debit || 0;
                    const purchaseTally = xl.credit || 0;
                    const opening = parseFloat(openingEdits[row.party_name] ?? row.opening ?? 0);
                    const balance = opening + parseFloat(row.purchase_8283 || 0) - payment8081;
                    const difference = purchaseTally - parseFloat(row.purchase_8283 || 0);
                    return (
                      <tr key={row.party_name} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                        <td style={{ ...tdStyle, fontWeight: 600 }}>{row.party_name}</td>
                        {/* Opening — inline editable */}
                        <td style={{ ...tdStyle, minWidth: 140 }}>
                          <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
                            <input
                              type="number"
                              value={openingEdits[row.party_name] ?? row.opening ?? 0}
                              onChange={e => setOpeningEdits(p => ({ ...p, [row.party_name]: e.target.value }))}
                              style={{ ...inputStyle, width: 90, padding: '4px 8px', fontSize: 12 }}
                            />
                            <button onClick={() => saveOpening(row.party_name)} disabled={savingOpening[row.party_name]} style={{ ...actionBtn, background: '#276749', color: '#fff', fontSize: 10, padding: '4px 8px' }}>
                              {savingOpening[row.party_name] ? '…' : 'Save'}
                            </button>
                          </div>
                        </td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>NPR {fmt(row.purchase_8283)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#c53030' }}>NPR {fmt(row.deduction)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: parseFloat(row.weight_loss) > 0 ? '#c53030' : '#276749', fontWeight: 600 }}>{fmtN(row.weight_loss)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.rate_diff)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.rejection_rate)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.superseded_rejection_rate)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: payment8081 ? '#2d3748' : '#a0aec0' }}>{payment8081 ? `NPR ${fmt(payment8081)}` : '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: balance >= 0 ? '#276749' : '#c53030' }}>NPR {fmt(balance)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: purchaseTally ? '#2d3748' : '#a0aec0' }}>{purchaseTally ? `NPR ${fmt(purchaseTally)}` : '—'}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600, color: difference >= 0 ? '#276749' : '#c53030' }}>{purchaseTally ? `NPR ${fmt(difference)}` : '—'}</td>
                        <td style={tdStyle}>
                          <button onClick={() => openPartySheet(row.party_name)} style={{ ...actionBtn, background: '#1a3c5e', color: '#fff' }}>View</button>
                        </td>
                      </tr>
                    );
                  })}
                  {partySummary.length === 0 && <tr><td colSpan={13} style={{ ...tdStyle, textAlign: 'center', color: '#a0aec0', padding: 32 }}>No data yet.</td></tr>}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* ══ OVERRIDE MODAL ══ */}
      {overrideModal && (
        <div style={modalOverlay}>
          <div style={modalBox}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
              <div>
                <h3 style={{ margin: 0, color: '#1a3c5e', fontSize: 17 }}>Admin Override</h3>
                <p style={{ margin: '4px 0 0', color: '#718096', fontSize: 13 }}>Entry #{overrideModal.row.id} — <strong>{overrideModal.row.source}</strong></p>
              </div>
              <button onClick={() => setOverrideModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#a0aec0' }}>×</button>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 20 }}>
              {[{ label: 'Bill Rate', value: overrideModal.row.bill_rate }, { label: 'Moisture', value: `${overrideModal.row.moisture}%` }, { label: 'Rejection', value: `${overrideModal.row.rejection}%` }].map(item => (
                <div key={item.label} style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 12px', textAlign: 'center' }}>
                  <div style={{ fontSize: 11, color: '#718096', marginBottom: 4 }}>{item.label}</div>
                  <div style={{ fontSize: 15, fontWeight: 700, color: '#2d3748' }}>{item.value}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <Field label="Superseded Rate">
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.0001" value={overrideModal.superseded_rate} onChange={e => setOverrideModal(p => ({ ...p, superseded_rate: e.target.value }))} style={{ ...inputStyle, paddingRight: 80 }} placeholder={`Default: ${overrideModal.row.bill_rate}`} />
                  {overrideModal.superseded_rate !== '' && <button onClick={() => setOverrideModal(p => ({ ...p, superseded_rate: '' }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#e53e3e', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Clear</button>}
                </div>
              </Field>
              <Field label="Superseded Rejection %">
                <div style={{ position: 'relative' }}>
                  <input type="number" step="0.01" value={overrideModal.superseded_rejection} onChange={e => setOverrideModal(p => ({ ...p, superseded_rejection: e.target.value }))} style={{ ...inputStyle, paddingRight: 80 }} placeholder={`Default: ${overrideModal.row.rejection}%`} />
                  {overrideModal.superseded_rejection !== '' && <button onClick={() => setOverrideModal(p => ({ ...p, superseded_rejection: '' }))} style={{ position: 'absolute', right: 8, top: '50%', transform: 'translateY(-50%)', fontSize: 11, color: '#e53e3e', background: '#fff5f5', border: '1px solid #fed7d7', borderRadius: 4, padding: '2px 8px', cursor: 'pointer' }}>Clear</button>}
                </div>
              </Field>
            </div>
            <div style={{ marginTop: 16, background: '#f0fff4', border: '1px solid #9ae6b4', borderRadius: 8, padding: '12px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontSize: 13, color: '#276749', fontWeight: 600 }}>Preview Net Payable</span>
              <span style={{ fontSize: 16, fontWeight: 800, color: '#276749' }}>NPR {fmt(calcNetPayable({ ...overrideModal.row, superseded_rate: overrideModal.superseded_rate !== '' ? overrideModal.superseded_rate : null, superseded_rejection: overrideModal.superseded_rejection !== '' ? overrideModal.superseded_rejection : null }))}</span>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 20 }}>
              <button onClick={saveOverride} style={{ flex: 1, padding: '11px 0', background: '#1a3c5e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save Override</button>
              <button onClick={() => setOverrideModal(null)} style={{ flex: 1, padding: '11px 0', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ EDIT MODAL ══ */}
      {editModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: 660, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1a3c5e' }}>Edit Entry #{editModal.id}</h3>
              <button onClick={() => setEditModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#a0aec0' }}>×</button>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <div style={gridStyle(2)}>
                <Field label="Date (AD)" required><input type="date" value={editModal.unloading_date_ad || ''} onChange={e => handleEditChange('unloading_date_ad', e.target.value)} style={inputStyle} /></Field>
                <Field label="Date (BS)"><input type="text" value={editModal.unloading_date_bs || ''} onChange={e => handleEditChange('unloading_date_bs', e.target.value)} style={inputStyle} maxLength={10} /></Field>
              </div>
              <div style={gridStyle(2)}>
                <Field label="GEN"><input type="text" value={editModal.gen || ''} onChange={e => handleEditChange('gen', e.target.value)} style={inputStyle} /></Field>
                <Field label="GRN"><input type="text" value={editModal.grn || ''} onChange={e => handleEditChange('grn', e.target.value)} style={inputStyle} /></Field>
              </div>
              <div style={gridStyle(3)}>
                <Field label="Source (Party)" required><input type="text" value={editModal.source || ''} onChange={e => handleEditChange('source', e.target.value)} style={inputStyle} /></Field>
                <Field label="Vehicle No."><input type="text" value={editModal.vehicle_no || ''} onChange={e => handleEditChange('vehicle_no', e.target.value)} style={inputStyle} /></Field>
                <Field label="Party Bill No."><input type="text" value={editModal.party_bill_no || ''} onChange={e => handleEditChange('party_bill_no', e.target.value)} style={inputStyle} /></Field>
              </div>
              <div style={gridStyle(2)}>
                <Field label="Bill Weight"><input type="number" value={editModal.bill_weight || ''} onChange={e => handleEditChange('bill_weight', e.target.value)} style={inputStyle} /></Field>
                <Field label="Bill Rate"><input type="number" step="0.0001" value={editModal.bill_rate || ''} onChange={e => handleEditChange('bill_rate', e.target.value)} style={inputStyle} /></Field>
              </div>
              <Field label="Our Weight"><input type="number" value={editModal.our_weight || ''} onChange={e => handleEditChange('our_weight', e.target.value)} style={inputStyle} /></Field>
              <div style={gridStyle(2)}>
                <Field label="Moisture %"><input type="number" step="0.01" value={editModal.moisture || ''} onChange={e => handleEditChange('moisture', e.target.value)} style={inputStyle} /></Field>
                <Field label="Rejection %"><input type="number" step="0.01" value={editModal.rejection || ''} onChange={e => handleEditChange('rejection', e.target.value)} style={inputStyle} /></Field>
              </div>
              <div style={gridStyle(3)}>
                <Field label="Tax Birgunj"><input type="number" value={editModal.scrap_tax_birgunj || ''} onChange={e => handleEditChange('scrap_tax_birgunj', e.target.value)} style={inputStyle} /></Field>
                <Field label="Tax Simra"><input type="number" value={editModal.scrap_tax_simra || ''} onChange={e => handleEditChange('scrap_tax_simra', e.target.value)} style={inputStyle} /></Field>
                <Field label="Tax Hetauda"><input type="number" value={editModal.scrap_tax_hetauda || ''} onChange={e => handleEditChange('scrap_tax_hetauda', e.target.value)} style={inputStyle} /></Field>
              </div>
              <div style={gridStyle(2)}>
                <Field label="Other Expenses"><input type="number" value={editModal.other_expenses || ''} onChange={e => handleEditChange('other_expenses', e.target.value)} style={inputStyle} /></Field>
                <Field label="Freight"><input type="number" value={editModal.freight || ''} onChange={e => handleEditChange('freight', e.target.value)} style={inputStyle} /></Field>
              </div>
            </div>
            <div style={{ display: 'flex', gap: 10, marginTop: 24 }}>
              <button onClick={saveEdit} style={{ flex: 1, padding: '11px 0', background: '#1a3c5e', color: '#fff', border: 'none', borderRadius: 8, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Save Changes</button>
              <button onClick={() => setEditModal(null)} style={{ flex: 1, padding: '11px 0', background: '#fff', color: '#4a5568', border: '1px solid #cbd5e0', borderRadius: 8, fontSize: 14, fontWeight: 600, cursor: 'pointer' }}>Cancel</button>
            </div>
          </div>
        </div>
      )}

      {/* ══ PARTY SHEET MODAL ══ */}
      {partySheetModal && (
        <div style={modalOverlay}>
          <div style={{ ...modalBox, width: '90vw', maxWidth: 900, maxHeight: '90vh', overflowY: 'auto' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <h3 style={{ margin: 0, color: '#1a3c5e' }}>Party Sheet — {partySheetModal.partyName}</h3>
              <button onClick={() => setPartySheetModal(null)} style={{ background: 'none', border: 'none', fontSize: 20, cursor: 'pointer', color: '#a0aec0' }}>×</button>
            </div>
            <div style={{ overflowX: 'auto' }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ background: '#1a3c5e', color: '#fff' }}>
                    {['#','GRN','Bill Weight','Freight','Hetauda Tax','Simra Tax','Birgunj Tax','Other Expenses','Total Expenses','Per KG Cost','Net Payable'].map(h => <th key={h} style={thStyle}>{h}</th>)}
                  </tr>
                </thead>
                <tbody>
                  {partySheetModal.rows.map((row, i) => (
                    <tr key={row.id} style={{ background: i % 2 === 0 ? '#fff' : '#f8fafc' }}>
                      <td style={tdStyle}>{row.id}</td>
                      <td style={tdStyle}>{row.grn || '—'}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmtN(row.bill_weight)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.freight)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.scrap_tax_hetauda)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.scrap_tax_simra)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.scrap_tax_birgunj)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>{fmt(row.other_expenses)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 600 }}>NPR {fmt(row.total_expenses)}</td>
                      <td style={{ ...tdStyle, textAlign: 'right' }}>NPR {fmt(row.per_kg_cost)}/kg</td>
                      <td style={{ ...tdStyle, textAlign: 'right', fontWeight: 700, color: '#276749' }}>NPR {fmt(row.net_payable)}</td>
                    </tr>
                  ))}
                  {/* Totals row */}
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
                    }), { bill_weight:0, freight:0, scrap_tax_hetauda:0, scrap_tax_simra:0, scrap_tax_birgunj:0, other_expenses:0, total_expenses:0, net_payable:0 });
                    return (
                      <tr style={{ background: '#1a3c5e', color: '#fff', fontWeight: 700 }}>
                        <td style={{ ...tdStyle, color: '#fff' }} colSpan={2}>TOTAL</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>{fmtN(t.bill_weight)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>{fmt(t.freight)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>{fmt(t.scrap_tax_hetauda)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>{fmt(t.scrap_tax_simra)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>{fmt(t.scrap_tax_birgunj)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>{fmt(t.other_expenses)}</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#fff' }}>NPR {fmt(t.total_expenses)}</td>
                        <td style={{ ...tdStyle, color: '#fff' }}>—</td>
                        <td style={{ ...tdStyle, textAlign: 'right', color: '#90cdf4' }}>NPR {fmt(t.net_payable)}</td>
                      </tr>
                    );
                  })()}
                  {partySheetModal.rows.length === 0 && <tr><td colSpan={11} style={{ ...tdStyle, textAlign: 'center', color: '#a0aec0', padding: 32 }}>No entries for this party.</td></tr>}
                </tbody>
              </table>
            </div>
            <div style={{ marginTop: 16, textAlign: 'right' }}>
              <button onClick={() => setPartySheetModal(null)} style={{ padding: '10px 24px', background: '#fff', border: '1px solid #cbd5e0', borderRadius: 8, cursor: 'pointer', fontWeight: 600 }}>Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────
function Section({ title, children }) {
  return (
    <div style={{ marginBottom: 20, background: '#fff', borderRadius: 10, border: '1px solid #e2e8f0', overflow: 'hidden' }}>
      <div style={{ background: '#f7fafc', padding: '10px 16px', borderBottom: '1px solid #e2e8f0' }}>
        <span style={{ fontWeight: 700, fontSize: 13, color: '#4a5568', textTransform: 'uppercase', letterSpacing: '0.05em' }}>{title}</span>
      </div>
      <div style={{ padding: 16 }}>{children}</div>
    </div>
  );
}
function Field({ label, children, required }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 4 }}>
      <label style={{ fontSize: 12, fontWeight: 600, color: '#4a5568' }}>{label}{required && <span style={{ color: '#e53e3e' }}> *</span>}</label>
      {children}
    </div>
  );
}
function CalcChip({ label, value, color }) {
  return (
    <div style={{ background: '#f7fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '6px 14px', fontSize: 13 }}>
      <span style={{ color: '#718096' }}>{label}: </span>
      <span style={{ fontWeight: 700, color: color || '#2d3748' }}>{value}</span>
    </div>
  );
}
function Spinner() { return <div style={{ textAlign: 'center', padding: 40, color: '#a0aec0' }}>Loading…</div>; }

// ─── Styles ───────────────────────────────────────────────────────────────────
const inputStyle = { padding: '8px 12px', borderRadius: 6, border: '1px solid #cbd5e0', fontSize: 14, width: '100%', boxSizing: 'border-box', outline: 'none', background: '#fff' };
const gridStyle = (cols) => ({ display: 'grid', gridTemplateColumns: `repeat(${cols}, 1fr)`, gap: 12 });
const tableStyle = { width: '100%', borderCollapse: 'collapse', fontSize: 12, boxShadow: '0 1px 3px rgba(0,0,0,0.1)', borderRadius: 8, overflow: 'hidden' };
const thStyle = { padding: '10px 8px', textAlign: 'left', fontSize: 11, fontWeight: 700, whiteSpace: 'nowrap', borderRight: '1px solid rgba(255,255,255,0.1)' };
const tdStyle = { padding: '8px 8px', borderBottom: '1px solid #e2e8f0', fontSize: 12, whiteSpace: 'nowrap' };
const exportBtnStyle = { padding: '10px 20px', background: '#276749', color: '#fff', border: 'none', borderRadius: 8, fontSize: 13, fontWeight: 700, cursor: 'pointer' };
const actionBtn = { padding: '4px 10px', fontSize: 11, border: 'none', borderRadius: 4, cursor: 'pointer', fontWeight: 600 };
const modalOverlay = { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 1000 };
const modalBox = { background: '#fff', borderRadius: 12, padding: 24, width: 480, maxWidth: '95vw', boxShadow: '0 20px 60px rgba(0,0,0,0.2)' };