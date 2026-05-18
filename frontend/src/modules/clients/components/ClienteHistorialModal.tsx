import { useClienteHistorial } from "../hooks/useClienteHistorial";
import type { HistorialEvento } from "../api/clients.api";

// ── Diseño tokens ─────────────────────────────────────────────────────────────

const C = {
  ink900: "#0f172a", ink700: "#334155", ink500: "#64748b",
  ink400: "#94a3b8", ink300: "#cbd5e1",
  surface: "#ffffff", spine: "#f8fafc", sunken: "#f1f5f9",
  border: "#e2e8f0",
};

// ── Catálogo de eventos: color + ícono + label ────────────────────────────────

interface EventoConfig {
  label: string;
  color: string;     // borde + ícono
  bg: string;        // fondo del badge
  icon: string;      // emoji simple — opcional cambiar a SVG
}

const EVENTO_CONFIG: Record<string, EventoConfig> = {
  TAREA_CREADA:        { label: "Tarea creada",       color: "#2563eb", bg: "#dbeafe", icon: "+" },
  TAREA_ASIGNADA:      { label: "Tarea asignada",     color: "#0ea5e9", bg: "#e0f2fe", icon: "→" },
  TAREA_TRANSICION:    { label: "Cambio de estado",   color: "#7c3aed", bg: "#ede9fe", icon: "↻" },
  TAREA_COMPLETADA:    { label: "Tarea completada",   color: "#15803d", bg: "#dcfce7", icon: "✓" },
  TAREA_CANCELADA:     { label: "Tarea cancelada",    color: "#64748b", bg: "#f1f5f9", icon: "×" },
  PAGO_REGISTRADO:     { label: "Pago registrado",    color: "#15803d", bg: "#dcfce7", icon: "$" },
  PAGO_VERIFICADO:     { label: "Pago verificado",    color: "#0d9488", bg: "#ccfbf1", icon: "✓$" },
  SERVICIO_SUSPENDIDO: { label: "Servicio suspendido", color: "#dc2626", bg: "#fee2e2", icon: "⏸" },
  SERVICIO_REACTIVADO: { label: "Servicio reactivado", color: "#16a34a", bg: "#dcfce7", icon: "▶" },
};
const DEFAULT_CFG: EventoConfig = { label: "Evento", color: "#64748b", bg: "#f1f5f9", icon: "·" };

