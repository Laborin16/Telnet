import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import { useAuth } from "../../auth/hooks/useAuth";
import { useCalendarTareas } from "../hooks/useTareas";
import type { EstadoTarea, Tarea, TipoTarea } from "../types/reportes";

// ── Constantes de layout ───────────────────────────────────────────────────────

const PX_HORA = 64;
const HORA_INICIO = 7;
const HORA_FIN = 21;
const HORAS = Array.from({ length: HORA_FIN - HORA_INICIO + 1 }, (_, i) => HORA_INICIO + i);
const SPINE_W = 68;          // ancho de la columna de horas

const DIAS = ["LUN", "MAR", "MIÉ", "JUE", "VIE", "SÁB", "DOM"];

// ── Design tokens ─────────────────────────────────────────────────────────────

const C = {
  ink900: "#0f172a", ink700: "#334155", ink500: "#64748b",
  ink400: "#94a3b8", ink300: "#cbd5e1",
  surface: "#ffffff", spine: "#f8fafc", sunken: "#f1f5f9",
  border: "#e2e8f0", borderStrong: "#cbd5e1", halfHour: "#eef2f6",
  todayTint: "#f5f8ff",
  accent: "#2563eb", accentSoft: "#dbeafe",
  nowLine: "#1e293b",
};
const R = { sm: 6, md: 10, pill: 999 };
const SH = {
  flat: "0 1px 2px rgba(15,23,42,0.06)",
  raised: "0 6px 18px rgba(15,23,42,0.12)",
  ring: "0 0 0 2px #2563eb",
};
const PANEL: React.CSSProperties = {
  background: C.surface,
  borderRadius: R.md,
  border: `1px solid ${C.border}`,
  boxShadow: SH.flat,
};

// ── Colores por técnico (ciclados por ID) ─────────────────────────────────────

const PALETA = [
  { bg: "#dbeafe", border: "#3b82f6", text: "#1d4ed8" },
  { bg: "#dcfce7", border: "#22c55e", text: "#15803d" },
  { bg: "#fae8ff", border: "#a855f7", text: "#7e22ce" },
  { bg: "#ffedd5", border: "#f97316", text: "#c2410c" },
  { bg: "#fce7f3", border: "#ec4899", text: "#9d174d" },
  { bg: "#e0f2fe", border: "#0ea5e9", text: "#0369a1" },
  { bg: "#fef9c3", border: "#eab308", text: "#a16207" },
  { bg: "#f3e8ff", border: "#8b5cf6", text: "#5b21b6" },
];

const SIN_TECNICO = { bg: "#f1f5f9", border: "#94a3b8", text: "#475569" };
const COMPLETADO = { bg: "#86efac", border: "#15803d", text: "#14532d" };

function colorTecnico(id: number | null) {
  if (id === null) return SIN_TECNICO;
  return PALETA[id % PALETA.length];
}

function colorBloque(tarea: Tarea) {
  if (tarea.estado === "COMPLETADO") return COMPLETADO;
  return colorTecnico(tarea.tecnico_id);
}

// ── Config de estado ──────────────────────────────────────────────────────────

const ESTADO_LABEL: Record<EstadoTarea, string> = {
  PENDIENTE: "Pendiente", ASIGNADO: "Asignado", EN_RUTA: "En ruta",
  EN_EJECUCION: "En ejecución", BLOQUEADO: "Bloqueado",
  COMPLETADO: "Completado", CANCELADO: "Cancelado",
};

const TIPO_LABEL: Record<TipoTarea, string> = {
  INSTALACION: "Instalación", SERVICIO: "Servicio", RECOLECCION: "Recolección",
  RECONEXION: "Reconexión", CAMBIO_DOMICILIO: "Cambio domicilio",
  TRABAJO_GENERAL: "Trabajo general", FALLA_RED: "Falla red",
  SOPORTE_TECNICO: "Soporte", MANTENIMIENTO: "Mantenimiento",
  CAMBIO_PLAN: "Cambio plan", REUBICACION: "Reubicación",
};

// ── Helpers de fecha ──────────────────────────────────────────────────────────

function getLunes(offset: number): Date {
  const hoy = new Date();
  const dia = hoy.getDay();
  const diffLunes = dia === 0 ? -6 : 1 - dia;
  const lunes = new Date(hoy);
  lunes.setDate(hoy.getDate() + diffLunes + offset * 7);
  lunes.setHours(0, 0, 0, 0);
  return lunes;
}

