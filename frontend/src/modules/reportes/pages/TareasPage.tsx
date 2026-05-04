import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { useTareas } from "../hooks/useTareas";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import { calcularSLA, fmtHoras } from "../utils/sla";
import apiClient from "../../../core/api/apiClient";
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

interface UsuarioItem { id: number; nombre: string; username: string; activo: boolean; }

export function TareasPage({ onSelectTarea, onNuevaTarea }: TareasPageProps) {
  const { user } = useAuth();
  const [estadoFiltro, setEstadoFiltro]         = useState<EstadoTarea | "">("");
  const [prioridadFiltro, setPrioridadFiltro]   = useState<PrioridadTarea | "">("");
  const [soloVencidas, setSoloVencidas]         = useState(false);
  const [tecnicoFiltro, setTecnicoFiltro]       = useState<number | "">("");
  const [busqueda, setBusqueda]                 = useState("");
  const debouncedBusqueda                       = useDebounce(busqueda, 200);

  // Fetch con solo filtro de técnico → base para stats y lista
  const { data: todasLasTareas, isLoading, isError } = useTareas({
    tecnico_id: tecnicoFiltro || undefined,
  });

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
    enabled: !!user?.es_admin,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo);

  // Filtrado client-side por estado, prioridad, SLA y búsqueda
  const tareas = (todasLasTareas ?? []).filter(t => {
    if (estadoFiltro    && t.estado    !== estadoFiltro)    return false;
    if (prioridadFiltro && t.prioridad !== prioridadFiltro) return false;
    if (soloVencidas && !calcularSLA(t.tipo, t.estado, t.fecha_creada).vencida) return false;
    if (debouncedBusqueda) {
      const q = debouncedBusqueda.toLowerCase();
      const matchDesc = t.descripcion.toLowerCase().includes(q);
      const matchId   = String(t.id_servicio).includes(q);
      if (!matchDesc && !matchId) return false;
    }
    return true;
  });

  // Conteos para stats bar (sin filtros de estado/prioridad/vencidas)
  const conteos = (todasLasTareas ?? []).reduce<Record<string, number>>((acc, t) => {
    acc[t.estado] = (acc[t.estado] ?? 0) + 1;
    return acc;
  }, {});

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Stats bar ─────────────────────────────────── */}
      {!isLoading && !isError && todasLasTareas && todasLasTareas.length > 0 && (
        <div style={{
          display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center",
          background: "white", borderRadius: "10px",
          border: "1px solid #e2e8f0", padding: "10px 14px",
          boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        }}>
          {(["PENDIENTE","ASIGNADO","EN_RUTA","EN_EJECUCION","BLOQUEADO","COMPLETADO","CANCELADO"] as EstadoTarea[])
            .filter(e => conteos[e] > 0)
            .map(e => {
              const cfg = ESTADO_CONFIG[e];
              const active = estadoFiltro === e;
              return (
                <button
                  key={e}
                  onClick={() => setEstadoFiltro(active ? "" : e)}
                  style={{
                    display: "flex", alignItems: "center", gap: "5px",
                    padding: "3px 10px", borderRadius: "20px", fontSize: "12px",
                    fontWeight: active ? 700 : 500, cursor: "pointer",
                    border: `1px solid ${active ? cfg.border : "#e2e8f0"}`,
                    color: active ? cfg.color : "#475569",
                    background: active ? cfg.bg : "transparent",
                  }}
                >
                  <span style={{ width: "7px", height: "7px", borderRadius: "50%", background: cfg.color, flexShrink: 0 }} />
                  {cfg.label}
                  <span style={{
                    fontSize: "11px", fontWeight: 700,
                    color: active ? cfg.color : "#94a3b8",
                  }}>
                    {conteos[e]}
                  </span>
                </button>
              );
            })}
          <div style={{ flex: 1 }} />
          {user?.es_admin && onNuevaTarea && (
            <button onClick={onNuevaTarea} style={{
              padding: "5px 14px", borderRadius: "7px", border: "none",
              background: "#2563eb", color: "white",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}>
              + Nueva tarea
            </button>
          )}
        </div>
      )}

      {/* Sin stats: barra simple ──────────────────────── */}
      {(isLoading || isError || !todasLasTareas || todasLasTareas.length === 0) && (
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: "10px" }}>
          <p style={{ margin: 0, fontSize: "13px", color: "#64748b" }}>
            {isLoading ? "Cargando..." : isError ? "Error al cargar" : "Sin tareas"}
          </p>
          {user?.es_admin && onNuevaTarea && (
            <button onClick={onNuevaTarea} style={{
              padding: "8px 16px", borderRadius: "7px", border: "none",
              background: "#2563eb", color: "white",
              fontSize: "13px", fontWeight: 600, cursor: "pointer",
            }}>
              + Nueva tarea
            </button>
          )}
        </div>
      )}

      {/* ── Filtros ───────────────────────────────────── */}
      <div style={{
        background: "white", borderRadius: "10px",
        border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "12px 14px", display: "flex", flexDirection: "column", gap: "10px",
      }}>
        {/* Búsqueda */}
        <div style={{ position: "relative" }}>
          <span style={{
            position: "absolute", left: "10px", top: "50%", transform: "translateY(-50%)",
            fontSize: "13px", color: "#94a3b8", pointerEvents: "none",
          }}>
            🔍
          </span>
          <input
            type="text"
            placeholder="Buscar por descripción o ID de servicio..."
            value={busqueda}
            onChange={e => setBusqueda(e.target.value)}
            style={{
              width: "100%", boxSizing: "border-box",
              padding: "7px 32px 7px 30px", borderRadius: "7px",
              border: busqueda ? "1px solid #6366f1" : "1px solid #e2e8f0",
              fontSize: "13px", color: "#1e293b", background: "#f8fafc", outline: "none",
            }}
          />
          {busqueda && (
            <button
              onClick={() => setBusqueda("")}
              style={{
                position: "absolute", right: "8px", top: "50%", transform: "translateY(-50%)",
                background: "none", border: "none", cursor: "pointer",
                fontSize: "13px", color: "#94a3b8", lineHeight: 1, padding: "2px",
              }}
            >
              ✕
            </button>
          )}
        </div>

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
          <button
            onClick={() => setSoloVencidas(v => !v)}
            style={{
              padding: "4px 12px", borderRadius: "20px", border: "1px solid",
              borderColor: soloVencidas ? "#dc2626" : "#e2e8f0",
              background: soloVencidas ? "#fef2f2" : "transparent",
              color: soloVencidas ? "#dc2626" : "#64748b",
              fontSize: "12px", fontWeight: soloVencidas ? 600 : 400, cursor: "pointer",
            }}
          >
            ⚠ Vencidas
          </button>
        </div>

        {/* Filtro por técnico (solo admins) */}
        {user?.es_admin && tecnicosActivos.length > 0 && (
          <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
            <span style={labelStyle}>Técnico:</span>
            <select
              value={tecnicoFiltro}
              onChange={e => setTecnicoFiltro(e.target.value === "" ? "" : Number(e.target.value))}
              style={{
                padding: "4px 10px", borderRadius: "6px", fontSize: "12px",
                border: tecnicoFiltro ? "1px solid #6366f1" : "1px solid #e2e8f0",
                background: tecnicoFiltro ? "#eef2ff" : "#f8fafc",
                color: tecnicoFiltro ? "#4338ca" : "#64748b",
                cursor: "pointer", outline: "none",
              }}
            >
              <option value="">Todos los técnicos</option>
              <option value="-1">Sin asignar</option>
              {tecnicosActivos.map(u => (
                <option key={u.id} value={u.id}>{u.nombre}</option>
              ))}
            </select>
          </div>
        )}
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
          {debouncedBusqueda
            ? `Sin resultados para "${debouncedBusqueda}".`
            : "No hay tareas con los filtros seleccionados."}
        </div>
      )}

      {/* ── Lista de tareas ───────────────────────────── */}
      {tareas && tareas.length > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
          {tareas.map(tarea => (
            <TareaCard key={tarea.id} tarea={tarea} busqueda={debouncedBusqueda} onClick={() => onSelectTarea(tarea.id)} />
          ))}
        </div>
      )}
    </div>
  );
}

