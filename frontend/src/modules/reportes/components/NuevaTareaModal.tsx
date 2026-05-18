import { useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import { useAuth } from "../../auth/hooks/useAuth";
import { useAllClients } from "../../clients/hooks/useAllClients";
import { useCrearTarea } from "../hooks/useTareaActions";
import { fetchPlanes, fetchRouters, fetchIpsDisponibles } from "../api/reportes.api";
import type { ClientItem } from "../../../core/types/client";
import type { PrioridadTarea, TipoTarea, WispPlan, WispRouter, WispIPs } from "../types/reportes";

// ── Opciones ───────────────────────────────────────────────────────────────────

const TIPOS_REGULARES: { value: TipoTarea; label: string }[] = [
  { value: "SERVICIO",         label: "Servicio" },
  { value: "RECOLECCION",      label: "Recolección" },
  { value: "RECONEXION",       label: "Reconexión" },
  { value: "CAMBIO_DOMICILIO", label: "Cambio de domicilio" },
  { value: "TRABAJO_GENERAL",  label: "Trabajo general" },
];

const PRIORIDADES: { value: PrioridadTarea; label: string; color: string }[] = [
  { value: "ALTA",  label: "Alta",  color: "#dc2626" },
  { value: "MEDIA", label: "Media", color: "#d97706" },
  { value: "BAJA",  label: "Baja",  color: "#16a34a" },
];

interface UsuarioItem { id: number; nombre: string; username: string; activo: boolean; rol: string }

// ── Componente principal ───────────────────────────────────────────────────────

interface Props { onClose: () => void }

export function NuevaTareaModal({ onClose }: Props) {
  const { user } = useAuth();
  const esVentas = user?.rol === "ventas";
  // Ventas solo puede crear instalaciones — forzamos esa rama del formulario.
  const [esInstalacion, setEsInstalacion] = useState(esVentas);

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
          width: "100%", maxWidth: "520px",
          maxHeight: "92vh", overflowY: "auto",
          boxShadow: "0 24px 60px rgba(0,0,0,0.25)",
        }}
      >
        {/* Cabecera */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "18px 24px", borderBottom: "1px solid #e2e8f0",
          position: "sticky", top: 0, background: "white", zIndex: 1,
        }}>
          <div>
            <h2 style={{ margin: 0, fontSize: "16px", fontWeight: 700, color: "#0f172a" }}>
              Nueva tarea
            </h2>
          </div>
          <button onClick={onClose} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "18px", color: "#94a3b8", padding: "4px", lineHeight: 1 }}>
            ✕
          </button>
        </div>

        {/* Selector de tipo principal — oculto para ventas (solo instalaciones) */}
        {!esVentas && (
          <div style={{ display: "flex", padding: "16px 24px 0", gap: "10px" }}>
            <button
              type="button"
              onClick={() => setEsInstalacion(false)}
              style={{
                flex: 1, padding: "10px", borderRadius: "9px", fontSize: "13px",
                fontWeight: 600, cursor: "pointer",
                border: `2px solid ${!esInstalacion ? "#2563eb" : "#e2e8f0"}`,
                background: !esInstalacion ? "#eff6ff" : "white",
                color: !esInstalacion ? "#2563eb" : "#64748b",
              }}
            >
              🔧 Tarea de servicio
            </button>
            <button
              type="button"
              onClick={() => setEsInstalacion(true)}
              style={{
                flex: 1, padding: "10px", borderRadius: "9px", fontSize: "13px",
                fontWeight: 600, cursor: "pointer",
                border: `2px solid ${esInstalacion ? "#16a34a" : "#e2e8f0"}`,
                background: esInstalacion ? "#f0fdf4" : "white",
                color: esInstalacion ? "#16a34a" : "#64748b",
              }}
            >
              🏠 Nueva instalación
            </button>
          </div>
        )}

        {esInstalacion
          ? <FormInstalacion onClose={onClose} />
          : <FormTareaServicio onClose={onClose} />}
      </div>
    </div>
  );
}

