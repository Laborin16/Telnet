export type RecurrenciaPago = "NINGUNA" | "SEMANAL" | "QUINCENAL" | "MENSUAL" | "ANUAL";
export type EstadoPagoEmpresa = "PENDIENTE" | "PAGADO";

export interface Categoria {
  id: number;
  nombre: string;
  descripcion: string | null;
  orden: number;
  activa: boolean;
  created_at: string;
}

export interface PagoEmpresa {
  id: number;
  categoria_id: number;
  categoria_nombre: string;
  concepto: string;
  monto: number;
  fecha_vencimiento: string;
  recurrencia: RecurrenciaPago;
  estado: EstadoPagoEmpresa;
  proveedor: string | null;
  notas: string | null;
  comprobante_url: string | null;
  fecha_pago: string | null;
  recordatorio_enviado_at: string | null;
  created_at: string;
}

export interface PagoCreate {
  categoria_id: number;
  concepto: string;
  monto: number;
  fecha_vencimiento: string;
  recurrencia: RecurrenciaPago;
  proveedor?: string;
  notas?: string;
}

export interface PagoUpdate {
  concepto?: string;
  monto?: number;
  fecha_vencimiento?: string;
  recurrencia?: RecurrenciaPago;
  proveedor?: string | null;
  notas?: string | null;
  categoria_id?: number;
}

export interface CategoriaCreate {
  nombre: string;
  descripcion?: string;
  orden?: number;
}

export interface CategoriaUpdate {
  nombre?: string;
  descripcion?: string | null;
  orden?: number;
  activa?: boolean;
}

export const RECURRENCIA_LABEL: Record<RecurrenciaPago, string> = {
  NINGUNA:   "Único",
  SEMANAL:   "Semanal",
  QUINCENAL: "Quincenal",
  MENSUAL:   "Mensual",
  ANUAL:     "Anual",
};
