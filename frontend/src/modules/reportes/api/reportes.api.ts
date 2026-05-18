import apiClient from "../../../core/api/apiClient";
import type {
  AsignarTecnico,
  Tarea,
  TareaCreate,
  TareaEvento,
  TareaFiltros,
  TareaFoto,
  TareaUpdate,
  TransicionEstado,
  WispZona,
  WispPlan,
  WispRouter,
  WispIPs,
} from "../types/reportes";

const BASE = "/api/v1/reportes";

export async function fetchTareas(filtros: TareaFiltros = {}): Promise<Tarea[]> {
  const params = Object.fromEntries(
    Object.entries(filtros).filter(([, v]) => v !== undefined)
  );
  const { data } = await apiClient.get(`${BASE}/tareas`, { params });
  return data;
}

export async function fetchTarea(id: number): Promise<Tarea> {
  const { data } = await apiClient.get(`${BASE}/tareas/${id}`);
  return data;
}

export async function fetchTransicionesValidas(id: number): Promise<string[]> {
  const { data } = await apiClient.get(`${BASE}/tareas/${id}/transiciones`);
  return data;
}

export async function fetchEventos(id: number): Promise<TareaEvento[]> {
  const { data } = await apiClient.get(`${BASE}/tareas/${id}/eventos`);
  return data;
}

export async function crearTarea(datos: TareaCreate): Promise<Tarea> {
  const { data } = await apiClient.post(`${BASE}/tareas`, datos);
  return data;
}

export async function actualizarTarea(id: number, datos: TareaUpdate): Promise<Tarea> {
  const { data } = await apiClient.patch(`${BASE}/tareas/${id}`, datos);
  return data;
}

export async function asignarTecnico(id: number, datos: AsignarTecnico): Promise<Tarea> {
  const { data } = await apiClient.patch(`${BASE}/tareas/${id}/asignar`, datos);
  return data;
}

export async function transicionarEstado(id: number, datos: TransicionEstado): Promise<Tarea> {
  const { data } = await apiClient.post(`${BASE}/tareas/${id}/transicion`, datos);
  return data;
}

export async function fetchFotos(id: number): Promise<TareaFoto[]> {
  const { data } = await apiClient.get(`${BASE}/tareas/${id}/fotos`);
  return data;
}

export async function fetchZonas(): Promise<WispZona[]> {
  const { data } = await apiClient.get(`${BASE}/zonas`);
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function fetchPlanes(): Promise<WispPlan[]> {
  const { data } = await apiClient.get(`${BASE}/planes`);
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function fetchRouters(): Promise<WispRouter[]> {
  const { data } = await apiClient.get(`${BASE}/routers`);
  return Array.isArray(data) ? data : (data?.results ?? []);
}

export async function fetchIpsDisponibles(routerId: number): Promise<WispIPs> {
  const { data } = await apiClient.get(`${BASE}/ips-disponibles`, { params: { router_id: routerId } });
  return data as WispIPs;
}

export async function vincularServicio(tareaId: number, idServicio: number): Promise<Tarea> {
  const { data } = await apiClient.patch(`${BASE}/tareas/${tareaId}/vincular-servicio`, { id_servicio: idServicio });
  return data;
}

export interface InstalacionDatosUpdate {
  nombre_cliente?: string | null;
  telefono?: string | null;
  telefono2?: string | null;
  direccion?: string | null;
}

export async function actualizarDatosInstalacion(tareaId: number, datos: InstalacionDatosUpdate): Promise<Tarea> {
  const { data } = await apiClient.patch(`${BASE}/tareas/${tareaId}/instalacion-datos`, datos);
  return data;
}

export async function eliminarTarea(tareaId: number): Promise<void> {
  await apiClient.delete(`${BASE}/tareas/${tareaId}`);
}

export async function subirFoto(id: number, archivo: File): Promise<TareaFoto> {
  const formData = new FormData();
  formData.append("archivo", archivo);
  const { data } = await apiClient.post(`${BASE}/tareas/${id}/fotos`, formData, {
    headers: { "Content-Type": "multipart/form-data" },
  });
  return data;
}
