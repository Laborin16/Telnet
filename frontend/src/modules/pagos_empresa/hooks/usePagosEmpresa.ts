import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import * as api from "../api/pagos_empresa.api";
import type {
  CategoriaCreate,
  CategoriaUpdate,
  PagoCreate,
  PagoUpdate,
} from "../types/pagos_empresa";

// ─── Categorías ────────────────────────────────────────────────────────────

export function useCategorias(incluirInactivas = false) {
  return useQuery({
    queryKey: ["pagos_empresa", "categorias", incluirInactivas],
    queryFn: () => api.fetchCategorias(incluirInactivas),
    staleTime: 60_000,
  });
}

export function useCrearCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: CategoriaCreate) => api.crearCategoria(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos_empresa", "categorias"] }),
  });
}

export function useActualizarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: CategoriaUpdate }) =>
      api.actualizarCategoria(id, payload),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["pagos_empresa", "categorias"] });
      qc.invalidateQueries({ queryKey: ["pagos_empresa", "pagos"] });
    },
  });
}

export function useEliminarCategoria() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.eliminarCategoria(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos_empresa", "categorias"] }),
  });
}


// ─── Pagos ─────────────────────────────────────────────────────────────────

export function usePagos(
  params: { categoria_id?: number; estado?: string; archivadas?: boolean },
  enabled = true,
) {
  return useQuery({
    queryKey: ["pagos_empresa", "pagos", params],
    queryFn: () => api.fetchPagos(params),
    enabled,
    staleTime: 30_000,
  });
}

export function useCrearPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (payload: PagoCreate) => api.crearPago(payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos_empresa", "pagos"] }),
  });
}

export function useActualizarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, payload }: { id: number; payload: PagoUpdate }) =>
      api.actualizarPago(id, payload),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos_empresa", "pagos"] }),
  });
}

export function useEliminarPago() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => api.eliminarPago(id),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos_empresa", "pagos"] }),
  });
}

export function useMarcarPagado() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ id, notas, comprobante }: { id: number; notas?: string; comprobante?: File | null }) =>
      api.marcarPagado(id, notas, comprobante),
    onSuccess: () => qc.invalidateQueries({ queryKey: ["pagos_empresa", "pagos"] }),
  });
}
