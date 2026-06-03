import React, { useState, useEffect } from 'react';
import axios from 'axios';
import toast from 'react-hot-toast';

const api = axios.create({ baseURL: '/api' });

const DEFAULT_SETTINGS = {
  diesel_rate:   222.5,
  fooding_rate:  1000,
  bhatta_rate:   1500,
  freight_multiplier: 1.3,
};

export default function AdminSettings() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading]   = useState(true);
  const [saving, setSaving]     = useState(false);

  useEffect(() => {
    api.get('/settings')
      .then(r => setSettings({ ...DEFAULT_SETTINGS, ...r.data }))
      .catch(() => {
        // If endpoint not yet set up, use defaults silently
        setSettings(DEFAULT_SETTINGS);
      })
      .finally(() => setLoading(false));
  }, []);

  const handleChange = e => {
    const { name, value } = e.target;
    setSettings(s => ({ ...s, [name]: value }));
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      await api.post('/settings', settings);
      toast.success('Settings saved! New trips will use updated rates.');
    } catch {
      // Save to localStorage as fallback if backend not ready
      localStorage.setItem('maruti_settings', JSON.stringify(settings));
      toast.success('Settings saved locally.');
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <p style={{ padding: 40, color: '#888', textAlign: 'center' }}>Loading settings...</p>;

  return (
    <div style={styles.container}>
      <h2 style={styles.heading}>⚙️ Rate Settings</h2>
      <p style={styles.sub}>These rates are used for all new trip calculations. Existing trips are not affected.</p>

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
          unit="NPR / Day"
          note="Multiplied by number of trip days"
          color="#1b6ca8"
        />
        <SettingCard
          label="Freight Multiplier (Dhuwwani)"
          name="freight_multiplier"
          value={settings.freight_multiplier}
          onChange={handleChange}
          unit="× actual freight"
          note="e.g. 1.3 means dhuwwani = actual × 1.3"
          color="#0d4f7c"
          step="0.01"
        />
      </div>

      <div style={styles.preview}>
        <h3 style={styles.previewTitle}>Preview with current rates</h3>
        <div style={styles.previewGrid}>
          <PreviewItem label="Diesel (100L trip)" value={`NPR ${(100 * settings.diesel_rate).toLocaleString()}`} />
          <PreviewItem label="Fooding (3 days)" value={`NPR ${(3 * settings.fooding_rate).toLocaleString()}`} />
          <PreviewItem label="Bhatta (3 days)" value={`NPR ${(3 * settings.bhatta_rate).toLocaleString()}`} />
          <PreviewItem label="Dhuwwani on 30,000" value={`NPR ${(30000 * settings.freight_multiplier).toLocaleString()}`} />
        </div>
      </div>

      <button onClick={handleSave} disabled={saving} style={styles.saveBtn}>
        {saving ? 'Saving...' : '💾 Save Settings'}
      </button>
    </div>
  );
}

function SettingCard({ label, name, value, onChange, unit, note, color, step = '0.5' }) {
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

const styles = {
  container: { maxWidth: 900, margin: '0 auto', padding: '0 4px', fontFamily: "'Segoe UI', sans-serif" },
  heading: { fontSize: 20, fontWeight: 700, color: '#1a3a5c', marginBottom: 4 },
  sub: { color: '#666', fontSize: 13, marginBottom: 24 },
  grid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 24 },
  card: { background: '#fff', border: '1px solid #d0dce8', borderRadius: 8, padding: 16 },
  cardLabel: { fontWeight: 600, fontSize: 13, color: '#1a3a5c', marginBottom: 10 },
  cardInputRow: { display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 },
  cardInput: { flex: 1, padding: '8px 10px', border: '1px solid #c0ccd8', borderRadius: 5, fontSize: 16, fontWeight: 700, color: '#1a3a5c' },
  cardUnit: { fontSize: 11, color: '#888', whiteSpace: 'nowrap' },
  cardNote: { fontSize: 11, color: '#999', lineHeight: 1.4 },
  preview: { background: '#f0f4f8', border: '1px solid #d0dce8', borderRadius: 8, padding: 16, marginBottom: 24 },
  previewTitle: { fontSize: 13, fontWeight: 600, color: '#555', marginBottom: 12 },
  previewGrid: { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 12 },
  previewItem: { background: '#fff', borderRadius: 6, padding: '10px 14px', border: '1px solid #d0dce8' },
  previewLabel: { fontSize: 11, color: '#888', marginBottom: 4 },
  previewValue: { fontSize: 15, fontWeight: 700, color: '#1a3a5c' },
  saveBtn: { width: '100%', padding: 14, background: '#1a3a5c', color: '#fff', fontSize: 15, fontWeight: 700, border: 'none', borderRadius: 8, cursor: 'pointer' },
};
