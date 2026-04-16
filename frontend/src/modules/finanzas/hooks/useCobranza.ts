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
  fecha_vencimiento: string;
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
  hoy: GrupoAlerta;
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
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export interface PagoWispHubInput {
  monto: number;
  forma_pago: number;
  tipo_pago?: string;
  cuenta?: string;
  id_servicio?: number;
  nombre_cliente?: string;
  fecha_pago_real?: string;
}

// ── Historial de pagos registrados ───────────────────────────────────────────

export interface HistorialPagoItem {
  id: number;
  id_cliente: string;
  nombre_cliente: string | null;
  id_factura: number | null;
  monto: number;
  metodo_pago: string;
  fecha_pago_real: string | null;
  fecha_registro: string;
  notas: string | null;
  comprobante_url: string | null;
}

export function useSubirComprobante() {
  const queryClient = useQueryClient();
  return useMutation<{ comprobante_url: string }, Error, { pago_id: number; file: File }>({
    mutationFn: async ({ pago_id, file }) => {
      const form = new FormData();
      form.append("file", file);
      const res = await apiClient.post(`/api/v1/finanzas/pagos/${pago_id}/comprobante`, form, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["historial-pagos"] });
    },
  });
}

export interface HistorialPagos {
  total: number;
  items: HistorialPagoItem[];
}

export function useHistorialPagos(search: string) {
  return useQuery<HistorialPagos>({
    queryKey: ["historial-pagos", search],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/historial", {
        params: search ? { search } : {},
      });
      return res.data;
    },
    staleTime: 60 * 1000,
  });
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
  id_tecnico?: number | null;
  nombre_tecnico?: string | null;
}

export function useObservaciones(entityType: string, ids: number[], enabled: boolean) {
  const key = ids.slice().sort((a, b) => a - b).join(",");
  return useQuery<Record<number, string>>({
    queryKey: ["observaciones", entityType, key],
    queryFn: async () => {
      if (!ids.length) return {};
      const res = await apiClient.get(`/api/v1/finanzas/observaciones/${entityType}`, {
        params: { ids: ids.join(",") },
      });
      return res.data;
    },
    enabled: enabled && ids.length > 0,
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useSaveObservacion() {
  const queryClient = useQueryClient();
  return useMutation<
    { entity_type: string; entity_id: number; notas: string },
    Error,
    { entity_type: string; entity_id: number; notas: string }
  >({
    mutationFn: async ({ entity_type, entity_id, notas }) => {
      const res = await apiClient.put(
        `/api/v1/finanzas/observaciones/${entity_type}/${entity_id}`,
        { notas }
      );
      return res.data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["observaciones", data.entity_type] });
    },
  });
}

export interface FormaPago {
  id: number;
  nombre: string;
}

export function useFormasPago() {
  return useQuery<FormaPago[]>({
    queryKey: ["formas-pago"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/formas-pago");
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export interface Tecnico {
  id: number;
  nombre: string;
}

export function useTecnicos() {
  return useQuery<Tecnico[]>({
    queryKey: ["tecnicos"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/tecnicos");
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
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
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useGuardarEstadoEquipo() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_servicio, ...data }: { id_servicio: number; estado_equipo: string; notas?: string; id_tecnico?: number | null; nombre_tecnico?: string | null }) => {
      const res = await apiClient.post(
        `/api/v1/finanzas/recoleccion/${id_servicio}/estado-equipo`,
        data
      );
      return res.data;
    },
    onMutate: async (variables) => {
      await queryClient.cancelQueries({ queryKey: ["recoleccion"] });
      const previous = queryClient.getQueryData(["recoleccion"]);
      queryClient.setQueryData(["recoleccion"], (old: any) => {
        if (!old) return old;
        return {
          ...old,
          items: old.items.map((item: any) =>
            item.id_servicio === variables.id_servicio
              ? {
                  ...item,
                  estado_equipo: variables.estado_equipo,
                  notas: variables.notas ?? item.notas,
                  id_tecnico: variables.id_tecnico ?? item.id_tecnico,
                  nombre_tecnico: variables.nombre_tecnico ?? item.nombre_tecnico,
                }
              : item
          ),
        };
      });
      return { previous };
    },
    onError: (_err: any, _variables: any, context: any) => {
      if (context?.previous) {
        queryClient.setQueryData(["recoleccion"], context.previous);
      }
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["recoleccion"] });
    },
  });
}