import { useQuery } from "@tanstack/react-query";
import { fetchClients } from "../api/clients.api";
import type { ClientItem } from "../../../core/types/client";

export function useAllClients() {
  return useQuery({
    queryKey: ["clients-all"],
    queryFn: () => fetchClients({ page: 1, page_size: 9999 }),
    staleTime: 60_000,
    refetchInterval: 60_000,
    select: (data): ClientItem[] => data.results,
  });
}