// ── Card de tarea ──────────────────────────────────────────────────────────────

function resaltarTexto(texto: string, busqueda: string): React.ReactNode {
  if (!busqueda) return texto;
  const idx = texto.toLowerCase().indexOf(busqueda.toLowerCase());
  if (idx === -1) return texto;
  return (
    <>
      {texto.slice(0, idx)}
      <mark style={{ background: "#fef08a", color: "#0f172a", borderRadius: "2px" }}>
        {texto.slice(idx, idx + busqueda.length)}
      </mark>
      {texto.slice(idx + busqueda.length)}
    </>
  );
}

function TareaCard({ tarea, busqueda = "", onClick }: { tarea: Tarea; busqueda?: string; onClick: () => void }) {
  const estado = ESTADO_CONFIG[tarea.estado];
  const prioridad = PRIORIDAD_CONFIG[tarea.prioridad];
  const sla = calcularSLA(tarea.tipo, tarea.estado, tarea.fecha_creada);

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
        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
          {sla.vencida && (
            <span style={{
              fontSize: "11px", fontWeight: 700, padding: "2px 7px", borderRadius: "10px",
              background: "#fef2f2", color: "#dc2626", border: "1px solid #fca5a5",
            }}>
              ⚠ +{fmtHoras(-sla.horasRestantes)}
            </span>
          )}
          {sla.enRiesgo && (
            <span style={{
              fontSize: "11px", fontWeight: 600, padding: "2px 7px", borderRadius: "10px",
              background: "#fffbeb", color: "#d97706", border: "1px solid #fcd34d",
            }}>
              ⏱ {fmtHoras(sla.horasRestantes)}
            </span>
          )}
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: prioridad.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: prioridad.color, fontWeight: 600 }}>{prioridad.label}</span>
          </div>
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
        {resaltarTexto(tarea.descripcion, busqueda)}
      </p>

      {/* Fila inferior: ID servicio + fecha */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <span style={{ fontSize: "12px", color: "#64748b" }}>
          Servicio <strong style={{ color: "#334155" }}>
            {resaltarTexto(`#${tarea.id_servicio}`, busqueda)}
          </strong>
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
