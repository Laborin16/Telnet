import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useAuth } from "../../auth/hooks/useAuth";
import { useTarea, useTareaTransiciones, useTareaEventos, useTareaFotos } from "../hooks/useTareas";
import { useTransicionarEstado, useSubirFoto, useActualizarTarea, useAsignarTecnico } from "../hooks/useTareaActions";
import { useClientDetail } from "../../clients/hooks/useClientDetail";
import apiClient from "../../../core/api/apiClient";
import { vincularServicio, actualizarDatosInstalacion, fetchPlanes, fetchRouters, fetchIpsDisponibles } from "../api/reportes.api";
import type { EstadoTarea, TipoTarea, PrioridadTarea, InstalacionDatos, WispPlan, WispRouter, WispIPs } from "../types/reportes";

interface UsuarioItem { id: number; nombre: string; username: string; activo: boolean; rol: string; }

// ── Configuración de display ───────────────────────────────────────────────────

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
  const puedeGestionar = user?.rol === "administrador" || user?.rol === "supervisor";
  const esAdmin = user?.rol === "administrador";
  const esVentas = user?.rol === "ventas";
  const puedeEditarTareas = puedeGestionar || esVentas;  // asignar/editar/cliente abierto a ventas
  const { data: tarea, isLoading } = useTarea(tareaId);
  const { data: transiciones = [] } = useTareaTransiciones(tareaId);
  const { data: eventos = [] } = useTareaEventos(tareaId);
  const { mutate: transicionar, isPending } = useTransicionarEstado(tareaId);
  const { mutate: subir, isPending: subiendoFoto } = useSubirFoto(tareaId);
  const { mutate: actualizar, isPending: actualizando } = useActualizarTarea(tareaId);
  const { mutate: asignar, isPending: asignando } = useAsignarTecnico(tareaId);
  const { data: fotos = [] } = useTareaFotos(tareaId);
  const { data: cliente } = useClientDetail(tarea?.id_servicio ?? null);

  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
    enabled: puedeEditarTareas,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo && (u.rol === "tecnico" || u.rol === "supervisor"));

  const apiBase = (import.meta.env.VITE_API_URL as string) ?? "";

  // Estado de transición
  const [estadoPendiente, setEstadoPendiente] = useState<EstadoTarea | null>(null);
  const [comentario, setComentario] = useState("");
  const [errorComentario, setErrorComentario] = useState(false);
  // Datos para completar una INSTALACION (solo cuando estadoPendiente === COMPLETADO)
  const [compRouterId, setCompRouterId] = useState("");
  const [compPlanId, setCompPlanId]     = useState("");
  const [compIp, setCompIp]             = useState("");
  const [errorCompletar, setErrorCompletar] = useState("");

  const esCompletandoInstalacion = estadoPendiente === "COMPLETADO" && tarea?.tipo === "INSTALACION";

  const { data: planesWh = [] } = useQuery<WispPlan[]>({
    queryKey: ["wisphub-planes"],
    queryFn: fetchPlanes,
    staleTime: 5 * 60_000,
    enabled: esCompletandoInstalacion,
  });
  const { data: routersWh = [] } = useQuery<WispRouter[]>({
    queryKey: ["wisphub-routers"],
    queryFn: fetchRouters,
    staleTime: 5 * 60_000,
    enabled: esCompletandoInstalacion,
  });
  const EMPTY_IPS: WispIPs = { disponibles: [], ocupadas: [] };
  const compRouterIdNum = compRouterId ? Number(compRouterId) : undefined;
  const { data: ipsWh = EMPTY_IPS, isFetching: cargandoIps, refetch: refetchIps } = useQuery<WispIPs>({
    queryKey: ["wisphub-ips", compRouterIdNum],
    queryFn: () => fetchIpsDisponibles(compRouterIdNum!),
    staleTime: 0,
    gcTime: 0,
    enabled: esCompletandoInstalacion && !!compRouterIdNum,
  });

  // Estado de edición (descripción / prioridad)
  const [modoEdicion, setModoEdicion] = useState(false);
  const [editDesc, setEditDesc]       = useState("");
  const [editPrio, setEditPrio]       = useState<PrioridadTarea>("MEDIA");

  // Estado de edición de horario (independiente)
  const [modoEditarHorario, setModoEditarHorario] = useState(false);
  const [editFecha, setEditFecha]     = useState("");      // YYYY-MM-DD
  const [editHoraInicio, setEditHoraInicio] = useState(""); // HH:MM
  const [editHoraFin, setEditHoraFin]       = useState(""); // HH:MM
  const [editError, setEditError]     = useState("");

  // Estado de reasignación
  const [modoAsignar, setModoAsignar]     = useState(false);
  const [nuevoTecnico, setNuevoTecnico]   = useState<string>("");

  function abrirEdicion() {
    if (!tarea) return;
    setEditDesc(tarea.descripcion);
    setEditPrio(tarea.prioridad as PrioridadTarea);
    setEditError("");
    setModoEdicion(true);
  }

  function guardarEdicion() {
    actualizar(
      {
        descripcion: editDesc.trim() || undefined,
        prioridad: editPrio,
      },
      { onSuccess: () => setModoEdicion(false) }
    );
  }

  function abrirEdicionHorario() {
    if (!tarea) return;
    if (tarea.fecha_inicio) {
      const ini = new Date(tarea.fecha_inicio);
      setEditFecha(ini.toISOString().slice(0, 10));
      setEditHoraInicio(ini.toTimeString().slice(0, 5));
    } else {
      setEditFecha("");
      setEditHoraInicio("");
    }
    if (tarea.fecha_fin) {
      const fin = new Date(tarea.fecha_fin);
      setEditHoraFin(fin.toTimeString().slice(0, 5));
    } else {
      setEditHoraFin("");
    }
    setEditError("");
    setModoEditarHorario(true);
  }

  function guardarHorario() {
    setEditError("");
    const horarioParcial = (editFecha || editHoraInicio || editHoraFin) && !(editFecha && editHoraInicio && editHoraFin);
    if (horarioParcial) {
      setEditError("Completa fecha, hora de inicio y hora de fin, o quita el horario.");
      return;
    }
    if (editFecha && editHoraInicio && editHoraFin && editHoraFin <= editHoraInicio) {
      setEditError("La hora de fin debe ser posterior a la hora de inicio.");
      return;
    }
    const fecha_inicio = editFecha && editHoraInicio ? `${editFecha}T${editHoraInicio}:00` : null;
    const fecha_fin    = editFecha && editHoraFin    ? `${editFecha}T${editHoraFin}:00`    : null;
    actualizar(
      { fecha_inicio, fecha_fin },
      { onSuccess: () => setModoEditarHorario(false) }
    );
  }

  function quitarHorario() {
    actualizar(
      { fecha_inicio: null, fecha_fin: null },
      { onSuccess: () => setModoEditarHorario(false) }
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
    setEstadoPendiente(estadoPendiente === estado ? null : estado);
    setComentario("");
    setErrorComentario(false);
    setCompRouterId("");
    setCompPlanId("");
    setCompIp("");
    setErrorCompletar("");
  }

  function confirmarTransicion() {
    if (!estadoPendiente) return;
    if ((estadoPendiente === "BLOQUEADO" || estadoPendiente === "COMPLETADO") && !comentario.trim()) {
      setErrorComentario(true);
      return;
    }
    let completarPayload = null;
    if (esCompletandoInstalacion) {
      if (!compRouterId || !compPlanId || !compIp) {
        setErrorCompletar("Selecciona router, plan e IP para completar la instalación.");
        return;
      }
      const routerSel = routersWh.find(r => r.id === Number(compRouterId));
      const planSel = planesWh.find(p => p.id === Number(compPlanId));
      completarPayload = {
        router_id: Number(compRouterId),
        router_nombre: routerSel?.nombre ?? null,
        plan_id: Number(compPlanId),
        plan_nombre: planSel?.nombre ?? null,
        ip_asignada: compIp,
      };
    }
    setErrorCompletar("");
    transicionar(
      {
        estado_nuevo: estadoPendiente,
        comentario:   comentario.trim() || null,
        completar_instalacion: completarPayload,
      },
      {
        onSuccess: () => {
          setEstadoPendiente(null);
          setComentario("");
          setErrorComentario(false);
          setCompRouterId("");
          setCompPlanId("");
          setCompIp("");
          setErrorCompletar("");
        },
        onError: (err: unknown) => {
          const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
          setErrorCompletar(detail ?? "Error al confirmar la transición.");
          // Si la IP no estaba disponible, refrescamos la lista
          if (detail && detail.toLowerCase().includes("ip")) {
            refetchIps();
            setCompIp("");
          }
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
          {puedeEditarTareas && tarea && !modoEdicion && (
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
                  {/* Info del cliente desde WispHub */}
                  {cliente ? (
                    <>
                      {[
                        { label: "Cliente", value: cliente.nombre || "—" },
                        { label: "Servicio", value: `#${cliente.id_servicio}` },
                        { label: "Teléfono", value: cliente.telefono || "—" },
                        { label: "IP", value: cliente.ip || "—" },
                        { label: "Plan", value: cliente.plan_internet?.nombre ?? "—" },
                        { label: "Zona", value: cliente.zona?.nombre ?? "—" },
                        { label: "Estado", value: cliente.estado },
                      ].map(({ label, value }) => (
                        <div key={label}>
                          <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>{label}</p>
                          <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{value}</p>
                        </div>
                      ))}
                      <div style={{ gridColumn: "1 / -1" }}>
                        <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Dirección</p>
                        <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{cliente.direccion || "—"}</p>
                      </div>
                    </>
                  ) : (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Servicio</p>
                      <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>
                        {tarea.id_servicio ? `#${tarea.id_servicio}` : "Pendiente de vincular"}
                      </p>
                    </div>
                  )}

                  {/* Horario programado */}
                  {(esAdmin || tarea.fecha_inicio || tarea.fecha_fin) && (
                    <div style={{ gridColumn: "1 / -1" }}>
                      <p style={{ margin: "0 0 4px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Horario programado</p>
                      {modoEditarHorario ? (
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "6px" }}>
                          <div style={{ gridColumn: "1 / -1" }}>
                            <label style={miniLabel}>Fecha</label>
                            <input type="date" value={editFecha} onChange={e => setEditFecha(e.target.value)} style={miniInput} />
                          </div>
                          <div>
                            <label style={miniLabel}>Inicio</label>
                            <input type="time" value={editHoraInicio} onChange={e => setEditHoraInicio(e.target.value)} style={miniInput} />
                          </div>
                          <div>
                            <label style={miniLabel}>Fin</label>
                            <input type="time" value={editHoraFin} onChange={e => setEditHoraFin(e.target.value)} style={miniInput} />
                          </div>
                          {editError && (
                            <p style={{
                              gridColumn: "1 / -1", margin: "4px 0 0", padding: "6px 10px", borderRadius: "6px",
                              background: "#fef2f2", border: "1px solid #fecaca", fontSize: "12px", color: "#dc2626",
                            }}>{editError}</p>
                          )}
                          <div style={{ gridColumn: "1 / -1", display: "flex", gap: "6px", marginTop: "4px" }}>
                            <button onClick={guardarHorario} disabled={actualizando} style={{
                              flex: 1, padding: "6px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, border: "none",
                              background: actualizando ? "#cbd5e1" : "#2563eb", color: "white",
                              cursor: actualizando ? "not-allowed" : "pointer",
                            }}>{actualizando ? "..." : "Guardar"}</button>
                            <button onClick={() => setModoEditarHorario(false)} disabled={actualizando} style={{
                              padding: "6px 10px", borderRadius: "6px", fontSize: "12px",
                              border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer",
                            }}>Cancelar</button>
                            {(tarea.fecha_inicio || tarea.fecha_fin) && (
                              <button onClick={quitarHorario} disabled={actualizando} style={{
                                padding: "6px 10px", borderRadius: "6px", fontSize: "12px",
                                border: "1px solid #fecaca", background: "white", color: "#dc2626", cursor: "pointer",
                              }}>Quitar horario</button>
                            )}
                          </div>
                        </div>
                      ) : (
                        <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                          <p style={{ margin: 0, fontSize: "13px", color: tarea.fecha_inicio ? "#1e293b" : "#94a3b8", fontWeight: 500, fontStyle: tarea.fecha_inicio ? "normal" : "italic" }}>
                            {tarea.fecha_inicio
                              ? `${fmtDateShort(tarea.fecha_inicio)}${tarea.fecha_fin ? ` → ${fmtDateShort(tarea.fecha_fin)}` : ""}`
                              : "Sin horario asignado"}
                          </p>
                          {puedeEditarTareas && (
                            <button onClick={abrirEdicionHorario} style={{
                              padding: "2px 8px", borderRadius: "5px", fontSize: "11px",
                              border: "1px solid #e2e8f0", background: "transparent",
                              color: "#64748b", cursor: "pointer",
                            }}>
                              {tarea.fecha_inicio ? "Cambiar" : "Agregar"}
                            </button>
                          )}
                        </div>
                      )}
                    </div>
                  )}

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
                        {puedeEditarTareas && (
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
                </div>
              </section>

              {/* Panel datos de instalación */}
              {tarea.tipo === "INSTALACION" && tarea.datos_instalacion && (
                <PanelInstalacion
                  datos={tarea.datos_instalacion}
                  tareaId={tarea.id}
                  esAdmin={puedeEditarTareas}
                  permiteEditarCliente={puedeEditarTareas && tarea.estado !== "COMPLETADO" && tarea.estado !== "CANCELADO"}
                />
              )}


              {/* Transiciones — ventas no puede cambiar estado */}
              {!esVentas && transiciones.length > 0 && (
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
                          : estadoPendiente === "COMPLETADO"
                            ? "Comentario obligatorio — notas de finalización:"
                            : "Comentario opcional:"}
                      </p>
                      <textarea
                        value={comentario}
                        onChange={e => { setComentario(e.target.value); setErrorComentario(false); }}
                        placeholder={estadoPendiente === "BLOQUEADO" ? "Motivo del bloqueo..." : estadoPendiente === "COMPLETADO" ? "Notas de finalización..." : "Agregar comentario..."}
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
                          {estadoPendiente === "BLOQUEADO"
                            ? "El comentario es obligatorio para bloquear una tarea."
                            : "El comentario es obligatorio para completar una tarea."}
                        </p>
                      )}

                      {/* Captura de datos técnicos cuando se completa una INSTALACION */}
                      {esCompletandoInstalacion && (
                        <div style={{ marginTop: "12px", padding: "10px", borderRadius: "8px", background: "white", border: "1px solid #cbd5e1" }}>
                          <p style={{ margin: "0 0 8px", fontSize: "11px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                            Datos de instalación (se registra el cliente en WispHub)
                          </p>
                          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <label style={miniLabel}>Router</label>
                              <select value={compRouterId} onChange={e => { setCompRouterId(e.target.value); setCompIp(""); }} style={miniInput}>
                                <option value="">— Seleccionar router —</option>
                                {routersWh.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
                              </select>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <label style={miniLabel}>Plan</label>
                              <select value={compPlanId} onChange={e => setCompPlanId(e.target.value)} style={miniInput}>
                                <option value="">— Seleccionar plan —</option>
                                {planesWh.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.precio ? ` — $${p.precio}` : ""}</option>)}
                              </select>
                            </div>
                            <div style={{ gridColumn: "1 / -1" }}>
                              <label style={miniLabel}>IP disponible</label>
                              <select value={compIp} onChange={e => setCompIp(e.target.value)} style={miniInput} disabled={!compRouterId || cargandoIps}>
                                <option value="">
                                  {!compRouterId ? "Selecciona un router primero" : cargandoIps ? "Cargando IPs..." : ipsWh.disponibles.length === 0 ? "Sin IPs disponibles" : "— Seleccionar IP —"}
                                </option>
                                {ipsWh.disponibles.map(ip => <option key={ip} value={ip}>{ip}</option>)}
                              </select>
                            </div>
                          </div>
                        </div>
                      )}

                      {errorCompletar && (
                        <p style={{
                          margin: "8px 0 0", padding: "6px 10px", borderRadius: "6px",
                          background: "#fef2f2", border: "1px solid #fecaca",
                          fontSize: "12px", color: "#dc2626",
                        }}>{errorCompletar}</p>
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

              {/* ── Fotos ─────────────────────────────────── */}
              <div style={{ marginTop: "20px", paddingTop: "16px", borderTop: "1px solid #e2e8f0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
                  <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
                    Fotos ({fotos.length})
                  </p>
                  {!esVentas && (
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
                  )}
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

// ── Panel datos de instalación ─────────────────────────────────────────────────

const useStateLocal = useState;

const SYNC_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  pendiente:  { label: "Pendiente",  color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  pending:    { label: "Pendiente",  color: "#d97706", bg: "#fffbeb", border: "#fcd34d" },
  registrado: { label: "Registrado", color: "#2563eb", bg: "#eff6ff", border: "#93c5fd" },
  vinculado:  { label: "Vinculado",  color: "#16a34a", bg: "#f0fdf4", border: "#86efac" },
  error:      { label: "Error",      color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
};

function PanelInstalacion({ datos, tareaId, esAdmin, permiteEditarCliente }: { datos: InstalacionDatos; tareaId: number; esAdmin?: boolean; permiteEditarCliente?: boolean }) {
  const [modoVincular, setModoVincular] = useStateLocal(false);
  const [idServicioInput, setIdServicioInput] = useStateLocal("");
  const [editarCliente, setEditarCliente] = useStateLocal(false);
  const [edNombre, setEdNombre] = useStateLocal(datos.nombre_cliente);
  const [edTel, setEdTel] = useStateLocal(datos.telefono ?? "");
  const [edTel2, setEdTel2] = useStateLocal(datos.telefono2 ?? "");
  const [edDir, setEdDir] = useStateLocal(datos.direccion ?? "");
  const [edError, setEdError] = useStateLocal("");
  const queryClient = useQueryClient();
  const { mutate: vincular, isPending: vinculando } = useMutation({
    mutationFn: (id: number) => vincularServicio(tareaId, id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarea", tareaId] });
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      setModoVincular(false);
      setIdServicioInput("");
    },
  });
  const { mutate: guardarCliente, isPending: guardandoCliente } = useMutation({
    mutationFn: () => actualizarDatosInstalacion(tareaId, {
      nombre_cliente: edNombre.trim(),
      telefono: edTel.trim() || null,
      telefono2: edTel2.trim() || null,
      direccion: edDir.trim() || null,
    }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarea", tareaId] });
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      setEditarCliente(false);
      setEdError("");
    },
    onError: (err: unknown) => {
      setEdError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al guardar.");
    },
  });

  const sync = datos.wisphub_sync ?? "pendiente";
  const syncCfg = SYNC_CONFIG[sync] ?? SYNC_CONFIG.pendiente;
  const tieneDatosTecnicos = datos.router_id || datos.plan_id || datos.ip_asignada;

  return (
    <section>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "8px" }}>
        <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.07em" }}>
          Datos de instalación
        </p>
        <span style={{ fontSize: "11px", fontWeight: 600, padding: "2px 8px", borderRadius: "12px", color: syncCfg.color, background: syncCfg.bg, border: `1px solid ${syncCfg.border}` }}>
          WispHub: {syncCfg.label}
        </span>
      </div>

      <div style={{ background: "#f8fafc", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "14px", display: "flex", flexDirection: "column", gap: "10px" }}>
        {/* Datos del cliente — editables si la tarea aún no se completó */}
        <div>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "6px" }}>
            <p style={{ margin: 0, fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cliente</p>
            {permiteEditarCliente && !editarCliente && (
              <button onClick={() => {
                setEdNombre(datos.nombre_cliente);
                setEdTel(datos.telefono ?? "");
                setEdTel2(datos.telefono2 ?? "");
                setEdDir(datos.direccion ?? "");
                setEdError("");
                setEditarCliente(true);
              }} style={{ padding: "2px 8px", borderRadius: "5px", fontSize: "11px", border: "1px solid #e2e8f0", background: "transparent", color: "#64748b", cursor: "pointer" }}>
                Editar
              </button>
            )}
          </div>

          {editarCliente ? (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={miniLabel}>Nombre</label>
                <input value={edNombre} onChange={e => setEdNombre(e.target.value)} style={miniInput} />
              </div>
              <div>
                <label style={miniLabel}>Teléfono 1</label>
                <input value={edTel} onChange={e => setEdTel(e.target.value)} placeholder="Ej. 6441234567" style={miniInput} />
              </div>
              <div>
                <label style={miniLabel}>Teléfono 2</label>
                <input value={edTel2} onChange={e => setEdTel2(e.target.value)} placeholder="Ej. 6449876543" style={miniInput} />
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <label style={miniLabel}>Dirección</label>
                <input value={edDir} onChange={e => setEdDir(e.target.value)} style={miniInput} />
              </div>
              <div style={{ gridColumn: "1 / -1", fontSize: "10px", color: "#94a3b8" }}>
                Teléfonos: 8-14 dígitos sin código de país, varios separados por coma.
              </div>
              {edError && (
                <div style={{ gridColumn: "1 / -1", padding: "6px 10px", borderRadius: "6px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "12px", color: "#dc2626" }}>{edError}</div>
              )}
              <div style={{ gridColumn: "1 / -1", display: "flex", gap: "6px" }}>
                <button onClick={() => guardarCliente()} disabled={guardandoCliente || !edNombre.trim()} style={{ flex: 1, padding: "6px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, border: "none", background: guardandoCliente ? "#cbd5e1" : "#2563eb", color: "white", cursor: guardandoCliente ? "not-allowed" : "pointer" }}>
                  {guardandoCliente ? "..." : "Guardar"}
                </button>
                <button onClick={() => { setEditarCliente(false); setEdError(""); }} disabled={guardandoCliente} style={{ padding: "6px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            </div>
          ) : (
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              <div>
                <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Nombre</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{datos.nombre_cliente}</p>
              </div>
              <div />
              <div>
                <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Teléfono 1</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{datos.telefono ?? "—"}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Teléfono 2</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{datos.telefono2 ?? "—"}</p>
              </div>
              {datos.direccion && (
                <div style={{ gridColumn: "1 / -1" }}>
                  <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Dirección</p>
                  <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{datos.direccion}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Datos técnicos: solo se muestran si ya se completó la instalación */}
        {tieneDatosTecnicos && (
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px" }}>
            <p style={{ margin: "0 0 6px", fontSize: "10px", fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.05em" }}>Datos técnicos</p>
            <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 16px" }}>
              <div>
                <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Router</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{datos.router_nombre ?? (datos.router_id ? `#${datos.router_id}` : "—")}</p>
              </div>
              <div>
                <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>Plan</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500 }}>{datos.plan_nombre ?? (datos.plan_id ? `#${datos.plan_id}` : "—")}</p>
              </div>
              <div style={{ gridColumn: "1 / -1" }}>
                <p style={{ margin: "0 0 1px", fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>IP asignada</p>
                <p style={{ margin: 0, fontSize: "13px", color: "#1e293b", fontWeight: 500, fontFamily: "monospace" }}>{datos.ip_asignada ?? "—"}</p>
              </div>
            </div>
          </div>
        )}

        {/* Error WispHub */}
        {sync === "error" && datos.wisphub_error && (
          <div style={{ padding: "8px 10px", borderRadius: "6px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "12px", color: "#dc2626" }}>
            ⚠ {datos.wisphub_error}
          </div>
        )}

        {/* Vincular id_servicio */}
        {esAdmin && sync !== "vinculado" && (
          <div style={{ borderTop: "1px solid #e2e8f0", paddingTop: "10px", marginTop: "2px" }}>
            {modoVincular ? (
              <div style={{ display: "flex", gap: "6px", alignItems: "center" }}>
                <input
                  type="number"
                  value={idServicioInput}
                  onChange={e => setIdServicioInput(e.target.value)}
                  placeholder="ID de servicio en WispHub"
                  style={{ flex: 1, padding: "6px 10px", borderRadius: "6px", border: "1px solid #6366f1", fontSize: "13px", outline: "none" }}
                />
                <button
                  onClick={() => idServicioInput && vincular(parseInt(idServicioInput, 10))}
                  disabled={!idServicioInput || vinculando}
                  style={{ padding: "6px 12px", borderRadius: "6px", fontSize: "12px", fontWeight: 700, border: "none", background: !idServicioInput || vinculando ? "#cbd5e1" : "#2563eb", color: "white", cursor: !idServicioInput || vinculando ? "not-allowed" : "pointer" }}
                >
                  {vinculando ? "..." : "Vincular"}
                </button>
                <button onClick={() => setModoVincular(false)} style={{ padding: "6px 10px", borderRadius: "6px", fontSize: "12px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer" }}>
                  Cancelar
                </button>
              </div>
            ) : (
              <button onClick={() => setModoVincular(true)} style={{ fontSize: "12px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}>
                + Vincular ID de servicio de WispHub
              </button>
            )}
          </div>
        )}
      </div>
    </section>
  );
}

// ── Estilos pequeños reutilizables ───────────────────────────────────────────

const miniLabel: React.CSSProperties = {
  display: "block", marginBottom: "3px",
  fontSize: "10px", fontWeight: 600, color: "#64748b",
};

const miniInput: React.CSSProperties = {
  width: "100%", boxSizing: "border-box",
  padding: "5px 8px", borderRadius: "6px",
  border: "1px solid #cbd5e1", fontSize: "12px",
  color: "#1e293b", background: "white", outline: "none",
};
