export interface PlanInternet {
  id: number;
  nombre: string;
}

export interface Zona {
  id: number;
  nombre: string;
}

export interface Router {
  id: number;
  nombre: string;
  falla_general: boolean;
  falla_general_descripcion: string;
}

export interface Tecnico {
  id: number;
  nombre: string;
}

export type EstadoServicio = "Activo" | "Suspendido" | "Cancelado";
export type AlertaCorte = "normal" | "proximo" | "critico" | "vencido";

export interface ClientItem {
  id_servicio: number;
  nombre: string;
  direccion: string;
  telefono: string;
  ip: string;
  estado: EstadoServicio;
  estado_facturas: string;
  saldo: number;
  precio_plan: number;
  fecha_corte: string | null;
  fecha_instalacion: string | null;
  fecha_cancelacion: string | null;
  dias_para_corte: number | null;
  alerta_corte: AlertaCorte | null;
  plan_internet: PlanInternet | null;
  zona: Zona | null;
  router: Router | null;
  tecnico: Tecnico | null;
}

export interface ClientListResponse {
  count: number;
  next: string | null;
  previous: string | null;
  results: ClientItem[];
}