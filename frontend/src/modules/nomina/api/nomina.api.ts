import apiClient from "../../../core/api/apiClient";
import type {
  BonoOverride,
  Dashboard,
  Incidencia,
  IncidenciaCreate,
  IncidenciaUpdate,
  PeriodoDetalle,
  PeriodoResumen,
  Prestamo,
  PrestamoCreate,
  PrestamoUpdate,
  Registro,
  RegistroUpdate,
} from "../types/nomina";

const BASE = "/api/v1/nomina";


// ─── Periodos ───────────────────────────────────────────────────────────────

export async function fetchPeriodos(): Promise<PeriodoResumen[]> {
  const { data } = await apiClient.get(`${BASE}/periodos`);
  return data;
}

export async function fetchPeriodo(id: number): Promise<PeriodoDetalle> {
  const { data } = await apiClient.get(`${BASE}/periodos/${id}`);
  return data;
}

export async function crearPeriodo(fecha_inicio?: string): Promise<PeriodoDetalle> {
  const { data } = await apiClient.post(`${BASE}/periodos`, fecha_inicio ? { fecha_inicio } : {});
  return data;
}

export async function cerrarPeriodo(id: number): Promise<PeriodoDetalle> {
  const { data } = await apiClient.post(`${BASE}/periodos/${id}/cerrar`);
  return data;
}

export async function reabrirPeriodo(id: number): Promise<PeriodoDetalle> {
  const { data } = await apiClient.post(`${BASE}/periodos/${id}/reabrir`);
  return data;
}


// ─── Registros ──────────────────────────────────────────────────────────────

export async function actualizarRegistro(id: number, payload: RegistroUpdate): Promise<Registro> {
  const { data } = await apiClient.patch(`${BASE}/registros/${id}`, payload);
  return data;
}

export async function setBonoOverride(id: number, override: BonoOverride): Promise<Registro> {
  const { data } = await apiClient.post(`${BASE}/registros/${id}/bono-override`, { override });
  return data;
}

export function urlReciboIndividualPdf(registro_id: number): string {
  return `${BASE}/registros/${registro_id}/recibo.pdf`;
}

export function urlRecibosPeriodoPdf(periodo_id: number): string {
  return `${BASE}/periodos/${periodo_id}/recibos.pdf`;
}

async function descargarPdf(url: string, filename: string): Promise<void> {
  const res = await apiClient.get(url, { responseType: "blob" });
  const blob = new Blob([res.data], { type: "application/pdf" });
  const blobUrl = URL.createObjectURL(blob);
  // Abre en nueva pestaña; el navegador renderiza inline
  const win = window.open(blobUrl, "_blank");
  if (!win) {
    // Si el navegador bloquea popup, fallback a descarga
    const a = document.createElement("a");
    a.href = blobUrl;
    a.download = filename;
    a.click();
  }
  setTimeout(() => URL.revokeObjectURL(blobUrl), 60_000);
}

export function abrirReciboIndividual(registro_id: number): Promise<void> {
  return descargarPdf(urlReciboIndividualPdf(registro_id), `recibo_${registro_id}.pdf`);
}

export function abrirRecibosPeriodo(periodo_id: number): Promise<void> {
  return descargarPdf(urlRecibosPeriodoPdf(periodo_id), `recibos_periodo_${periodo_id}.pdf`);
}


// ─── Incidencias ────────────────────────────────────────────────────────────

export async function crearIncidencia(registro_id: number, payload: IncidenciaCreate): Promise<Incidencia> {
  const { data } = await apiClient.post(`${BASE}/registros/${registro_id}/incidencias`, payload);
  return data;
}

export async function actualizarIncidencia(id: number, payload: IncidenciaUpdate): Promise<Incidencia> {
  const { data } = await apiClient.patch(`${BASE}/incidencias/${id}`, payload);
  return data;
}

export async function eliminarIncidencia(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/incidencias/${id}`);
}

export async function diferirCuota(id: number, diferida: boolean): Promise<Incidencia> {
  const { data } = await apiClient.post(`${BASE}/incidencias/${id}/diferir`, { diferida });
  return data;
}


// ─── Préstamos ──────────────────────────────────────────────────────────────

export async function fetchPrestamos(solo_activos = false): Promise<Prestamo[]> {
  const { data } = await apiClient.get(`${BASE}/prestamos`, { params: { solo_activos } });
  return data;
}

export async function crearPrestamo(payload: PrestamoCreate): Promise<Prestamo> {
  const { data } = await apiClient.post(`${BASE}/prestamos`, payload);
  return data;
}

export async function actualizarPrestamo(id: number, payload: PrestamoUpdate): Promise<Prestamo> {
  const { data } = await apiClient.patch(`${BASE}/prestamos/${id}`, payload);
  return data;
}

export async function cancelarPrestamo(id: number): Promise<void> {
  await apiClient.delete(`${BASE}/prestamos/${id}`);
}


// ─── Dashboard ──────────────────────────────────────────────────────────────

export async function fetchDashboardNomina(): Promise<Dashboard> {
  const { data } = await apiClient.get(`${BASE}/dashboard`);
  return data;
}
