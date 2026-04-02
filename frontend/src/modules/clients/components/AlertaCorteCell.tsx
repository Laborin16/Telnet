import type { AlertaCorte } from "../../../core/types/client";

interface Props {
  dias: number | null;
  alerta: AlertaCorte | null;
}

const colorMap: Record<string, string> = {
  normal: "#16a34a",
  proximo: "#d97706",
  critico: "#dc2626",
  vencido: "#7f1d1d",
};

export function AlertaCorteCell({ dias, alerta }: Props) {
  if (dias === null || alerta === null) return <span>—</span>;

  const color = colorMap[alerta] ?? "#6b7280";
  const texto = dias < 0 ? `Vencido hace ${Math.abs(dias)} días` : `${dias} días`;

  return (
    <span style={{ color, fontWeight: 600 }}>
      {texto}
    </span>
  );
}