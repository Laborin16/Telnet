import { useState, useMemo } from "react";
import { useWeeklyInvoices } from "../hooks/useWeeklyInvoices";
import { useDailyInvoices, useToggleVerificacion } from "../hooks/useDailyInvoices";
import { KPICard } from "../components/KPICard";

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

interface WeekOption {
  monday: string;
  label: string;
  weekNum: number;
  year: number;
}

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
    const sun = new Date(d);
    sun.setDate(sun.getDate() + 6);
    options.push({
      monday: toISODate(d),
      label: `Sem. ${weekNum}  ·  ${formatShort(d)} – ${formatShort(sun)} ${year}`,
      weekNum,
      year,
    });
    d = new Date(d);
    d.setDate(d.getDate() + 7);
  }

  return options.reverse();
}

export function FinanzasPage() {
  const [viewMode, setViewMode] = useState<"semana" | "dia">("semana");
  const [weekStart, setWeekStart] = useState<string>(currentMonday);
  const [selectedDate, setSelectedDate] = useState<string>(today);

  const weekOptions = useMemo(() => buildWeekOptions(), []);

  const { data: weekData, isLoading: weekLoading, isError: weekError } = useWeeklyInvoices(weekStart);
  const { data: dayData, isLoading: dayLoading, isError: dayError } = useDailyInvoices(selectedDate);
  const { mutate: toggleVerificacion, isPending: isToggling } = useToggleVerificacion(selectedDate);

  const isCurrentWeek = weekStart === currentMonday;

  const currentIdx = useMemo(
    () => weekOptions.findIndex((w) => w.monday === weekStart),
    [weekOptions, weekStart]
  );

  const goToPrev = () => {
    if (currentIdx < weekOptions.length - 1) setWeekStart(weekOptions[currentIdx + 1].monday);
  };

  const goToNext = () => {
    if (currentIdx > 0) setWeekStart(weekOptions[currentIdx - 1].monday);
  };

  // Weekly KPI derivations
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

  // Daily KPI derivations
  const dayKPIs = useMemo(() => {
    const items = dayData?.lista_clientes ?? [];
    return {
      verificados: items.filter((i) => i.verificado).length,
      pendientes: items.filter((i) => !i.verificado).length,
    };
  }, [dayData]);

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Toggle vista */}
      <div style={{ display: "flex", gap: "0", border: "1px solid #e2e8f0", borderRadius: "8px", overflow: "hidden", width: "fit-content" }}>
        {(["semana", "dia"] as const).map((mode) => (
          <button
            key={mode}
            onClick={() => setViewMode(mode)}
            style={{
              padding: "6px 18px",
              fontSize: "13px",
              fontWeight: 600,
              border: "none",
              cursor: "pointer",
              backgroundColor: viewMode === mode ? "#1e40af" : "#f8fafc",
              color: viewMode === mode ? "#fff" : "#64748b",
              transition: "background 0.15s",
            }}
          >
            {mode === "semana" ? "Vista semanal" : "Vista diaria"}
          </button>
        ))}
      </div>

      {/* Selector de semana */}
      {viewMode === "semana" && (
        <div style={{ display: "flex", alignItems: "center", gap: "8px", flexWrap: "wrap" }}>
          <button onClick={goToPrev} disabled={weekStart === weekOptions[weekOptions.length - 1]?.monday} style={navBtn} title="Semana anterior">‹</button>

          <select
            value={weekStart}
            onChange={(e) => setWeekStart(e.target.value)}
            style={{
              fontSize: "13px", fontWeight: 600, color: "#1e293b",
              border: "1px solid #e2e8f0", borderRadius: "8px",
              padding: "6px 12px", backgroundColor: "#f8fafc",
              cursor: "pointer", minWidth: "260px",
            }}
          >
            {weekOptions.map((w) => (
              <option key={w.monday} value={w.monday}>
                {w.monday === currentMonday ? `★ ${w.label}` : w.label}
              </option>
            ))}
          </select>

          <button onClick={goToNext} disabled={isCurrentWeek} style={{ ...navBtn, opacity: isCurrentWeek ? 0.35 : 1, cursor: isCurrentWeek ? "not-allowed" : "pointer" }} title="Semana siguiente">›</button>

          {weekData && (
            <span style={{ fontSize: "12px", color: "#64748b" }}>
              {formatFull(weekData.semana_inicio)} → {formatFull(weekData.semana_fin)}
            </span>
          )}
          {isCurrentWeek && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", backgroundColor: "#f0fdf4", padding: "2px 10px", borderRadius: "20px" }}>
              Esta semana
            </span>
          )}
        </div>
      )}

      {/* Selector de día */}
      {viewMode === "dia" && (
        <div style={{ display: "flex", alignItems: "center", gap: "10px" }}>
          <span style={{ fontSize: "13px", color: "#64748b" }}>Fecha:</span>
          <input
            type="date"
            value={selectedDate}
            max={today}
            onChange={(e) => setSelectedDate(e.target.value)}
            style={{
              fontSize: "13px", fontWeight: 600, color: "#1e293b",
              border: "1px solid #e2e8f0", borderRadius: "8px",
              padding: "6px 12px", backgroundColor: "#f8fafc", cursor: "pointer",
            }}
          />
          {selectedDate === today && (
            <span style={{ fontSize: "11px", fontWeight: 700, color: "#16a34a", backgroundColor: "#f0fdf4", padding: "2px 10px", borderRadius: "20px" }}>
              Hoy
            </span>
          )}
        </div>
      )}

      {/* ── VISTA SEMANAL ── */}
      {viewMode === "semana" && (
        <>
          {weekLoading && <p style={{ color: "#64748b" }}>Cargando cobros...</p>}
          {weekError && <p style={{ color: "#dc2626" }}>Error al cargar los cobros.</p>}
          {weekData && (
            <>
              <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
                <KPICard title="Cobros realizados" value={weekKPIs.cobrosRealizados} accentColor="#16a34a" valueColor="#16a34a" />
                <KPICard
                  title="Cobrado"
                  value={fmt.format(weekData.total_pagado)}
                  subtitle={weekData.total_monto > 0 ? `${Math.round((weekData.total_pagado / weekData.total_monto) * 100)}% del total` : ""}
                  accentColor="#16a34a" valueColor="#16a34a"
                />
                <KPICard title="Cobros pendientes" value={weekKPIs.cobrosPendientes} accentColor="#d97706" valueColor="#d97706" />
                <KPICard
                  title="Monto total"
                  value={fmt.format(weekData.total_monto)}
                  subtitle={`Mensualidades: ${fmt.format(weekKPIs.montoMensualidades)} · Instalaciones: ${fmt.format(weekKPIs.montoInstalaciones)}`}
                  accentColor="#1e40af"
                />
                <KPICard title="Por cobrar" value={fmt.format(weekData.total_pendiente)} accentColor="#d97706" valueColor="#d97706" />
              </div>

              <div>
                <p style={sectionLabel}>Lista de cobros ({weekData.count})</p>
                <div style={{ overflowX: "auto" }}>
                  <table style={tableStyle}>
                    <thead>
                      <tr style={{ backgroundColor: "#f1f5f9" }}>
                        <th style={th}>Folio</th><th style={th}>Cliente</th><th style={th}>Teléfono</th>
                        <th style={th}>Tipo</th><th style={th}>Vencimiento</th><th style={th}>Total</th><th style={th}>Estado</th>
                      </tr>
                    </thead>
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

      {/* ── VISTA DIARIA ── */}
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
                    <thead>
                      <tr style={{ backgroundColor: "#f1f5f9" }}>
                        <th style={th}>Folio</th><th style={th}>Cliente</th><th style={th}>Teléfono</th>
                        <th style={th}>Tipo</th><th style={th}>Fecha de Pago</th>
                        <th style={th}>Método de Pago</th><th style={th}>Monto</th><th style={th}>Verificado</th>
                      </tr>
                    </thead>
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
                            <button
                              onClick={() => toggleVerificacion({ id_factura: item.id_factura })}
                              disabled={isToggling}
                              style={{
                                padding: "3px 12px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
                                border: "1px solid", cursor: isToggling ? "wait" : "pointer",
                                backgroundColor: item.verificado ? "#f0fdf4" : "#fff7ed",
                                color: item.verificado ? "#16a34a" : "#d97706",
                                borderColor: item.verificado ? "#bbf7d0" : "#fed7aa",
                              }}
                            >
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
    </div>
  );
}

function TipoBadge({ tipo }: { tipo: "mensualidad" | "instalacion" }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
      backgroundColor: tipo === "mensualidad" ? "#eff6ff" : "#f0fdf4",
      color: tipo === "mensualidad" ? "#1e40af" : "#16a34a",
    }}>
      {tipo === "mensualidad" ? "Mensualidad" : "Instalación"}
    </span>
  );
}

function EstadoBadge({ pagada }: { pagada: boolean }) {
  return (
    <span style={{
      padding: "2px 8px", borderRadius: "20px", fontSize: "12px", fontWeight: 600,
      backgroundColor: pagada ? "#f0fdf4" : "#fff7ed",
      color: pagada ? "#16a34a" : "#d97706",
    }}>
      {pagada ? "Pagada" : "Pendiente"}
    </span>
  );
}

function EmptyState({ text }: { text: string }) {
  return <p style={{ color: "#94a3b8", textAlign: "center", padding: "32px" }}>{text}</p>;
}

const navBtn: React.CSSProperties = {
  padding: "4px 10px", fontSize: "18px", fontWeight: 600,
  border: "1px solid #e2e8f0", borderRadius: "8px",
  backgroundColor: "#f8fafc", color: "#374151", cursor: "pointer", lineHeight: 1,
};

const tableStyle: React.CSSProperties = { width: "100%", borderCollapse: "collapse", fontSize: "14px" };
const sectionLabel: React.CSSProperties = { fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" };
const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600, fontSize: "13px", color: "#475569", textAlign: "left" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#1e293b", textAlign: "left" };