// ── Formulario: Tarea de servicio (cliente existente) ──────────────────────────

function FormTareaServicio({ onClose }: { onClose: () => void }) {
  const { mutate: crearTarea, isPending } = useCrearTarea();
  const { data: allClients = [] } = useAllClients();
  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo && u.rol === "tecnico");

  const [tipo, setTipo]                     = useState<TipoTarea>("SERVICIO");
  const [prioridad, setPrioridad]           = useState<PrioridadTarea>("MEDIA");
  const [selectedClient, setSelectedClient] = useState<ClientItem | null>(null);
  const [clientSearch, setClientSearch]     = useState("");
  const [showDropdown, setShowDropdown]     = useState(false);
  const [tecnicoId, setTecnicoId]           = useState("");
  const [descripcion, setDescripcion]       = useState("");
  const [fechaProgram, setFechaProgram]     = useState("");
  const [horaInicio, setHoraInicio]         = useState("");
  const [horaFin, setHoraFin]               = useState("");
  const [error, setError]                   = useState("");
  const searchRef = useRef<HTMLDivElement>(null);

  const clientesFiltrados = clientSearch.trim().length >= 2
    ? allClients.filter(c => {
        const q = clientSearch.toLowerCase();
        return c.nombre.toLowerCase().includes(q) || String(c.id_servicio).includes(q);
      }).slice(0, 10)
    : [];

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (tipo !== "TRABAJO_GENERAL" && !selectedClient) { setError("Selecciona un cliente."); return; }
    if (!descripcion.trim()) { setError("La descripción es obligatoria."); return; }
    const horarioParcial = (fechaProgram || horaInicio || horaFin) && !(fechaProgram && horaInicio && horaFin);
    if (horarioParcial) {
      setError("Completa fecha, hora de inicio y hora de fin, o quita el horario."); return;
    }
    if (fechaProgram && horaInicio && horaFin && horaFin <= horaInicio) {
      setError("La hora de fin debe ser posterior a la hora de inicio."); return;
    }
    setError("");
    const fecha_inicio = fechaProgram && horaInicio && horaFin ? `${fechaProgram}T${horaInicio}:00` : null;
    const fecha_fin    = fechaProgram && horaInicio && horaFin ? `${fechaProgram}T${horaFin}:00`    : null;
    crearTarea(
      {
        id_servicio: selectedClient ? selectedClient.id_servicio : null,
        tipo, prioridad,
        descripcion: descripcion.trim(),
        tecnico_id: tecnicoId ? parseInt(tecnicoId, 10) : null,
        fecha_inicio,
        fecha_fin,
      },
      { onSuccess: onClose, onError: (err: unknown) => setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al crear la tarea.") }
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>
      <div>
        <label style={labelStyle}>Tipo de tarea</label>
        <select value={tipo} onChange={e => setTipo(e.target.value as TipoTarea)} style={selectStyle}>
          {TIPOS_REGULARES.map(t => <option key={t.value} value={t.value}>{t.label}</option>)}
        </select>
      </div>

      <PrioridadSelector value={prioridad} onChange={setPrioridad} />

      <div>
        <label style={labelStyle}>Cliente {tipo === "TRABAJO_GENERAL" && <span style={{ color: "#94a3b8", fontWeight: 400, fontSize: "11px", textTransform: "none" }}>(Opcional)</span>}</label>
        {selectedClient ? (
          <ClienteCard client={selectedClient} onClear={() => setSelectedClient(null)} />
        ) : (
          <div ref={searchRef} style={{ position: "relative" }}>
            <input
              type="text" value={clientSearch}
              onChange={e => { setClientSearch(e.target.value); setShowDropdown(true); }}
              onFocus={() => setShowDropdown(true)}
              onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
              placeholder="Buscar por nombre o ID de servicio..."
              style={inputStyle} autoComplete="off"
            />
            {showDropdown && clientesFiltrados.length > 0 && (
              <ClientDropdown clientes={clientesFiltrados} onSelect={c => { setSelectedClient(c); setClientSearch(""); setShowDropdown(false); }} />
            )}
            {showDropdown && clientSearch.trim().length >= 2 && clientesFiltrados.length === 0 && (
              <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "12px", fontSize: "13px", color: "#94a3b8", textAlign: "center" }}>
                Sin resultados
              </div>
            )}
          </div>
        )}
      </div>

      <TecnicoSelector tecnicosActivos={tecnicosActivos} value={tecnicoId} onChange={setTecnicoId} />

      <div>
        <label style={labelStyle}>Descripción</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Describe el trabajo a realizar..." rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </div>

      <HorarioSelector
        fecha={fechaProgram} onFecha={setFechaProgram}
        horaInicio={horaInicio} onHoraInicio={setHoraInicio}
        horaFin={horaFin} onHoraFin={setHoraFin}
      />

      <ErrorMsg msg={error} />
      <Acciones isPending={isPending} onClose={onClose} label="Crear tarea" />
    </form>
  );
}

