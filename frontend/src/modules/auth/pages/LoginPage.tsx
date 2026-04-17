import { useState } from "react";
import apiClient from "../../../core/api/apiClient";

interface Props {
  onLogin: (token: string) => void;
}

export function LoginPage({ onLogin }: Props) {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError]       = useState("");
  const [loading, setLoading]   = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!username.trim() || !password) return;
    setError("");
    setLoading(true);
    try {
      const { data } = await apiClient.post("/api/v1/auth/login", {
        username: username.trim().toLowerCase(),
        password,
      });
      onLogin(data.access_token);
    } catch (err: unknown) {
      const msg =
        (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail
        ?? "Error al iniciar sesión. Verifica tus credenciales.";
      setError(msg);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)",
      display: "flex", alignItems: "center", justifyContent: "center",
      fontFamily: "system-ui, -apple-system, 'Segoe UI', sans-serif",
      padding: "20px",
    }}>
      <div style={{
        background: "white", borderRadius: "16px",
        padding: "40px 40px 36px",
        width: "100%", maxWidth: "380px",
        boxShadow: "0 25px 60px rgba(0,0,0,0.4)",
      }}>
        {/* Brand */}
        <div style={{ textAlign: "center", marginBottom: "32px" }}>
          <img src="/Logo-Telnet.png" alt="Telnet" style={{ width: "80px", height: "80px", objectFit: "contain", margin: "0 auto 14px", display: "block" }} />
          <h1 style={{ margin: "0 0 4px", fontSize: "22px", fontWeight: 700, color: "#0f172a" }}>
            SIT
          </h1>
          <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>
            Inicia sesión para continuar
          </p>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={labelStyle}>Usuario</label>
            <input
              type="text"
              autoComplete="username"
              placeholder="tu.usuario"
              value={username}
              onChange={e => setUsername(e.target.value)}
              style={inputStyle}
              autoFocus
            />
          </div>

          <div style={{ display: "flex", flexDirection: "column", gap: "5px" }}>
            <label style={labelStyle}>Contraseña</label>
            <input
              type="password"
              autoComplete="current-password"
              placeholder="••••••••"
              value={password}
              onChange={e => setPassword(e.target.value)}
              style={inputStyle}
            />
          </div>

          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: "8px",
              background: "#fef2f2", border: "1px solid #fecaca",
              fontSize: "13px", color: "#dc2626",
            }}>
              {error}
            </div>
          )}

          <button
            type="submit"
            disabled={loading || !username.trim() || !password}
            style={{
              padding: "11px",
              borderRadius: "8px",
              border: "none",
              background: loading || !username.trim() || !password
                ? "#cbd5e1"
                : "linear-gradient(135deg, #3b82f6, #1d4ed8)",
              color: "white",
              fontSize: "14px",
              fontWeight: 600,
              cursor: loading || !username.trim() || !password ? "not-allowed" : "pointer",
              marginTop: "4px",
              boxShadow: loading ? "none" : "0 4px 12px rgba(59,130,246,0.3)",
            }}
          >
            {loading ? "Iniciando sesión..." : "Iniciar sesión"}
          </button>
        </form>

        {/* Hint */}
        <p style={{
          margin: "20px 0 0", fontSize: "12px", color: "#94a3b8",
          textAlign: "center", lineHeight: 1.5,
        }}>
          ¿Primera vez? Tu contraseña inicial es tu nombre de usuario.
          <br />
          Pide al admin que ejecute la sincronización de usuarios.
        </p>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: "12px", fontWeight: 600, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.05em",
};

const inputStyle: React.CSSProperties = {
  padding: "10px 12px", borderRadius: "8px",
  border: "1px solid #e2e8f0", fontSize: "14px",
  color: "#0f172a", outline: "none", background: "#f8fafc",
  transition: "border-color 0.15s",
};
