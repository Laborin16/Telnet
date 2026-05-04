import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { useTarea, useTareaTransiciones, useTareaEventos, useTareaFotos } from "../hooks/useTareas";
import { useTransicionarEstado, useSubirFoto, useActualizarTarea, useAsignarTecnico } from "../hooks/useTareaActions";
import { useGeolocation } from "../hooks/useGeolocation";
import { calcularSLA, fmtHoras, SLA_HORAS } from "../utils/sla";
import apiClient from "../../../core/api/apiClient";
import type { EstadoTarea, TipoTarea, PrioridadTarea } from "../types/reportes";

interface UsuarioItem { id: number; nombre: string; username: string; activo: boolean; }

// ── Configuración de display ───────────────────────────────────────────────────

const TIPO_LABEL: Record<TipoTarea, string> = {
  INSTALACION:     "Instalación",
  RECOLECCION:     "Recolección",
  FALLA_RED:       "Falla de red",
  SOPORTE_TECNICO: "Soporte técnico",
  MANTENIMIENTO:   "Mantenimiento",
  CAMBIO_PLAN:     "Cambio de plan",
  REUBICACION:     "Reubicación",
};

const ESTADO_CONFIG: Record<EstadoTarea, { label: string; color: string; bg: string; border: string }> = {
  PENDIENTE:    { label: "Pendiente",    color: "#64748b", bg: "#f1f5f9", border: "#cbd5e1" },
  ASIGNADO:     { label: "Asignado",     color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  EN_RUTA:      { label: "En ruta",      color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
  EN_EJECUCION: { label: "En ejecución", color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  BLOQUEADO:    { label: "Bloqueado",    color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  COMPLETADO:   { label: "Completado",   color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  CANCELADO:    { label: "Cancelado",    color: "#94a3b8", bg: "#f8fafc", border: "#e2e8f0" },
};

const ESTADO_BOTON: Record<EstadoTarea, string> = {
  PENDIENTE:    "Volver a pendiente",
  ASIGNADO:     "Asignar",
  EN_RUTA:      "En ruta",
  EN_EJECUCION: "Iniciar ejecución",
  BLOQUEADO:    "Bloquear",
  COMPLETADO:   "Completar",
  CANCELADO:    "Cancelar",
};

const PRIORIDAD_COLOR: Record<PrioridadTarea, string> = {
  ALTA:  "#dc2626",
  MEDIA: "#d97706",
  BAJA:  "#16a34a",
};

// ── Helpers ────────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtDateShort(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("es-MX", {
    day: "2-digit", month: "2-digit",
    hour: "2-digit", minute: "2-digit",
  });
}

// ── Componente ─────────────────────────────────────────────────────────────────

interface Props {
  tareaId: number;
  onClose: () => void;
}

export function TareaDetailModal({ tareaId, onClose }: Props) {
  const { user } = useAuth();
  const { data: tarea, isLoading } = useTarea(tareaId);
  const { data: transiciones = [] } = useTareaTransiciones(tareaId);
  const { data: eventos = [] } = useTareaEventos(tareaId);
  const { mutate: transicionar, isPending } = useTransicionarEstado(tareaId);
  const { mutate: subir, isPending: subiendoFoto } = useSubirFoto(tareaId);
  const { mutate: actualizar, isPending: actualizando } = useActualizarTarea(tareaId);
  const { mutate: asignar, isPending: asignando } = useAsignarTecnico(tareaId);
  const { data: fotos = [] } = useTareaFotos(tareaId);
  const geo = useGeolocation();

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
    enabled: !!user?.es_admin,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo);

  const apiBase = (import.meta.env.VITE_API_URL as string) ?? "";

  // Estado de transición
  const [estadoPendiente, setEstadoPendiente] = useState<EstadoTarea | null>(null);
  const [comentario, setComentario] = useState("");
  const [errorComentario, setErrorComentario] = useState(false);

  // Estado de edición
  const [modoEdicion, setModoEdicion] = useState(false);
  const [editDesc, setEditDesc]       = useState("");
  const [editPrio, setEditPrio]       = useState<PrioridadTarea>("MEDIA");

  // Estado de reasignación
  const [modoAsignar, setModoAsignar]     = useState(false);
  const [nuevoTecnico, setNuevoTecnico]   = useState<string>("");

  function abrirEdicion() {
    if (!tarea) return;
    setEditDesc(tarea.descripcion);
    setEditPrio(tarea.prioridad as PrioridadTarea);
    setModoEdicion(true);
  }

  function guardarEdicion() {
    actualizar(
      { descripcion: editDesc.trim() || undefined, prioridad: editPrio },
      { onSuccess: () => setModoEdicion(false) }
    );
  }

  function confirmarAsignacion() {
    if (!nuevoTecnico) return;
    asignar(
      { tecnico_id: parseInt(nuevoTecnico, 10) },
      { onSuccess: () => { setModoAsignar(false); setNuevoTecnico(""); } }
    );
  }

  function seleccionarTransicion(estado: EstadoTarea) {
    if (estadoPendiente === estado) {
      setEstadoPendiente(null);
      setComentario("");
      setErrorComentario(false);
      geo.clear();
    } else {
      setEstadoPendiente(estado);
      setComentario("");
      setErrorComentario(false);
      geo.clear();
    }
  }

  function confirmarTransicion() {
    if (!estadoPendiente) return;
    if (estadoPendiente === "BLOQUEADO" && !comentario.trim()) {
      setErrorComentario(true);
      return;
    }
    transicionar(
      {
        estado_nuevo: estadoPendiente,
        comentario:   comentario.trim() || null,
        lat_evento:   geo.lat,
        lng_evento:   geo.lng,
      },
      {
        onSuccess: () => {
          setEstadoPendiente(null);
          setComentario("");
          setErrorComentario(false);
          geo.clear();
        },
      }
    );
  }

  const estadoActual = tarea ? ESTADO_CONFIG[tarea.estado] : null;

  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed", inset: 0, zIndex: 800,
        background: "rgba(0,0,0,0.5)",
        display: "flex", alignItems: "flex-start", justifyContent: "center",
        padding: "32px 16px", overflowY: "auto",
      }}
    >
      <div
        onClick={e => e.stopPropagation()}
        style={{
          background: "white", borderRadius: "14px", width: "100%", maxWidth: "880px",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
          display: "flex", flexDirection: "column",
        }}
      >
        {/* ── Cabecera ────────────────────────────────────────────── */}
        <div style={{
          display: "flex", alignItems: "center", gap: "12px",
          padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
        }}>
          <div style={{ flex: 1, display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
            <span style={{ fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Tarea #{tareaId}
            </span>
            {tarea && (
              <>
                <span style={{ fontSize: "13px", color: "#64748b" }}>·</span>
                <span style={{ fontSize: "13px", color: "#334155" }}>{TIPO_LABEL[tarea.tipo]}</span>
                <span style={{
                  display: "inline-flex", alignItems: "center", gap: "4px",
                  fontSize: "11px", fontWeight: 600, padding: "2px 8px",
                  borderRadius: "20px",
                  color: PRIORIDAD_COLOR[tarea.prioridad],
                  background: `${PRIORIDAD_COLOR[tarea.prioridad]}18`,
                  border: `1px solid ${PRIORIDAD_COLOR[tarea.prioridad]}40`,
                }}>
                  <span style={{
                    width: "6px", height: "6px", borderRadius: "50%",
                    background: PRIORIDAD_COLOR[tarea.prioridad], flexShrink: 0,
                  }} />
                  {tarea.prioridad}
                </span>
              </>
            )}
          </div>
          {estadoActual && (
            <span style={{
              fontSize: "12px", fontWeight: 600, padding: "4px 12px",
              borderRadius: "20px", border: `1px solid ${estadoActual.border}`,
              color: estadoActual.color, background: estadoActual.bg,
            }}>
              {estadoActual.label}
            </span>
          )}
          {user?.es_admin && tarea && !modoEdicion && (
            <button
              onClick={abrirEdicion}
              style={{
                padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                border: "1px solid #e2e8f0", background: "white",
                color: "#475569", cursor: "pointer", fontWeight: 500, flexShrink: 0,
              }}
            >
              Editar
            </button>
          )}
          <button
            onClick={onClose}
            style={{
              background: "none", border: "none", cursor: "pointer",
              fontSize: "18px", color: "#94a3b8", padding: "4px", lineHeight: 1,
              flexShrink: 0,
            }}
          >
            ✕
          </button>
        </div>

        {/* ── Cuerpo ──────────────────────────────────────────────── */}
        {isLoading ? (
          <div style={{ padding: "40px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
            Cargando...
          </div>
        ) : tarea ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 0 }}>

            {/* Panel izquierdo: detalles + transiciones */}
            <div style={{
              flex: "1 1 340px", padding: "22px 24px",
              borderRight: "1px solid #f1f5f9",
              display: "flex", flexDirection: "column", gap: "20px",
            }}>

              {/* Descripción */}
              <section>
                <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Descripción
                </p>
                {modoEdicion ? (
                  <>
                    <textarea
                      value={editDesc}
                      onChange={e => setEditDesc(e.target.value)}
                      rows={4}
                      style={{
                        width: "100%", boxSizing: "border-box", padding: "8px 10px",
                        borderRadius: "7px", border: "1px solid #6366f1",
                        fontSize: "13px", color: "#1e293b", lineHeight: 1.5,
                        background: "white", outline: "none", resize: "vertical",
                      }}
                    />
                    <p style={{ margin: "8px 0 6px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      Prioridad
                    </p>
                    <div style={{ display: "flex", gap: "6px" }}>
                      {(["ALTA", "MEDIA", "BAJA"] as PrioridadTarea[]).map(p => {
                        const colors: Record<PrioridadTarea, string> = { ALTA: "#dc2626", MEDIA: "#d97706", BAJA: "#16a34a" };
                        const labels: Record<PrioridadTarea, string> = { ALTA: "Alta", MEDIA: "Media", BAJA: "Baja" };
                        const active = editPrio === p;
                        return (
                          <button key={p} type="button" onClick={() => setEditPrio(p)} style={{
                            flex: 1, padding: "5px 0", borderRadius: "6px", fontSize: "12px",
                            fontWeight: 600, cursor: "pointer",
                            border: `1.5px solid ${active ? colors[p] : "#e2e8f0"}`,
                            color: active ? "white" : colors[p],
                            background: active ? colors[p] : `${colors[p]}12`,
                          }}>
                            {labels[p]}
                          </button>
                        );
                      })}
                    </div>
                    <div style={{ display: "flex", gap: "6px", marginTop: "10px" }}>
                      <button onClick={() => setModoEdicion(false)} disabled={actualizando} style={{
                        flex: 1, padding: "6px", borderRadius: "6px", fontSize: "12px",
                        border: "1px solid #e2e8f0", background: "white",
                        color: "#64748b", cursor: "pointer",
                      }}>
                        Cancelar
                      </button>
                      <button onClick={guardarEdicion} disabled={actualizando || !editDesc.trim()} style={{
                        flex: 2, padding: "6px", borderRadius: "6px", fontSize: "12px",
                        fontWeight: 700, border: "none",
                        background: actualizando ? "#cbd5e1" : "#2563eb",
                        color: "white", cursor: actualizando ? "not-allowed" : "pointer",
                      }}>
                        {actualizando ? "Guardando..." : "Guardar cambios"}
                      </button>
                    </div>
                  </>
                ) : (
                  <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
                    {tarea.descripcion}
                  </p>
                )}
              </section>

              {/* Detalles */}
              <section>
                <p style={{ margin: "0 0 8px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Detalles
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  {[
                    { label: "Cliente (servicio)", value: `#${tarea.id_servicio}` },
                    { label: "Creada",     value: fmtDate(tarea.fecha_creada) },
                    { label: "Asignada",   value: fmtDate(tarea.fecha_asignada) },
                    { label: "Iniciada",   value: fmtDate(tarea.fecha_iniciada) },
                    { label: "Completada", value: fmtDate(tarea.fecha_completada) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>{label}</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{value}</p>
                    </div>
                  ))}

                  {/* Fila técnico con reasignación */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p style={{ margin: "0 0 4px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Técnico asignado</p>
                    {modoAsignar ? (
                      <div style={{ display: "flex", gap: "6px", alignItems: "center", flexWrap: "wrap" }}>
                        <select
                          value={nuevoTecnico}
                          onChange={e => setNuevoTecnico(e.target.value)}
                          style={{
                            flex: 1, padding: "5px 8px", borderRadius: "6px", fontSize: "12px",
                            border: "1px solid #6366f1", background: "#f8fafc",
                            color: "#1e293b", outline: "none", cursor: "pointer",
                          }}
                        >
                          <option value="">Seleccionar técnico...</option>
                          {tecnicosActivos.map(u => (
                            <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>
                          ))}
                        </select>
                        <button onClick={confirmarAsignacion} disabled={!nuevoTecnico || asignando} style={{
                          padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                          fontWeight: 700, border: "none",
                          background: !nuevoTecnico || asignando ? "#cbd5e1" : "#2563eb",
                          color: "white", cursor: !nuevoTecnico || asignando ? "not-allowed" : "pointer",
                        }}>
                          {asignando ? "..." : "Asignar"}
                        </button>
                        <button onClick={() => { setModoAsignar(false); setNuevoTecnico(""); }} style={{
                          padding: "5px 10px", borderRadius: "6px", fontSize: "12px",
                          border: "1px solid #e2e8f0", background: "white",
                          color: "#64748b", cursor: "pointer",
                        }}>
                          Cancelar
                        </button>
                      </div>
                    ) : (
                      <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                        <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>
                          {tarea.tecnico_id
                            ? (usuarios.find(u => u.id === tarea.tecnico_id)?.nombre ?? `#${tarea.tecnico_id}`)
                            : "Sin asignar"}
                        </p>
                        {user?.es_admin && (
                          <button onClick={() => setModoAsignar(true)} style={{
                            padding: "2px 8px", borderRadius: "5px", fontSize: "11px",
                            border: "1px solid #e2e8f0", background: "transparent",
                            color: "#64748b", cursor: "pointer",
                          }}>
                            Cambiar
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                  {/* Fila de ubicación (ocupa las 2 columnas) */}
                  <div style={{ gridColumn: "1 / -1" }}>
                    <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Ubicación</p>
                    {tarea.latitud && tarea.longitud ? (
                      <a
                        href={`https://www.google.com/maps?q=${tarea.latitud},${tarea.longitud}`}
                        target="_blank" rel="noreferrer"
                        style={{ fontSize: "13px", color: "#2563eb", fontWeight: 500 }}
                      >
                        📍 {tarea.latitud.toFixed(5)}, {tarea.longitud.toFixed(5)}
                      </a>
                    ) : (
                      <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>—</p>
                    )}
                  </div>
                </div>
              </section>

              {/* SLA */}
              {(() => {
                const sla = calcularSLA(tarea.tipo, tarea.estado, tarea.fecha_creada);
                const barColor = sla.vencida ? "#dc2626" : sla.enRiesgo ? "#d97706" : "#16a34a";
                const barPct = Math.min((sla.horasTranscurridas / sla.horasLimit) * 100, 100);
                return (
                  <section>
                    <p style={{ margin: "0 0 8px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                      SLA — {SLA_HORAS[tarea.tipo]}h límite
                    </p>
                    {sla.aplica ? (
                      <>
                        <div style={{ height: "6px", borderRadius: "3px", background: "#e2e8f0", overflow: "hidden", marginBottom: "6px" }}>
                          <div style={{ height: "100%", width: `${barPct}%`, background: barColor, borderRadius: "3px", transition: "width 0.3s" }} />
                        </div>
                        <p style={{ margin: 0, fontSize: "12px", fontWeight: 600, color: barColor }}>
                          {sla.vencida
                            ? `Vencida hace ${fmtHoras(-sla.horasRestantes)}`
                            : sla.enRiesgo
                              ? `En riesgo — ${fmtHoras(sla.horasRestantes)} restantes`
                              : `OK — ${fmtHoras(sla.horasRestantes)} restantes`}
                        </p>
                      </>
                    ) : (
                      <p style={{ margin: 0, fontSize: "12px", color: "#94a3b8" }}>
                        Tarea finalizada — SLA no aplica.
                      </p>
                    )}
                  </section>
                );
              })()}

              {/* Transiciones */}
              {transiciones.length > 0 && (
                <section>
                  <p style={{ margin: "0 0 8px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Cambiar estado
                  </p>
                  <div style={{ display: "flex", gap: "6px", flexWrap: "wrap" }}>
                    {transiciones.map((est) => {
                      const cfg = ESTADO_CONFIG[est as EstadoTarea];
                      const seleccionado = estadoPendiente === est;
                      return (
                        <button
                          key={est}
                          onClick={() => seleccionarTransicion(est as EstadoTarea)}
                          disabled={isPending}
                          style={{
                            padding: "6px 14px", borderRadius: "8px", fontSize: "12px",
                            fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer",
                            border: `1.5px solid ${cfg.border}`,
                            color: seleccionado ? "white" : cfg.color,
                            background: seleccionado ? cfg.color : cfg.bg,
                            transition: "all 0.15s",
                          }}
                        >
                          {ESTADO_BOTON[est as EstadoTarea]}
                        </button>
                      );
                    })}
                  </div>

                  {/* Panel de confirmación */}
                  {estadoPendiente && (
                    <div style={{
                      marginTop: "12px", padding: "14px", borderRadius: "10px",
                      background: "#f8fafc", border: "1px solid #e2e8f0",
                    }}>
                      <p style={{ margin: "0 0 8px", fontSize: "12px", color: "#475569" }}>
                        {estadoPendiente === "BLOQUEADO"
                          ? "Comentario obligatorio — describe el motivo del bloqueo:"
                          : "Comentario opcional:"}
                      </p>
                      <textarea
                        value={comentario}
                        onChange={e => { setComentario(e.target.value); setErrorComentario(false); }}
                        placeholder={estadoPendiente === "BLOQUEADO" ? "Motivo del bloqueo..." : "Agregar comentario..."}
                        rows={3}
                        style={{
                          width: "100%", boxSizing: "border-box",
                          padding: "8px 10px", borderRadius: "7px", resize: "vertical",
                          fontSize: "13px", color: "#1e293b", lineHeight: 1.5,
                          border: `1px solid ${errorComentario ? "#dc2626" : "#e2e8f0"}`,
                          background: "white", outline: "none",
                        }}
                      />
                      {errorComentario && (
                        <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#dc2626" }}>
                          El comentario es obligatorio para bloquear una tarea.
                        </p>
                      )}

                      {/* Captura de ubicación en la transición */}
                      <div style={{ marginTop: "10px" }}>
                        {geo.lat && geo.lng ? (
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <a
                              href={`https://www.google.com/maps?q=${geo.lat},${geo.lng}`}
                              target="_blank" rel="noreferrer"
                              style={{ fontSize: "12px", color: "#16a34a", fontWeight: 600 }}
                            >
                              📍 {geo.lat.toFixed(5)}, {geo.lng.toFixed(5)}
                            </a>
                            <button
                              type="button" onClick={geo.clear}
                              style={{ background: "none", border: "none", cursor: "pointer", fontSize: "11px", color: "#94a3b8" }}
                            >
                              ✕
                            </button>
                          </div>
                        ) : (
                          <button
                            type="button"
                            onClick={geo.capture}
                            disabled={geo.loading}
                            style={{
                              padding: "5px 12px", borderRadius: "6px", fontSize: "12px",
                              border: "1px dashed #cbd5e1", background: "#f8fafc",
                              color: geo.loading ? "#94a3b8" : "#475569",
                              cursor: geo.loading ? "not-allowed" : "pointer",
                            }}
                          >
                            {geo.loading ? "Obteniendo ubicación..." : "📍 Registrar mi ubicación"}
                          </button>
                        )}
                        {geo.error && (
                          <p style={{ margin: "4px 0 0", fontSize: "11px", color: "#dc2626" }}>{geo.error}</p>
                        )}
                      </div>

                      <div style={{ display: "flex", gap: "8px", marginTop: "10px", justifyContent: "flex-end" }}>
                        <button
                          onClick={() => { setEstadoPendiente(null); setComentario(""); setErrorComentario(false); }}
                          disabled={isPending}
                          style={{
                            padding: "6px 14px", borderRadius: "7px", fontSize: "12px",
                            border: "1px solid #e2e8f0", background: "white",
                            color: "#64748b", cursor: "pointer", fontWeight: 500,
                          }}
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={confirmarTransicion}
                          disabled={isPending}
                          style={{
                            padding: "6px 16px", borderRadius: "7px", fontSize: "12px",
                            fontWeight: 600, cursor: isPending ? "not-allowed" : "pointer",
                            border: "none",
                            background: isPending ? "#cbd5e1" : ESTADO_CONFIG[estadoPendiente].color,
                            color: "white",
                          }}
                        >
                          {isPending ? "Guardando..." : `Confirmar → ${ESTADO_CONFIG[estadoPendiente].label}`}
                        </button>
                      </div>
                    </div>
                  )}
                </section>
              )}

              {/* Estado terminal */}
              {transiciones.length === 0 && (
                <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8", fontStyle: "italic" }}>
                  Esta tarea está en estado terminal y no admite más transiciones.
                </p>
              )}
            </div>

            {/* Panel derecho: historial de eventos */}
            <div style={{
              flex: "1 1 280px", padding: "22px 24px",
              background: "#fafafa", borderRadius: "0 0 14px 0",
            }}>
              <p style={{ margin: "0 0 14px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                Historial ({eventos.length})
              </p>

              {eventos.length === 0 ? (
                <p style={{ fontSize: "13px", color: "#94a3b8" }}>Sin eventos registrados.</p>
              ) : (
                <div style={{ display: "flex", flexDirection: "column", gap: "0" }}>
                  {[...eventos].reverse().map((ev, idx) => {
                    const cfg = ESTADO_CONFIG[ev.estado_nuevo as EstadoTarea];
                    return (
                      <div key={ev.id} style={{
                        display: "flex", gap: "10px",
                        paddingBottom: idx < eventos.length - 1 ? "14px" : 0,
                      }}>
                        {/* Línea de tiempo */}
                        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", flexShrink: 0 }}>
                          <div style={{
                            width: "10px", height: "10px", borderRadius: "50%",
                            background: cfg.color, flexShrink: 0, marginTop: "4px",
                          }} />
                          {idx < eventos.length - 1 && (
                            <div style={{ width: "1px", flex: 1, background: "#e2e8f0", marginTop: "3px" }} />
                          )}
                        </div>
                        {/* Contenido */}
                        <div style={{ minWidth: 0, flex: 1 }}>
                          <div style={{ display: "flex", alignItems: "baseline", gap: "6px", flexWrap: "wrap" }}>
                            <span style={{ fontSize: "11px", color: "#64748b" }}>
                              {fmtDateShort(ev.timestamp)}
                            </span>
                            <span style={{ fontSize: "12px", fontWeight: 600, color: "#1e293b" }}>
                              {ev.usuario_nombre}
                            </span>
                          </div>
                          <div style={{ display: "flex", alignItems: "center", gap: "4px", marginTop: "2px", flexWrap: "wrap" }}>
                            {ev.estado_anterior && (
                              <>
                                <span style={{
                                  fontSize: "10px", padding: "1px 6px", borderRadius: "10px",
                                  color: ESTADO_CONFIG[ev.estado_anterior as EstadoTarea].color,
                                  background: ESTADO_CONFIG[ev.estado_anterior as EstadoTarea].bg,
                                }}>
                                  {ESTADO_CONFIG[ev.estado_anterior as EstadoTarea].label}
                                </span>
                                <span style={{ fontSize: "10px", color: "#94a3b8" }}>→</span>
                              </>
                            )}
                            <span style={{
                              fontSize: "10px", padding: "1px 6px", borderRadius: "10px",
                              color: cfg.color, background: cfg.bg,
                            }}>
                              {cfg.label}
                            </span>
                          </div>
                          {ev.comentario && (
                            <p style={{
                              margin: "4px 0 0", fontSize: "12px", color: "#475569",
                              lineHeight: 1.4, fontStyle: "italic",
                            }}>
                              "{ev.comentario}"
                            </p>
                          )}
                          {ev.lat_evento && ev.lng_evento && (
                            <a
                              href={`https://www.google.com/maps?q=${ev.lat_evento},${ev.lng_evento}`}
                              target="_blank" rel="noreferrer"
                              style={{ fontSize: "11px", color: "#2563eb", marginTop: "2px", display: "inline-block" }}
                            >
                              📍 Ver en mapa
                            </a>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* ── Fotos ─────────────────────────────────── */}
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Fotos ({fotos.length})
                  </p>
                  <label style={{
                    padding: "4px 10px", borderRadius: "6px", fontSize: "12px", fontWeight: 600,
                    border: "1px solid #e2e8f0", background: "white", color: "#475569",
                    cursor: subiendoFoto ? "not-allowed" : "pointer",
                    opacity: subiendoFoto ? 0.6 : 1,
                  }}>
                    {subiendoFoto ? "Subiendo..." : "+ Foto"}
                    <input
                      type="file"
                      accept="image/*"
                      style={{ display: "none" }}
                      disabled={subiendoFoto}
                      onChange={e => {
                        const file = e.target.files?.[0];
                        if (file) subir(file);
                        e.target.value = "";
                      }}
                    />
                  </label>
                </div>

                {fotos.length === 0 ? (
                  <p style={{ fontSize: "12px", color: "#94a3b8" }}>Sin fotos adjuntas.</p>
                ) : (
                  <div style={{ display: "grid", gridTemplateColumns: "repeat(3, 1fr)", gap: "6px" }}>
                    {fotos.map(foto => (
                      <a
                        key={foto.id}
                        href={`${apiBase}/${foto.ruta}`}
                        target="_blank"
                        rel="noreferrer"
                        title={foto.nombre_original}
                      >
                        <img
                          src={`${apiBase}/${foto.ruta}`}
                          alt={foto.nombre_original}
                          style={{
                            width: "100%", aspectRatio: "1", objectFit: "cover",
                            borderRadius: "6px", border: "1px solid #e2e8f0",
                          }}
                        />
                      </a>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        ) : (
          <div style={{ padding: "40px", textAlign: "center", color: "#dc2626", fontSize: "14px" }}>
            No se pudo cargar la tarea.
          </div>
        )}
      </div>
    </div>
  );
}
