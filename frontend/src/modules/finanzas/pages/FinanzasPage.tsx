import { useState, useMemo } from "react";
import { useWeeklyInvoices } from "../hooks/useWeeklyInvoices";
import { useDailyInvoices, useToggleVerificacion } from "../hooks/useDailyInvoices";
import { useAlertasCobranza } from "../hooks/useCobranza";
import type { ClienteAlerta } from "../hooks/useCobranza";
import { KPICard } from "../components/KPICard";
import { PagoModal } from "../components/PagoModal";
import { useRecoleccion } from "../hooks/useCobranza";
import type { ItemRecoleccion } from "../hooks/useCobranza";
import { RecoleccionModal } from "../components/RecoleccionModal";

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function getMondayOf(date: Date): Date {
  const d = new Date(date);
  const day = d.getDay();
  const diff = day === 0 ? -6 : 1 - day;
  d.setDate(d.getDate() + diff);
  d.setHours(0, 0, 0, 0);
  return d;
}

function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function _isoThursday(date: Date): Date {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const day = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - day);
  return d;
}

function getISOWeek(date: Date): number {
  const thu = _isoThursday(date);
  const yearStart = new Date(Date.UTC(thu.getUTCFullYear(), 0, 1));
  return Math.ceil((((thu.getTime() - yearStart.getTime()) / 86400000) + 1) / 7);
}

function getISOWeekYear(date: Date): number {
  return _isoThursday(date).getUTCFullYear();
}

function formatShort(date: Date): string {
  return date.toLocaleDateString("es-MX", { day: "2-digit", month: "short" });
}

