interface SubMetric {
  label: string;
  value: string | number;
}

interface Props {
  title: string;
  value: string | number;
  subtitle?: string;
  subMetrics?: SubMetric[];
  accentColor?: string;
  valueColor?: string;
}

export function KPICard({ title, value, subtitle, subMetrics, accentColor = "#64748b", valueColor }: Props) {
  return (
    <div style={{
      backgroundColor: "white",
      borderRadius: "10px",
      border: "1px solid #e2e8f0",
      borderLeft: `4px solid ${accentColor}`,
      padding: "16px 20px",
      display: "flex",
      flexDirection: "column",
      gap: "6px",
      flex: 1,
      minWidth: "140px",
    }}>
      <span style={{ fontSize: "11px", fontWeight: 700, color: "#94a3b8", textTransform: "uppercase", letterSpacing: "0.05em" }}>
        {title}
      </span>
      <span style={{ fontSize: "28px", fontWeight: 700, color: valueColor ?? "#1e293b", lineHeight: 1.1 }}>
        {value}
      </span>
      {subtitle && (
        <span style={{ fontSize: "13px", color: "#64748b" }}>{subtitle}</span>
      )}
      {subMetrics && subMetrics.length > 0 && (
        <div style={{ display: "flex", gap: "12px", marginTop: "2px" }}>
          {subMetrics.map((m) => (
            <span key={m.label} style={{ fontSize: "12px", color: "#64748b" }}>
              <span style={{ fontWeight: 600, color: "#475569" }}>{m.label}:</span> {m.value}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
