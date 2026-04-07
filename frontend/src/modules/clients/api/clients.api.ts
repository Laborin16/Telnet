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