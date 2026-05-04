import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  actualizarTarea,
  asignarTecnico,
  crearTarea,
  subirFoto,
  transicionarEstado,
} from "../api/reportes.api";
import type {
  AsignarTecnico,
  Tarea,
  TareaCreate,
  TareaFoto,
  TareaUpdate,
  TransicionEstado,
} from "../types/reportes";
import { useToast } from "../../../shared/hooks/useToast";

export function useCrearTarea() {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation<Tarea, Error, TareaCreate>({
    mutationFn: crearTarea,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      addToast("Tarea creada correctamente", "success");
    },
    onError: (e) => addToast(e.message || "Error al crear tarea", "error"),
  });
}

export function useActualizarTarea(tareaId: number) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation<Tarea, Error, TareaUpdate>({
    mutationFn: (datos) => actualizarTarea(tareaId, datos),
    onSuccess: (tareaActualizada) => {
      queryClient.setQueryData(["tarea", tareaId], tareaActualizada);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      addToast("Tarea actualizada", "success");
    },
    onError: (e) => addToast(e.message || "Error al actualizar tarea", "error"),
  });
}

export function useAsignarTecnico(tareaId: number) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation<Tarea, Error, AsignarTecnico>({
    mutationFn: (datos) => asignarTecnico(tareaId, datos),
    onSuccess: (tareaActualizada) => {
      queryClient.setQueryData(["tarea", tareaId], tareaActualizada);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tarea-transiciones", tareaId] });
      addToast("Técnico asignado", "success");
    },
    onError: (e) => addToast(e.message || "Error al asignar técnico", "error"),
  });
}

export function useSubirFoto(tareaId: number) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation<TareaFoto, Error, File>({
    mutationFn: (archivo) => subirFoto(tareaId, archivo),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["tarea-fotos", tareaId] });
      addToast("Foto subida", "success");
    },
    onError: (e) => addToast(e.message || "Error al subir foto", "error"),
  });
}

export function useTransicionarEstado(tareaId: number) {
  const queryClient = useQueryClient();
  const { addToast } = useToast();
  return useMutation<Tarea, Error, TransicionEstado>({
    mutationFn: (datos) => transicionarEstado(tareaId, datos),
    onSuccess: (tareaActualizada) => {
      queryClient.setQueryData(["tarea", tareaId], tareaActualizada);
      queryClient.invalidateQueries({ queryKey: ["tareas"] });
      queryClient.invalidateQueries({ queryKey: ["tarea-transiciones", tareaId] });
      queryClient.invalidateQueries({ queryKey: ["tarea-eventos", tareaId] });
      addToast(`Estado actualizado a ${tareaActualizada.estado}`, "success");
    },
    onError: (e) => addToast(e.message || "Error al cambiar estado", "error"),
  });
}
