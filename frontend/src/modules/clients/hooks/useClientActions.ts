import { useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";
import type { ClientListResponse, ClientDetail, EstadoServicio } from "../../../core/types/client";

async function suspendClient(id: number) {
  const { data } = await apiClient.post(`/api/v1/clients/${id}/suspend`);
  return data;
}

async function activateClient(id: number) {
  const { data } = await apiClient.post(`/api/v1/clients/${id}/activate`);
  return data;
}

export function useClientActions() {
  const queryClient = useQueryClient();

  function updateCaches(id: number, estado: EstadoServicio) {
    queryClient.setQueryData<ClientListResponse>(["clients-all"], (old) => {
      if (!old) return old;
      return {
        ...old,
        results: old.results.map((c) =>
          c.id_servicio === id ? { ...c, estado } : c
        ),
      };
    });

    queryClient.setQueryData<ClientDetail>(["client-detail", id], (old) => {
      if (!old) return old;
      return { ...old, estado };
    });
  }

  const suspend = useMutation({
    mutationFn: suspendClient,
    onSuccess: (_, id) => updateCaches(id, "Suspendido"),
  });

  const activate = useMutation({
    mutationFn: activateClient,
    onSuccess: (_, id) => updateCaches(id, "Activo"),
  });

  return { suspend, activate };
}