function getSemana(offset: number): Date[] {
  const lunes = getLunes(offset);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(lunes);
    d.setDate(lunes.getDate() + i);
    return d;
  });
}

function toISODate(d: Date): string {
  return d.toISOString().slice(0, 10);
}

function fmtSemana(semana: Date[]): string {
  const inicio = semana[0];
  const fin    = semana[6];
  const mismoMes = inicio.getMonth() === fin.getMonth();
  const meses = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"];
  if (mismoMes) {
    return `${inicio.getDate()} – ${fin.getDate()} ${meses[fin.getMonth()]} ${fin.getFullYear()}`;
  }
  return `${inicio.getDate()} ${meses[inicio.getMonth()]} – ${fin.getDate()} ${meses[fin.getMonth()]} ${fin.getFullYear()}`;
}

function esHoy(d: Date): boolean {
  const hoy = new Date();
  return d.getDate() === hoy.getDate() && d.getMonth() === hoy.getMonth() && d.getFullYear() === hoy.getFullYear();
}

// ── Algoritmo de layout para overlaps ────────────────────────────────────────

interface TareaLayout {
  tarea: Tarea;
  col: number;
  totalCols: number;
  topPx: number;
  heightPx: number;
}

function layoutDia(tareas: Tarea[]): TareaLayout[] {
  const conHorario = tareas.filter(t => t.fecha_inicio && t.fecha_fin);
  if (conHorario.length === 0) return [];

  const sorted = [...conHorario].sort((a, b) =>
    new Date(a.fecha_inicio!).getTime() - new Date(b.fecha_inicio!).getTime()
  );

  const colEnds: number[] = [];
  const items: (TareaLayout & { endMs: number })[] = [];

  for (const tarea of sorted) {
    const inicio = new Date(tarea.fecha_inicio!);
    const fin    = new Date(tarea.fecha_fin!);
    const startMs = inicio.getTime();
    const endMs   = fin.getTime();

    let col = colEnds.findIndex(e => e <= startMs);
    if (col === -1) col = colEnds.length;
    colEnds[col] = endMs;

    const startHours = inicio.getHours() + inicio.getMinutes() / 60;
    const endHours   = fin.getHours()   + fin.getMinutes()   / 60;
    const clampedStart = Math.max(HORA_INICIO, Math.min(HORA_FIN, startHours));
    const clampedEnd   = Math.max(HORA_INICIO, Math.min(HORA_FIN, endHours));

    items.push({
      tarea,
      col,
      totalCols: 1,
      endMs,
      topPx: (clampedStart - HORA_INICIO) * PX_HORA,
      heightPx: Math.max(28, (clampedEnd - clampedStart) * PX_HORA),
    });
  }

  for (const item of items) {
    const startMs = new Date(item.tarea.fecha_inicio!).getTime();
    let maxCol = 0;
    for (const other of items) {
      const oStart = new Date(other.tarea.fecha_inicio!).getTime();
      if (oStart < item.endMs && other.endMs > startMs) {
        maxCol = Math.max(maxCol, other.col);
      }
    }
    item.totalCols = maxCol + 1;
  }

  return items;
}

// ── Tipos aux ─────────────────────────────────────────────────────────────────

interface UsuarioItem { id: number; nombre: string; activo: boolean }

// ── Componente principal ──────────────────────────────────────────────────────

interface Props {
  onSelectTarea: (id: number) => void;
}

