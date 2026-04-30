import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  actualizarTarea,
  asignarTecnico,
  crearTarea,
  transicionarEstado,
} from "../api/reportes.api";
import type {
  AsignarTecnico,
  Tarea,
  TareaCreate,
  TareaUpdate,
  TransicionEstado,
} from "../types/reportes";

export function useCrearTarea() {
  const queryClient = useQueryClient();
  return useMutation<Tarea, Error, TareaCreate>({
    mutationFn: crearTarea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
    },
  });
}

export function useActualizarTarea(tareaId: number) {
  const queryClient = useQueryClient();
  return useMutation<Tarea, Error, TareaUpdate>({
    mutationFn: (datos) => actualizarTarea(tareaId, datos),
    onSuccess: (tareaActualizada) => {
      queryClient.setQueryData(["tarea", tareaId], tareaActualizada);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
    },
  });
}

export function useAsignarTecnico(tareaId: number) {
  const queryClient = useQueryClient();
  return useMutation<Tarea, Error, AsignarTecnico>({
    mutationFn: (datos) => asignarTecnico(tareaId, datos),
    onSuccess: (tareaActualizada) => {
      queryClient.setQueryData(["tarea", tareaId], tareaActualizada);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tarea-transiciones", tareaId] });
    },
  });
}

export function useTransicionarEstado(tareaId: number) {
  const queryClient = useQueryClient();
  return useMutation<Tarea, Error, TransicionEstado>({
    mutationFn: (datos) => transicionarEstado(tareaId, datos),
    onSuccess: (tareaActualizada) => {
      queryClient.setQueryData(["tarea", tareaId], tareaActualizada);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tarea-transiciones", tareaId] });
      queryClient.invalidateQueries({ queryKey: ["tarea-eventos", tareaId] });
    },
  });
}
