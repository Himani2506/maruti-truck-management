import React, { useState } from 'react';
import { Toaster } from 'react-hot-toast';
import TripForm      from './components/TripForm';
import AdminTrips    from './components/AdminTrips';
import AdminSettings from './components/AdminSettings';

export default function App() {
  const [view, setView]         = useState('driver');
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = () => setRefreshKey(k => k + 1);

  const tabs = [
    { id: 'driver',   label: '🚛 New Trip Entry' },
    { id: 'admin',    label: '📋 Admin View' },
    { id: 'settings', label: '⚙️ Settings' },
  ];

  return (
    <div style={styles.app}>
      <Toaster position="top-right" />

      <header style={styles.header}>
        <div style={styles.logo}>
          <span style={styles.logoIcon}>🚛</span>
          <div>
            <div style={styles.logoText}>Maruti Truck Management</div>
            <div style={styles.logoSub}>82-83 Chaitra 2082 DKB</div>
          </div>
        </div>
        <nav style={styles.nav}>
          {tabs.map(tab => (
            <button
              key={tab.id}
              onClick={() => { setView(tab.id); if (tab.id === 'admin') refresh(); }}
              style={{ ...styles.navBtn, ...(view === tab.id ? styles.navActive : {}) }}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </header>

      <main style={styles.main}>
        {view === 'driver' && (
          <TripForm onSuccess={refresh} />
        )}
        {view === 'admin' && (
          <AdminTrips
            key={refreshKey}
            onEdit={(id) => alert(`Edit trip #${id} — update form coming next`)}
          />
        )}
        {view === 'settings' && (
          <AdminSettings />
        )}
      </main>
    </div>
  );
}

const styles = {
  app:      { minHeight: '100vh', background: '#f0f4f8', fontFamily: "'Segoe UI', sans-serif" },
  header:   { background: '#1a3a5c', color: '#fff', padding: '0 24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between', height: 60, boxShadow: '0 2px 8px rgba(0,0,0,0.2)' },
  logo:     { display: 'flex', alignItems: 'center', gap: 12 },
  logoIcon: { fontSize: 26 },
  logoText: { fontSize: 17, fontWeight: 700, letterSpacing: '0.02em' },
  logoSub:  { fontSize: 11, opacity: 0.7, marginTop: 1 },
  nav:      { display: 'flex', gap: 6 },
  navBtn:   { padding: '7px 14px', border: '1px solid rgba(255,255,255,0.3)', borderRadius: 6, background: 'transparent', color: '#fff', cursor: 'pointer', fontSize: 13, fontWeight: 500 },
  navActive:{ background: 'rgba(255,255,255,0.2)', border: '1px solid #fff', fontWeight: 700 },
  main:     { maxWidth: 1300, margin: '0 auto', padding: '24px 16px' },
};
