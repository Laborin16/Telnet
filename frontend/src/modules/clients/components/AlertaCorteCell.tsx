import type { AlertaCorte } from "../../../core/types/client";

interface Props {
  dias: number | null;
  alerta: AlertaCorte | null;
}

const colorMap: Record<string, string> = {
  normal: "#16a34a",
  critico: "#dc2626",
  pendiente: "#d97706",
  suspendido: "#64748b",
};

export function AlertaCorteCell({ dias, alerta }: Props) {
  if (alerta === null) return <span style={{ color: "#94a3b8" }}>—</span>;

  const color = colorMap[alerta] ?? "#6b7280";

  if (alerta === "normal") {
    return <span style={{ color, fontWeight: 600 }}>Al corriente</span>;
  }
  if (alerta === "suspendido") {
    return <span style={{ color, fontWeight: 600 }}>Suspendido</span>;
  }
  if (alerta === "pendiente") {
    return <span style={{ color, fontWeight: 600 }}>Pago en {dias} día{dias !== 1 ? "s" : ""}</span>;
  }
  if (alerta === "critico") {
    if (dias !== null && dias < 0) {
      return (
        <span style={{ color, fontWeight: 600 }}>
          Venció hace {Math.abs(dias)} día{Math.abs(dias) !== 1 ? "s" : ""} — suspender
        </span>
      );
    }
    return <span style={{ color, fontWeight: 600 }}>Vence hoy</span>;
  }
  return <span>—</span>;
}