// ── Formulario: Nueva instalación ──────────────────────────────────────────────

function FormInstalacion({ onClose }: { onClose: () => void }) {
  const { mutate: crearTarea, isPending } = useCrearTarea();
  const { data: usuarios = [] } = useQuery<UsuarioItem[]>({
    queryKey: ["usuarios-lista"],
    queryFn: async () => (await apiClient.get("/api/v1/auth/usuarios")).data,
    staleTime: 60_000,
  });
  const { data: planes = [] } = useQuery<WispPlan[]>({
    queryKey: ["wisphub-planes"],
    queryFn: fetchPlanes,
    staleTime: 0,
  });
  const { data: routers = [] } = useQuery<WispRouter[]>({
    queryKey: ["wisphub-routers"],
    queryFn: fetchRouters,
    staleTime: 5 * 60_000,
  });
  const tecnicosActivos = usuarios.filter(u => u.activo && u.rol === "tecnico");

  const [prioridad, setPrioridad]   = useState<PrioridadTarea>("MEDIA");
  const [tecnicoId, setTecnicoId]   = useState("");
  const [descripcion, setDescripcion] = useState("");
  const [fechaProgram, setFechaProgram] = useState("");
  const [horaInicio, setHoraInicio] = useState("");
  const [horaFin, setHoraFin]       = useState("");
  const [error, setError]           = useState("");

  // Datos del nuevo cliente
  const [nombre, setNombre]         = useState("");
  const [telefono, setTelefono]     = useState("");
  const [telefono2, setTelefono2]   = useState("");
  const [direccion, setDireccion]   = useState("");
  const [planId, setPlanId]         = useState("");
  const [routerId, setRouterId]     = useState("");
  const [ip, setIp]               = useState("");
  const [ipManual, setIpManual]   = useState(false);

  const routerIdNum = routerId ? Number(routerId) : undefined;
  const EMPTY_IPS: WispIPs = { disponibles: [], ocupadas: [] };
  const { data: ipsData = EMPTY_IPS, isFetching: cargandoIps } = useQuery<WispIPs>({
    queryKey: ["wisphub-ips", routerIdNum],
    queryFn: () => fetchIpsDisponibles(routerIdNum!),
    staleTime: 0,
    gcTime: 0,
    enabled: !!routerIdNum,
  });
  const [mostrarOcupadas, setMostrarOcupadas] = useState(false);

  const routerSeleccionado = routers.find(r => r.id === Number(routerId));
  const planSeleccionado = planes.find(p => p.id === Number(planId));

  const planesOrdenados = [...planes].sort((a, b) => {
    const esPPa = /punto a punto/i.test(a.nombre);
    const esPPb = /punto a punto/i.test(b.nombre);
    if (esPPa !== esPPb) return esPPa ? 1 : -1;
    const numA = parseFloat(a.nombre.replace(/[^\d.]/g, "")) || 0;
    const numB = parseFloat(b.nombre.replace(/[^\d.]/g, "")) || 0;
    return numB - numA;
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!nombre.trim()) { setError("El nombre del cliente es obligatorio."); return; }
    if (!routerId)      { setError("Selecciona un router."); return; }
    if (!planId)        { setError("Selecciona un plan."); return; }
    if (!ip.trim())     { setError("La IP asignada es obligatoria."); return; }
    if (!descripcion.trim()) { setError("La descripción es obligatoria."); return; }
    const horarioParcial = (fechaProgram || horaInicio || horaFin) && !(fechaProgram && horaInicio && horaFin);
    if (horarioParcial) {
      setError("Completa fecha, hora de inicio y hora de fin, o quita el horario."); return;
    }
    if (fechaProgram && horaInicio && horaFin && horaFin <= horaInicio) {
      setError("La hora de fin debe ser posterior a la hora de inicio."); return;
    }
    setError("");
    const fecha_inicio = fechaProgram && horaInicio && horaFin ? `${fechaProgram}T${horaInicio}:00` : null;
    const fecha_fin    = fechaProgram && horaInicio && horaFin ? `${fechaProgram}T${horaFin}:00`    : null;
    crearTarea(
      {
        tipo: "INSTALACION",
        prioridad,
        descripcion: descripcion.trim(),
        tecnico_id: tecnicoId ? parseInt(tecnicoId, 10) : null,
        fecha_inicio,
        fecha_fin,
        instalacion: {
          nombre_cliente: nombre.trim(),
          telefono: telefono.trim() || null,
          telefono2: telefono2.trim() || null,
          direccion: direccion.trim() || null,
          router_id: Number(routerId),
          router_nombre: routerSeleccionado?.nombre ?? null,
          plan_id: Number(planId),
          plan_nombre: planSeleccionado?.nombre ?? null,
          ip_asignada: ip.trim(),
        },
      },
      { onSuccess: onClose, onError: (err: unknown) => setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? "Error al crear la instalación.") }
    );
  }

  return (
    <form onSubmit={handleSubmit} style={{ padding: "18px 24px 24px", display: "flex", flexDirection: "column", gap: "14px" }}>

      {/* Sección datos del cliente */}
      <SectionTitle>Datos del cliente</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Nombre completo *</label>
          <input value={nombre} onChange={e => setNombre(e.target.value)} placeholder="Ej. Juan Pérez García" style={inputStyle} required />
        </div>
        <div>
          <label style={labelStyle}>Teléfono 1</label>
          <input value={telefono} onChange={e => setTelefono(e.target.value)} placeholder="Ej. 644 123 4567" style={inputStyle} />
        </div>
        <div>
          <label style={labelStyle}>Teléfono 2</label>
          <input value={telefono2} onChange={e => setTelefono2(e.target.value)} placeholder="Ej. 644 987 6543" style={inputStyle} />
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Dirección</label>
          <input value={direccion} onChange={e => setDireccion(e.target.value)} placeholder="Calle, número, colonia..." style={inputStyle} />
        </div>
      </div>

      {/* Sección datos técnicos */}
      <SectionTitle>Datos técnicos (WispHub)</SectionTitle>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "12px" }}>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Plan de internet *</label>
          <select value={planId} onChange={e => setPlanId(e.target.value)} style={selectStyle} required>
            <option value="">— Seleccionar —</option>
            {planesOrdenados.map(p => <option key={p.id} value={p.id}>{p.nombre}{p.precio ? ` — $${p.precio}` : ""}</option>)}
          </select>
        </div>
        <div style={{ gridColumn: "1 / -1" }}>
          <label style={labelStyle}>Router *</label>
          <select
            value={routerId}
            onChange={e => { setRouterId(e.target.value); setIp(""); setIpManual(false); }}
            style={selectStyle}
            required
          >
            <option value="">— Seleccionar router —</option>
            {routers.map(r => <option key={r.id} value={r.id}>{r.nombre}</option>)}
          </select>
        </div>

        <div style={{ gridColumn: "1 / -1" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "5px" }}>
            <label style={{ ...labelStyle, marginBottom: 0 }}>IP asignada *</label>
            <button
              type="button"
              onClick={() => { setIpManual(m => !m); setIp(""); }}
              style={{ fontSize: "11px", color: "#2563eb", background: "none", border: "none", cursor: "pointer", padding: 0, fontWeight: 600 }}
            >
              {ipManual ? "← Ver disponibles" : "Escribir manualmente"}
            </button>
          </div>

          {!routerIdNum ? (
            <input disabled placeholder="Selecciona un router primero" style={{ ...inputStyle, color: "#94a3b8" }} />
          ) : ipManual ? (
            <input
              value={ip}
              onChange={e => setIp(e.target.value)}
              placeholder="Ej. 192.168.1.100"
              style={inputStyle}
              required
            />
          ) : (
            <select
              value={ip}
              onChange={e => setIp(e.target.value)}
              style={selectStyle}
              required
              disabled={cargandoIps}
            >
              <option value="">
                {cargandoIps ? "Cargando IPs..." : ipsData.disponibles.length === 0 ? "Sin IPs disponibles" : "— Seleccionar IP —"}
              </option>
              {ipsData.disponibles.map(ipStr => (
                <option key={ipStr} value={ipStr}>{ipStr}</option>
              ))}
            </select>
          )}

          {/* Panel de IPs ocupadas */}
          {routerIdNum && !cargandoIps && ipsData.ocupadas.length > 0 && (
            <div style={{ marginTop: "6px" }}>
              <button
                type="button"
                onClick={() => setMostrarOcupadas(m => !m)}
                style={{ fontSize: "11px", color: "#64748b", background: "none", border: "none", cursor: "pointer", padding: 0, display: "flex", alignItems: "center", gap: "4px" }}
              >
                <span>{mostrarOcupadas ? "▲" : "▼"}</span>
                {ipsData.ocupadas.length} IPs ocupadas
              </button>
              {mostrarOcupadas && (
                <div style={{ marginTop: "6px", maxHeight: "160px", overflowY: "auto", border: "1px solid #e2e8f0", borderRadius: "7px", fontSize: "12px" }}>
                  {ipsData.ocupadas.map(o => (
                    <div key={o.ip} style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "5px 10px", borderBottom: "1px solid #f1f5f9" }}>
                      <span style={{ fontFamily: "monospace", color: "#dc2626", fontWeight: 600 }}>{o.ip}</span>
                      <span style={{ color: "#64748b", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "60%" }}>{o.nombre}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Sección tarea */}
      <SectionTitle>Tarea de instalación</SectionTitle>

      <PrioridadSelector value={prioridad} onChange={setPrioridad} />
      <TecnicoSelector tecnicosActivos={tecnicosActivos} value={tecnicoId} onChange={setTecnicoId} />

      <div>
        <label style={labelStyle}>Notas / instrucciones</label>
        <textarea value={descripcion} onChange={e => setDescripcion(e.target.value)} placeholder="Detalles de la instalación, acceso al domicilio, equipo a instalar..." rows={3} style={{ ...inputStyle, resize: "vertical", lineHeight: 1.5 }} />
      </div>

      <HorarioSelector
        fecha={fechaProgram} onFecha={setFechaProgram}
        horaInicio={horaInicio} onHoraInicio={setHoraInicio}
        horaFin={horaFin} onHoraFin={setHoraFin}
      />

      {/* Aviso WispHub */}
      <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#f0fdf4", border: "1px solid #86efac", fontSize: "12px", color: "#15803d", display: "flex", gap: "8px", alignItems: "flex-start" }}>
        <span style={{ flexShrink: 0 }}>🔗</span>
        <span>Al crear esta tarea se registrará automáticamente el cliente en WispHub con el plan y zona seleccionados.</span>
      </div>

      <ErrorMsg msg={error} />
      <Acciones isPending={isPending} onClose={onClose} label={isPending ? "Registrando..." : "Crear instalación"} color="#16a34a" />
    </form>
  );
}

// ── Sub-componentes compartidos ────────────────────────────────────────────────

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ display: "flex", alignItems: "center", gap: "8px", marginTop: "2px" }}>
      <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
      <span style={{ fontSize: "10px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.08em", whiteSpace: "nowrap" }}>
        {children}
      </span>
      <div style={{ flex: 1, height: "1px", background: "#e2e8f0" }} />
    </div>
  );
}

