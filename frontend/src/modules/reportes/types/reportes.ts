export type TipoTarea =
  | "INSTALACION"
  | "RECOLECCION"
  | "FALLA_RED"
  | "SOPORTE_TECNICO"
  | "MANTENIMIENTO"
  | "CAMBIO_PLAN"
  | "REUBICACION";

export type EstadoTarea =
  | "PENDIENTE"
  | "ASIGNADO"
  | "EN_RUTA"
  | "EN_EJECUCION"
  | "BLOQUEADO"
  | "COMPLETADO"
  | "CANCELADO";

export type PrioridadTarea = "ALTA" | "MEDIA" | "BAJA";

export interface Tarea {
  id: number;
  id_servicio: number;
  tipo: TipoTarea;
  prioridad: PrioridadTarea;
  estado: EstadoTarea;
  descripcion: string;
  tecnico_id: number | null;
  supervisor_id: number;
  latitud: number | null;
  longitud: number | null;
  fecha_creada: string;
  fecha_asignada: string | null;
  fecha_iniciada: string | null;
  fecha_completada: string | null;
  updated_at: string;
}

export interface TareaEvento {
  id: number;
  tarea_id: number;
  usuario_id: number | null;
  usuario_nombre: string;
  timestamp: string;
  estado_anterior: EstadoTarea | null;
  estado_nuevo: EstadoTarea;
  comentario: string | null;
  lat_evento: number | null;
  lng_evento: number | null;
}

export interface TareaCreate {
  id_servicio: number;
  tipo: TipoTarea;
  prioridad?: PrioridadTarea;
  descripcion: string;
  tecnico_id?: number | null;
  latitud?: number | null;
  longitud?: number | null;
}

export interface TareaUpdate {
  prioridad?: PrioridadTarea;
  descripcion?: string;
  latitud?: number | null;
  longitud?: number | null;
}

export interface AsignarTecnico {
  tecnico_id: number;
}

export interface TransicionEstado {
  estado_nuevo: EstadoTarea;
  comentario?: string | null;
  lat_evento?: number | null;
  lng_evento?: number | null;
}

export interface TareaFiltros {
  estado?: EstadoTarea;
  tipo?: TipoTarea;
  prioridad?: PrioridadTarea;
}
