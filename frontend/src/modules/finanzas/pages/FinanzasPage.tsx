import { useState, useMemo, useRef, useEffect } from "react";
import { useDebounce } from "../../../shared/hooks/useDebounce";
import { useWeeklyInvoices } from "../hooks/useWeeklyInvoices";
import { useDailyInvoices, useToggleVerificacion } from "../hooks/useDailyInvoices";
import { useAlertasCobranza, useHistorialPagos } from "../hooks/useCobranza";
import type { ClienteAlerta } from "../hooks/useCobranza";
import { KPICard } from "../components/KPICard";
import { PagoModal } from "../components/PagoModal";
import { useRecoleccion } from "../hooks/useCobranza";
import type { ItemRecoleccion } from "../hooks/useCobranza";
import { RecoleccionModal } from "../components/RecoleccionModal";
import { ObservacionCell } from "../components/ObservacionCell";
import { useObservaciones } from "../hooks/useCobranza";
import { WhatsAppModal } from "../components/WhatsAppModal";

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

const TABS_CONFIG = [
  { key: "hoy",     label: "Vencen hoy",    color: "#16a34a", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "1_a_3",   label: "1 a 3 días",    color: "#d97706", bg: "#fff7ed", border: "#fed7aa" },
  { key: "mas_de_3",label: "Más de 3 días", color: "#dc2626", bg: "#fef2f2", border: "#fca5a5" },
] as const;

type TabKey = "hoy" | "1_a_3" | "mas_de_3";

type ClientePagoType = ClienteAlerta & { id_factura: number; total: number };

