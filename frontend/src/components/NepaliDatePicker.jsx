import React, { useState, useEffect } from 'react';
import { BS_MONTH_NAMES } from '../nepaliDate';

export default function NepaliDatePicker({ label, value, onChange, required = false, onKeyDown }) {
  const [raw, setRaw] = useState('');

  // Sync back if parent resets value
  useEffect(() => {
  if (!value?.year) {
    setRaw('');
  } else {
    // Rebuild the raw string from the BS value so the input shows it
    const dd = String(value.day).padStart(2, '0');
    const mm = String(value.month).padStart(2, '0');
    const yyyy = String(value.year);
    setRaw(`${dd}${mm}${yyyy}`);
  }
}, [value?.year, value?.month, value?.day]);

  const handleChange = (e) => {
    const val = e.target.value.replace(/\D/g, '').slice(0, 8);
    setRaw(val);

    if (val.length === 8) {
      const d = parseInt(val.slice(0, 2));
      const m = parseInt(val.slice(2, 4));
      const y = parseInt(val.slice(4, 8));
      if (m >= 1 && m <= 12 && d >= 1 && d <= 32 && y >= 2078 && y <= 2086) {
        onChange({ year: y, month: m, day: d });
      } else {
        onChange({ year: '', month: '', day: '' });
      }
    } else {
      onChange({ year: '', month: '', day: '' });
    }
  };

  // Format raw as DD/MM/YYYY while typing
  const display = (() => {
    if (raw.length <= 2) return raw;
    if (raw.length <= 4) return `${raw.slice(0,2)}/${raw.slice(2)}`;
    return `${raw.slice(0,2)}/${raw.slice(2,4)}/${raw.slice(4)}`;
  })();

  const monthName = value?.month ? BS_MONTH_NAMES[value.month - 1] : null;
  const isValid = value?.year && value?.month && value?.day;

  return (
    <div style={styles.wrapper}>
      <label style={styles.label}>
        {label}{required && <span style={{ color: '#cc0000' }}> *</span>}
      </label>
      <input
        type="text"
        value={display}
        onChange={handleChange}
        onKeyDown={onKeyDown}
        placeholder="DDMMYYYY e.g. 15042081"
        style={{ ...styles.input, borderColor: raw.length === 8 && !isValid ? '#cc0000' : '#c0ccd8' }}
        required={required}
      />
      {raw.length === 8 && !isValid && (
        <span style={styles.error}>Invalid date</span>
      )}
      {isValid && (
        <span style={styles.preview}>
          📅 {value.day} {monthName} {value.year} BS
        </span>
      )}
    </div>
  );
}

const styles = {
  wrapper:  { display: 'flex', flexDirection: 'column', flex: 1, minWidth: 200, marginBottom: 10 },
  label:    { fontSize: 12, color: '#555', marginBottom: 4, fontWeight: 500 },
  input:    { padding: '8px 10px', border: '1px solid #c0ccd8', borderRadius: 5, fontSize: 14, outline: 'none', width: '100%', boxSizing: 'border-box' },
  error:    { fontSize: 11, color: '#cc0000', marginTop: 3 },
  preview:  { fontSize: 12, color: '#2a6098', fontWeight: 600, marginTop: 4 },
};