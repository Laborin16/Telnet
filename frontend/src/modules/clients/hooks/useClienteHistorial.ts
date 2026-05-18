import { useQuery } from "@tanstack/react-query";
import { fetchClienteHistorial, type HistorialResponse } from "../api/clients.api";

export function useClienteHistorial(idServicio: number | null) {
  return useQuery<HistorialResponse>({
    queryKey: ["cliente-historial", idServicio],
    queryFn: () => fetchClienteHistorial(idServicio!),
    enabled: idServicio !== null,
    staleTime: 30_000,
  });
}
