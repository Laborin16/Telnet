import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

interface UsuarioRow {
  id: number;
  username: string;
  nombre: string;
  activo: boolean;
  es_admin: boolean;
  debe_cambiar_password: boolean;
}

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const [passwordVisible, setPasswordVisible] = useState<{ nombre: string; username: string; password: string } | null>(null);
  const [showNuevoForm, setShowNuevoForm] = useState(false);

  const { data: usuarios = [], isLoading } = useQuery<UsuarioRow[]>({
    queryKey: ["usuarios"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
  });

  const resetMutation = useMutation({
    mutationFn: async (userId: number) =>
      (await apiClient.post(`/api/v1/auth/reset-password/${userId}`)).data,
    onSuccess: (data) => {
      setPasswordVisible({ nombre: data.nombre, username: data.username, password: data.password_temporal });
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });

  const actualizarMutation = useMutation({
    mutationFn: async ({ id, ...body }: { id: number; activo?: boolean; es_admin?: boolean }) =>
      (await apiClient.patch(`/api/v1/auth/usuarios/${id}`, body)).data,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["usuarios"] }),
  });

  const crearMutation = useMutation({
    mutationFn: async (body: { username: string; nombre: string; es_admin: boolean }) =>
      (await apiClient.post("/api/v1/auth/usuarios", body)).data,
    onSuccess: (data) => {
      setPasswordVisible({ nombre: data.nombre, username: data.username, password: data.password_temporal });
      setShowNuevoForm(false);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });

  return (
    <div>
      {/* Header */}
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
        <div>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Gestión de usuarios</h2>
          <p style={{ margin: "2px 0 0", fontSize: "12px", color: "#94a3b8" }}>{usuarios.length} usuarios registrados</p>
        </div>
        <button
          onClick={() => setShowNuevoForm(true)}
          style={{
            padding: "8px 16px", borderRadius: "7px", border: "none", cursor: "pointer",
            background: "#2563eb", color: "white", fontSize: "13px", fontWeight: 600,
          }}
        >
          + Nuevo usuario
        </button>
      </div>

      {/* Tabla */}
      <div style={{ background: "white", borderRadius: "10px", border: "1px solid #e2e8f0", overflow: "hidden", boxShadow: "0 1px 2px rgba(0,0,0,0.04)" }}>
        {isLoading ? (
          <p style={{ padding: "32px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>Cargando usuarios...</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
                {["Nombre", "Usuario", "Rol", "Estado", "Contraseña", ""].map(h => (
                  <th key={h} style={{ padding: "10px 16px", fontWeight: 600, fontSize: "11px", color: "#64748b", textAlign: "left", textTransform: "uppercase", letterSpacing: "0.05em", whiteSpace: "nowrap" }}>
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {usuarios.map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", opacity: u.activo ? 1 : 0.55 }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>{u.nombre}</td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace", fontSize: "12px" }}>{u.username}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => actualizarMutation.mutate({ id: u.id, es_admin: !u.es_admin })}
                      title="Clic para cambiar rol"
                      style={{
                        padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                        cursor: "pointer",
                        background: u.es_admin ? "#eff6ff" : "#f8fafc",
                        color: u.es_admin ? "#1d4ed8" : "#64748b",
                        border: `1px solid ${u.es_admin ? "#bfdbfe" : "#e2e8f0"}`,
                      }}
                    >
                      {u.es_admin ? "Admin" : "Técnico"}
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <button
                      onClick={() => actualizarMutation.mutate({ id: u.id, activo: !u.activo })}
                      title="Clic para activar/desactivar"
                      style={{
                        padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                        cursor: "pointer",
                        background: u.activo ? "#f0fdf4" : "#fef2f2",
                        color: u.activo ? "#16a34a" : "#dc2626",
                        border: `1px solid ${u.activo ? "#bbf7d0" : "#fecaca"}`,
                      }}
                    >
                      {u.activo ? "Activo" : "Inactivo"}
                    </button>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    {u.debe_cambiar_password
                      ? <span style={{ fontSize: "11px", color: "#d97706", fontWeight: 600 }}>⚠ Temporal</span>
                      : <span style={{ fontSize: "11px", color: "#16a34a", fontWeight: 600 }}>✓ Configurada</span>}
                  </td>
                  <td style={{ padding: "12px 16px", textAlign: "right" }}>
                    <button
                      onClick={() => resetMutation.mutate(u.id)}
                      disabled={resetMutation.isPending}
                      style={{
                        padding: "4px 12px", borderRadius: "5px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                        border: "1px solid #fecaca", background: "#fef2f2", color: "#dc2626",
                      }}
                    >
                      Resetear clave
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal nuevo usuario */}
      {showNuevoForm && (
        <NuevoUsuarioModal
          onClose={() => setShowNuevoForm(false)}
          onSubmit={(data) => crearMutation.mutate(data)}
          isPending={crearMutation.isPending}
          error={crearMutation.error ? String((crearMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al crear usuario.") : ""}
        />
      )}

      {/* Modal contraseña generada */}
      {passwordVisible && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "380px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔑</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>
              {resetMutation.isSuccess ? "Contraseña restablecida" : "Usuario creado"}
            </h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b" }}>
              Comparte esta contraseña temporal con <strong>{passwordVisible.nombre}</strong>.<br />
              Deberá cambiarla al iniciar sesión.
            </p>
            <div style={{ background: "#f8fafc", border: "2px dashed #cbd5e1", borderRadius: "8px", padding: "14px", marginBottom: "20px" }}>
              <p style={{ margin: "0 0 4px", fontSize: "11px", color: "#94a3b8", fontWeight: 600, textTransform: "uppercase" }}>
                {passwordVisible.username}
              </p>
              <p style={{ margin: 0, fontSize: "22px", fontWeight: 700, color: "#0f172a", fontFamily: "monospace", letterSpacing: "0.05em" }}>
                {passwordVisible.password}
              </p>
            </div>
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => navigator.clipboard.writeText(passwordVisible.password)}
                style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "#f8fafc", color: "#334155", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Copiar
              </button>
              <button
                onClick={() => setPasswordVisible(null)}
                style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "none", background: "#0f172a", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Listo
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ── Modal nuevo usuario ────────────────────────────────────────────────────────

function NuevoUsuarioModal({
  onClose, onSubmit, isPending, error,
}: {
  onClose: () => void;
  onSubmit: (data: { username: string; nombre: string; es_admin: boolean }) => void;
  isPending: boolean;
  error: string;
}) {
  const [nombre, setNombre]     = useState("");
  const [username, setUsername] = useState("");
  const [esAdmin, setEsAdmin]   = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !username.trim()) return;
    onSubmit({ username: username.trim().toLowerCase(), nombre: nombre.trim(), es_admin: esAdmin });
  }

  return (
    <div
      onClick={onClose}
      style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{ background: "white", borderRadius: "12px", padding: "28px", width: "400px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
      >
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "20px" }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Nuevo usuario</h2>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "14px" }}>
          <div>
            <label style={labelStyle}>Nombre completo</label>
            <input
              value={nombre} onChange={e => setNombre(e.target.value)}
              placeholder="Ej. Juan Pérez" required style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Usuario</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
              placeholder="Ej. jperez" required style={inputStyle}
            />
            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>
              Solo letras, números y guiones. Se usará para iniciar sesión.
            </p>
          </div>
          <div>
            <label style={labelStyle}>Rol</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {[
                { value: false, label: "Técnico", color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
                { value: true,  label: "Admin",   color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
              ].map(opt => {
                const active = esAdmin === opt.value;
                return (
                  <button
                    key={String(opt.value)} type="button"
                    onClick={() => setEsAdmin(opt.value)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: "7px", fontSize: "13px",
                      fontWeight: 600, cursor: "pointer",
                      border: `1.5px solid ${active ? opt.border : "#e2e8f0"}`,
                      color: active ? opt.color : "#94a3b8",
                      background: active ? opt.bg : "white",
                    }}
                  >
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          {error && (
            <div style={{ padding: "8px 12px", borderRadius: "7px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "13px", color: "#dc2626" }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Cancelar
            </button>
            <button
              type="submit" disabled={isPending || !nombre.trim() || !username.trim()}
              style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "none", background: isPending ? "#cbd5e1" : "#2563eb", color: "white", fontSize: "13px", fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer" }}
            >
              {isPending ? "Creando..." : "Crear usuario"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: "4px",
  fontSize: "11px", fontWeight: 700, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 11px", borderRadius: "7px",
  border: "1px solid #e2e8f0", fontSize: "13px",
  color: "#1e293b", background: "#f8fafc", outline: "none",
};
