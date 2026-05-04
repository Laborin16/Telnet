import { useQuery } from "@tanstack/react-query";
import {
  fetchEventos,
  fetchFotos,
  fetchTarea,
  fetchTareas,
  fetchTransicionesValidas,
} from "../api/reportes.api";
import type { TareaFiltros } from "../types/reportes";

export function useTareas(filtros: TareaFiltros = {}) {
  return useQuery({
    queryKey: ["tareas", filtros],
    queryFn: () => fetchTareas(filtros),
    staleTime: 30_000,
    refetchInterval: 30_000,
    placeholderData: (prev) => prev,
  });
}

export function useTarea(id: number | null) {
  return useQuery({
    queryKey: ["tarea", id],
    queryFn: () => fetchTarea(id!),
    enabled: id !== null,
    staleTime: 30_000,
    refetchInterval: 30_000,
  });
}

export function useTareaTransiciones(id: number | null) {
  return useQuery({
    queryKey: ["tarea-transiciones", id],
    queryFn: () => fetchTransicionesValidas(id!),
    enabled: id !== null,
    staleTime: 0,
  });
}

export function useTareaEventos(id: number | null) {
  return useQuery({
    queryKey: ["tarea-eventos", id],
    queryFn: () => fetchEventos(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}

export function useTareaFotos(id: number | null) {
  return useQuery({
    queryKey: ["tarea-fotos", id],
    queryFn: () => fetchFotos(id!),
    enabled: id !== null,
    staleTime: 30_000,
  });
}
