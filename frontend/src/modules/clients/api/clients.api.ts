import apiClient from "../../../core/api/apiClient";
import type { ClientListResponse, ClientItem, ClientDetail } from "../../../core/types/client";

export interface ClientFilters {
  page?: number;
  page_size?: number;
  status?: string;
  search?: string;
}

export async function fetchClients(filters: ClientFilters): Promise<ClientListResponse> {
  const { data } = await apiClient.get("/api/v1/clients/", { params: filters });
  return data;
}

export async function fetchClientById(id: number): Promise<ClientItem> {
  const { data } = await apiClient.get(`/api/v1/clients/${id}`);
  return data;
}

export async function fetchClientDetail(id: number): Promise<ClientDetail> {
  const { data } = await apiClient.get(`/api/v1/clients/${id}`);
  return data;
}

export interface HistorialEvento {
  id: number;
  id_servicio: number;
  tipo_evento: string;
  fecha: string;
  usuario_id: number | null;
  usuario_nombre: string;
  titulo: string;
  descripcion: string | null;
  datos_extra: Record<string, unknown> | null;
  tarea_id: number | null;
  pago_id: number | null;
}

export interface HistorialResponse {
  total: number;
  items: HistorialEvento[];
}

export async function fetchClienteHistorial(idServicio: number): Promise<HistorialResponse> {
  const { data } = await apiClient.get(`/api/v1/clients/${idServicio}/historial`);
  return data;
}