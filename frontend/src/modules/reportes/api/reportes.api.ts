import apiClient from "../../../core/api/apiClient";
import type {
  AsignarTecnico,
  Tarea,
  TareaCreate,
  TareaEvento,
  TareaFiltros,
  TareaUpdate,
  TransicionEstado,
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
