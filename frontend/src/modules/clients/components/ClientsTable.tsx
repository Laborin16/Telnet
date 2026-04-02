import type { ClientItem } from "../../../core/types/client";
import { ClientStatusBadge } from "./ClientStatusBadge";
import { AlertaCorteCell } from "./AlertaCorteCell";

interface Props {
  clients: ClientItem[];
}

export function ClientsTable({ clients }: Props) {
  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", borderCollapse: "collapse", fontSize: "14px" }}>
        <thead>
          <tr style={{ backgroundColor: "#f1f5f9", textAlign: "center" }}>
            <th style={th}>ID</th>
            <th style={th}>Nombre</th>
            <th style={th}>Plan</th>
            <th style={th}>Zona</th>
            <th style={th}>Estado</th>
            <th style={th}>Facturas</th>
            <th style={th}>Fecha Corte</th>
            <th style={th}>Saldo</th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => (
            <tr key={client.id_servicio} style={{ borderBottom: "1px solid #e2e8f0" }}>
              <td style={td}>{client.id_servicio}</td>
              <td style={td}>{client.nombre}</td>
              <td style={td}>{client.plan_internet?.nombre ?? "—"}</td>
              <td style={td}>{client.zona?.nombre ?? "—"}</td>
              <td style={td}>
                <ClientStatusBadge estado={client.estado} />
              </td>
              <td style={td}>{client.estado_facturas}</td>
              <td style={td}>
                <AlertaCorteCell
                  dias={client.dias_para_corte}
                  alerta={client.alerta_corte}
                />
              </td>
              <td style={td}>${client.saldo}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "10px 16px",
  fontWeight: 600,
  fontSize: "13px",
  color: "#475569",
};

const td: React.CSSProperties = {
  padding: "10px 16px",
  color: "#1e293b",
};