function formatFull(d: string) {
  if (!d) return "—";
  return new Date(d + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
}

interface WeekOption { monday: string; label: string; weekNum: number; year: number; }

const currentMondayDate = getMondayOf(new Date());
const currentMonday = toISODate(currentMondayDate);
const today = toISODate(new Date());

function buildWeekOptions(): WeekOption[] {
  const options: WeekOption[] = [];
  const start = getMondayOf(new Date(2026, 0, 5));
  let d = new Date(start);
  while (d <= currentMondayDate) {
    const weekNum = getISOWeek(d);
    const year = getISOWeekYear(d);
    const sun = new Date(d); sun.setDate(sun.getDate() + 6);
    options.push({ monday: toISODate(d), label: `Sem. ${weekNum}  ·  ${formatShort(d)} – ${formatShort(sun)} ${year}`, weekNum, year });
    d = new Date(d); d.setDate(d.getDate() + 7);
  }
  return options.reverse();
}

const GRUPOS_CONFIG = [
  { key: "dia_1",    label: "1 día",         color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
  { key: "dia_2",    label: "2 días",        color: "#ea580c", bg: "#fff7ed", border: "#fdba74" },
  { key: "dia_3",    label: "3 días",        color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
  { key: "mas_de_3", label: "Más de 3 días", color: "#7c3aed", bg: "#f5f3ff", border: "#c4b5fd" },
] as const;

type ClientePagoType = ClienteAlerta & { id_factura: number; total: number };

export function FinanzasPage() {
  const [viewMode, setViewMode] = useState<"semana" | "dia" | "cobranza" | "recoleccion">("semana");  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [clientePago, setClientePago] = useState<ClientePagoType | null>(null);
  const [itemRecoleccion, setItemRecoleccion] = useState<ItemRecoleccion | null>(null);
  const [filtrosRecoleccion, setFiltrosRecoleccion] = useState<Set<string>>(new Set());
  const { data: recoleccion, isLoading: recoleccionLoading } = useRecoleccion();

  const toggleFiltroRecoleccion = (key: string) => {
    setFiltrosRecoleccion(prev => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const itemsRecoleccionFiltrados = useMemo(() => {
    if (!recoleccion?.items) return [];
    const ORDEN_ESTADO: Record<string, number> = {
      recuperado: 0, antena_recuperada: 1, modem_recuperado: 2, nada_recuperado: 3,
    };
    const items = filtrosRecoleccion.size === 0
      ? recoleccion.items
      : recoleccion.items.filter(i => i.estado_equipo != null && filtrosRecoleccion.has(i.estado_equipo));
    if (filtrosRecoleccion.size <= 1) return items;
    return [...items].sort((a, b) => {
      const oa = ORDEN_ESTADO[a.estado_equipo ?? ""] ?? 99;
      const ob = ORDEN_ESTADO[b.estado_equipo ?? ""] ?? 99;
      if (oa !== ob) return oa - ob;
      return b.dias_vencido - a.dias_vencido;
    });
  }, [recoleccion, filtrosRecoleccion]);

  const weekOptions = useMemo(() => buildWeekOptions(), []);

  const { data: weekData, isLoading: weekLoading, isError: weekError } = useWeeklyInvoices(weekStart);
  const { data: dayData, isLoading: dayLoading, isError: dayError } = useDailyInvoices(selectedDate);
  const { mutate: toggleVerificacion, isPending: isToggling } = useToggleVerificacion(selectedDate);
  const { data: alertas, isLoading: alertasLoading, isError: alertasError, refetch: refetchAlertas } = useAlertasCobranza();

  const isCurrentWeek = weekStart === currentMonday;
  const currentIdx = useMemo(() => weekOptions.findIndex((w) => w.monday === weekStart), [weekOptions, weekStart]);

  const goToPrev = () => { if (currentIdx < weekOptions.length - 1) setWeekStart(weekOptions[currentIdx + 1].monday); };
  const goToNext = () => { if (currentIdx > 0) setWeekStart(weekOptions[currentIdx - 1].monday); };

  const weekKPIs = useMemo(() => {
    const items = weekData?.items ?? [];
    const mens = items.filter((i) => i.tipo_cobro === "mensualidad");
    const inst = items.filter((i) => i.tipo_cobro === "instalacion");
    return {
      cobrosRealizados: items.filter((i) => i.estado === "Pagada").length,
      cobrosPendientes: items.filter((i) => i.estado !== "Pagada").length,
      montoMensualidades: mens.reduce((s, i) => s + i.total, 0),
      montoInstalaciones: inst.reduce((s, i) => s + i.total, 0),
    };
  }, [weekData]);

  const dayKPIs = useMemo(() => {
    const items = dayData?.lista_clientes ?? [];
    return { verificados: items.filter((i) => i.verificado).length, pendientes: items.filter((i) => !i.verificado).length };
  }, [dayData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <div style={{ display: "flex", gap: "0", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", width: "fit-content" }}>
          {(["semana", "dia", "cobranza", "recoleccion"] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: "6px 18px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
              backgroundColor: viewMode === mode ? "#1e40af" : "#f8fafc",
              color: viewMode === mode ? "#fff" : "#64748b",
              borderRight: mode !== "recoleccion" ? "1px solid #e2e8f0" : "none",
            }}>
              {mode === "semana" ? "Vista semanal" : mode === "dia" ? "Vista diaria" : mode === "cobranza" ? "Cobranza" : "Recolección"}
            </button>
          ))}
      </div>

      {viewMode === "semana" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={goToPrev} disabled={weekStart === weekOptions[weekOptions.length - 1]?.monday} style={navBtn}>‹</button>
          <select value={weekStart} onChange={(e) => setWeekStart(e.target.value)} style={selectStyle}>
            {weekOptions.map((w) => (
              <option key={w.monday} value={w.monday}>{w.monday === currentMonday ? ` ${w.label}` : w.label}</option>
            ))}
          </select>
          <button onClick={goToNext} disabled={isCurrentWeek} style={{ ...navBtn, opacity: isCurrentWeek ? 0.35 : 1, cursor: isCurrentWeek ? "not-allowed" : "pointer" }}>›</button>
          {weekData && <span style={{ fontSize: "12px", color: "#64748b" }}>{formatFull(weekData.semana_inicio)} → {formatFull(weekData.semana_fin)}</span>}
          {isCurrentWeek && <span style={badgeGreen}>Esta semana</span>}
        </div>
      )}

      {viewMode === "dia" && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Fecha:</span>
          <input type="date" value={selectedDate} max={today} onChange={(e) => setSelectedDate(e.target.value)}
            style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", backgroundColor: "#f8fafc", cursor: "pointer" }} />
          {selectedDate === today && <span style={badgeGreen}>Hoy</span>}
        </div>
      )}

      {viewMode === "semana" && (
        <>
          {weekLoading && <p style={{ color: "#64748b" }}>Cargando cobros...</p>}
          {weekError && <p style={{ color: "#dc2626" }}>Error al cargar los cobros.</p>}
          {weekData && (
            <>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <KPICard title="Cobros realizados" value={weekKPIs.cobrosRealizados} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard title="Cobrado" value={fmt.format(weekData.total_pagado)} subtitle={weekData.total_monto > 0 ? `${Math.round((weekData.total_pagado / weekData.total_monto) * 100)}% del total` : ""} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard title="Cobros pendientes" value={weekKPIs.cobrosPendientes} accentColor="#d97706" valueColor="#d97706" />
                <KPICard title="Monto total" value={fmt.format(weekData.total_monto)} subtitle={`Mensualidades: ${fmt.format(weekKPIs.montoMensualidades)} · Instalaciones: ${fmt.format(weekKPIs.montoInstalaciones)}`} accentColor="#1e40af" />
                <KPICard title="Por cobrar" value={fmt.format(weekData.total_pendiente)} accentColor="#d97706" valueColor="#d97706" />
              </div>
              <div>
                <p style={sectionLabel}>Lista de cobros ({weekData.count})</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead><tr style={{ backgroundColor: "#f1f5f9" }}>
                      <th style={th}>Folio</th><th style={th}>Cliente</th><th style={th}>Teléfono</th>
                      <th style={th}>Tipo</th><th style={th}>Vencimiento</th><th style={th}>Total</th><th style={th}>Estado</th>
                    </tr></thead>
                    <tbody>
                      {weekData.items.map((item) => (
                        <tr key={item.id_factura} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={td}>#{item.id_factura}</td>
                          <td style={td}>{item.cliente.nombre}</td>
                          <td style={td}>{item.cliente.telefono || "—"}</td>
                          <td style={td}><TipoBadge tipo={item.tipo_cobro} /></td>
                          <td style={td}>{formatFull(item.fecha_vencimiento)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{fmt.format(item.total)}</td>
                          <td style={td}><EstadoBadge pagada={item.estado === "Pagada"} /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {weekData.items.length === 0 && <EmptyState text="No hay cobros esta semana." />}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {viewMode === "dia" && (
        <>
          {dayLoading && <p style={{ color: "#64748b" }}>Cargando cobros del día...</p>}
          {dayError && <p style={{ color: "#dc2626" }}>Error al cargar los cobros.</p>}
          {dayData && (
            <>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <KPICard title="Pagos del día" value={dayData.numero_total_pagos} accentColor="#1e40af" />
                <KPICard title="Total cobrado" value={fmt.format(dayData.monto_total_cobrado)} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard title="Verificados" value={dayKPIs.verificados} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard title="Pendientes" value={dayKPIs.pendientes} accentColor="#d97706" valueColor="#d97706" />
              </div>
              <div>
                <p style={sectionLabel}>Detalle de pagos ({dayData.numero_total_pagos})</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead><tr style={{ backgroundColor: "#f1f5f9" }}>
                      <th style={th}>Folio</th><th style={th}>Cliente</th><th style={th}>Teléfono</th>
                      <th style={th}>Tipo</th><th style={th}>Fecha de Pago</th><th style={th}>Método</th><th style={th}>Monto</th><th style={th}>Verificado</th>
                    </tr></thead>
                    <tbody>
                      {dayData.lista_clientes.map((item) => (
                        <tr key={item.id_factura} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={td}>#{item.id_factura}</td>
                          <td style={td}>{item.cliente.nombre}</td>
                          <td style={td}>{item.cliente.telefono || "—"}</td>
                          <td style={td}><TipoBadge tipo={item.tipo_cobro} /></td>
                          <td style={td}>{formatFull(item.fecha_pago)}</td>
                          <td style={td}>{item.metodo_pago === "no_especificado" ? "—" : item.metodo_pago}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{fmt.format(item.monto_individual)}</td>
                          <td style={td}>
                            <button onClick={() => toggleVerificacion({ id_factura: item.id_factura })} disabled={isToggling} style={{
                              padding: "3px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, border: "1px solid",
                              cursor: isToggling ? "wait" : "pointer",
                              backgroundColor: item.verificado ? "#f0fdf4" : "#fff7ed",
                              color: item.verificado ? "#16a34a" : "#d97706",
                              borderColor: item.verificado ? "#bbf7d0" : "#fed7aa",
                            }}>
                              {item.verificado ? "✓ Verificado" : "Pendiente"}
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {dayData.lista_clientes.length === 0 && <EmptyState text="No hay pagos registrados para este día." />}
                </div>
              </div>
            </>
          )}
        </>
      )}

      {viewMode === "cobranza" && (
        <CobranzaAlertas
          alertas={alertas}
          isLoading={alertasLoading}
          isError={alertasError}
          onRefresh={() => refetchAlertas()}
          onPago={(c) => setClientePago(c)}
        />
      )}
      {viewMode === "recoleccion" && (
  <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <p style={sectionLabel}>Clientes en recolección</p>
        <span style={{ fontSize: "13px", color: "#64748b" }}>
          {recoleccion?.total ?? 0} cliente{recoleccion?.total !== 1 ? "s" : ""} con 7+ días vencidos
        </span>
      </div>
    </div>
    <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
      <span style={{ fontSize: "12px", color: "#94a3b8", fontWeight: 600 }}>Estado equipo:</span>
      {([
        { key: "recuperado",        label: "Todo recuperado",   color: "#16a34a" },
        { key: "antena_recuperada", label: "Antena no recuperada", color: "#2563eb" },
        { key: "modem_recuperado",  label: "Modem no recuperado",  color: "#d97706" },
        { key: "nada_recuperado",   label: "Nada recuperado",   color: "#dc2626" },
      ] as const).map(({ key, label, color }) => {
        const activo = filtrosRecoleccion.has(key);
        return (
          <button
            key={key}
            onClick={() => toggleFiltroRecoleccion(key)}
            style={{
              padding: "4px 12px", borderRadius: "20px",
              border: `1px solid ${activo ? color : "#e2e8f0"}`,
              backgroundColor: activo ? color : "white",
              color: activo ? "white" : "#475569",
              fontSize: "12px", fontWeight: activo ? 600 : 400, cursor: "pointer",
            }}
          >
            {label}
          </button>
        );
      })}
      {filtrosRecoleccion.size > 0 && (
        <button
          onClick={() => setFiltrosRecoleccion(new Set())}
          style={{ padding: "4px 12px", borderRadius: "20px", border: "1px solid #e2e8f0",
                   backgroundColor: "white", color: "#94a3b8", fontSize: "12px", cursor: "pointer" }}
        >
          Limpiar
        </button>
      )}
    </div>
    {recoleccionLoading && <p style={{ color: "#64748b" }}>Cargando...</p>}
    {recoleccion && (
      <div style={{ overflowX: "auto" }}>
        <table style={tableStyle}>
          <thead>
            <tr style={{ backgroundColor: "#f5f3ff" }}>
              <th style={th}>Cliente</th>
              <th style={th}>Dirección</th>
              <th style={th}>Teléfono</th>
              <th style={th}>Días vencido</th>
              <th style={th}>Total</th>
              <th style={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {itemsRecoleccionFiltrados.map((item) => (
              <tr key={item.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={td}>{item.nombre}</td>
                <td style={td}>{item.direccion || "—"}</td>
                <td style={td}>{item.telefono || "—"}</td>
                <td style={{ ...td, fontWeight: 700, color: "#7c3aed" }}>{item.dias_vencido} días</td>
                <td style={{ ...td, fontWeight: 600 }}>${item.total.toFixed(2)}</td>
                <td style={td}>
                  {(() => {
                    const ESTADO_CONFIG: Record<string, { label: string; bg: string }> = {
                      recuperado:        { label: "Todo recuperado",   bg: "#16a34a" },
                      antena_recuperada: { label: "Antena no recuperada", bg: "#2563eb" },
                      modem_recuperado:  { label: "Módem no recuperado",  bg: "#d97706" },
                      nada_recuperado:   { label: "Nada recuperado",   bg: "#dc2626" },
                    };
                    const cfg = item.estado_equipo ? ESTADO_CONFIG[item.estado_equipo] : null;
                    return (
                      <button
                        onClick={() => setItemRecoleccion(item)}
                        style={{
                          padding: "4px 12px", borderRadius: "6px", border: "none",
                          backgroundColor: cfg ? cfg.bg : "#7c3aed",
                          color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {cfg ? cfg.label : "Sin gestionar"}
                      </button>
                    );
                  })()}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {itemsRecoleccionFiltrados.length === 0 && (
          <EmptyState text={filtrosRecoleccion.size > 0 ? "No hay clientes con ese estado de equipo." : "No hay clientes en recolección."} />
        )}
      </div>
    )}
  </div>
)}

{itemRecoleccion && (
  <RecoleccionModal
    item={itemRecoleccion}
    onClose={() => setItemRecoleccion(null)}
  />
)}

      {clientePago && (
        <PagoModal
          cliente={clientePago}
          onClose={() => setClientePago(null)}
        />
      )}
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: "mensualidad" | "instalacion" }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: tipo === "mensualidad" ? "#eff6ff" : "#f0fdf4", color: tipo === "mensualidad" ? "#1e40af" : "#16a34a" }}>
      {tipo === "mensualidad" ? "Mensualidad" : "Instalación"}
    </span>
  );
}

function EstadoBadge({ pagada }: { pagada: boolean }) {
  return (
    <span style={{ padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600, backgroundColor: pagada ? "#f0fdf4" : "#fff7ed", color: pagada ? "#16a34a" : "#d97706" }}>
      {pagada ? "Pagado" : "Pendiente"}
    </span>
  );
}

function CobranzaAlertas({
  alertas,
  isLoading,
  isError,
  onRefresh,
  onPago,
}: {
  alertas: import("../hooks/useCobranza").AlertasCobranza | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  onPago: (c: ClientePagoType) => void;
}) {
  if (isLoading) return <p style={{ color: "#64748b" }}>Cargando alertas de cobranza...</p>;
  if (isError) return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <p style={{ color: "#dc2626" }}>Error al cargar alertas.</p>
      <button onClick={onRefresh} style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", backgroundColor: "#f8fafc" }}>Reintentar</button>
    </div>
  );
  if (!alertas) return null;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={sectionLabel}>Alertas de cobranza</p>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            {alertas.total} cliente{alertas.total !== 1 ? "s" : ""} con facturas vencidas
          </span>
        </div>
        <button onClick={onRefresh} style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", backgroundColor: "#f8fafc", color: "#475569", fontWeight: 600 }}>
          Actualizar
        </button>
      </div>

      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {GRUPOS_CONFIG.map((g) => {
          const grupo = alertas[g.key as keyof typeof alertas] as import("../hooks/useCobranza").GrupoAlerta;
          return (
            <div key={g.key} style={{ border: `1px solid ${g.border}`, borderRadius: "12px", padding: "16px 20px", backgroundColor: g.bg, minWidth: "140px" }}>
              <div style={{ fontSize: "28px", fontWeight: 700, color: g.color, lineHeight: 1 }}>{grupo.count}</div>
              <div style={{ fontSize: "12px", fontWeight: 600, color: g.color, marginTop: "4px" }}>{g.label} vencido</div>
            </div>
          );
        })}
      </div>

      {GRUPOS_CONFIG.map((g) => {
        const grupo = alertas[g.key as keyof typeof alertas] as import("../hooks/useCobranza").GrupoAlerta;
        if (grupo.count === 0) return null;
        return (
          <div key={g.key}>
            <p style={{ ...sectionLabel, color: g.color, marginBottom: "8px" }}>
              {g.label} vencido — {grupo.count} cliente{grupo.count !== 1 ? "s" : ""}
            </p>
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ backgroundColor: g.bg }}>
                    <th style={th}>Cliente</th>
                    <th style={th}>Teléfono</th>
                    <th style={th}>Estado</th>
                    <th style={th}>Fecha de corte</th>
                    <th style={th}>Días vencido</th>
                    <th style={th}>Acción</th>
                  </tr>
                </thead>
                <tbody>
                  {grupo.items.map((c: ClienteAlerta) => (
                    <tr key={c.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={td}>{c.nombre}</td>
                      <td style={td}>{c.telefono || "—"}</td>
                      <td style={td}>{c.estado}</td>
                      <td style={td}>{formatFull(c.fecha_corte)}</td>
                      <td style={{ ...td, fontWeight: 700, color: g.color }}>{c.dias_vencido}</td>
                      <td style={td}>
                        {c.id_factura ? (
                          <button
                            onClick={() => onPago(c as ClientePagoType)}
                            style={{ padding: "4px 12px", borderRadius: "6px", border: "none", backgroundColor: "#16a34a", color: "white", fontSize: "12px", fontWeight: 600, cursor: "pointer" }}
                          >
                            Cobrar
                          </button>
                        ) : <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        );
      })}

      {alertas.total === 0 && <EmptyState text="No hay clientes con facturas vencidas." />}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ color: "#94a3b8", textAlign: "center", padding: "32px" }}>{text}</p>;
}

const navBtn: React.CSSProperties = { padding: "4px 10px", fontSize: "18px", fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc", color: "#374151", cursor: "pointer", lineHeight: 1 };
const selectStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 600, color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", backgroundColor: "#f8fafc", cursor: "pointer", minWidth: "260px" };
const badgeGreen: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "#16a34a", backgroundColor: "#f0fdf4", padding: "2px 10px", borderRadius: "20px" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "14px" };
const sectionLabel: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" };
const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600, fontSize: "13px", color: "#475569", textAlign: "left" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#1e293b", textAlign: "left" };