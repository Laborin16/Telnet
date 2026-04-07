import { useQuery } from "@tanstack/react-query";
import { fetchClientDetail } from "../api/clients.api";

export function useClientDetail(id: number | null) {
  return useQuery({
    queryKey: ["client-detail", id],
    queryFn: () => fetchClientDetail(id!),
    enabled: id !== null,
    staleTime: 60_000,
  });
}