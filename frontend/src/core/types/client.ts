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

export type EstadoServicio = "Activo" | "Suspendido" | "Recoleccion" | "Cancelado";
export type AlertaCorte = "normal" | "critico" | "pendiente" | "suspendido";

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
  total_pages: number;
  page: number;
  page_size: number;
  results: ClientItem[];
}

export interface ClientDetail {
  id_servicio: number;
  usuario_rb: string;
  ip: string;
  estado: EstadoServicio;
  facturas_pagadas: boolean;
  firewall: boolean;
  fecha_corte: string | null;
  dias_para_corte: number | null;
  alerta_corte: AlertaCorte | null;
  auto_activar_servicio: boolean;
  forma_contratacion: string;
  comentarios: string;
  fecha_registro: string | null;
  fecha_instalacion: string | null;
  fecha_cancelacion: string | null;
  mac_cpe: string;
  ip_router_wifi: string | null;
  ssid_router_wifi: string;
  plan_internet: PlanInternet | null;
  zona: Zona | null;
  router: Router | null;
  tecnico: Tecnico | null;
}