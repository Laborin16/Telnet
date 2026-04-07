import { PieChart, Pie, Cell, Tooltip } from "recharts";

const COLORS: Record<string, string> = {
  normal: "#16a34a",
  critico: "#dc2626",
  pendiente: "#d97706",
  suspendido: "#64748b",
};

const LABELS: Record<string, string> = {
  normal: "Normal",
  critico: "Crítico",
  pendiente: "Pendiente de Pago",
  suspendido: "Suspendido",
};

interface Props {
  breakdown: { normal: number; critico: number; pendiente: number; suspendido: number };
  totalActivos: number;
}

export function AlertaDonutChart({ breakdown, totalActivos }: Props) {
  const data = (Object.keys(breakdown) as (keyof typeof breakdown)[])
    .map((key) => ({ name: key, value: breakdown[key] }))
    .filter((d) => d.value > 0);

  const pct = (n: number) => totalActivos > 0 ? `${Math.round((n / totalActivos) * 100)}%` : "0%";

  return (
    <div style={card}>
      <p style={title}>Alerta de Corte <span style={{ fontWeight: 400, textTransform: "none", letterSpacing: 0 }}>(clientes activos)</span></p>
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
            <Tooltip formatter={(value) => [`${value} clientes`, ""]} />
          </PieChart>
          <div style={{
            position: "absolute", top: "50%", left: "50%",
            transform: "translate(-50%, -50%)",
            textAlign: "center", pointerEvents: "none",
          }}>
            <div style={{ fontSize: "22px", fontWeight: 700, color: "#1e293b" }}>{totalActivos}</div>
            <div style={{ fontSize: "10px", color: "#94a3b8", textTransform: "uppercase" }}>Activos</div>
          </div>
        </div>

        <div style={{ display: "flex", flexDirection: "column", gap: "6px", width: "100%" }}>
          {(["critico", "pendiente", "suspendido", "normal"] as const).map((key) => (
            <div key={key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <div style={{ display: "flex", alignItems: "center", gap: "6px" }}>
                <span style={{ width: "10px", height: "10px", borderRadius: "50%", backgroundColor: COLORS[key], display: "inline-block" }} />
                <span style={{ fontSize: "13px", color: "#475569" }}>{LABELS[key]}</span>
              </div>
              <span style={{ fontSize: "13px", fontWeight: 600, color: "#1e293b" }}>
                {breakdown[key]} <span style={{ color: "#94a3b8", fontWeight: 400 }}>({pct(breakdown[key])})</span>
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
