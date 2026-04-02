import { useQuery } from "@tanstack/react-query";
import { fetchClients } from "../api/clients.api";
import type { ClientFilters } from "../api/clients.api";

export function useClients(filters: ClientFilters = {}) {
  return useQuery({
    queryKey: ["clients", filters],
    queryFn: () => fetchClients(filters),
    staleTime: 90_000,
    placeholderData: (prev) => prev,
  });
}