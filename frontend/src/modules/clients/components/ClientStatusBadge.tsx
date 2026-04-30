import type { EstadoServicio } from "../../../core/types/client";

interface Props {
  estado: EstadoServicio;
}

const labelMap: Record<EstadoServicio, string> = {
  Activo: "Activo",
  Suspendido: "Suspendido",
  Recoleccion: "Recolección",
  Cancelado: "Cancelado",
};

const colorMap: Record<EstadoServicio, string> = {
  Activo: "#16a34a",
  Suspendido: "#d97706",
  Recoleccion: "#7c3aed",
  Cancelado: "#dc2626",
};

export function ClientStatusBadge({ estado }: Props) {
  return (
    <span style={{
      padding: "2px 10px",
      borderRadius: "12px",
      fontSize: "12px",
      fontWeight: 600,
      backgroundColor: colorMap[estado],
      color: "white",
    }}>
      {labelMap[estado]}
    </span>
  );
}