import React, { useState } from "react";
import { Outlet, NavLink } from "react-router-dom";
import AlertsBell from "./AlertsBell";
import { useAuth } from "../context/AuthContext";
// Replace the navLinks array at the top
const navLinks = [
  { to: "/", label: "Overview", adminOnly: false },
  { to: "/trucks", label: "Truck Management", adminOnly: false },
  { to: "/scrap", label: "Scrap Management", adminOnly: true },
  { to: "/diesel", label: "Diesel Inventory", adminOnly: true },
  { to: "/dashboard", label: "Dashboard", adminOnly: true },
  { to: "/drivers", label: "Driver Advances", adminOnly: true },
  { to: "/maintenance", label: "Maintenance Log", adminOnly: true },
  { to: "/customers", label: "Customer Ledger", adminOnly: true },
];

export default function Layout() {
  const [collapsed, setCollapsed] = useState(false);
  const [tripSaveCount, setTripSaveCount] = useState(0);
  const { isAdmin, auth, logout } = useAuth();
  return (
    <div style={s.shell}>
      <aside style={{ ...s.sidebar, width: collapsed ? 56 : 220 }}>
        <div style={s.logoBlock}>
          <div style={s.logoMark}>M</div>
          {!collapsed && (
            <div>
              <div style={s.logoName}>Maruti Group</div>
              <div style={s.logoSub}>Transport Division</div>
            </div>
          )}
        </div>

        <div style={s.divider} />

        <nav style={s.nav}>
          {navLinks
            .filter((l) => !l.adminOnly || isAdmin)
            .map((l) => (
              <NavLink
                key={l.to}
                to={l.to}
                end={l.to === "/"}
                style={({ isActive }) => ({
                  ...s.link,
                  ...(isActive ? s.linkActive : {}),
                })}
              >
                <span style={s.dot} />
                {!collapsed && <span>{l.label}</span>}
              </NavLink>
            ))}
        </nav>
        {/* 👇 Role badge + logout — add this before collapseBtn */}
        {!collapsed && (
          <div style={s.userBlock}>
            <div style={s.userName}>{auth?.username}</div>
            <div style={s.userRole}>{auth?.role}</div>
            <button style={s.logoutBtn} onClick={logout}>
              Sign out
            </button>
          </div>
        )}

        <button style={s.collapseBtn} onClick={() => setCollapsed((c) => !c)}>
          {collapsed ? "»" : "«"}
        </button>
      </aside>

      <div style={s.body}>
        <header style={s.topbar}>
          <div style={s.topbarTitle}>
            Maruti Group · Transport Management System
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <AlertsBell refreshTrigger={tripSaveCount} />
            <div style={s.topbarDate}>
              {new Date().toLocaleDateString("en-IN", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
            </div>
          </div>
        </header>
        <main style={s.main}>
          <Outlet
            context={{ onTripSaved: () => setTripSaveCount((c) => c + 1) }}
          />
        </main>
      </div>
    </div>
  );
}

const GREEN = "#14532d";
const GREEN2 = "#166534";
const HOVER = "rgba(255,255,255,0.08)";
const ACTIVE = "rgba(255,255,255,0.15)";

const s = {
  shell: {
    display: "flex",
    minHeight: "100vh",
    fontFamily: "'Inter','Segoe UI',sans-serif",
  },
  sidebar: {
    background: GREEN,
    display: "flex",
    flexDirection: "column",
    flexShrink: 0,
    transition: "width 0.2s ease",
    overflow: "hidden",
    position: "sticky",
    top: 0,
    height: "100vh",
  },
  logoBlock: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "20px 14px 16px",
    flexShrink: 0,
  },
  logoMark: {
    width: 32,
    height: 32,
    borderRadius: 7,
    background: "#fff",
    color: GREEN2,
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    fontWeight: 900,
    fontSize: 16,
    flexShrink: 0,
  },
  logoName: {
    fontSize: 13,
    fontWeight: 700,
    color: "#fff",
    whiteSpace: "nowrap",
  },
  logoSub: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    marginTop: 1,
    whiteSpace: "nowrap",
  },
  divider: {
    height: 1,
    background: "rgba(255,255,255,0.1)",
    margin: "0 14px 8px",
  },
  nav: {
    display: "flex",
    flexDirection: "column",
    gap: 1,
    padding: "0 8px",
    flex: 1,
  },
  link: {
    display: "flex",
    alignItems: "center",
    gap: 10,
    padding: "9px 10px",
    borderRadius: 7,
    color: "rgba(255,255,255,0.7)",
    textDecoration: "none",
    fontSize: 13,
    fontWeight: 500,
    whiteSpace: "nowrap",
    transition: "background 0.15s, color 0.15s",
  },
  linkActive: { background: ACTIVE, color: "#fff", fontWeight: 600 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: "50%",
    background: "rgba(255,255,255,0.35)",
    flexShrink: 0,
  },
  collapseBtn: {
    margin: "12px 8px 20px",
    padding: "7px",
    background: "rgba(255,255,255,0.08)",
    border: "none",
    borderRadius: 7,
    cursor: "pointer",
    fontSize: 13,
    color: "rgba(255,255,255,0.5)",
    textAlign: "center",
  },
  userBlock: {
    margin: "0 8px 8px",
    padding: "10px 12px",
    background: "rgba(255,255,255,0.08)",
    borderRadius: 8,
    display: "flex",
    flexDirection: "column",
    gap: 3,
  },
  userName: {
    fontSize: 12,
    fontWeight: 700,
    color: "#fff",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
  },
  userRole: {
    fontSize: 10,
    color: "rgba(255,255,255,0.5)",
    textTransform: "uppercase",
    letterSpacing: "0.05em",
  },
  logoutBtn: {
    marginTop: 6,
    padding: "5px 0",
    background: "rgba(255,255,255,0.1)",
    border: "none",
    borderRadius: 5,
    color: "rgba(255,255,255,0.7)",
    fontSize: 12,
    cursor: "pointer",
    width: "100%",
  },
  body: {
    flex: 1,
    display: "flex",
    flexDirection: "column",
    background: "#f1f5f9",
    minWidth: 0,
  },
  topbar: {
    background: "#fff",
    borderBottom: "1px solid #e2e8f0",
    padding: "0 28px",
    height: 50,
    display: "flex",
    alignItems: "center",
    justifyContent: "space-between",
    flexShrink: 0,
  },
  topbarTitle: { fontSize: 13, fontWeight: 600, color: "#0f172a" },
  topbarDate: { fontSize: 12, color: "#94a3b8" },
  main: { padding: "28px", flex: 1 },
};