function PrioridadSelector({ value, onChange }: { value: PrioridadTarea; onChange: (v: PrioridadTarea) => void }) {
  return (
    <div>
      <label style={labelStyle}>Prioridad</label>
      <div style={{ display: "flex", gap: "6px" }}>
        {PRIORIDADES.map(p => {
          const active = value === p.value;
          return (
            <button key={p.value} type="button" onClick={() => onChange(p.value)} style={{ flex: 1, padding: "7px 0", borderRadius: "8px", fontSize: "13px", fontWeight: 600, cursor: "pointer", border: `1.5px solid ${active ? p.color : "#e2e8f0"}`, color: active ? "white" : p.color, background: active ? p.color : `${p.color}12` }}>
              {p.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}

function TecnicoSelector({ tecnicosActivos, value, onChange }: { tecnicosActivos: UsuarioItem[]; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label style={labelStyle}>Técnico asignado <span style={{ fontWeight: 400, color: "#94a3b8" }}>(opcional)</span></label>
      <select value={value} onChange={e => onChange(e.target.value)} style={selectStyle}>
        <option value="">Sin asignar</option>
        {tecnicosActivos.map(u => <option key={u.id} value={u.id}>{u.nombre} ({u.username})</option>)}
      </select>
    </div>
  );
}

function ClienteCard({ client, onClear }: { client: ClientItem; onClear: () => void }) {
  return (
    <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#f0f9ff", border: "1px solid #7dd3fc", display: "flex", alignItems: "flex-start", gap: "10px" }}>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: "#0f172a" }}>{client.nombre}</p>
        <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>
          Servicio #{client.id_servicio}{client.plan_internet && ` · ${client.plan_internet.nombre}`}
        </p>
        {client.telefono && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b" }}>📞 {client.telefono}</p>}
        {client.direccion && <p style={{ margin: "2px 0 0", fontSize: "11px", color: "#64748b", whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis" }}>📍 {client.direccion}</p>}
      </div>
      <button type="button" onClick={onClear} style={{ background: "none", border: "none", cursor: "pointer", fontSize: "14px", color: "#94a3b8", flexShrink: 0, padding: "2px" }}>✕</button>
    </div>
  );
}

function ClientDropdown({ clientes, onSelect }: { clientes: ClientItem[]; onSelect: (c: ClientItem) => void }) {
  return (
    <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, right: 0, zIndex: 10, background: "white", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 8px 24px rgba(0,0,0,0.1)", maxHeight: "220px", overflowY: "auto" }}>
      {clientes.map(c => (
        <button key={c.id_servicio} type="button" onMouseDown={() => onSelect(c)} style={{ width: "100%", padding: "9px 12px", textAlign: "left", background: "none", border: "none", cursor: "pointer", borderBottom: "1px solid #f1f5f9", display: "flex", flexDirection: "column", gap: "2px" }}>
          <span style={{ fontSize: "13px", fontWeight: 600, color: "#0f172a" }}>{c.nombre}</span>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>#{c.id_servicio}{c.plan_internet && ` · ${c.plan_internet.nombre}`}{c.zona && ` · ${c.zona.nombre}`}</span>
        </button>
      ))}
    </div>
  );
}

function ErrorMsg({ msg }: { msg: string }) {
  if (!msg) return null;
  return <div style={{ padding: "10px 12px", borderRadius: "8px", background: "#fef2f2", border: "1px solid #fecaca", fontSize: "13px", color: "#dc2626" }}>{msg}</div>;
}

function Acciones({ isPending, onClose, label, color = "#2563eb" }: { isPending: boolean; onClose: () => void; label: string; color?: string }) {
  return (
    <div style={{ display: "flex", gap: "8px", justifyContent: "flex-end", marginTop: "4px" }}>
      <button type="button" onClick={onClose} disabled={isPending} style={{ padding: "8px 18px", borderRadius: "8px", fontSize: "13px", border: "1px solid #e2e8f0", background: "white", color: "#64748b", cursor: "pointer", fontWeight: 500 }}>
        Cancelar
      </button>
      <button type="submit" disabled={isPending} style={{ padding: "8px 22px", borderRadius: "8px", fontSize: "13px", fontWeight: 700, cursor: isPending ? "not-allowed" : "pointer", border: "none", background: isPending ? "#cbd5e1" : color, color: "white", boxShadow: isPending ? "none" : `0 2px 8px ${color}55` }}>
        {label}
      </button>
    </div>
  );
}

// ── Horario selector ─────────────────────────────────────────────────────────

function HorarioSelector({ fecha, onFecha, horaInicio, onHoraInicio, horaFin, onHoraFin }: {
  fecha: string; onFecha: (v: string) => void;
  horaInicio: string; onHoraInicio: (v: string) => void;
  horaFin: string; onHoraFin: (v: string) => void;
}) {
  const [expandido, setExpandido] = useState(!!(fecha || horaInicio || horaFin));
  const tiene = !!(fecha && horaInicio && horaFin);
  const parcial = !tiene && !!(fecha || horaInicio || horaFin);

  return (
    <div style={{ border: "1px solid #e2e8f0", borderRadius: "9px", overflow: "hidden" }}>
      <button
        type="button"
        onClick={() => setExpandido(e => !e)}
        style={{
          width: "100%", display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "9px 12px",
          background: parcial ? "#fef2f2" : tiene ? "#f0fdf4" : "#f8fafc",
          border: "none", cursor: "pointer", fontSize: "12px",
          color: parcial ? "#dc2626" : tiene ? "#15803d" : "#64748b", fontWeight: 600,
        }}
      >
        <span>
          🗓 {tiene
            ? `${fecha} · ${horaInicio} – ${horaFin}`
            : parcial
              ? "Horario incompleto — completa los tres campos o quítalo"
              : "Programar horario (opcional)"}
        </span>
        <span style={{ fontSize: "10px" }}>{expandido ? "▲" : "▼"}</span>
      </button>
      {expandido && (
        <div style={{ padding: "12px", borderTop: "1px solid #e2e8f0", display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: "10px" }}>
          <div style={{ gridColumn: "1 / -1" }}>
            <label style={labelStyle}>Fecha</label>
            <input type="date" value={fecha} onChange={e => onFecha(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Hora inicio</label>
            <input type="time" value={horaInicio} onChange={e => onHoraInicio(e.target.value)} style={inputStyle} />
          </div>
          <div>
            <label style={labelStyle}>Hora fin</label>
            <input type="time" value={horaFin} onChange={e => onHoraFin(e.target.value)} style={inputStyle} />
          </div>
          {fecha && horaInicio && horaFin && (
            <div style={{ gridColumn: "1 / -1", display: "flex", justifyContent: "flex-end" }}>
              <button type="button" onClick={() => { onFecha(""); onHoraInicio(""); onHoraFin(""); }}
                style={{ fontSize: "11px", color: "#dc2626", background: "none", border: "none", cursor: "pointer", padding: 0 }}>
                Quitar horario
              </button>
            </div>
          )}
        </div>
      )}
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
