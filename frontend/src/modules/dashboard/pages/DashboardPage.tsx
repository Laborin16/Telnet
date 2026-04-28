import { useState } from "react";
import { useDashboardStats } from "../../finanzas/hooks/useDashboardStats";
import { useMetodosPagoStats } from "../../finanzas/hooks/useMetodosPagoStats";
import { KPICard } from "../../finanzas/components/KPICard";
import { PlanBarChart } from "../../finanzas/components/PlanBarChart";
import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

const fmt = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

function pct(part: number, total: number) {
  if (total === 0) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

interface DashboardPageProps {
  onNavigateToClients: (filter: { plan?: string; zona?: string }) => void;
}

export function DashboardPage({ onNavigateToClients }: DashboardPageProps) {
  const [dateFrom, setDateFrom] = useState<string>("");
  const [dateTo, setDateTo] = useState<string>("");

  const stats = useDashboardStats(dateFrom || null, dateTo || null);
  const metodos = useMetodosPagoStats("", dateFrom || null, dateTo || null);

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
        <KPICard title="Activos" value={stats.activos} subtitle={`${pct(stats.activos, stats.total)} del total`} accentColor="#16a34a" />
        <KPICard title="Suspendidos" value={stats.suspendidos} subtitle={`${pct(stats.suspendidos, stats.total)} del total`} accentColor="#d97706" />
        <KPICard title="Cancelados" value={stats.cancelados} subtitle={`${pct(stats.cancelados, stats.total)} del total`} accentColor="#dc2626" />
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

      <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
        <PlanBarChart data={stats.planBreakdown} title="Clientes por Plan" onBarClick={(nombre) => onNavigateToClients({ plan: nombre })} />
        <PlanBarChart data={stats.zonaBreakdown} title="Clientes por Zona" color="#0891b2" onBarClick={(nombre) => onNavigateToClients({ zona: nombre })} />
      </div>

      {/* Gráficas de métodos de pago */}
      <div>
        <p style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em", margin: "0 0 10px 0" }}>
          Métodos de pago
        </p>
        <div style={{ display: "flex", gap: "16px", flexWrap: "wrap" }}>
          <MetodoPagoCard
            title="Efectivo"
            color="#16a34a"
            data={[{ nombre: "Efectivo", monto: metodos.efectivo.monto, count: metodos.efectivo.count }]}
          />
          <MetodoPagoCard
            title="Transferencia"
            color="#2563eb"
            data={metodos.transferencia}
          />
          <MetodoPagoCard
            title="Depósito"
            color="#7c3aed"
            data={metodos.deposito}
          />
        </div>
      </div>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  padding: "6px 10px", borderRadius: "6px", border: "1px solid #e2e8f0",
  fontSize: "13px", color: "#1e293b", outline: "none",
};

const COLORS_ALT = ["#93c5fd", "#a5b4fc", "#86efac", "#fcd34d"];

function MetodoPagoCard({ title, data, color }: { title: string; data: { nombre: string; monto: number; count: number }[]; color: string }) {
  const totalMonto = data.reduce((s, d) => s + d.monto, 0);
  const totalCount = data.reduce((s, d) => s + d.count, 0);
  const hasData = totalCount > 0;

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const tooltipFormatter: any = (value: number, _: string, props: { payload?: { count?: number } }) =>
    [`${fmt.format(value)} · ${props.payload?.count ?? 0} pagos`, ""];

  return (
    <div style={{ backgroundColor: "white", borderRadius: "10px", border: "1px solid #e2e8f0", padding: "20px", flex: 1, minWidth: "220px" }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: "14px" }}>
        <p style={{ fontSize: "13px", fontWeight: 700, color: "#64748b", textTransform: "uppercase", letterSpacing: "0.05em", margin: 0 }}>{title}</p>
        <div style={{ textAlign: "right" }}>
          <div style={{ fontSize: "18px", fontWeight: 700, color }}>{fmt.format(totalMonto)}</div>
          <div style={{ fontSize: "11px", color: "#94a3b8" }}>{totalCount} pago{totalCount !== 1 ? "s" : ""}</div>
        </div>
      </div>

      {!hasData && (
        <p style={{ fontSize: "12px", color: "#94a3b8", margin: 0 }}>Sin pagos registrados</p>
      )}

      {hasData && (
        <BarChart
          layout="vertical"
          width={280}
          height={data.length * 36 + 20}
          data={data}
          margin={{ top: 0, right: 50, left: 0, bottom: 0 }}
        >
          <XAxis type="number" hide />
          <YAxis
            type="category"
            dataKey="nombre"
            width={130}
            tick={{ fontSize: 11, fill: "#475569" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            formatter={tooltipFormatter}
            contentStyle={{ fontSize: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
          />
          <Bar dataKey="monto" radius={[0, 4, 4, 0]}>
            {data.map((_, i) => (
              <Cell key={i} fill={i === 0 ? color : COLORS_ALT[i % COLORS_ALT.length]} />
            ))}
          </Bar>
        </BarChart>
      )}
    </div>
  );
}
