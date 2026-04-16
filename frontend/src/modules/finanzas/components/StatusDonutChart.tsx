import { PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  Activo: "#16a34a",
  Suspendido: "#d97706",
  Cancelado: "#dc2626",
};

interface Props {
  activos: number;
  suspendidos: number;
  cancelados: number;
  total: number;
}

export function StatusDonutChart({ activos, suspendidos, cancelados, total }: Props) {
  const data = [
    { name: "Activo", value: activos },
    { name: "Suspendido", value: suspendidos },
    { name: "Cancelado", value: cancelados },
  ].filter((d) => d.value > 0);

  const pct = (n: number) => total > 0 ? `${Math.round((n / total) * 100)}%` : "0%";

  return (
    <div style={card}>
      <p style={title}>Estado de Clientes</p>
      <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: "12px" }}>
        <div style={{ position: "relative" }}>
          <PieChart width={180} height={180}>
            <Pie
              data={data}
              cx={85}
              cy={85}
              innerRadius={55}
              outerRadius={80}
              dataKey="value"
              strokeWidth={2}
            >
              {data.map((entry) => (
                <Cell key={entry.name} fill={COLORS[entry.name]} />
              ))}
            </Pie>
            <Tooltip formatter={((value: number) => [`${value} clientes`, ""]) as any} />
          </PieChart>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#1e293b" }}>{total}</div>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Total</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
          {[
            { label: "Activo", value: activos },
            { label: "Suspendido", value: suspendidos },
            { label: "Cancelado", value: cancelados },
          ].map(({ label, value }) => (
            <div key={label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: COLORS[label], display: "inline-block" }} />
                <span style={{ fontSize: "13px", color: "#475569" }}>{label}</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                {value} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({pct(value)})</span>
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

const card: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  padding: "20px",
  flex: 1,
};

const title: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#64748b",
  marginBottom: "16px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
