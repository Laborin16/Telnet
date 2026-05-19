import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/nomina.api";
import type { BonoOverride, IncidenciaCreate, IncidenciaUpdate, PrestamoCreate, PrestamoUpdate, RegistroUpdate } from "../types/nomina";


// ─── Periodos ───────────────────────────────────────────────────────────────

export function usePeriodos() {
  return useQuery({
    queryKey: ["nomina", "periodos"],
    queryFn: api.fetchPeriodos,
    staleTime: 30_000,
  });
}

export function usePeriodo(id: number | null) {
  return useQuery({
    queryKey: ["nomina", "periodo", id],
    queryFn: () => api.fetchPeriodo(id!),
    enabled: id !== null,
    staleTime: 15_000,
  });
}

export function useCrearPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (fecha_inicio?: string) => api.crearPeriodo(fecha_inicio),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina"] });
    },
  });
}

export function useCerrarPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.cerrarPeriodo,
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo", id] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useReabrirPeriodo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.reabrirPeriodo,
    onSuccess: (_d, id) => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo", id] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
    },
  });
}


// ─── Registros ──────────────────────────────────────────────────────────────

export function useActualizarRegistro() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: RegistroUpdate }) =>
      api.actualizarRegistro(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo"] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useSetBonoOverride() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, override }: { id: number; override: BonoOverride }) =>
      api.setBonoOverride(id, override),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo"] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}


// ─── Incidencias ────────────────────────────────────────────────────────────

export function useCrearIncidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ registro_id, payload }: { registro_id: number; payload: IncidenciaCreate }) =>
      api.crearIncidencia(registro_id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo"] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useActualizarIncidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: IncidenciaUpdate }) =>
      api.actualizarIncidencia(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo"] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useEliminarIncidencia() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.eliminarIncidencia,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo"] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useDiferirCuota() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, diferida }: { id: number; diferida: boolean }) =>
      api.diferirCuota(id, diferida),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "periodo"] });
      qc.invalidateQueries({ queryKey: ["nomina", "periodos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "prestamos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}


// ─── Préstamos ──────────────────────────────────────────────────────────────

export function usePrestamos(soloActivos = false) {
  return useQuery({
    queryKey: ["nomina", "prestamos", soloActivos],
    queryFn: () => api.fetchPrestamos(soloActivos),
    staleTime: 30_000,
  });
}

export function useCrearPrestamo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PrestamoCreate) => api.crearPrestamo(payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "prestamos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useActualizarPrestamo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PrestamoUpdate }) =>
      api.actualizarPrestamo(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "prestamos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}

export function useCancelarPrestamo() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: api.cancelarPrestamo,
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["nomina", "prestamos"] });
      qc.invalidateQueries({ queryKey: ["nomina", "dashboard"] });
    },
  });
}


// ─── Dashboard ──────────────────────────────────────────────────────────────

export function useDashboardNomina() {
  return useQuery({
    queryKey: ["nomina", "dashboard"],
    queryFn: api.fetchDashboardNomina,
    staleTime: 30_000,
    refetchInterval: 60_000,
  });
}
