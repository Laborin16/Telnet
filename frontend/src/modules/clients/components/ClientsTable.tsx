import type { AlertaCorte, ClientItem } from "../../../core/types/client";
import { ClientStatusBadge } from "./ClientStatusBadge";

const alertaColor: Record<string, string> = {
  normal: "#16a34a", critico: "#dc2626", pendiente: "#d97706", suspendido: "#64748b",
};

function FechaCorteCell({ fecha, alerta }: { fecha: string | null; alerta: AlertaCorte | null }) {
  if (!fecha) return <span style={{ color: "#94a3b8" }}>—</span>;
  const formatted = new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", { day: "2-digit", month: "short", year: "numeric" });
  const color = alerta ? (alertaColor[alerta] ?? "#1e293b") : "#1e293b";
  return <span style={{ color, fontWeight: 600 }}>{formatted}</span>;
}

interface Props {
  clients: ClientItem[];
  onSelect: (id: number) => void;
}

export function ClientsTable({ clients, onSelect }: Props) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f1f5f9", textAlign: "left" }}>
            <th style={th}>ID</th>
            <th style={th}>Nombre</th>
            <th style={th}>Plan</th>
            <th style={th}>Zona</th>
            <th style={th}>Estado</th>
            <th style={th}>Facturas</th>
            <th style={th}>Fecha Corte</th>
            <th style={th}>Saldo</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={td}>{client.id_servicio}</td>
              <td style={td}>{client.nombre}</td>
              <td style={td}>{client.plan_internet?.nombre ?? "—"}</td>
              <td style={td}>{client.zona?.nombre ?? "—"}</td>
              <td style={td}><ClientStatusBadge estado={client.estado} /></td>
              <td style={td}>{client.estado_facturas}</td>
              <td style={td}>
                <FechaCorteCell fecha={client.fecha_corte} alerta={client.alerta_corte} />
              </td>
              <td style={td}>${client.saldo}</td>
              <td style={td}>
                <button
                  onClick={() => onSelect(client.id_servicio)}
                  style={verBtn}
                >
                  Ver
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = { padding: "10px 16px", fontWeight: 600, fontSize: "13px", color: "#475569" };
const td: React.CSSProperties = { padding: "10px 16px", color: "#1e293b" };
const verBtn: React.CSSProperties = {
  padding: "4px 10px", borderRadius: "6px",
  border: "1px solid #e2e8f0", backgroundColor: "white",
  color: "#1e40af", fontSize: "12px", cursor: "pointer", fontWeight: 600,
};