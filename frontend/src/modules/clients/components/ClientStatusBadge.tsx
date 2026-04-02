import type { EstadoServicio } from "../../../core/types/client";

interface Props {
  estado: EstadoServicio;
}

const labelMap: Record<EstadoServicio, string> = {
  Activo: "Activo",
  Suspendido: "Suspendido",
  Cancelado: "Cancelado",
};

export function ClientStatusBadge({ estado }: Props) {
  return (
    <span style={{
      padding: "2px 10px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 600,
      backgroundColor: estado === "Activo" ? "#16a34a" : estado === "Suspendido" ? "#d97706" : "#dc2626",
      color: "white",
    }}>
      {labelMap[estado]}
    </span>
  );
}