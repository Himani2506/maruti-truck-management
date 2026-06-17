import React, { useState } from "react";
import ScrapEntryForm from './ScrapEntryForm';
import ScrapDailyView from './ScrapDailyView';
import ScrapPartyView from './ScrapPartyView';
import ScrapAccountCleared from './ScrapAccountCleared';
import ScrapAnalysis from "./ScrapAnalysis";

export default function ScrapManagement() {
  const [activeTab, setActiveTab] = useState("form");

  const tabs = [
    { key: "form",     label: "✏️ New Entry" },
    { key: "daily",    label: "📋 Daily View" },
    { key: "party",    label: "🏢 Party View" },
    { key: "cleared",  label: "✅ Account Cleared" },
    { key: "analysis", label: "📊 Analysis" },
  ];

  return (
    <div style={{ fontFamily: "Inter, sans-serif", color: "#1a202c", padding: "0 2px" }}>
      {/* Tab bar */}
      <div style={{ display: "flex", gap: 6, marginBottom: 20, borderBottom: "2px solid #e2e8f0", paddingBottom: 0 }}>
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setActiveTab(t.key)}
            style={{
              padding: "9px 22px", border: "none", cursor: "pointer",
              fontWeight: 600, fontSize: 13, background: "none",
              color: activeTab === t.key ? "#1a3c5e" : "#718096",
              borderBottom: activeTab === t.key ? "2px solid #1a3c5e" : "2px solid transparent",
              marginBottom: -2, borderRadius: 0, transition: "all 0.15s",
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* All tabs rendered, only active one visible */}
      <div style={{ display: activeTab === "form"     ? "block" : "none" }}><ScrapEntryForm /></div>
      <div style={{ display: activeTab === "daily"    ? "block" : "none" }}><ScrapDailyView /></div>
      <div style={{ display: activeTab === "party"    ? "block" : "none" }}><ScrapPartyView /></div>
      <div style={{ display: activeTab === "cleared"  ? "block" : "none" }}><ScrapAccountCleared /></div>
      <div style={{ display: activeTab === "analysis" ? "block" : "none" }}><ScrapAnalysis /></div>
    </div>
  );
}