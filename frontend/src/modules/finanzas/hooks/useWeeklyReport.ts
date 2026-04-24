import { useState } from "react";
import apiClient from "../../../core/api/apiClient";

export type ReportFormat = "excel" | "pdf";

export function useDownloadReporte() {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const download = async (
    fechaInicio: string,
    fechaFin: string,
    format: ReportFormat,
  ) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await apiClient.get(
        `/api/v1/finanzas/reporte-semanal/${format}`,
        {
          params: { fecha_inicio: fechaInicio, fecha_fin: fechaFin },
          responseType: "blob",
          timeout: 60_000,
        },
      );
      const ext = format === "excel" ? "xlsx" : "pdf";
      const url = URL.createObjectURL(res.data as Blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `reporte_${fechaInicio}_${fechaFin}.${ext}`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      setError("No se pudo generar el reporte. Intenta de nuevo.");
    } finally {
      setIsLoading(false);
    }
  };

  return { download, isLoading, error };
}
