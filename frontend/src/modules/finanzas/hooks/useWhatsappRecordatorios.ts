import { useQuery, useMutation } from "@tanstack/react-query";
import apiClient from "../../../core/api/apiClient";

export interface PreviewGrupo {
  count: number;
  label: string;
}

export interface PreviewRecordatorios {
  dia_0: PreviewGrupo;
  dia_1: PreviewGrupo;
  dia_2: PreviewGrupo;
  dia_3: PreviewGrupo;
  dia_4: PreviewGrupo;
  total: number;
}

export interface ResultadoRecordatorios {
  recordatorios_enviados: number;
  cortes_ejecutados: number;
  errores: number;
}

export function usePreviewRecordatorios(enabled: boolean) {
  return useQuery<PreviewRecordatorios>({
    queryKey: ["whatsapp-preview"],
    queryFn: async () => {
      const res = await apiClient.get("/api/v1/whatsapp/preview-recordatorios");
      return res.data;
    },
    enabled,
    staleTime: 0,
  });
}

export function useEjecutarRecordatorios() {
  return useMutation<ResultadoRecordatorios>({
    mutationFn: async () => {
      const res = await apiClient.post("/api/v1/whatsapp/ejecutar-recordatorios");
      return res.data;
    },
  });
}
