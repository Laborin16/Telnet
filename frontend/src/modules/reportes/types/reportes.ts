export type TipoTarea =
  | "INSTALACION"
  | "SERVICIO"
  | "RECOLECCION"
  | "RECONEXION"
  | "CAMBIO_DOMICILIO"
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

export interface InstalacionDatos {
  nombre_cliente: string;
  telefono: string | null;
  telefono2: string | null;
  direccion: string | null;
  router_id: number;
  router_nombre: string | null;
  zona_id: number | null;
  zona_nombre: string | null;
  plan_id: number;
  plan_nombre: string | null;
  ip_asignada: string;
  wisphub_sync: "pending" | "registrado" | "vinculado" | "error";
  wisphub_task_id: string | null;
  wisphub_error?: string;
}

export interface Tarea {
  id: number;
  id_servicio: number | null;
  tipo: TipoTarea;
  prioridad: PrioridadTarea;
  estado: EstadoTarea;
  descripcion: string;
  tecnico_id: number | null;
  supervisor_id: number;
  latitud: number | null;
  longitud: number | null;
  datos_instalacion: InstalacionDatos | null;
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

export interface InstalacionCreate {
  nombre_cliente: string;
  telefono?: string | null;
  telefono2?: string | null;
  direccion?: string | null;
  router_id: number;
  router_nombre?: string | null;
  plan_id: number;
  plan_nombre?: string | null;
  ip_asignada: string;
}

export interface TareaCreate {
  id_servicio?: number | null;
  tipo: TipoTarea;
  prioridad?: PrioridadTarea;
  descripcion: string;
  tecnico_id?: number | null;
  latitud?: number | null;
  longitud?: number | null;
  instalacion?: InstalacionCreate | null;
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
  tecnico_id?: number;
}

export interface TareaFoto {
  id: number;
  tarea_id: number;
  ruta: string;
  nombre_original: string;
  subido_por_nombre: string;
  timestamp: string;
}

export interface WispZona {
  id: number;
  nombre: string;
}

export interface WispPlan {
  id: number;
  nombre: string;
  precio?: number;
}

export interface WispRouter {
  id: number;
  nombre: string;
}

export interface WispIPOcupada {
  ip: string;
  nombre: string;
  estado: string;
}

export interface WispIPs {
  disponibles: string[];
  ocupadas: WispIPOcupada[];
}
