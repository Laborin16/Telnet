import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

// ── Log de recordatorios ──────────────────────────────────────────────────

export interface LogItem {
  id: number;
  id_cliente: string;
  id_factura: number;
  dia_tolerancia: number;
  fecha_envio: string;
  exitoso: boolean;
  respuesta_api: string | null;
}

export interface LogCobranza {
  fecha: string;
  total: number;
  items: LogItem[];
}

export function useLogCobranza(fecha: string) {
  return useQuery<LogCobranza>({
    queryKey: ["log-cobranza", fecha],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/log-cobranza", { params: { fecha } });
      return res.data;
    },
    staleTime: 60 * 1000,
    enabled: !!fecha,
  });
}

// ── Ejecutar flujo de cobranza ────────────────────────────────────────────

export interface ResultadoCobranza {
  recordatorios_enviados: number;
  cortes_ejecutados: number;
  errores: number;
}

export function useEjecutarCobranza(fecha: string) {
  const queryClient = useQueryClient();
  return useMutation<ResultadoCobranza>({
    mutationFn: async () => {
      const res = await apiClient.post("/api/v1/finanzas/ejecutar-cobranza");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["log-cobranza", fecha] });
    },
  });
}

// ── Pagos registrados manualmente ────────────────────────────────────────

export interface PagoRegistrado {
  id: number;
  id_cliente: string;
  id_factura: number | null;
  monto: number;
  fecha_pago: string;
  metodo_pago: string;
  verificado: boolean;
  notas: string | null;
}

export interface PagosDelDia {
  fecha: string;
  total: number;
  items: PagoRegistrado[];
}

export function usePagosDelDia(fecha: string) {
  return useQuery<PagosDelDia>({
    queryKey: ["pagos-dia", fecha],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/pagos", { params: { fecha } });
      return res.data;
    },
    staleTime: 60 * 1000,
    enabled: !!fecha,
  });
}

export interface PagoCreate {
  id_cliente: string;
  id_factura?: number;
  monto: number;
  metodo_pago: string;
  notas?: string;
}

export function useRegistrarPago(fecha: string) {
  const queryClient = useQueryClient();
  return useMutation<PagoRegistrado, Error, PagoCreate>({
    mutationFn: async (data) => {
      const res = await apiClient.post("/api/v1/finanzas/pagos", data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["pagos-dia", fecha] });
    },
  });
}

// ── Alertas de cobranza por días vencidos ─────────────────────────────────

export interface ClienteAlerta {
  id_servicio: number;
  nombre: string;
  telefono: string;
  estado: string;
  fecha_corte: string;
  dias_vencido: number;
  id_factura?: number;
  total?: number;
}

export interface GrupoAlerta {
  count: number;
  items: ClienteAlerta[];
}

export interface AlertasCobranza {
  total: number;
  dia_1: GrupoAlerta;
  dia_2: GrupoAlerta;
  dia_3: GrupoAlerta;
  mas_de_3: GrupoAlerta;
}

export function useAlertasCobranza() {
  return useQuery<AlertasCobranza>({
    queryKey: ["alertas-cobranza"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/alertas-cobranza");
      return res.data;
    },
    staleTime: 3 * 60 * 1000,
  });
}

export interface PagoWispHubInput {
  monto: number;
  forma_pago: number;
}

export function useRegistrarPagoWispHub() {
  const queryClient = useQueryClient();
  return useMutation<{ messages: string[]; task_id: string }, Error, { id_factura: number } & PagoWispHubInput>({
    mutationFn: async ({ id_factura, ...data }) => {
      const res = await apiClient.post(`/api/v1/finanzas/registrar-pago/${id_factura}`, data);
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["alertas-cobranza"] });
      queryClient.invalidateQueries({ queryKey: ["cobros-semana"] });
      queryClient.invalidateQueries({ queryKey: ["cobros-dia"] });
    },
  });
}

export interface ItemRecoleccion {
  id_servicio: number;
  id_factura: number;
  nombre: string;
  direccion: string;
  telefono: string;
  estado: string;
  fecha_vencimiento: string;
  dias_vencido: number;
  total: number;
  estado_equipo?: string | null;
  notas?: string | null;
}

export interface RecoleccionData {
  total: number;
  items: ItemRecoleccion[];
}

export function useRecoleccion() {
  return useQuery<RecoleccionData>({
    queryKey: ["recoleccion"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/recoleccion");
      return res.data;
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useGuardarEstadoEquipo() {
  const queryClient = useQueryClient();
  return useMutation<
    { id_servicio: number; estado_equipo: string },
    Error,
    { id_servicio: number; estado_equipo: string; notas?: string }
  >({
    mutationFn: async ({ id_servicio, ...data }) => {
      const res = await apiClient.post(
        `/api/v1/finanzas/recoleccion/${id_servicio}/estado-equipo`,
        data
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["recoleccion"] });
    },
  });
}