function cfg(tipo: string): EventoConfig {
  return EVENTO_CONFIG[tipo] ?? DEFAULT_CFG;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function fmtFechaHora(iso: string): string {
  return new Date(iso).toLocaleString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function agruparPorDia(items: HistorialEvento[]): { fecha: string; eventos: HistorialEvento[] }[] {
  const map = new Map<string, HistorialEvento[]>();
  items.forEach(e => {
    const key = new Date(e.fecha).toLocaleDateString("es-MX", { day: "2-digit", month: "long", year: "numeric" });
    const lista = map.get(key) ?? [];
    lista.push(e);
    map.set(key, lista);
  });
  return Array.from(map.entries()).map(([fecha, eventos]) => ({ fecha, eventos }));
}

// ── Componente ────────────────────────────────────────────────────────────────

interface Props {
  idServicio: number;
  nombreCliente: string;
  onClose: () => void;
}

export function ClienteHistorialModal({ idServicio, nombreCliente, onClose }: Props) {
  const { data, isLoading, error } = useClienteHistorial(idServicio);

  const grupos = data ? agruparPorDia(data.items) : [];

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={e => e.stopPropagation()}>
        {/* Cabecera */}
        <div style={header}>
          <div>
            <p style={{ margin: 0, fontSize: "11px", fontWeight: 700, color: C.ink500, letterSpacing: "0.08em", textTransform: "uppercase" }}>
              Historial · Servicio #{idServicio}
            </p>
            <h2 style={{ margin: "2px 0 0", fontSize: "17px", fontWeight: 700, color: C.ink900, letterSpacing: "-0.01em" }}>
              {nombreCliente}
            </h2>
            {data && (
              <p style={{ margin: "4px 0 0", fontSize: "12px", color: C.ink500, fontWeight: 500 }}>
                {data.total} evento{data.total !== 1 ? "s" : ""} registrado{data.total !== 1 ? "s" : ""}
              </p>
            )}
          </div>
          <button onClick={onClose} style={closeBtn} aria-label="Cerrar">✕</button>
        </div>

        {/* Cuerpo */}
        <div style={body}>
          {isLoading && <Estado mensaje="Cargando historial…" />}
          {error && <Estado mensaje="No se pudo cargar el historial." tono="error" />}
          {data && data.items.length === 0 && (
            <Estado mensaje="Este cliente aún no tiene eventos registrados." />
          )}

          {grupos.map(({ fecha, eventos }) => (
            <div key={fecha} style={{ marginBottom: "20px" }}>
              <div style={dayLabel}>{fecha}</div>
              <div style={{ position: "relative", paddingLeft: "28px" }}>
                {/* Línea vertical del timeline */}
                <div style={{
                  position: "absolute", left: "11px", top: "8px", bottom: "8px",
                  width: "2px", background: C.border,
                }} />
                {eventos.map(ev => <EventoItem key={ev.id} ev={ev} />)}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Sub-componentes ───────────────────────────────────────────────────────────

function EventoItem({ ev }: { ev: HistorialEvento }) {
  const c = cfg(ev.tipo_evento);
  const datos = ev.datos_extra;

  return (
    <div style={{ position: "relative", paddingBottom: "14px" }}>
      {/* Punto del timeline */}
      <div style={{
        position: "absolute", left: "-23px", top: "2px",
        width: "24px", height: "24px", borderRadius: "50%",
        background: c.bg, border: `2px solid ${c.color}`,
        display: "flex", alignItems: "center", justifyContent: "center",
        fontSize: "11px", fontWeight: 700, color: c.color,
      }}>
        {c.icon}
      </div>

      {/* Card del evento */}
      <div style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderLeft: `3px solid ${c.color}`,
        borderRadius: "8px",
        padding: "10px 12px",
      }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", gap: "12px" }}>
          <p style={{ margin: 0, fontSize: "13px", fontWeight: 700, color: C.ink900, lineHeight: 1.3 }}>
            {ev.titulo}
          </p>
          <span style={{ fontSize: "11px", color: C.ink500, fontVariantNumeric: "tabular-nums", flexShrink: 0, fontWeight: 600 }}>
            {new Date(ev.fecha).toLocaleTimeString("es-MX", { hour: "2-digit", minute: "2-digit" })}
          </span>
        </div>

        {ev.descripcion && (
          <p style={{ margin: "4px 0 0", fontSize: "12px", color: C.ink700, lineHeight: 1.4 }}>
            {ev.descripcion}
          </p>
        )}

        <div style={{ display: "flex", flexWrap: "wrap", gap: "6px", marginTop: "8px", alignItems: "center" }}>
          <span style={{
            fontSize: "10px", fontWeight: 700, color: c.color, background: c.bg,
            padding: "2px 8px", borderRadius: "20px",
            letterSpacing: "0.04em", textTransform: "uppercase",
          }}>
            {c.label}
          </span>
          <span style={{ fontSize: "11px", color: C.ink500, fontWeight: 500 }}>
            {ev.usuario_nombre}
          </span>
          {datos && Object.keys(datos).length > 0 && (
            <DetallesExtra datos={datos} tipo={ev.tipo_evento} />
          )}
        </div>
      </div>
    </div>
  );
}

function DetallesExtra({ datos, tipo }: { datos: Record<string, unknown>; tipo: string }) {
  // Solo muestro keys útiles según el tipo para evitar ruido
  const chips: string[] = [];

  if (tipo.startsWith("PAGO")) {
    if (datos.monto != null) chips.push(`$${datos.monto}`);
    if (datos.metodo_pago)   chips.push(String(datos.metodo_pago));
    if (datos.forma_pago)    chips.push(`Forma ${datos.forma_pago}`);
    if (datos.id_factura)    chips.push(`Factura #${datos.id_factura}`);
  } else if (tipo === "TAREA_TRANSICION") {
    if (datos.estado_anterior && datos.estado_nuevo) {
      chips.push(`${datos.estado_anterior} → ${datos.estado_nuevo}`);
    }
  } else if (tipo === "TAREA_ASIGNADA") {
    if (datos.tecnico_nombre) chips.push(String(datos.tecnico_nombre));
  }

  if (chips.length === 0) return null;

  return (
    <>
      {chips.map((chip, i) => (
        <span key={i} style={{
          fontSize: "10px", fontWeight: 600, color: C.ink700, background: C.sunken,
          padding: "2px 7px", borderRadius: "4px",
        }}>
          {chip}
        </span>
      ))}
    </>
  );
}

function Estado({ mensaje, tono = "normal" }: { mensaje: string; tono?: "normal" | "error" }) {
  return (
    <p style={{
      textAlign: "center", padding: "40px 12px",
      color: tono === "error" ? "#dc2626" : C.ink400,
      fontSize: "13px", fontWeight: 500,
    }}>
      {mensaje}
    </p>
  );
}

// ── Estilos ───────────────────────────────────────────────────────────────────

const overlay: React.CSSProperties = {
  position: "fixed", inset: 0,
  background: "rgba(15,23,42,0.5)",
  display: "flex", alignItems: "center", justifyContent: "center",
  zIndex: 1100, padding: "20px",
};

const modal: React.CSSProperties = {
  background: C.surface,
  borderRadius: "14px",
  width: "640px", maxWidth: "100%",
  maxHeight: "90vh",
  display: "flex", flexDirection: "column",
  boxShadow: "0 24px 60px rgba(15,23,42,0.25)",
  overflow: "hidden",
};

const header: React.CSSProperties = {
  display: "flex", justifyContent: "space-between", alignItems: "flex-start",
  padding: "18px 22px 16px",
  borderBottom: `1px solid ${C.border}`,
  flexShrink: 0,
};

const closeBtn: React.CSSProperties = {
  background: "none", border: "none", cursor: "pointer",
  fontSize: "16px", color: C.ink400, padding: "4px 8px", lineHeight: 1,
};

const body: React.CSSProperties = {
  overflowY: "auto",
  padding: "16px 22px 24px",
  background: C.spine,
};

const dayLabel: React.CSSProperties = {
  fontSize: "11px", fontWeight: 700, color: C.ink500,
  textTransform: "uppercase", letterSpacing: "0.08em",
  marginBottom: "10px",
  paddingLeft: "2px",
};
