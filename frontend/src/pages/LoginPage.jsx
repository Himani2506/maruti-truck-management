import { useState } from "react";
import { useAuth } from "../context/AuthContext";

const BASE_URL = process.env.REACT_APP_API_URL || "http://localhost:4000";

export default function LoginPage() {
  const { login } = useAuth();
  const [form, setForm] = useState({ username: "", password: "" });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const update = (e) => setForm(f => ({ ...f, [e.target.name]: e.target.value }));

  const handleLogin = async () => {
    setLoading(true); setError("");
    try {
      const res = await fetch(`${BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Login failed");
      login(data);
    } catch (e) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={s.page}>
      <div style={s.card}>
        <div style={s.logo}>M</div>
        <h2 style={s.title}>Maruti Group</h2>
        <p style={s.sub}>Transport Management System</p>

        <input style={s.input} placeholder="Username" name="username"
          value={form.username} onChange={update} />
        <input style={s.input} type="password" placeholder="Password" name="password"
          value={form.password} onChange={update}
          onKeyDown={e => e.key === "Enter" && handleLogin()} />

        {error && <p style={s.error}>{error}</p>}

        <button style={s.btn} onClick={handleLogin} disabled={loading}>
          {loading ? "Signing in..." : "Sign In"}
        </button>
      </div>
    </div>
  );
}

const s = {
  page:  { minHeight: "100vh", display: "flex", alignItems: "center", justifyContent: "center", background: "#f0f4f8" },
  card:  { background: "#fff", padding: "40px 36px", borderRadius: 12, boxShadow: "0 4px 24px rgba(0,0,0,0.1)", width: 340, display: "flex", flexDirection: "column", gap: 12 },
  logo:  { width: 48, height: 48, borderRadius: 12, background: "#1a3a5c", color: "#fff", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 22 },
  title: { margin: 0, fontSize: 20, fontWeight: 700, color: "#1a3a5c" },
  sub:   { margin: 0, fontSize: 13, color: "#888" },
  input: { padding: "10px 12px", border: "1px solid #d0dce8", borderRadius: 6, fontSize: 14, outline: "none" },
  btn:   { padding: "11px", background: "#1a3a5c", color: "#fff", border: "none", borderRadius: 6, fontSize: 14, fontWeight: 700, cursor: "pointer" },
  error: { color: "#cc3333", fontSize: 13, margin: 0 },
};