import apiClient from "../../../core/api/apiClient";
import type {
  Categoria,
  CategoriaCreate,
  CategoriaUpdate,
  PagoCreate,
  PagoEmpresa,
  PagoUpdate,
} from "../types/pagos_empresa";

const BASE = "/api/v1/pagos-empresa";


// ─── Categorías ────────────────────────────────────────────────────────────

export async function fetchCategorias(incluirInactivas = false): Promise<Categoria[]> {
  const { data } = await apiClient.get(`${BASE}/categorias`, {
    params: incluirInactivas ? { incluir_inactivas: true } : {},
  });
  return data;
}

export async function crearCategoria(payload: CategoriaCreate): Promise<Categoria> {
  const { data } = await apiClient.post(`${BASE}/categorias`, payload);
  return data;
}

export async function actualizarCategoria(id: number, payload: CategoriaUpdate): Promise<Categoria> {
  const { data } = await apiClient.patch(`${BASE}/categorias/${id}`, payload);
  return data;
}

export async function eliminarCategoria(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/categorias/${id}`);
}


// ─── Pagos ─────────────────────────────────────────────────────────────────

export async function fetchPagos(params: {
  categoria_id?: number;
  estado?: string;
  archivadas?: boolean;
}): Promise<PagoEmpresa[]> {
  const { data } = await apiClient.get(`${BASE}/pagos`, { params });
  return data;
}

export async function crearPago(payload: PagoCreate): Promise<PagoEmpresa> {
  const { data } = await apiClient.post(`${BASE}/pagos`, payload);
  return data;
}

export async function actualizarPago(id: number, payload: PagoUpdate): Promise<PagoEmpresa> {
  const { data } = await apiClient.patch(`${BASE}/pagos/${id}`, payload);
  return data;
}

export async function eliminarPago(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/pagos/${id}`);
}

export async function marcarPagado(
  id: number,
  notas?: string,
  comprobante?: File | null,
): Promise<{ pago: PagoEmpresa; siguiente: PagoEmpresa | null }> {
  const form = new FormData();
  form.append("data", JSON.stringify({ notas: notas ?? null }));
  if (comprobante) form.append("comprobante", comprobante);
  const { data } = await apiClient.post(`${BASE}/pagos/${id}/pagar`, form, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
