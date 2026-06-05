import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import Layout       from './components/Layout';
import HomePage     from './pages/HomePage';
import TrucksPage   from './pages/trucks/TrucksPage';

export default function App() {
  return (
    <BrowserRouter>
      <Toaster position="top-right" />
      <Routes>
        <Route element={<Layout />}>
          <Route index element={<HomePage />} />
          <Route path="trucks/*" element={<TrucksPage />} />
          <Route path="scrap"        element={<ComingSoon title="Scrap Management" />} />
          <Route path="diesel"       element={<ComingSoon title="Diesel Inventory" />} />
          <Route path="dashboard"    element={<ComingSoon title="Dashboard & Insights" />} />
          <Route path="drivers"      element={<ComingSoon title="Driver Advances" />} />
          <Route path="maintenance"  element={<ComingSoon title="Maintenance Log" />} />
          <Route path="customers"    element={<ComingSoon title="Customer Ledger" />} />
          <Route path="*"            element={<Navigate to="/" replace />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

function ComingSoon({ title }) {
  return (
    <div style={{ textAlign: 'center', padding: '80px 24px', color: '#64748b' }}>
      <div style={{ fontSize: 48, marginBottom: 16 }}>🚧</div>
      <div style={{ fontSize: 22, fontWeight: 700, color: '#1a3a5c' }}>{title}</div>
      <div style={{ marginTop: 8, fontSize: 14 }}>This module is coming soon.</div>
    </div>
  );
}