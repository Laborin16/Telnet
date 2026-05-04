import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import { useAllClients } from "../../clients/hooks/useAllClients";
import { useCrearTarea } from "../hooks/useTareaActions";
import type { ClientItem } from "../../../core/types/client";
import type { PrioridadTarea, TipoTarea } from "../types/reportes";

// ── Opciones ───────────────────────────────────────────────────────────────────

const TIPOS: { value: TipoTarea; label: string }[] = [
  { value: "INSTALACION",     label: "Instalación" },
  { value: "RECOLECCION",     label: "Recolección" },
  { value: "FALLA_RED",       label: "Falla de red" },
  { value: "SOPORTE_TECNICO", label: "Soporte técnico" },
  { value: "MANTENIMIENTO",   label: "Mantenimiento" },
  { value: "CAMBIO_PLAN",     label: "Cambio de plan" },
  { value: "REUBICACION",     label: "Reubicación" },
];

const PRIORIDADES: { value: PrioridadTarea; label: string; color: string }[] = [
  { value: "ALTA",  label: "Alta",  color: "#dc2626" },
  { value: "MEDIA", label: "Media", color: "#d97706" },
  { value: "BAJA",  label: "Baja",  color: "#16a34a" },
];

interface UsuarioItem { id: number; nombre: string; username: string; activo: boolean }

// ── Componente ─────────────────────────────────────────────────────────────────

interface Props { onClose: () => void }

