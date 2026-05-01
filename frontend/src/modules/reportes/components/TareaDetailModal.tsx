import { useState } from "react";
import { useAuth } from "../../auth/hooks/useAuth";
import { useTarea, useTareaTransiciones, useTareaEventos } from "../hooks/useTareas";
import { useTransicionarEstado } from "../hooks/useTareaActions";
import type { EstadoTarea, TipoTarea, PrioridadTarea } from "../types/reportes";

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

  const [estadoPendiente, setEstadoPendiente] = useState<EstadoTarea | null>(null);
  const [comentario, setComentario] = useState("");
  const [errorComentario, setErrorComentario] = useState(false);

  function seleccionarTransicion(estado: EstadoTarea) {
    if (estadoPendiente === estado) {
      setEstadoPendiente(null);
      setComentario("");
      setErrorComentario(false);
    } else {
      setEstadoPendiente(estado);
      setComentario("");
      setErrorComentario(false);
    }
  }

  function confirmarTransicion() {
    if (!estadoPendiente) return;
    if (estadoPendiente === "BLOQUEADO" && !comentario.trim()) {
      setErrorComentario(true);
      return;
    }
    transicionar(
      { estado_nuevo: estadoPendiente, comentario: comentario.trim() || null },
      {
        onSuccess: () => {
          setEstadoPendiente(null);
          setComentario("");
          setErrorComentario(false);
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
                <p style={{ margin: 0, fontSize: "14px", color: "#334155", lineHeight: 1.6 }}>
                  {tarea.descripcion}
                </p>
              </section>

              {/* Detalles */}
              <section>
                <p style={{ margin: "0 0 8px", fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                  Detalles
                </p>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
                  {[
                    { label: "Cliente (servicio)", value: `#${tarea.id_servicio}` },
                    { label: "Técnico",  value: tarea.tecnico_id ? `#${tarea.tecnico_id}` : "Sin asignar" },
                    { label: "Creada",   value: fmtDate(tarea.fecha_creada) },
                    { label: "Asignada", value: fmtDate(tarea.fecha_asignada) },
                    { label: "Iniciada", value: fmtDate(tarea.fecha_iniciada) },
                    { label: "Completada", value: fmtDate(tarea.fecha_completada) },
                  ].map(({ label, value }) => (
                    <div key={label}>
                      <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>{label}</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{value}</p>
                    </div>
                  ))}
                </div>
              </section>

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
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
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
