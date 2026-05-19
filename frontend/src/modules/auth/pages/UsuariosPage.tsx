import { useState, useRef, useEffect } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import { useAuth } from "../hooks/useAuth";
import { useToast } from "../../../shared/hooks/useToast";

type RolUsuario = "administrador" | "supervisor" | "tecnico" | "cobranza" | "ventas";

const ROL_META: Record<RolUsuario, { label: string; color: string; bg: string; border: string }> = {
  administrador: { label: "Admin",      color: "#1d4ed8", bg: "#eff6ff", border: "#bfdbfe" },
  supervisor:    { label: "Supervisor", color: "#0e7490", bg: "#ecfeff", border: "#a5f3fc" },
  cobranza:      { label: "Cobranza",   color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  ventas:        { label: "Ventas",     color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
  tecnico:       { label: "Técnico",    color: "#64748b", bg: "#f8fafc", border: "#e2e8f0" },
};

interface UsuarioRow {
  id: number;
  username: string;
  nombre: string;
  activo: boolean;
  rol: RolUsuario;
  es_admin: boolean;
  debe_cambiar_password: boolean;
  sueldo_semanal: number | null;
  area: string | null;
  en_nomina: boolean;
  monto_bono: number | null;
}

export function UsuariosPage() {
  const { user } = useAuth();
  const esAdmin = user?.rol === "administrador";
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  const [passwordVisible, setPasswordVisible] = useState<{ nombre: string; username: string; password: string } | null>(null);
  const [showNuevoForm, setShowNuevoForm] = useState(false);
  const [confirmarEliminar, setConfirmarEliminar] = useState<UsuarioRow | null>(null);
  const [editando, setEditando] = useState<UsuarioRow | null>(null);

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
    mutationFn: async ({ id, ...body }: {
      id: number;
      activo?: boolean; rol?: RolUsuario; nombre?: string;
      sueldo_semanal?: number | null; area?: string | null; en_nomina?: boolean;
      monto_bono?: number | null;
    }) =>
      (await apiClient.patch(`/api/v1/auth/usuarios/${id}`, body)).data,
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios-en-nomina"] });
      if (variables.rol !== undefined) addToast("Rol actualizado correctamente.");
      if (variables.activo !== undefined) addToast(variables.activo ? "Usuario activado." : "Usuario desactivado.");
    },
    onError: () => addToast("Error al actualizar el usuario.", "error"),
  });

  const eliminarMutation = useMutation({
    mutationFn: async (userId: number) => apiClient.delete(`/api/v1/auth/usuarios/${userId}`),
    onSuccess: () => {
      setConfirmarEliminar(null);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
    },
  });

  const crearMutation = useMutation({
    mutationFn: async (body: {
      username: string; nombre: string; rol: RolUsuario;
      sueldo_semanal?: number | null; area?: string | null; en_nomina?: boolean;
      monto_bono?: number | null;
    }) => (await apiClient.post("/api/v1/auth/usuarios", body)).data,
    onSuccess: (data) => {
      setPasswordVisible({ nombre: data.nombre, username: data.username, password: data.password_temporal });
      setShowNuevoForm(false);
      queryClient.invalidateQueries({ queryKey: ["usuarios"] });
      queryClient.invalidateQueries({ queryKey: ["usuarios-en-nomina"] });
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
        {esAdmin && (
          <button
            onClick={() => setShowNuevoForm(true)}
            style={{
              padding: "8px 16px", borderRadius: "7px", border: "none", cursor: "pointer",
              background: "#2563eb", color: "white", fontSize: "13px", fontWeight: 600,
            }}
          >
            + Nuevo usuario
          </button>
        )}
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
              {[...usuarios].sort((a, b) => a.nombre.localeCompare(b.nombre, "es", { sensitivity: "base" })).map(u => (
                <tr key={u.id} style={{ borderBottom: "1px solid #f1f5f9", opacity: u.activo ? 1 : 0.55 }}>
                  <td style={{ padding: "12px 16px", fontWeight: 500, color: "#0f172a" }}>{u.nombre}</td>
                  <td style={{ padding: "12px 16px", color: "#64748b", fontFamily: "monospace", fontSize: "12px" }}>{u.username}</td>
                  <td style={{ padding: "12px 16px" }}>
                    <RolSelector
                      rol={u.rol ?? (u.es_admin ? "administrador" : "tecnico")}
                      onChange={(nuevoRol) => actualizarMutation.mutate({ id: u.id, rol: nuevoRol })}
                      disabled={actualizarMutation.isPending}
                    />
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
                    <div style={{ display: "flex", gap: "6px", justifyContent: "flex-end" }}>
                      {esAdmin && (
                        <button
                          onClick={() => setEditando(u)}
                          style={{
                            padding: "4px 10px", borderRadius: "5px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                            border: "1px solid #e2e8f0", background: "white", color: "#475569",
                          }}
                          title="Editar usuario"
                        >
                          ✏ Editar
                        </button>
                      )}
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
                      {esAdmin && (
                        <button
                          onClick={() => setConfirmarEliminar(u)}
                          style={{
                            padding: "4px 10px", borderRadius: "5px", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                            border: "1px solid #e2e8f0", background: "#f8fafc", color: "#94a3b8",
                          }}
                          title="Eliminar usuario"
                        >
                          🗑
                        </button>
                      )}
                    </div>
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

      {/* Modal editar usuario */}
      {editando && (
        <EditarUsuarioModal
          usuario={editando}
          onClose={() => setEditando(null)}
          onSubmit={(body) => actualizarMutation.mutate({ id: editando.id, ...body }, {
            onSuccess: () => { addToast("Usuario actualizado."); setEditando(null); },
          })}
          isPending={actualizarMutation.isPending}
        />
      )}

      {/* Modal confirmar eliminación */}
      {confirmarEliminar && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}
          onClick={() => setConfirmarEliminar(null)}>
          <div style={{ background: "white", borderRadius: "12px", padding: "28px", width: "380px", maxWidth: "90vw", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}
            onClick={e => e.stopPropagation()}>
            <div style={{ textAlign: "center", marginBottom: "20px" }}>
              <div style={{ fontSize: "36px", marginBottom: "10px" }}>⚠️</div>
              <h3 style={{ margin: "0 0 6px", fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
                Eliminar usuario
              </h3>
              <p style={{ margin: 0, fontSize: "13px", color: "#64748b", lineHeight: 1.5 }}>
                ¿Estás seguro de que deseas eliminar a <strong>{confirmarEliminar.nombre}</strong>?<br />
                Esta acción no se puede deshacer.
              </p>
            </div>
            {eliminarMutation.error && (
              <div style={{ padding: "8px 12px", marginBottom: "14px", borderRadius: "7px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "13px", color: "#dc2626", textAlign: "center" }}>
                {String((eliminarMutation.error as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al eliminar.")}
              </div>
            )}
            <div style={{ display: "flex", gap: "8px" }}>
              <button
                onClick={() => setConfirmarEliminar(null)}
                style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
              >
                Cancelar
              </button>
              <button
                onClick={() => eliminarMutation.mutate(confirmarEliminar.id)}
                disabled={eliminarMutation.isPending}
                style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "none", background: eliminarMutation.isPending ? "#cbd5e1" : "#dc2626", color: "white", fontSize: "13px", fontWeight: 600, cursor: eliminarMutation.isPending ? "not-allowed" : "pointer" }}
              >
                {eliminarMutation.isPending ? "Eliminando..." : "Sí, eliminar"}
              </button>
            </div>
          </div>
        </div>
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
  onSubmit: (data: {
    username: string; nombre: string; rol: RolUsuario;
    sueldo_semanal?: number | null; area?: string | null; en_nomina?: boolean;
  }) => void;
  isPending: boolean;
  error: string;
}) {
  const [nombre, setNombre]       = useState("");
  const [username, setUsername]   = useState("");
  const [rol, setRol]             = useState<RolUsuario>("tecnico");
  const [enNomina, setEnNomina]   = useState(false);
  const [sueldoSemanal, setSueldoSemanal] = useState("");
  const [area, setArea]           = useState("");
  const [montoBono, setMontoBono] = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim() || !username.trim()) return;
    const sueldoSemNum = parseFloat(sueldoSemanal);
    const bonoNum = parseFloat(montoBono);
    onSubmit({
      username: username.trim().toLowerCase(),
      nombre: nombre.trim(),
      rol,
      en_nomina: enNomina,
      sueldo_semanal: enNomina && !isNaN(sueldoSemNum) && sueldoSemNum > 0 ? sueldoSemNum : null,
      area: enNomina ? area.trim() || null : null,
      monto_bono: enNomina && rol === "tecnico" && !isNaN(bonoNum) && bonoNum > 0 ? bonoNum : null,
    });
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
            <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Juan Pérez" required style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Usuario</label>
            <input
              value={username}
              onChange={e => setUsername(e.target.value.toLowerCase().replace(/\s/g, ""))}
              placeholder="Ej. jperez" required style={inputStyle}
            />
            <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>Solo letras y números. Se usará para iniciar sesión.</p>
          </div>
          <div>
            <label style={labelStyle}>Rol</label>
            <div style={{ display: "flex", gap: "8px" }}>
              {(Object.entries(ROL_META) as [RolUsuario, typeof ROL_META[RolUsuario]][]).map(([value, meta]) => {
                const active = rol === value;
                return (
                  <button
                    key={value} type="button" onClick={() => setRol(value)}
                    style={{
                      flex: 1, padding: "8px", borderRadius: "7px", fontSize: "12px",
                      fontWeight: 600, cursor: "pointer",
                      border: `1.5px solid ${active ? meta.border : "#e2e8f0"}`,
                      color: active ? meta.color : "#94a3b8",
                      background: active ? meta.bg : "white",
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={enNomina} onChange={e => setEnNomina(e.target.checked)} />
              Incluir en nómina semanal
            </label>
            {enNomina && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <div>
                  <label style={labelStyle}>Sueldo semanal</label>
                  <input type="number" min="0" step="0.01" value={sueldoSemanal} onChange={e => setSueldoSemanal(e.target.value)} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Área</label>
                  <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ej. Técnico" style={inputStyle} />
                </div>
              </div>
            )}
            {enNomina && rol === "tecnico" && (
              <div style={{ marginTop: "10px" }}>
                <label style={labelStyle}>Bono por productividad (semanal)</label>
                <input type="number" min="0" step="0.01" value={montoBono} onChange={e => setMontoBono(e.target.value)} placeholder="0.00" style={inputStyle} />
                <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>Se aplica automáticamente si cumple 6 de los 7 días de la semana.</p>
              </div>
            )}
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


// ── Modal editar usuario ───────────────────────────────────────────────────────

function EditarUsuarioModal({
  usuario, onClose, onSubmit, isPending,
}: {
  usuario: UsuarioRow;
  onClose: () => void;
  onSubmit: (data: {
    nombre?: string; rol?: RolUsuario; activo?: boolean;
    sueldo_semanal?: number | null; area?: string | null; en_nomina?: boolean;
    monto_bono?: number | null;
  }) => void;
  isPending: boolean;
}) {
  const [nombre, setNombre]       = useState(usuario.nombre);
  const [rol, setRol]             = useState<RolUsuario>(usuario.rol);
  const [enNomina, setEnNomina]   = useState(usuario.en_nomina);
  const [sueldoSemanal, setSueldoSemanal] = useState(
    usuario.sueldo_semanal != null ? String(usuario.sueldo_semanal) : "",
  );
  const [area, setArea]           = useState(usuario.area ?? "");
  const [montoBono, setMontoBono] = useState(usuario.monto_bono != null ? String(usuario.monto_bono) : "");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const sueldoSemNum = parseFloat(sueldoSemanal);
    const bonoNum = parseFloat(montoBono);
    onSubmit({
      nombre: nombre.trim() || undefined,
      rol,
      en_nomina: enNomina,
      sueldo_semanal: enNomina && !isNaN(sueldoSemNum) && sueldoSemNum > 0 ? sueldoSemNum : null,
      area: enNomina ? area.trim() || null : null,
      monto_bono: enNomina && rol === "tecnico" && !isNaN(bonoNum) && bonoNum > 0 ? bonoNum : null,
    });
  }

  return (
    <div onClick={onClose} style={{ position: "fixed", inset: 0, background: "rgba(0,0,0,0.45)", zIndex: 1000, display: "flex", alignItems: "center", justifyContent: "center" }}>
      <div onClick={e => e.stopPropagation()} style={{ background: "white", borderRadius: "12px", padding: "28px", width: "440px", maxWidth: "92vw", maxHeight: "92vh", overflowY: "auto", boxShadow: "0 20px 60px rgba(0,0,0,0.2)" }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "16px" }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>Editar usuario</h2>
            <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#94a3b8", fontFamily: "monospace" }}>{usuario.username}</p>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", fontSize: "18px", cursor: "pointer", color: "#94a3b8" }}>✕</button>
        </div>

        <form onSubmit={handleSubmit} style={{ display: "flex", flexDirection: "column", gap: "12px" }}>
          <div>
            <label style={labelStyle}>Nombre completo</label>
            <input value={nombre} onChange={e => setNombre(e.target.value)} required style={inputStyle} />
          </div>

          <div>
            <label style={labelStyle}>Rol</label>
            <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
              {(Object.entries(ROL_META) as [RolUsuario, typeof ROL_META[RolUsuario]][]).map(([value, meta]) => {
                const active = rol === value;
                return (
                  <button
                    key={value} type="button" onClick={() => setRol(value)}
                    style={{
                      flex: "1 1 100px", padding: "7px", borderRadius: "7px", fontSize: "12px",
                      fontWeight: 600, cursor: "pointer",
                      border: `1.5px solid ${active ? meta.border : "#e2e8f0"}`,
                      color: active ? meta.color : "#94a3b8",
                      background: active ? meta.bg : "white",
                    }}
                  >
                    {meta.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "12px" }}>
            <label style={{ display: "flex", alignItems: "center", gap: "8px", fontSize: "12px", fontWeight: 600, color: "#475569", cursor: "pointer" }}>
              <input type="checkbox" checked={enNomina} onChange={e => setEnNomina(e.target.checked)} />
              Incluir en nómina semanal
            </label>
            {enNomina && (
              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "10px", marginTop: "10px" }}>
                <div>
                  <label style={labelStyle}>Sueldo semanal</label>
                  <input type="number" min="0" step="0.01" value={sueldoSemanal} onChange={e => setSueldoSemanal(e.target.value)} placeholder="0.00" style={inputStyle} />
                </div>
                <div>
                  <label style={labelStyle}>Área</label>
                  <input value={area} onChange={e => setArea(e.target.value)} placeholder="Ej. Técnico" style={inputStyle} />
                </div>
              </div>
            )}
            {enNomina && rol === "tecnico" && (
              <div style={{ marginTop: "10px" }}>
                <label style={labelStyle}>Bono por productividad (semanal)</label>
                <input type="number" min="0" step="0.01" value={montoBono} onChange={e => setMontoBono(e.target.value)} placeholder="0.00" style={inputStyle} />
                <p style={{ margin: "3px 0 0", fontSize: "11px", color: "#94a3b8" }}>Se aplica automáticamente si cumple 6 de los 7 días de la semana.</p>
              </div>
            )}
          </div>

          <div style={{ display: "flex", gap: "8px", marginTop: "4px" }}>
            <button type="button" onClick={onClose} style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}>
              Cancelar
            </button>
            <button
              type="submit" disabled={isPending || !nombre.trim()}
              style={{ flex: 1, padding: "9px", borderRadius: "7px", border: "none", background: isPending ? "#cbd5e1" : "#2563eb", color: "white", fontSize: "13px", fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer" }}
            >
              {isPending ? "Guardando..." : "Guardar cambios"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Selector de rol inline ─────────────────────────────────────────────────────

function RolSelector({ rol, onChange, disabled }: { rol: RolUsuario; onChange: (r: RolUsuario) => void; disabled?: boolean }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState({ top: 0, left: 0, openUp: false });
  const btnRef = useRef<HTMLButtonElement>(null);
  const meta = ROL_META[rol] ?? ROL_META.tecnico;

  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (btnRef.current && !btnRef.current.closest("[data-rolselector]")?.contains(e.target as Node))
        setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  function handleOpen() {
    if (disabled) return;
    if (!btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const dropH = 4 * 36; // aprox altura del dropdown (4 opciones)
    const openUp = r.bottom + dropH > window.innerHeight;
    setPos({ top: openUp ? r.top - dropH - 4 : r.bottom + 4, left: r.left, openUp });
    setOpen(p => !p);
  }

  return (
    <div style={{ position: "relative", display: "inline-block" }} data-rolselector>
      <button
        ref={btnRef}
        onClick={handleOpen}
        style={{
          padding: "2px 8px", borderRadius: "20px", fontSize: "11px", fontWeight: 600,
          cursor: disabled ? "not-allowed" : "pointer", background: meta.bg, color: meta.color,
          border: `1px solid ${meta.border}`, opacity: disabled ? 0.6 : 1,
        }}
      >
        {meta.label} ▾
      </button>
      {open && (
        <div style={{
          position: "fixed", top: pos.top, left: pos.left, zIndex: 1000,
          background: "white", border: "1px solid #e2e8f0", borderRadius: "8px",
          boxShadow: "0 4px 16px rgba(0,0,0,0.12)", minWidth: "130px", overflow: "hidden",
        }}>
          {(Object.entries(ROL_META) as [RolUsuario, typeof ROL_META[RolUsuario]][]).map(([value, m]) => (
            <button
              key={value}
              onClick={() => { onChange(value); setOpen(false); }}
              style={{
                width: "100%", padding: "8px 12px", textAlign: "left",
                background: rol === value ? m.bg : "none", border: "none",
                color: m.color, fontSize: "12px", fontWeight: 600, cursor: "pointer",
                borderBottom: "1px solid #f1f5f9",
              }}
            >
              {m.label}
            </button>
          ))}
        </div>
      )}
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
