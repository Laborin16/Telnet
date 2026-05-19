export type EstadoPeriodo = "BORRADOR" | "CERRADA";

export type EstadoPrestamo = "ACTIVO" | "PAGADO" | "CANCELADO";

export type TipoIncidencia =
  | "PERCEPCION_EXTRA"
  | "HORA_EXTRA"
  | "BONO_PRODUCTIVIDAD"
  | "ADELANTO"
  | "CUOTA_PRESTAMO"
  | "DESCUENTO_FALTA"
  | "DESCUENTO_RETARDO"
  | "DESCUENTO_BIEN"
  | "OTRO";


export interface Incidencia {
  id: number;
  registro_id: number;
  tipo: TipoIncidencia;
  monto: number;
  descripcion: string | null;
  prestamo_id: number | null;
  auto_generada: boolean;
  diferida: boolean;
  created_at: string;
}

export interface IncidenciaCreate {
  tipo: TipoIncidencia;
  monto: number;
  descripcion?: string;
}

export interface IncidenciaUpdate {
  tipo?: TipoIncidencia;
  monto?: number;
  descripcion?: string | null;
}


export interface DiaBono {
  dia_idx: number;            // 1=lunes ... 7=domingo
  cuota: number;
  asignadas_total: number;
  completadas_total: number;
  cumplido: boolean;
}

export interface BonoPreview {
  aplica: boolean;
  monto_bono: number;
  dias_cumplidos: number;
  dias_requeridos: number;
  gana: boolean;
  detalle_dias: DiaBono[];
}

export type BonoOverride = "AGREGAR" | "QUITAR" | null;

export interface Registro {
  id: number;
  periodo_id: number;
  usuario_id: number;
  usuario_nombre: string;
  area: string | null;

  dia_1: number;
  dia_2: number;
  dia_3: number;
  dia_4: number;
  dia_5: number;
  dia_6: number;
  dia_7: number;

  dias_trabajados: number;
  horas_extra: number;
  sueldo_semanal_aplicado: number | null;

  importe_base: number;
  monto_horas_extra: number;
  percepciones_extra: number;
  deducciones: number;
  total_a_pagar: number;

  notas: string | null;
  bono_override: BonoOverride;
  incidencias: Incidencia[];
  bono: BonoPreview | null;
}

export interface RegistroUpdate {
  dia_1?: number;
  dia_2?: number;
  dia_3?: number;
  dia_4?: number;
  dia_5?: number;
  dia_6?: number;
  dia_7?: number;
  horas_extra?: number;
  notas?: string | null;
}


export interface PeriodoResumen {
  id: number;
  fecha_inicio: string;          // ISO YYYY-MM-DD
  fecha_fin: string;
  estado: EstadoPeriodo;
  total_empleados: number;
  total_a_pagar: number;
  created_at: string;
  closed_at: string | null;
}

export interface PeriodoDetalle {
  id: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoPeriodo;
  created_at: string;
  closed_at: string | null;
  closed_by_usuario_id: number | null;
  registros: Registro[];
  total_a_pagar: number;
}


export interface Prestamo {
  id: number;
  usuario_id: number;
  usuario_nombre: string;
  monto_total: number;
  cuota_semanal: number;
  cuotas_totales: number;
  cuotas_pagadas: number;
  cuotas_restantes: number;
  saldo_pendiente: number;
  fecha_inicio: string;
  estado: EstadoPrestamo;
  motivo: string | null;
  created_at: string;
}

export interface PrestamoCreate {
  usuario_id: number;
  monto_total: number;
  cuota_semanal: number;
  cuotas_totales: number;
  fecha_inicio?: string;
  motivo?: string;
}

export interface PrestamoUpdate {
  cuota_semanal?: number;
  cuotas_totales?: number;
  motivo?: string | null;
  estado?: EstadoPrestamo;
}


export interface CostoPorArea {
  area: string;
  empleados: number;
  total: number;
}

export interface Dashboard {
  periodo_actual_id: number | null;
  costo_semanal: number;
  empleados_en_nomina: number;
  costo_por_area: CostoPorArea[];
  prestamos_activos: number;
  monto_prestamos_pendiente: number;
}


export const TIPO_INCIDENCIA_LABEL: Record<TipoIncidencia, string> = {
  PERCEPCION_EXTRA:    "Percepción extra",
  HORA_EXTRA:          "Hora extra",
  BONO_PRODUCTIVIDAD:  "Bono de productividad",
  ADELANTO:            "Adelanto",
  CUOTA_PRESTAMO:      "Cuota de préstamo",
  DESCUENTO_FALTA:     "Descuento por falta",
  DESCUENTO_RETARDO:   "Descuento por retardo",
  DESCUENTO_BIEN:      "Descuento por bien dañado/extraviado",
  OTRO:                "Otro",
};

export const NOMBRES_DIAS = ["Lun", "Mar", "Mié", "Jue", "Vie", "Sáb", "Dom"] as const;


/**
 * Devuelve el número de semana ISO 8601 (1-53) para una fecha YYYY-MM-DD.
 * Las semanas ISO empiezan en lunes y la semana 1 es la que contiene el primer jueves del año.
 */
export function getSemanaISO(iso: string): number {
  const d = new Date(iso + "T00:00:00");
  d.setHours(0, 0, 0, 0);
  // Mueve al jueves de la misma semana (ISO ancla la semana en su jueves)
  d.setDate(d.getDate() + 3 - ((d.getDay() + 6) % 7));
  const yearStart = new Date(d.getFullYear(), 0, 4);
  return Math.round(
    ((d.getTime() - yearStart.getTime()) / 86_400_000 - 3 + ((yearStart.getDay() + 6) % 7)) / 7,
  ) + 1;
}