export function FinanzasPage() {
  const [viewMode, setViewMode] = useState<"semana" | "dia" | "cobranza" | "recoleccion" | "historial">("semana");
  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedDateFin, setSelectedDateFin] = useState<string>(today);
  const [clientePago, setClientePago] = useState<ClientePagoType | null>(null);
  const [itemRecoleccion, setItemRecoleccion] = useState<ItemRecoleccion | null>(null);
  const [showWhatsApp, setShowWhatsApp] = useState(false);
  const [filtrosRecoleccion, setFiltrosRecoleccion] = useState<Set<string>>(new Set());
  const { data: recoleccion, isLoading: recoleccionLoading } = useRecoleccion();

  // Búsqueda vista semanal
  const [searchSemana, setSearchSemana] = useState("");
  const [filtroTipoSemana, setFiltroTipoSemana] = useState<Set<string>>(new Set());
  const dSearchSemana = useDebounce(searchSemana, 200);

  // Búsqueda vista diaria
  const [searchDia, setSearchDia] = useState("");
  const [filtroVerificadoDia, setFiltroVerificadoDia] = useState<Set<string>>(new Set());
  const dSearchDia = useDebounce(searchDia, 200);

  // Búsqueda cobranza
  const [searchCobranza, setSearchCobranza] = useState("");
  const [filtroEstadoCobranza, setFiltroEstadoCobranza] = useState<Set<string>>(new Set());
  const dSearchCobranza = useDebounce(searchCobranza, 200);

  // Búsqueda recolección
  const [searchRecoleccion, setSearchRecoleccion] = useState("");
  const dSearchRecoleccion = useDebounce(searchRecoleccion, 200);

  // Historial de pagos
  const [searchHistorial, setSearchHistorial] = useState("");
  const dSearchHistorial = useDebounce(searchHistorial, 300);
  const { data: historial, isLoading: historialLoading } = useHistorialPagos(dSearchHistorial);

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
    let items = recoleccion.items;
    if (dSearchRecoleccion) {
      const q = dSearchRecoleccion.toLowerCase();
      items = items.filter(i =>
        i.nombre.toLowerCase().includes(q) ||
        i.telefono?.toLowerCase().includes(q) ||
        String(i.id_servicio).includes(dSearchRecoleccion)
      );
    }
    if (filtrosRecoleccion.size > 0) {
      items = items.filter(i => i.estado_equipo != null && filtrosRecoleccion.has(i.estado_equipo));
    }
    if (filtrosRecoleccion.size <= 1) return items;
    return [...items].sort((a, b) => {
      const oa = ORDEN_ESTADO[a.estado_equipo ?? ""] ?? 99;
      const ob = ORDEN_ESTADO[b.estado_equipo ?? ""] ?? 99;
      if (oa !== ob) return oa - ob;
      return b.dias_vencido - a.dias_vencido;
    });
  }, [recoleccion, filtrosRecoleccion, dSearchRecoleccion]);

  const weekOptions = useMemo(() => buildWeekOptions(), []);

  const { data: weekData, isLoading: weekLoading, isError: weekError } = useWeeklyInvoices(weekStart);
  const { data: dayData, isLoading: dayLoading, isError: dayError } = useDailyInvoices(selectedDate, selectedDateFin);
  const { mutate: toggleVerificacion, isPending: isToggling } = useToggleVerificacion(selectedDate);
  const { data: alertas, isLoading: alertasLoading, isError: alertasError, refetch: refetchAlertas } = useAlertasCobranza();

  const itemsSemanaFiltrados = useMemo(() => {
    if (!weekData?.items) return [];
    return weekData.items.filter(i => {
      const q = dSearchSemana.toLowerCase();
      const matchSearch = !dSearchSemana ||
        i.cliente.nombre.toLowerCase().includes(q) ||
        String(i.id_factura).includes(dSearchSemana);
      const matchTipo = filtroTipoSemana.size === 0 || filtroTipoSemana.has(i.tipo_cobro);
      return matchSearch && matchTipo;
    });
  }, [weekData, dSearchSemana, filtroTipoSemana]);

  const itemsDiaFiltrados = useMemo(() => {
    if (!dayData?.lista_clientes) return [];
    return dayData.lista_clientes.filter(i => {
      const q = dSearchDia.toLowerCase();
      const matchSearch = !dSearchDia ||
        i.cliente.nombre.toLowerCase().includes(q) ||
        String(i.id_factura).includes(dSearchDia);
      const matchEstado = filtroVerificadoDia.size === 0 || filtroVerificadoDia.has(i.estado);
      return matchSearch && matchEstado;
    });
  }, [dayData, dSearchDia, filtroVerificadoDia]);

  // ── IDs para batch-fetch de observaciones ────────────────────────────────
  const idsSemana   = useMemo(() => weekData?.items.map(i => i.id_factura) ?? [], [weekData]);
  const idsDia      = useMemo(() => dayData?.lista_clientes.map(i => i.id_factura) ?? [], [dayData]);
  const idsCobranza = useMemo(() => {
    if (!alertas) return [];
    return (["hoy","dia_1","dia_2","dia_3","mas_de_3"] as const)
      .flatMap(k => (alertas[k]?.items ?? []).map(c => c.id_factura ?? 0))
      .filter(Boolean);
  }, [alertas]);
  const idsRecoleccion = useMemo(() => recoleccion?.items.map(i => i.id_servicio) ?? [], [recoleccion]);
  const idsHistorial   = useMemo(() => historial?.items.map(i => i.id) ?? [], [historial]);

  const { data: obsSemana }     = useObservaciones("factura",     idsSemana,      viewMode === "semana");
  const { data: obsDia }        = useObservaciones("factura",     idsDia,         viewMode === "dia");
  const { data: obsCobranza }   = useObservaciones("factura",     idsCobranza,    viewMode === "cobranza");
  const { data: obsRecoleccion }= useObservaciones("recoleccion", idsRecoleccion, viewMode === "recoleccion");
  const { data: obsHistorial }  = useObservaciones("pago",        idsHistorial,   viewMode === "historial");

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
    const pagados = items.filter((i) => i.estado === "Pagada");
    const pendientes = items.filter((i) => i.estado !== "Pagada");
    const totalMonto = items.reduce((s, i) => s + i.monto_individual, 0);
    const totalPendiente = pendientes.reduce((s, i) => s + i.monto_individual, 0);
    const montoMensualidades = items.filter((i) => i.tipo_cobro === "mensualidad").reduce((s, i) => s + i.monto_individual, 0);
    const montoInstalaciones = items.filter((i) => i.tipo_cobro === "instalacion").reduce((s, i) => s + i.monto_individual, 0);
    return {
      verificados: items.filter((i) => i.verificado).length,
      pagados: pagados.length,
      pendientes: pendientes.length,
      totalMonto,
      totalPendiente,
      montoMensualidades,
      montoInstalaciones,
    };
  }, [dayData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      <div style={{ display: "flex", gap: "0", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", width: "fit-content" }}>
          {(["semana", "dia", "cobranza", "recoleccion", "historial"] as const).map((mode) => (
            <button key={mode} onClick={() => setViewMode(mode)} style={{
              padding: "6px 18px", fontSize: "13px", fontWeight: 600, border: "none", cursor: "pointer",
              backgroundColor: viewMode === mode ? "#1e40af" : "#f8fafc",
              color: viewMode === mode ? "#fff" : "#64748b",
              borderRight: mode !== "historial" ? "1px solid #e2e8f0" : "none",
            }}>
              {mode === "semana" ? "Vista semanal" : mode === "dia" ? "Vista diaria" : mode === "cobranza" ? "Cobranza" : mode === "recoleccion" ? "Recolección" : "Historial"}
            </button>
          ))}
      </div>
        <div style={{ display: "flex", justifyContent: "flex-end" }}>
        <button
          onClick={() => setShowWhatsApp(true)}
          style={{ padding: "8px 16px", borderRadius: "8px", border: "none", backgroundColor: "#25D366", color: "white", fontSize: "13px", fontWeight: 600, cursor: "pointer" }}
        >
          WhatsApp Recordatorios
        </button>
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
        <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Desde:</span>
          <input type="date" value={selectedDate} max={today}
            onChange={(e) => {
              setSelectedDate(e.target.value);
              if (e.target.value > selectedDateFin) setSelectedDateFin(e.target.value);
            }}
            style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", backgroundColor: "#f8fafc", cursor: "pointer" }}
          />
          <span style={{ fontSize: "13px", color: "#64748b" }}>Hasta:</span>
          <input type="date" value={selectedDateFin} min={selectedDate} max={today}
            onChange={(e) => setSelectedDateFin(e.target.value)}
            style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", backgroundColor: "#f8fafc", cursor: "pointer" }}
          />
          {selectedDate === today && selectedDateFin === today && <span style={badgeGreen}>Hoy</span>}
          {selectedDate === selectedDateFin && selectedDate !== today && <span style={{ fontSize: "11px", fontWeight: 700, color: "#64748b", backgroundColor: "#f1f5f9", padding: "2px 10px", borderRadius: "20px" }}>1 día</span>}
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
                <p style={sectionLabel}>Lista de cobros ({itemsSemanaFiltrados.length})</p>
                <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, folio o ID..."
                    value={searchSemana}
                    onChange={(e) => setSearchSemana(e.target.value)}
                    style={searchInput}
                  />
                  <MultiSelect
                    options={[{ value: "mensualidad", label: "Mensualidad" }, { value: "instalacion", label: "Instalación" }]}
                    selected={filtroTipoSemana}
                    onChange={setFiltroTipoSemana}
                    placeholder="Todos los tipos"
                  />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead><tr style={{ backgroundColor: "#f1f5f9" }}>
                      <th style={th}>ID Cliente</th><th style={th}>Cliente</th><th style={th}>Folio</th><th style={th}>Teléfono</th>
                      <th style={th}>Tipo</th><th style={th}>Vencimiento</th><th style={th}>Total</th><th style={th}>Estado</th><th style={th}>Observaciones</th>
                    </tr></thead>
                    <tbody>
                      {itemsSemanaFiltrados.map((item) => (
                        <tr key={item.id_factura} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ ...td, color: "#94a3b8", fontSize: "12px" }}>{item.cliente.id_servicio ?? "—"}</td>
                          <td style={td}>{item.cliente.nombre}</td>
                          <td style={td}>#{item.id_factura}</td>
                          <td style={td}>{item.cliente.telefono || "—"}</td>
                          <td style={td}><TipoBadge tipo={item.tipo_cobro} /></td>
                          <td style={td}>{formatFull(item.fecha_vencimiento)}</td>
                          <td style={{ ...td, fontWeight: 600 }}>{fmt.format(item.total)}</td>
                          <td style={td}><EstadoBadge pagada={item.estado === "Pagada"} /></td>
                          <ObservacionCell entityType="factura" entityId={item.id_factura} value={obsSemana?.[item.id_factura]} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {itemsSemanaFiltrados.length === 0 && <EmptyState text={dSearchSemana || filtroTipoSemana.size > 0 ? "Sin resultados para esa búsqueda." : "No hay cobros esta semana."} />}
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
                <KPICard title="Cobros realizados" value={dayKPIs.pagados} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard title="Cobrado" value={fmt.format(dayData.monto_total_cobrado)} subtitle={dayKPIs.totalMonto > 0 ? `${Math.round((dayData.monto_total_cobrado / dayKPIs.totalMonto) * 100)}% del total` : ""} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard title="Cobros pendientes" value={dayKPIs.pendientes} accentColor="#d97706" valueColor="#d97706" />
                <KPICard title="Por cobrar" value={fmt.format(dayKPIs.totalPendiente)} accentColor="#d97706" valueColor="#d97706" />
                <KPICard title="Monto total" value={fmt.format(dayKPIs.totalMonto)} subtitle={`Mensualidades: ${fmt.format(dayKPIs.montoMensualidades)} · Instalaciones: ${fmt.format(dayKPIs.montoInstalaciones)}`} accentColor="#1e40af" />
                <KPICard title="Verificados Banxico" value={dayKPIs.verificados} accentColor="#6366f1" valueColor="#6366f1" />
              </div>
              <div>
                <p style={sectionLabel}>Detalle de pagos ({itemsDiaFiltrados.length})</p>
                <div style={{ display: "flex", gap: "12px", marginBottom: "12px", flexWrap: "wrap" }}>
                  <input
                    type="text"
                    placeholder="Buscar por nombre, folio o ID..."
                    value={searchDia}
                    onChange={(e) => setSearchDia(e.target.value)}
                    style={searchInput}
                  />
                  <MultiSelect
                    options={[{ value: "Pagada", label: "Pagada" }, { value: "Pendiente de Pago", label: "Pendiente de Pago" }]}
                    selected={filtroVerificadoDia}
                    onChange={setFiltroVerificadoDia}
                    placeholder="Todos los estados"
                  />
                </div>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead><tr style={{ backgroundColor: "#f1f5f9" }}>
                      <th style={th}>ID Cliente</th><th style={th}>Cliente</th><th style={th}>Folio</th><th style={th}>Teléfono</th>
                      <th style={th}>Tipo</th><th style={th}>Fecha de Pago</th><th style={th}>Método</th><th style={th}>Monto</th><th style={th}>Verificado</th><th style={th}>Observaciones</th>
                    </tr></thead>
                    <tbody>
                      {itemsDiaFiltrados.map((item) => (
                        <tr key={item.id_factura} style={{ borderBottom: "1px solid #e2e8f0" }}>
                          <td style={{ ...td, color: "#94a3b8", fontSize: "12px" }}>{item.cliente.id_servicio ?? "—"}</td>
                          <td style={td}>{item.cliente.nombre}</td>
                          <td style={td}>#{item.id_factura}</td>
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
                          <ObservacionCell entityType="factura" entityId={item.id_factura} value={obsDia?.[item.id_factura]} />
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  {itemsDiaFiltrados.length === 0 && <EmptyState text={dSearchDia || filtroVerificadoDia.size > 0 ? "Sin resultados para esa búsqueda." : "No hay pagos registrados para este día."} />}
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
          onWhatsApp={() => setShowWhatsApp(true)}
          obs={obsCobranza}
          search={dSearchCobranza}
          filtroEstado={filtroEstadoCobranza}
          onSearch={setSearchCobranza}
          onFiltroEstado={setFiltroEstadoCobranza}
          searchRaw={searchCobranza}
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
    <div style={{ display: "flex", gap: "12px", marginBottom: "4px", flexWrap: "wrap" }}>
      <input
        type="text"
        placeholder="Buscar por nombre, teléfono o ID..."
        value={searchRecoleccion}
        onChange={(e) => setSearchRecoleccion(e.target.value)}
        style={searchInput}
      />
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
              <th style={th}>ID</th>
              <th style={th}>Cliente</th>
              <th style={th}>Dirección</th>
              <th style={th}>Teléfono</th>
              <th style={th}>Técnico</th>
              <th style={th}>Días vencido</th>
              <th style={th}>Total</th>
              <th style={th}>Observaciones</th>
              <th style={th}>Acción</th>
            </tr>
          </thead>
          <tbody>
            {itemsRecoleccionFiltrados.map((item) => (
              <tr key={item.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
                <td style={{ ...td, color: "#94a3b8", fontSize: "12px" }}>{item.id_servicio}</td>
                <td style={td}>{item.nombre}</td>
                <td style={td}>{item.direccion || "—"}</td>
                <td style={td}>{item.telefono || "—"}</td>
                <td style={{ ...td, color: item.nombre_tecnico ? "#1e293b" : "#94a3b8", fontSize: item.nombre_tecnico ? "14px" : "12px" }}>
                  {item.nombre_tecnico || "Sin asignar"}
                </td>
                <td style={{ ...td, fontWeight: 700, color: "#7c3aed" }}>{item.dias_vencido} días</td>
                <td style={{ ...td, fontWeight: 600 }}>${item.total.toFixed(2)}</td>
                <ObservacionCell entityType="recoleccion" entityId={item.id_servicio} value={obsRecoleccion?.[item.id_servicio] ?? item.notas} />
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

      {viewMode === "historial" && (
        <div style={{ display: "flex", flexDirection: "column", gap: "16px" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "12px" }}>
            <div>
              <p style={sectionLabel}>Historial de pagos registrados</p>
              <span style={{ fontSize: "13px", color: "#64748b" }}>
                {historial ? `${historial.total} registro${historial.total !== 1 ? "s" : ""}` : "—"}
              </span>
            </div>
            <input
              type="text"
              placeholder="Buscar por nombre, ID de cliente o folio..."
              value={searchHistorial}
              onChange={(e) => setSearchHistorial(e.target.value)}
              style={{ ...searchInput, minWidth: "280px" }}
            />
          </div>

          {historialLoading && <p style={{ color: "#64748b" }}>Cargando historial...</p>}
          {historial && (
            <div style={{ overflowX: "auto" }}>
              <table style={tableStyle}>
                <thead>
                  <tr style={{ backgroundColor: "#f1f5f9" }}>
                    <th style={th}>ID</th>
                    <th style={th}>Cliente</th>
                    <th style={th}>Folio</th>
                    <th style={th}>Monto</th>
                    <th style={th}>Método</th>
                    <th style={th}>Fecha de pago</th>
                    <th style={th}>Fecha de registro</th>
                    <th style={th}>Observaciones</th>
                    <th style={th}>Comprobante</th>
                  </tr>
                </thead>
                <tbody>
                  {historial.items.map((p) => (
                    <tr key={p.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                      <td style={{ ...td, color: "#94a3b8", fontSize: "12px" }}>{p.id_cliente || "—"}</td>
                      <td style={td}>{p.nombre_cliente || "—"}</td>
                      <td style={td}>{p.id_factura ? `#${p.id_factura}` : "—"}</td>
                      <td style={{ ...td, fontWeight: 600 }}>{fmt.format(p.monto)}</td>
                      <td style={td}>{p.metodo_pago}</td>
                      <td style={td}>{p.fecha_pago_real ? new Date(p.fecha_pago_real).toLocaleDateString("es-MX", { dateStyle: "short" }) : "—"}</td>
                      <td style={td}>{new Date(p.fecha_registro).toLocaleString("es-MX", { dateStyle: "short", timeStyle: "short" })}</td>
                      <ObservacionCell entityType="pago" entityId={p.id} value={obsHistorial?.[p.id] ?? p.notas} />
                      <td style={td}>
                        {p.comprobante_url
                          ? <ComprobanteBtn url={`http://localhost:8000${p.comprobante_url}`} />
                          : <span style={{ color: "#94a3b8", fontSize: "12px" }}>—</span>
                        }
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {historial.items.length === 0 && (
                <EmptyState text={searchHistorial ? "Sin resultados para esa búsqueda." : "No hay pagos registrados aún."} />
              )}
            </div>
          )}
        </div>
      )}

      {clientePago && (
        <PagoModal
          cliente={clientePago}
          onClose={() => setClientePago(null)}
        />
      )}

      {showWhatsApp && <WhatsAppModal onClose={() => setShowWhatsApp(false)} />}
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
  onWhatsApp,
  obs,
  search,
  filtroEstado,
  onSearch,
  onFiltroEstado,
  searchRaw,
}: {
  alertas: import("../hooks/useCobranza").AlertasCobranza | undefined;
  isLoading: boolean;
  isError: boolean;
  onRefresh: () => void;
  onPago: (c: ClientePagoType) => void;
  onWhatsApp: () => void;
  obs?: Record<number, string>;
  search: string;
  filtroEstado: Set<string>;
  onSearch: (v: string) => void;
  onFiltroEstado: (v: Set<string>) => void;
  searchRaw: string;
}) {
  const [tabActiva, setTabActiva] = useState<TabKey>("hoy");

  if (isLoading) return <p style={{ color: "#64748b" }}>Cargando alertas de cobranza...</p>;
  if (isError) return (
    <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
      <p style={{ color: "#dc2626" }}>Error al cargar alertas.</p>
      <button onClick={onRefresh} style={{ fontSize: "12px", padding: "4px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", backgroundColor: "#f8fafc" }}>Reintentar</button>
    </div>
  );
  if (!alertas) return null;

  // Grupos virtuales: "1_a_3" fusiona dia_1 + dia_2 + dia_3
  const itemsHoy    = alertas.hoy?.items ?? [];
  const items1a3    = [...(alertas.dia_1?.items ?? []), ...(alertas.dia_2?.items ?? []), ...(alertas.dia_3?.items ?? [])];
  const itemsMas3   = alertas.mas_de_3?.items ?? [];

  const countHoy    = alertas.hoy?.count ?? 0;
  const count1a3    = (alertas.dia_1?.count ?? 0) + (alertas.dia_2?.count ?? 0) + (alertas.dia_3?.count ?? 0);
  const countMas3   = alertas.mas_de_3?.count ?? 0;

  const itemsPorTab: Record<TabKey, ClienteAlerta[]> = {
    hoy: itemsHoy,
    "1_a_3": items1a3,
    mas_de_3: itemsMas3,
  };

  const countPorTab: Record<TabKey, number> = {
    hoy: countHoy,
    "1_a_3": count1a3,
    mas_de_3: countMas3,
  };

  const filterItems = (items: ClienteAlerta[]) => items.filter(c => {
    const matchSearch = !search ||
      c.nombre.toLowerCase().includes(search.toLowerCase()) ||
      c.telefono?.toLowerCase().includes(search.toLowerCase()) ||
      String(c.id_servicio).includes(search);
    const matchEstado = filtroEstado.size === 0 || filtroEstado.has(c.estado);
    return matchSearch && matchEstado;
  });

  const tabCfg = TABS_CONFIG.find(t => t.key === tabActiva)!;
  const itemsActivos = filterItems(itemsPorTab[tabActiva]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>
      {/* Encabezado */}
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
        <div>
          <p style={sectionLabel}>Alertas de cobranza</p>
          <span style={{ fontSize: "13px", color: "#64748b" }}>
            {alertas.total} cliente{alertas.total !== 1 ? "s" : ""} con facturas vencidas
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <button onClick={onRefresh} style={{ fontSize: "12px", padding: "6px 14px", borderRadius: "8px", border: "1px solid #e2e8f0", cursor: "pointer", backgroundColor: "#f8fafc", color: "#475569", fontWeight: 600 }}>
            Actualizar
          </button>
          <button onClick={onWhatsApp} style={{ fontSize: "12px", padding: "6px 16px", borderRadius: "8px", border: "none", cursor: "pointer", backgroundColor: "#25d366", color: "white", fontWeight: 700 }}>
            WhatsApp
          </button>
        </div>
      </div>

      {/* Filtros */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <input
          type="text"
          placeholder="Buscar por nombre, teléfono o ID..."
          value={searchRaw}
          onChange={(e) => onSearch(e.target.value)}
          style={searchInput}
        />
        <MultiSelect
          options={[{ value: "Activo", label: "Activo" }, { value: "Suspendido", label: "Suspendido" }]}
          selected={filtroEstado}
          onChange={onFiltroEstado}
          placeholder="Todos los estados"
        />
      </div>

      {/* Tarjetas-tab: clic cambia la tabla activa */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        {TABS_CONFIG.map((t) => {
          const activa = tabActiva === t.key;
          const count = countPorTab[t.key as TabKey];
          return (
            <button
              key={t.key}
              onClick={() => setTabActiva(t.key as TabKey)}
              style={{
                border: `2px solid ${activa ? t.color : t.border}`,
                borderRadius: "12px",
                padding: "16px 24px",
                backgroundColor: activa ? t.color : t.bg,
                minWidth: "160px",
                cursor: "pointer",
                textAlign: "left",
                boxShadow: activa ? `0 4px 12px ${t.color}40` : "none",
                transition: "all 0.15s",
              }}
            >
              <div style={{ fontSize: "32px", fontWeight: 700, color: activa ? "white" : t.color, lineHeight: 1 }}>{count}</div>
              <div style={{ fontSize: "13px", fontWeight: 600, color: activa ? "white" : t.color, marginTop: "6px" }}>{t.label}</div>
            </button>
          );
        })}
      </div>

      {/* Tabla de la tab activa */}
      {alertas.total === 0 ? (
        <EmptyState text="No hay clientes con facturas vencidas." />
      ) : (
        <div>
          <p style={{ ...sectionLabel, color: tabCfg.color, marginBottom: "8px" }}>
            {tabCfg.label} — {itemsActivos.length} cliente{itemsActivos.length !== 1 ? "s" : ""}
          </p>
          <div style={{ overflowX: "auto" }}>
            <table style={tableStyle}>
              <thead>
                <tr style={{ backgroundColor: tabCfg.bg }}>
                  <th style={th}>ID</th>
                  <th style={th}>Cliente</th>
                  <th style={th}>Teléfono</th>
                  <th style={th}>Estado</th>
                  <th style={th}>Fecha de vencimiento</th>
                  <th style={th}>Días vencido</th>
                  <th style={th}>Observaciones</th>
                  <th style={th}>Acción</th>
                </tr>
              </thead>
              <tbody>
                {itemsActivos.map((c: ClienteAlerta) => (
                  <tr key={c.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
                    <td style={{ ...td, color: "#94a3b8", fontSize: "12px" }}>{c.id_servicio}</td>
                    <td style={td}>{c.nombre}</td>
                    <td style={td}>{c.telefono || "—"}</td>
                    <td style={td}>{c.estado}</td>
                    <td style={td}>{formatFull(c.fecha_vencimiento)}</td>
                    <td style={{ ...td, fontWeight: 700, color: tabCfg.color }}>{c.dias_vencido}</td>
                    <ObservacionCell entityType="factura" entityId={c.id_factura ?? c.id_servicio} value={obs?.[c.id_factura ?? 0]} />
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
            {itemsActivos.length === 0 && (
              <EmptyState text={search || filtroEstado.size > 0 ? "Sin resultados para esa búsqueda." : `No hay clientes en "${tabCfg.label}".`} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

function ComprobanteBtn({ url }: { url: string }) {
  const [open, setOpen] = useState(false);
  const isPdf = url.toLowerCase().endsWith(".pdf");

  if (isPdf) {
    return (
      <a href={url} target="_blank" rel="noreferrer"
        style={{ fontSize: "12px", color: "#1e40af", fontWeight: 600, textDecoration: "none" }}>
        Ver PDF
      </a>
    );
  }

  return (
    <>
      <button onClick={() => setOpen(true)}
        style={{ fontSize: "12px", padding: "3px 10px", borderRadius: "6px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#1e40af", cursor: "pointer", fontWeight: 600 }}>
        Ver imagen
      </button>
      {open && (
        <div onClick={() => setOpen(false)}
          style={{ position: "fixed", inset: 0, backgroundColor: "rgba(0,0,0,0.7)", display: "flex", alignItems: "center", justifyContent: "center", zIndex: 2000 }}>
          <div onClick={(e) => e.stopPropagation()}
            style={{ position: "relative", maxWidth: "90vw", maxHeight: "90vh", backgroundColor: "white", borderRadius: "12px", padding: "8px", boxShadow: "0 20px 60px rgba(0,0,0,0.3)" }}>
            <button onClick={() => setOpen(false)}
              style={{ position: "absolute", top: "8px", right: "8px", background: "rgba(0,0,0,0.5)", border: "none", color: "white", borderRadius: "50%", width: "28px", height: "28px", cursor: "pointer", fontSize: "14px", fontWeight: 700 }}>
              ✕
            </button>
            <img src={url} alt="Comprobante" style={{ maxWidth: "85vw", maxHeight: "85vh", borderRadius: "8px", display: "block" }} />
          </div>
        </div>
      )}
    </>
  );
}

function MultiSelect({ options, selected, onChange, placeholder }: {
  options: { value: string; label: string }[];
  selected: Set<string>;
  onChange: (v: Set<string>) => void;
  placeholder: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggle = (value: string) => {
    const next = new Set(selected);
    if (next.has(value)) next.delete(value); else next.add(value);
    onChange(next);
  };

  const label = selected.size === 0
    ? placeholder
    : options.filter(o => selected.has(o.value)).map(o => o.label).join(", ");

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        onClick={() => setOpen(p => !p)}
        style={{ ...searchSelect, display: "flex", alignItems: "center", gap: "6px", border: selected.size > 0 ? "1px solid #6366f1" : "1px solid #e2e8f0", backgroundColor: selected.size > 0 ? "#eef2ff" : "#f8fafc", color: selected.size > 0 ? "#4338ca" : "#1e293b" }}
      >
        <span style={{ flex: 1 }}>{label}</span>
        <span style={{ fontSize: "10px", color: "#94a3b8" }}>{open ? "▲" : "▼"}</span>
      </button>
      {open && (
        <div style={{ position: "absolute", top: "calc(100% + 4px)", left: 0, zIndex: 200, backgroundColor: "#fff", border: "1px solid #e2e8f0", borderRadius: "8px", boxShadow: "0 4px 12px rgba(0,0,0,0.1)", minWidth: "160px", padding: "4px 0" }}>
          {options.map(opt => (
            <label key={opt.value} style={{ display: "flex", alignItems: "center", gap: "8px", padding: "7px 14px", cursor: "pointer", fontSize: "13px", color: "#1e293b", backgroundColor: selected.has(opt.value) ? "#eef2ff" : "transparent" }}>
              <input type="checkbox" checked={selected.has(opt.value)} onChange={() => toggle(opt.value)} style={{ cursor: "pointer", accentColor: "#6366f1" }} />
              {opt.label}
            </label>
          ))}
        </div>
        
      )}
    </div>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ color: "#94a3b8", textAlign: "center", padding: "32px" }}>{text}</p>;
}

const navBtn: React.CSSProperties = { padding: "4px 10px", fontSize: "18px", fontWeight: 600, border: "1px solid #e2e8f0", borderRadius: "8px", backgroundColor: "#f8fafc", color: "#374151", cursor: "pointer", lineHeight: 1 };
const selectStyle: React.CSSProperties = { fontSize: "13px", fontWeight: 600, color: "#1e293b", border: "1px solid #e2e8f0", borderRadius: "8px", padding: "6px 12px", backgroundColor: "#f8fafc", cursor: "pointer", minWidth: "260px" };
const badgeGreen: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "#16a34a", backgroundColor: "#f0fdf4", padding: "2px 10px", borderRadius: "20px" };
const searchInput: React.CSSProperties = { fontSize: "13px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#1e293b", outline: "none", minWidth: "220px" };
const searchSelect: React.CSSProperties = { fontSize: "13px", padding: "6px 12px", borderRadius: "8px", border: "1px solid #e2e8f0", backgroundColor: "#f8fafc", color: "#1e293b", cursor: "pointer" };
const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "14px" };
const sectionLabel: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" };
const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600, fontSize: "13px", color: "#475569", textAlign: "left" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#1e293b", textAlign: "left" };