export function NuevaTareaModal({ onClose }: Props) {
  const { mutate: crearTarea, isPending } = useCrearTarea();
  const { data: allClients = [] } = useAllClients();

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo);

  const [tipo, setTipo]                       = useState<TipoTarea>("INSTALACION");
  const [prioridad, setPrioridad]             = useState<PrioridadTarea>("MEDIA");
  const [selectedClient, setSelectedClient]   = useState<ClientItem | null>(null);
  const [clientSearch, setClientSearch]       = useState("");
  const [showDropdown, setShowDropdown]       = useState(false);
  const [tecnicoId, setTecnicoId]             = useState<string>("");
  const [descripcion, setDescripcion]         = useState("");
  const [error, setError]                     = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const clientesFiltrados = clientSearch.trim().length >= 2
    ? allClients
        .filter(c => {
          const q = clientSearch.toLowerCase();
          return (
            c.nombre.toLowerCase().includes(q) ||
            String(c.id_servicio).includes(q)
          );
        })
        .slice(0, 10)
    : [];

  function handleSelectClient(c: ClientItem) {
    setSelectedClient(c);
    setClientSearch("");
    setShowDropdown(false);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedClient) {
      setError("Selecciona un cliente.");
      return;
    }
    if (!descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    setError("");
    crearTarea(
      {
        id_servicio: selectedClient.id_servicio,
        tipo,
        prioridad,
        descripcion: descripcion.trim(),
        tecnico_id: tecnicoId ? parseInt(tecnicoId, 10) : null,
      },
      {
        onSuccess: onClose,
        onError: (err: unknown) => {
          const msg = (err as { response?: { data?: { detail?: string } } })
            ?.response?.data?.detail;
          setError(msg ?? "Error al crear la tarea.");
        },
      }
    );
  }

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 800,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "center", justifyContent: "center",
        padding: "24px 16px",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "14px",
          width: "100%", maxWidth: "480px",
          maxHeight: "90vh", overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Cabecera */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
          position: "sticky", top: 0, background: "white", zIndex: 1,
        }}>
          <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
            Nueva tarea
          </h2>
          <button
            onClick={onClose}
            style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#94a3b8", padding: "4px", lineHeight: 1 }}
          >
            ✕
          </button>
        </div>

        {/* Formulario */}
        <form onSubmit={handleSubmit} style={{ padding: "22px 24px", display: "flex", flexDirection: "column", gap: "16px" }}>

          {/* Tipo */}
          <div>
            <label style={labelStyle}>Tipo de tarea</label>
            <select value={tipo} onChange={e => setTipo(e.target.value as TipoTarea)} style={selectStyle}>
              {TIPOS.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
            </select>
          </div>

          {/* Prioridad */}
          <div>
            <label style={labelStyle}>Prioridad</label>
            <div style={{ display: "flex", gap: "6px" }}>
              {PRIORIDADES.map(p => {
                const active = prioridad === p.value;
                return (
                  <button
                    key={p.value} type="button" onClick={() => setPrioridad(p.value)}
                    style={{
                      flex: 1, padding: "7px 0", borderRadius: "8px", fontSize: "13px",
                      fontWeight: 600, cursor: "pointer",
                      border: `1.5px solid ${active ? p.color : "#e2e8f0"}`,
                      color: active ? "white" : p.color,
                      background: active ? p.color : `${p.color}12`,
                      transition: "all 0.15s",
                    }}
                  >
                    {p.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Selector de cliente */}
          <div>
            <label style={labelStyle}>Cliente</label>
            {selectedClient ? (
              <div style={{
                padding: "10px 12px", borderRadius: "8px",
                background: "#f0f9ff", border: "1px solid #7dd3fc",
                display: "flex", alignItems: "flex-start", gap: "10px",
              }}>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>
                    {selectedClient.nombre}
                  </p>
                  <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
                    Servicio #{selectedClient.id_servicio}
                    {selectedClient.plan_internet && ` · ${selectedClient.plan_internet.nombre}`}
                  </p>
                  {selectedClient.telefono && (
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
                      📞 {selectedClient.telefono}
                    </p>
                  )}
                  {selectedClient.direccion && (
                    <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>
                      📍 {selectedClient.direccion}
                    </p>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => setSelectedClient(null)}
                  style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#94a3b8", flexShrink: 0, padding: "2px" }}
                >
                  ✕
                </button>
              </div>
            ) : (
              <div ref={searchRef} style={{ position: "relative" }}>
                <input
                  type="text"
                  value={clientSearch}
                  onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); }}
                  onFocus={() => setShowDropdown(true)}
                  onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                  placeholder="Buscar por nombre o ID de servicio..."
                  style={inputStyle}
                  autoComplete="off"
                />
                {showDropdown && clientesFiltrados.length > 0 && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    zIndex: 10, background: "white",
                    border: "1px solid #e2e8f0", borderRadius: "8px",
                    boxShadow: "0 8px 24px rgba(0,0,0,0.1)",
                    maxHeight: "220px", overflowY: "auto",
                  }}>
                    {clientesFiltrados.map(c => (
                      <button
                        key={c.id_servicio}
                        type="button"
                        onMouseDown={() => handleSelectClient(c)}
                        style={{
                          width: "100%", padding: "9px 12px", textAlign: "left",
                          background: "none", border: "none", cursor: "pointer",
                          borderBottom: "1px solid #f1f5f9",
                          display: "flex", flexDirection: "column", gap: "2px",
                        }}
                      >
                        <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>
                          {c.nombre}
                        </span>
                        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
                          #{c.id_servicio}
                          {c.plan_internet && ` · ${c.plan_internet.nombre}`}
                          {c.zona && ` · ${c.zona.nombre}`}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
                {showDropdown && clientSearch.trim().length >= 2 && clientesFiltrados.length === 0 && (
                  <div style={{
                    position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0,
                    zIndex: 10, background: "white",
                    border: "1px solid #e2e8f0", borderRadius: "8px",
                    padding: "12px", fontSize: "13px", color: "#94a3b8", textAlign: "center",
                  }}>
                    Sin resultados
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Técnico asignado */}
          <div>
            <label style={labelStyle}>Técnico asignado <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
            <select value={tecnicoId} onChange={e => setTecnicoId(e.target.value)} style={selectStyle}>
              <option value="">Sin asignar</option>
              {tecnicosActivos.map(u => (
                <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>
              ))}
            </select>
          </div>

          {/* Descripción */}
          <div>
            <label style={labelStyle}>Descripción</label>
            <textarea
              value={descripcion}
              onChange={e => setDescripcion(e.target.value)}
              placeholder="Describe el trabajo a realizar..."
              rows={4}
              style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }}
            />
          </div>

          {/* Error */}
          {error && (
            <div style={{
              padding: "10px 12px", borderRadius: "8px",
              background: "#fef2f2", border: "1px solid #fecaca",
              fontSize: "13px", color: "#dc2626",
            }}>
              {error}
            </div>
          )}

          {/* Acciones */}
          <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
            <button
              type="button" onClick={onClose} disabled={isPending}
              style={{
                padding: "8px 18px", borderRadius: "8px", fontSize: "13px",
                border: "1px solid #e2e8f0", background: "white",
                color: "#64748b", cursor: "pointer", fontWeight: 500,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit" disabled={isPending}
              style={{
                padding: "8px 22px", borderRadius: "8px", fontSize: "13px",
                fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer",
                border: "none",
                background: isPending ? "#cbd5e1" : "#2563eb",
                color: "white",
                boxShadow: isPending ? "none" : "0 2px 8px rgba(37,99,235,0.3)",
              }}
            >
              {isPending ? "Creando..." : "Crear tarea"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Estilos base ───────────────────────────────────────────────────────────────

const labelStyle: React.CSSProperties = {
  display: "block", marginBottom: "5px",
  fontSize: "11px", fontWeight: 700, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.06em",
};

const inputStyle: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "9px 11px", borderRadius: "7px",
  border: "1px solid #e2e8f0", fontSize: "13px",
  color: "#1e293b", background: "#f8fafc", outline: "none",
};

const selectStyle: React.CSSProperties = {
  ...inputStyle, cursor: "pointer",
};
