import type { EstadoTarea, TipoTarea } from "../types/reportes";

export const SLA_HORAS: Record<TipoTarea, number> = {
  FALLA_RED:       4,
  SOPORTE_TECNICO: 8,
  MANTENIMIENTO:   24,
  CAMBIO_PLAN:     24,
  INSTALACION:     48,
  REUBICACION:     48,
  RECOLECCION:     72,
};

const ESTADOS_TERMINAL: EstadoTarea[] = ["COMPLETADO", "CANCELADO"];

export interface SLAInfo {
  aplica: boolean;
  vencida: boolean;
  enRiesgo: boolean;       // >= 75% del tiempo consumido
  horasTranscurridas: number;
  horasLimit: number;
  horasRestantes: number;  // negativo si vencida
}

export function calcularSLA(tipo: TipoTarea, estado: EstadoTarea, fechaCreada: string): SLAInfo {
  const aplica = !ESTADOS_TERMINAL.includes(estado);
  const horasLimit = SLA_HORAS[tipo];
  const horasTranscurridas = (Date.now() - new Date(fechaCreada).getTime()) / 3_600_000;
  const horasRestantes = horasLimit - horasTranscurridas;
  const porcentaje = horasTranscurridas / horasLimit;

  return {
    aplica,
    vencida:  aplica && porcentaje > 1,
    enRiesgo: aplica && porcentaje >= 0.75 && porcentaje <= 1,
    horasTranscurridas,
    horasLimit,
    horasRestantes,
  };
}

export function fmtHoras(horas: number): string {
  const abs = Math.abs(horas);
  if (abs < 1) return `${Math.round(abs * 60)}m`;
  if (abs < 24) return `${Math.round(abs)}h`;
  const dias = Math.floor(abs / 24);
  const h = Math.round(abs % 24);
  return h > 0 ? `${dias}d ${h}h` : `${dias}d`;
}
