import { useState } from "react";
import type { AlertaCorte, ClientItem } from "../../../core/types/client";
import { ClientStatusBadge } from "./ClientStatusBadge";
import { ObservacionCell } from "../../finanzas/components/ObservacionCell";

const alertaColor: Record<string, string> = {
  normal: "#16a34a", critico: "#dc2626", pendiente: "#d97706", suspendido: "#64748b",
};

function FechaCorteCell({ fecha, alerta }: { fecha: string | null; alerta: AlertaCorte | null }) {
  if (!fecha) return <span style={{ color: "#cbd5e1" }}>—</span>;
  const formatted = new Date(fecha + "T12:00:00").toLocaleDateString("es-MX", {
    day: "2-digit", month: "short", year: "numeric",
  });
  const color = alerta ? (alertaColor[alerta] ?? "#334155") : "#334155";
  return <span style={{ color, fontWeight: 600, fontSize: "12px" }}>{formatted}</span>;
}

interface Props {
  clients: ClientItem[];
  onSelect: (id: number) => void;
  obsMap?: Record<number, string>;
  recoleccionIds?: Set<number>;
}

export function ClientsTable({ clients, onSelect, obsMap, recoleccionIds }: Props) {
  const [hovered, setHovered] = useState<number | null>(null);

  if (clients.length === 0) {
    return (
      <div style={{ padding: "48px", textAlign: "center", color: "#94a3b8", fontSize: "14px" }}>
        No hay clientes que coincidan con los filtros.
      </div>
    );
  }

  return (
    <div style={{ overflowX: "auto" }}>
      <table style={{ width: "100%", minWidth: "1000px", borderCollapse: "collapse", fontSize: "13px" }}>
        <thead>
          <tr style={{ background: "#f8fafc", borderBottom: "2px solid #e2e8f0" }}>
            <th style={{ ...th, textAlign: "center" }}>#</th>
            <th style={th}>Nombre</th>
            <th style={th}>Plan</th>
            <th style={th}>Zona</th>
            <th style={{ ...th, textAlign: "center" }}>Estado</th>
            <th style={{ ...th, textAlign: "center" }}>Facturas</th>
            <th style={{ ...th, textAlign: "center" }}>Fecha Corte</th>
            <th style={{ ...th, textAlign: "right" }}>Costo Plan</th>
            <th style={th}>Notas</th>
            <th style={th}></th>
          </tr>
        </thead>
        <tbody>
          {clients.map((client) => {
            const isHov = hovered === client.id_servicio;
            return (
              <tr
                key={client.id_servicio}
                onMouseEnter={() => setHovered(client.id_servicio)}
                onMouseLeave={() => setHovered(null)}
                style={{ borderBottom: "1px solid #f1f5f9", background: isHov ? "#eff6ff" : "white" }}
              >
                <td style={{ ...td, textAlign: "center", color: "#94a3b8", fontSize: "12px" }}>
                  {client.id_servicio}
                </td>
                <td style={{ ...td, fontWeight: 500, color: "#0f172a", whiteSpace: "nowrap" }}>
                  {client.nombre}
                </td>
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#475569" }}>
                  {client.plan_internet?.nombre ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td style={{ ...td, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#64748b" }}>
                  {client.zona?.nombre ?? <span style={{ color: "#cbd5e1" }}>—</span>}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <ClientStatusBadge estado={(recoleccionIds?.has(client.id_servicio) && client.estado === "Suspendido") ? "Recoleccion" : client.estado} />
                </td>
                <td style={{ ...td, textAlign: "center", color: "#64748b" }}>
                  {client.estado_facturas}
                </td>
                <td style={{ ...td, textAlign: "center" }}>
                  <FechaCorteCell fecha={client.fecha_corte} alerta={client.alerta_corte} />
                </td>
                <td style={{ ...td, textAlign: "right", fontWeight: 600, color: "#0f172a" }}>
                  ${client.precio_plan}
                </td>
                <ObservacionCell
                  entityType="cliente"
                  entityId={client.id_servicio}
                  value={obsMap?.[client.id_servicio]}
                />
                <td style={{ ...td, textAlign: "center" }}>
                  <button onClick={() => onSelect(client.id_servicio)} style={verBtn}>Ver</button>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

const th: React.CSSProperties = {
  padding: "9px 14px",
  fontWeight: 600,
  fontSize: "11px",
  color: "#64748b",
  textAlign: "left",
  textTransform: "uppercase",
  letterSpacing: "0.05em",
  whiteSpace: "nowrap",
};

const td: React.CSSProperties = {
  padding: "11px 14px",
  color: "#334155",
};

const verBtn: React.CSSProperties = {
  padding: "3px 9px",
  borderRadius: "5px",
  border: "1px solid #dbeafe",
  background: "#eff6ff",
  color: "#2563eb",
  fontSize: "12px",
  cursor: "pointer",
  fontWeight: 600,
};
