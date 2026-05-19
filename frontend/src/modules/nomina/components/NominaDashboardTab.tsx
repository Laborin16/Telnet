import { useDashboardNomina } from "../hooks/useNomina";


export function NominaDashboardTab() {
  const { data: dash, isLoading } = useDashboardNomina();

  if (isLoading || !dash) {
    return <p style={{ color: "#64748b", padding: "24px" }}>Cargando dashboard…</p>;
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: "18px" }}>
      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: "12px" }}>
        <Card label="Costo semanal" value={fmtMoney(dash.costo_semanal)} color="#0f172a" accent="#2563eb" />
        <Card label="Empleados en nómina" value={String(dash.empleados_en_nomina)} color="#0f172a" accent="#16a34a" />
        <Card label="Préstamos activos" value={String(dash.prestamos_activos)} color="#0f172a" accent="#7c3aed" />
        <Card label="Saldo de préstamos" value={fmtMoney(dash.monto_prestamos_pendiente)} color="#0f172a" accent="#ea580c" />
      </div>

      <div style={{ background: "white", border: "1px solid #e2e8f0", borderRadius: "10px", padding: "16px 18px" }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "10px" }}>
          <h3 style={{ margin: 0, fontSize: "14px", fontWeight: 700, color: "#0f172a" }}>Costo por área</h3>
          <span style={{ fontSize: "11px", color: "#94a3b8" }}>
            {dash.periodo_actual_id ? "Período actual" : "Sin período creado esta semana"}
          </span>
        </div>
        {dash.costo_por_area.length === 0 ? (
          <p style={{ margin: 0, fontSize: "13px", color: "#94a3b8" }}>No hay datos del período actual.</p>
        ) : (
          <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "13px" }}>
            <thead>
              <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0" }}>
                <th style={th}>Área</th>
                <th style={{ ...th, textAlign: "right" }}>Empleados</th>
                <th style={{ ...th, textAlign: "right" }}>Total</th>
              </tr>
            </thead>
            <tbody>
              {dash.costo_por_area.map(area => (
                <tr key={area.area} style={{ borderBottom: "1px solid #f1f5f9" }}>
                  <td style={td}>{area.area}</td>
                  <td style={{ ...td, textAlign: "right" }}>{area.empleados}</td>
                  <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#0f172a" }}>{fmtMoney(area.total)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}


function Card({ label, value, color, accent }: { label: string; value: string; color: string; accent: string }) {
  return (
    <div style={{
      background: "white", border: "1px solid #e2e8f0", borderRadius: "10px",
      padding: "14px 16px", borderLeft: `3px solid ${accent}`,
    }}>
      <p style={{ margin: 0, fontSize: "11px", fontWeight: 600, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.04em" }}>
        {label}
      </p>
      <p style={{ margin: "4px 0 0", fontSize: "22px", fontWeight: 700, color }}>{value}</p>
    </div>
  );
}


function fmtMoney(n: number): string {
  return `$${n.toLocaleString("es-MX", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

const th: React.CSSProperties = {
  padding: "8px 10px", textAlign: "left", fontSize: "11px",
  fontWeight: 700, color: "#475569", textTransform: "uppercase", letterSpacing: "0.04em",
};
const td: React.CSSProperties = { padding: "10px", color: "#334155" };
