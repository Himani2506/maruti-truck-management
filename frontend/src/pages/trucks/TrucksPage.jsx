import React, { useState } from 'react';
import TripForm      from '../../components/TripForm';
import AdminTrips    from '../../components/AdminTrips';
import AdminSettings from '../../components/AdminSettings';
import { useOutletContext } from 'react-router-dom';

export default function TrucksPage() {
  const [view, setView]         = useState('driver');
  const [refreshKey, setRefreshKey] = useState(0);
  const { onTripSaved } = useOutletContext();
  const refresh = () => setRefreshKey(k => k + 1);


  const tabs = [
    { id: 'driver',   label: '🚛 New Trip Entry' },
    { id: 'admin',    label: '📋 Admin View' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div>
      <nav style={s.tabs}>
        {tabs.map(tab => (
          <button
            key={tab.id}
            onClick={() => { setView(tab.id); if (tab.id === 'admin') refresh(); }}
            style={{ ...s.tab, ...(view === tab.id ? s.tabActive : {}) }}
          >
            {tab.label}
          </button>
        ))}
      </nav>

      {view === 'driver' && <TripForm onSuccess={() => { refresh(); onTripSaved(); }} />}
      {view === 'admin'    && <AdminTrips key={refreshKey} onEdit={(id) => alert(`Edit trip #${id}`)} />}
      {view === 'settings' && <AdminSettings />}
    </div>
  );
}

const s = {
  tabs:      { display: 'flex', gap: 6, marginBottom: 24, flexWrap: 'wrap' },
  tab:       { padding: '8px 16px', border: '1px solid #cbd5e1', borderRadius: 8, background: '#fff', color: '#475569', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  tabActive: { background: '#1a3a5c', color: '#fff', border: '1px solid #1a3a5c', fontWeight: 700 },
};