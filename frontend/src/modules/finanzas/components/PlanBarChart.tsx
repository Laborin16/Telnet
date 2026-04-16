import { BarChart, Bar, XAxis, YAxis, Tooltip, Cell } from "recharts";

interface Item {
  nombre: string;
  count: number;
}

interface Props {
  data: Item[];
  title: string;
  color?: string;
}

export function PlanBarChart({ data, title, color = "#1e40af" }: Props) {
  if (data.length === 0) return null;

  const height = data.length * 38 + 40;

  return (
    <div style={card}>
      <p style={cardTitle}>{title}</p>
      <BarChart
        layout="vertical"
        width={320}
        height={height}
        data={data}
        margin={{ top: 0, right: 24, left: 0, bottom: 0 }}
      >
        <XAxis type="number" tick={{ fontSize: 11, fill: "#94a3b8" }} axisLine={false} tickLine={false} />
        <YAxis
          type="category"
          dataKey="nombre"
          width={120}
          tick={{ fontSize: 12, fill: "#475569" }}
          axisLine={false}
          tickLine={false}
        />
        <Tooltip
          formatter={((value: number) => [`${value} clientes`, ""]) as any}
          contentStyle={{ fontSize: "12px", borderRadius: "6px", border: "1px solid #e2e8f0" }}
        />
        <Bar dataKey="count" radius={[0, 4, 4, 0]}>
          {data.map((_, i) => (
            <Cell key={i} fill={i === 0 ? color : "#93c5fd"} />
          ))}
        </Bar>
      </BarChart>
    </div>
  );
}

const card: React.CSSProperties = {
  backgroundColor: "white",
  borderRadius: "10px",
  border: "1px solid #e2e8f0",
  padding: "20px",
  flex: 1,
  overflow: "hidden",
};

const cardTitle: React.CSSProperties = {
  fontSize: "13px",
  fontWeight: 700,
  color: "#64748b",
  marginBottom: "16px",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
};
