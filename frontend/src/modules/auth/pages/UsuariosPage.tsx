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

interface SyncResult {
  creados: number;
  actualizados: number;
  total: number;
  passwords_temporales: { username: string; nombre: string; password_temporal: string }[];
}

export function UsuariosPage() {
  const queryClient = useQueryClient();
  const [passwordVisible, setPasswordVisible] = useState<{ nombre: string; username: string; password: string } | null>(null);
  const [syncResult, setSyncResult] = useState<SyncResult | null>(null);

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

  const syncMutation = useMutation({
    mutationFn: async () => (await apiClient.post("/api/v1/auth/sync-usuarios")).data,
    onSuccess: (data: SyncResult) => {
      setSyncResult(data);
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
          onClick={() => syncMutation.mutate()}
          disabled={syncMutation.isPending}
          style={{
            padding: "8px 16px", borderRadius: "7px", border: "none", cursor: "pointer",
            background: syncMutation.isPending ? "#cbd5e1" : "#0f172a",
            color: "white", fontSize: "13px", fontWeight: 600,
          }}
        >
          {syncMutation.isPending ? "Sincronizando..." : "Sincronizar desde WispHub"}
        </button>
      </div>

      {/* Resultado de sincronización */}
      {syncResult && (
        <div style={{ background: "#f0fdf4", border: "1px solid #86efac", borderRadius: "8px", padding: "12px 16px", marginBottom: "14px" }}>
          <p style={{ margin: "0 0 4px", fontSize: "13px", fontWeight: 600, color: "#15803d" }}>
            Sincronización completada — {syncResult.creados} creados, {syncResult.actualizados} actualizados
          </p>
          {syncResult.passwords_temporales.length > 0 && (
            <div style={{ marginTop: "10px" }}>
              <p style={{ margin: "0 0 6px", fontSize: "12px", fontWeight: 600, color: "#166534" }}>
                Contraseñas temporales de usuarios nuevos:
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                {syncResult.passwords_temporales.map(u => (
                  <div key={u.username} style={{ display: "flex", gap: "12px", fontSize: "12px", fontFamily: "monospace", background: "white", padding: "6px 10px", borderRadius: "5px", border: "1px solid #bbf7d0" }}>
                    <span style={{ color: "#166534", fontWeight: 700, minWidth: "140px" }}>{u.nombre}</span>
                    <span style={{ color: "#64748b" }}>{u.username}</span>
                    <span style={{ color: "#0f172a", fontWeight: 700 }}>{u.password_temporal}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
          <button onClick={() => setSyncResult(null)} style={{ marginTop: "8px", background: "none", border: "none", fontSize: "11px", color: "#86efac", cursor: "pointer" }}>
            Cerrar
          </button>
        </div>
      )}

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
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>{u.nombre}</td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace", fontSize: "12px" }}>{u.username}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                      background: u.es_admin ? "#eff6ff" : "#f8fafc",
                      color: u.es_admin ? "#1d4ed8" : "#64748b",
                      border: `1px solid ${u.es_admin ? "#bfdbfe" : "#e2e8f0"}`,
                    }}>
                      {u.es_admin ? "Admin" : "Usuario"}
                    </span>
                  </td>
                  <td style={{ padding: "12px 16px" }}>
                    <span style={{
                      padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
                      background: u.activo ? "#f0fdf4" : "#fef2f2",
                      color: u.activo ? "#16a34a" : "#dc2626",
                      border: `1px solid ${u.activo ? "#bbf7d0" : "#fecaca"}`,
                    }}>
                      {u.activo ? "Activo" : "Inactivo"}
                    </span>
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
                      Resetear contraseña
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Modal con contraseña generada */}
      {passwordVisible && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
          <div style={{ background: "white", borderRadius: "12px", padding: "32px", width: "380px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)", textAlign: "center" }}>
            <div style={{ fontSize: "36px", marginBottom: "12px" }}>🔑</div>
            <h3 style={{ margin: "0 0 6px", fontSize: "17px", fontWeight: 700, color: "#0f172a" }}>Contraseña restablecida</h3>
            <p style={{ margin: "0 0 20px", fontSize: "13px", color: "#64748b" }}>
              Comparte esta contraseña temporal con <strong>{passwordVisible.nombre}</strong>.<br />
              El usuario deberá cambiarla al iniciar sesión.
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
