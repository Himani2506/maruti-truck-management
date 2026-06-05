import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const API = 'http://localhost:4000';

function useTruckStats() {
  const [stats, setStats] = useState(null);
  useEffect(() => {
    fetch(`${API}/api/trips`)
      .then(r => r.json())
      .then(trips => {
        if (!Array.isArray(trips)) return;
        const now   = new Date();
        const month = now.getMonth();
        const year  = now.getFullYear();
        const thisMonth = trips.filter(t => {
          const d = new Date(t.date || t.trip_date || t.created_at);
          return d.getMonth() === month && d.getFullYear() === year;
        });
        const trucks = [...new Set(trips.map(t => t.truck_number || t.truck).filter(Boolean))];
        const revenue = thisMonth.reduce((sum, t) => sum + parseFloat(t.freight_amount || t.amount || 0), 0);
        setStats({ total: trips.length, thisMonth: thisMonth.length, trucks: trucks.length, revenue });
      })
      .catch(() => setStats({ error: true }));
  }, []);
  return stats;
}

export default function HomePage() {
  const navigate    = useNavigate();
  const truckStats  = useTruckStats();

  return (
    <div>
      {/* Page title */}
      <div style={s.pageHead}>
        <div>
          <div style={s.pageTitle}>Operations Overview</div>
          <div style={s.pageSub}>Maruti Group · Birgunj Transport Division</div>
        </div>
        <div style={s.qaRow}>
          <button style={{ ...s.qaBtn, background: '#14532d' }} onClick={() => navigate('/trucks')}>+ New Trip</button>
          <button style={{ ...s.qaBtn, background: '#1e40af' }} onClick={() => navigate('/diesel')}>+ Add Diesel</button>
          <button style={{ ...s.qaBtn, background: '#92400e' }} onClick={() => navigate('/scrap')}>+ Log Scrap</button>
        </div>
      </div>

      {/* Stats row */}
      <div style={s.statsRow}>
        <StatCard label="Trips This Month"   value={truckStats ? (truckStats.error ? '—' : truckStats.thisMonth) : '...'} sub="truck journeys logged" color="#14532d" />
        <StatCard label="Total Trips"        value={truckStats ? (truckStats.error ? '—' : truckStats.total)     : '...'} sub="all time"             color="#1e3a8a" />
        <StatCard label="Active Trucks"      value={truckStats ? (truckStats.error ? '—' : truckStats.trucks)    : '...'} sub="in the fleet"         color="#92400e" />
        <StatCard label="Revenue This Month" value={truckStats ? (truckStats.error ? '—' : `₹${truckStats.revenue.toLocaleString('en-IN')}`) : '...'} sub="freight collected" color="#6b21a8" />
      </div>

      {/* Module grid */}
      <div style={s.sectionLabel}>Modules</div>
      <div style={s.grid}>
        {modules.map(m => (
          <ModuleCard key={m.to} {...m} onClick={() => navigate(m.to)} />
        ))}
      </div>
    </div>
  );
}

function StatCard({ label, value, sub, color }) {
  return (
    <div style={s.statCard}>
      <div style={{ ...s.statBar, background: color }} />
      <div style={s.statBody}>
        <div style={s.statLabel}>{label}</div>
        <div style={{ ...s.statValue, color }}>{value}</div>
        <div style={s.statSub}>{sub}</div>
      </div>
    </div>
  );
}

function ModuleCard({ label, desc, accent, status, onClick }) {
  const [hovered, setHovered] = useState(false);
  return (
    <div
      style={{ ...s.card, boxShadow: hovered ? '0 4px 20px rgba(0,0,0,0.10)' : '0 1px 3px rgba(0,0,0,0.07)' }}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div style={{ ...s.cardBar, background: accent }} />
      <div style={s.cardBody}>
        <div style={s.cardTop}>
          <div style={s.cardLabel}>{label}</div>
          <span style={{ ...s.badge, ...(status === 'Active' ? s.badgeActive : s.badgeSoon) }}>
            {status}
          </span>
        </div>
        <div style={s.cardDesc}>{desc}</div>
        <div style={{ ...s.cardCta, color: accent }}>Open module →</div>
      </div>
    </div>
  );
}

const modules = [
  { to: '/trucks',      label: 'Truck Management',    desc: 'Trip entries, admin view, freight rates & settings.',         accent: '#14532d', status: 'Active'      },
  { to: '/scrap',       label: 'Scrap Management',    desc: 'Collected vs sold inventory, stock balance, monthly summary.',accent: '#1e40af', status: 'Coming Soon' },
  { to: '/diesel',      label: 'Diesel Inventory',    desc: 'Purchase log, trip consumption tracking, low-stock alerts.',  accent: '#92400e', status: 'Coming Soon' },
  { to: '/dashboard',   label: 'Dashboard & Insights',desc: 'Revenue, expenses, per-truck KPIs and trend charts.',         accent: '#6b21a8', status: 'Coming Soon' },
  { to: '/drivers',     label: 'Driver Advances',     desc: 'Cash advances, expense claims, running balance per driver.',  accent: '#0f766e', status: 'Coming Soon' },
  { to: '/maintenance', label: 'Maintenance Log',     desc: 'Service history, next service due dates, parts & cost.',      accent: '#b45309', status: 'Coming Soon' },
  { to: '/customers',   label: 'Customer Ledger',     desc: 'Outstanding freight, payment records, customer balances.',    accent: '#be123c', status: 'Coming Soon' },
];

const s = {
  pageHead:   { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24, flexWrap: 'wrap', gap: 16 },
  pageTitle:  { fontSize: 20, fontWeight: 700, color: '#0f172a' },
  pageSub:    { fontSize: 12, color: '#94a3b8', marginTop: 3 },

  qaRow:      { display: 'flex', gap: 8, flexWrap: 'wrap' },
  qaBtn:      { padding: '8px 16px', color: '#fff', border: 'none', borderRadius: 7, fontSize: 12, fontWeight: 600, cursor: 'pointer', letterSpacing: '0.01em' },

  statsRow:   { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 14, marginBottom: 28 },
  statCard:   { background: '#fff', borderRadius: 10, overflow: 'hidden', boxShadow: '0 1px 3px rgba(0,0,0,0.07)', display: 'flex' },
  statBar:    { width: 4, flexShrink: 0 },
  statBody:   { padding: '16px 18px' },
  statLabel:  { fontSize: 11, fontWeight: 600, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.06em' },
  statValue:  { fontSize: 26, fontWeight: 800, marginTop: 4, lineHeight: 1 },
  statSub:    { fontSize: 11, color: '#94a3b8', marginTop: 4 },

  sectionLabel: { fontSize: 11, fontWeight: 700, color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.08em', marginBottom: 12 },

  grid:       { display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))', gap: 14 },
  card:       { background: '#fff', borderRadius: 10, overflow: 'hidden', cursor: 'pointer', transition: 'box-shadow 0.2s' },
  cardBar:    { height: 4 },
  cardBody:   { padding: '16px 18px 18px' },
  cardTop:    { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  cardLabel:  { fontSize: 14, fontWeight: 700, color: '#0f172a' },
  cardDesc:   { fontSize: 12, color: '#64748b', lineHeight: 1.6 },
  cardCta:    { fontSize: 12, fontWeight: 600, marginTop: 10 },

  badge:      { fontSize: 10, fontWeight: 700, padding: '3px 8px', borderRadius: 20, letterSpacing: '0.04em', textTransform: 'uppercase' },
  badgeActive:{ background: '#dcfce7', color: '#14532d' },
  badgeSoon:  { background: '#f1f5f9', color: '#94a3b8' },
};