import { useState } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { useTareas } from "../hooks/useTareas";
import type { EstadoTarea, PrioridadTarea, Tarea, TipoTarea } from "../types/reportes";

// ── Etiquetas y colores ────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoTarea, string> = {
  INSTALACION:    "Instalación",
  RECOLECCION:    "Recolección",
  FALLA_RED:      "Falla de red",
  SOPORTE_TECNICO:"Soporte técnico",
  MANTENIMIENTO:  "Mantenimiento",
  CAMBIO_PLAN:    "Cambio de plan",
  REUBICACION:    "Reubicación",
};

const ESTADO_CONFIG: Record<EstadoTarea, { label: string; color: string; bg: string; border: string }> = {
  PENDIENTE:    { label: "Pendiente",     color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
  ASIGNADO:     { label: "Asignado",      color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  EN_RUTA:      { label: "En ruta",       color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  EN_EJECUCION: { label: "En ejecución",  color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  BLOQUEADO:    { label: "Bloqueado",     color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  COMPLETADO:   { label: "Completado",    color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  CANCELADO:    { label: "Cancelado",     color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0" },
};

const PRIORIDAD_CONFIG: Record<PrioridadTarea, { label: string; color: string }> = {
  ALTA:  { label: "Alta",  color: "#dc2626" },
  MEDIA: { label: "Media", color: "#d97706" },
  BAJA:  { label: "Baja",  color: "#16a34a" },
};

const ESTADOS_FILTRO: { value: EstadoTarea | ""; label: string }[] = [
  { value: "",            label: "Todos" },
  { value: "PENDIENTE",   label: "Pendiente" },
  { value: "ASIGNADO",    label: "Asignado" },
  { value: "EN_RUTA",     label: "En ruta" },
  { value: "EN_EJECUCION",label: "En ejecución" },
  { value: "BLOQUEADO",   label: "Bloqueado" },
  { value: "COMPLETADO",  label: "Completado" },
  { value: "CANCELADO",   label: "Cancelado" },
];

// ── Componente principal ───────────────────────────────────────────────────────

interface TareasPageProps {
  onSelectTarea: (id: number) => void;
  onNuevaTarea?: () => void;
}

export function TareasPage({ onSelectTarea, onNuevaTarea }: TareasPageProps) {
  const { user } = useAuth();
  const [estadoFiltro, setEstadoFiltro] = useState<EstadoTarea | "">("");
  const [prioridadFiltro, setPrioridadFiltro] = useState<PrioridadTarea | "">("");

  const { data: tareas, isLoading, isError } = useTareas({
    estado:    estadoFiltro   || undefined,
    prioridad: prioridadFiltro || undefined,
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Barra de acciones ─────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px", flexWrap: "wrap" }}>
        <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
          {isLoading ? "Cargando..." : isError ? "Error al cargar" : `${tareas?.length ?? 0} tareas`}
        </p>
        {user?.es_admin && onNuevaTarea && (
          <button onClick={onNuevaTarea} style={{
            padding: "8px 16px", borderRadius: "7px", border: "none",
            background: "#2563eb", color: "white",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
            boxShadow: "0 2px 6px rgba(37,99,235,0.3)",
          }}>
            + Nueva tarea
          </button>
        )}
      </div>

      {/* ── Filtros ───────────────────────────────────── */}
      <div style={{
        background: "white", borderRadius: "10px",
        border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px",
      }}>
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={labelStyle}>Estado:</span>
          {ESTADOS_FILTRO.map(({ value, label }) => {
            const active = estadoFiltro === value;
            const cfg = value ? ESTADO_CONFIG[value] : null;
            return (
              <button key={value} onClick={() => setEstadoFiltro(value)} style={{
                padding: "4px 12px", borderRadius: "20px", border: "1px solid",
                borderColor: active ? (cfg?.border ?? "#cbd5e1") : "#e2e8f0",
                background: active ? (cfg?.bg ?? "#f1f5f9") : "transparent",
                color: active ? (cfg?.color ?? "#64748b") : "#64748b",
                fontSize: "12px", fontWeight: active ? 600 : 400, cursor: "pointer",
              }}>
                {label}
              </button>
            );
          })}
        </div>

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={labelStyle}>Prioridad:</span>
          {([["", "Todas"], ["ALTA", "Alta"], ["MEDIA", "Media"], ["BAJA", "Baja"]] as const).map(([value, label]) => {
            const active = prioridadFiltro === value;
            const color = value ? PRIORIDAD_CONFIG[value].color : "#64748b";
            return (
              <button key={value} onClick={() => setPrioridadFiltro(value)} style={{
                padding: "4px 12px", borderRadius: "20px", border: "1px solid",
                borderColor: active ? color : "#e2e8f0",
                background: active ? `${color}14` : "transparent",
                color: active ? color : "#64748b",
                fontSize: "12px", fontWeight: active ? 600 : 400, cursor: "pointer",
              }}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      {/* ── Estados ───────────────────────────────────── */}
      {isLoading && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: "14px" }}>
          Cargando tareas...
        </div>
      )}
      {isError && (
        <div style={{ padding: "14px 16px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", color: "#dc2626", fontSize: "13px" }}>
          Error al cargar las tareas. Verifica tu conexión.
        </div>
      )}
      {!isLoading && !isError && tareas?.length === 0 && (
        <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8", fontSize: "14px" }}>
          No hay tareas con los filtros seleccionados.
        </div>
      )}

      {/* ── Lista de tareas ───────────────────────────── */}
      {tareas && tareas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {tareas.map(tarea => (
            <TareaCard key={tarea.id} tarea={tarea} onClick={() => onSelectTarea(tarea.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de tarea ──────────────────────────────────────────────────────────────

function TareaCard({ tarea, onClick }: { tarea: Tarea; onClick: () => void }) {
  const estado = ESTADO_CONFIG[tarea.estado];
  const prioridad = PRIORIDAD_CONFIG[tarea.prioridad];

  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        background: "white", borderRadius: "10px",
        border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "14px 16px", cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8";
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
      }}
    >
      {/* Fila superior: estado + prioridad */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{
          padding: "3px 10px", borderRadius: "12px",
          background: estado.bg, color: estado.color,
          border: `1px solid ${estado.border}`,
          fontSize: "11px", fontWeight: 700, letterSpacing: "0.03em",
        }}>
          {estado.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
          <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: prioridad.color, display: "inline-block", flexShrink: 0 }} />
          <span style={{ fontSize: "11px", color: prioridad.color, fontWeight: 600 }}>{prioridad.label}</span>
        </div>
      </div>

      {/* Tipo */}
      <p style={{ margin: "0 0 4px", fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {TIPO_LABEL[tarea.tipo]}
      </p>

      {/* Descripción */}
      <p style={{
        margin: "0 0 10px", fontSize: "14px", color: "#0f172a", fontWeight: 500,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {tarea.descripcion}
      </p>

      {/* Fila inferior: ID servicio + fecha */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "#64748b" }}>
          Servicio <strong style={{ color: "#334155" }}>#{tarea.id_servicio}</strong>
        </span>
        <span style={{ fontSize: "11px", color: "#94a3b8" }}>
          {formatFecha(tarea.fecha_creada)}
        </span>
      </div>
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatFecha(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginRight: "2px", flexShrink: 0,
};
