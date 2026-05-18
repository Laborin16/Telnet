import { useState, useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from "recharts";
import {
  HardHat, Wrench, Package, PlugZap, Truck, ClipboardList,
  Clock, User as UserIcon, Trash2,
} from "lucide-react";
import type { ComponentType } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { useTareas } from "../hooks/useTareas";
import { useEliminarTarea } from "../hooks/useTareaActions";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import apiClient from "../../../core/api/apiClient";
import { RecoleccionTab } from "../../finanzas/components/RecoleccionTab";
import type { EstadoTarea, PrioridadTarea, Tarea, TipoTarea } from "../types/reportes";

// ── Etiquetas y colores ────────────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoTarea, string> = {
  INSTALACION:      "Instalación",
  SERVICIO:         "Servicio",
  RECOLECCION:      "Recolección",
  RECONEXION: "Reconexión",
  CAMBIO_DOMICILIO: "Cambio de domicilio",
  TRABAJO_GENERAL: "Trabajo general",
  FALLA_RED: "Falla de red",
  SOPORTE_TECNICO:  "Soporte técnico",
  MANTENIMIENTO:    "Mantenimiento",
  CAMBIO_PLAN:      "Cambio de plan",
  REUBICACION:      "Reubicación",
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

type IconType = ComponentType<{ size?: number; color?: string }>;
const TIPO_CONFIG: Record<TipoTarea, { color: string; icon: IconType }> = {
  INSTALACION:      { color: "#2563eb", icon: HardHat },
  SERVICIO:         { color: "#d97706", icon: Wrench },
  RECOLECCION:      { color: "#7c3aed", icon: Package },
  RECONEXION:       { color: "#16a34a", icon: PlugZap },
  CAMBIO_DOMICILIO: { color: "#0891b2", icon: Truck },
  TRABAJO_GENERAL:  { color: "#64748b", icon: ClipboardList },
  // Legacy
  FALLA_RED:        { color: "#94a3b8", icon: ClipboardList },
  SOPORTE_TECNICO:  { color: "#94a3b8", icon: ClipboardList },
  MANTENIMIENTO:    { color: "#94a3b8", icon: ClipboardList },
  CAMBIO_PLAN:      { color: "#94a3b8", icon: ClipboardList },
  REUBICACION:      { color: "#94a3b8", icon: ClipboardList },
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

// Tipos que se pueden crear desde el formulario "Nueva tarea"
// (INSTALACION + los 5 tipos regulares). Debe mantenerse en sync con NuevaTareaModal.tsx.
const TIPOS_FILTRABLES: TipoTarea[] = [
  "INSTALACION",
  "SERVICIO",
  "RECOLECCION",
  "RECONEXION",
  "CAMBIO_DOMICILIO",
  "TRABAJO_GENERAL",
];

// ── Componente principal ───────────────────────────────────────────────────────

interface TareasPageProps {
  onSelectTarea: (id: number) => void;
  onNuevaTarea?: () => void;
}

interface UsuarioItem { id: number; nombre: string; username: string; activo: boolean; rol: string; }

type RangoRapido = "todo" | "hoy" | "semana" | "mes" | "personalizado";

export function TareasPage({ onSelectTarea, onNuevaTarea }: TareasPageProps) {
  const { user } = useAuth();
  const puedeGestionar = user?.rol === "administrador" || user?.rol === "supervisor";
  const esAdmin = user?.rol === "administrador";
  const esVentas = user?.rol === "ventas";
  const { mutate: eliminarTareaMut } = useEliminarTarea();
  const [subTab, setSubTab]                     = useState<"lista" | "dashboard" | "recoleccion">("lista");
  const [estadoFiltro, setEstadoFiltro]         = useState<EstadoTarea | "">("");
  const [prioridadFiltro, setPrioridadFiltro]   = useState<PrioridadTarea | "">("");
  const [tecnicoFiltro, setTecnicoFiltro]       = useState<number | "">("");
  const [tipoFiltro, setTipoFiltro]             = useState<TipoTarea | "">("");
  const [busqueda, setBusqueda]                 = useState("");
  const debouncedBusqueda                       = useDebounce(busqueda, 200);

  function irALista(tecnicoId: number | "", tipo: TipoTarea | "" = "") {
    setTecnicoFiltro(tecnicoId);
    setTipoFiltro(tipo);
    setEstadoFiltro("COMPLETADO");
    setPrioridadFiltro("");
    setBusqueda("");
    setSubTab("lista");
  }

  // Filtro de fecha para el dashboard
  const [rangoRapido, setRangoRapido]   = useState<RangoRapido>("todo");
  const [dashDesde, setDashDesde]       = useState("");
  const [dashHasta, setDashHasta]       = useState("");

  // Fetch todas las tareas (sin filtro de técnico en dashboard)
  const { data: todasLasTareas, isLoading, isError } = useTareas(
    subTab === "lista" ? { tecnico_id: tecnicoFiltro || undefined } : {}
  );

  // Tareas filtradas por fecha para el dashboard
  const tareasDashboard = useMemo(() => {
    const todas = todasLasTareas ?? [];
    if (rangoRapido === "todo") return todas;

    const hoy = new Date();
    hoy.setHours(0, 0, 0, 0);

    let desde: Date | null = null;
    let hasta: Date | null = null;

    if (rangoRapido === "hoy") {
      desde = hoy;
      hasta = new Date(hoy); hasta.setHours(23, 59, 59, 999);
    } else if (rangoRapido === "semana") {
      desde = new Date(hoy);
      desde.setDate(hoy.getDate() - hoy.getDay() + (hoy.getDay() === 0 ? -6 : 1));
      hasta = new Date(desde); hasta.setDate(desde.getDate() + 6); hasta.setHours(23, 59, 59, 999);
    } else if (rangoRapido === "mes") {
      desde = new Date(hoy.getFullYear(), hoy.getMonth(), 1);
      hasta = new Date(hoy.getFullYear(), hoy.getMonth() + 1, 0, 23, 59, 59, 999);
    } else if (rangoRapido === "personalizado") {
      desde = dashDesde ? new Date(dashDesde + "T00:00:00") : null;
      hasta = dashHasta ? new Date(dashHasta + "T23:59:59") : null;
    }

    return todas.filter(t => {
      const fecha = new Date(t.fecha_creada);
      if (desde && fecha < desde) return false;
      if (hasta && fecha > hasta) return false;
      return true;
    });
  }, [todasLasTareas, rangoRapido, dashDesde, dashHasta]);

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
    enabled: puedeGestionar,
  });
  const tecnicosActivos = useMemo(() => {
    // Admin/supervisor: lista completa desde la API.
    // Tecnico: solo su propio usuario (para que el dashboard "Por técnico" muestre su fila).
    if (puedeGestionar) return usuarios.filter(u => u.activo && u.rol === "tecnico");
    if (user?.rol === "tecnico") {
      return [{
        id: user.id,
        nombre: user.nombre,
        username: user.username ?? "",
        activo: true,
        rol: "tecnico",
      } as UsuarioItem];
    }
    return [];
  }, [usuarios, puedeGestionar, user]);

  // Filtrado client-side por estado, prioridad, tipo y búsqueda
  const tareas = (todasLasTareas ?? []).filter(t => {
    if (estadoFiltro    && t.estado    !== estadoFiltro)    return false;
    if (prioridadFiltro && t.prioridad !== prioridadFiltro) return false;
    if (tipoFiltro      && t.tipo      !== tipoFiltro)      return false;
    if (debouncedBusqueda) {
      const q = debouncedBusqueda.toLowerCase();
      const matchDesc = t.descripcion.toLowerCase().includes(q);
      const matchId   = t.id_servicio != null && String(t.id_servicio).includes(q);
      if (!matchDesc && !matchId) return false;
    }
    return true;
  }).sort((a, b) => {
    // Sin horario primero, luego por fecha_inicio descendente.
    if (!a.fecha_inicio && !b.fecha_inicio) return 0;
    if (!a.fecha_inicio) return -1;
    if (!b.fecha_inicio) return 1;
    return b.fecha_inicio.localeCompare(a.fecha_inicio);
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Sub-tabs ──────────────────────────────────── */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        {!esVentas ? (
          <div style={{ display: "flex", gap: "4px", background: "white", borderRadius: "8px", border: "1px solid #e2e8f0", padding: "3px" }}>
            {(puedeGestionar
              ? (["lista", "dashboard", "recoleccion"] as const)
              : (["lista", "dashboard"] as const)
            ).map(t => (
              <button key={t} onClick={() => setSubTab(t)} style={{
                padding: "5px 16px", borderRadius: "6px", border: "none",
                background: subTab === t ? "#2563eb" : "transparent",
                color: subTab === t ? "white" : "#64748b",
                fontSize: "13px", fontWeight: subTab === t ? 600 : 400, cursor: "pointer",
              }}>
                {t === "lista" ? "Lista" : t === "dashboard" ? "Dashboard" : "Recolección"}
              </button>
            ))}
          </div>
        ) : (
          <h2 style={{ margin: 0, fontSize: "15px", fontWeight: 700, color: "#0f172a" }}>
            Instalaciones
          </h2>
        )}
        {(puedeGestionar || esVentas) && onNuevaTarea && (
          <button onClick={onNuevaTarea} style={{
            padding: "6px 16px", borderRadius: "7px", border: "none",
            background: "#2563eb", color: "white",
            fontSize: "13px", fontWeight: 600, cursor: "pointer",
          }}>
            {esVentas ? "+ Nueva instalación" : "+ Nueva tarea"}
          </button>
        )}
      </div>

      {/* ── Dashboard ─────────────────────────────────── */}
      {subTab === "dashboard" && (
        <>
          {/* Filtro de fecha */}
          <div style={{
            background: "white", borderRadius: "10px", border: "1px solid #e2e8f0",
            padding: "10px 14px", display: "flex", flexWrap: "wrap", gap: "8px", alignItems: "center",
          }}>
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.06em", marginRight: "2px" }}>
              Período:
            </span>
            {([
              { value: "todo",         label: "Todo" },
              { value: "hoy",          label: "Hoy" },
              { value: "semana",       label: "Esta semana" },
              { value: "mes",          label: "Este mes" },
              { value: "personalizado",label: "Personalizado" },
            ] as { value: RangoRapido; label: string }[]).map(({ value, label }) => (
              <button key={value} onClick={() => setRangoRapido(value)} style={{
                padding: "4px 12px", borderRadius: "20px", border: "1px solid",
                borderColor: rangoRapido === value ? "#2563eb" : "#e2e8f0",
                background: rangoRapido === value ? "#eff6ff" : "transparent",
                color: rangoRapido === value ? "#2563eb" : "#64748b",
                fontSize: "12px", fontWeight: rangoRapido === value ? 600 : 400, cursor: "pointer",
              }}>
                {label}
              </button>
            ))}
            {rangoRapido === "personalizado" && (
              <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                <input
                  type="date" value={dashDesde} onChange={e => setDashDesde(e.target.value)}
                  style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#334155", outline: "none" }}
                />
                <span style={{ fontSize: "12px", color: "#94a3b8" }}>—</span>
                <input
                  type="date" value={dashHasta} onChange={e => setDashHasta(e.target.value)}
                  min={dashDesde}
                  style={{ padding: "4px 8px", borderRadius: "6px", border: "1px solid #e2e8f0", fontSize: "12px", color: "#334155", outline: "none" }}
                />
              </div>
            )}
            {rangoRapido !== "todo" && (
              <span style={{ fontSize: "12px", color: "#94a3b8", marginLeft: "4px" }}>
                {tareasDashboard.length} tarea{tareasDashboard.length !== 1 ? "s" : ""}
              </span>
            )}
          </div>

          <TareasDashboard
            tareas={tareasDashboard}
            tecnicos={tecnicosActivos}
            isLoading={isLoading}
            onDrillDown={irALista}
          />
        </>
      )}

      {/* ── Vista lista ───────────────────────────────── */}
      {/* ── Vista recolección (solo admin/supervisor) ──────────────── */}
      {subTab === "recoleccion" && puedeGestionar && <RecoleccionTab />}

      {subTab === "lista" && <>


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
          {ESTADOS_FILTRO
            .filter(({ value }) => !(user?.rol === "tecnico" && value === "PENDIENTE"))
            .map(({ value, label }) => {
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

        {/* Filtro por tipo de tarea (solo los tipos creables desde el formulario) */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", alignItems: "center" }}>
          <span style={labelStyle}>Tipo:</span>
          <select
            value={tipoFiltro}
            onChange={e => setTipoFiltro(e.target.value as TipoTarea | "")}
            style={{
              padding: "4px 10px", borderRadius: "6px", fontSize: "12px",
              border: tipoFiltro ? "1px solid #6366f1" : "1px solid #e2e8f0",
              background: tipoFiltro ? "#eef2ff" : "#f8fafc",
              color: tipoFiltro ? "#4338ca" : "#64748b",
              cursor: "pointer", outline: "none",
            }}
          >
            <option value="">Todos los tipos</option>
            {TIPOS_FILTRABLES.map(value => (
              <option key={value} value={value}>{TIPO_LABEL[value]}</option>
            ))}
          </select>
          {tipoFiltro && (
            <button
              onClick={() => setTipoFiltro("")}
              style={{
                background: "none", border: "none", cursor: "pointer",
                fontSize: "11px", color: "#94a3b8", padding: "2px 4px",
              }}
              aria-label="Limpiar filtro de tipo"
            >
              ✕
            </button>
          )}
        </div>

        {/* Filtro por técnico (solo admins/supervisores) */}
        {puedeGestionar && tecnicosActivos.length > 0 && (
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
            <TareaCard
              key={tarea.id}
              tarea={tarea}
              busqueda={debouncedBusqueda}
              tecnicoNombre={tarea.tecnico_id != null ? (usuarios.find(u => u.id === tarea.tecnico_id)?.nombre ?? null) : null}
              onClick={() => onSelectTarea(tarea.id)}
              onEliminar={esAdmin ? () => {
                if (window.confirm(`¿Eliminar la tarea #${tarea.id}? Esta acción no se puede deshacer.`)) {
                  eliminarTareaMut(tarea.id);
                }
              } : undefined}
            />
          ))}
        </div>
      )}

      </> /* fin subTab lista */}
    </div>
  );
}

// ── Dashboard de tareas ────────────────────────────────────────────────────────

const TIPO_COLORS: Record<TipoTarea, string> = {
  INSTALACION:      "#2563eb",
  SERVICIO:         "#7c3aed",
  RECOLECCION:      "#db2777",
  RECONEXION:       "#0891b2",
  CAMBIO_DOMICILIO: "#d97706",
  TRABAJO_GENERAL:  "#64748b",
  FALLA_RED:        "#dc2626",
  SOPORTE_TECNICO:  "#16a34a",
  MANTENIMIENTO:    "#9333ea",
  CAMBIO_PLAN:      "#0d9488",
  REUBICACION:      "#ea580c",
};

function TareasDashboard({ tareas, tecnicos, isLoading, onDrillDown }: {
  tareas: Tarea[];
  tecnicos: UsuarioItem[];
  isLoading: boolean;
  onDrillDown: (tecnicoId: number | "", tipo?: TipoTarea | "") => void;
}) {
  const statsPorTecnico = useMemo(() => {
    const mapa: Record<number | "sin_asignar", { nombre: string; tipos: Partial<Record<TipoTarea, number>>; total: number }> = {
      sin_asignar: { nombre: "Sin asignar", tipos: {}, total: 0 },
    };
    tecnicos.forEach(u => { mapa[u.id] = { nombre: u.nombre, tipos: {}, total: 0 }; });
    tareas.filter(t => t.estado === "COMPLETADO").forEach(t => {
      const key = t.tecnico_id ?? "sin_asignar";
      if (!mapa[key]) return;
      mapa[key].tipos[t.tipo] = (mapa[key].tipos[t.tipo] ?? 0) + 1;
      mapa[key].total += 1;
    });
    return Object.entries(mapa)
      .map(([k, v]) => ({ key: k, ...v }))
      .filter(r => r.total > 0)
      .sort((a, b) => b.total - a.total);
  }, [tareas, tecnicos]);

  const statsPorTipo = useMemo(() => {
    const mapa: Partial<Record<TipoTarea, number>> = {};
    tareas.forEach(t => { mapa[t.tipo] = (mapa[t.tipo] ?? 0) + 1; });
    return (Object.entries(mapa) as [TipoTarea, number][])
      .map(([tipo, total]) => ({ tipo, label: TIPO_LABEL[tipo], total }))
      .sort((a, b) => b.total - a.total);
  }, [tareas]);

  if (isLoading) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: "14px" }}>
      Cargando datos...
    </div>
  );

  if (tareas.length === 0) return (
    <div style={{ textAlign: "center", padding: "60px 0", color: "#94a3b8", fontSize: "14px" }}>
      No hay tareas para mostrar.
    </div>
  );

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>

      {/* Totales rápidos */}
      <div style={{ display: "flex", flexWrap: "wrap", gap: "10px" }}>
        {(["PENDIENTE","ASIGNADO","EN_RUTA","EN_EJECUCION","BLOQUEADO","COMPLETADO"] as EstadoTarea[]).map(e => {
          const count = tareas.filter(t => t.estado === e).length;
          if (count === 0) return null;
          const cfg = ESTADO_CONFIG[e];
          return (
            <div key={e} style={{
              flex: "1 1 100px", minWidth: "100px",
              background: cfg.bg, border: `1px solid ${cfg.border}`,
              borderRadius: "10px", padding: "12px 16px",
              display: "flex", flexDirection: "column", gap: "2px",
            }}>
              <span style={{ fontSize: "22px", fontWeight: 700, color: cfg.color }}>{count}</span>
              <span style={{ fontSize: "11px", fontWeight: 600, color: cfg.color, textTransform: "uppercase", letterSpacing: "0.04em" }}>{cfg.label}</span>
            </div>
          );
        })}
      </div>

      {/* Grid: por técnico + por tipo */}
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: "16px" }}>

        {/* Tareas por técnico */}
        <div style={{ background: "white", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", padding: "16px" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            Tareas completadas por técnico
          </h3>
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {statsPorTecnico.map(({ key, nombre, tipos, total }) => {
              const tecId = key === "sin_asignar" ? "" : Number(key);
              return (
                <div key={key} style={{
                  padding: "10px 12px", borderRadius: "8px", background: "#f8fafc", border: "1px solid #e2e8f0",
                }}>
                  <button
                    onClick={() => onDrillDown(tecId)}
                    style={{
                      display: "flex", alignItems: "center", justifyContent: "space-between",
                      width: "100%", marginBottom: "8px",
                      background: "none", border: "none", cursor: "pointer", padding: 0,
                    }}
                  >
                    <span style={{ fontSize: "13px", fontWeight: 600, color: "#2563eb", textDecoration: "underline", textDecorationStyle: "dotted" }}>{nombre}</span>
                    <span style={{ fontSize: "12px", fontWeight: 700, color: "#64748b" }}>{total} total</span>
                  </button>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: "4px" }}>
                    {(Object.entries(tipos) as [TipoTarea, number][])
                      .sort((a, b) => b[1] - a[1])
                      .map(([tipo, n]) => (
                        <button
                          key={tipo}
                          onClick={() => onDrillDown(tecId, tipo)}
                          style={{
                            padding: "2px 8px", borderRadius: "10px", fontSize: "11px", fontWeight: 600,
                            background: `${TIPO_COLORS[tipo]}18`, color: TIPO_COLORS[tipo],
                            border: `1px solid ${TIPO_COLORS[tipo]}40`,
                            cursor: "pointer",
                          }}
                        >
                          {TIPO_LABEL[tipo]} · {n}
                        </button>
                      ))}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Distribución por tipo */}
        <div style={{ background: "white", borderRadius: "10px", border: "1px solid #e2e8f0", boxShadow: "0 1px 2px rgba(0,0,0,0.04)", padding: "16px" }}>
          <h3 style={{ margin: "0 0 14px", fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>
            Distribución por tipo
          </h3>
          <ResponsiveContainer width="100%" height={260}>
            <BarChart data={statsPorTipo} layout="vertical" margin={{ left: 8, right: 24, top: 0, bottom: 0 }}>
              <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} allowDecimals={false} />
              <YAxis type="category" dataKey="label" width={130} tick={{ fontSize: 11, fill: "#475569" }} />
              <Tooltip
                cursor={{ fill: "#f1f5f9" }}
                contentStyle={{ fontSize: "12px", borderRadius: "8px", border: "1px solid #e2e8f0" }}
                formatter={(v) => [v, "Tareas"]}
              />
              <Bar dataKey="total" radius={[0, 4, 4, 0]}>
                {statsPorTipo.map(({ tipo }) => (
                  <Cell key={tipo} fill={TIPO_COLORS[tipo]} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>

      </div>
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

function TareaCard({ tarea, busqueda = "", tecnicoNombre, onClick, onEliminar }: { tarea: Tarea; busqueda?: string; tecnicoNombre: string | null; onClick: () => void; onEliminar?: () => void }) {
  const estado = ESTADO_CONFIG[tarea.estado];
  const prioridad = PRIORIDAD_CONFIG[tarea.prioridad];
  const tipo = TIPO_CONFIG[tarea.tipo];
  const TipoIcon = tipo.icon;

  return (
    <button
      onClick={onClick}
      style={{
        display: "block", width: "100%", textAlign: "left",
        background: "white", borderRadius: "10px",
        border: "1px solid #e2e8f0",
        borderLeft: `4px solid ${tipo.color}`,
        boxShadow: "0 1px 2px rgba(0,0,0,0.04)",
        padding: "14px 16px", cursor: "pointer",
        transition: "box-shadow 0.15s, border-color 0.15s",
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 4px 12px rgba(0,0,0,0.08)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#94a3b8";
        (e.currentTarget as HTMLButtonElement).style.borderLeftColor = tipo.color;
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLButtonElement).style.boxShadow = "0 1px 2px rgba(0,0,0,0.04)";
        (e.currentTarget as HTMLButtonElement).style.borderColor = "#e2e8f0";
        (e.currentTarget as HTMLButtonElement).style.borderLeftColor = tipo.color;
      }}
    >
      {/* Fila superior: estado + prioridad + eliminar */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <span style={{
          padding: "3px 10px", borderRadius: "12px",
          background: estado.bg, color: estado.color,
          border: `1px solid ${estado.border}`,
          fontSize: "11px", fontWeight: 700, letterSpacing: "0.03em",
        }}>
          {estado.label}
        </span>
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
            <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: prioridad.color, display: "inline-block", flexShrink: 0 }} />
            <span style={{ fontSize: "11px", color: prioridad.color, fontWeight: 600 }}>{prioridad.label}</span>
          </div>
          {onEliminar && (
            <span
              role="button"
              tabIndex={0}
              onClick={e => { e.stopPropagation(); onEliminar(); }}
              onKeyDown={e => { if (e.key === "Enter" || e.key === " ") { e.preventDefault(); e.stopPropagation(); onEliminar(); } }}
              title="Eliminar tarea"
              style={{ display: "inline-flex", alignItems: "center", padding: "3px", borderRadius: "5px", color: "#94a3b8", cursor: "pointer" }}
              onMouseEnter={e => { (e.currentTarget as HTMLSpanElement).style.color = "#dc2626"; (e.currentTarget as HTMLSpanElement).style.background = "#fef2f2"; }}
              onMouseLeave={e => { (e.currentTarget as HTMLSpanElement).style.color = "#94a3b8"; (e.currentTarget as HTMLSpanElement).style.background = "transparent"; }}
            >
              <Trash2 size={14} />
            </span>
          )}
        </div>
      </div>

      {/* Tipo con icono */}
      <div style={{ display: "flex", alignItems: "center", gap: "6px", margin: "0 0 4px" }}>
        <TipoIcon size={13} color={tipo.color} />
        <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: tipo.color, textTransform: "uppercase", letterSpacing: "0.05em" }}>
          {TIPO_LABEL[tarea.tipo]}
        </p>
      </div>

      {/* Descripción */}
      <p style={{
        margin: "0 0 10px", fontSize: "14px", color: "#0f172a", fontWeight: 500,
        overflow: "hidden", display: "-webkit-box",
        WebkitLineClamp: 2, WebkitBoxOrient: "vertical",
      }}>
        {resaltarTexto(tarea.descripcion, busqueda)}
      </p>

      {/* Footer: horario programado y, debajo, técnico asignado */}
      <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: tarea.fecha_inicio ? "#334155" : "#94a3b8" }}>
          <Clock size={12} color={tarea.fecha_inicio ? "#64748b" : "#cbd5e1"} />
          {tarea.fecha_inicio
            ? formatHorario(tarea.fecha_inicio, tarea.fecha_fin)
            : <span style={{ fontStyle: "italic" }}>Sin horario</span>}
        </span>
        <span style={{ display: "flex", alignItems: "center", gap: "5px", fontSize: "12px", color: tecnicoNombre ? "#334155" : "#94a3b8" }}>
          <UserIcon size={12} color={tecnicoNombre ? "#64748b" : "#cbd5e1"} />
          {tecnicoNombre ?? <span style={{ fontStyle: "italic" }}>Sin asignar</span>}
        </span>
      </div>
    </button>
  );
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function formatHorario(inicioIso: string, finIso: string | null): string {
  const ini = new Date(inicioIso);
  const dia = ini.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
  const hi = ini.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
  if (!finIso) return `${dia}, ${hi}`;
  const fin = new Date(finIso);
  const hf = fin.toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit", hour12: false });
  return `${dia}, ${hi}–${hf}`;
}

const labelStyle: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: "#475569",
  textTransform: "uppercase", letterSpacing: "0.06em",
  marginRight: "2px", flexShrink: 0,
};
