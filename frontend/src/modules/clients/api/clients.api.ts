import apiClient from "../../../core/api/apiClient";
import type { ClientListResponse, ClientItem } from "../../../core/types/client";

export interface ClientFilters {
  page?: number;
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