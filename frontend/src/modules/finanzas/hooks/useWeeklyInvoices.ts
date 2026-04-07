import { useQuery } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

export interface InvoiceItem {
  id_factura: number;
  fecha_emision: string;
  fecha_vencimiento: string;
  estado: string;
  total: number;
  tipo_cobro: "mensualidad" | "instalacion";
  cliente: {
    nombre: string;
    telefono: string;
    direccion: string;
  };
}

export interface WeeklyInvoices {
  semana_inicio: string;
  semana_fin: string;
  count: number;
  total_monto: number;
  total_pagado: number;
  total_pendiente: number;
  items: InvoiceItem[];
}

export function useWeeklyInvoices(weekStart: string) {
  return useQuery<WeeklyInvoices>({
    queryKey: ["cobros-semana", weekStart],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/finanzas/cobros-semana", {
        params: { fecha_inicio: weekStart },
      });
      return res.data;
    },
    staleTime: 2 * 60 * 1000,
  });
}
