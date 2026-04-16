import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

export interface ResumenDia {
  dia: number;
  label: string;
  count: number;
}

export interface ResumenWhatsApp {
  fecha: string;
  suspension_habilitada: boolean;
  resumen: ResumenDia[];
  total: number;
}

export interface ResultadoEnvio {
  enviados: number;
  errores: number;
  suspendidos: number;
  detalle: {
    nombre: string;
    dias: number;
    estado: string;
    template?: string;
    error?: string;
  }[];
}

export function useResumenWhatsApp() {
  return useQuery<ResumenWhatsApp>({
    queryKey: ["whatsapp-resumen"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/whatsapp/resumen");
      return res.data;
    },
    staleTime: 60_000,
    refetchInterval: 60_000,
  });
}

export function useEjecutarRecordatorios() {
  const queryClient = useQueryClient();
  return useMutation<ResultadoEnvio>({
    mutationFn: async () => {
      const res = await apiClient.post("/api/v1/whatsapp/ejecutar-recordatorios");
      return res.data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["whatsapp-resumen"] });
      queryClient.invalidateQueries({ queryKey: ["alertas-cobranza"] });
    },
  });
}