import { useState } from "react";
import { useDashboardStats } from "../../finanzas/hooks/useDashboardStats";
import { KPICard } from "../../finanzas/components/KPICard";
import { StatusDonutChart } from "../../finanzas/components/StatusDonutChart";
import { AlertaDonutChart } from "../../finanzas/components/AlertaDonutChart";
import { PlanBarChart } from "../../finanzas/components/PlanBarChart";
import { WhatsAppTestPanel } from "../../finanzas/components/WhatsAppTestPanel";

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function pct(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function DashboardPage() {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const stats = useDashboardStats(dateFrom || null, dateTo || null);

  if (stats.isLoading) return <p style={{ color: "#64748b", padding: "16px" }}>Cargando datos...</p>;
  if (stats.isError) return <p style={{ color: "#dc2626", padding: "16px" }}>Error al cargar los datos.</p>;

  const hasPeriod = dateFrom || dateTo;
  const periodLabel = hasPeriod
    ? `${dateFrom || "—"} → ${dateTo || "—"}`
    : "Histórico completo";

  const neto = stats.periodStats.crecimientoNeto;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "20px" }}>

      {/* Filtro de periodo */}
      <div style={{ display: "flex", alignItems: "center", gap: "12px", flexWrap: "wrap" }}>
        <span style={{ fontSize: "13px", fontWeight: 600, color: "#64748b" }}>Periodo:</span>
        <input type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} style={inputStyle} />
        <span style={{ color: "#94a3b8", fontSize: "13px" }}>→</span>
        <input type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} style={inputStyle} />
        {hasPeriod && (
          <button
            onClick={() => { setDateFrom(""); setDateTo(""); }}
            style={{ padding: "6px 12px", borderRadius: "6px", border: "1px solid #e2e8f0", background: "white", fontSize: "13px", color: "#64748b", cursor: "pointer" }}
          >
            Limpiar
          </button>
        )}
        <span style={{ fontSize: "12px", color: "#94a3b8" }}>{periodLabel}</span>
      </div>

      {/* KPIs de estado */}
      <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
        <KPICard title="Activos" value={stats.activos} subtitle={`${pct(stats.activos, stats.total)} del total · MRR ${fmt.format(stats.mrrActivo)}`} accentColor="#16a34a" />
        <KPICard title="Suspendidos" value={stats.suspendidos} subtitle={`${pct(stats.suspendidos, stats.total)} del total · MRR en riesgo ${fmt.format(stats.mrrSuspendido)}`} accentColor="#d97706" />
        <KPICard title="Cancelados" value={stats.cancelados} subtitle={`${pct(stats.cancelados, stats.total)} del total`} accentColor="#dc2626" />
        <KPICard
          title="Riesgo de Corte"
          value={stats.riesgoCorte.critico + stats.riesgoCorte.pendiente}
          subtitle="Clientes activos con pago pendiente o crítico"
          subMetrics={[
            { label: "Crítico", value: stats.riesgoCorte.critico },
            { label: "Pendiente", value: stats.riesgoCorte.pendiente },
          ]}
          accentColor="#7f1d1d"
          valueColor="#dc2626"
        />
      </div>

      {/* KPIs de periodo */}
      <div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" }}>
          Movimientos del periodo
        </p>
        <div style={{ display: "flex", gap: "12px", flexWrap: "wrap" }}>
          <KPICard title="Nuevas Instalaciones" value={stats.periodStats.nuevasInstalaciones} accentColor="#1e40af" />
          <KPICard title="Cancelaciones" value={stats.periodStats.cancelaciones} accentColor="#dc2626" />
          <KPICard
            title="Crecimiento Neto"
            value={neto >= 0 ? `+${neto}` : `${neto}`}
            subtitle={neto >= 0 ? "Crecimiento positivo" : "Pérdida neta de clientes"}
            accentColor={neto >= 0 ? "#16a34a" : "#dc2626"}
            valueColor={neto >= 0 ? "#16a34a" : "#dc2626"}
          />
        </div>
      </div>

      {/* Gráficas */}
      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <StatusDonutChart activos={stats.activos} suspendidos={stats.suspendidos} cancelados={stats.cancelados} total={stats.total} />
        <AlertaDonutChart breakdown={stats.alertaBreakdown} totalActivos={stats.activos} />
      </div>

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <PlanBarChart data={stats.planBreakdown} title="Clientes por Plan" />
        <PlanBarChart data={stats.zonaBreakdown} title="Clientes por Zona" color="#0891b2" />
      </div>

      <WhatsAppTestPanel />
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0",
  fontSize: "13px", color: "#1e293b", outline: "none",
};
