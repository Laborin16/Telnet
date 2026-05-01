import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import { useCrearTarea } from "../hooks/useTareaActions";
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

interface UsuarioItem {
  id: number;
  nombre: string;
  username: string;
  activo: boolean;
}

// ── Componente ─────────────────────────────────────────────────────────────────

interface Props {
  onClose: () => void;
}

export function NuevaTareaModal({ onClose }: Props) {
  const { mutate: crearTarea, isPending } = useCrearTarea();

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo);

  const [tipo, setTipo]               = useState<TipoTarea>("INSTALACION");
  const [prioridad, setPrioridad]     = useState<PrioridadTarea>("MEDIA");
  const [idServicio, setIdServicio]   = useState("");
  const [tecnicoId, setTecnicoId]     = useState<string>("");
  const [descripcion, setDescripcion] = useState("");
  const [error, setError]             = useState("");

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const idSrv = parseInt(idServicio, 10);
    if (!idServicio || isNaN(idSrv) || idSrv <= 0) {
      setError("Ingresa un ID de servicio válido.");
      return;
    }
    if (!descripcion.trim()) {
      setError("La descripción es obligatoria.");
      return;
    }
    setError("");
    crearTarea(
      {
        id_servicio: idSrv,
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
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Cabecera */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
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
            <select
              value={tipo}
              onChange={e => setTipo(e.target.value as TipoTarea)}
              style={selectStyle}
            >
              {TIPOS.map(t => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
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
                    key={p.value}
                    type="button"
                    onClick={() => setPrioridad(p.value)}
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

          {/* ID de servicio */}
          <div>
            <label style={labelStyle}>ID de servicio (WispHub)</label>
            <input
              type="number"
              min="1"
              value={idServicio}
              onChange={e => setIdServicio(e.target.value)}
              placeholder="Ej. 1042"
              style={inputStyle}
            />
          </div>

          {/* Técnico asignado */}
          <div>
            <label style={labelStyle}>Técnico asignado <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
            <select
              value={tecnicoId}
              onChange={e => setTecnicoId(e.target.value)}
              style={selectStyle}
            >
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
              type="button"
              onClick={onClose}
              disabled={isPending}
              style={{
                padding: "8px 18px", borderRadius: "8px", fontSize: "13px",
                border: "1px solid #e2e8f0", background: "white",
                color: "#64748b", cursor: "pointer", fontWeight: 500,
              }}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={isPending}
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
