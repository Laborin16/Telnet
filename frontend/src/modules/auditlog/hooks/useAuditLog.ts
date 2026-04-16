import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

export interface AuditLogEntry {
  id: number;
  usuario_id: number | null;
  usuario_nombre: string;
  accion: string;
  modulo: string;
  entidad: string;
  entidad_id: string | null;
  descripcion: string;
  datos_extra: string | null;
  created_at: string;
}

interface AuditLogsResponse {
  total: number;
  page: number;
  page_size: number;
  items: AuditLogEntry[];
}

interface AuditFilters {
  page?: number;
  page_size?: number;
  modulo?: string;
  accion?: string;
  usuario_id?: number;
  search?: string;
  fecha_desde?: string;
  fecha_hasta?: string;
}

export function useAuditLogs(filters: AuditFilters) {
  const params = Object.fromEntries(
    Object.entries(filters).filter(([, v]) => v !== undefined && v !== "" && v !== null)
  );
  return useQuery<AuditLogsResponse>({
    queryKey: ["audit-logs", filters],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/v1/audit/logs", { params });
      return data;
    },
    staleTime: 10_000,
  });
}

export function useAuditUsuarios() {
  return useQuery<{ id: number | null; nombre: string }[]>({
    queryKey: ["audit-usuarios"],
    queryFn: async () => {
      const { data } = await apiClient.get("/api/v1/audit/usuarios");
      return data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}
