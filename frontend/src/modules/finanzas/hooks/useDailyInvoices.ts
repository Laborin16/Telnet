import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

export interface DailyPaymentItem {
  id_factura: number;
  fecha_pago: string;
  estado: string;
  verificado: boolean;
  monto_individual: number;
  metodo_pago: string;
  tipo_cobro: "mensualidad" | "instalacion";
  cliente: {
    id_servicio?: number;
    nombre: string;
    telefono: string;
    direccion: string;
  };
}

export interface DailyInvoices {
  fecha: string;
  fecha_fin: string;
  numero_total_pagos: number;
  monto_total_cobrado: number;
  lista_clientes: DailyPaymentItem[];
}

export function useDailyInvoices(fecha: string, fechaFin?: string) {
  return useQuery<DailyInvoices>({
    queryKey: ["cobros-dia", fecha, fechaFin],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/cobros-dia", {
        params: { fecha, ...(fechaFin ? { fecha_fin: fechaFin } : {}) },
      });
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
    enabled: !!fecha,
  });
}

export function useToggleVerificacion(fecha: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id_factura, notas }: { id_factura: number; notas?: string }) => {
      const res = await apiClient.patch(
        `/api/v1/finanzas/cobros-dia/${id_factura}/verificar`,
        null,
        { params: notas ? { notas } : undefined }
      );
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["cobros-dia", fecha] });
    },
  });
}