export function CalendarPage({ onSelectTarea }: Props) {
  const { user } = useAuth();
  const esAdmin = user?.es_admin || user?.rol === "administrador";

  const [weekOffset, setWeekOffset] = useState(0);
  const [tecnicoFiltro, setTecnicoFiltro] = useState<number | "">("");

  const semana   = useMemo(() => getSemana(weekOffset), [weekOffset]);
  const fechaDesde = toISODate(semana[0]);
  const fechaHasta = toISODate(semana[6]);

  const { data: tareas = [], isLoading } = useCalendarTareas(fechaDesde, fechaHasta);

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
    enabled: esAdmin,
  });

  const tecNombreMap = useMemo(() => {
    const map = new Map<number, string>();
    usuarios.forEach(u => map.set(u.id, u.nombre));
    return map;
  }, [usuarios]);

  const tareasVisibles = useMemo(
    () => tareas.filter(t => t.estado !== "PENDIENTE" && t.estado !== "CANCELADO"),
    [tareas],
  );

  const tecnicosEnSemana = useMemo(() => {
    const map = new Map<number, string>();
    tareasVisibles.forEach(t => {
      if (t.tecnico_id !== null) {
        map.set(t.tecnico_id, tecNombreMap.get(t.tecnico_id) ?? `Técnico #${t.tecnico_id}`);
      }
    });
    return Array.from(map.entries()).map(([id, nombre]) => ({ id, nombre }));
  }, [tareasVisibles, tecNombreMap]);

  const tareasFiltradas = useMemo(() => {
    if (!tecnicoFiltro) return tareasVisibles;
    return tareasVisibles.filter(t => t.tecnico_id === tecnicoFiltro);
  }, [tareasVisibles, tecnicoFiltro]);

  const tareasPorDia = useMemo(() => {
    const map = new Map<string, Tarea[]>();
    semana.forEach(d => map.set(toISODate(d), []));
    tareasFiltradas.forEach(t => {
      if (!t.fecha_inicio) return;
      const day = t.fecha_inicio.slice(0, 10);
      map.get(day)?.push(t);
    });
    return map;
  }, [tareasFiltradas, semana]);

  const layoutsPorDia = useMemo(() => {
    const result = new Map<string, TareaLayout[]>();
    tareasPorDia.forEach((ts, day) => result.set(day, layoutDia(ts)));
    return result;
  }, [tareasPorDia]);

  const hoyLinea = useMemo(() => {
    const hoy = new Date();
    const h = hoy.getHours() + hoy.getMinutes() / 60;
    if (h < HORA_INICIO || h > HORA_FIN) return null;
    return (h - HORA_INICIO) * PX_HORA;
  }, []);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "12px" }}>

      {/* ── Controles ──────────────────────────────────────────────────── */}
      <div style={{ ...PANEL, padding: "12px 16px", display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "4px" }}>
          <button onClick={() => setWeekOffset(o => o - 1)} style={navBtnStyle} aria-label="Semana anterior">‹</button>
          <button
            onClick={() => setWeekOffset(0)}
            style={{
              ...navBtnStyle,
              padding: "6px 14px",
              fontWeight: weekOffset === 0 ? 700 : 500,
              color: weekOffset === 0 ? C.accent : C.ink700,
              borderColor: weekOffset === 0 ? C.accent : C.border,
              background: weekOffset === 0 ? C.accentSoft : "white",
            }}
          >
            Hoy
          </button>
          <button onClick={() => setWeekOffset(o => o + 1)} style={navBtnStyle} aria-label="Semana siguiente">›</button>
        </div>
        <span style={{ fontSize: "15px", fontWeight: 700, color: C.ink900, flex: 1, letterSpacing: "-0.01em" }}>
          {fmtSemana(semana)}
        </span>
        {esAdmin && (
          <select
            value={tecnicoFiltro}
            onChange={e => setTecnicoFiltro(e.target.value ? Number(e.target.value) : "")}
            style={{
              padding: "7px 12px", borderRadius: R.sm, border: `1px solid ${C.border}`,
              fontSize: "12px", color: C.ink700, background: C.spine, cursor: "pointer", outline: "none",
              fontWeight: 600,
            }}
          >
            <option value="">Todos los técnicos</option>
            {tecnicosEnSemana.map(t => (
              <option key={t.id} value={t.id}>{t.nombre}</option>
            ))}
          </select>
        )}
      </div>

      {/* ── Leyenda técnicos ───────────────────────────────────────────── */}
      {esAdmin && tecnicosEnSemana.length > 0 && (
        <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
          {tecnicosEnSemana.map(t => {
            const c = colorTecnico(t.id);
            const activo = !tecnicoFiltro || tecnicoFiltro === t.id;
            return (
              <button
                key={t.id}
                onClick={() => setTecnicoFiltro(prev => prev === t.id ? "" : t.id)}
                style={{
                  display: "flex", alignItems: "center", gap: "6px",
                  padding: "4px 10px", borderRadius: "20px", border: `1.5px solid ${c.border}`,
                  background: activo ? c.bg : "white", color: c.text,
                  fontSize: "12px", fontWeight: 600, cursor: "pointer",
                  opacity: activo ? 1 : 0.45,
                }}
              >
                <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: c.border, flexShrink: 0 }} />
                {t.nombre}
              </button>
            );
          })}
          {tareasFiltradas.some(t => t.tecnico_id === null) && (
            <span style={{ display: "flex", alignItems: "center", gap: "6px", padding: "4px 10px", borderRadius: "20px", border: "1.5px solid #94a3b8", background: "#f1f5f9", color: "#475569", fontSize: "12px", fontWeight: 600 }}>
              <span style={{ width: "8px", height: "8px", borderRadius: "50%", background: "#94a3b8", flexShrink: 0 }} />
              Sin asignar
            </span>
          )}
        </div>
      )}

      {/* ── Grid del calendario ─────────────────────────────────────────── */}
      <div style={{ ...PANEL, overflow: "hidden" }}>
        {/* Cuerpo scrollable con header sticky */}
        <div style={{ overflowY: "auto", maxHeight: "72vh", position: "relative" }}>
          {/* Cabecera de días (sticky) */}
          <div style={{
            display: "grid", gridTemplateColumns: `${SPINE_W}px repeat(7, 1fr)`,
            borderBottom: `1px solid ${C.border}`,
            position: "sticky", top: 0, zIndex: 20,
            background: C.surface,
          }}>
            <div style={{ borderRight: `1px solid ${C.border}`, background: C.spine }} />
            {semana.map((d, i) => {
              const hoy = esHoy(d);
              const finDeSemana = d.getDay() === 0 || d.getDay() === 6;
              return (
                <div
                  key={i}
                  style={{
                    padding: "10px 8px 12px", textAlign: "center",
                    borderRight: i < 6 ? `1px solid ${C.border}` : undefined,
                  }}
                >
                  <div style={{
                    fontSize: "10px", fontWeight: 700, marginBottom: "6px",
                    color: hoy ? C.accent : finDeSemana ? C.ink400 : C.ink500,
                    letterSpacing: "0.08em",
                  }}>
                    {DIAS[i]}
                  </div>
                  <div style={{
                    display: "inline-flex", alignItems: "center", justifyContent: "center",
                    width: "30px", height: "30px", borderRadius: R.pill,
                    background: hoy ? C.accent : "transparent",
                    color: hoy ? "white" : finDeSemana ? C.ink400 : C.ink900,
                    fontSize: "16px", fontWeight: hoy ? 700 : 600,
                    fontVariantNumeric: "tabular-nums",
                  }}>
                    {d.getDate()}
                  </div>
                </div>
              );
            })}
          </div>

          {isLoading && (
            <div style={{ padding: "60px", textAlign: "center", color: C.ink400, fontSize: "13px" }}>
              Cargando tareas...
            </div>
          )}
          {!isLoading && (
            <div style={{ display: "grid", gridTemplateColumns: `${SPINE_W}px repeat(7, 1fr)`, position: "relative" }}>
              {/* Columna de horas */}
              <div style={{ borderRight: `1px solid ${C.border}`, background: C.spine }}>
                {HORAS.map(h => (
                  <div
                    key={h}
                    style={{
                      height: h === HORA_FIN ? "1px" : `${PX_HORA}px`,
                      display: "flex", alignItems: "flex-start", justifyContent: "flex-end",
                      paddingRight: "10px", paddingTop: "4px",
                      borderTop: `1px solid ${C.border}`,
                    }}
                  >
                    {h < HORA_FIN && (
                      <span style={{
                        fontSize: "12px", color: C.ink700, fontWeight: 700,
                        lineHeight: 1, fontVariantNumeric: "tabular-nums",
                        letterSpacing: "0.02em",
                      }}>
                        {String(h).padStart(2, "0")}
                        <span style={{ color: C.ink400, fontWeight: 500 }}>:00</span>
                      </span>
                    )}
                  </div>
                ))}
              </div>

              {/* Columnas de días */}
              {semana.map((d, dayIdx) => {
                const dayKey = toISODate(d);
                const layouts = layoutsPorDia.get(dayKey) ?? [];
                const isWeekend = d.getDay() === 0 || d.getDay() === 6;
                const hoy = esHoy(d);

                return (
                  <div
                    key={dayIdx}
                    style={{
                      borderRight: dayIdx < 6 ? `1px solid ${C.border}` : undefined,
                      position: "relative",
                      background: hoy ? C.todayTint : isWeekend ? C.spine : undefined,
                    }}
                  >
                    {/* Líneas de hora (con marca media hora punteada) */}
                    {HORAS.map(h => (
                      <div
                        key={h}
                        style={{
                          height: h === HORA_FIN ? "1px" : `${PX_HORA}px`,
                          borderTop: `1px solid ${C.border}`,
                          position: "relative",
                        }}
                      >
                        {h < HORA_FIN && (
                          <div style={{
                            position: "absolute",
                            top: `${PX_HORA / 2}px`,
                            left: 0, right: 0,
                            borderTop: `1px dashed ${C.halfHour}`,
                          }} />
                        )}
                      </div>
                    ))}

                    {/* Línea "ahora" */}
                    {hoy && hoyLinea !== null && (
                      <div style={{
                        position: "absolute", left: 0, right: 0,
                        top: `${hoyLinea}px`,
                        height: "1px", background: C.nowLine, zIndex: 10,
                      }}>
                        <div style={{
                          position: "absolute", left: "-5px", top: "-4px",
                          width: "9px", height: "9px", borderRadius: R.pill,
                          background: C.accent,
                          boxShadow: `0 0 0 3px ${C.surface}`,
                        }} />
                      </div>
                    )}

                    {/* Bloques de tareas */}
                    {layouts.map(({ tarea, col, totalCols, topPx, heightPx }) => {
                      const c = colorBloque(tarea);
                      const anchoBase = 100 / totalCols;
                      const tecNombre = tarea.tecnico_id !== null
                        ? (tecNombreMap.get(tarea.tecnico_id) ?? `#${tarea.tecnico_id}`)
                        : "Sin asignar";
                      const inicioStr = tarea.fecha_inicio ? new Date(tarea.fecha_inicio).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" }) : "";
                      const finStr   = tarea.fecha_fin    ? new Date(tarea.fecha_fin).toLocaleTimeString("es-MX",    { hour: "2-digit", minute: "2-digit" }) : "";

                      return (
                        <div
                          key={tarea.id}
                          onClick={() => onSelectTarea(tarea.id)}
                          title={`${TIPO_LABEL[tarea.tipo]} #${tarea.id}\n${tecNombre}\n${inicioStr} – ${finStr}\n${ESTADO_LABEL[tarea.estado]}`}
                          style={{
                            position: "absolute",
                            top: `${topPx + 2}px`,
                            height: `${heightPx - 4}px`,
                            left: `calc(${col * anchoBase}% + 3px)`,
                            width: `calc(${anchoBase}% - 6px)`,
                            background: c.bg,
                            borderLeft: `3px solid ${c.border}`,
                            borderRadius: R.sm,
                            padding: "4px 8px",
                            overflow: "hidden",
                            cursor: "pointer",
                            zIndex: 5,
                            transition: "box-shadow 0.12s ease, transform 0.12s ease",
                          }}
                          onMouseEnter={e => {
                            e.currentTarget.style.boxShadow = SH.raised;
                            e.currentTarget.style.zIndex = "6";
                          }}
                          onMouseLeave={e => {
                            e.currentTarget.style.boxShadow = "";
                            e.currentTarget.style.zIndex = "5";
                          }}
                        >
                          <div style={{
                            fontSize: "12px", fontWeight: 700, color: c.text,
                            lineHeight: 1.25, overflow: "hidden", whiteSpace: "nowrap",
                            textOverflow: "ellipsis", letterSpacing: "-0.005em",
                          }}>
                            {TIPO_LABEL[tarea.tipo]}
                          </div>
                          {heightPx > 42 && (
                            <div style={{
                              fontSize: "11px", color: c.text, opacity: 0.78,
                              lineHeight: 1.3, overflow: "hidden", whiteSpace: "nowrap",
                              textOverflow: "ellipsis", marginTop: "1px",
                            }}>
                              {tecNombre}
                            </div>
                          )}
                          {heightPx > 60 && (
                            <div style={{
                              fontSize: "10px", color: c.text, opacity: 0.62,
                              marginTop: "3px", fontVariantNumeric: "tabular-nums",
                              fontWeight: 600,
                            }}>
                              {inicioStr} – {finStr}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* ── Pie ─────────────────────────────────────────────────────────── */}
      {!isLoading && tareasFiltradas.length === 0 && (
        <p style={{ textAlign: "center", color: C.ink400, fontSize: "13px", padding: "24px 0", fontWeight: 500 }}>
          No hay tareas programadas para esta semana.
        </p>
      )}
      {!isLoading && tareasFiltradas.length > 0 && (
        <p style={{ fontSize: "11px", color: C.ink500, textAlign: "right", fontWeight: 500, letterSpacing: "0.01em" }}>
          {tareasFiltradas.length} tarea{tareasFiltradas.length !== 1 ? "s" : ""} programada{tareasFiltradas.length !== 1 ? "s" : ""} · clic para ver detalle
        </p>
      )}
    </div>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const navBtnStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: R.sm, border: `1px solid ${C.border}`,
  background: C.surface, color: C.ink700, fontSize: "13px",
  cursor: "pointer", fontWeight: 600, lineHeight: 1,
  transition: "background 0.12s ease, border-color 0.12s ease",
};
